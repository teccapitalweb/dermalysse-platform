// Limitador de tasa por ventana fija, en memoria, sin dependencias externas.
// Mismo espíritu que el resto del repo (CORS, auth y políticas escritas a mano):
// pequeño, puro y con reloj inyectable para probarlo de forma determinista.
//
// Cuenta peticiones por clave (por defecto req.ip) dentro de una ventana. Al pasar
// el máximo responde 429 con el mismo código que ya usa la API ('demasiadas-solicitudes'),
// Retry-After y las cabeceras RateLimit-* (borrador IETF). No sustituye a un WAF ni a
// un almacén compartido entre instancias; es una primera barrera contra abuso y
// fuerza bruta (p. ej. canje de cupones) suficiente para una sola instancia.
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export interface OpcionesRateLimit {
  /** Tamaño de la ventana en milisegundos. */
  ventanaMs: number;
  /** Peticiones permitidas por ventana y por clave. */
  max: number;
  /** Reloj inyectable (ms). Por defecto Date.now. */
  ahora?: () => number;
  /** Identidad del solicitante. Por defecto req.ip. */
  clave?: (req: Request) => string;
  /** Código de error en el cuerpo del 429. */
  codigo?: string;
  /** Mensaje del 429. */
  mensaje?: string;
}

interface Entrada {
  conteo: number;
  reinicioEn: number;
}

const LIMPIEZA_UMBRAL = 10_000;

/** Crea un middleware de Express que limita la tasa por clave con ventana fija. */
export function crearRateLimiter(opciones: OpcionesRateLimit): RequestHandler {
  const ventanaMs = Math.max(1, Math.floor(opciones.ventanaMs));
  const max = Math.max(1, Math.floor(opciones.max));
  const ahora = opciones.ahora ?? (() => Date.now());
  const clave = opciones.clave ?? ((req: Request) => req.ip ?? 'desconocida');
  const codigo = opciones.codigo ?? 'demasiadas-solicitudes';
  const mensaje = opciones.mensaje ?? 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
  const almacen = new Map<string, Entrada>();

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const t = ahora();
    const id = clave(req);

    let entrada = almacen.get(id);
    if (!entrada || t >= entrada.reinicioEn) {
      entrada = { conteo: 0, reinicioEn: t + ventanaMs };
      almacen.set(id, entrada);
    }
    entrada.conteo += 1;

    // Limpieza perezosa: solo cuando el mapa crece, purga ventanas vencidas para no fugar memoria.
    if (almacen.size > LIMPIEZA_UMBRAL) {
      for (const [k, v] of almacen) if (t >= v.reinicioEn) almacen.delete(k);
    }

    const restantes = Math.max(0, max - entrada.conteo);
    const resetSeg = Math.max(0, Math.ceil((entrada.reinicioEn - t) / 1000));
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(restantes));
    res.setHeader('RateLimit-Reset', String(resetSeg));

    if (entrada.conteo > max) {
      res.setHeader('Retry-After', String(resetSeg));
      res.status(429).json({ error: codigo, mensaje, reintentarEn: resetSeg });
      return;
    }
    next();
  };
}
