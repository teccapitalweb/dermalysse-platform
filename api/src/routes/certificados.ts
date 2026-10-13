import { Router, type RequestHandler } from 'express';
import type { LearningService } from '../services/learning.js';
import { ValidationError } from '../services/errors.js';
import { asyncHandler } from './util.js';

export function rutaCertificados(svc: LearningService, requireUser: RequestHandler): Router {
  const r = Router();

  // GET /certificados — AUTH. Lista de certificados del propio usuario (incluye uid propio).
  r.get('/', requireUser, asyncHandler(async (req, res) => {
    res.json(await svc.certificadosDe(req.usuario!.uid));
  }));

  // POST /certificados — AUTH. Emite folio SOLO si todas las clases están acreditadas; si no, 409 honesto.
  r.post('/', requireUser, asyncHandler(async (req, res) => {
    const cuerpo = (req.body ?? {}) as { cursoId?: unknown };
    const cursoId = typeof cuerpo.cursoId === 'string' ? cuerpo.cursoId : '';
    if (!cursoId) throw new ValidationError('Falta cursoId.');
    const cert = await svc.emitirCertificado(req.usuario!, cursoId);
    res.status(201).json({ folio: cert.folio, cursoId: cert.cursoId, emitido: cert.emitido });
  }));

  return r;
}
