// Módulo de contenido: enlaces protegidos de la biblioteca y de En vivo, y admin de materiales,
// clases en vivo y quizzes. /catalogo (público) usa el mismo servicio sin enlaces (ver app.ts).
//
//  GET    /materiales/:id/acceso      sesión       { id, tipo: 'enlace'|'visor', url }   VIP, admin o gratis
//  GET    /eventos/:id/acceso         sesión       { id, transmision, grabacion }       VIP o admin
//  GET    /admin/materiales           admin        MaterialAdmin[]  (pdfs + editoriales de solo lectura)
//  POST   /admin/materiales           admin        201 MaterialAdmin   → pdfs/{id} (create)
//  PATCH  /admin/materiales/:id       admin        MaterialAdmin       → pdfs/{id} (merge)
//  DELETE /admin/materiales/:id       admin        { ok: true }
//  POST   /admin/materiales/:id/subida admin       501 (sin almacenamiento de archivos en este servicio)
//  GET    /admin/eventos              admin        EventoAdmin[]   (webinars)
//  POST   /admin/eventos              admin        201 EventoAdmin     → webinars/{id} (create)
//  PATCH  /admin/eventos/:id          admin        EventoAdmin         → webinars/{id} (merge)
//  DELETE /admin/eventos/:id          admin        { ok: true }
//  GET    /admin/quizzes              admin        QuizAdmin[]  (banco empaquetado + v2_quiz)
//  PATCH  /admin/quizzes/:id          admin        QuizAdmin    (id = <cursoId>_<n>) → v2_quiz/{cursoId}__{n}
import type { Request } from 'express';
import { NotImplementedError } from '../adapters/interfaces.js';
import { cargarCatalogoEditorial } from '../adapters/firestore/club.js';
import { cargarMaterialesEditoriales, cargarQuizzesEmpaquetados, FirestoreContenidoStore } from '../adapters/firestore/contenido.js';
import type { FirestorePort } from '../adapters/firestore/port.js';
import { asyncHandler } from '../routes/util.js';
import { ContenidoService } from '../services/contenido.js';
import type { ModuloApi } from './tipos.js';

/** Servicio de contenido sobre un Firestore (lo comparten el módulo y /catalogo de producción). */
export function crearServicioContenido(db: FirestorePort, ahora: () => Date = () => new Date()): ContenidoService {
  return new ContenidoService(new FirestoreContenidoStore(db), {
    editoriales: cargarMaterialesEditoriales(),
    cursos: cargarCatalogoEditorial(),
    quizzes: cargarQuizzesEmpaquetados(),
    ahora,
  });
}

const cuerpo = (req: Request): Record<string, unknown> =>
  (typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body) ? req.body : {}) as Record<string, unknown>;

export function moduloContenido(ctx: { db: FirestorePort; ahora: () => Date; produccion: boolean }): ModuloApi {
  const svc = crearServicioContenido(ctx.db, ctx.ahora);

  return ({ app, requireUser, requireAdmin }) => {
    // ── Miembros ──
    app.get('/materiales/:id/acceso', requireUser, asyncHandler(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await svc.accesoMaterial(req.usuario!, req.params.id));
    }));
    app.get('/eventos/:id/acceso', requireUser, asyncHandler(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await svc.accesoEvento(req.usuario!, req.params.id));
    }));

    // ── Admin · materiales ──
    app.get('/admin/materiales', requireAdmin, asyncHandler(async (_req, res) => { res.json(await svc.adminMateriales()); }));
    app.post('/admin/materiales', requireAdmin, asyncHandler(async (req, res) => {
      res.status(201).json(await svc.crearMaterial(req.usuario!, cuerpo(req)));
    }));
    app.post('/admin/materiales/:id/subida', requireAdmin, () => {
      throw new NotImplementedError('subida de archivos (no hay almacenamiento configurado); indica el enlace del archivo en el material.');
    });
    app.patch('/admin/materiales/:id', requireAdmin, asyncHandler(async (req, res) => {
      res.json(await svc.actualizarMaterial(req.usuario!, req.params.id, cuerpo(req)));
    }));
    app.delete('/admin/materiales/:id', requireAdmin, asyncHandler(async (req, res) => {
      await svc.borrarMaterial(req.params.id);
      res.json({ ok: true });
    }));

    // ── Admin · clases en vivo ──
    app.get('/admin/eventos', requireAdmin, asyncHandler(async (_req, res) => { res.json(await svc.adminEventos()); }));
    app.post('/admin/eventos', requireAdmin, asyncHandler(async (req, res) => {
      res.status(201).json(await svc.crearEvento(req.usuario!, cuerpo(req)));
    }));
    app.patch('/admin/eventos/:id', requireAdmin, asyncHandler(async (req, res) => {
      res.json(await svc.actualizarEvento(req.usuario!, req.params.id, cuerpo(req)));
    }));
    app.delete('/admin/eventos/:id', requireAdmin, asyncHandler(async (req, res) => {
      await svc.borrarEvento(req.params.id);
      res.json({ ok: true });
    }));

    // ── Admin · quizzes ──
    app.get('/admin/quizzes', requireAdmin, asyncHandler(async (_req, res) => { res.json(await svc.adminQuizzes()); }));
    app.patch('/admin/quizzes/:id', requireAdmin, asyncHandler(async (req, res) => {
      res.json(await svc.guardarQuiz(req.usuario!, req.params.id, cuerpo(req)));
    }));
  };
}
