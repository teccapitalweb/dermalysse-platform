// Módulo VIP: recompensas y cupones. Ambos otorgan días VIP SOLO vía services/vip.ts.
//  - GET   /recompensas                 (sesión) ⇒ { recompensas: Recompensa[] } con progreso calculado en el servidor.
//  - POST  /recompensas/:id/canjear     (sesión) ⇒ { ok, hasta, regaloDesde, dias, recompensa }; 403 incompleta, 404, 409 ya canjeada.
//  - POST  /cupones/canjear             (sesión) { codigo } ⇒ { ok, codigo, dias, hasta, regaloDesde }; 404/409/410.
//  - GET   /admin/cupones               (admin)  ⇒ CuponAdmin[].
//  - POST  /admin/cupones               (admin)  { duracion, dias?, modalidad, cantidad, idempotencia?, venceEn? } ⇒ LoteCupones.
//  - PATCH /admin/cupones/:codigo       (admin)  { activo } ⇒ CuponAdmin.
import type { FirestorePort } from '../adapters/firestore/port.js';
import { asyncHandler } from '../routes/util.js';
import { CuponesService } from '../services/cupones.js';
import { RecompensasService } from '../services/recompensas.js';
import type { ModuloApi } from './tipos.js';

export function moduloVip(ctx: { db: FirestorePort; ahora: () => Date; produccion: boolean }): ModuloApi {
  const recompensas = new RecompensasService(ctx.db, ctx.ahora);
  const cupones = new CuponesService(ctx.db, ctx.ahora);

  return ({ app, requireUser, requireAdmin }) => {
    app.get('/recompensas', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json({ recompensas: await recompensas.listar(req.usuario!.uid) });
    }));

    app.post('/recompensas/:id/canjear', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await recompensas.canjear(req.usuario!.uid, String(req.params.id)));
    }));

    app.post('/cupones/canjear', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await cupones.canjear(req.usuario!.uid, (req.body as { codigo?: unknown } | undefined)?.codigo));
    }));

    app.get('/admin/cupones', requireAdmin, asyncHandler(async (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await cupones.listar());
    }));

    app.post('/admin/cupones', requireAdmin, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.status(201).json(await cupones.crearLote(req.body, req.usuario!.uid));
    }));

    app.patch('/admin/cupones/:codigo', requireAdmin, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await cupones.cambiarActivo(String(req.params.codigo), req.body));
    }));
  };
}
