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
import { PuntosService } from '../services/puntos.js';
import type { ModuloApi } from './tipos.js';

export function moduloVip(ctx: { db: FirestorePort; ahora: () => Date; produccion: boolean }): ModuloApi {
  const recompensas = new RecompensasService(ctx.db, ctx.ahora);
  const puntos = new PuntosService(ctx.db, ctx.ahora);
  const cupones = new CuponesService(ctx.db, ctx.ahora);

  return ({ app, requireUser, requireAdmin }) => {
    app.get('/recompensas', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      const [lista, panel] = await Promise.all([recompensas.listar(req.usuario!.uid), puntos.panel(req.usuario!.uid)]);
      res.json({ recompensas: lista, ...panel });
    }));

    app.post('/recompensas/:id/canjear', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await recompensas.canjear(req.usuario!.uid, String(req.params.id)));
    }));

    app.post('/beneficios/atelier/canjear', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await puntos.canjearAtelier(req.usuario!.uid, (req.body as { materialIds?: unknown } | undefined)?.materialIds));
    }));

    app.post('/beneficios/:id/canjear', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await puntos.canjear(req.usuario!.uid, String(req.params.id)));
    }));

    app.post('/puntos/misiones/:id/activar', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await puntos.activarMision(req.usuario!.uid, String(req.params.id)));
    }));

    app.put('/puntos/objetivo', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await puntos.seleccionarObjetivo(req.usuario!.uid, (req.body as { beneficioId?: unknown } | undefined)?.beneficioId));
    }));

    app.put('/puntos/favoritos/:id', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await puntos.marcarFavorito(req.usuario!.uid, String(req.params.id), (req.body as { activo?: unknown } | undefined)?.activo));
    }));

    app.post('/beneficios/atelier/cotizar', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await puntos.cotizarAtelier(req.usuario!.uid, (req.body as { materialIds?: unknown } | undefined)?.materialIds));
    }));

    app.post('/puntos/niveles/:id/canjear', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await puntos.canjearPremioNivel(req.usuario!.uid, String(req.params.id), (req.body as { beneficioId?: unknown } | undefined)?.beneficioId));
    }));

    app.post('/cupones/canjear', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await cupones.canjear(req.usuario!.uid, (req.body as { codigo?: unknown } | undefined)?.codigo));
    }));

    app.get('/admin/cupones', requireAdmin, asyncHandler(async (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await cupones.listar());
    }));

    app.get('/admin/recompensas/resumen', requireAdmin, asyncHandler(async (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await puntos.adminResumen());
    }));

    app.get('/admin/recompensas/cuentas', requireAdmin, asyncHandler(async (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await puntos.adminCuentas());
    }));

    app.get('/admin/recompensas/cuentas/:uid', requireAdmin, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await puntos.adminCuenta(String(req.params.uid)));
    }));

    app.post('/admin/recompensas/ajustes', requireAdmin, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await puntos.adminAjustar(req.usuario!, req.body));
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
