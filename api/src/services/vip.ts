// Días VIP de cortesía: ÚNICA vía con la que la API nueva escribe `users/{uid}.vigenciaHasta`.
// La usan recompensas, cupones, el beneficio de bienvenida y la cortesía del admin.
// Copia la regla del panel admin actual (admin_club_dermalysse, «Regalar días»):
//  - si la cortesía sigue vigente, se extiende desde su fecha; si no, desde ahora;
//  - `regaloDesde` se conserva mientras la cortesía siga vigente; si no, arranca ahora;
//  - set con merge: nunca toca `subscription` ni otros campos.
// Cada otorgamiento queda en `v2_vip_bitacora` (quién, cuánto, por qué) dentro de la misma transacción.
import type { FirestorePort, Transaccion } from '../adapters/firestore/port.js';
import { aMillis } from '../adapters/firestore/port.js';
import { segmento } from '../adapters/firestore/v2.js';

export const COLECCION_BITACORA_VIP = 'v2_vip_bitacora';
export const DIAS_VIP_MAX = 366;
const DIA_MS = 86_400_000;

export type FuenteVip = 'recompensa' | 'cupon' | 'bienvenida' | 'admin';

export interface OtorgamientoVip {
  uid: string;
  dias: number;
  fuente: FuenteVip;
  /** Identificador de lo que otorgó los días (id de recompensa, código de cupón, uid del admin…). */
  referencia: string;
}

export interface ResultadoVip { vigenciaHasta: string; regaloDesde: string; dias: number }

export function diasVipValidos(dias: unknown): dias is number {
  return Number.isInteger(dias) && (dias as number) >= 1 && (dias as number) <= DIAS_VIP_MAX;
}

/** Calcula la nueva vigencia sin escribir (regla del panel actual). */
export function extenderVigencia(actual: { vigenciaHasta?: unknown; regaloDesde?: unknown }, dias: number, ahora: Date): { vigenciaHasta: string; regaloDesde: string } {
  const ahoraMs = ahora.getTime();
  const vigenteMs = aMillis(actual.vigenciaHasta);
  const vigente = Number.isFinite(vigenteMs) && vigenteMs > ahoraMs;
  const base = vigente ? vigenteMs : ahoraMs;
  const regaloPrevio = typeof actual.regaloDesde === 'string' && actual.regaloDesde ? actual.regaloDesde : '';
  return {
    vigenciaHasta: new Date(base + dias * DIA_MS).toISOString(),
    regaloDesde: vigente && regaloPrevio ? regaloPrevio : ahora.toISOString(),
  };
}

/**
 * Otorga días VIP DENTRO de una transacción ya abierta (para que quien otorga —p. ej. el canje de un
 * cupón— marque su propio estado en la misma transacción). Hace la lectura de `users/{uid}`: llámala
 * antes de cualquier escritura de esa transacción.
 */
export async function otorgarDiasVipEnTx(tx: Transaccion, o: OtorgamientoVip, ahora: Date, idBitacora: string): Promise<ResultadoVip> {
  if (!diasVipValidos(o.dias)) throw new Error(`Días VIP fuera de rango: ${o.dias}`);
  const ruta = `users/${segmento(o.uid)}`;
  const actual = (await tx.get(ruta)).data() ?? {};
  const nuevo = extenderVigencia(actual, o.dias, ahora);
  tx.set(ruta, nuevo, { merge: true });
  tx.set(`${COLECCION_BITACORA_VIP}/${segmento(idBitacora)}`, {
    uid: o.uid, dias: o.dias, fuente: o.fuente, referencia: o.referencia.slice(0, 200),
    antes: typeof actual.vigenciaHasta === 'string' ? actual.vigenciaHasta : null,
    despues: nuevo.vigenciaHasta, fecha: ahora.toISOString(),
  });
  return { ...nuevo, dias: o.dias };
}

/** Otorga días VIP en su propia transacción. */
export function otorgarDiasVip(db: FirestorePort, o: OtorgamientoVip, ahora = new Date()): Promise<ResultadoVip> {
  const id = `${o.fuente}_${segmento(o.uid)}_${ahora.getTime()}_${Math.random().toString(36).slice(2, 8)}`;
  return db.runTransaction((tx) => otorgarDiasVipEnTx(tx, o, ahora, id));
}
