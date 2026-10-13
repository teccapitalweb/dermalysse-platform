import { Router, type RequestHandler } from 'express';
import type { ExperienceStore } from '../adapters/interfaces.js';
import { construirExperiencia } from '../services/experiences.js';
import { asyncHandler } from './util.js';

export function rutaExperiencias(store: ExperienceStore, requireUser: RequestHandler): Router {
  const r = Router();

  // GET /experiencias — público. Filtra por ?categoria= y ?q=; orden fecha desc.
  r.get('/', asyncHandler(async (req, res) => {
    const categoria = typeof req.query.categoria === 'string' ? req.query.categoria : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json(await store.listar({ categoria, q }));
  }));

  // POST /experiencias — AUTH. El servidor asigna id/fecha/autor y valida la entrada.
  r.post('/', requireUser, asyncHandler(async (req, res) => {
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const experiencia = construirExperiencia(cuerpo, req.usuario!); // lanza ValidationError ⇒ 400
    const creada = await store.crear(experiencia);
    res.status(201).json(creada);
  }));

  return r;
}
