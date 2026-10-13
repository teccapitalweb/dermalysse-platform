import { Router } from 'express';
import type { ContentStore } from '../adapters/interfaces.js';
import { asyncHandler } from './util.js';

export function rutaForo(content: ContentStore): Router {
  const r = Router();
  // GET /foro — público. Listado de hilos (respuestas = conteo).
  r.get('/', asyncHandler(async (_req, res) => {
    res.json(await content.foro());
  }));
  // GET /foro/:id — público. { hilo, respuestas[] }; 404 honesto si no existe.
  r.get('/:id', asyncHandler(async (req, res) => {
    const detalle = await content.hilo(req.params.id);
    if (!detalle) {
      res.status(404).json({ error: 'foro/no-encontrado', mensaje: 'El tema no existe o no está disponible.' });
      return;
    }
    res.json(detalle);
  }));
  return r;
}
