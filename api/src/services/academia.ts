// Academia Dermalysse: programas de lectura guiada por módulos (Programa → Módulo → Tema).
// El SERVIDOR es la autoridad:
//  - módulo 1 de cada programa gratis; el resto exige VIP (402 requiere_vip), salvo admin;
//  - un módulo n>1 se abre al aprobar el examen del n-1 con 70 % o más (403 modulo_bloqueado);
//  - solo se publica lo aprobado: estado efectivo = revisión del admin ?? estado del JSON.
//    Borradores y módulos en revisión los ve solo el admin, salvo ACADEMIA_MOSTRAR_BORRADORES
//    (404 modulo_en_preparacion);
//  - el examen se emite al azar desde el banco, sin respuestas, solo con todos los temas leídos
//    (403 temas_pendientes) y con 3 minutos de espera tras reprobar (429 espera_examen);
//  - se califican solo las preguntas emitidas, una sola vez (409 en otro caso);
//  - las respuestas correctas y las explicaciones NUNCA se revelan mientras el módulo no esté
//    aprobado (ahora o antes). Se guarda la mejor marca; reprobar después no retira la aprobación.
//  - calendario de lanzamiento (opcional por programa): antes de su fecha, un módulo responde
//    403 modulo_programado con `disponibleDesde`, ANTES de las demás reglas; el admin lo salta.
//    La fecha de inicio efectiva es el ajuste del admin ?? `lanzamiento` del catálogo.
import { randomInt } from 'node:crypto';
import {
  claveRevisionAcademia,
  type AcademiaAttemptStore, type AcademiaContentStore, type AcademiaProgressStore, type AcademiaReviewStore,
} from '../adapters/interfaces.js';
import {
  ESTADOS_ACADEMIA,
  type AjusteLanzamientoAcademia, type AvanceModuloAcademia, type EstadoAcademia, type LanzamientoAcademia, type ModuloAcademia,
  type PreguntaAcademia, type ProgramaAcademia, type ProgresoAcademia, type RevisionAcademia, type Usuario,
} from '../domain/types.js';
import { CodedError, NotFoundError, ValidationError } from './errors.js';
import { crearJuego, evaluarJuego, publicarJuego } from './academiaJuegos.js';

/** Porcentaje mínimo para aprobar si el módulo no define otro. */
export const APROBATORIO_ACADEMIA = 70;
/** Espera tras reprobar antes de recibir otro examen (evita extraer el banco a fuerza de intentos). */
export const ESPERA_EXAMEN_MS = 3 * 60 * 1000;
/** Preguntas por examen si el módulo no define `mostrar`. */
export const MOSTRAR_POR_DEFECTO = 10;
const NOTA_MAX = 500;

export interface OpcionesAcademia {
  /** ACADEMIA_MOSTRAR_BORRADORES=true: borradores visibles para todos (solo para revisar en local). */
  mostrarBorradores?: boolean;
  ahora?: () => Date;
  /** Entero aleatorio en [0, max). Inyectable para pruebas. */
  azar?: (max: number) => number;
  /** Crédito idempotente del laboratorio. Ausente en ensamblajes aislados que no incluyen Diamantes. */
  recompensarJuego?: (uid: string, programa: string, n: number) => Promise<{ diamantes: number; repetida: boolean; saldo: number }>;
}

// ── Calendario de lanzamiento (reglas puras) ──

/** Desfase de la Ciudad de México: UTC−6 todo el año (sin horario de verano desde 2022). */
export const DESFASE_MEXICO_MS = -6 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
export const CADA_DIAS_POR_DEFECTO = 7;
export const CADA_DIAS_MIN = 1;
export const CADA_DIAS_MAX = 60;

/** Fecha de calendario YYYY-MM-DD real (rechaza 2026-02-30 y años fuera de 2000–2100). */
export function fechaCalendarioValida(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  if (y < 2000 || y > 2100) return false;
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

export const cadaDiasValido = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= CADA_DIAS_MIN && (v as number) <= CADA_DIAS_MAX;

/** Fecha de hoy (YYYY-MM-DD) en la Ciudad de México. */
export const hoyMexico = (ahora: Date) => new Date(ahora.getTime() + DESFASE_MEXICO_MS).toISOString().slice(0, 10);

/** Instante (ISO, UTC) en que se abre el módulo n: 00:00 de Ciudad de México de inicio + (n − 1) × cadaDias. */
export function disponibleDesde(l: LanzamientoAcademia | null | undefined, n: number): string | null {
  if (!l || !fechaCalendarioValida(l.inicio)) return null;
  const [y, m, d] = l.inicio.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - DESFASE_MEXICO_MS + (n - 1) * l.cadaDias * DIA_MS).toISOString();
}

/** El calendario del catálogo, si es válido (el validador lo exige; aquí solo se evita romper). */
export function lanzamientoCatalogo(p: ProgramaAcademia): LanzamientoAcademia | null {
  const l = p.lanzamiento;
  if (!l || !fechaCalendarioValida(l.inicio)) return null;
  return { inicio: l.inicio, cadaDias: cadaDiasValido(l.cadaDias) ? l.cadaDias : CADA_DIAS_POR_DEFECTO };
}

/** Calendario que manda: el ajuste del admin tiene prioridad sobre el catálogo. */
export function lanzamientoEfectivo(p: ProgramaAcademia, ajuste: AjusteLanzamientoAcademia | null | undefined): (LanzamientoAcademia & { origen: 'admin' | 'catalogo' }) | null {
  const cat = lanzamientoCatalogo(p);
  if (ajuste && fechaCalendarioValida(ajuste.inicio)) {
    return { inicio: ajuste.inicio, cadaDias: cadaDiasValido(ajuste.cadaDias) ? ajuste.cadaDias : cat?.cadaDias ?? CADA_DIAS_POR_DEFECTO, origen: 'admin' };
  }
  return cat ? { ...cat, origen: 'catalogo' } : null;
}

const programadoEn = (desde: string | null, ahora: Date) => !!desde && ahora.getTime() < Date.parse(desde);

// ── Reglas puras ──

const esEstado = (v: unknown): v is EstadoAcademia => typeof v === 'string' && (ESTADOS_ACADEMIA as readonly string[]).includes(v);

/** Estado que manda: la revisión del admin tiene prioridad sobre el `estado` escrito en el JSON. */
export function estadoEfectivo(modulo: ModuloAcademia | null, revision: RevisionAcademia | null | undefined): EstadoAcademia | null {
  if (!modulo) return null;
  if (revision && esEstado(revision.estado)) return revision.estado;
  return esEstado(modulo.estado) ? modulo.estado : 'borrador';
}

export function moduloVisible(modulo: ModuloAcademia | null, estado: EstadoAcademia | null, o: { esAdmin: boolean; borradores: boolean }): boolean {
  return !!modulo && (estado === 'aprobado' || o.esAdmin || o.borradores);
}

const preguntasDe = (m: ModuloAcademia | null): PreguntaAcademia[] => (Array.isArray(m?.examen?.preguntas) ? m.examen.preguntas : []);
const temasDe = (m: ModuloAcademia | null) => (Array.isArray(m?.temas) ? m.temas : []);
const aprobarDe = (m: ModuloAcademia) => {
  const v = Number(m.examen?.aprobar);
  return Number.isFinite(v) && v > 0 && v <= 100 ? v : APROBATORIO_ACADEMIA;
};

/**
 * Módulo para el miembro: sin el banco del examen (solo { aprobar, mostrar, total }).
 * Las fuentes quedan para revisión profesional (docs/ACADEMIA-FORMATO.md §7): solo el admin las recibe.
 */
export function moduloPublico(m: ModuloAcademia, estado: EstadoAcademia | null, conFuentes = false): Record<string, unknown> {
  const total = preguntasDe(m).length;
  const copia: Record<string, unknown> = { ...m };
  delete copia.examen;
  if (!conFuentes) delete copia.fuentes;
  copia.temas = temasDe(m).map((t) => {
    const tema: Record<string, unknown> = { ...t };
    if (!conFuentes) delete tema.fuentes;
    return tema;
  });
  copia.estado = estado;
  // El tablero y sus soluciones se entregan únicamente por /juego, nunca mezclados con el contenido.
  copia.minijuego = m.minijuego ? { tipo: m.minijuego.tipo, titulo: m.minijuego.titulo } : undefined;
  copia.examen = { aprobar: aprobarDe(m), mostrar: Math.min(Number(m.examen?.mostrar) || MOSTRAR_POR_DEFECTO, total), total };
  return copia;
}

export function barajar<T>(lista: T[], azar: (max: number) => number = randomInt): T[] {
  const b = [...lista];
  for (let i = b.length - 1; i > 0; i--) {
    const j = azar(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const palabras = (s: unknown) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;

/** Métricas editoriales de un módulo para el panel de revisión. */
export function metricasModulo(m: ModuloAcademia | null) {
  let total = 0;
  let figuras = 0;
  let actividades = 0;
  for (const t of temasDe(m)) {
    const bloques = Array.isArray(t.bloques) ? (t.bloques as Record<string, unknown>[]) : [];
    for (const b of bloques) {
      if (b?.tipo === 'texto' || b?.tipo === 'recuadro') total += palabras(b.md);
      else if (b?.tipo === 'lista') total += palabras((Array.isArray(b.items) ? b.items : []).join(' '));
      else if (b?.tipo === 'pasos') total += palabras((Array.isArray(b.pasos) ? (b.pasos as { titulo?: string; md?: string }[]) : []).map((p) => `${p?.titulo ?? ''} ${p?.md ?? ''}`).join(' '));
      else if (b?.tipo === 'tabla') total += palabras((Array.isArray(b.filas) ? (b.filas as unknown[][]) : []).flat().join(' '));
      else if (b?.tipo === 'figura') figuras++;
      else if (b?.tipo === 'actividad') actividades++;
    }
  }
  return { palabras: total, figuras, actividades, temas: temasDe(m).length, preguntas: preguntasDe(m).length };
}

/** Número de módulo desde la URL: entero positivo o null. */
const numeroModulo = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 99 && String(v) === String(n) ? n : null;
};

const esObjetoPlano = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export interface ResultadoExamenAcademia {
  correctas: number;
  total: number;
  porcentaje: number;
  aprobado: boolean;
  mejor: number;
  /** true solo si el módulo quedó aprobado (ahora o antes): entonces se incluyen correcta y explicación. */
  revelado: boolean;
  detalle: ({ id: string; acertada: boolean } | { id: string; acertada: boolean; correcta: number; explicacion: string })[];
  siguiente: number | null;
  programaCompleto: boolean;
}

interface Preparado {
  p: ProgramaAcademia;
  n: number;
  m: ModuloAcademia;
  estado: EstadoAcademia;
}

export class AcademiaService {
  private readonly borradores: boolean;
  private readonly ahora: () => Date;
  private readonly azar: (max: number) => number;
  private readonly recompensarJuego?: OpcionesAcademia['recompensarJuego'];

  constructor(
    private readonly content: AcademiaContentStore,
    private readonly progress: AcademiaProgressStore,
    private readonly attempts: AcademiaAttemptStore,
    private readonly reviews: AcademiaReviewStore,
    opciones: OpcionesAcademia = {},
  ) {
    this.borradores = opciones.mostrarBorradores === true;
    this.ahora = opciones.ahora ?? (() => new Date());
    this.azar = opciones.azar ?? randomInt;
    this.recompensarJuego = opciones.recompensarJuego;
  }

  private async programa(id: string): Promise<ProgramaAcademia> {
    const p = (await this.content.catalogo()).programas.find((x) => x.id === id);
    if (!p) throw new NotFoundError('Este programa no existe.');
    return p;
  }

  /** Programa y número de módulo del catálogo (404 si no existen). */
  private async ubicar(programaId: string, nParam: unknown): Promise<{ p: ProgramaAcademia; n: number }> {
    const p = await this.programa(programaId);
    const n = numeroModulo(nParam);
    if (n === null || !p.modulos.some((mm) => mm.n === n)) throw new NotFoundError('Este módulo no existe.');
    return { p, n };
  }

  private async aprobado(uid: string, programa: string, n: number) {
    return (await this.progress.modulo(uid, programa, n)).aprobado === true;
  }

  /** Calendario efectivo de un programa (ajuste del admin ?? catálogo). */
  private async lanzamiento(p: ProgramaAcademia) {
    return lanzamientoEfectivo(p, await this.reviews.lanzamiento(p.id));
  }

  /** Resuelve programa, módulo, fecha de lanzamiento, visibilidad, acceso VIP y desbloqueo, en ese orden. */
  private async preparar(usuario: Usuario, programaId: string, nParam: unknown): Promise<Preparado> {
    const { p, n } = await this.ubicar(programaId, nParam);
    // La fecha va primero: el mensaje de un módulo programado siempre habla de su fecha.
    if (!usuario.esAdmin) {
      const desde = disponibleDesde(await this.lanzamiento(p), n);
      if (desde && programadoEn(desde, this.ahora())) {
        throw new CodedError(403, 'modulo_programado', 'Este módulo todavía no está disponible. Se abre en la fecha indicada.', { disponibleDesde: desde });
      }
    }
    const m = await this.content.modulo(p.id, n);
    const estado = estadoEfectivo(m, await this.reviews.get(p.id, n));
    if (!m || !estado || !moduloVisible(m, estado, { esAdmin: usuario.esAdmin, borradores: this.borradores })) {
      throw new CodedError(404, 'modulo_en_preparacion', 'Este módulo está en preparación.');
    }
    if (n > 1 && !usuario.esVip && !usuario.esAdmin) {
      throw new CodedError(402, 'requiere_vip', 'Este módulo es para miembros VIP. El módulo 1 de cada programa es gratis.');
    }
    if (n > 1 && !usuario.esAdmin && !(await this.aprobado(usuario.uid, p.id, n - 1))) {
      throw new CodedError(403, 'modulo_bloqueado', `Aprueba el examen del módulo ${n - 1} con 70 % o más para desbloquear este módulo.`);
    }
    return { p, n, m, estado };
  }

  /** Catálogo con disponibilidad por módulo (sin datos del examen) y el avance de la cuenta. */
  async catalogo(usuario: Usuario) {
    const [catalogo, revisiones, ajustes, progreso] = await Promise.all([
      this.content.catalogo(), this.reviews.todas(), this.reviews.lanzamientos(), this.progress.del(usuario.uid),
    ]);
    const opciones = { esAdmin: usuario.esAdmin, borradores: this.borradores };
    const ahora = this.ahora();
    const programas = await Promise.all(catalogo.programas.map(async (p) => {
      const l = lanzamientoEfectivo(p, ajustes.get(p.id));
      return {
        ...p,
        // Siempre el calendario efectivo (nunca el del JSON si el admin lo movió).
        lanzamiento: l ? { inicio: l.inicio, cadaDias: l.cadaDias } : null,
        modulos: await Promise.all(p.modulos.map(async (mm) => {
          const m = await this.content.modulo(p.id, mm.n);
          const estado = estadoEfectivo(m, revisiones.get(claveRevisionAcademia(p.id, mm.n)));
          const desde = disponibleDesde(l, mm.n);
          return {
            n: mm.n,
            titulo: mm.titulo,
            disponible: moduloVisible(m, estado, opciones),
            estado,
            temas: temasDe(m).length,
            duracionMin: typeof m?.duracionMin === 'number' ? m.duracionMin : null,
            disponibleDesde: desde,
            programado: programadoEn(desde, ahora),
          };
        })),
      };
    }));
    return { programas, progreso };
  }

  async progreso(usuario: Usuario): Promise<ProgresoAcademia> {
    return this.progress.del(usuario.uid);
  }

  async modulo(usuario: Usuario, programaId: string, nParam: unknown) {
    const { m, estado } = await this.preparar(usuario, programaId, nParam);
    return moduloPublico(m, estado, usuario.esAdmin);
  }

  /** Registra un tema leído (avance sin valor canjeable). */
  async marcarTema(usuario: Usuario, programaId: string, nParam: unknown, tema: unknown) {
    const { p, n, m } = await this.preparar(usuario, programaId, nParam);
    if (typeof tema !== 'string' || !temasDe(m).some((t) => t.n === tema)) throw new ValidationError('"tema" no pertenece a este módulo.');
    const avance = await this.progress.marcarTema(usuario.uid, p.id, n, tema, this.ahora().toISOString());
    return { ok: true, temas: avance.temas ?? {} };
  }

  /** Desafío estable por cuenta y módulo, sin coordenadas/parejas/respuestas de solución. */
  async juego(usuario: Usuario, programaId: string, nParam: unknown) {
    const { p, n, m } = await this.preparar(usuario, programaId, nParam);
    const reto = crearJuego(m, usuario.uid, p.id, n);
    const avance = await this.progress.modulo(usuario.uid, p.id, n);
    return publicarJuego(reto, avance.juego);
  }

  /** Valida una jugada en servidor, fusiona avance y acredita una sola recompensa al completar. */
  async registrarJuego(usuario: Usuario, programaId: string, nParam: unknown, entrada: unknown) {
    const { p, n, m } = await this.preparar(usuario, programaId, nParam);
    const reto = crearJuego(m, usuario.uid, p.id, n);
    const evaluada = evaluarJuego(reto, entrada);
    let avance = await this.progress.registrarJuego(usuario.uid, p.id, n, {
      version: reto.version, tipo: reto.tipo, resueltos: evaluada.resueltos, total: reto.total, acierto: evaluada.acierto,
      fecha: this.ahora().toISOString(),
    });
    let diamantesGanados = 0;
    let saldoDiamantes: number | null = null;
    if (avance.juego?.completado && !avance.juego.recompensaAcreditada && !usuario.esAdmin && this.recompensarJuego) {
      const recompensa = await this.recompensarJuego(usuario.uid, p.id, n);
      diamantesGanados = recompensa.repetida ? 0 : recompensa.diamantes;
      saldoDiamantes = recompensa.saldo;
      avance = await this.progress.marcarRecompensaJuego(usuario.uid, p.id, n);
    }
    return { ...publicarJuego(reto, avance.juego), acierto: evaluada.acierto, diamantesGanados, saldoDiamantes };
  }

  /** Emite un examen: preguntas al azar del banco, SIN respuestas. Guarda qué preguntas se dieron. */
  async emitirExamen(usuario: Usuario, programaId: string, nParam: unknown) {
    const { p, n, m } = await this.preparar(usuario, programaId, nParam);
    const banco = preguntasDe(m);
    if (!banco.length) throw new CodedError(404, 'examen_no_disponible', 'Este módulo todavía no tiene examen.');
    if (!usuario.esAdmin) {
      const avance = await this.progress.modulo(usuario.uid, p.id, n);
      const faltan = temasDe(m).filter((t) => !avance.temas?.[t.n]).length;
      if (faltan > 0) {
        throw new CodedError(403, 'temas_pendientes', `Lee ${faltan === 1 ? 'el tema que falta' : `los ${faltan} temas que faltan`} para presentar el examen.`);
      }
      const ultimo = (await this.attempts.get(usuario.uid, p.id, n))?.ultimo;
      if (ultimo && !ultimo.aprobado) {
        const restante = Date.parse(ultimo.fecha) + ESPERA_EXAMEN_MS - this.ahora().getTime();
        if (restante > 0) {
          const min = Math.ceil(restante / 60000);
          throw new CodedError(429, 'espera_examen', `Repasa los temas y vuelve a intentarlo en ${min} minuto${min === 1 ? '' : 's'}.`);
        }
      }
    }
    const mostrar = Math.min(Number(m.examen?.mostrar) || MOSTRAR_POR_DEFECTO, banco.length);
    const elegidas = barajar(banco, this.azar).slice(0, mostrar);
    await this.attempts.emitir(usuario.uid, p.id, n, elegidas.map((q) => q.id), this.ahora().toISOString());
    return {
      aprobar: aprobarDe(m),
      total: elegidas.length,
      preguntas: elegidas.map((q) => ({ id: q.id, q: q.q, opciones: q.opciones })),
    };
  }

  /** Califica SOLO las preguntas del último examen emitido, una sola vez. */
  async calificarExamen(usuario: Usuario, programaId: string, nParam: unknown, respuestas: unknown): Promise<ResultadoExamenAcademia> {
    const { p, n, m } = await this.preparar(usuario, programaId, nParam);
    if (!esObjetoPlano(respuestas)) throw new ValidationError('"respuestas" debe ser un objeto { idPregunta: indiceOpcion }.');
    const intento = await this.attempts.get(usuario.uid, p.id, n);
    if (!intento || intento.calificado) throw new CodedError(409, 'examen_no_emitido', 'Inicia el examen de nuevo para recibir preguntas.');
    for (const id of intento.ids) {
      const v = respuestas[id];
      if (v !== null && v !== undefined && !Number.isInteger(v)) throw new ValidationError(`La respuesta de ${id} debe ser el índice de la opción.`);
    }
    const banco = new Map(preguntasDe(m).map((q) => [q.id, q]));
    if (intento.ids.some((id) => !banco.has(id))) throw new CodedError(409, 'examen_desactualizado', 'El examen cambió; inícialo de nuevo.');

    const ids = await this.attempts.consumir(usuario.uid, p.id, n);
    if (!ids || !ids.length) throw new CodedError(409, 'examen_no_emitido', 'Inicia el examen de nuevo para recibir preguntas.');

    const calificadas = ids.map((id) => {
      const q = banco.get(id)!;
      return { id, acertada: respuestas[id] === q.correcta, correcta: q.correcta, explicacion: q.explicacion ?? '' };
    });
    const correctas = calificadas.filter((d) => d.acertada).length;
    const total = calificadas.length;
    const porcentaje = Math.round((correctas / total) * 100);
    const aprobado = (correctas / total) * 100 >= aprobarDe(m);
    const fecha = this.ahora().toISOString();

    const avance: AvanceModuloAcademia = await this.progress.registrarExamen(usuario.uid, p.id, n, { porcentaje, aprobado, fecha });
    await this.attempts.cerrar(usuario.uid, p.id, n, { aprobado, fecha });

    const revelado = avance.aprobado === true;
    const progreso = await this.progress.del(usuario.uid);
    const programaCompleto = p.modulos.every((mm) => progreso[p.id]?.modulos[String(mm.n)]?.aprobado === true);
    const ultimo = Math.max(...p.modulos.map((x) => x.n));
    return {
      correctas,
      total,
      porcentaje,
      aprobado,
      mejor: avance.mejor ?? porcentaje,
      revelado,
      // Sin aprobación, solo { id, acertada }: ni el índice correcto ni la explicación.
      detalle: calificadas.map((d) => (revelado ? d : { id: d.id, acertada: d.acertada })),
      siguiente: aprobado && n < ultimo ? n + 1 : null,
      programaCompleto,
    };
  }

  // ── Revisión editorial (admin) ──

  private fila(mm: { n: number; titulo: string }, m: ModuloAcademia | null, revision: RevisionAcademia | null | undefined) {
    return {
      n: mm.n,
      titulo: mm.titulo,
      existe: !!m,
      estadoArchivo: m ? (esEstado(m.estado) ? m.estado : 'borrador') : null,
      estado: estadoEfectivo(m, revision),
      nota: revision?.nota ?? '',
      revision: revision ?? null,
      ...metricasModulo(m),
    };
  }

  /** Calendario para el panel: efectivo, origen, valor del catálogo, ajuste y fecha de cada módulo. */
  private calendarioAdmin(p: ProgramaAcademia, ajuste: AjusteLanzamientoAcademia | null | undefined) {
    const l = lanzamientoEfectivo(p, ajuste);
    const ahora = this.ahora();
    return {
      lanzamiento: l
        ? {
          inicio: l.inicio,
          cadaDias: l.cadaDias,
          origen: l.origen,
          catalogo: lanzamientoCatalogo(p),
          ajuste: l.origen === 'admin' && ajuste ? { por: ajuste.por, fecha: ajuste.fecha } : null,
        }
        : null,
      calendario: p.modulos.map((mm) => {
        const desde = disponibleDesde(l, mm.n);
        return { n: mm.n, disponibleDesde: desde, programado: programadoEn(desde, ahora) };
      }),
    };
  }

  async revisionAdmin() {
    const [catalogo, revisiones, ajustes] = await Promise.all([this.content.catalogo(), this.reviews.todas(), this.reviews.lanzamientos()]);
    const programas = await Promise.all(catalogo.programas.map(async (p) => {
      const { lanzamiento, calendario } = this.calendarioAdmin(p, ajustes.get(p.id));
      return {
        id: p.id,
        numero: p.numero ?? null,
        titulo: p.titulo,
        area: p.area ?? '',
        lanzamiento,
        modulos: await Promise.all(p.modulos.map(async (mm, i) => ({
          ...this.fila(mm, await this.content.modulo(p.id, mm.n), revisiones.get(claveRevisionAcademia(p.id, mm.n))),
          disponibleDesde: calendario[i].disponibleDesde,
          programado: calendario[i].programado,
        }))),
      };
    }));
    return { programas };
  }

  /**
   * Mueve la fecha de inicio del calendario de un programa (todo el calendario se desplaza).
   * Cuerpo { inicio: "YYYY-MM-DD", cadaDias?: 1–60 }; { inicio: null } vuelve a la fecha del catálogo.
   */
  async fijarLanzamiento(usuario: Usuario, programaId: string, cuerpo: unknown) {
    const datos = esObjetoPlano(cuerpo) ? cuerpo : null;
    if (!datos || !('inicio' in datos)) throw new ValidationError('"inicio" es obligatorio: una fecha YYYY-MM-DD o null.');
    if (datos.inicio === null) return this.borrarLanzamiento(programaId);
    if (!fechaCalendarioValida(datos.inicio)) throw new ValidationError('"inicio" debe ser una fecha real con formato YYYY-MM-DD.');
    if (datos.cadaDias !== undefined && datos.cadaDias !== null && !cadaDiasValido(datos.cadaDias)) {
      throw new ValidationError(`"cadaDias" debe ser un entero de ${CADA_DIAS_MIN} a ${CADA_DIAS_MAX}.`);
    }
    const p = await this.programa(programaId);
    const ajuste: AjusteLanzamientoAcademia = { inicio: datos.inicio, por: usuario.uid, fecha: this.ahora().toISOString() };
    if (cadaDiasValido(datos.cadaDias)) ajuste.cadaDias = datos.cadaDias;
    await this.reviews.fijarLanzamiento(p.id, ajuste);
    return { id: p.id, ...this.calendarioAdmin(p, ajuste) };
  }

  /** Borra el ajuste del admin: vuelve a mandar el `lanzamiento` del catálogo (o ninguno). */
  async borrarLanzamiento(programaId: string) {
    const p = await this.programa(programaId);
    await this.reviews.fijarLanzamiento(p.id, null);
    return { id: p.id, ...this.calendarioAdmin(p, null) };
  }

  async revisar(usuario: Usuario, programaId: string, nParam: unknown, cuerpo: unknown) {
    const datos = esObjetoPlano(cuerpo) ? cuerpo : {};
    if (!esEstado(datos.estado)) throw new ValidationError('"estado" debe ser borrador, revision o aprobado.');
    const nota = datos.nota === undefined || datos.nota === null ? '' : datos.nota;
    if (typeof nota !== 'string' || nota.length > NOTA_MAX || /[<>]/.test(nota)) {
      throw new ValidationError(`"nota" debe ser texto sin etiquetas, de hasta ${NOTA_MAX} caracteres.`);
    }
    const { p, n } = await this.ubicar(programaId, nParam);
    const m = await this.content.modulo(p.id, n);
    if (!m) throw new CodedError(409, 'modulo_sin_contenido', 'Este módulo todavía no tiene contenido que revisar.');
    const revision = await this.reviews.set(p.id, n, { estado: datos.estado, nota: nota.trim(), revisor: usuario.uid, fecha: this.ahora().toISOString() });
    return this.fila(p.modulos.find((mm) => mm.n === n)!, m, revision);
  }
}
