// Auth del servidor. requireUser valida el header Authorization: Bearer <token> vía el AuthAdapter.
// El usuario y sus privilegios (esVip/esAdmin) provienen del adaptador, NUNCA del cuerpo de la petición.
import type { RequestHandler } from 'express';
import type { AuthAdapter } from '../adapters/interfaces.js';
import type { Usuario } from '../domain/types.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: Usuario;
    }
  }
}

function tokenDe(header: string | undefined): string | null {
  if (!header) return null;
  const [esquema, ...resto] = header.split(' ');
  if (esquema !== 'Bearer') return null;
  const token = resto.join(' ').trim();
  return token || null;
}

export function crearAuth(adaptador: AuthAdapter): { requireUser: RequestHandler; requireAdmin: RequestHandler } {
  const requireUser: RequestHandler = (req, res, next) => {
    const token = tokenDe(req.header('authorization'));
    if (!token) {
      res.status(401).json({ error: 'auth/sin-token', mensaje: 'Falta el encabezado Authorization: Bearer <token>.' });
      return;
    }
    adaptador.verificar(token)
      .then((usuario) => {
        if (!usuario) {
          res.status(401).json({ error: 'auth/token-invalido', mensaje: 'Sesión no válida.' });
          return;
        }
        req.usuario = usuario;
        next();
      })
      .catch(next); // un seam no implementado (NotImplemented) ⇒ 501 honesto, sin datos demo
  };

  const requireAdmin: RequestHandler = (req, res, next) => {
    requireUser(req, res, () => {
      if (!req.usuario?.esAdmin) {
        res.status(403).json({ error: 'auth/sin-permiso', mensaje: 'Esta operación requiere privilegios de administrador.' });
        return;
      }
      next();
    });
  };

  return { requireUser, requireAdmin };
}
