// Bienvenida (entrevista) y primera encuesta por cuenta: lógica PURA (sin Firestore ni Express).
// La usa src/modulos/experiencia.ts. Contrato del cliente: src/core/experiencia.ts (ExperienciaDTO) y
// src/admin/experiencia.ts (ConfigExperiencia, ResumenExperiencia).
//
// Reglas:
//  - Sin campaña aprobada, habilitada, vigente y con cupo NO se ofrece ni se entrega ningún premio.
//  - Los premios no dependen de que las opiniones sean favorables.
//  - Bienvenida: solo cuentas nuevas (members/{uid}.joined en los últimos 7 días).
//  - No aplica a administradores ni a quien ya tiene VIP por otra vía (suscripción o cortesía ajena).
//  - Exige correo verificado (claim email_verified del ID token).
//  - Cada premio se entrega UNA sola vez por cuenta (ledger v2_experiencia_beneficios).
import { createHash } from 'node:crypto';
import { aMillis, type Datos } from '../adapters/firestore/port.js';
import { membershipAccess } from '../adapters/firebase/accessPolicy.js';
import { diasVipValidos } from './vip.js';
import { CodedError, ValidationError } from './errors.js';

export const DIA_MS = 86_400_000;
export const ENCUESTA_ID = 'experiencia-inicial-v1';
export const PRIVACIDAD_VERSION = 'experiencia-v1';
/** Días por defecto: los MISMOS que ya usa el cliente (src/admin/experiencia.ts y la demo de src/core/experiencia.ts). */
export const PREMIOS_POR_DEFECTO = Object.freeze({ bienvenida: 7, experiencia: 15 });
/** Posponer: vuelve a invitar al día siguiente (igual que la demo del cliente). */
export const POSPONER_MS = DIA_MS;
/** Días de uso que se conservan (bastan para habilitar la encuesta; no crece indefinidamente). */
export const MAX_SESIONES = 3;

export type Flujo = 'entrevista' | 'encuesta';
export type TipoBeneficio = 'bienvenida' | 'experiencia';
export const BENEFICIO_DE: Record<Flujo, TipoBeneficio> = { entrevista: 'bienvenida', encuesta: 'experiencia' };

export const OPCIONES = Object.freeze({
  roles: ['estudiante', 'veterinario', 'tecnico', 'productor', 'docente', 'otro', 'prefiero-no-decir'],
  objetivo: ['aprender', 'produccion', 'actualizar', 'estudios', 'certificacion', 'otro'],
  experiencia: ['inicio', 'basico', 'practica', 'avanzado'],
  formato: ['grabados', 'envivo', 'ambos', 'no-se'],
  tiempo: ['cortos', 'semana', 'fines'],
  origen: ['facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp', 'google', 'recomendacion', 'escuela-evento', 'redes', 'otro'],
  etapa: ['iniciando', 'intermedia', 'final', 'egresado'],
  dificultad: ['ninguna', 'encontrar', 'video', 'movil', 'acceso', 'otra'],
} as const);
type ClaveOpcion = keyof typeof OPCIONES;

const REQUERIDAS: Record<Flujo, string[]> = {
  entrevista: ['roles', 'objetivo', 'areas', 'experiencia', 'formato', 'tiempo', 'origen'],
  encuesta: ['facilidad', 'utilidad', 'dificultad'],
};
const PERMITIDAS: Record<Flujo, string[]> = {
  entrevista: [...REQUERIDAS.entrevista, 'carrera', 'etapa', 'actividad'],
  encuesta: [...REQUERIDAS.encuesta, 'tema', 'comentario'],
};
/** Textos libres opcionales y su máximo (los mismos maxlength del formulario). */
const TEXTOS: Record<string, number> = { carrera: 80, actividad: 80, tema: 160, comentario: 500 };
/** Último paso admitido por flujo (7 preguntas de bienvenida, 5 de encuesta). */
export const PASO_MAX: Record<Flujo, number> = { entrevista: 7, encuesta: 5 };

// ── Formas guardadas ──

export type EstadoFormulario = 'pendiente' | 'en-curso' | 'pospuesta' | 'completada';
export interface Formulario {
  estado: EstadoFormulario;
  revision: number;
  paso: number;
  respuestas: Record<string, unknown>;
  completadaEn: string | null;
  pospuestaHasta: string | null;
  /** Firma de la última operación (reintentos idempotentes). Nunca sale en el DTO. */
  ultimaOperacion?: string;
}
export interface Reserva { uid: string; campanaId: string; reservadaEn: string; venceOferta: string }
/** v2_experiencia/{uid}: sin nombre, correo ni teléfono. */
export interface EstadoExperiencia {
  version: 1;
  uid: string;
  cohorte: 'nueva' | 'existente';
  primerAccesoEn: string | null;
  privacidad: { version: string; aceptadaEn: string; usoAceptado: boolean } | null;
  entrevista: Formulario;
  encuesta: Formulario;
  sesiones: string[];
  reserva: Reserva | null;
  /** Días VIP que este programa ya otorgó y la vigencia que dejó en users/{uid}.vigenciaHasta. */
  programa: { dias: number; hasta: string | null };
}
export interface Premios { bienvenida: number; experiencia: number }
/** v2_config/experiencia (campos públicos). */
export interface ConfigExperiencia {
  version: 1;
  revision: number;
  campanaId: string | null;
  aprobado: boolean;
  habilitada: boolean;
  fechaInicio: string | null;
  fechaFin: string | null;
  cupo: number;
  premios: Premios;
}
/** v2_experiencia_beneficios/{uid}__{tipo}: premio entregado. */
export interface BeneficioOtorgado { uid: string; tipo: TipoBeneficio; campanaId: string; dias: number; otorgadoEn: string; hasta: string; venceOferta: string | null }
export interface CursoExperiencia { id: string; titulo: string; area: string; nivel: string; portada: string; orden: number }

// ── DTO (src/core/experiencia.ts) ──

export interface BeneficioDTO { estado: 'no-disponible' | 'reservado' | 'otorgado'; dias: number | null; hasta: string | null; motivo: string; venceOferta: string | null }
export interface ExperienciaDTO {
  version: 1;
  fuente: 'api';
  cohorte: 'nueva' | 'existente';
  primerAccesoEn: string | null;
  areas: string[];
  recomendaciones: { id: string; titulo: string; area: string; nivel: string; portada: string }[];
  entrevista: Omit<Formulario, 'ultimaOperacion'>;
  encuesta: Omit<Formulario, 'ultimaOperacion' | 'estado'> & { id: string; estado: EstadoFormulario | 'bloqueada' | 'disponible'; motivo: string; disponibleEn: string | null };
  beneficios: Record<TipoBeneficio, BeneficioDTO>;
}

/** Todo lo que una decisión necesita, leído antes (en la transacción cuando hay escrituras). */
export interface Contexto {
  ahora: number;
  estado: EstadoExperiencia;
  config: ConfigExperiencia;
  /** Plazas ya reservadas en la campaña configurada. */
  reservadas: number;
  /** Reserva previa de esta cuenta en la campaña configurada (v2_experiencia_reservas). */
  reservaActual: Reserva | null;
  /** users/{uid} (solo se lee: vigenciaHasta y subscription). */
  usuario: Datos;
  beneficios: Record<TipoBeneficio, BeneficioOtorgado | null>;
  esAdmin: boolean;
  emailVerificado: boolean;
  cursos: CursoExperiencia[];
  /** Fechas (ms) de exámenes calificados por la API (Academia). */
  evaluaciones: number[];
}

// ── Utilidades ──

export const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const iso = (ms: number) => new Date(ms).toISOString();
const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isoONull = (v: unknown): string | null => {
  const ms = aMillis(v);
  return Number.isFinite(ms) ? iso(ms) : null;
};
export const idCampanaValido = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(v);
const enteroEn = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

export function entero(v: unknown, campo: string, min: number, max: number): number {
  if (!enteroEn(v, min, max)) throw new ValidationError(`"${campo}" debe ser un entero entre ${min} y ${max}.`);
  return v as number;
}

/** El cuerpo debe ser un objeto JSON y solo con las claves admitidas. */
export function cuerpo(body: unknown, claves: string[]): Record<string, unknown> {
  if (!esObjeto(body)) throw new ValidationError('El cuerpo debe ser un objeto JSON.');
  if (Object.keys(body).some((k) => !claves.includes(k))) throw new ValidationError('La petición contiene campos no admitidos.');
  return body;
}

export function exigirConsentimiento(b: Record<string, unknown>): void {
  if (b.privacidadAceptada !== true) throw new CodedError(400, 'privacidad_requerida', 'Acepta el aviso de privacidad para guardar estas respuestas.');
}

// ── Normalización de lo leído de Firestore (un documento malformado nunca activa premios) ──

export function formularioVacio(): Formulario {
  return { estado: 'pendiente', revision: 0, paso: 0, respuestas: {}, completadaEn: null, pospuestaHasta: null };
}

function normalizarFormulario(v: unknown, flujo: Flujo): Formulario {
  if (!esObjeto(v)) return formularioVacio();
  const estados: EstadoFormulario[] = ['pendiente', 'en-curso', 'pospuesta', 'completada'];
  const f: Formulario = {
    estado: estados.includes(v.estado as EstadoFormulario) ? v.estado as EstadoFormulario : 'pendiente',
    revision: enteroEn(v.revision, 0, 1_000_000) ? v.revision as number : 0,
    paso: enteroEn(v.paso, 0, PASO_MAX[flujo]) ? v.paso as number : 0,
    respuestas: esObjeto(v.respuestas) ? { ...v.respuestas } : {},
    completadaEn: isoONull(v.completadaEn),
    pospuestaHasta: isoONull(v.pospuestaHasta),
  };
  if (typeof v.ultimaOperacion === 'string') f.ultimaOperacion = v.ultimaOperacion;
  return f;
}

function normalizarReserva(v: unknown): Reserva | null {
  if (!esObjeto(v) || typeof v.uid !== 'string' || !idCampanaValido(v.campanaId)) return null;
  const reservadaEn = isoONull(v.reservadaEn), venceOferta = isoONull(v.venceOferta);
  return reservadaEn && venceOferta ? { uid: v.uid, campanaId: v.campanaId, reservadaEn, venceOferta } : null;
}
export { normalizarReserva };

/** Cohorte por members/{uid}.joined (AAAA-MM-DD, la escribe el alta del club). */
export function cohorteDe(member: Datos | undefined, ahora: number, sinDatos: 'nueva' | 'existente'): 'nueva' | 'existente' {
  const alta = aMillis(member?.joined);
  if (!Number.isFinite(alta)) return sinDatos;
  return alta <= ahora && ahora - alta <= 7 * DIA_MS ? 'nueva' : 'existente';
}

export function estadoNuevo(uid: string, cohorte: 'nueva' | 'existente'): EstadoExperiencia {
  return {
    version: 1, uid, cohorte, primerAccesoEn: null, privacidad: null,
    entrevista: formularioVacio(), encuesta: formularioVacio(), sesiones: [], reserva: null, programa: { dias: 0, hasta: null },
  };
}

export function normalizarEstado(v: Datos | undefined, uid: string, cohorte: 'nueva' | 'existente'): EstadoExperiencia {
  if (!v) return estadoNuevo(uid, cohorte);
  const p = esObjeto(v.privacidad) ? v.privacidad : null;
  const prog = esObjeto(v.programa) ? v.programa : {};
  return {
    version: 1,
    uid,
    cohorte: v.cohorte === 'nueva' || v.cohorte === 'existente' ? v.cohorte : cohorte,
    primerAccesoEn: isoONull(v.primerAccesoEn),
    privacidad: p && typeof p.aceptadaEn === 'string'
      ? { version: typeof p.version === 'string' ? p.version : PRIVACIDAD_VERSION, aceptadaEn: p.aceptadaEn, usoAceptado: p.usoAceptado === true }
      : null,
    entrevista: normalizarFormulario(v.entrevista, 'entrevista'),
    encuesta: normalizarFormulario(v.encuesta, 'encuesta'),
    sesiones: Array.isArray(v.sesiones) ? [...new Set(v.sesiones.filter((s): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)))].slice(0, MAX_SESIONES) : [],
    reserva: normalizarReserva(v.reserva),
    programa: { dias: enteroEn(prog.dias, 0, 1000) ? prog.dias as number : 0, hasta: isoONull(prog.hasta) },
  };
}

export function normalizarConfig(v: Datos | undefined): ConfigExperiencia {
  const d = v ?? {};
  const premios = esObjeto(d.premios) ? d.premios : {};
  return {
    version: 1,
    revision: enteroEn(d.revision, 0, 1_000_000) ? d.revision as number : 0,
    campanaId: idCampanaValido(d.campanaId) ? d.campanaId : null,
    aprobado: d.aprobado === true,
    habilitada: d.habilitada === true,
    fechaInicio: isoONull(d.fechaInicio),
    fechaFin: isoONull(d.fechaFin),
    cupo: enteroEn(d.cupo, 0, 100_000) ? d.cupo as number : 0,
    // Días de la configuración del admin; si no hay (o no son válidos), los del cliente.
    premios: {
      bienvenida: diasVipValidos(premios.bienvenida) ? premios.bienvenida : PREMIOS_POR_DEFECTO.bienvenida,
      experiencia: diasVipValidos(premios.experiencia) ? premios.experiencia : PREMIOS_POR_DEFECTO.experiencia,
    },
  };
}

export function normalizarBeneficio(v: Datos | undefined, tipo: TipoBeneficio): BeneficioOtorgado | null {
  if (!v || typeof v.uid !== 'string' || !diasVipValidos(v.dias)) return null;
  return {
    uid: v.uid, tipo, campanaId: typeof v.campanaId === 'string' ? v.campanaId : '', dias: v.dias,
    otorgadoEn: isoONull(v.otorgadoEn) ?? '', hasta: isoONull(v.hasta) ?? '', venceOferta: isoONull(v.venceOferta),
  };
}

/** Respuesta de GET/PATCH /admin/experiencia/config (lista explícita de campos). */
export function configPublica(c: ConfigExperiencia, reservadas: number) {
  return {
    version: 1 as const, revision: c.revision, campanaId: c.campanaId, aprobado: c.aprobado, habilitada: c.habilitada,
    fechaInicio: c.fechaInicio, fechaFin: c.fechaFin, cupo: c.cupo, reservadas, premios: { ...c.premios },
  };
}

// ── Campaña y elegibilidad ──

export function campanaActiva(c: ConfigExperiencia, ahora: number): boolean {
  const inicio = aMillis(c.fechaInicio), fin = aMillis(c.fechaFin);
  return c.aprobado && c.habilitada && idCampanaValido(c.campanaId) && c.cupo > 0
    && Number.isFinite(inicio) && Number.isFinite(fin) && inicio < fin && inicio <= ahora && ahora < fin;
}

/**
 * ¿Tiene VIP por otra vía? Suscripción vigente (Stripe) o una cortesía que NO es la que dejó este
 * programa (la vigencia debe coincidir exactamente con la que se anotó en `programa.hasta`).
 */
export function otraFuenteVip(x: Contexto): boolean {
  if (x.esAdmin) return true;
  const { vigenciaHasta: _v, ...sinCortesia } = x.usuario;
  if (membershipAccess(sinCortesia, x.ahora).allowed) return true;
  const cortesia = aMillis(x.usuario.vigenciaHasta);
  if (!Number.isFinite(cortesia) || cortesia <= x.ahora) return false;
  const propia = x.estado.programa.dias > 0 && aMillis(x.estado.programa.hasta) === cortesia;
  return !propia;
}

function motivoPolitica(x: Contexto): string | null {
  // Sin campaña no hay nada que ofrecer: no se pide verificar el correo en vano.
  if (!campanaActiva(x.config, x.ahora)) return 'campana-inactiva';
  if (otraFuenteVip(x)) return 'otra-fuente-vip';
  if (!x.emailVerificado) return 'correo-no-verificado';
  return null;
}

function reservaVigente(x: Contexto): boolean {
  const r = x.estado.reserva;
  return !!r && r.campanaId === x.config.campanaId && aMillis(r.venceOferta) > x.ahora;
}

function motivoOferta(x: Contexto): string | null {
  const politica = motivoPolitica(x);
  if (politica) return politica;
  if (x.estado.reserva && !reservaVigente(x)) return 'oferta-vencida';
  if (!x.estado.reserva) return x.reservadas >= x.config.cupo ? 'cupo-agotado' : 'sin-reserva';
  return null;
}

/**
 * Reserva una plaza si la cuenta es elegible y hay cupo. Muta `x` y devuelve lo que hay que escribir
 * (o null). Una reserva previa de la misma campaña se reutiliza sin consumir otra plaza.
 */
export function intentarReserva(x: Contexto): { reserva: Reserva; nuevaPlaza: boolean } | null {
  if (reservaVigente(x) || motivoPolitica(x)) return null;
  if (x.reservaActual && x.reservaActual.campanaId === x.config.campanaId) {
    x.estado.reserva = x.reservaActual;
    return { reserva: x.reservaActual, nuevaPlaza: false };
  }
  if (x.estado.reserva && x.estado.reserva.campanaId === x.config.campanaId) return null; // vencida: no se renueva
  if (x.reservadas >= x.config.cupo) return null;
  const reserva: Reserva = {
    uid: x.estado.uid, campanaId: x.config.campanaId!, reservadaEn: iso(x.ahora),
    venceOferta: iso(Math.min(aMillis(x.config.fechaFin), x.ahora + 30 * DIA_MS)),
  };
  x.estado.reserva = reserva;
  x.reservaActual = reserva;
  x.reservadas += 1;
  return { reserva, nuevaPlaza: true };
}

/** Días a otorgar por completar el flujo, o null si no corresponde premio. */
export function premioAOtorgar(x: Contexto, tipo: TipoBeneficio): number | null {
  if (x.beneficios[tipo]) return null; // ya entregado: nunca dos veces
  if (tipo === 'bienvenida' && x.estado.cohorte !== 'nueva') return null;
  if (motivoOferta(x)) return null;
  const dias = x.config.premios[tipo];
  const tope = x.config.premios.bienvenida + x.config.premios.experiencia;
  if (!diasVipValidos(dias) || x.estado.programa.dias + dias > tope) return null;
  return dias;
}

export function disponibilidadEncuesta(x: Contexto): { motivo: string; disponibleEn: string | null; lista: boolean } {
  const inicio = aMillis(x.estado.primerAccesoEn);
  if (!Number.isFinite(inicio)) return { motivo: 'inicia-entrevista', disponibleEn: null, lista: false };
  const disponibleEn = iso(inicio + 7 * DIA_MS);
  if (x.ahora < inicio + 7 * DIA_MS) return { motivo: 'espera-7-dias', disponibleEn, lista: false };
  if (x.estado.sesiones.length < MAX_SESIONES) return { motivo: 'faltan-3-dias-de-uso', disponibleEn, lista: false };
  if (!x.evaluaciones.some((f) => f >= inicio && f <= x.ahora)) return { motivo: 'falta-quiz-calificado', disponibleEn, lista: false };
  return { motivo: 'uso-verificado', disponibleEn, lista: true };
}

function beneficioDTO(x: Contexto, tipo: TipoBeneficio): BeneficioDTO {
  const otorgado = x.beneficios[tipo];
  if (otorgado) return { estado: 'otorgado', dias: otorgado.dias, hasta: otorgado.hasta || null, motivo: 'beneficio-otorgado', venceOferta: otorgado.venceOferta };
  if (tipo === 'bienvenida' && x.estado.cohorte !== 'nueva') return { estado: 'no-disponible', dias: null, hasta: null, motivo: 'cuenta-existente', venceOferta: null };
  const completada = x.estado[tipo === 'bienvenida' ? 'entrevista' : 'encuesta'].estado === 'completada';
  const motivo = completada ? 'completada-sin-beneficio' : motivoOferta(x);
  if (motivo) return { estado: 'no-disponible', dias: null, hasta: null, motivo, venceOferta: x.estado.reserva?.venceOferta ?? null };
  return { estado: 'reservado', dias: x.config.premios[tipo], hasta: null, motivo: 'plaza-reservada', venceOferta: x.estado.reserva!.venceOferta };
}

/** Áreas del catálogo publicado (opciones de la pregunta «áreas»). */
export function areasDe(cursos: CursoExperiencia[]): string[] {
  return [...new Set(cursos.map((c) => c.area.trim()).filter((a) => a && a.length <= 120))].sort((a, b) => a.localeCompare(b, 'es')).slice(0, 80);
}

/** Portada aceptada por el cliente: ruta relativa propia o https. */
export function portadaSegura(v: unknown): v is string {
  if (typeof v !== 'string' || !v || v.length > 2000 || /[\x00-\x20\\]/.test(v)) return false;
  if (v.startsWith('/')) return !v.startsWith('//');
  try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}

function sinFirma(f: Formulario): Omit<Formulario, 'ultimaOperacion'> {
  const { ultimaOperacion: _u, ...resto } = f;
  return { ...resto, respuestas: { ...resto.respuestas } };
}

export function dto(x: Contexto): ExperienciaDTO {
  const elegidas = Array.isArray(x.estado.entrevista.respuestas.areas) ? x.estado.entrevista.respuestas.areas as string[] : [];
  const recomendaciones = x.cursos
    .filter((c) => elegidas.includes(c.area) && portadaSegura(c.portada))
    .sort((a, b) => a.orden - b.orden || a.id.localeCompare(b.id))
    .slice(0, 4)
    .map(({ id, titulo, area, nivel, portada }) => ({ id, titulo, area, nivel, portada }));
  const encuesta = sinFirma(x.estado.encuesta);
  const disponibilidad = disponibilidadEncuesta(x);
  let estadoEncuesta: ExperienciaDTO['encuesta']['estado'] = encuesta.estado;
  if (encuesta.estado !== 'completada' && encuesta.estado !== 'en-curso') {
    if (!disponibilidad.lista) estadoEncuesta = 'bloqueada';
    else if (encuesta.estado !== 'pospuesta' || aMillis(encuesta.pospuestaHasta) <= x.ahora) estadoEncuesta = 'disponible';
  }
  return {
    version: 1, fuente: 'api', cohorte: x.estado.cohorte, primerAccesoEn: x.estado.primerAccesoEn,
    areas: areasDe(x.cursos), recomendaciones,
    entrevista: sinFirma(x.estado.entrevista),
    encuesta: { ...encuesta, estado: estadoEncuesta, id: ENCUESTA_ID, motivo: disponibilidad.motivo, disponibleEn: disponibilidad.disponibleEn },
    beneficios: { bienvenida: beneficioDTO(x, 'bienvenida'), experiencia: beneficioDTO(x, 'experiencia') },
  };
}

// ── Respuestas ──

function textoLibre(v: unknown, campo: string, max: number, multilinea: boolean): string {
  if (typeof v !== 'string') throw new ValidationError(`"${campo}" debe ser texto.`);
  // Sin caracteres de control (salvo saltos de línea en el comentario).
  const limpio = (multilinea ? v.replace(/\r\n?/g, '\n').replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '') : v.replace(/[\x00-\x1F\x7F]/g, ' ')).trim();
  if (limpio.length > max) throw new ValidationError(`"${campo}" admite hasta ${max} caracteres.`);
  return limpio;
}

/**
 * Valida un borrador (o, con `final`, el formulario completo). Solo claves del formulario, opciones de
 * su lista, hasta 3 elecciones en roles/áreas y textos acotados. Devuelve una copia saneada.
 */
export function validarRespuestas(respuestas: unknown, flujo: Flujo, areas: string[], final = false): Record<string, unknown> {
  if (!esObjeto(respuestas)) throw new ValidationError('"respuestas" debe ser un objeto.');
  if (Object.keys(respuestas).some((k) => !PERMITIDAS[flujo].includes(k))) throw new ValidationError('Hay respuestas no admitidas.');
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(respuestas)) {
    if (k === 'roles' || k === 'areas') {
      const opciones: readonly string[] = k === 'areas' ? areas : OPCIONES.roles;
      if (!Array.isArray(v) || v.length < (final ? 1 : 0) || v.length > 3 || new Set(v).size !== v.length || v.some((x) => typeof x !== 'string' || !opciones.includes(x))) {
        throw new ValidationError(`"${k}" admite ${final ? 'entre 1 y 3' : 'hasta 3'} opciones distintas de la lista.`);
      }
      if (k === 'roles' && v.includes('prefiero-no-decir') && v.length !== 1) throw new ValidationError('"prefiero-no-decir" se elige sola.');
      salida[k] = [...v];
    } else if (k === 'facilidad' || k === 'utilidad') {
      salida[k] = entero(v, k, 0, 5); // 0 = «todavía no puedo evaluarlo»
    } else if (k in TEXTOS) {
      salida[k] = textoLibre(v, k, TEXTOS[k], k === 'comentario');
    } else {
      if (k === 'etapa' && v === '') continue; // «prefiero indicarlo después»
      if (typeof v !== 'string' || !(OPCIONES[k as ClaveOpcion] as readonly string[]).includes(v)) throw new ValidationError(`"${k}" no es una opción válida.`);
      salida[k] = v;
    }
  }
  return salida;
}

export function completa(respuestas: Record<string, unknown>, flujo: Flujo): boolean {
  return REQUERIDAS[flujo].every((k) => Object.hasOwn(respuestas, k));
}

/**
 * Control de concurrencia por revisión. Devuelve true si es el reintento idéntico de la última
 * operación (responder sin volver a aplicarla); lanza 409 si otra sesión guardó antes.
 */
export function revisar(f: Formulario, revision: number, firma: string): boolean {
  if (f.revision === revision) return false;
  if (f.revision === revision + 1 && f.ultimaOperacion === firma) return true;
  throw new CodedError(409, 'revision_desactualizada', 'Tus respuestas cambiaron en otra sesión. Recarga antes de continuar.', { revisionActual: f.revision });
}

// ── Resumen del admin (agregado, sin respuestas por persona ni textos libres) ──

type Conteo = Record<string, number>;
export function resumen(cuentas: Datos[], otorgados: Datos[], config: ConfigExperiencia, reservadas: number) {
  const lista = cuentas.map((d) => normalizarEstado(d, typeof d.uid === 'string' ? d.uid : '', 'existente'));
  const contar = (flujo: Flujo, estado: EstadoFormulario) => lista.filter((s) => s[flujo].estado === estado).length;
  const terminadas = (flujo: Flujo) => lista.filter((s) => s[flujo].estado === 'completada').map((s) => s[flujo].respuestas);
  const porOpcion = (respuestas: Record<string, unknown>[], clave: string, opciones?: readonly string[]): Conteo => {
    const conteo: Conteo = Object.fromEntries((opciones ?? []).map((o) => [o, 0]));
    for (const r of respuestas) {
      for (const v of Array.isArray(r[clave]) ? r[clave] as unknown[] : [r[clave]]) {
        if (typeof v !== 'string' || !v || v.length > 120) continue;
        if (opciones ? Object.hasOwn(conteo, v) : Object.keys(conteo).length < 60 || Object.hasOwn(conteo, v)) conteo[v] = (conteo[v] ?? 0) + 1;
      }
    }
    return conteo;
  };
  const escala = (respuestas: Record<string, unknown>[], clave: string) => {
    const valores = respuestas.map((r) => r[clave]).filter((v): v is number => enteroEn(v, 0, 5));
    const evaluadas = valores.filter((v) => v > 0);
    return {
      respuestas: evaluadas.length, sinEvaluar: valores.length - evaluadas.length,
      promedio: evaluadas.length ? Math.round(evaluadas.reduce((a, b) => a + b, 0) / evaluadas.length * 10) / 10 : null,
    };
  };
  const entrevistas = terminadas('entrevista'), encuestas = terminadas('encuesta');
  const beneficios = (tipo: TipoBeneficio) => {
    const de = otorgados.filter((b) => b.tipo === tipo && diasVipValidos(b.dias));
    return { otorgados: de.length, dias: de.reduce((n, b) => n + (b.dias as number), 0) };
  };
  return {
    version: 1 as const,
    cuentas: lista.length,
    entrevistas: { pendientes: contar('entrevista', 'pendiente'), enCurso: contar('entrevista', 'en-curso'), pospuestas: contar('entrevista', 'pospuesta'), completadas: contar('entrevista', 'completada') },
    encuestas: { enCurso: contar('encuesta', 'en-curso'), pospuestas: contar('encuesta', 'pospuesta'), completadas: contar('encuesta', 'completada') },
    sesionesRegistradas: lista.reduce((n, s) => n + s.sesiones.length, 0),
    beneficios: { bienvenida: beneficios('bienvenida'), experiencia: beneficios('experiencia') },
    campana: { campanaId: config.campanaId, reservadas, cupo: config.cupo },
    resultados: {
      entrevista: {
        total: entrevistas.length,
        roles: porOpcion(entrevistas, 'roles', OPCIONES.roles),
        objetivo: porOpcion(entrevistas, 'objetivo', OPCIONES.objetivo),
        areas: porOpcion(entrevistas, 'areas'),
        experiencia: porOpcion(entrevistas, 'experiencia', OPCIONES.experiencia),
        formato: porOpcion(entrevistas, 'formato', OPCIONES.formato),
        tiempo: porOpcion(entrevistas, 'tiempo', OPCIONES.tiempo),
        origen: porOpcion(entrevistas, 'origen', OPCIONES.origen),
      },
      encuesta: {
        total: encuestas.length,
        facilidad: escala(encuestas, 'facilidad'),
        utilidad: escala(encuestas, 'utilidad'),
        dificultad: porOpcion(encuestas, 'dificultad', OPCIONES.dificultad),
      },
    },
  };
}

// ── Configuración del admin ──

const CAMPOS_CONFIG = ['revision', 'campanaId', 'aprobado', 'habilitada', 'fechaInicio', 'fechaFin', 'cupo'];

/** Valida el cuerpo de PATCH /admin/experiencia/config. Los días de premio NO se cambian por aquí. */
export function cambiosConfig(body: unknown): { revision: number; campos: Partial<ConfigExperiencia> } {
  const b = cuerpo(body, CAMPOS_CONFIG);
  const revision = entero(b.revision, 'revision', 0, 1_000_000);
  const campos: Partial<ConfigExperiencia> = {};
  if (Object.hasOwn(b, 'campanaId')) {
    if (b.campanaId !== null && !idCampanaValido(b.campanaId)) throw new ValidationError('"campanaId" debe contener letras, números, guiones o guion bajo (1–80).');
    campos.campanaId = b.campanaId as string | null;
  }
  for (const k of ['aprobado', 'habilitada'] as const) {
    if (!Object.hasOwn(b, k)) continue;
    if (typeof b[k] !== 'boolean') throw new ValidationError(`"${k}" debe ser true o false.`);
    campos[k] = b[k] as boolean;
  }
  if (Object.hasOwn(b, 'cupo')) campos.cupo = entero(b.cupo, 'cupo', 0, 100_000);
  for (const k of ['fechaInicio', 'fechaFin'] as const) {
    if (!Object.hasOwn(b, k)) continue;
    const v = b[k];
    if (v === null) { campos[k] = null; continue; }
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(v) || !Number.isFinite(Date.parse(v))) {
      throw new ValidationError(`"${k}" debe ser una fecha ISO con zona horaria o null.`);
    }
    campos[k] = iso(Date.parse(v));
  }
  if (!Object.keys(campos).length) throw new ValidationError('Incluye al menos un campo de configuración.');
  return { revision, campos };
}

export function validarHabilitada(c: ConfigExperiencia, ahora: number): void {
  if (!c.habilitada) return;
  const inicio = aMillis(c.fechaInicio), fin = aMillis(c.fechaFin);
  if (!(c.aprobado && idCampanaValido(c.campanaId) && c.cupo > 0 && Number.isFinite(inicio) && Number.isFinite(fin) && inicio < fin && fin > ahora)) {
    throw new ValidationError('Para habilitar se requiere aprobación, campaña, fechas vigentes y cupo mayor que cero.');
  }
}
