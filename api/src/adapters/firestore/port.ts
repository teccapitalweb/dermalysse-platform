// Puerto mínimo de Firestore: solo las operaciones que la API usa. Las rutas son cadenas
// separadas por "/" (p. ej. 'users/abc', 'forum/t1/replies'). Dos implementaciones:
//  - AdminFirestore (firebase-admin, proyecto real; se inicializa de forma perezosa);
//  - MemoryFirestore (falso en memoria para pruebas; mismas semánticas de merge/create/transacción).

export type Datos = Record<string, unknown>;

export interface Documento {
  id: string;
  exists: boolean;
  /** Copia de los datos (undefined si no existe). */
  data(): Datos | undefined;
}

export interface Filtro {
  campo: string;
  op: '==' | 'array-contains' | 'in';
  valor: unknown;
}

export interface Consulta {
  where?: Filtro[];
  orderBy?: { campo: string; dir?: 'asc' | 'desc' };
  limit?: number;
}

/** Operaciones dentro de una transacción: todas las lecturas antes que las escrituras (regla de Firestore). */
export interface Transaccion {
  get(ruta: string): Promise<Documento>;
  set(ruta: string, datos: Datos, opciones?: { merge?: boolean }): void;
  delete(ruta: string): void;
}

export interface FirestorePort {
  get(ruta: string): Promise<Documento>;
  /** set; con merge:true fusiona mapas anidados como Firestore. */
  set(ruta: string, datos: Datos, opciones?: { merge?: boolean }): Promise<void>;
  /** Crea SOLO si no existe. Devuelve false si ya existía (no la toca). */
  create(ruta: string, datos: Datos): Promise<boolean>;
  /** Agrega un documento con id automático a una colección y devuelve el id. */
  add(coleccion: string, datos: Datos): Promise<string>;
  delete(ruta: string): Promise<void>;
  /** Incremento atómico de un campo numérico de primer nivel (falla si el documento no existe). */
  increment(ruta: string, campo: string, n: number): Promise<void>;
  query(coleccion: string, consulta?: Consulta): Promise<Documento[]>;
  runTransaction<T>(fn: (tx: Transaccion) => Promise<T>): Promise<T>;
}

/** Milisegundos desde un valor de Firestore (Timestamp, Date, número ms o cadena ISO). NaN si no hay. */
export function aMillis(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') return NaN;
  const v = valor as { toDate?: () => Date; toMillis?: () => number };
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') return Date.parse(valor);
  return NaN;
}

/** ISO desde un valor de Firestore, o null si no es una fecha. */
export function aIso(valor: unknown): string | null {
  const ms = aMillis(valor);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export const texto = (v: unknown): string => (typeof v === 'string' ? v : '');
