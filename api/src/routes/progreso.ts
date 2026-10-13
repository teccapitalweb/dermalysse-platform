import { Router, type RequestHandler } from 'express';
import type { LearningService } from '../services/learning.js';
import { asyncHandler } from './util.js';

export function rutaProgreso(svc: LearningService, requireUser: RequestHandler): Router {
  const r = Router();

  // GET /progreso — AUTH. Mapa de progreso del usuario.
  r.get('/', requireUser, asyncHandler(async (req, res) => {
    res.json(await svc.progresoDe(req.usuario!.uid));
  }));

  // POST /progreso/:cursoId/vista — AUTH. body { n, segundos? }. El servidor decide la acreditación.
  // Devuelve { certificado? } (lo que lee el cliente) + progreso y acreditada (informativos).
  r.post('/:cursoId/vista', requireUser, asyncHandler(async (req, res) => {
    const cuerpo = (req.body ?? {}) as { n?: unknown; segundos?: unknown };
    const resultado = await svc.marcarVista(req.usuario!, req.params.cursoId, Number(cuerpo.n), cuerpo.segundos);
    res.json({ certificado: resultado.certificado, progreso: resultado.progreso, acreditada: resultado.acreditada });
  }));

  return r;
}
