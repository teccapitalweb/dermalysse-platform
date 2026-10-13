import { Router } from 'express';
import type { LearningService } from '../services/learning.js';
import { asyncHandler } from './util.js';

export function rutaVerificar(svc: LearningService): Router {
  const r = Router();

  // GET /verificar/:folio — PÚBLICO. { valido, folio, nombre, cursoTitulo, emitido }. Sin uid ni email.
  r.get('/:folio', asyncHandler(async (req, res) => {
    res.json(await svc.verificar(req.params.folio));
  }));

  return r;
}
