// Rutas /admin/experiencia/*: solo cuentas administradoras. El servidor valida
// la política antes de habilitar beneficios: el cliente no puede forzar nada.
import { Router, type RequestHandler } from 'express';
import type { ExperienciaModuloStore } from '../adapters/interfaces.js';
import type { ConfigExperiencia } from '../domain/types.js';
import { ValidationError } from '../services/errors.js';
import { asyncHandler } from './util.js';

const fechaValida = (v: unknown): v is string | null =>
  v === null || (typeof v === 'string' && Number.isFinite(Date.parse(v)));

function politicaDeCuerpo(cuerpo: Record<string, unknown>): Omit<ConfigExperiencia, 'version' | 'reservadas' | 'premios'> {
  if (!Number.isInteger(cuerpo.revision) || Number(cuerpo.revision) < 0) {
    throw new ValidationError('Revisión inválida.');
  }
  if (typeof cuerpo.aprobado !== 'boolean' || typeof cuerpo.habilitada !== 'boolean') {
    throw new ValidationError('Campos de política inválidos.');
  }
  if (cuerpo.campanaId !== null && (typeof cuerpo.campanaId !== 'string')) {
    throw new ValidationError('Identificador de campaña inválido.');
  }
  if (!fechaValida(cuerpo.fechaInicio) || !fechaValida(cuerpo.fechaFin)) {
    throw new ValidationError('Fechas de política inválidas.');
  }
  const cupo = Number(cuerpo.cupo);
  if (!Number.isSafeInteger(cupo) || cupo < 0 || cupo > 100000) {
    throw new ValidationError('Cupo fuera de rango.');
  }
  return {
    revision: Number(cuerpo.revision),
    campanaId: cuerpo.campanaId as string | null,
    aprobado: cuerpo.aprobado,
    habilitada: cuerpo.habilitada,
    fechaInicio: cuerpo.fechaInicio as string | null,
    fechaFin: cuerpo.fechaFin as string | null,
    cupo,
  };
}

export function rutaExperienciaAdmin(store: ExperienciaModuloStore, requireAdmin: RequestHandler): Router {
  const r = Router();

  r.get('/resumen', requireAdmin, asyncHandler(async (_req, res) => {
    res.json(await store.resumen());
  }));

  r.get('/config', requireAdmin, asyncHandler(async (_req, res) => {
    res.json(await store.config());
  }));

  r.patch('/config', requireAdmin, asyncHandler(async (req, res) => {
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const politica = politicaDeCuerpo(cuerpo);
    res.json(await store.guardarConfig(politica));
  }));

  return r;
}
