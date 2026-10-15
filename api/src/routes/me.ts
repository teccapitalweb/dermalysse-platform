import { Router, type RequestHandler } from 'express';
import type { ProfileStore } from '../adapters/interfaces.js';
import type { RespuestaMe } from '../domain/types.js';
import { asyncHandler } from './util.js';

export function rutaMe(requireUser: RequestHandler, profiles: ProfileStore): Router {
  const r = Router();

  // GET /me — AUTH. Identidad + membresía resueltas por el servidor; perfil desde el almacén
  // (en Firestore, el almacén da de alta users/{uid} y members/{uid} si faltan).
  r.get('/', requireUser, asyncHandler(async (req, res) => {
    const u = req.usuario!;
    const perfil = await profiles.get(u);
    // Modo firebase: plan/vence/motivo salen de la regla de acceso (acceso). Modo dev: valores de desarrollo.
    const acceso = u.acceso ?? {
      plan: u.esVip ? 'anual' as const : null,
      vence: u.esVip ? '2027-01-01T00:00:00.000Z' : null,
      motivo: u.esVip ? 'active' : 'none',
    };
    const respuesta: RespuestaMe = {
      uid: u.uid,
      email: u.email,
      nombre: u.nombre,
      esVip: u.esVip,
      esAdmin: u.esAdmin,
      plan: acceso.plan,
      vence: acceso.vence,
      motivoAcceso: acceso.motivo,
      perfil,
    };
    res.set('Cache-Control', 'no-store');
    res.json(respuesta);
  }));

  // PATCH /me/perfil — AUTH. Actualiza SOLO el perfil del propio usuario (uid del token).
  // Ignora cualquier uid/rol/membresía del cuerpo; el almacén valida y sanea los campos permitidos.
  r.patch('/perfil', requireUser, asyncHandler(async (req, res) => {
    res.json(await profiles.patch(req.usuario!, (req.body ?? {}) as Record<string, unknown>));
  }));

  return r;
}
