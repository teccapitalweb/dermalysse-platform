import { Router, type RequestHandler } from 'express';
import type { HistoriaStore } from '../adapters/interfaces.js';
import { validarHistoria } from '../services/historia.js';
import { asyncHandler } from './util.js';

/**
 * Avance del Modo Historia del propio usuario (uid del token; el cuerpo nunca elige el uid).
 *  - GET   /historia  ⇒ ProgresoHistoria (vacío si aún no hay avance).
 *  - PATCH /historia  { completados?, puntajes?, ultimoNivel?, actualizado? } ⇒ ProgresoHistoria fusionado.
 */
export function rutaHistoria(historia: HistoriaStore, requireUser: RequestHandler): Router {
  const r = Router();

  r.get('/', requireUser, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await historia.get(req.usuario!.uid));
  }));

  r.patch('/', requireUser, asyncHandler(async (req, res) => {
    const entrada = validarHistoria(req.body);
    res.set('Cache-Control', 'no-store');
    res.json(await historia.fusionar(req.usuario!.uid, entrada));
  }));

  return r;
}
