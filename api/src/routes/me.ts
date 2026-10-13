import { Router, type RequestHandler } from 'express';
import type { ProfileStore } from '../adapters/interfaces.js';
import type { RespuestaMe } from '../domain/types.js';
import { sanitizarPerfil } from '../services/community.js';
import { asyncHandler } from './util.js';

export function rutaMe(requireUser: RequestHandler, profiles: ProfileStore): Router {
  const r = Router();

  // GET /me — AUTH. Identidad + membresía resueltas por el servidor; perfil desde el almacén.
  r.get('/', requireUser, asyncHandler(async (req, res) => {
    const u = req.usuario!;
    const perfil = await profiles.get(u.uid, u.nombre);
    const respuesta: RespuestaMe = {
      uid: u.uid,
      email: u.email,
      esVip: u.esVip,
      esAdmin: u.esAdmin,
      plan: u.esVip ? 'anual' : null,
      vence: u.esVip ? '2027-01-01T00:00:00.000Z' : null,
      perfil,
    };
    res.json(respuesta);
  }));

  // PATCH /me/perfil — AUTH. Actualiza SOLO el perfil del propio usuario (uid del token).
  // Ignora cualquier uid/rol del cuerpo; valida/sanitiza campos permitidos.
  r.patch('/perfil', requireUser, asyncHandler(async (req, res) => {
    const u = req.usuario!;
    const cambios = sanitizarPerfil((req.body ?? {}) as Record<string, unknown>);
    res.json(await profiles.patch(u.uid, cambios, u.nombre));
  }));

  return r;
}
