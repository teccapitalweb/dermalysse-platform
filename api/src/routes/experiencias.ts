import { Router, type RequestHandler } from 'express';
import type { ExperienceStore } from '../adapters/interfaces.js';
import { construirExperiencia } from '../services/experiences.js';
import { CodedError, NotFoundError, ValidationError } from '../services/errors.js';
import { asyncHandler } from './util.js';

export function rutaExperiencias(store: ExperienceStore, requireUser: RequestHandler): Router {
  const r = Router();

  // GET /experiencias/mias — el miembro ve el estado de sus propios envíos.
  r.get('/mias', requireUser, asyncHandler(async (req, res) => {
    res.json(await store.propias(req.usuario!.uid));
  }));

  // GET /experiencias — miembros autenticados. Filtra por ?categoria= y ?q=; orden fecha desc.
  r.get('/', requireUser, asyncHandler(async (req, res) => {
    const categoria = typeof req.query.categoria === 'string' ? req.query.categoria : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json(await store.listar({ categoria, q }));
  }));

  // POST /experiencias — VIP o admin. Todo aporte inicia privado y requiere revisión.
  r.post('/', requireUser, asyncHandler(async (req, res) => {
    if (!req.usuario!.esVip && !req.usuario!.esAdmin) throw new CodedError(402, 'requiere_vip', 'Compartir experiencias requiere una membresía VIP.');
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const experiencia = construirExperiencia(cuerpo, req.usuario!); // lanza ValidationError ⇒ 400
    const creada = await store.crear(experiencia);
    const { autorUid: _uid, revisorUid: _revisor, ...propia } = creada;
    res.status(201).json(propia);
  }));

  return r;
}

export function rutaAdminExperiencias(store: ExperienceStore, requireAdmin: RequestHandler): Router {
  const r = Router();
  r.get('/', requireAdmin, asyncHandler(async (_req, res) => {
    const pendientes = await store.pendientes();
    res.json(pendientes.map(({ autorUid: _uid, revisorUid: _revisor, ...exp }) => exp));
  }));
  r.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
    const estado = (req.body as { estado?: unknown } | undefined)?.estado;
    if (estado !== 'aprobada' && estado !== 'rechazada') throw new ValidationError('El estado debe ser aprobada o rechazada.');
    const id = req.params.id;
    if (!/^[A-Za-z0-9_.-]{1,200}$/.test(id) || id === '.' || id === '..') throw new ValidationError('El identificador de experiencia no es válido.');
    const revisada = await store.revisar(id, estado, req.usuario!.uid);
    if (!revisada) throw new NotFoundError('No se encontró esa experiencia.');
    const { autorUid: _uid, revisorUid: _revisor, ...propia } = revisada;
    res.json(propia);
  }));
  return r;
}
