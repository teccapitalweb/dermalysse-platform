// Avance real de video en modo API. Lógica pura (sin DOM, red ni imports) para probarla con
// `node --test` (scripts/test-produccion.mjs). La UI vive en src/ui/reproductor.ts.
//
// - El reproductor de Bunny Stream habla el protocolo player.js por postMessage.
// - El servidor acredita la clase (85 % visto, tiempo topado al real, exige la clase anterior);
//   el cliente solo reporta posiciones: timeupdate cada ~15 s, pause y ended.

export type EventoVideo = 'timeupdate' | 'pause' | 'ended';
export interface PosicionVideo { seconds: number; duration: number }

export const INTERVALO_PROGRESO_MS = 15_000;

const finito = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN);

/** Normaliza el `value` de un evento player.js ({seconds, duration}). null si no trae posición. */
export function normalizarPosicion(valor: unknown, anterior?: PosicionVideo): PosicionVideo | null {
  if (!valor || typeof valor !== 'object') return null;
  const v = valor as Record<string, unknown>;
  const seconds = finito(v.seconds);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  const durationLeida = finito(v.duration);
  const duration = Number.isFinite(durationLeida) && durationLeida > 0 ? durationLeida : anterior?.duration ?? 0;
  return { seconds: duration > 0 ? Math.min(seconds, duration) : seconds, duration };
}

export interface OpcionesReportador<R> {
  enviar: (evento: EventoVideo, posicion: PosicionVideo) => Promise<R>;
  alResultado?: (resultado: R, evento: EventoVideo) => void;
  alError?: (error: unknown, evento: EventoVideo) => void;
  intervaloMs?: number;
  ahora?: () => number;
}

/**
 * Regula los envíos al servidor:
 * - timeupdate: como máximo uno cada `intervaloMs` y nunca con otro envío en curso;
 * - pause: solo si hay una posición que el servidor aún no conoce;
 * - ended: siempre (con la posición al final del video);
 * - pause/ended que llegan con un envío en curso se encolan (ended tiene prioridad).
 */
export function crearReportadorProgreso<R>(op: OpcionesReportador<R>) {
  const intervalo = op.intervaloMs ?? INTERVALO_PROGRESO_MS;
  const ahora = op.ahora ?? (() => Date.now());
  let ultimo: PosicionVideo = { seconds: 0, duration: 0 };
  let ultimoEnvio = Number.NEGATIVE_INFINITY;
  let enCurso: Promise<void> | null = null;
  let pendiente: EventoVideo | null = null;
  let sinEnviar = false;
  let detenido = false;

  const encolar = (evento: EventoVideo) => { if (pendiente !== 'ended') pendiente = evento; };

  function despachar(evento: EventoVideo) {
    ultimoEnvio = ahora();
    sinEnviar = false;
    const posicion = { ...ultimo };
    let envio: Promise<R>;
    try { envio = Promise.resolve(op.enviar(evento, posicion)); } catch (e) { envio = Promise.reject(e); }
    enCurso = envio
      .then((r) => { op.alResultado?.(r, evento); }, (e) => { op.alError?.(e, evento); })
      .finally(() => {
        enCurso = null;
        if (pendiente) { const siguiente = pendiente; pendiente = null; despachar(siguiente); }
      });
  }

  return {
    /** Registra un evento del reproductor. Devuelve true si generó o encoló un envío. */
    evento(evento: EventoVideo, valor?: unknown): boolean {
      if (detenido) return false;
      const pos = normalizarPosicion(valor, ultimo);
      if (pos) {
        if (pos.seconds !== ultimo.seconds || pos.duration !== ultimo.duration) sinEnviar = true;
        ultimo = pos;
      }
      if (evento === 'ended' && ultimo.duration > 0 && ultimo.seconds < ultimo.duration) {
        ultimo = { ...ultimo, seconds: ultimo.duration };
        sinEnviar = true;
      }
      if (ultimo.duration <= 0) return false;
      if (evento === 'timeupdate') {
        if (enCurso || ahora() - ultimoEnvio < intervalo) return false;
        despachar('timeupdate');
        return true;
      }
      if (evento === 'pause' && !sinEnviar) return false;
      if (enCurso) { encolar(evento); return true; }
      despachar(evento);
      return true;
    },
    /** Al salir de la clase: reporta una pausa si el servidor no conoce la última posición. */
    detener(): boolean {
      if (detenido) return false;
      detenido = true;
      if (!sinEnviar || ultimo.duration <= 0) return false;
      if (enCurso) encolar('pause'); else despachar('pause');
      return true;
    },
    get posicion(): PosicionVideo { return { ...ultimo }; },
    /** Promesa del envío en curso (útil en pruebas). */
    esperar(): Promise<void> { return enCurso ?? Promise.resolve(); },
  };
}

// ── Protocolo player.js (https://github.com/embedly/player.js) ──

export const PLAYERJS_CONTEXTO = 'player.js';
export const PLAYERJS_VERSION = '0.0.11';

export interface MensajePlayerJs { event: string; value?: unknown; listener?: string }

/** Lee un mensaje del iframe. Acepta texto JSON u objeto; null si no es de player.js. */
export function leerMensajePlayerJs(data: unknown): MensajePlayerJs | null {
  let d: unknown = data;
  if (typeof d === 'string') {
    if (!d.includes(PLAYERJS_CONTEXTO)) return null;
    try { d = JSON.parse(d); } catch { return null; }
  }
  if (!d || typeof d !== 'object') return null;
  const m = d as Record<string, unknown>;
  if (m.context !== PLAYERJS_CONTEXTO || typeof m.event !== 'string' || !m.event) return null;
  return { event: m.event, value: m.value, listener: typeof m.listener === 'string' ? m.listener : undefined };
}

/** Mensaje host → reproductor (método player.js), serializado como lo hace la librería oficial. */
export function mensajePlayerJs(method: string, value?: unknown, listener?: string): string {
  const m: Record<string, unknown> = { context: PLAYERJS_CONTEXTO, version: PLAYERJS_VERSION, method };
  if (value !== undefined) m.value = value;
  if (listener) m.listener = listener;
  return JSON.stringify(m);
}

// ── 403 de POST /video/token: { motivo, desbloqueo? } ──

export type TipoBloqueo = 'clase_anterior' | 'membresia' | 'no_liberado' | 'sesion' | 'sin_video' | 'otro';
export interface BloqueoVideo {
  tipo: TipoBloqueo;
  /** Clase que hay que completar antes (clase_anterior). */
  clase?: number;
  /** Fecha ISO en que se libera (no_liberado). */
  fecha?: string;
  /** Días que faltan, si el servidor los da. */
  dias?: number;
  /** Mensaje legible del servidor, si lo trae. */
  mensaje?: string;
}

const aFecha = (v: unknown): string | undefined => {
  const n = finito(v);
  if (Number.isFinite(n) && n > 1e11) return new Date(n).toISOString();
  if (typeof v === 'string' && /\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString();
  return undefined;
};

/**
 * Traduce el rechazo del servidor a un estado honesto para la clase. Acepta los motivos del
 * webhook actual (previous_lesson_required, membership_required, drip_locked, scheduled_locked,
 * course_not_published) y equivalentes en español.
 */
export function clasificarBloqueo(status: number, cuerpo: unknown, n?: number): BloqueoVideo {
  const c = (cuerpo && typeof cuerpo === 'object' ? cuerpo : {}) as Record<string, unknown>;
  const motivo = String(c.motivo ?? c.codigo ?? c.error ?? '').toLowerCase();
  const legible = [c.mensaje, c.error].find((x) => typeof x === 'string' && x.includes(' ')) as string | undefined;
  const d = c.desbloqueo;
  const det = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
  const base: BloqueoVideo = { tipo: 'otro', ...(legible ? { mensaje: legible } : {}) };

  if (status === 401) return { ...base, tipo: 'sesion' };
  if (status === 404 || /sin_video|video_no|no_video|en_preparacion|not_found/.test(motivo)) return { ...base, tipo: 'sin_video' };
  if (status === 402) return { ...base, tipo: 'membresia' };
  if (/anterior|previa|previous|secuencia|sequence|orden/.test(motivo)) {
    const numero = [det.n, det.clase, det.claseRequerida, typeof d === 'number' || typeof d === 'string' ? d : undefined]
      .map(finito).find((x) => Number.isInteger(x) && x > 0 && x < 1000);
    const clase = numero ?? (n && n > 1 ? n - 1 : undefined);
    return { ...base, tipo: 'clase_anterior', ...(clase ? { clase } : {}) };
  }
  if (/liber|program|lanz|drip|schedul|disponib|publica|published|release|unlock/.test(motivo)) {
    const fecha = aFecha(det.fecha) ?? aFecha(det.unlockAt) ?? aFecha(det.disponibleDesde) ?? aFecha(det.desde) ?? aFecha(d) ?? aFecha(c.disponibleDesde);
    const diasLeidos = finito(det.dias ?? det.daysLeft ?? det.diasRestantes);
    return { ...base, tipo: 'no_liberado', ...(fecha ? { fecha } : {}), ...(Number.isFinite(diasLeidos) && diasLeidos >= 0 ? { dias: Math.ceil(diasLeidos) } : {}) };
  }
  // Después de «no liberado»: «no se ha liberado para tu membresía» no pide pagar.
  if (/membres|membership|vip|suscrip|subscription|plan_requerido/.test(motivo)) return { ...base, tipo: 'membresia' };
  return base;
}
