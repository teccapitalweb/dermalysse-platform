// Módulo «curso gratis»: el miembro GRATUITO elige UN curso como su curso gratis. Ese curso queda
// abierto completo salvo su última clase (la última pide VIP); los demás cursos quedan cerrados.
// La elección es PERMANENTE (no se puede cambiar sin ser VIP), para que nadie recorra todo el catálogo
// gratis cambiando de curso. El candado real de reproducción lo aplica el webhook (authorizeLesson),
// que también lee users/{uid}.cursoGratis; aquí se guarda la elección y se valida.
//
// Rutas (contrato de src/core/curso-gratis.ts del cliente):
//   POST /me/curso-gratis { cursoId } → { cursoGratis } ; 409 si ya eligió, 403 si es VIP, 404 curso inválido
// (La elección también viaja en GET /me como `cursoGratis`.)
//
// Firestore: users/{uid}.cursoGratis (id del curso) y users/{uid}.cursoGratisDesde (ISO), con merge,
// SIN tocar ningún otro campo. Son campos protegidos: el cliente nunca los escribe por PATCH /me/perfil.
import type { Request } from 'express';
import { asyncHandler } from '../routes/util.js';
import { CodedError } from '../services/errors.js';
import { segmento } from '../adapters/firestore/v2.js';
import { texto, type FirestorePort } from '../adapters/firestore/port.js';
import type { ModuloApi } from './tipos.js';

/** ¿La clase n es la última del curso? (la última nunca es gratis). */
export function esUltimaClase(n: number, totalClases: number): boolean {
  return totalClases > 0 && n >= totalClases;
}

/**
 * ¿El miembro puede ver esta clase gratis por su curso elegido?
 * Solo si NO es VIP, el curso es el elegido y la clase no es la última.
 * (El webhook aplica además su propia regla de muestra/isPreview; esto es el permiso adicional.)
 */
export function claseGratisPorEleccion(opts: { esVip: boolean; cursoGratis: string | undefined; cursoId: string; n: number; totalClases: number }): boolean {
  if (opts.esVip) return true;
  if (!opts.cursoGratis || opts.cursoGratis !== opts.cursoId) return false;
  return !esUltimaClase(opts.n, opts.totalClases);
}

async function cursoPublicado(db: FirestorePort, cursoId: string): Promise<boolean> {
  if (!cursoId || cursoId.includes('/') || cursoId.length > 160) return false;
  const doc = await db.get(`courses/${cursoId}`);
  const datos = doc.data();
  return !!doc.exists && !!datos && datos.status === 'published';
}

export function moduloCursoGratis(ctx: { db: FirestorePort; ahora: () => Date; produccion: boolean }): ModuloApi {
  // Solo tiene efecto en producción (firebase/firestore). En dev (memoria) el cliente usa el modo demo.
  return ({ app, requireUser }) => {
    app.post('/me/curso-gratis', requireUser, asyncHandler(async (req: Request, res) => {
      const u = req.usuario!;
      if (u.esVip) throw new CodedError(403, 'curso-gratis/ya-vip', 'Con tu membresía VIP tienes todos los cursos; no necesitas elegir uno gratis.');
      const cursoId = typeof req.body?.cursoId === 'string' ? req.body.cursoId.trim() : '';
      if (!cursoId) throw new CodedError(400, 'curso-gratis/falta-curso', 'Indica el curso que quieres como tu curso gratis.');
      if (!(await cursoPublicado(ctx.db, cursoId))) throw new CodedError(404, 'curso-gratis/curso-invalido', 'Ese curso no está disponible.');

      const ruta = `users/${segmento(u.uid)}`;
      const guardado = await ctx.db.runTransaction(async (tx) => {
        const actual = texto((await tx.get(ruta)).data()?.cursoGratis);
        if (actual) return actual; // ya eligió: permanente, no se cambia
        tx.set(ruta, { cursoGratis: cursoId, cursoGratisDesde: ctx.ahora().toISOString() }, { merge: true });
        return cursoId;
      });

      if (guardado !== cursoId) {
        throw new CodedError(409, 'curso-gratis/ya-elegido', 'Ya elegiste tu curso gratis y no se puede cambiar. Hazte VIP para abrir todos los cursos.', { cursoGratis: guardado });
      }
      res.set('Cache-Control', 'no-store');
      res.status(201).json({ cursoGratis: guardado });
    }));
  };
}
