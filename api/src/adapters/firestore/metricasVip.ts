// Métricas CONFIABLES con las que se calcula el progreso de las recompensas. Solo lectura; nunca
// se toman del cliente:
//  - clases vistas y cursos completados: users/{uid}.progress (lo acredita el webhook; índices base 1)
//    contra el número de clases de cada curso PUBLICADO (courses/{id}.lessons, por posición);
//  - niveles de historia: v2_historia/{uid}.completados;
//  - hilos del foro: forum con authorUid == uid (sin los ocultos por moderación);
//  - certificados: certificates con uid == uid y status 'valid' (uno por curso).
import { readFileSync } from 'node:fs';
import { clasesDesdeLessons } from './club.js';
import type { Datos, FirestorePort } from './port.js';
import { texto } from './port.js';
import { COLECCIONES_V2, segmento } from './v2.js';
import { normalizarGuardada } from '../../services/historia.js';

/**
 * Ids de los niveles REALES del Modo Historia (api/content/club/historia-niveles.json).
 * El progreso de recompensas solo cuenta estos: `completados` de v2_historia lo escribe el cliente
 * (PATCH /historia) y sin este filtro se podría inflar con ids inventados para canjear días VIP.
 */
export function cargarNivelesHistoria(url = new URL('../../../content/club/historia-niveles.json', import.meta.url)): ReadonlySet<string> {
  return new Set((JSON.parse(readFileSync(url, 'utf8')) as { niveles: string[] }).niveles);
}
const NIVELES_HISTORIA_REALES = cargarNivelesHistoria();

export interface MetricasVip {
  clasesVistas: number;
  cursosCompletados: number;
  nivelesHistoria: number;
  hilosForo: number;
  certificados: number;
}

export type MetricaVip = keyof MetricasVip;

/**
 * Clases vistas y cursos completados desde `users.progress` y el número de clases por curso publicado.
 * Solo cuentan los índices válidos (1..clases) de cursos publicados; los repetidos cuentan una vez.
 */
export function avanceDesdeProgress(progress: unknown, clasesPorCurso: ReadonlyMap<string, number>): { clasesVistas: number; cursosCompletados: number } {
  let clasesVistas = 0;
  let cursosCompletados = 0;
  if (typeof progress !== 'object' || progress === null || Array.isArray(progress)) return { clasesVistas, cursosCompletados };
  for (const [cursoId, valor] of Object.entries(progress as Datos)) {
    const total = clasesPorCurso.get(cursoId) ?? 0;
    if (total < 1 || !Array.isArray(valor)) continue;
    const vistas = new Set(valor.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= total));
    clasesVistas += vistas.size;
    if (vistas.size === total) cursosCompletados += 1;
  }
  return { clasesVistas, cursosCompletados };
}

export async function leerMetricasVip(db: FirestorePort, uid: string): Promise<MetricasVip> {
  const id = segmento(uid);
  const [user, cursos, historia, hilos, certificados] = await Promise.all([
    db.get(`users/${id}`),
    db.query('courses'),
    db.get(`${COLECCIONES_V2.historia}/${id}`),
    db.query('forum', { where: [{ campo: 'authorUid', op: '==', valor: uid }] }),
    db.query('certificates', { where: [{ campo: 'uid', op: '==', valor: uid }] }),
  ]);

  const clasesPorCurso = new Map<string, number>();
  for (const c of cursos) {
    const d = c.data() ?? {};
    if (d.status === 'published') clasesPorCurso.set(c.id, clasesDesdeLessons(d.lessons).length);
  }
  const avance = avanceDesdeProgress(user.data()?.progress, clasesPorCurso);

  const cursosCertificados = new Set(
    certificados
      .filter((c) => c.data()?.status === 'valid')
      .map((c) => texto(c.data()?.courseId) || c.id),
  );

  return {
    ...avance,
    nivelesHistoria: normalizarGuardada(historia.data()).completados.filter((id) => NIVELES_HISTORIA_REALES.has(id)).length,
    hilosForo: hilos.filter((h) => h.data()?.oculto !== true).length,
    certificados: cursosCertificados.size,
  };
}
