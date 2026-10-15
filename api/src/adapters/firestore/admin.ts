// Adaptador REAL sobre firebase-admin (proyecto club-dermalysse). Se inicializa de forma PEREZOSA:
// importar este módulo no carga firebase-admin ni abre conexiones; la primera operación lo hace.
// La cuenta de servicio llega ya validada desde config.ts (FIREBASE_SERVICE_ACCOUNT); nunca se registra.
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import type { DocumentSnapshot, FieldValue as TipoFieldValue, Firestore, Query } from 'firebase-admin/firestore';
import type { Consulta, Datos, Documento, FirestorePort, Transaccion } from './port.js';

export interface CuentaServicio {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

interface Recursos {
  db: Firestore;
  auth: Auth;
  FieldValue: typeof TipoFieldValue;
}

const NOMBRE_APP = 'dermalysse-api';

/** Inicializa firebase-admin una sola vez, en el primer uso (nunca al importar). */
export class FirebaseAdminPerezoso {
  private recursosPromesa?: Promise<Recursos>;

  constructor(private readonly cuenta: CuentaServicio) {}

  recursos(): Promise<Recursos> {
    this.recursosPromesa ??= (async () => {
      const { cert, getApps, initializeApp } = await import('firebase-admin/app');
      const { FieldValue, getFirestore } = await import('firebase-admin/firestore');
      const { getAuth } = await import('firebase-admin/auth');
      const existente = getApps().find((a) => a.name === NOMBRE_APP);
      const app = existente ?? initializeApp({
        credential: cert({ projectId: this.cuenta.projectId, clientEmail: this.cuenta.clientEmail, privateKey: this.cuenta.privateKey }),
        projectId: this.cuenta.projectId,
      }, NOMBRE_APP);
      const db = getFirestore(app);
      // Campos opcionales sin valor se omiten (igual que el Firestore falso de las pruebas).
      if (!existente) db.settings({ ignoreUndefinedProperties: true });
      return { db, auth: getAuth(app), FieldValue };
    })().catch((e) => { this.recursosPromesa = undefined; throw e; }); // reintenta en la siguiente petición
    return this.recursosPromesa;
  }

  /** Verificador de ID tokens para FirebaseAuthAdapter. */
  verificador(): { verifyIdToken(token: string, checkRevoked: boolean): Promise<DecodedIdToken> } {
    return { verifyIdToken: async (token, checkRevoked) => (await this.recursos()).auth.verifyIdToken(token, checkRevoked) };
  }
}

const documento = (s: DocumentSnapshot): Documento => ({ id: s.id, exists: s.exists, data: () => s.data() as Datos | undefined });

/** Código gRPC ALREADY_EXISTS (create() sobre un documento existente). */
const YA_EXISTE = 6;

export class AdminFirestore implements FirestorePort {
  constructor(private readonly firebase: FirebaseAdminPerezoso) {}

  private async db(): Promise<Firestore> { return (await this.firebase.recursos()).db; }

  async get(ruta: string): Promise<Documento> {
    return documento(await (await this.db()).doc(ruta).get());
  }

  async set(ruta: string, datos: Datos, opciones?: { merge?: boolean }): Promise<void> {
    const ref = (await this.db()).doc(ruta);
    if (opciones?.merge) await ref.set(datos, { merge: true });
    else await ref.set(datos);
  }

  async create(ruta: string, datos: Datos): Promise<boolean> {
    try {
      await (await this.db()).doc(ruta).create(datos);
      return true;
    } catch (e) {
      if ((e as { code?: unknown }).code === YA_EXISTE) return false;
      throw e;
    }
  }

  async add(coleccion: string, datos: Datos): Promise<string> {
    return (await (await this.db()).collection(coleccion).add(datos)).id;
  }

  async delete(ruta: string): Promise<void> {
    await (await this.db()).doc(ruta).delete();
  }

  async increment(ruta: string, campo: string, n: number): Promise<void> {
    const { db, FieldValue } = await this.firebase.recursos();
    await db.doc(ruta).update({ [campo]: FieldValue.increment(n) });
  }

  async query(coleccion: string, consulta: Consulta = {}): Promise<Documento[]> {
    let q: Query = (await this.db()).collection(coleccion);
    for (const f of consulta.where ?? []) q = q.where(f.campo, f.op, f.valor);
    if (consulta.orderBy) q = q.orderBy(consulta.orderBy.campo, consulta.orderBy.dir ?? 'asc');
    if (consulta.limit !== undefined) q = q.limit(consulta.limit);
    return (await q.get()).docs.map(documento);
  }

  async runTransaction<T>(fn: (tx: Transaccion) => Promise<T>): Promise<T> {
    const db = await this.db();
    return db.runTransaction(async (t) => fn({
      get: async (ruta) => documento(await t.get(db.doc(ruta))),
      set: (ruta, datos, opciones) => { if (opciones?.merge) t.set(db.doc(ruta), datos, { merge: true }); else t.set(db.doc(ruta), datos); },
      delete: (ruta) => { t.delete(db.doc(ruta)); },
    }));
  }
}
