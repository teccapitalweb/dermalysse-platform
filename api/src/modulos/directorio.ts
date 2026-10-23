import type { FirestorePort } from '../adapters/firestore/port.js';
import { asyncHandler } from '../routes/util.js';
import { DirectorioService } from '../services/directorio.js';
import type { ModuloApi } from './tipos.js';

export function moduloDirectorio(ctx: { db: FirestorePort; ahora: () => Date }): ModuloApi {
  const directorio = new DirectorioService(ctx.db, ctx.ahora);

  return ({ app, requireUser, requireAdmin }) => {
    app.get(
      '/directorio',
      requireUser,
      asyncHandler(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        const limite = req.query.limite ? Math.min(48, Math.max(6, Number(req.query.limite))) : 24;
        const perfilesAntes = typeof req.query.perfilesAntes === 'string' ? req.query.perfilesAntes : undefined;
        const oportunidadesAntes = typeof req.query.oportunidadesAntes === 'string' ? req.query.oportunidadesAntes : undefined;
        res.json(await directorio.obtenerDirectorio(req.usuario!, limite, perfilesAntes, oportunidadesAntes));
      }),
    );

    app.put(
      '/directorio/perfil',
      requireUser,
      asyncHandler(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(await directorio.guardarPerfil(req.usuario!, req.body ?? {}));
      }),
    );

    app.delete(
      '/directorio/perfil',
      requireUser,
      asyncHandler(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(await directorio.eliminarPerfil(req.usuario!));
      }),
    );

    app.post(
      '/directorio/oportunidades',
      requireUser,
      asyncHandler(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.status(201).json(await directorio.crearOportunidad(req.usuario!, req.body ?? {}));
      }),
    );

    app.patch(
      '/directorio/oportunidades/:id',
      requireUser,
      asyncHandler(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(await directorio.cerrarOportunidad(req.usuario!, String(req.params.id)));
      }),
    );

    app.post(
      '/directorio/conexiones',
      requireUser,
      asyncHandler(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.status(201).json(await directorio.crearConexion(req.usuario!, req.body ?? {}));
      }),
    );

    app.patch(
      '/directorio/conexiones/:id',
      requireUser,
      asyncHandler(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(await directorio.responderConexion(req.usuario!, String(req.params.id), req.body ?? {}));
      }),
    );

    app.post(
      '/directorio/reportes',
      requireUser,
      asyncHandler(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.status(201).json(await directorio.crearReporte(req.usuario!, req.body ?? {}));
      }),
    );

    app.get(
      '/admin/directorio/reportes',
      requireAdmin,
      asyncHandler(async (_req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(await directorio.listarReportesAdmin());
      }),
    );

    app.patch(
      '/admin/directorio/reportes/:id',
      requireAdmin,
      asyncHandler(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(await directorio.moderarReporteAdmin(req.usuario!, String(req.params.id), req.body ?? {}));
      }),
    );

    app.get(
      '/admin/directorio/perfiles',
      requireAdmin,
      asyncHandler(async (_req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(await directorio.listarPerfilesAdmin());
      }),
    );

    app.patch(
      '/admin/directorio/perfiles/:uid/visibilidad',
      requireAdmin,
      asyncHandler(async (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json(await directorio.actualizarVisibilidadPerfilAdmin(String(req.params.uid), Boolean(req.body?.visible)));
      }),
    );
  };
}
