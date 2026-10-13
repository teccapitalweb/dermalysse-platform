import { Router, type RequestHandler } from 'express';
import type { ForumStore } from '../adapters/interfaces.js';
import { construirHilo, construirRespuesta } from '../services/community.js';
import { ForbiddenError, NotFoundError } from '../services/errors.js';
import { asyncHandler } from './util.js';

/** Interactuar en comunidad es para miembros VIP (regla del cliente: Acceso.puedeComunidad). */
function exigirVip(esVip: boolean): void {
  if (!esVip) throw new ForbiddenError('Participar en la comunidad es para miembros VIP.');
}

export function rutaForo(forum: ForumStore, requireUser: RequestHandler): Router {
  const r = Router();

  // GET /foro — público. Listado de hilos (respuestas = conteo).
  r.get('/', asyncHandler(async (_req, res) => {
    res.json(await forum.listar());
  }));

  // GET /foro/:id — público. { hilo, respuestas[] }; 404 honesto si no existe.
  r.get('/:id', asyncHandler(async (req, res) => {
    const detalle = await forum.detalle(req.params.id);
    if (!detalle) { res.status(404).json({ error: 'foro/no-encontrado', mensaje: 'El tema no existe o no está disponible.' }); return; }
    res.json(detalle);
  }));

  // POST /foro — AUTH (VIP). Crea hilo; el servidor asigna id/fecha/autor.
  r.post('/', requireUser, asyncHandler(async (req, res) => {
    exigirVip(req.usuario!.esVip);
    const hilo = construirHilo((req.body ?? {}) as Record<string, unknown>, req.usuario!);
    res.status(201).json(await forum.crearHilo(hilo));
  }));

  // POST /foro/:id/respuestas — AUTH (VIP). { texto }; 404 si el hilo no existe.
  r.post('/:id/respuestas', requireUser, asyncHandler(async (req, res) => {
    exigirVip(req.usuario!.esVip);
    const respuesta = construirRespuesta((req.body ?? {}).texto, req.usuario!);
    const creada = await forum.agregarRespuesta(req.params.id, respuesta);
    if (!creada) throw new NotFoundError('El tema no existe o no está disponible.');
    res.status(201).json(creada);
  }));

  // POST /foro/:id/util — AUTH (VIP). Alterna "útil" para el uid del token; responde { util }.
  r.post('/:id/util', requireUser, asyncHandler(async (req, res) => {
    exigirVip(req.usuario!.esVip);
    const resultado = await forum.alternarUtil(req.params.id, req.usuario!.uid);
    if (!resultado) throw new NotFoundError('El tema no existe o no está disponible.');
    res.json(resultado);
  }));

  return r;
}
