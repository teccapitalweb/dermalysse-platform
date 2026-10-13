import { Router, type RequestHandler } from 'express';
import type { RespuestaMe } from '../domain/types.js';
import { asyncHandler } from './util.js';

export function rutaMe(requireUser: RequestHandler): Router {
  const r = Router();
  // GET /me — AUTH. Identidad + estado de membresía resueltos por el servidor.
  r.get('/', requireUser, asyncHandler(async (req, res) => {
    const u = req.usuario!; // garantizado por requireUser
    const respuesta: RespuestaMe = {
      uid: u.uid,
      email: u.email,
      esVip: u.esVip,
      esAdmin: u.esAdmin,
      plan: u.esVip ? 'anual' : null,
      vence: u.esVip ? '2027-01-01T00:00:00.000Z' : null,
      perfil: { nombre: u.nombre },
    };
    res.json(respuesta);
  }));
  return r;
}
