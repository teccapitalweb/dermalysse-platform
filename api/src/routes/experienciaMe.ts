// Rutas /me/experiencia, /me/entrevista y /me/encuesta: estado y mutaciones
// del módulo Experiencia para el propio usuario. Toda regla de desbloqueo o
// premio se evalúa en el almacén (fuente de verdad del servidor).
import { Router, type RequestHandler } from 'express';
import type { ContentStore, ExperienciaModuloStore } from '../adapters/interfaces.js';
import { proyectarExperienciaDTO } from '../services/experienciaModulo.js';
import { ValidationError } from '../services/errors.js';
import { asyncHandler } from './util.js';

function flujoDe(valor: string): 'entrevista' | 'encuesta' {
  if (valor !== 'entrevista' && valor !== 'encuesta') throw new ValidationError('Flujo desconocido.');
  return valor;
}

function revisionDe(cuerpo: Record<string, unknown>): number {
  const r = cuerpo.revision;
  if (!Number.isInteger(r) || Number(r) < 0) throw new ValidationError('Revisión inválida.');
  return Number(r);
}

export function rutaExperienciaMe(store: ExperienciaModuloStore, content: ContentStore, requireUser: RequestHandler): Router {
  const r = Router();

  // GET /me/experiencia — AUTH. Lectura (crea estado vacío si no existe).
  r.get('/experiencia', requireUser, asyncHandler(async (req, res) => {
    const u = await store.obtener(req.usuario!.uid);
    res.json(await proyectarExperienciaDTO(u, content));
  }));

  // POST /me/experiencia/iniciar — AUTH. Consentimiento + primer acceso.
  r.post('/experiencia/iniciar', requireUser, asyncHandler(async (req, res) => {
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    if (cuerpo.privacidadAceptada !== true) {
      throw new ValidationError('Debes aceptar la privacidad para comenzar.');
    }
    const u = await store.iniciar(req.usuario!.uid);
    res.json(await proyectarExperienciaDTO(u, content));
  }));

  // POST /me/experiencia/sesion — AUTH. Idempotente por uid+día.
  r.post('/experiencia/sesion', requireUser, asyncHandler(async (req, res) => {
    const u = await store.registrarSesion(req.usuario!.uid);
    res.json(await proyectarExperienciaDTO(u, content));
  }));

  // PATCH /me/:flujo — AUTH. Autosave de respuestas.
  r.patch('/:flujo(entrevista|encuesta)', requireUser, asyncHandler(async (req, res) => {
    const flujo = flujoDe(req.params.flujo);
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const revision = revisionDe(cuerpo);
    const paso = Number(cuerpo.paso);
    if (!Number.isInteger(paso) || paso < 0 || paso > 7) throw new ValidationError('Paso fuera de rango.');
    const respuestas = (cuerpo.respuestas && typeof cuerpo.respuestas === 'object' && !Array.isArray(cuerpo.respuestas))
      ? cuerpo.respuestas as Record<string, unknown>
      : {};
    const u = await store.guardarPaso(req.usuario!.uid, flujo, revision, paso, respuestas);
    res.json(await proyectarExperienciaDTO(u, content));
  }));

  // POST /me/:flujo/posponer — AUTH.
  r.post('/:flujo(entrevista|encuesta)/posponer', requireUser, asyncHandler(async (req, res) => {
    const flujo = flujoDe(req.params.flujo);
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const revision = revisionDe(cuerpo);
    const u = await store.posponer(req.usuario!.uid, flujo, revision);
    res.json(await proyectarExperienciaDTO(u, content));
  }));

  // POST /me/:flujo/completar — AUTH. Reserva beneficio bajo la política.
  r.post('/:flujo(entrevista|encuesta)/completar', requireUser, asyncHandler(async (req, res) => {
    const flujo = flujoDe(req.params.flujo);
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const revision = revisionDe(cuerpo);
    if (cuerpo.privacidadAceptada !== true) {
      throw new ValidationError('Debes aceptar la privacidad para completar.');
    }
    const respuestas = (cuerpo.respuestas && typeof cuerpo.respuestas === 'object' && !Array.isArray(cuerpo.respuestas))
      ? cuerpo.respuestas as Record<string, unknown>
      : undefined;
    const u = await store.completar(req.usuario!.uid, flujo, revision, respuestas);
    res.json(await proyectarExperienciaDTO(u, content));
  }));

  return r;
}
