// Cliente del webhook ACTUAL (dermalysse-webhook en Railway). Es la única pieza que habla con
// Stripe y Bunny y que acredita avance y emite certificados; la API solo le reenvía el ID token
// del miembro (Authorization) y traduce las respuestas. fetch es inyectable para las pruebas.
// Errores honestos: 4xx del webhook se propagan con su mensaje; 5xx, red, tiempo agotado o una
// respuesta ilegible ⇒ 502. Nunca se inventan datos.
import { CodedError } from '../../services/errors.js';

export interface RespuestaHttp {
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}

export type FetchLike = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}) => Promise<RespuestaHttp>;

export interface OpcionesWebhook {
  baseUrl: string;
  fetch?: FetchLike;
  /** Tiempo máximo por petición (ms). */
  timeoutMs?: number;
}

const CODIGO_POR_ESTADO: Record<number, string> = {
  400: 'webhook/validacion',
  401: 'auth/token-invalido',
  402: 'webhook/pago-requerido',
  403: 'sin-acceso',
  404: 'no-encontrado',
  409: 'conflicto',
  410: 'sesion-expirada',
  429: 'demasiadas-solicitudes',
};

export const MENSAJE_NO_DISPONIBLE = 'El servidor del club no respondió. Intenta de nuevo en unos minutos.';

/** Rechazo 4xx del webhook. `cuerpo` (reason, unlockAt…) NO se serializa al cliente tal cual. */
export class ErrorWebhook extends CodedError {
  constructor(status: number, codigo: string, mensaje: string, readonly cuerpo: Record<string, unknown>) {
    super(status, codigo, mensaje);
    this.name = 'ErrorWebhook';
  }
}

export class LegacyWebhookClient {
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike;
  private readonly timeoutMs: number;

  constructor(opciones: OpcionesWebhook) {
    this.baseUrl = opciones.baseUrl.replace(/\/+$/, '');
    this.fetchFn = opciones.fetch ?? ((url, init) => fetch(url, init));
    this.timeoutMs = opciones.timeoutMs ?? 15000;
  }

  /**
   * POST JSON al webhook reenviando el Authorization del miembro. Devuelve el cuerpo (2xx) o lanza
   * ErrorWebhook (4xx con el estado y mensaje del webhook; reason/unlockAt en `cuerpo`) o
   * CodedError 502 ante cualquier otra falla.
   */
  async post(ruta: string, authorization: string, cuerpo: Record<string, unknown>): Promise<Record<string, unknown>> {
    let respuesta: RespuestaHttp;
    try {
      respuesta = await this.fetchFn(`${this.baseUrl}${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authorization },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      const agotado = (e as { name?: string })?.name === 'TimeoutError' || (e as { name?: string })?.name === 'AbortError';
      console.error(`[api] webhook ${ruta}: ${agotado ? 'tiempo agotado' : 'error de red'}`);
      throw new CodedError(502, 'webhook/no-disponible', MENSAJE_NO_DISPONIBLE);
    }

    let datos: Record<string, unknown> | null = null;
    try {
      const j = await respuesta.json();
      if (j && typeof j === 'object' && !Array.isArray(j)) datos = j as Record<string, unknown>;
    } catch { datos = null; }

    if (respuesta.status >= 200 && respuesta.status < 300) {
      if (!datos) {
        console.error(`[api] webhook ${ruta}: respuesta ${respuesta.status} ilegible`);
        throw new CodedError(502, 'webhook/respuesta-invalida', MENSAJE_NO_DISPONIBLE);
      }
      return datos;
    }
    if (respuesta.status >= 400 && respuesta.status < 500) {
      const mensaje = typeof datos?.error === 'string' && datos.error.trim() ? datos.error.trim().slice(0, 300) : 'La solicitud no fue aceptada.';
      throw new ErrorWebhook(respuesta.status, CODIGO_POR_ESTADO[respuesta.status] ?? 'webhook/rechazo', mensaje, datos ?? {});
    }
    // 5xx (o un estado inesperado): nunca se reenvía el mensaje interno (puede traer detalles de Stripe).
    console.error(`[api] webhook ${ruta}: estado ${respuesta.status}`);
    throw new CodedError(502, 'webhook/no-disponible', MENSAJE_NO_DISPONIBLE);
  }
}
