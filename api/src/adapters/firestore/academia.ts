// Almacenes de la Academia en Firestore (colecciones NUEVAS v2_academia_*; el club actual no las usa).
//  - v2_academia_progreso/{uid}                       { uid, programas: ProgresoAcademia, actualizado }
//  - v2_academia_intentos/{uid}__{programa}__{n}      IntentoAcademia + { uid, programa, n }
//  - v2_academia_revisiones/{programa}__{n}           RevisionAcademia + { programa, n }
//  - v2_academia_lanzamiento/{programa}               AjusteLanzamientoAcademia + { programa }
// Las escrituras que dependen de una lectura (marcar tema, examen, consumir) van en transacción.
import { claveRevisionAcademia, type AcademiaAttemptStore, type AcademiaProgressStore, type AcademiaReviewStore } from '../interfaces.js';
import type { AjusteLanzamientoAcademia, AvanceModuloAcademia, IntentoAcademia, ProgresoAcademia, RevisionAcademia } from '../../domain/types.js';
import { COLECCIONES_V2, segmento } from './v2.js';
import { texto, type Datos, type FirestorePort } from './port.js';

const C = COLECCIONES_V2;

export class FirestoreAcademiaProgressStore implements AcademiaProgressStore {
  constructor(private readonly db: FirestorePort) {}

  private ruta(uid: string) { return `${C.academiaProgreso}/${segmento(uid)}`; }

  private programas(d: Datos | undefined): ProgresoAcademia {
    const p = d?.programas;
    return typeof p === 'object' && p !== null ? structuredClone(p as ProgresoAcademia) : {};
  }

  async del(uid: string): Promise<ProgresoAcademia> {
    return this.programas((await this.db.get(this.ruta(uid))).data());
  }

  async modulo(uid: string, programa: string, n: number): Promise<AvanceModuloAcademia> {
    return (await this.del(uid))[programa]?.modulos?.[String(n)] ?? {};
  }

  private mutar(uid: string, programa: string, n: number, fn: (a: AvanceModuloAcademia) => void): Promise<AvanceModuloAcademia> {
    const ruta = this.ruta(uid);
    return this.db.runTransaction(async (tx) => {
      const programas = this.programas((await tx.get(ruta)).data());
      const prog = (programas[programa] ??= { modulos: {} });
      prog.modulos ??= {};
      const avance = (prog.modulos[String(n)] ??= {});
      fn(avance);
      tx.set(ruta, { uid, programas, actualizado: new Date().toISOString() });
      return structuredClone(avance);
    });
  }

  marcarTema(uid: string, programa: string, n: number, tema: string, fecha: string): Promise<AvanceModuloAcademia> {
    return this.mutar(uid, programa, n, (a) => { (a.temas ??= {})[tema] ??= fecha; });
  }

  registrarExamen(uid: string, programa: string, n: number, r: { porcentaje: number; aprobado: boolean; fecha: string }): Promise<AvanceModuloAcademia> {
    return this.mutar(uid, programa, n, (a) => {
      a.mejor = Math.max(a.mejor ?? 0, r.porcentaje);
      a.intentos = (a.intentos ?? 0) + 1;
      if (r.aprobado && !a.aprobado) { a.aprobado = true; a.aprobadoEn = r.fecha; }
      a.aprobado = a.aprobado === true; // una reprobación posterior nunca retira la aprobación
    });
  }
}

export class FirestoreAcademiaAttemptStore implements AcademiaAttemptStore {
  constructor(private readonly db: FirestorePort) {}

  private ruta(uid: string, programa: string, n: number) {
    return `${C.academiaIntentos}/${segmento(uid)}__${segmento(programa)}__${segmento(n)}`;
  }

  private intento(d: Datos | undefined): IntentoAcademia | null {
    if (!d) return null;
    const i: IntentoAcademia = {
      ids: Array.isArray(d.ids) ? d.ids.map(String) : [],
      emitido: texto(d.emitido),
      calificado: d.calificado === true,
    };
    const u = d.ultimo as { aprobado?: unknown; fecha?: unknown } | undefined;
    if (u && typeof u === 'object') i.ultimo = { aprobado: u.aprobado === true, fecha: texto(u.fecha) };
    return i;
  }

  async get(uid: string, programa: string, n: number): Promise<IntentoAcademia | null> {
    return this.intento((await this.db.get(this.ruta(uid, programa, n))).data());
  }

  async emitir(uid: string, programa: string, n: number, ids: string[], fecha: string): Promise<void> {
    const ruta = this.ruta(uid, programa, n);
    await this.db.runTransaction(async (tx) => {
      const previo = this.intento((await tx.get(ruta)).data());
      tx.set(ruta, { uid, programa, n, ids: [...ids], emitido: fecha, calificado: false, ...(previo?.ultimo ? { ultimo: previo.ultimo } : {}) });
    });
  }

  async consumir(uid: string, programa: string, n: number): Promise<string[] | null> {
    const ruta = this.ruta(uid, programa, n);
    return this.db.runTransaction(async (tx) => {
      const i = this.intento((await tx.get(ruta)).data());
      if (!i || i.calificado) return null;
      tx.set(ruta, { calificado: true }, { merge: true });
      return [...i.ids];
    });
  }

  async cerrar(uid: string, programa: string, n: number, resultado: { aprobado: boolean; fecha: string }): Promise<void> {
    const ruta = this.ruta(uid, programa, n);
    await this.db.runTransaction(async (tx) => {
      if ((await tx.get(ruta)).exists) tx.set(ruta, { ultimo: { aprobado: resultado.aprobado, fecha: resultado.fecha } }, { merge: true });
    });
  }
}

export class FirestoreAcademiaReviewStore implements AcademiaReviewStore {
  constructor(private readonly db: FirestorePort) {}

  private revision(d: Datos): RevisionAcademia {
    return { estado: d.estado as RevisionAcademia['estado'], nota: texto(d.nota), revisor: texto(d.revisor), fecha: texto(d.fecha) };
  }

  private ajuste(d: Datos): AjusteLanzamientoAcademia {
    const a: AjusteLanzamientoAcademia = { inicio: texto(d.inicio), por: texto(d.por), fecha: texto(d.fecha) };
    if (typeof d.cadaDias === 'number') a.cadaDias = d.cadaDias;
    return a;
  }

  async todas(): Promise<Map<string, RevisionAcademia>> {
    const docs = await this.db.query(C.academiaRevisiones);
    const mapa = new Map<string, RevisionAcademia>();
    for (const d of docs) {
      const x = d.data() ?? {};
      if (texto(x.programa) && Number.isInteger(x.n)) mapa.set(claveRevisionAcademia(texto(x.programa), x.n as number), this.revision(x));
    }
    return mapa;
  }

  async get(programa: string, n: number): Promise<RevisionAcademia | null> {
    const d = (await this.db.get(`${C.academiaRevisiones}/${segmento(programa)}__${segmento(n)}`)).data();
    return d ? this.revision(d) : null;
  }

  async set(programa: string, n: number, revision: RevisionAcademia): Promise<RevisionAcademia> {
    await this.db.set(`${C.academiaRevisiones}/${segmento(programa)}__${segmento(n)}`, { programa, n, ...revision });
    return { ...revision };
  }

  async lanzamientos(): Promise<Map<string, AjusteLanzamientoAcademia>> {
    const docs = await this.db.query(C.academiaLanzamiento);
    return new Map(docs.map((d) => [texto(d.data()?.programa) || d.id, this.ajuste(d.data() ?? {})]));
  }

  async lanzamiento(programa: string): Promise<AjusteLanzamientoAcademia | null> {
    const d = (await this.db.get(`${C.academiaLanzamiento}/${segmento(programa)}`)).data();
    return d ? this.ajuste(d) : null;
  }

  async fijarLanzamiento(programa: string, ajuste: AjusteLanzamientoAcademia | null): Promise<void> {
    const ruta = `${C.academiaLanzamiento}/${segmento(programa)}`;
    if (ajuste) await this.db.set(ruta, { programa, ...ajuste });
    else await this.db.delete(ruta);
  }
}
