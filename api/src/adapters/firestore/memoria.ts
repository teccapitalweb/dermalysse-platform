// Firestore FALSO en memoria (pruebas y desarrollo). Reproduce lo que la API necesita de Firestore:
// merge profundo de mapas, create que no pisa, orderBy que excluye documentos sin el campo,
// transacciones serializadas y campos undefined descartados (ignoreUndefinedProperties).
import { randomBytes } from 'node:crypto';
import type { Consulta, Datos, Documento, FirestorePort, Transaccion } from './port.js';

const esMapa = (v: unknown): v is Datos => typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);

/** Copia profunda sin campos undefined (como Firestore con ignoreUndefinedProperties). */
function limpio<T>(v: T): T {
  if (Array.isArray(v)) return v.filter((x) => x !== undefined).map(limpio) as T;
  if (v instanceof Date) return new Date(v.getTime()) as T;
  if (esMapa(v)) {
    const salida: Datos = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) salida[k] = limpio(x);
    return salida as T;
  }
  return v;
}

function fusionar(base: Datos, cambios: Datos): Datos {
  const salida: Datos = { ...base };
  for (const [k, v] of Object.entries(cambios)) {
    salida[k] = esMapa(v) && esMapa(salida[k]) ? fusionar(salida[k] as Datos, v) : v;
  }
  return salida;
}

function validarRuta(ruta: string, tipo: 'doc' | 'col'): string[] {
  const partes = ruta.split('/');
  if (partes.some((p) => !p) || (tipo === 'doc' ? partes.length % 2 !== 0 : partes.length % 2 !== 1)) {
    throw new Error(`Ruta de Firestore inválida (${tipo}): ${ruta}`);
  }
  return partes;
}

function comparar(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

export class MemoryFirestore implements FirestorePort {
  private readonly docs = new Map<string, Datos>();
  private cola: Promise<unknown> = Promise.resolve();
  /** Registro de escrituras (ruta + datos) para que las pruebas verifiquen qué se escribió. */
  readonly escrituras: { op: string; ruta: string; datos?: Datos }[] = [];

  /** Siembra un documento (solo pruebas). */
  sembrar(ruta: string, datos: Datos): void {
    validarRuta(ruta, 'doc');
    this.docs.set(ruta, limpio(datos));
  }

  /** Lee el estado crudo (solo pruebas). */
  crudo(ruta: string): Datos | undefined {
    const d = this.docs.get(ruta);
    return d ? limpio(d) : undefined;
  }

  private snap(ruta: string): Documento {
    const partes = validarRuta(ruta, 'doc');
    const datos = this.docs.get(ruta);
    return { id: partes[partes.length - 1], exists: datos !== undefined, data: () => (datos ? limpio(datos) : undefined) };
  }

  private escribir(ruta: string, datos: Datos, merge: boolean): void {
    validarRuta(ruta, 'doc');
    const previo = this.docs.get(ruta);
    this.docs.set(ruta, merge && previo ? fusionar(previo, limpio(datos)) : limpio(datos));
    this.escrituras.push({ op: merge ? 'set-merge' : 'set', ruta, datos: limpio(datos) });
  }

  async get(ruta: string): Promise<Documento> { return this.snap(ruta); }

  async set(ruta: string, datos: Datos, opciones?: { merge?: boolean }): Promise<void> {
    this.escribir(ruta, datos, opciones?.merge === true);
  }

  async create(ruta: string, datos: Datos): Promise<boolean> {
    validarRuta(ruta, 'doc');
    if (this.docs.has(ruta)) return false;
    this.docs.set(ruta, limpio(datos));
    this.escrituras.push({ op: 'create', ruta, datos: limpio(datos) });
    return true;
  }

  async add(coleccion: string, datos: Datos): Promise<string> {
    validarRuta(coleccion, 'col');
    const id = randomBytes(10).toString('hex');
    await this.create(`${coleccion}/${id}`, datos);
    return id;
  }

  async delete(ruta: string): Promise<void> {
    validarRuta(ruta, 'doc');
    this.docs.delete(ruta);
    this.escrituras.push({ op: 'delete', ruta });
  }

  async increment(ruta: string, campo: string, n: number): Promise<void> {
    const previo = this.docs.get(ruta);
    if (!previo) throw new Error(`NOT_FOUND: ${ruta}`);
    const actual = typeof previo[campo] === 'number' ? (previo[campo] as number) : 0;
    this.docs.set(ruta, { ...previo, [campo]: actual + n });
    this.escrituras.push({ op: 'increment', ruta, datos: { [campo]: n } });
  }

  async query(coleccion: string, consulta: Consulta = {}): Promise<Documento[]> {
    const prefijo = validarRuta(coleccion, 'col').join('/') + '/';
    let filas = [...this.docs.entries()]
      .filter(([ruta]) => ruta.startsWith(prefijo) && !ruta.slice(prefijo.length).includes('/'))
      .map(([ruta, datos]) => ({ ruta, datos }));
    for (const f of consulta.where ?? []) {
      filas = filas.filter(({ datos }) => {
        const v = datos[f.campo];
        if (f.op === '==') return v === f.valor;
        if (f.op === 'array-contains') return Array.isArray(v) && v.includes(f.valor);
        return Array.isArray(f.valor) && f.valor.includes(v);
      });
    }
    const orden = consulta.orderBy;
    if (orden) {
      // Firestore excluye los documentos que no tienen el campo de ordenamiento.
      filas = filas.filter(({ datos }) => datos[orden.campo] !== undefined && datos[orden.campo] !== null);
      filas.sort((a, b) => comparar(a.datos[orden.campo], b.datos[orden.campo]) * (orden.dir === 'desc' ? -1 : 1));
    }
    if (consulta.limit !== undefined) filas = filas.slice(0, consulta.limit);
    return filas.map(({ ruta }) => this.snap(ruta));
  }

  async runTransaction<T>(fn: (tx: Transaccion) => Promise<T>): Promise<T> {
    // Serializa las transacciones (equivalente a la atomicidad de Firestore en un solo proceso).
    const ejecutar = async () => {
      const pendientes: (() => void)[] = [];
      const tx: Transaccion = {
        get: async (ruta) => this.snap(ruta),
        set: (ruta, datos, opciones) => { pendientes.push(() => this.escribir(ruta, datos, opciones?.merge === true)); },
        delete: (ruta) => { pendientes.push(() => { this.docs.delete(ruta); this.escrituras.push({ op: 'delete', ruta }); }); },
      };
      const resultado = await fn(tx);
      for (const p of pendientes) p();
      return resultado;
    };
    const siguiente = this.cola.then(ejecutar, ejecutar);
    this.cola = siguiente.catch(() => undefined);
    return siguiente;
  }
}
