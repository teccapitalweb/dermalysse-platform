import { Router } from 'express';
import type { ContentStore } from '../adapters/interfaces.js';
import { asyncHandler } from './util.js';

export function rutaConfig(content: ContentStore): Router {
  const r = Router();
  // GET /config — público. { precios:{mensual,anual}, descuentoVIP, contacto:{whatsappSoporte?,canalWhatsApp?} }
  r.get('/', asyncHandler(async (_req, res) => {
    res.json(await content.config());
  }));
  return r;
}
