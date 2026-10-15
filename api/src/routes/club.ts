// Rutas del club en PRODUCCIÓN (AUTH_MODE=firebase + DATA_MODE=firestore). Sustituyen a /progreso,
// /certificados y /verificar del modo dev y agregan /video y /stripe. Todo lo que acredita avance,
// emite certificados o cobra lo hace el webhook actual con el ID token del propio miembro.
import { Router, type Request, type RequestHandler } from 'express';
import type { ClubProduccionService } from '../services/clubProduccion.js';
import { asyncHandler } from './util.js';

/** Authorization ya validado por requireUser; se reenvía tal cual al webhook. */
const authorization = (req: Request) => req.header('authorization') ?? '';
const cuerpo = (req: Request) => (req.body ?? {}) as Record<string, unknown>;

export function rutaVideo(svc: ClubProduccionService, requireUser: RequestHandler): Router {
  const r = Router();
  // POST /video/token — AUTH. { cursoId, n } → { embedUrl, expires, preview, playbackSessionId|null }; 403 { motivo, desbloqueo? }.
  r.post('/token', requireUser, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store, private');
    res.json(await svc.videoToken(authorization(req), cuerpo(req)));
  }));
  return r;
}

export function rutaProgresoProduccion(svc: ClubProduccionService, requireUser: RequestHandler): Router {
  const r = Router();
  // GET /progreso — AUTH. { [cursoId]: { vistas, porcentaje, ultima, actualizado } } desde users.progress.
  r.get('/', requireUser, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await svc.progresoDe(req.usuario!.uid));
  }));
  // POST /progreso/:cursoId/evento — AUTH. Evento real del reproductor; acredita el webhook.
  r.post('/:cursoId/evento', requireUser, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await svc.eventoReproduccion(authorization(req), req.params.cursoId, cuerpo(req)));
  }));
  return r;
}

export function rutaCertificadosProduccion(svc: ClubProduccionService, requireUser: RequestHandler): Router {
  const r = Router();
  // GET /certificados — AUTH. certificates where uid == uid del token.
  r.get('/', requireUser, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await svc.certificadosDe(req.usuario!.uid));
  }));
  // POST /certificados — AUTH. { cursoId } → lo emite el webhook (409 honesto si faltan clases).
  r.post('/', requireUser, asyncHandler(async (req, res) => {
    res.status(201).json(await svc.emitirCertificado(authorization(req), cuerpo(req)));
  }));
  return r;
}

export function rutaVerificarProduccion(svc: ClubProduccionService): Router {
  const r = Router();
  // GET /verificar/:folio — PÚBLICO. { valido, folio, nombre, curso, cursoTitulo, emitido }; sin uid ni email.
  r.get('/:folio', asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json(await svc.verificar(req.params.folio));
  }));
  return r;
}

export function rutaStripe(svc: ClubProduccionService, requireUser: RequestHandler): Router {
  const r = Router();
  // POST /stripe/checkout — AUTH. { plan: 'mensual'|'anual' } → { url } (Checkout del webhook).
  r.post('/checkout', requireUser, asyncHandler(async (req, res) => {
    res.json(await svc.checkout(authorization(req), cuerpo(req)));
  }));
  // POST /stripe/portal — AUTH. → { url } (portal de facturación del webhook).
  r.post('/portal', requireUser, asyncHandler(async (req, res) => {
    res.json(await svc.portal(authorization(req)));
  }));
  // POST /stripe/confirmar — AUTH. { sessionId? } → { activa, plan, vence } releyendo users/{uid}.subscription.
  r.post('/confirmar', requireUser, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await svc.confirmar(req.usuario!.uid));
  }));
  return r;
}
