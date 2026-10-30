import { Router, type RequestHandler } from 'express';
import type { AcademiaService } from '../services/academia.js';
import { asyncHandler } from './util.js';

/** Rutas del miembro. Todas exigen sesión; acceso, desbloqueo y calificación los decide el servidor. */
export function rutaAcademia(svc: AcademiaService, requireUser: RequestHandler): Router {
  const r = Router();

  // GET /academia — catálogo con disponibilidad por módulo (sin datos del examen) + avance de la cuenta.
  // Cada módulo lleva disponibleDesde (ISO o null) y programado (true si todavía no llega su fecha).
  r.get('/', requireUser, asyncHandler(async (req, res) => {
    res.json(await svc.catalogo(req.usuario!));
  }));

  // GET /academia/progreso — avance de la cuenta { [programa]: { modulos: { [n]: avance } } }.
  r.get('/progreso', requireUser, asyncHandler(async (req, res) => {
    res.json(await svc.progreso(req.usuario!));
  }));

  // GET /academia/:programa/:n — módulo sin banco del examen (examen → { aprobar, mostrar, total }).
  r.get('/:programa/:n', requireUser, asyncHandler(async (req, res) => {
    res.json(await svc.modulo(req.usuario!, req.params.programa, req.params.n));
  }));

  // POST /academia/:programa/:n/tema — body { tema }. Marca un tema como leído.
  r.post('/:programa/:n/tema', requireUser, asyncHandler(async (req, res) => {
    const cuerpo = (req.body ?? {}) as { tema?: unknown };
    res.json(await svc.marcarTema(req.usuario!, req.params.programa, req.params.n, cuerpo.tema));
  }));

  // GET no entrega soluciones; POST valida una selección y fusiona el avance confirmado.
  r.get('/:programa/:n/juego', requireUser, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await svc.juego(req.usuario!, req.params.programa, req.params.n));
  }));

  r.post('/:programa/:n/juego', requireUser, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await svc.registrarJuego(req.usuario!, req.params.programa, req.params.n, req.body));
  }));

  // GET /academia/:programa/:n/examen — preguntas al azar del banco, SIN respuestas.
  r.get('/:programa/:n/examen', requireUser, asyncHandler(async (req, res) => {
    res.json(await svc.emitirExamen(req.usuario!, req.params.programa, req.params.n));
  }));

  // POST /academia/:programa/:n/examen — body { respuestas: { id: indice } }. Califica solo lo emitido, una vez.
  r.post('/:programa/:n/examen', requireUser, asyncHandler(async (req, res) => {
    const cuerpo = (req.body ?? {}) as { respuestas?: unknown };
    res.json(await svc.calificarExamen(req.usuario!, req.params.programa, req.params.n, cuerpo.respuestas));
  }));

  return r;
}

/** Revisión editorial. Solo administradores. */
export function rutaAdminAcademia(svc: AcademiaService, requireAdmin: RequestHandler): Router {
  const r = Router();

  // GET /admin/academia — por programa, calendario efectivo (`lanzamiento`); por módulo, estado del
  // archivo, estado efectivo, nota, métricas y `disponibleDesde`.
  r.get('/', requireAdmin, asyncHandler(async (_req, res) => {
    res.json(await svc.revisionAdmin());
  }));

  // PATCH /admin/academia/:programa/lanzamiento — body { inicio: "YYYY-MM-DD" | null, cadaDias?: 1–60 }.
  // Mueve la fecha de inicio del calendario (todo se desplaza); inicio null = volver al catálogo.
  // Va antes de /:programa/:n para que "lanzamiento" no se tome como número de módulo.
  r.patch('/:programa/lanzamiento', requireAdmin, asyncHandler(async (req, res) => {
    res.json(await svc.fijarLanzamiento(req.usuario!, req.params.programa, req.body));
  }));

  // DELETE /admin/academia/:programa/lanzamiento — borra el ajuste: vuelve la fecha del catálogo.
  r.delete('/:programa/lanzamiento', requireAdmin, asyncHandler(async (req, res) => {
    res.json(await svc.borrarLanzamiento(req.params.programa));
  }));

  // PATCH /admin/academia/:programa/:n — body { estado: borrador|revision|aprobado, nota? }.
  r.patch('/:programa/:n', requireAdmin, asyncHandler(async (req, res) => {
    res.json(await svc.revisar(req.usuario!, req.params.programa, req.params.n, req.body));
  }));

  return r;
}
