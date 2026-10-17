// Almacenes NUEVOS del club en colecciones v2_* (no existen en el club actual; no tocan sus datos).
//  - v2_experiencias/{id}            Directorio de experiencias.
//  - v2_liga/clasificacion           { actualizado, filas[] } — sin documento ⇒ clasificación vacía (nunca la del fixture).
//  - v2_quiz/{cursoId}__{n}          { cursoId, n, estado, preguntas[], actualizado, por } — banco con respuestas
//                                    (admin); nunca sale completo al cliente. Sin documento ⇒ banco empaquetado.
//  - v2_historia/{uid}               { uid, completados[], puntajes{}, ultimoNivel, actualizado, guardadoEn } — Modo Historia.
import type { ExperienceStore, FiltroExperiencias, HistoriaStore, LeagueStore, LearningStore } from '../interfaces.js';
import type { EstadoExperiencia, ExperienciaCompartida, ExperienciaModerada, ExperienciaPropia, FilaLiga, ProgresoHistoria, QuizFixture, ResumenLiga } from '../../domain/types.js';
import { CATEGORIAS_EXPERIENCIA } from '../../domain/types.js';
import { fusionarHistoria, normalizarGuardada } from '../../services/historia.js';
import { texto, type Datos, type FirestorePort } from './port.js';

export const COLECCIONES_V2 = {
  experiencias: 'v2_experiencias',
  liga: 'v2_liga',
  quiz: 'v2_quiz',
  historia: 'v2_historia',
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
    const [aprobadas, recientes] = await Promise.all([
      this.db.query(COLECCIONES_V2.experiencias, { where: [{ campo: 'estado', op: '==', valor: 'aprobada' }], limit: this.limite }),
      // Mantiene visibles los registros heredados, que todavía no tienen campo `estado`.
      this.db.query(COLECCIONES_V2.experiencias, { orderBy: { campo: 'fecha', dir: 'desc' }, limit: this.limite }),
    ]);
    const unicos = new Map([...aprobadas, ...recientes].map((d) => [d.id, d]));
    return [...unicos.values()]
      .map((d) => d.data() as unknown as ExperienciaModerada)
      .filter((e) => e.estado === undefined || e.estado === 'aprobada')
      .filter((e) => (CATEGORIAS_EXPERIENCIA as readonly string[]).includes(e.categoria))
      .filter((e) => (!categoria || categoria === 'todas' ? true : e.categoria === categoria))
      .filter((e) => (!q ? true : `${e.titulo} ${e.texto} ${e.autor}`.toLocaleLowerCase('es-MX').includes(q)))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, this.limite)
      .map((e) => ({ id: e.id, titulo: e.titulo, texto: e.texto, categoria: e.categoria, autor: e.autor, anonima: e.anonima === true, fecha: e.fecha }));
  }

  async propias(uid: string): Promise<ExperienciaPropia[]> {
    const docs = await this.db.query(COLECCIONES_V2.experiencias, { where: [{ campo: 'autorUid', op: '==', valor: uid }], limit: this.limite });
    return docs.map((d) => d.data() as unknown as ExperienciaModerada)
      .filter((e) => (['pendiente', 'aprobada', 'rechazada'] as string[]).includes(e.estado))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map(({ autorUid: _uid, revisorUid: _revisor, ...e }) => ({ ...e }));
  }

  async pendientes(): Promise<ExperienciaModerada[]> {
    const docs = await this.db.query(COLECCIONES_V2.experiencias, { where: [{ campo: 'estado', op: '==', valor: 'pendiente' }], limit: this.limite });
    return docs.map((d) => d.data() as unknown as ExperienciaModerada).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  async crear(exp: ExperienciaModerada): Promise<ExperienciaModerada> {
    await this.db.set(`${COLECCIONES_V2.experiencias}/${segmento(exp.id)}`, { ...exp });
    return { ...exp };
  }

  async revisar(id: string, estado: Exclude<EstadoExperiencia, 'pendiente'>, revisorUid: string): Promise<ExperienciaModerada | null> {
    const ruta = `${COLECCIONES_V2.experiencias}/${segmento(id)}`;
    const documento = await this.db.get(ruta);
    if (!documento.exists) return null;
    const actualizado = { ...(documento.data() as unknown as ExperienciaModerada), estado, revisadaEn: new Date().toISOString(), revisorUid };
    await this.db.set(ruta, { estado, revisadaEn: actualizado.revisadaEn, revisorUid }, { merge: true });
    return actualizado;
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

/**
 * Banco de quizzes de producción: v2_quiz/{cursoId}__{n} si existe con preguntas y no es borrador
 * (lo guarda el admin); si no, el banco empaquetado (api/content/club/quizzes.json).
 */
export class FirestoreLearningStore implements LearningStore {
  private readonly empaquetados: Map<string, QuizFixture>;

  constructor(private readonly db: FirestorePort, empaquetados: QuizFixture[] = []) {
    this.empaquetados = new Map(empaquetados.map((q) => [`${q.cursoId}__${q.n}`, q]));
  }

  async quiz(cursoId: string, n: number): Promise<QuizFixture | null> {
    if (!Number.isInteger(n) || n < 1) return null;
    let ruta: string;
    try { ruta = `${COLECCIONES_V2.quiz}/${segmento(cursoId)}__${n}`; } catch { return null; }
    const d = (await this.db.get(ruta)).data();
    if (d && d.estado !== 'borrador' && Array.isArray(d.preguntas) && d.preguntas.length) {
      return { cursoId, n, preguntas: d.preguntas as QuizFixture['preguntas'] };
    }
    const empaquetado = this.empaquetados.get(`${cursoId}__${n}`);
    return empaquetado ? { cursoId, n, preguntas: empaquetado.preguntas } : null;
  }
}

export class FirestoreHistoriaStore implements HistoriaStore {
  constructor(private readonly db: FirestorePort) {}

  private ruta(uid: string) { return `${COLECCIONES_V2.historia}/${segmento(uid)}`; }

  async get(uid: string): Promise<ProgresoHistoria> {
    return normalizarGuardada((await this.db.get(this.ruta(uid))).data());
  }

  /** Lectura + escritura en transacción: dos PATCH simultáneos nunca se pisan. */
  fusionar(uid: string, entrada: ProgresoHistoria): Promise<ProgresoHistoria> {
    const ruta = this.ruta(uid);
    return this.db.runTransaction(async (tx) => {
      const siguiente = fusionarHistoria(normalizarGuardada((await tx.get(ruta)).data()), entrada);
      tx.set(ruta, { uid, ...siguiente, guardadoEn: new Date().toISOString() });
      return siguiente;
    });
  }
}
