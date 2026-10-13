import { Router, type RequestHandler } from 'express';
import type { LearningService } from '../services/learning.js';
import { asyncHandler } from './util.js';

export function rutaQuiz(svc: LearningService, requireUser: RequestHandler): Router {
  const r = Router();

  // GET /quiz/:cursoId/:n — AUTH. { preguntas:[{q,opciones}] } SIN respuestas correctas.
  r.get('/:cursoId/:n', requireUser, asyncHandler(async (req, res) => {
    const preguntas = await svc.preguntasPublicas(req.usuario!, req.params.cursoId, Number(req.params.n));
    res.json({ preguntas });
  }));

  // POST /quiz/:cursoId/:n — AUTH. body {respuestas:number[]}. El servidor califica; no revela el índice correcto.
  r.post('/:cursoId/:n', requireUser, asyncHandler(async (req, res) => {
    const cuerpo = (req.body ?? {}) as { respuestas?: unknown };
    const resultado = await svc.calificar(req.usuario!, req.params.cursoId, Number(req.params.n), cuerpo.respuestas);
    res.json(resultado);
  }));

  return r;
}
