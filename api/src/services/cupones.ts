// Cupones de acceso VIP. No cobran, no cancelan pagos y nunca tocan `subscription`.
//  - v2_cupones/{CODIGO}               { codigo, loteId, duracion, dias, maxUsos, usos, activo, venceEn|null, creadoEn, creadoPor, ultimoCanje? }
//  - v2_cupones/{CODIGO}/canjes/{uid}  { uid, fecha, dias, vigenciaHasta }  — un canje por cuenta y código
//  - v2_cupones_lotes/{id}             { id, modalidad, cantidad, duracion, dias, codigos[], creadoEn, creadoPor } — idempotencia del admin
// El código se normaliza a MAYÚSCULAS. Canje = una transacción: valida, cuenta el uso, registra el canje
// y otorga los días con otorgarDiasVipEnTx (fuente 'cupon').
import { randomInt, randomUUID } from 'node:crypto';
import type { Datos, FirestorePort } from '../adapters/firestore/port.js';
import { aIso, aMillis, texto } from '../adapters/firestore/port.js';
import { segmento } from '../adapters/firestore/v2.js';
import { diasDeDuracion, esDuracionVip, type DuracionVip } from './duracionVip.js';
import { diasVipValidos, DIAS_VIP_MAX, otorgarDiasVipEnTx } from './vip.js';
import { CodedError, NotFoundError, ValidationError } from './errors.js';

export const COLECCION_CUPONES = 'v2_cupones';
export const COLECCION_LOTES_CUPONES = 'v2_cupones_lotes';
export const CANTIDAD_MAX_LOTE = 100;

const FORMATO_CODIGO = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para dictarlos sin errores
const PREFIJO = 'DERMA-';

export type Modalidad = 'compartido' | 'individuales';

/** Forma que consume el admin (src/admin/remoto.ts · CuponAdmin). */
export interface CuponAdmin { codigo: string; loteId: string; duracion: string; dias: number | null; maxUsos: number; usos: number; activo: boolean; creadoEn: string; venceEn: string | null }
/** Forma que consume el admin (src/admin/remoto.ts · LoteCupones). */
export interface LoteCupones { id: string; modalidad: Modalidad; cantidad: number; duracion: string; dias: number | null; codigos: string[]; creadoEn: string }

export interface ResultadoCanjeCupon { ok: true; codigo: string; dias: number; hasta: string; regaloDesde: string }

/** Código normalizado (sin espacios, mayúsculas) o null si no tiene un formato posible. */
export function normalizarCodigo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const codigo = valor.replace(/\s+/g, '').toUpperCase();
  return FORMATO_CODIGO.test(codigo) ? codigo : null;
}

export function generarCodigo(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return PREFIJO + s;
}

const rutaCupon = (codigo: string) => `${COLECCION_CUPONES}/${segmento(codigo)}`;

export function cuponDesdeDoc(id: string, d: Datos): CuponAdmin {
  return {
    codigo: texto(d.codigo) || id,
    loteId: texto(d.loteId),
    duracion: texto(d.duracion),
    dias: Number.isInteger(d.dias) ? (d.dias as number) : null,
    maxUsos: Math.max(0, Number(d.maxUsos) || 0),
    usos: Math.max(0, Number(d.usos) || 0),
    activo: d.activo !== false,
    creadoEn: aIso(d.creadoEn) ?? '',
    venceEn: aIso(d.venceEn),
  };
}

export interface EntradaLote { duracion: DuracionVip; dias: number; modalidad: Modalidad; cantidad: number; venceEn: string | null; idempotencia: string | null }

/** Valida el cuerpo de POST /admin/cupones. */
export function validarLote(cuerpo: unknown, ahora: Date): EntradaLote {
  const c = (typeof cuerpo === 'object' && cuerpo !== null ? cuerpo : {}) as Record<string, unknown>;
  if (!esDuracionVip(c.duracion)) throw new ValidationError('duracion debe ser 15d, 1m, 3m, 1y o personalizada.');
  const dias = diasDeDuracion(c.duracion, c.dias);
  if (dias === null) throw new ValidationError(`Los días de acceso deben ser un entero de 1 a ${DIAS_VIP_MAX}.`);
  if (c.modalidad !== 'compartido' && c.modalidad !== 'individuales') throw new ValidationError('modalidad debe ser compartido o individuales.');
  const cantidad = c.cantidad;
  if (!Number.isInteger(cantidad) || (cantidad as number) < 1 || (cantidad as number) > CANTIDAD_MAX_LOTE) {
    throw new ValidationError(`La cantidad de personas debe ser un entero de 1 a ${CANTIDAD_MAX_LOTE}.`);
  }
  let venceEn: string | null = null;
  if (c.venceEn !== undefined && c.venceEn !== null && c.venceEn !== '') {
    const ms = typeof c.venceEn === 'string' ? Date.parse(c.venceEn) : NaN;
    if (!Number.isFinite(ms) || ms <= ahora.getTime()) throw new ValidationError('venceEn debe ser una fecha ISO futura.');
    venceEn = new Date(ms).toISOString();
  }
  let idempotencia: string | null = null;
  if (c.idempotencia !== undefined) {
    if (typeof c.idempotencia !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(c.idempotencia)) throw new ValidationError('idempotencia no es válida.');
    idempotencia = c.idempotencia;
  }
  return { duracion: c.duracion, dias, modalidad: c.modalidad, cantidad: cantidad as number, venceEn, idempotencia };
}

function loteDesdeDoc(d: Datos): LoteCupones {
  return {
    id: texto(d.id),
    modalidad: d.modalidad === 'individuales' ? 'individuales' : 'compartido',
    cantidad: Number(d.cantidad) || 0,
    duracion: texto(d.duracion),
    dias: Number.isInteger(d.dias) ? (d.dias as number) : null,
    codigos: Array.isArray(d.codigos) ? d.codigos.filter((x): x is string => typeof x === 'string') : [],
    creadoEn: aIso(d.creadoEn) ?? '',
  };
}

export class CuponesService {
  constructor(
    private readonly db: FirestorePort,
    private readonly ahora: () => Date,
    private readonly generar: () => string = generarCodigo,
  ) {}

  /** Canje del miembro. Errores: no existe (404), inactivo / ya usado / agotado (409), vencido (410). */
  async canjear(uid: string, codigoCrudo: unknown): Promise<ResultadoCanjeCupon> {
    if (typeof codigoCrudo !== 'string' || !codigoCrudo.trim()) throw new ValidationError('Escribe el código del cupón.');
    const codigo = normalizarCodigo(codigoCrudo);
    if (!codigo) throw new CodedError(404, 'cupon/no-existe', 'Ese cupón no existe. Revisa que esté bien escrito.');
    const ahora = this.ahora();
    const ruta = rutaCupon(codigo);
    const rutaCanje = `${ruta}/canjes/${segmento(uid)}`;

    return this.db.runTransaction(async (tx) => {
      const [doc, canjePrevio] = [await tx.get(ruta), await tx.get(rutaCanje)];
      const d = doc.data();
      if (!doc.exists || !d) throw new CodedError(404, 'cupon/no-existe', 'Ese cupón no existe. Revisa que esté bien escrito.');
      if (d.activo === false) throw new CodedError(409, 'cupon/inactivo', 'Este cupón fue desactivado y ya no admite canjes.');
      const vence = aMillis(d.venceEn);
      if (Number.isFinite(vence) && vence <= ahora.getTime()) throw new CodedError(410, 'cupon/vencido', 'Este cupón ya venció.');
      if (canjePrevio.exists) throw new CodedError(409, 'cupon/ya-usado', 'Ya usaste este cupón con tu cuenta.');
      const usos = Math.max(0, Number(d.usos) || 0);
      const maxUsos = Math.max(0, Number(d.maxUsos) || 0);
      if (usos >= maxUsos) throw new CodedError(409, 'cupon/agotado', 'Este cupón ya se agotó.');
      const dias = d.dias;
      if (!diasVipValidos(dias)) throw new CodedError(409, 'cupon/invalido', 'Este cupón está mal configurado. Avísale a Dermalysse.');

      const vip = await otorgarDiasVipEnTx(tx, { uid, dias, fuente: 'cupon', referencia: codigo }, ahora, `cupon_${codigo}_${segmento(uid)}`);
      tx.set(rutaCanje, { uid, fecha: ahora.toISOString(), dias, vigenciaHasta: vip.vigenciaHasta });
      tx.set(ruta, { usos: usos + 1, ultimoCanje: ahora.toISOString() }, { merge: true });
      return { ok: true as const, codigo, dias, hasta: vip.vigenciaHasta, regaloDesde: vip.regaloDesde };
    });
  }

  async listar(): Promise<CuponAdmin[]> {
    const docs = await this.db.query(COLECCION_CUPONES);
    return docs
      .map((d) => cuponDesdeDoc(d.id, d.data() ?? {}))
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn) || a.codigo.localeCompare(b.codigo));
  }

  /**
   * Genera un lote: «compartido» = 1 código con `cantidad` usos; «individuales» = `cantidad` códigos de 1 uso.
   * Con la misma `idempotencia` devuelve el lote ya creado (reintentos del formulario sin duplicar códigos).
   */
  async crearLote(cuerpo: unknown, adminUid: string): Promise<LoteCupones> {
    const ahora = this.ahora();
    const e = validarLote(cuerpo, ahora);
    const id = e.idempotencia ?? randomUUID();
    const rutaLote = `${COLECCION_LOTES_CUPONES}/${segmento(id)}`;
    const nCodigos = e.modalidad === 'compartido' ? 1 : e.cantidad;
    const maxUsos = e.modalidad === 'compartido' ? e.cantidad : 1;

    return this.db.runTransaction(async (tx) => {
      const previo = (await tx.get(rutaLote)).data();
      if (previo) {
        if (texto(previo.creadoPor) !== adminUid) throw new CodedError(409, 'cupon/lote-duplicado', 'Ese identificador de lote ya existe.');
        return loteDesdeDoc(previo);
      }
      // Todas las lecturas (colisiones de código) antes de cualquier escritura.
      const codigos: string[] = [];
      for (let i = 0; i < nCodigos; i++) {
        let codigo = '';
        for (let intento = 0; intento < 8 && !codigo; intento++) {
          const candidato = this.generar();
          if (codigos.includes(candidato)) continue;
          if (!(await tx.get(rutaCupon(candidato))).exists) codigo = candidato;
        }
        if (!codigo) throw new Error('No se pudo generar un código de cupón único.');
        codigos.push(codigo);
      }
      const creadoEn = ahora.toISOString();
      for (const codigo of codigos) {
        tx.set(rutaCupon(codigo), {
          codigo, loteId: id, duracion: e.duracion, dias: e.dias, maxUsos, usos: 0, activo: true,
          venceEn: e.venceEn, creadoEn, creadoPor: adminUid,
        });
      }
      const lote: LoteCupones = { id, modalidad: e.modalidad, cantidad: e.cantidad, duracion: e.duracion, dias: e.dias, codigos, creadoEn };
      tx.set(rutaLote, { ...lote, creadoPor: adminUid, venceEn: e.venceEn });
      return lote;
    });
  }

  /** Activa o desactiva un cupón (los accesos ya otorgados siguen vigentes). */
  async cambiarActivo(codigoCrudo: string, cuerpo: unknown): Promise<CuponAdmin> {
    const activo = (cuerpo as { activo?: unknown } | null)?.activo;
    if (typeof activo !== 'boolean') throw new ValidationError('activo debe ser true o false.');
    const codigo = normalizarCodigo(codigoCrudo);
    if (!codigo) throw new NotFoundError('Ese cupón no existe.');
    const ruta = rutaCupon(codigo);
    return this.db.runTransaction(async (tx) => {
      const d = (await tx.get(ruta)).data();
      if (!d) throw new NotFoundError('Ese cupón no existe.');
      tx.set(ruta, { activo, actualizadoEn: this.ahora().toISOString() }, { merge: true });
      return cuponDesdeDoc(codigo, { ...d, activo });
    });
  }
}
