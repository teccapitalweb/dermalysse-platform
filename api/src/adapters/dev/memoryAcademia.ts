// Almacenes de la Academia en MEMORIA (modo dev). No persisten en disco ni en una base real.
// Devuelven copias defensivas para que nadie mute el estado interno desde fuera.
import { claveRevisionAcademia, type AcademiaAttemptStore, type AcademiaProgressStore, type AcademiaReviewStore } from '../interfaces.js';
import type { AvanceModuloAcademia, IntentoAcademia, ProgresoAcademia, RevisionAcademia } from '../../domain/types.js';

const clave = (...partes: (string | number)[]) => partes.join('|');

export class MemoryAcademiaProgressStore implements AcademiaProgressStore {
  private readonly porUsuario = new Map<string, ProgresoAcademia>();

  private avance(uid: string, programa: string, n: number): AvanceModuloAcademia {
    let mapa = this.porUsuario.get(uid);
    if (!mapa) { mapa = {}; this.porUsuario.set(uid, mapa); }
    const prog = (mapa[programa] ??= { modulos: {} });
    return (prog.modulos[String(n)] ??= {});
  }

  async del(uid: string): Promise<ProgresoAcademia> {
    return structuredClone(this.porUsuario.get(uid) ?? {});
  }

  async modulo(uid: string, programa: string, n: number): Promise<AvanceModuloAcademia> {
    return structuredClone(this.porUsuario.get(uid)?.[programa]?.modulos[String(n)] ?? {});
  }

  async marcarTema(uid: string, programa: string, n: number, tema: string, fecha: string): Promise<AvanceModuloAcademia> {
    const a = this.avance(uid, programa, n);
    (a.temas ??= {})[tema] ??= fecha;
    return structuredClone(a);
  }

  async registrarExamen(uid: string, programa: string, n: number, r: { porcentaje: number; aprobado: boolean; fecha: string }): Promise<AvanceModuloAcademia> {
    const a = this.avance(uid, programa, n);
    a.mejor = Math.max(a.mejor ?? 0, r.porcentaje);
    a.intentos = (a.intentos ?? 0) + 1;
    if (r.aprobado && !a.aprobado) { a.aprobado = true; a.aprobadoEn = r.fecha; }
    a.aprobado = a.aprobado === true; // una reprobación posterior nunca retira la aprobación
    return structuredClone(a);
  }
}

export class MemoryAcademiaAttemptStore implements AcademiaAttemptStore {
  private readonly intentos = new Map<string, IntentoAcademia>();

  async get(uid: string, programa: string, n: number): Promise<IntentoAcademia | null> {
    const i = this.intentos.get(clave(uid, programa, n));
    return i ? structuredClone(i) : null;
  }

  async emitir(uid: string, programa: string, n: number, ids: string[], fecha: string): Promise<void> {
    const k = clave(uid, programa, n);
    const previo = this.intentos.get(k);
    this.intentos.set(k, { ids: [...ids], emitido: fecha, calificado: false, ...(previo?.ultimo ? { ultimo: previo.ultimo } : {}) });
  }

  async consumir(uid: string, programa: string, n: number): Promise<string[] | null> {
    // Sin await entre leer y marcar: en un solo proceso esto es atómico.
    const i = this.intentos.get(clave(uid, programa, n));
    if (!i || i.calificado) return null;
    i.calificado = true;
    return [...i.ids];
  }

  async cerrar(uid: string, programa: string, n: number, resultado: { aprobado: boolean; fecha: string }): Promise<void> {
    const i = this.intentos.get(clave(uid, programa, n));
    if (i) i.ultimo = { ...resultado };
  }
}

export class MemoryAcademiaReviewStore implements AcademiaReviewStore {
  private readonly revisiones = new Map<string, RevisionAcademia>();

  async todas(): Promise<Map<string, RevisionAcademia>> {
    return new Map([...this.revisiones].map(([k, v]) => [k, { ...v }]));
  }

  async get(programa: string, n: number): Promise<RevisionAcademia | null> {
    const r = this.revisiones.get(claveRevisionAcademia(programa, n));
    return r ? { ...r } : null;
  }

  async set(programa: string, n: number, revision: RevisionAcademia): Promise<RevisionAcademia> {
    this.revisiones.set(claveRevisionAcademia(programa, n), { ...revision });
    return { ...revision };
  }
}
