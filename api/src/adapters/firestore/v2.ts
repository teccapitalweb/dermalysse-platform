// Almacenes NUEVOS del club en colecciones v2_* (no existen en el club actual; no tocan sus datos).
//  - v2_experiencias/{id}            Directorio de experiencias.
//  - v2_liga/clasificacion           { actualizado, filas[] } — sin documento ⇒ clasificación vacía (nunca la del fixture).
//  - v2_quiz/{cursoId}__{n}          { preguntas[] } — banco con respuestas; nunca sale completo al cliente.
import type { ExperienceStore, FiltroExperiencias, LeagueStore, LearningStore } from '../interfaces.js';
import type { ExperienciaCompartida, FilaLiga, QuizFixture, ResumenLiga } from '../../domain/types.js';
import { CATEGORIAS_EXPERIENCIA } from '../../domain/types.js';
import { texto, type Datos, type FirestorePort } from './port.js';

export const COLECCIONES_V2 = {
  experiencias: 'v2_experiencias',
  liga: 'v2_liga',
  quiz: 'v2_quiz',
  academiaProgreso: 'v2_academia_progreso',
  academiaIntentos: 'v2_academia_intentos',
  academiaRevisiones: 'v2_academia_revisiones',
  academiaLanzamiento: 'v2_academia_lanzamiento',
} as const;

/** Segmento de id seguro para Firestore (sin "/"); los ids del catálogo son slugs. */
export function segmento(valor: string | number): string {
  const s = String(valor);
  if (!/^[A-Za-z0-9_.-]{1,200}$/.test(s) || s === '.' || s === '..') throw new Error(`Identificador no válido para Firestore: ${s}`);
  return s;
}

export class FirestoreExperienceStore implements ExperienceStore {
  constructor(private readonly db: FirestorePort, private readonly limite = 500) {}

  async listar(filtro: FiltroExperiencias): Promise<ExperienciaCompartida[]> {
    const q = (filtro.q || '').trim().toLocaleLowerCase('es-MX');
    const categoria = filtro.categoria;
    const docs = await this.db.query(COLECCIONES_V2.experiencias, { orderBy: { campo: 'fecha', dir: 'desc' }, limit: this.limite });
    return docs
      .map((d) => d.data() as unknown as ExperienciaCompartida)
      .filter((e) => (CATEGORIAS_EXPERIENCIA as readonly string[]).includes(e.categoria))
      .filter((e) => (!categoria || categoria === 'todas' ? true : e.categoria === categoria))
      .filter((e) => (!q ? true : `${e.titulo} ${e.texto} ${e.autor}`.toLocaleLowerCase('es-MX').includes(q)))
      .map((e) => ({ id: e.id, titulo: e.titulo, texto: e.texto, categoria: e.categoria, autor: e.autor, anonima: e.anonima === true, fecha: e.fecha }));
  }

  async crear(exp: ExperienciaCompartida): Promise<ExperienciaCompartida> {
    await this.db.set(`${COLECCIONES_V2.experiencias}/${segmento(exp.id)}`, { ...exp });
    return exp;
  }
}

export class FirestoreLeagueStore implements LeagueStore {
  constructor(private readonly db: FirestorePort) {}

  private async doc(): Promise<Datos> {
    return (await this.db.get(`${COLECCIONES_V2.liga}/clasificacion`)).data() ?? {};
  }

  async filas(): Promise<FilaLiga[]> {
    const filas = (await this.doc()).filas;
    return (Array.isArray(filas) ? filas as FilaLiga[] : []).map((f) => ({ ...f, esYo: false }));
  }

  async resumen(filas: FilaLiga[]): Promise<ResumenLiga> {
    return {
      actualizado: texto((await this.doc()).actualizado) || new Date().toISOString(),
      participantes: filas.length,
      clasificacion: filas,
      yo: filas.find((f) => f.esYo) ?? null,
      esDemo: false,
    };
  }
}

export class FirestoreLearningStore implements LearningStore {
  constructor(private readonly db: FirestorePort) {}

  async quiz(cursoId: string, n: number): Promise<QuizFixture | null> {
    if (!Number.isInteger(n) || n < 1) return null;
    let ruta: string;
    try { ruta = `${COLECCIONES_V2.quiz}/${segmento(cursoId)}__${n}`; } catch { return null; }
    const d = (await this.db.get(ruta)).data();
    if (!d || !Array.isArray(d.preguntas) || !d.preguntas.length) return null;
    return { cursoId, n, preguntas: d.preguntas as QuizFixture['preguntas'] };
  }
}
