import { Router } from 'express';
import type { ContentStore } from '../adapters/interfaces.js';
import { asyncHandler } from './util.js';

export function rutaNoticias(content: ContentStore): Router {
  const r = Router();
  // GET /noticias — público. { noticias: [] } (vacío honesto si no hay).
  r.get('/', asyncHandler(async (_req, res) => {
    res.json({ noticias: await content.noticias() });
  }));
  return r;
}
