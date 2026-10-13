import { Router, type RequestHandler } from 'express';
import type { LeagueStore } from '../adapters/interfaces.js';
import type { FilaLiga } from '../domain/types.js';
import { asyncHandler } from './util.js';

export function rutaLiga(league: LeagueStore, requireUser: RequestHandler): Router {
  const r = Router();

  // GET /liga — AUTH. Clasificación (fixture) + fila "yo" derivada del usuario del token.
  r.get('/', requireUser, asyncHandler(async (req, res) => {
    const u = req.usuario!;
    const filas = await league.filas();
    const yo: FilaLiga = {
      puesto: filas.length + 1,
      nombre: u.nombre.trim() || 'Miembro del club',
      foto: '',
      clases: 0,
      cursos: 0,
      aportes: 0,
      xp: 0,
      nivel: 'Aprendiz',
      ultimaActividad: null,
      esYo: true,
    };
    res.json(await league.resumen([...filas, yo]));
  }));

  return r;
}
