import { Router } from 'express';
import type { ContentStore } from '../adapters/interfaces.js';
import { asyncHandler } from './util.js';

export function rutaCatalogo(content: ContentStore): Router {
  const r = Router();
  // GET /catalogo — público. CatalogoRemoto (cursos+clases, sin URLs premium).
  r.get('/', asyncHandler(async (_req, res) => {
    res.json(await content.catalogo());
  }));
  return r;
}
