// Puntos Dermalysse: saldo canjeable y experiencia acumulada, ambos calculados por el servidor.
// Fuentes confiables en esta primera versión:
//  - clases y cursos acreditados por el webhook legado;
//  - certificados válidos emitidos por el servidor;
//  - XP de Retos, cuyo motor califica y limita las operaciones en la API.
//
// El saldo se puede gastar; la experiencia nunca disminuye y determina el nivel. Historia y foro
// quedan fuera del saldo hasta tener validación autoritativa/antispam. Los materiales canjeados se
// guardan como derechos permanentes en v2_beneficios y se verifican al pedir el enlace protegido.
import type { Datos, FirestorePort } from '../adapters/firestore/port.js';
import { texto } from '../adapters/firestore/port.js';
import { segmento } from '../adapters/firestore/v2.js';
import { leerMetricasVip } from '../adapters/firestore/metricasVip.js';
import { CodedError, NotFoundError } from './errors.js';
import { otorgarDiasVipEnTx } from './vip.js';

export const COLECCION_PUNTOS = 'v2_puntos';
export const COLECCION_MOVIMIENTOS = 'v2_puntos_movimientos';
export const COLECCION_CANJES_PUNTOS = 'v2_puntos_canjes';
export const COLECCION_BENEFICIOS = 'v2_beneficios';

const PUNTOS_POR_CLASE = 10;
const PUNTOS_POR_CURSO = 100;
const PUNTOS_POR_CERTIFICADO = 50;
const XP_RETO_POR_PUNTO = 2;
const MAX_DIAS_VIP_ANIO = 30;

export interface NivelPuntos {
  id: 'descubrimiento' | 'constancia' | 'criterio' | 'circulo' | 'curaduria' | 'legado';
  nombre: string;
  desde: number;
  siguiente: number | null;
  descripcion: string;
}

const NIVELES: readonly Omit<NivelPuntos, 'siguiente'>[] = [
  { id: 'descubrimiento', nombre: 'Descubrimiento', desde: 0, descripcion: 'Comienza tu ruta y descubre la biblioteca Dermalysse.' },
  { id: 'constancia', nombre: 'Constancia', desde: 300, descripcion: 'Reconoce un ritmo de aprendizaje sostenido.' },
  { id: 'criterio', nombre: 'Criterio', desde: 900, descripcion: 'Distingue una trayectoria formativa sólida dentro del club.' },
  { id: 'circulo', nombre: 'Círculo Dermalysse', desde: 1800, descripcion: 'Distingue una participación avanzada en el ecosistema.' },
  { id: 'curaduria', nombre: 'Curaduría', desde: 3500, descripcion: 'Reconoce una trayectoria amplia de estudio, práctica y selección de recursos.' },
  { id: 'legado', nombre: 'Legado Dermalysse', desde: 6000, descripcion: 'El nivel de participación más alto del club.' },
] as const;

type FuenteHito = keyof Acreditado;

interface HitoCatalogo {
  id: string;
  nombre: string;
  descripcion: string;
  fuente: FuenteHito;
  meta: number;
  premio: number;
  icono: string;
  rareza: 'esencial' | 'distinguido' | 'elite';
}

/** Bonos vitalicios, automáticos e idempotentes sobre métricas acreditadas por servidor. */
const HITOS: readonly HitoCatalogo[] = [
  { id: 'primera-clase', nombre: 'Primer ritual', descripcion: 'Acredita tu primera clase.', fuente: 'clases', meta: 1, premio: 25, icono: 'sparkles', rareza: 'esencial' },
  { id: 'cinco-clases', nombre: 'Impulso inicial', descripcion: 'Acredita 5 clases.', fuente: 'clases', meta: 5, premio: 50, icono: 'play-circle', rareza: 'esencial' },
  { id: 'quince-clases', nombre: 'Ritmo de estudio', descripcion: 'Acredita 15 clases.', fuente: 'clases', meta: 15, premio: 100, icono: 'flame', rareza: 'distinguido' },
  { id: 'treinta-clases', nombre: 'Disciplina editorial', descripcion: 'Acredita 30 clases.', fuente: 'clases', meta: 30, premio: 200, icono: 'library-big', rareza: 'elite' },
  { id: 'primer-curso', nombre: 'Ruta completa', descripcion: 'Completa tu primer curso.', fuente: 'cursos', meta: 1, premio: 125, icono: 'book-check', rareza: 'esencial' },
  { id: 'tres-cursos', nombre: 'Trilogía de aprendizaje', descripcion: 'Completa 3 cursos.', fuente: 'cursos', meta: 3, premio: 300, icono: 'layers-3', rareza: 'distinguido' },
  { id: 'cinco-cursos', nombre: 'Colección de conocimiento', descripcion: 'Completa 5 cursos.', fuente: 'cursos', meta: 5, premio: 500, icono: 'trophy', rareza: 'elite' },
  { id: 'primer-certificado', nombre: 'Primera constancia', descripcion: 'Obtén tu primer certificado válido.', fuente: 'certificados', meta: 1, premio: 100, icono: 'award', rareza: 'distinguido' },
  { id: 'tres-certificados', nombre: 'Trayectoria documentada', descripcion: 'Obtén 3 certificados válidos.', fuente: 'certificados', meta: 3, premio: 250, icono: 'badge-check', rareza: 'elite' },
  { id: 'retos-50', nombre: 'Mente en práctica', descripcion: 'Convierte 100 XP verificados de Retos.', fuente: 'puntosRetos', meta: 50, premio: 50, icono: 'brain-circuit', rareza: 'esencial' },
  { id: 'retos-250', nombre: 'Dominio aplicado', descripcion: 'Convierte 500 XP verificados de Retos.', fuente: 'puntosRetos', meta: 250, premio: 250, icono: 'gamepad-2', rareza: 'elite' },
] as const;

export interface BeneficioCatalogo {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: 'material' | 'vip';
  costo: number;
  icono: string;
  destacado?: boolean;
  materialId?: string;
  diasVip?: number;
}

/** Solo beneficios cuyo efecto puede cumplirse hoy por la API; no hay premios decorativos. */
export const CATALOGO_BENEFICIOS: readonly BeneficioCatalogo[] = [
  { id: 'material-regulacion-cosmetica', nombre: 'Guía de regulación cosmética', descripcion: 'Acceso permanente al documento disponible en la biblioteca.', categoria: 'material', costo: 200, icono: 'scale', materialId: 'p-1784228079707' },
  { id: 'material-estudios-estabilidad', nombre: 'Estudios de estabilidad cosmética', descripcion: 'Acceso permanente a la guía técnica de estabilidad.', categoria: 'material', costo: 260, icono: 'flask-conical', materialId: 'p-1784228150217' },
  { id: 'material-nutricion-prevencion', nombre: 'Manual de nutrición y prevención', descripcion: 'Acceso permanente al manual de 80 páginas.', categoria: 'material', costo: 450, icono: 'book-open', materialId: 'p-1784234741400', destacado: true },
  { id: 'material-rejuvenecimiento-guia', nombre: 'Guía de rejuvenecimiento facial', descripcion: 'Acceso permanente a la guía educativa disponible.', categoria: 'material', costo: 380, icono: 'sparkles', materialId: 'p-1781110394428' },
  { id: 'material-rejuvenecimiento-manual', nombre: 'Manual de técnicas avanzadas', descripcion: 'Acceso permanente al manual profesional de la biblioteca.', categoria: 'material', costo: 520, icono: 'notebook-tabs', materialId: 'p-1781111073624' },
  { id: 'material-rejuvenecimiento-cuadernillo', nombre: 'Cuadernillo de técnicas avanzadas', descripcion: 'Acceso permanente al cuadernillo complementario.', categoria: 'material', costo: 320, icono: 'clipboard-check', materialId: 'p-1781111152335' },
  { id: 'material-tecnologias-cosmiatria', nombre: 'Tecnologías avanzadas en cosmiatría', descripcion: 'Acceso permanente al PDF de 62 páginas.', categoria: 'material', costo: 560, icono: 'scan-face', materialId: 'p-1778099917040', destacado: true },
  { id: 'material-radiofrecuencia', nombre: 'Radiofrecuencia y ultracavitación', descripcion: 'Acceso permanente al material educativo.', categoria: 'material', costo: 340, icono: 'radio-tower', materialId: 'p-1778099998280' },
  { id: 'material-dermapen', nombre: 'Dermapen · material educativo', descripcion: 'Acceso permanente al PDF de 57 páginas.', categoria: 'material', costo: 500, icono: 'file-text', materialId: 'p-1778100064887' },
  { id: 'vip-1-dia', nombre: 'Pase VIP de 24 horas', descripcion: 'Un día completo de acceso VIP para una sesión intensiva.', categoria: 'vip', costo: 350, icono: 'clock-3', diasVip: 1 },
  { id: 'vip-3-dias', nombre: '3 días VIP', descripcion: 'Desbloquea cursos, biblioteca y beneficios VIP durante 3 días.', categoria: 'vip', costo: 900, icono: 'crown', diasVip: 3 },
  { id: 'vip-7-dias', nombre: '7 días VIP', descripcion: 'Una semana completa de acceso VIP.', categoria: 'vip', costo: 1800, icono: 'gem', diasVip: 7, destacado: true },
  { id: 'vip-15-dias', nombre: '15 días VIP', descripcion: 'Quince días de acceso VIP para avanzar con mayor profundidad.', categoria: 'vip', costo: 3500, icono: 'badge-check', diasVip: 15 },
  { id: 'vip-30-dias', nombre: '30 días VIP', descripcion: 'Un mes completo de acceso VIP; utiliza el cupo anual disponible.', categoria: 'vip', costo: 6500, icono: 'calendar-heart', diasVip: 30, destacado: true },
] as const;

interface Acreditado { clases: number; cursos: number; certificados: number; puntosRetos: number }
interface ResumenGuardado {
  uid: string;
  saldo: number;
  experiencia: number;
  ganados: number;
  gastados: number;
  canjes: number;
  acreditado: Acreditado;
  hitos: string[];
  vipDiasPorAnio: Record<string, number>;
  actualizado: string;
}

export interface ResumenPuntos {
  saldo: number;
  experiencia: number;
  ganados: number;
  gastados: number;
  nivel: NivelPuntos;
  progresoNivel: number;
  puntosSiguienteNivel: number | null;
  reglas: { clases: number; cursos: number; certificados: number; retos: string };
  metricas: { clases: number; cursos: number; certificados: number; xpRetos: number };
}

export interface HitoPuntos {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  rareza: HitoCatalogo['rareza'];
  progreso: number;
  meta: number;
  porcentaje: number;
  premio: number;
  completado: boolean;
}

export interface ColeccionPuntos {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  progreso: number;
  meta: number;
  porcentaje: number;
  completado: boolean;
}

export interface ObjetivoPuntos {
  beneficioId: string;
  nombre: string;
  costo: number;
  faltan: number;
  porcentaje: number;
  clasesEquivalentes: number;
  cursosEquivalentes: number;
}

export interface MovimientoPuntos {
  id: string;
  tipo: 'ganado' | 'canje';
  puntos: number;
  concepto: string;
  detalle: string;
  fecha: string;
}

export interface BeneficioPublico extends BeneficioCatalogo {
  disponible: boolean;
  canjeado: boolean;
  puedeCanjear: boolean;
  motivo: string | null;
}

export interface CanjePuntos {
  id: string;
  beneficioId: string;
  nombre: string;
  categoria: 'material' | 'vip';
  costo: number;
  fecha: string;
  materialId: string | null;
  diasVip: number | null;
  vigenciaHasta: string | null;
}

export interface PanelPuntos {
  puntos: ResumenPuntos;
  boutique: BeneficioPublico[];
  movimientos: MovimientoPuntos[];
  canjes: CanjePuntos[];
  hitos: HitoPuntos[];
  colecciones: ColeccionPuntos[];
  objetivo: ObjetivoPuntos | null;
  vipAnual: { anio: number; usados: number; disponibles: number; limite: number };
  proximasFormasDeGanar: { nombre: string; estado: string; descripcion: string }[];
}

const entero = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
const mapa = (v: unknown): Datos => typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Datos : {};

function resumenDesdeDoc(uid: string, d: Datos | undefined): ResumenGuardado {
  const acreditado = mapa(d?.acreditado);
  const vip = mapa(d?.vipDiasPorAnio);
  return {
    uid,
    saldo: entero(d?.saldo), experiencia: entero(d?.experiencia), ganados: entero(d?.ganados), gastados: entero(d?.gastados), canjes: entero(d?.canjes),
    acreditado: { clases: entero(acreditado.clases), cursos: entero(acreditado.cursos), certificados: entero(acreditado.certificados), puntosRetos: entero(acreditado.puntosRetos) },
    hitos: Array.isArray(d?.hitos) ? [...new Set(d.hitos.map(texto).filter(Boolean))] : [],
    vipDiasPorAnio: Object.fromEntries(Object.entries(vip).filter(([k]) => /^\d{4}$/.test(k)).map(([k, v]) => [k, entero(v)])),
    actualizado: texto(d?.actualizado),
  };
}

export function nivelDe(experiencia: number): NivelPuntos {
  let i = 0;
  for (let n = 1; n < NIVELES.length; n += 1) if (experiencia >= NIVELES[n].desde) i = n;
  const actual = NIVELES[i];
  return { ...actual, siguiente: NIVELES[i + 1]?.desde ?? null };
}

function resumenPublico(d: ResumenGuardado): ResumenPuntos {
  const nivel = nivelDe(d.experiencia);
  const rango = nivel.siguiente === null ? 1 : nivel.siguiente - nivel.desde;
  return {
    saldo: d.saldo, experiencia: d.experiencia, ganados: d.ganados, gastados: d.gastados, nivel,
    progresoNivel: nivel.siguiente === null ? 100 : Math.min(100, Math.round(((d.experiencia - nivel.desde) / rango) * 100)),
    puntosSiguienteNivel: nivel.siguiente === null ? null : Math.max(0, nivel.siguiente - d.experiencia),
    reglas: { clases: PUNTOS_POR_CLASE, cursos: PUNTOS_POR_CURSO, certificados: PUNTOS_POR_CERTIFICADO, retos: `1 punto por cada ${XP_RETO_POR_PUNTO} XP verificados` },
    metricas: { clases: d.acreditado.clases, cursos: d.acreditado.cursos, certificados: d.acreditado.certificados, xpRetos: d.acreditado.puntosRetos * XP_RETO_POR_PUNTO },
  };
}

function hitosPublicos(d: ResumenGuardado): HitoPuntos[] {
  const completados = new Set(d.hitos);
  return HITOS.map((h) => {
    const progreso = Math.min(h.meta, d.acreditado[h.fuente]);
    return { ...h, progreso, porcentaje: Math.min(100, Math.round((progreso / h.meta) * 100)), completado: completados.has(h.id) };
  });
}

function coleccionesPublicas(materiales: number): ColeccionPuntos[] {
  const catalogo = [
    { id: 'primera-pieza', nombre: 'Primera pieza', descripcion: 'Tu primera obra permanente en la biblioteca.', icono: 'bookmark-check', meta: 1 },
    { id: 'biblioteca-profesional', nombre: 'Biblioteca profesional', descripcion: 'Una selección personal de 3 recursos.', icono: 'library', meta: 3 },
    { id: 'archivo-experto', nombre: 'Archivo experto', descripcion: 'Una colección avanzada de 6 recursos.', icono: 'library', meta: 6 },
    { id: 'coleccion-completa', nombre: 'Colección Dermalysse', descripcion: 'Los 9 materiales de la boutique en tu cuenta.', icono: 'gem', meta: 9 },
  ] as const;
  return catalogo.map((c) => ({ ...c, progreso: Math.min(c.meta, materiales), porcentaje: Math.min(100, Math.round((materiales / c.meta) * 100)), completado: materiales >= c.meta }));
}

const rutaResumen = (uid: string) => `${COLECCION_PUNTOS}/${segmento(uid)}`;
const idMovimiento = (uid: string, tipo: string, desde: number, hasta: number) => segmento(`${uid}__${tipo}__${desde + 1}-${hasta}`);

export class PuntosService {
  constructor(private readonly db: FirestorePort, private readonly ahora: () => Date) {}

  /** Reconcilia actividad histórica y nueva. Los contadores acreditados hacen la operación idempotente. */
  async sincronizar(uid: string): Promise<ResumenGuardado> {
    const metricas = await leerMetricasVip(this.db, uid);
    const objetivos: Acreditado = {
      clases: metricas.clasesVistas,
      cursos: metricas.cursosCompletados,
      certificados: metricas.certificados,
      puntosRetos: Math.floor(metricas.xpRetos / XP_RETO_POR_PUNTO),
    };
    const fecha = this.ahora().toISOString();
    return this.db.runTransaction(async (tx) => {
      const ruta = rutaResumen(uid);
      const documento = await tx.get(ruta);
      const previo = resumenDesdeDoc(uid, documento.data());
      const fuentes = [
        { k: 'clases' as const, nombre: 'Clases acreditadas', detalle: `${PUNTOS_POR_CLASE} puntos por clase`, factor: PUNTOS_POR_CLASE },
        { k: 'cursos' as const, nombre: 'Cursos completados', detalle: `${PUNTOS_POR_CURSO} puntos por curso`, factor: PUNTOS_POR_CURSO },
        { k: 'certificados' as const, nombre: 'Certificados obtenidos', detalle: `${PUNTOS_POR_CERTIFICADO} puntos por certificado válido`, factor: PUNTOS_POR_CERTIFICADO },
        { k: 'puntosRetos' as const, nombre: 'Práctica en Retos', detalle: `Conversión de XP verificado por servidor`, factor: 1 },
      ];
      let ganadosAhora = 0;
      const acreditado = { ...previo.acreditado };
      for (const f of fuentes) {
        const desde = acreditado[f.k];
        const hasta = Math.max(desde, objetivos[f.k]);
        const puntos = (hasta - desde) * f.factor;
        if (puntos > 0) {
          ganadosAhora += puntos;
          tx.set(`${COLECCION_MOVIMIENTOS}/${idMovimiento(uid, f.k, desde, hasta)}`, {
            uid, tipo: 'ganado', puntos, concepto: f.nombre, detalle: f.detalle, fecha,
            referencia: `${f.k}:${desde + 1}-${hasta}`,
          });
          acreditado[f.k] = hasta;
        }
      }
      const hitos = [...previo.hitos];
      for (const hito of HITOS) {
        if (hitos.includes(hito.id) || objetivos[hito.fuente] < hito.meta) continue;
        hitos.push(hito.id);
        ganadosAhora += hito.premio;
        tx.set(`${COLECCION_MOVIMIENTOS}/${segmento(`${uid}__hito__${hito.id}`)}`, {
          uid, tipo: 'ganado', puntos: hito.premio, concepto: `Bono de hito · ${hito.nombre}`,
          detalle: 'Premio vitalicio acreditado automáticamente', fecha, referencia: `hito:${hito.id}`,
        });
      }
      const nuevo: ResumenGuardado = {
        ...previo, acreditado, hitos,
        saldo: previo.saldo + ganadosAhora,
        experiencia: previo.experiencia + ganadosAhora,
        ganados: previo.ganados + ganadosAhora,
        actualizado: fecha,
      };
      if (ganadosAhora === 0 && documento.exists) return previo;
      tx.set(ruta, { ...nuevo });
      return nuevo;
    });
  }

  async tieneMaterial(uid: string, materialId: string): Promise<boolean> {
    const id = segmento(`${uid}__${materialId}`);
    return (await this.db.get(`${COLECCION_BENEFICIOS}/${id}`)).exists;
  }

  private async boutique(uid: string, saldo: number, vipDiasPorAnio: Record<string, number>): Promise<BeneficioPublico[]> {
    const derechos = await this.db.query(COLECCION_BENEFICIOS, { where: [{ campo: 'uid', op: '==', valor: uid }], limit: 200 });
    const materialesCanjeados = new Set(derechos.map((d) => texto(d.data()?.materialId)).filter(Boolean));
    const materiales = CATALOGO_BENEFICIOS.filter((b) => b.materialId);
    const estados = new Map<string, boolean>();
    await Promise.all(materiales.map(async (b) => {
      const d = (await this.db.get(`pdfs/${segmento(b.materialId!)}`)).data();
      estados.set(b.materialId!, !!d && d.estado !== 'oculto' && !!texto(d.drive).trim());
    }));
    const restantesVip = Math.max(0, MAX_DIAS_VIP_ANIO - (vipDiasPorAnio[String(this.ahora().getUTCFullYear())] ?? 0));
    return CATALOGO_BENEFICIOS.map((b) => {
      const disponible = b.categoria === 'vip' || estados.get(b.materialId!) === true;
      const canjeado = !!b.materialId && materialesCanjeados.has(b.materialId);
      const excedeCupoVip = !!b.diasVip && b.diasVip > restantesVip;
      const motivo = !disponible ? 'Este contenido todavía no está disponible en la biblioteca.'
        : canjeado ? 'Ya forma parte de tu biblioteca permanente.'
          : excedeCupoVip ? `Tu cupo anual permite hasta ${restantesVip} día${restantesVip === 1 ? '' : 's'} VIP más.`
          : saldo < b.costo ? `Te faltan ${b.costo - saldo} puntos.` : null;
      return { ...b, disponible, canjeado, puedeCanjear: disponible && !canjeado && !excedeCupoVip && saldo >= b.costo, motivo };
    }).filter((b) => b.disponible || b.canjeado);
  }

  async panel(uid: string): Promise<PanelPuntos> {
    const resumen = await this.sincronizar(uid);
    const [boutique, movimientosDocs, canjesDocs] = await Promise.all([
      this.boutique(uid, resumen.saldo, resumen.vipDiasPorAnio),
      this.db.query(COLECCION_MOVIMIENTOS, { where: [{ campo: 'uid', op: '==', valor: uid }], limit: 200 }),
      this.db.query(COLECCION_CANJES_PUNTOS, { where: [{ campo: 'uid', op: '==', valor: uid }], limit: 200 }),
    ]);
    const movimientos = movimientosDocs.map((d) => ({ id: d.id, ...(d.data() ?? {}) } as MovimientoPuntos))
      .sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 30);
    const canjes = canjesDocs.map((d) => ({ id: d.id, ...(d.data() ?? {}) } as CanjePuntos))
      .sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 50);
    const materiales = boutique.filter((b) => b.categoria === 'material' && b.canjeado).length;
    const siguiente = boutique
      .filter((b) => !b.canjeado && b.disponible && !(b.diasVip && b.diasVip > MAX_DIAS_VIP_ANIO - ((resumen.vipDiasPorAnio[String(this.ahora().getUTCFullYear())] ?? 0))))
      .sort((a, b) => Math.max(0, a.costo - resumen.saldo) - Math.max(0, b.costo - resumen.saldo) || a.costo - b.costo)[0];
    const objetivo = siguiente ? {
      beneficioId: siguiente.id,
      nombre: siguiente.nombre,
      costo: siguiente.costo,
      faltan: Math.max(0, siguiente.costo - resumen.saldo),
      porcentaje: Math.min(100, Math.round((resumen.saldo / siguiente.costo) * 100)),
      clasesEquivalentes: Math.ceil(Math.max(0, siguiente.costo - resumen.saldo) / PUNTOS_POR_CLASE),
      cursosEquivalentes: Math.ceil(Math.max(0, siguiente.costo - resumen.saldo) / PUNTOS_POR_CURSO),
    } : null;
    const anio = this.ahora().getUTCFullYear();
    const vipUsados = resumen.vipDiasPorAnio[String(anio)] ?? 0;
    return {
      puntos: resumenPublico(resumen), boutique, movimientos, canjes,
      hitos: hitosPublicos(resumen),
      colecciones: coleccionesPublicas(materiales),
      objetivo,
      vipAnual: { anio, usados: vipUsados, disponibles: Math.max(0, MAX_DIAS_VIP_ANIO - vipUsados), limite: MAX_DIAS_VIP_ANIO },
      proximasFormasDeGanar: [
        { nombre: 'Modo Historia', estado: 'En validación segura', descripcion: 'Se activará cuando cada nivel se acredite completamente en el servidor.' },
        { nombre: 'Comunidad', estado: 'En moderación', descripcion: 'Premiará aportaciones aprobadas por su calidad, no la cantidad de publicaciones.' },
        { nombre: 'Misiones mensuales', estado: 'Próximamente', descripcion: 'Metas editoriales con fecha, cupo y reglas verificables.' },
      ],
    };
  }

  async canjear(uid: string, beneficioId: string): Promise<{ ok: true; canje: CanjePuntos; puntos: ResumenPuntos }> {
    const beneficio = CATALOGO_BENEFICIOS.find((b) => b.id === beneficioId);
    if (!beneficio) throw new NotFoundError('Ese beneficio no existe.');
    await this.sincronizar(uid);
    const ahora = this.ahora();
    const fecha = ahora.toISOString();
    const anio = String(ahora.getUTCFullYear());
    const resultado = await this.db.runTransaction(async (tx) => {
      const resumenRuta = rutaResumen(uid);
      const resumen = resumenDesdeDoc(uid, (await tx.get(resumenRuta)).data());

      let derechoRuta = '';
      let material: Datos | undefined;
      if (beneficio.materialId) {
        derechoRuta = `${COLECCION_BENEFICIOS}/${segmento(`${uid}__${beneficio.materialId}`)}`;
        const [derecho, materialDoc] = await Promise.all([tx.get(derechoRuta), tx.get(`pdfs/${segmento(beneficio.materialId)}`)]);
        if (derecho.exists) throw new CodedError(409, 'beneficio/ya-canjeado', 'Este material ya forma parte de tu biblioteca permanente.');
        material = materialDoc.data();
        if (!material || material.estado === 'oculto' || !texto(material.drive).trim()) throw new CodedError(409, 'beneficio/no-disponible', 'Este material todavía no está disponible.');
      }

      if (resumen.saldo < beneficio.costo) throw new CodedError(409, 'puntos/insuficientes', `Necesitas ${beneficio.costo} puntos para este beneficio.`, { saldo: resumen.saldo, costo: beneficio.costo });

      const usadosAnio = resumen.vipDiasPorAnio[anio] ?? 0;
      if (beneficio.diasVip && usadosAnio + beneficio.diasVip > MAX_DIAS_VIP_ANIO) {
        throw new CodedError(409, 'beneficio/limite-vip', `Puedes canjear hasta ${MAX_DIAS_VIP_ANIO} días VIP por año calendario.`, { diasUsados: usadosAnio, limite: MAX_DIAS_VIP_ANIO });
      }

      const secuencia = resumen.canjes + 1;
      const canjeId = segmento(`${uid}__${String(secuencia).padStart(5, '0')}`);
      let vigenciaHasta: string | null = null;
      if (beneficio.diasVip) {
        const vip = await otorgarDiasVipEnTx(tx, { uid, dias: beneficio.diasVip, fuente: 'puntos', referencia: beneficio.id }, ahora, `puntos_${canjeId}`);
        vigenciaHasta = vip.vigenciaHasta;
      }

      const nuevo: ResumenGuardado = {
        ...resumen,
        saldo: resumen.saldo - beneficio.costo,
        gastados: resumen.gastados + beneficio.costo,
        canjes: secuencia,
        vipDiasPorAnio: beneficio.diasVip ? { ...resumen.vipDiasPorAnio, [anio]: usadosAnio + beneficio.diasVip } : resumen.vipDiasPorAnio,
        actualizado: fecha,
      };
      const canje: CanjePuntos = {
        id: canjeId, beneficioId: beneficio.id, nombre: beneficio.nombre, categoria: beneficio.categoria,
        costo: beneficio.costo, fecha, materialId: beneficio.materialId ?? null,
        diasVip: beneficio.diasVip ?? null, vigenciaHasta,
      };
      tx.set(resumenRuta, { ...nuevo });
      tx.set(`${COLECCION_CANJES_PUNTOS}/${canjeId}`, { uid, ...canje });
      tx.set(`${COLECCION_MOVIMIENTOS}/${segmento(`${canjeId}__canje`)}`, {
        uid, tipo: 'canje', puntos: -beneficio.costo, concepto: beneficio.nombre,
        detalle: beneficio.categoria === 'material' ? 'Acceso permanente a material' : `${beneficio.diasVip} días VIP`, fecha, referencia: beneficio.id,
      });
      if (beneficio.materialId) tx.set(derechoRuta, { uid, materialId: beneficio.materialId, beneficioId: beneficio.id, fecha, permanente: true });
      return { canje, resumen: nuevo };
    });
    return { ok: true, canje: resultado.canje, puntos: resumenPublico(resultado.resumen) };
  }
}
