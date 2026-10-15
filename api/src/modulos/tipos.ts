// Contrato de un módulo de la API: recibe la app y los middlewares de sesión y monta sus rutas.
// Cada módulo vive en su archivo (src/modulos/<nombre>.ts) y se registra en crearModulos() de app.ts.
import type { Express, RequestHandler } from 'express';

export interface ContextoModulo {
  app: Express;
  /** Exige sesión válida; deja el usuario en req.usuario ({ uid, email, nombre, esVip, esAdmin }). */
  requireUser: RequestHandler;
  /** Exige sesión de administrador (admins/{uid} en producción). */
  requireAdmin: RequestHandler;
}

export type ModuloApi = (ctx: ContextoModulo) => void;
