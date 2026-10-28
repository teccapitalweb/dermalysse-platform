// Campañas de bienvenida: cupo y entrega se resuelven en el servidor, nunca en el navegador.
// La campaña inicial entrega únicamente beneficios internos que la plataforma puede cumplir.
import type { FirestorePort } from '../adapters/firestore/port.js';
import { asyncHandler } from '../routes/util.js';
import { CampanasService } from '../services/campanas.js';
import type { ModuloApi } from './tipos.js';

export function moduloCampanas(ctx: { db: FirestorePort; ahora: () => Date; produccion: boolean; codigoCampanaBienvenida: string }): ModuloApi {
  const campanas = new CampanasService(ctx.db, ctx.ahora, ctx.codigoCampanaBienvenida);
  return ({ app, requireUser, requireAdmin }) => {
    app.get('/campanas/bienvenida', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await campanas.bienvenida(req.usuario!.uid));
    }));

    app.post('/campanas/:id/posponer', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await campanas.posponer(req.usuario!.uid, String(req.params.id)));
    }));

    app.post('/campanas/canjear', requireUser, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await campanas.canjear(req.usuario!.uid, (req.body as { codigo?: unknown } | undefined)?.codigo));
    }));

    app.get('/admin/campanas', requireAdmin, asyncHandler(async (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await campanas.adminListar());
    }));

    app.post('/admin/campanas', requireAdmin, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.status(201).json(await campanas.adminCrear(req.usuario!, req.body));
    }));

    app.patch('/admin/campanas/:id', requireAdmin, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await campanas.adminActualizar(String(req.params.id), req.body));
    }));

    app.post('/admin/campanas/:id/solicitudes/:uid/completar', requireAdmin, asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await campanas.adminCompletarEntrega(req.usuario!, String(req.params.id), String(req.params.uid)));
    }));
  };
}
