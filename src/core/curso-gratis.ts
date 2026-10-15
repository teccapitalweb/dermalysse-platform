// Metodología «escoge tu curso gratis»: un miembro GRATUITO elige UN curso. Ese curso queda abierto
// completo salvo su última clase (la última pide VIP); los demás cursos quedan cerrados. La elección es
// PERMANENTE (solo se abre todo haciéndose VIP). El servidor es la fuente de verdad (users.cursoGratis,
// vía POST /me/curso-gratis y GET /me); en demo se simula en localStorage.
import { Auth } from './auth';
import { Datos } from './datos';
import type { Curso } from './datos';
import { api } from './auth';

const CLAVE_DEMO = 'dermalysse:curso-gratis';
const CLAVE_ANUNCIO = 'dermalysse:curso-gratis-anuncio-cerrado';

const VIP_SIM = 'dermalysse:vip-sim';
const esDemo = () => Datos.modo === 'demo';
const vipSimDemo = () => { try { return localStorage.getItem(VIP_SIM) === '1'; } catch { return false; } };

/**
 * ¿El usuario tiene acceso total (VIP o admin)? Entonces nada se bloquea.
 * En demo el usuario es admin por conveniencia; para poder mostrar la metodología, ahí el acceso total
 * depende solo del VIP simulado.
 */
export function accesoTotal(): boolean {
  const u = Auth.usuario;
  if (!u) return false;
  if (esDemo()) return vipSimDemo();
  return u.esVip || u.esAdmin;
}

/** Id del curso elegido como gratis, o null (con acceso total siempre null: no eligen). */
export function cursoGratisElegido(): string | null {
  if (accesoTotal()) return null;
  return Auth.usuario?.cursoGratis || null;
}

/** ¿Aplica la metodología a este usuario? (sesión de miembro gratuito, sin acceso total). */
export function aplicaMetodologia(): boolean {
  return !!Auth.usuario && !accesoTotal();
}

/** ¿Es ESTE el curso gratis del miembro? */
export function esMiCursoGratis(cursoId: string): boolean {
  return cursoGratisElegido() === cursoId;
}

/** ¿El curso está abierto para el usuario? VIP/admin: todos. Gratuito: solo su curso elegido. */
export function cursoAbierto(cursoId: string): boolean {
  if (accesoTotal()) return true;
  return esMiCursoGratis(cursoId);
}

/** ¿El miembro gratuito aún no elige y por eso debe escoger? (para mostrar el anuncio y los CTA). */
export function debeElegir(): boolean {
  return aplicaMetodologia() && !cursoGratisElegido();
}

/** ¿La clase n del curso está abierta para el usuario? (la última del curso elegido NO; pide VIP). */
export function claseAbierta(curso: Curso, n: number): boolean {
  if (accesoTotal()) return true;
  if (!esMiCursoGratis(curso.id)) return false;
  const total = curso.clases.length;
  return total > 0 && n < total; // todas menos la última
}

/** ¿Debe mostrarse el anuncio de primera vez? (gratuito sin elegir y sin haberlo cerrado). */
export function mostrarAnuncio(): boolean {
  if (!debeElegir()) return false;
  try { return localStorage.getItem(CLAVE_ANUNCIO) !== '1'; } catch { return true; }
}

/** El usuario pospone el anuncio (puede elegir después). */
export function posponerAnuncio(): void {
  try { localStorage.setItem(CLAVE_ANUNCIO, '1'); } catch { /* sin almacenamiento */ }
}

export interface ResultadoEleccion { ok: boolean; cursoGratis?: string; mensaje?: string }

/**
 * Elige el curso gratis. En API: POST /me/curso-gratis y refresca la sesión. En demo: localStorage.
 * Si ya había elegido antes (409), devuelve el que ya tenía. La elección es permanente.
 */
export async function elegirCurso(cursoId: string): Promise<ResultadoEleccion> {
  if (!aplicaMetodologia()) return { ok: false, mensaje: 'Tu cuenta ya tiene acceso a todos los cursos.' };
  const yaElegido = cursoGratisElegido();
  if (yaElegido) return { ok: yaElegido === cursoId, cursoGratis: yaElegido, mensaje: yaElegido === cursoId ? undefined : 'Ya elegiste tu curso gratis y no se puede cambiar.' };

  if (Datos.modo === 'demo') {
    try { localStorage.setItem(CLAVE_DEMO, cursoId); } catch { /* sin almacenamiento */ }
    if (Auth.usuario) Auth.usuario.cursoGratis = cursoId;
    posponerAnuncio();
    return { ok: true, cursoGratis: cursoId };
  }

  try {
    const r = await api<{ cursoGratis: string }>('/me/curso-gratis', { method: 'POST', json: { cursoId } });
    await Auth.refrescarEstado().catch(() => { if (Auth.usuario) Auth.usuario.cursoGratis = r.cursoGratis; });
    if (Auth.usuario && !Auth.usuario.cursoGratis) Auth.usuario.cursoGratis = r.cursoGratis;
    posponerAnuncio();
    return { ok: true, cursoGratis: r.cursoGratis };
  } catch (e) {
    const err = e as { status?: number; datos?: { cursoGratis?: string }; message?: string };
    if (err.status === 409 && err.datos?.cursoGratis) {
      if (Auth.usuario) Auth.usuario.cursoGratis = err.datos.cursoGratis;
      return { ok: err.datos.cursoGratis === cursoId, cursoGratis: err.datos.cursoGratis, mensaje: 'Ya elegiste tu curso gratis y no se puede cambiar.' };
    }
    return { ok: false, mensaje: err.message || 'No se pudo guardar tu elección. Intenta de nuevo.' };
  }
}
