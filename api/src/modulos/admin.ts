// Módulo del núcleo del panel admin: /admin/resumen, /admin/cursos, /admin/miembros, /admin/avisos,
// /admin/foro y /admin/config. TODAS las rutas exigen requireAdmin (admins/{uid} en producción).
// No monta /admin/academia (ya existe) ni materiales, eventos, quizzes, cupones o experiencia (otros módulos).
// Lógica y compatibilidad con el panel actual: services/adminNucleo.ts.
import { Router } from 'express';
import type { FirestorePort } from '../adapters/firestore/port.js';
import { asyncHandler } from '../routes/util.js';
import { CodedError } from '../services/errors.js';
import { ServicioAdminNucleo } from '../services/adminNucleo.js';
import type { CursoEditorial } from '../adapters/firestore/club.js';
import type { ModuloApi } from './tipos.js';

export interface ContextoAdmin {
  db: FirestorePort;
  ahora: () => Date;
  produccion: boolean;
  /** Solo pruebas: catálogo editorial inyectado (por defecto, api/content/club/cursos.json). */
  catalogoEditorial?: () => CursoEditorial[];
}

export function moduloAdmin(ctx: ContextoAdmin): ModuloApi {
  const svc = new ServicioAdminNucleo(ctx.db, ctx.ahora, ctx.catalogoEditorial);

  return ({ app, requireAdmin }) => {
    const r = Router();

    // GET /admin/resumen → ResumenAdmin (src/admin/remoto.ts).
    r.get('/resumen', requireAdmin, asyncHandler(async (_req, res) => { res.json(await svc.resumen()); }));

    // ── Cursos (courses) ──
    r.get('/cursos', requireAdmin, asyncHandler(async (_req, res) => { res.json(await svc.cursos()); }));
    r.post('/cursos', requireAdmin, asyncHandler(async (req, res) => { res.status(201).json(await svc.crearCurso(req.body)); }));
    r.patch('/cursos/:id', requireAdmin, asyncHandler(async (req, res) => { res.json(await svc.editarCurso(req.params.id, req.body)); }));
    r.delete('/cursos/:id', requireAdmin, asyncHandler(async (req, res) => { res.json(await svc.borrarCurso(req.params.id)); }));

    // ── Miembros (members + users) ──
    r.get('/miembros', requireAdmin, asyncHandler(async (req, res) => { res.json(await svc.miembros(req.query.estado)); }));
    r.get('/miembros/:uid', requireAdmin, asyncHandler(async (req, res) => { res.json(await svc.miembro(req.params.uid)); }));
    r.post('/miembros/:uid/cortesia', requireAdmin, asyncHandler(async (req, res) => {
      res.json(await svc.otorgarCortesia(req.usuario!, req.params.uid, req.body));
    }));
    // Revocar escribiría vigenciaHasta fuera de vip.ts: pendiente de decisión del propietario.
    r.delete('/miembros/:uid/cortesia', requireAdmin, asyncHandler(async () => {
      throw new CodedError(409, 'cortesia/revocar-no-disponible', 'Revocar una cortesía aún no está disponible en el club nuevo.');
    }));

    // ── Avisos (notifications) ──
    r.get('/avisos', requireAdmin, asyncHandler(async (_req, res) => { res.json(await svc.avisos()); }));
    r.post('/avisos', requireAdmin, asyncHandler(async (req, res) => { res.status(201).json(await svc.publicarAviso(req.body)); }));
    r.delete('/avisos/:id', requireAdmin, asyncHandler(async (req, res) => { res.json(await svc.borrarAviso(req.params.id)); }));

    // ── Comunidad (forum) ──
    r.get('/foro', requireAdmin, asyncHandler(async (_req, res) => { res.json(await svc.foro()); }));
    r.patch('/foro/:id', requireAdmin, asyncHandler(async (req, res) => { res.json(await svc.moderarHilo(req.usuario!, req.params.id, req.body)); }));

    // ── Ajustes (config/club, config/platform) ──
    r.get('/config', requireAdmin, asyncHandler(async (_req, res) => { res.json(await svc.config()); }));
    r.patch('/config', requireAdmin, asyncHandler(async (req, res) => { res.json(await svc.editarConfig(req.usuario!, req.body)); }));

    app.use('/admin', r);
  };
}
