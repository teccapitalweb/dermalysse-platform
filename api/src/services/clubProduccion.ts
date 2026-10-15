// Club en PRODUCCIÓN (AUTH_MODE=firebase + DATA_MODE=firestore): reproducción, avance, certificados y
// pagos pasan por el webhook actual, que sigue siendo la única pieza que habla con Bunny y Stripe y la
// única que acredita avance y emite certificados. Aquí solo se valida la entrada, se traduce la clase
// n a lessonId (POR POSICIÓN, con Firestore `courses`) y se adaptan las respuestas al contrato.
import type { CertificateStore, ProgressStore } from '../adapters/interfaces.js';
import { aIso, texto, type FirestorePort } from '../adapters/firestore/port.js';
import { FOLIO_DRML, certificadoDesdeDoc, resolverLeccion } from '../adapters/firestore/club.js';
import { membershipAccess } from '../adapters/firebase/accessPolicy.js';
import { ErrorWebhook, MENSAJE_NO_DISPONIBLE, type LegacyWebhookClient } from '../adapters/legacy/webhook.js';
import type { CertificadoRemoto, ProgresoMapa, VerificacionPublica } from '../domain/types.js';
import { CodedError, NotFoundError, ValidationError } from './errors.js';

export const EVENTOS_REPRODUCTOR = ['timeupdate', 'pause', 'ended'] as const;
export const PLANES = ['mensual', 'anual'] as const;

export interface TokenVideo { embedUrl: string; expires: number; preview: boolean; playbackSessionId: string | null }
export interface ResultadoEvento { completada: boolean; ratio: number; vistas: number[]; porcentaje: number }
export interface EstadoSuscripcion { activa: boolean; plan: 'mensual' | 'anual' | null; vence: string | null }

const sinRespuesta = () => new CodedError(502, 'webhook/respuesta-invalida', MENSAJE_NO_DISPONIBLE);

function cursoYClase(cursoId: unknown, n: unknown): { cursoId: string; n: number } {
  const id = typeof cursoId === 'string' ? cursoId.trim() : '';
  const num = Number(n);
  if (!id || id.length > 160) throw new ValidationError('Falta cursoId.');
  if (!Number.isInteger(num) || num < 1 || num > 500) throw new ValidationError('El número de clase no es válido.');
  return { cursoId: id, n: num };
}

/** 403 del webhook ⇒ { motivo, desbloqueo? } (reason/unlockAt del webhook). El resto se propaga igual. */
function traducirRechazo(e: unknown): never {
  if (e instanceof ErrorWebhook && e.status === 403) {
    const desbloqueo = aIso(e.cuerpo.unlockAt);
    throw new CodedError(403, 'sin-acceso', e.message, {
      motivo: texto(e.cuerpo.reason) || 'sin-acceso',
      ...(desbloqueo ? { desbloqueo } : {}),
    });
  }
  throw e;
}

export interface OpcionesClubProduccion {
  /** URL pública del club nuevo (APP_URL), sin barra final. */
  appUrl: string;
}

export class ClubProduccionService {
  constructor(
    private readonly db: FirestorePort,
    private readonly webhook: LegacyWebhookClient,
    private readonly progreso: ProgressStore,
    private readonly certificados: CertificateStore,
    private readonly opciones: OpcionesClubProduccion,
  ) {}

  private async leccion(cursoId: string, n: number): Promise<string> {
    const r = await resolverLeccion(this.db, cursoId, n);
    if (!r) throw new NotFoundError('La clase no existe o no está publicada.');
    return r.lessonId;
  }

  /** POST /video/token → webhook POST /bunny/playback { courseId, lessonId }. */
  async videoToken(authorization: string, cuerpo: Record<string, unknown>): Promise<TokenVideo> {
    const { cursoId, n } = cursoYClase(cuerpo.cursoId, cuerpo.n);
    const lessonId = await this.leccion(cursoId, n);
    const r = await this.webhook.post('/bunny/playback', authorization, { courseId: cursoId, lessonId }).catch(traducirRechazo);
    const embedUrl = texto(r.embedUrl);
    if (!/^https:\/\//.test(embedUrl)) throw sinRespuesta();
    return {
      embedUrl,
      expires: Number(r.expires) || 0,
      preview: r.preview === true,
      playbackSessionId: typeof r.playbackSessionId === 'string' && r.playbackSessionId ? r.playbackSessionId : null,
    };
  }

  /** POST /progreso/:cursoId/evento → webhook POST /courses/progress (acredita el webhook). */
  async eventoReproduccion(authorization: string, cursoIdRuta: string, cuerpo: Record<string, unknown>): Promise<ResultadoEvento> {
    const { cursoId, n } = cursoYClase(cursoIdRuta, cuerpo.n);
    const playbackSessionId = texto(cuerpo.playbackSessionId);
    if (!/^[0-9a-f]{36}$/.test(playbackSessionId)) throw new ValidationError('Sesión de reproducción inválida.');
    const positionSeconds = Number(cuerpo.positionSeconds);
    if (!Number.isFinite(positionSeconds) || positionSeconds < 0) throw new ValidationError('positionSeconds no es válido.');
    const durationSeconds = Number(cuerpo.durationSeconds);
    const event = (EVENTOS_REPRODUCTOR as readonly unknown[]).includes(cuerpo.event) ? cuerpo.event as string : 'timeupdate';
    const lessonId = await this.leccion(cursoId, n);
    const r = await this.webhook.post('/courses/progress', authorization, {
      courseId: cursoId,
      lessonId,
      playbackSessionId,
      positionSeconds,
      ...(Number.isFinite(durationSeconds) && durationSeconds > 0 ? { durationSeconds } : {}),
      event,
    }).catch(traducirRechazo);
    if (typeof r.completed !== 'boolean') throw sinRespuesta();
    const vistas = (Array.isArray(r.completedLessonIndexes) ? r.completedLessonIndexes : [])
      .map(Number).filter((x) => Number.isInteger(x) && x > 0).sort((a, b) => a - b);
    return {
      completada: r.completed,
      ratio: Number(r.completionRatio) || 0,
      vistas,
      porcentaje: Number(r.courseProgress) || 0,
    };
  }

  progresoDe(uid: string): Promise<ProgresoMapa> { return this.progreso.del(uid); }

  certificadosDe(uid: string): Promise<CertificadoRemoto[]> { return this.certificados.listar(uid); }

  /** POST /certificados → webhook POST /courses/certificate (folio DRML-YYYY-<12 hex>; 409 si faltan clases). */
  async emitirCertificado(authorization: string, cuerpo: Record<string, unknown>): Promise<CertificadoRemoto> {
    const cursoId = typeof cuerpo.cursoId === 'string' ? cuerpo.cursoId.trim() : '';
    if (!cursoId || cursoId.length > 160) throw new ValidationError('Falta cursoId.');
    const r = await this.webhook.post('/courses/certificate', authorization, { courseId: cursoId }).catch(traducirRechazo);
    const code = texto(r.code).toUpperCase();
    if (!FOLIO_DRML.test(code)) throw sinRespuesta();
    return certificadoDesdeDoc(code, r);
  }

  /** Verificación pública: sin uid ni email. Acepta DRML-YYYY-XXXXXXXXXXXX (mayúsculas o minúsculas). */
  async verificar(folio: string): Promise<VerificacionPublica> {
    const cert = await this.certificados.porFolio(folio);
    if (!cert) return { valido: false, folio, nombre: '', cursoTitulo: '', curso: '', emitido: '' };
    return { valido: true, folio: cert.folio, nombre: cert.nombre, cursoTitulo: cert.cursoTitulo, curso: cert.cursoTitulo, emitido: cert.emitido };
  }

  private url(ruta: string): string { return `${this.opciones.appUrl}${ruta}`; }

  /** POST /stripe/checkout → webhook /create-checkout-session (conserva metadata.source='dermalysse'). */
  async checkout(authorization: string, cuerpo: Record<string, unknown>): Promise<{ url: string }> {
    const plan = cuerpo.plan;
    if (!(PLANES as readonly unknown[]).includes(plan)) throw new ValidationError('Plan inválido (mensual o anual).');
    const r = await this.webhook.post('/create-checkout-session', authorization, {
      plan,
      // Stripe reemplaza {CHECKOUT_SESSION_ID}; la página de suscripción confirma con POST /stripe/confirmar.
      successUrl: this.url('/#/suscripcion?pago=exito&session_id={CHECKOUT_SESSION_ID}'),
      cancelUrl: this.url('/#/suscripcion?pago=cancelado'),
    });
    const url = texto(r.url);
    if (!/^https:\/\//.test(url)) throw sinRespuesta();
    return { url };
  }

  /** POST /stripe/portal → webhook /create-portal-session (400 honesto si no hay cliente de Stripe). */
  async portal(authorization: string): Promise<{ url: string }> {
    const r = await this.webhook.post('/create-portal-session', authorization, { returnUrl: this.url('/#/suscripcion') });
    const url = texto(r.url);
    if (!/^https:\/\//.test(url)) throw sinRespuesta();
    return { url };
  }

  /**
   * POST /stripe/confirmar → relee users/{uid}.subscription (la escribe el webhook de Stripe).
   * `activa` aplica la regla de acceso SOLO a la suscripción (sin cortesía).
   */
  async confirmar(uid: string): Promise<EstadoSuscripcion> {
    const datos = (await this.db.get(`users/${uid}`)).data() ?? {};
    const sub = (typeof datos.subscription === 'object' && datos.subscription !== null ? datos.subscription : {}) as Record<string, unknown>;
    const planCrudo = texto(sub.plan).toLowerCase();
    return {
      activa: membershipAccess({ subscription: sub }).allowed,
      plan: planCrudo === 'mensual' || planCrudo === 'anual' ? planCrudo : null,
      vence: aIso(sub.currentPeriodEnd),
    };
  }
}
