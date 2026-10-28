import type { Usuario } from '../domain/types.js';
import { aIso, texto, type Datos, type FirestorePort, type Transaccion } from '../adapters/firestore/port.js';
import { segmento } from '../adapters/firestore/v2.js';
import { CodedError } from './errors.js';
import { normalizarCodigo } from './cupones.js';
import { COLECCION_BENEFICIOS, COLECCION_MOVIMIENTOS, COLECCION_PUNTOS } from './puntos.js';
import { otorgarDiasVipEnTx } from './vip.js';

export const COLECCION_CAMPANAS = 'v2_campanas';
export const COLECCION_CODIGOS_CAMPANA = 'v2_campanas_codigos';
export const COLECCION_CANJES_CAMPANA = 'v2_campanas_canjes';
export const COLECCION_PREFERENCIAS_CAMPANA = 'v2_campanas_preferencias';
export const CAMPANA_BIENVENIDA_ID = 'bienvenida-dermalysse-50';
export const CODIGO_BIENVENIDA_PRUEBA = 'TEST-DERMALYSSE-50';
const DIA_MS = 86_400_000;

export type EstadoCampana = 'activa' | 'pausada' | 'agotada' | 'terminada';

export interface BeneficioManualCampana {
  id: string;
  nombre: string;
  descripcion: string;
  instrucciones: string;
  responsable: string;
}

export interface BeneficiosCampana {
  diamantes: number;
  vipDias: number;
  materiales: { id: string; nombre: string }[];
  manuales: BeneficioManualCampana[];
}

interface CampanaGuardada {
  id: string;
  nombre: string;
  descripcion: string;
  codigo: string;
  cupoTotal: number;
  solicitudes: number;
  emitidos: number;
  activados: number;
  inicio: string;
  fin: string;
  estado: 'activa' | 'pausada' | 'terminada';
  beneficios: BeneficiosCampana;
  creadoEn: string;
  actualizadoEn: string;
  creadoPor: string;
}

interface ManualCanjeado extends BeneficioManualCampana {
  estado: 'pendiente' | 'entregado' | 'cancelado';
  entregadoEn: string | null;
  entregadoPor: string | null;
}

export interface CanjeCampana {
  id: string;
  campanaId: string;
  uid: string;
  codigo: string;
  estado: 'pendiente' | 'entregado' | 'cancelado';
  solicitadoEn: string;
  emitidoEn: string | null;
  activadoEn: string | null;
  beneficios: BeneficiosCampana;
  manuales: ManualCanjeado[];
}

export type CanjeCampanaPublico = Omit<CanjeCampana, 'uid' | 'codigo'>;

export interface CampanaMiembro {
  id: string;
  nombre: string;
  descripcion: string;
  estado: EstadoCampana;
  cupoTotal: number;
  lugaresRestantes: number;
  inicio: string;
  fin: string;
  beneficios: BeneficiosCampana;
  canje: CanjeCampanaPublico | null;
  pospuestaHasta: string | null;
  debeMostrar: boolean;
}

export interface CampanaAdmin extends Omit<CampanaMiembro, 'canje' | 'pospuestaHasta' | 'debeMostrar'> {
  codigo: string;
  solicitudes: number;
  emitidos: number;
  activados: number;
  pendientes: number;
  creadoEn: string;
  actualizadoEn: string;
  grafica: { fecha: string; solicitudes: number; emisiones: number; activaciones: number }[];
  entregasPendientes: { uid: string; referencia: string; solicitadoEn: string; beneficios: string[] }[];
}

const beneficiosIniciales: BeneficiosCampana = {
  diamantes: 750,
  vipDias: 7,
  materiales: [
    { id: 'p-1784228079707', nombre: 'Regulación cosmética' },
    { id: 'p-1784228150217', nombre: 'Estudios de estabilidad cosmética' },
  ],
  manuales: [],
};

const INICIAL_BASE: Omit<CampanaGuardada, 'codigo'> = {
  id: CAMPANA_BIENVENIDA_ID,
  nombre: 'Bienvenida Dermalysse · Primera Edición',
  descripcion: 'Un paquete digital de bienvenida para las primeras 50 cuentas que canjeen el código oficial.',
  cupoTotal: 50,
  solicitudes: 0,
  emitidos: 0,
  activados: 0,
  inicio: '2026-10-28T06:00:00.000Z',
  fin: '2027-01-01T05:59:59.999Z',
  estado: 'activa',
  beneficios: beneficiosIniciales,
  creadoEn: '2026-10-28T06:00:00.000Z',
  actualizadoEn: '2026-10-28T06:00:00.000Z',
  creadoPor: 'sistema',
};

const rutaCampana = (id: string) => `${COLECCION_CAMPANAS}/${segmento(id)}`;
const rutaCodigo = (codigo: string) => `${COLECCION_CODIGOS_CAMPANA}/${segmento(codigo)}`;
const idCanje = (campanaId: string, uid: string) => segmento(`${campanaId}__${uid}`);
const rutaCanje = (campanaId: string, uid: string) => `${COLECCION_CANJES_CAMPANA}/${idCanje(campanaId, uid)}`;
const rutaPreferencia = (campanaId: string, uid: string) => `${COLECCION_PREFERENCIAS_CAMPANA}/${idCanje(campanaId, uid)}`;

function entero(valor: unknown, minimo: number, maximo: number, mensaje: string): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < minimo || n > maximo) throw new CodedError(400, 'campana/validacion', mensaje);
  return n;
}

function iso(valor: unknown, campo: string): string {
  const fecha = aIso(valor);
  if (!fecha) throw new CodedError(400, 'campana/validacion', `La fecha de ${campo} no es válida.`);
  return fecha;
}

function estadoActual(c: CampanaGuardada, ahora: Date): EstadoCampana {
  if (c.estado === 'pausada') return 'pausada';
  if (c.estado === 'terminada' || ahora.getTime() > Date.parse(c.fin)) return 'terminada';
  if (c.solicitudes >= c.cupoTotal) return 'agotada';
  if (ahora.getTime() < Date.parse(c.inicio)) return 'pausada';
  return 'activa';
}

function campanaDesde(datos: Datos | undefined): CampanaGuardada | null {
  if (!datos || typeof datos.id !== 'string' || typeof datos.codigo !== 'string' || typeof datos.nombre !== 'string') return null;
  const beneficios = datos.beneficios as BeneficiosCampana | undefined;
  if (!beneficios || !Array.isArray(beneficios.materiales) || !Array.isArray(beneficios.manuales)) return null;
  return datos as unknown as CampanaGuardada;
}

function canjeDesde(datos: Datos | undefined): CanjeCampana | null {
  if (!datos || typeof datos.id !== 'string' || typeof datos.uid !== 'string' || !Array.isArray(datos.manuales)) return null;
  return datos as unknown as CanjeCampana;
}

function publico(c: CampanaGuardada, canje: CanjeCampana | null, pospuestaHasta: string | null, ahora: Date): CampanaMiembro {
  const estado = estadoActual(c, ahora);
  const pospuesta = pospuestaHasta ? Date.parse(pospuestaHasta) > ahora.getTime() : false;
  const canjePublico = canje ? (() => {
    const { uid: _uid, codigo: _codigo, ...seguro } = canje;
    return seguro;
  })() : null;
  return {
    id: c.id,
    nombre: c.nombre,
    descripcion: c.descripcion,
    estado,
    cupoTotal: c.cupoTotal,
    lugaresRestantes: Math.max(0, c.cupoTotal - c.solicitudes),
    inicio: c.inicio,
    fin: c.fin,
    beneficios: c.beneficios,
    canje: canjePublico,
    pospuestaHasta,
    debeMostrar: estado === 'activa' && !canje && !pospuesta,
  };
}

function basePuntos(uid: string, datos: Datos | undefined): Datos {
  return {
    uid,
    saldo: Math.max(0, Number(datos?.saldo) || 0),
    experiencia: Math.max(0, Number(datos?.experiencia) || 0),
    ganados: Math.max(0, Number(datos?.ganados) || 0),
    gastados: Math.max(0, Number(datos?.gastados) || 0),
    canjes: Math.max(0, Number(datos?.canjes) || 0),
    acreditado: datos?.acreditado && typeof datos.acreditado === 'object' ? datos.acreditado : { clases: 0, cursos: 0, certificados: 0, puntosRetos: 0, rachaRetos: 0 },
    vipDiasPorAnio: datos?.vipDiasPorAnio && typeof datos.vipDiasPorAnio === 'object' ? datos.vipDiasPorAnio : {},
  };
}

function normalizarManuales(valor: unknown): BeneficioManualCampana[] {
  if (valor === undefined) return [];
  if (!Array.isArray(valor) || valor.length > 5) throw new CodedError(400, 'campana/validacion', 'Los beneficios manuales deben ser una lista de hasta cinco elementos.');
  return valor.map((item, indice) => {
    const v = item as Record<string, unknown>;
    const id = texto(v?.id).trim() || `manual-${indice + 1}`;
    const nombre = texto(v?.nombre).trim();
    const descripcion = texto(v?.descripcion).trim();
    const instrucciones = texto(v?.instrucciones).trim();
    const responsable = texto(v?.responsable).trim();
    if (!nombre || !descripcion || !instrucciones || !responsable) throw new CodedError(400, 'campana/validacion', 'Cada entrega manual necesita nombre, descripción, instrucciones y responsable.');
    return { id: segmento(id), nombre: nombre.slice(0, 120), descripcion: descripcion.slice(0, 300), instrucciones: instrucciones.slice(0, 400), responsable: responsable.slice(0, 120) };
  });
}

async function validarMateriales(db: FirestorePort, ids: string[]): Promise<{ id: string; nombre: string }[]> {
  const unicos = [...new Set(ids.map((id) => segmento(id)))];
  if (unicos.length > 5) throw new CodedError(400, 'campana/validacion', 'Una campaña admite hasta cinco materiales.');
  const docs = await Promise.all(unicos.map((id) => db.get(`pdfs/${id}`)));
  return docs.map((doc, indice) => {
    const d = doc.data() ?? {};
    if (!doc.exists || !texto(d.drive).trim() || ['oculto', 'proximamente'].includes(texto(d.estado))) {
      throw new CodedError(409, 'campana/beneficio-no-disponible', `El material ${unicos[indice]} no está disponible para entrega.`);
    }
    return { id: unicos[indice], nombre: texto(d.name).trim() || texto(d.titulo).trim() || unicos[indice] };
  });
}

function formularioCampana(cuerpo: unknown): Omit<CampanaGuardada, 'id' | 'solicitudes' | 'emitidos' | 'activados' | 'creadoEn' | 'actualizadoEn' | 'creadoPor'> & { materialIds: string[] } {
  const v = (typeof cuerpo === 'object' && cuerpo !== null && !Array.isArray(cuerpo) ? cuerpo : {}) as Record<string, unknown>;
  const nombre = texto(v.nombre).trim();
  const descripcion = texto(v.descripcion).trim();
  const codigo = normalizarCodigo(v.codigo);
  const inicio = iso(v.inicio, 'inicio');
  const fin = iso(v.fin, 'fin');
  if (!nombre || nombre.length > 120 || !descripcion || descripcion.length > 500 || !codigo) throw new CodedError(400, 'campana/validacion', 'Completa nombre, descripción y un código válido.');
  if (Date.parse(fin) <= Date.parse(inicio)) throw new CodedError(400, 'campana/validacion', 'La fecha final debe ser posterior al inicio.');
  const diamantes = entero(v.diamantes ?? 0, 0, 10_000, 'Los Diamantes deben estar entre 0 y 10,000.');
  const vipDias = entero(v.vipDias ?? 0, 0, 30, 'Los días VIP deben estar entre 0 y 30.');
  const materialIds = Array.isArray(v.materialIds) ? v.materialIds.map(texto).map((id) => id.trim()).filter(Boolean) : [];
  const manuales = normalizarManuales(v.manuales);
  if (!diamantes && !vipDias && !materialIds.length && !manuales.length) throw new CodedError(400, 'campana/validacion', 'La campaña debe entregar al menos un beneficio real.');
  return {
    nombre,
    descripcion,
    codigo,
    cupoTotal: entero(v.cupoTotal, 1, 10_000, 'El cupo debe estar entre 1 y 10,000.'),
    inicio,
    fin,
    estado: v.estado === 'pausada' ? 'pausada' : 'activa',
    beneficios: { diamantes, vipDias, materiales: [], manuales },
    materialIds,
  };
}

export class CampanasService {
  private readonly codigoBienvenida: string;

  constructor(private readonly db: FirestorePort, private readonly ahora: () => Date, codigoBienvenida = CODIGO_BIENVENIDA_PRUEBA) {
    const normalizado = normalizarCodigo(codigoBienvenida);
    if (!normalizado) throw new Error('CAMPANA_BIENVENIDA_CODIGO no tiene un formato válido.');
    this.codigoBienvenida = normalizado;
  }

  private async asegurarInicial(): Promise<void> {
    const inicial: CampanaGuardada = { ...INICIAL_BASE, codigo: this.codigoBienvenida };
    await this.db.runTransaction(async (tx) => {
      const doc = await tx.get(rutaCampana(inicial.id));
      const existente = campanaDesde(doc.data());
      if (!existente) {
        tx.set(rutaCampana(inicial.id), inicial as unknown as Datos);
        tx.set(rutaCodigo(inicial.codigo), { codigo: inicial.codigo, campanaId: inicial.id, creadoEn: inicial.creadoEn });
        return;
      }
      if (existente.codigo !== inicial.codigo) {
        tx.set(rutaCampana(inicial.id), { codigo: inicial.codigo, actualizadoEn: this.ahora().toISOString() }, { merge: true });
        tx.set(rutaCodigo(inicial.codigo), { codigo: inicial.codigo, campanaId: inicial.id, creadoEn: this.ahora().toISOString() });
        if (existente.codigo) tx.delete(rutaCodigo(existente.codigo));
        return;
      }
      tx.set(rutaCodigo(inicial.codigo), { codigo: inicial.codigo, campanaId: inicial.id, creadoEn: inicial.creadoEn }, { merge: true });
    });
  }

  async bienvenida(uid: string): Promise<CampanaMiembro> {
    await this.asegurarInicial();
    const [campanaDoc, canjeDoc, preferenciaDoc] = await Promise.all([
      this.db.get(rutaCampana(CAMPANA_BIENVENIDA_ID)),
      this.db.get(rutaCanje(CAMPANA_BIENVENIDA_ID, uid)),
      this.db.get(rutaPreferencia(CAMPANA_BIENVENIDA_ID, uid)),
    ]);
    const campana = campanaDesde(campanaDoc.data());
    if (!campana) throw new CodedError(503, 'campana/no-disponible', 'La campaña no está disponible por ahora.');
    return publico(campana, canjeDesde(canjeDoc.data()), aIso(preferenciaDoc.data()?.pospuestaHasta), this.ahora());
  }

  async posponer(uid: string, campanaId: string): Promise<{ ok: true; pospuestaHasta: string }> {
    await this.asegurarInicial();
    const id = segmento(campanaId);
    const doc = await this.db.get(rutaCampana(id));
    if (!doc.exists) throw new CodedError(404, 'campana/no-existe', 'La campaña no existe.');
    const pospuestaHasta = new Date(this.ahora().getTime() + 7 * DIA_MS).toISOString();
    await this.db.set(rutaPreferencia(id, uid), { uid, campanaId: id, pospuestaHasta, actualizadoEn: this.ahora().toISOString() });
    return { ok: true, pospuestaHasta };
  }

  async canjear(uid: string, codigoDesconocido: unknown): Promise<{ ok: true; campana: CampanaMiembro }> {
    await this.asegurarInicial();
    const codigo = normalizarCodigo(codigoDesconocido);
    if (!codigo) throw new CodedError(400, 'campana/codigo-invalido', 'Escribe un código de campaña válido.');
    const indice = (await this.db.get(rutaCodigo(codigo))).data();
    const campanaId = texto(indice?.campanaId);
    if (!campanaId) throw new CodedError(404, 'campana/codigo-no-existe', 'El código no corresponde a una campaña vigente.');
    const ahora = this.ahora();
    const resultado = await this.db.runTransaction(async (tx) => {
      const campanaDoc = await tx.get(rutaCampana(campanaId));
      const c = campanaDesde(campanaDoc.data());
      if (!c || c.codigo !== codigo) throw new CodedError(404, 'campana/codigo-no-existe', 'El código no corresponde a una campaña vigente.');
      const canjeDoc = await tx.get(rutaCanje(c.id, uid));
      if (canjeDoc.exists) throw new CodedError(409, 'campana/ya-canjeada', 'Esta cuenta ya recibió el beneficio de la campaña.');
      const estado = estadoActual(c, ahora);
      if (estado === 'pausada') throw new CodedError(409, 'campana/pausada', 'La campaña está pausada por ahora.');
      if (estado === 'agotada') throw new CodedError(409, 'campana/agotada', 'El cupo de esta campaña ya se agotó.');
      if (estado === 'terminada') throw new CodedError(410, 'campana/terminada', 'La campaña ya terminó.');

      const puntosRuta = `${COLECCION_PUNTOS}/${segmento(uid)}`;
      const puntosDoc = await tx.get(puntosRuta);
      const materiales: { id: string; nombre: string; datos: Datos }[] = [];
      for (const material of c.beneficios.materiales) {
        const doc = await tx.get(`pdfs/${segmento(material.id)}`);
        const datos = doc.data() ?? {};
        if (!doc.exists || !texto(datos.drive).trim() || ['oculto', 'proximamente'].includes(texto(datos.estado))) {
          throw new CodedError(409, 'campana/beneficio-no-disponible', 'Uno de los materiales de la campaña dejó de estar disponible. No se consumió el cupo.');
        }
        materiales.push({ id: material.id, nombre: texto(datos.name).trim() || material.nombre, datos });
      }

      let vip: { vigenciaHasta: string; regaloDesde: string; dias: number } | null = null;
      if (c.beneficios.vipDias > 0) {
        vip = await otorgarDiasVipEnTx(tx, {
          uid,
          dias: c.beneficios.vipDias,
          fuente: 'bienvenida',
          referencia: `${c.id} · ${c.nombre}`,
        }, ahora, `campana_${idCanje(c.id, uid)}`);
      }

      const puntos = basePuntos(uid, puntosDoc.data());
      const diamantes = c.beneficios.diamantes;
      if (diamantes > 0) {
        puntos.saldo = Number(puntos.saldo) + diamantes;
        puntos.ganados = Number(puntos.ganados) + diamantes;
        puntos.actualizado = ahora.toISOString();
        tx.set(puntosRuta, puntos, { merge: true });
        tx.set(`${COLECCION_MOVIMIENTOS}/${segmento(`${uid}__campana__${c.id}`)}`, {
          id: `${uid}__campana__${c.id}`,
          uid,
          tipo: 'ganado',
          puntos: diamantes,
          concepto: c.nombre,
          detalle: `Beneficio de campaña · ${diamantes} Diamantes Dermalysse`,
          fecha: ahora.toISOString(),
          origen: 'campana',
          origenId: c.id,
        });
      }
      for (const material of materiales) {
        tx.set(`${COLECCION_BENEFICIOS}/${segmento(`${uid}__${material.id}`)}`, {
          uid,
          materialId: material.id,
          nombre: material.nombre,
          origen: 'campana',
          origenId: c.id,
          otorgadoEn: ahora.toISOString(),
        });
      }
      const manuales: ManualCanjeado[] = c.beneficios.manuales.map((m) => ({ ...m, estado: 'pendiente', entregadoEn: null, entregadoPor: null }));
      const automatico = diamantes > 0 || c.beneficios.vipDias > 0 || materiales.length > 0;
      const activado = manuales.length === 0;
      const canje: CanjeCampana = {
        id: idCanje(c.id, uid),
        campanaId: c.id,
        uid,
        codigo,
        estado: activado ? 'entregado' : 'pendiente',
        solicitadoEn: ahora.toISOString(),
        emitidoEn: automatico ? ahora.toISOString() : null,
        activadoEn: activado ? ahora.toISOString() : null,
        beneficios: { ...c.beneficios, materiales: materiales.map(({ id, nombre }) => ({ id, nombre })) },
        manuales,
      };
      tx.set(rutaCanje(c.id, uid), canje as unknown as Datos);
      tx.set(rutaCampana(c.id), {
        solicitudes: c.solicitudes + 1,
        emitidos: c.emitidos + (automatico ? 1 : 0),
        activados: c.activados + (activado ? 1 : 0),
        actualizadoEn: ahora.toISOString(),
      }, { merge: true });
      tx.delete(rutaPreferencia(c.id, uid));
      return { c, canje, vip, automatico, activado };
    });
    const actualizado = {
      ...resultado.c,
      solicitudes: resultado.c.solicitudes + 1,
      emitidos: resultado.c.emitidos + (resultado.automatico ? 1 : 0),
      activados: resultado.c.activados + (resultado.activado ? 1 : 0),
    };
    return { ok: true, campana: publico(actualizado, resultado.canje, null, ahora) };
  }

  async adminListar(): Promise<CampanaAdmin[]> {
    await this.asegurarInicial();
    const [campanas, canjes] = await Promise.all([
      this.db.query(COLECCION_CAMPANAS, { limit: 100 }),
      this.db.query(COLECCION_CANJES_CAMPANA, { limit: 5000 }),
    ]);
    const ahora = this.ahora();
    return campanas.map((doc) => campanaDesde(doc.data())).filter((c): c is CampanaGuardada => !!c).map((c) => {
      const propios = canjes.map((d) => canjeDesde(d.data())).filter((x): x is CanjeCampana => !!x && x.campanaId === c.id);
      const dias = new Map<string, { fecha: string; solicitudes: number; emisiones: number; activaciones: number }>();
      const fila = (fecha: string) => {
        const clave = fecha.slice(0, 10);
        const actual = dias.get(clave) ?? { fecha: clave, solicitudes: 0, emisiones: 0, activaciones: 0 };
        dias.set(clave, actual);
        return actual;
      };
      for (const canje of propios) {
        fila(canje.solicitadoEn).solicitudes++;
        if (canje.emitidoEn) fila(canje.emitidoEn).emisiones++;
        if (canje.activadoEn) fila(canje.activadoEn).activaciones++;
      }
      return {
        ...publico(c, null, null, ahora),
        codigo: c.codigo,
        solicitudes: c.solicitudes,
        emitidos: c.emitidos,
        activados: c.activados,
        pendientes: propios.filter((x) => x.estado === 'pendiente').length,
        creadoEn: c.creadoEn,
        actualizadoEn: c.actualizadoEn,
        grafica: [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-30),
        entregasPendientes: propios.filter((x) => x.estado === 'pendiente').map((x) => ({
          uid: x.uid,
          referencia: `…${x.uid.slice(-6)}`,
          solicitadoEn: x.solicitadoEn,
          beneficios: x.manuales.filter((m) => m.estado === 'pendiente').map((m) => m.nombre),
        })),
      };
    }).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  }

  async adminCrear(admin: Usuario, cuerpo: unknown): Promise<CampanaAdmin> {
    const entrada = formularioCampana(cuerpo);
    const materiales = await validarMateriales(this.db, entrada.materialIds);
    const ahora = this.ahora().toISOString();
    const baseId = texto((cuerpo as Record<string, unknown>)?.id).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || entrada.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = segmento(`${baseId.slice(0, 80) || 'campana'}-${this.ahora().getTime().toString(36)}`);
    const c: CampanaGuardada = {
      id,
      nombre: entrada.nombre,
      descripcion: entrada.descripcion,
      codigo: entrada.codigo,
      cupoTotal: entrada.cupoTotal,
      solicitudes: 0,
      emitidos: 0,
      activados: 0,
      inicio: entrada.inicio,
      fin: entrada.fin,
      estado: entrada.estado,
      beneficios: { ...entrada.beneficios, materiales },
      creadoEn: ahora,
      actualizadoEn: ahora,
      creadoPor: admin.uid,
    };
    await this.db.runTransaction(async (tx) => {
      const existente = await tx.get(rutaCodigo(c.codigo));
      if (existente.exists) throw new CodedError(409, 'campana/codigo-duplicado', 'Ese código ya pertenece a otra campaña.');
      tx.set(rutaCampana(c.id), c as unknown as Datos);
      tx.set(rutaCodigo(c.codigo), { codigo: c.codigo, campanaId: c.id, creadoEn: ahora });
    });
    return (await this.adminListar()).find((x) => x.id === c.id)!;
  }

  async adminActualizar(campanaId: string, cuerpo: unknown): Promise<CampanaAdmin> {
    await this.asegurarInicial();
    const id = segmento(campanaId);
    const v = (typeof cuerpo === 'object' && cuerpo !== null && !Array.isArray(cuerpo) ? cuerpo : {}) as Record<string, unknown>;
    const actualDoc = await this.db.get(rutaCampana(id));
    const actual = campanaDesde(actualDoc.data());
    if (!actual) throw new CodedError(404, 'campana/no-existe', 'La campaña no existe.');
    const cambios: Datos = { actualizadoEn: this.ahora().toISOString() };
    if (v.estado !== undefined) {
      if (!['activa', 'pausada', 'terminada'].includes(String(v.estado))) throw new CodedError(400, 'campana/validacion', 'Estado de campaña no válido.');
      cambios.estado = v.estado;
    }
    if (v.cupoTotal !== undefined) {
      const cupo = entero(v.cupoTotal, 1, 10_000, 'El cupo debe estar entre 1 y 10,000.');
      if (cupo < actual.solicitudes) throw new CodedError(409, 'campana/cupo-invalido', 'El cupo no puede ser menor que los beneficios ya emitidos.');
      cambios.cupoTotal = cupo;
    }
    if (v.inicio !== undefined) cambios.inicio = iso(v.inicio, 'inicio');
    if (v.fin !== undefined) cambios.fin = iso(v.fin, 'fin');
    const inicio = String(cambios.inicio ?? actual.inicio);
    const fin = String(cambios.fin ?? actual.fin);
    if (Date.parse(fin) <= Date.parse(inicio)) throw new CodedError(400, 'campana/validacion', 'La fecha final debe ser posterior al inicio.');
    await this.db.set(rutaCampana(id), cambios, { merge: true });
    return (await this.adminListar()).find((x) => x.id === id)!;
  }

  async adminCompletarEntrega(admin: Usuario, campanaId: string, uidCrudo: string): Promise<CanjeCampana> {
    const campana = segmento(campanaId);
    const uid = segmento(uidCrudo);
    const ahora = this.ahora().toISOString();
    return this.db.runTransaction(async (tx: Transaccion) => {
      const campanaDoc = await tx.get(rutaCampana(campana));
      const c = campanaDesde(campanaDoc.data());
      const canjeDoc = await tx.get(rutaCanje(campana, uid));
      const canje = canjeDesde(canjeDoc.data());
      if (!c || !canje) throw new CodedError(404, 'campana/solicitud-no-existe', 'La solicitud no existe.');
      if (canje.estado !== 'pendiente') return canje;
      const manuales = canje.manuales.map((m) => m.estado === 'pendiente' ? { ...m, estado: 'entregado' as const, entregadoEn: ahora, entregadoPor: admin.uid } : m);
      const siguiente: CanjeCampana = { ...canje, manuales, estado: 'entregado', activadoEn: ahora, emitidoEn: canje.emitidoEn ?? ahora };
      tx.set(rutaCanje(campana, uid), siguiente as unknown as Datos);
      tx.set(rutaCampana(campana), { activados: c.activados + 1, emitidos: c.emitidos + (canje.emitidoEn ? 0 : 1), actualizadoEn: ahora }, { merge: true });
      return siguiente;
    });
  }
}
