// Academia Dermalysse: capa de datos.
// - Modo demo (sin VITE_API_URL): el contenido se carga del repositorio bajo demanda y el avance vive en
//   localStorage. Las reglas son LAS MISMAS que aplica la API (acceso, desbloqueo, temas leídos, espera
//   tras reprobar y no revelar respuestas sin aprobar). Sirve para diseño y revisión, no como prueba de
//   producción.
// - Modo API: todo pasa por /academia; acceso, desbloqueo y calificación los decide el servidor.
// El catálogo (títulos de programas y módulos) es público y viaja en el bundle. Los módulos NO: con
// VITE_API_URL la rama de import.meta.glob desaparece y el contenido llega solo desde la API.
import catalogoJson from '../../api/content/academia/catalogo.json';
import imagenesJson from '../data/academia-imagenes.json';
import { api, Auth } from './auth';
import { asset } from './base-url';
import { Datos } from './datos';

// ── Tipos del contenido (docs/ACADEMIA-FORMATO.md) ──
export interface ModuloCatalogo {
  n: number; titulo: string; disponible?: boolean; estado?: string | null; temas?: number; duracionMin?: number | null;
  /** Instante (ISO) en que se abre según el calendario de lanzamiento; null si el programa no tiene calendario. */
  disponibleDesde?: string | null;
  /** true mientras no llegue disponibleDesde (en API lo decide el servidor). */
  programado?: boolean;
}
export interface Lanzamiento { inicio: string; cadaDias: number }
export interface Programa {
  id: string; numero: number; titulo: string; area: string; descripcion: string; nivel: string; publico: string[];
  portada: { id: string; proporcion: string };
  /** Calendario efectivo (ajuste del admin ?? catálogo). En el JSON del catálogo, cadaDias puede faltar. */
  lanzamiento?: { inicio: string; cadaDias?: number } | null;
  modulos: ModuloCatalogo[];
}
export interface PreguntaA { id: string; q: string; opciones: string[]; correcta?: number; explicacion?: string }
export type Actividad =
  | { actividad: 'ordenar'; titulo: string; instruccion?: string; elementos: string[] }
  | { actividad: 'relacionar'; titulo: string; instruccion?: string; pares: { a: string; b: string }[] }
  | { actividad: 'vf'; titulo: string; afirmaciones: { texto: string; verdadero: boolean; explicacion: string }[] }
  | { actividad: 'caso'; titulo: string; situacion: string; opciones: { texto: string; correcta: boolean; retro: string }[] }
  | { actividad: 'calculadora'; titulo: string; instruccion?: string; formula: string; variables: { id: string; etiqueta: string; valor: number; unidad?: string }[]; resultado: { expresion: string; etiqueta: string; unidad?: string; decimales?: number } };
export type Bloque =
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'texto'; md: string }
  | { tipo: 'lista'; titulo?: string; items: string[]; ordenada?: boolean }
  | { tipo: 'pasos'; titulo: string; pasos: { titulo: string; md: string }[] }
  | { tipo: 'tabla'; titulo: string; columnas: string[]; filas: string[][] }
  | { tipo: 'recuadro'; variante: 'atencion' | 'sabias' | 'profundizar' | 'ejemplo' | 'mexico'; titulo: string; md: string }
  | { tipo: 'figura'; id: string; proporcion: string; alt: string; pie: string; prompt?: string }
  | { tipo: 'diagrama'; id: string; pie: string; descripcion: string; elementos: string[] }
  | { tipo: 'cita'; texto: string; autor: string }
  | (Actividad & { tipo: 'actividad' });
export interface Tema {
  n: string; titulo: string; minutos: number; enPocasPalabras: string; bloques: Bloque[];
  glosario: { termino: string; definicion: string }[]; verificacion: PreguntaA[];
}
export type Minijuego =
  | { tipo: 'sopa'; titulo: string; palabras?: string[] }
  | { tipo: 'crucigrama'; titulo: string; pistas?: { palabra: string; pista: string }[] }
  | { tipo: 'memorama'; titulo: string; pares?: { a: string; b: string }[] };
export interface Modulo {
  programa: string; modulo: number; titulo: string; estado: string; resumen: string; objetivos: string[]; duracionMin: number;
  portada?: { id: string; proporcion: string; alt: string };
  temas: Tema[]; minijuego?: Minijuego;
  examen: { aprobar: number; mostrar: number; total?: number; preguntas?: PreguntaA[] };
}
export interface AvanceJuego {
  version: string; tipo: Minijuego['tipo']; resueltos: string[]; jugadas: number; errores: number; completado: boolean;
  iniciadoEn: string; actualizadoEn: string; completadoEn?: string; recompensaAcreditada?: boolean;
}
export interface AvanceModulo { temas?: Record<string, string>; juego?: AvanceJuego; mejor?: number; intentos?: number; aprobado?: boolean; aprobadoEn?: string }
export type Avance = Record<string, { modulos?: Record<string, AvanceModulo> }>;
export interface JuegoAcademia {
  version: string; tipo: Minijuego['tipo']; titulo: string; total: number;
  recompensa: { diamantes: number; acreditada: boolean };
  progreso: { resueltos: string[]; marcadas: string[]; jugadas: number; errores: number; puntaje: number; completado: boolean; completadoEn: string | null; recompensaAcreditada: boolean };
  tablero: Record<string, unknown>;
  acierto?: boolean; diamantesGanados?: number; saldoDiamantes?: number | null;
}
export interface ExamenEmitido { aprobar: number; total: number; preguntas: PreguntaA[] }
export interface DetalleExamen { id: string; acertada: boolean; correcta?: number; explicacion?: string }
export interface ResultadoExamen {
  correctas: number; total: number; porcentaje: number; aprobado: boolean; mejor: number;
  /** false: el módulo no está aprobado y la respuesta no trae ni la opción correcta ni la explicación. */
  revelado: boolean;
  detalle: DetalleExamen[];
  siguiente: number | null; programaCompleto: boolean;
}
export type EstadoRevision = 'borrador' | 'revision' | 'aprobado';
export interface FilaRevision {
  n: number; titulo: string; existe: boolean; estadoArchivo: string | null; estado: string | null; nota: string;
  revision: { estado: string; revisor: string; fecha: string; nota: string } | null;
  palabras: number; figuras: number; actividades: number; temas: number; preguntas: number;
  disponibleDesde: string | null; programado: boolean;
}
export interface LanzamientoAdmin extends Lanzamiento {
  origen: 'admin' | 'catalogo';
  catalogo: Lanzamiento | null;
  ajuste: { por: string; fecha: string } | null;
}
export interface ProgramaRevision { id: string; numero: number | null; titulo: string; area: string; lanzamiento: LanzamientoAdmin | null; modulos: FilaRevision[] }

export const APROBATORIO = 70;
export const ESPERA_EXAMEN_MS = 3 * 60 * 1000;
const MODO_API = Datos.modo === 'api';
export const academiaUsaApi = () => MODO_API;

/** Error con el código que también usa la API (requiere_vip, modulo_bloqueado, modulo_programado, …). */
export class ErrorAcademia extends Error {
  codigo: string;
  /** Solo en modulo_programado: instante (ISO) en que se abre el módulo. */
  disponibleDesde?: string;
  constructor(codigo: string, mensaje: string, disponibleDesde?: string) {
    super(mensaje); this.codigo = codigo;
    if (disponibleDesde) this.disponibleDesde = disponibleDesde;
  }
}
const comoError = (e: unknown, defecto: string) => {
  if (e instanceof ErrorAcademia) return e;
  const err = e as { status?: number; codigo?: string; message?: string; datos?: { disponibleDesde?: unknown } };
  const desde = typeof err?.datos?.disponibleDesde === 'string' ? err.datos.disponibleDesde : undefined;
  return new ErrorAcademia(err?.codigo || String(err?.status || 'error'), err?.message || defecto, desde);
};

// ── Calendario de lanzamiento ──
// El módulo n se abre en inicio + (n − 1) × cadaDias días, a las 00:00 de la Ciudad de México
// (UTC−6 todo el año). Misma cuenta que la API (api/src/services/academia.ts).
const DESFASE_MX_MS = -6 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const CADA_DIAS_DEFECTO = 7;
export function fechaCalendarioValida(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 && y <= 2100 && f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}
const cadaDiasValido = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 60;
/** Fecha (YYYY-MM-DD) en la Ciudad de México de un instante; por defecto, hoy. */
export const fechaMexico = (ms = Date.now()) => new Date(ms + DESFASE_MX_MS).toISOString().slice(0, 10);
export function disponibleDesdeDe(l: Lanzamiento | null | undefined, n: number): string | null {
  if (!l || !fechaCalendarioValida(l.inicio)) return null;
  const [y, m, d] = l.inicio.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - DESFASE_MX_MS + (n - 1) * l.cadaDias * DIA_MS).toISOString();
}
const lanzamientoDelCatalogo = (p: Programa): Lanzamiento | null => {
  const l = p.lanzamiento;
  return l && fechaCalendarioValida(l.inicio) ? { inicio: l.inicio, cadaDias: cadaDiasValido(l.cadaDias) ? l.cadaDias : CADA_DIAS_DEFECTO } : null;
};
const programadoEn = (desde: string | null | undefined) => !!desde && Date.now() < Date.parse(desde);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** «jueves 22 de octubre» (con «de 2027» si no es el año en curso), en es-MX y hora de Ciudad de México. */
export function fechaLanzamiento(iso: string): string {
  const [y, m, d] = fechaMexico(Date.parse(iso)).split('-').map(Number);
  const dia = new Intl.DateTimeFormat('es-MX', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  const anio = String(y) === fechaMexico().slice(0, 4) ? '' : ` de ${y}`;
  return `${dia} ${d} de ${MESES[m - 1]}${anio}`;
}
/** «faltan 7 días», «mañana» u «hoy a las 00:00», contando días de calendario en Ciudad de México. */
export function cuentaLanzamiento(iso: string): string {
  const dias = Math.round((Date.parse(`${fechaMexico(Date.parse(iso))}T00:00:00Z`) - Date.parse(`${fechaMexico()}T00:00:00Z`)) / DIA_MS);
  return dias > 1 ? `faltan ${dias} días` : dias === 1 ? 'mañana' : 'hoy a las 00:00';
}
/** «Disponible el jueves 22 de octubre · faltan 7 días». */
export const textoLanzamiento = (iso: string) => `Disponible el ${fechaLanzamiento(iso)} · ${cuentaLanzamiento(iso)}`;
/** El módulo está cerrado por fecha para quien lo ve (el admin con efecto lo salta, como los demás candados). */
export const moduloProgramado = (m: ModuloCatalogo | undefined) => !!m?.programado && !esAdminAcademia();

// ── Catálogo público (bundle) ──
export const programas: Programa[] = ((catalogoJson as unknown as { programas: Programa[] }).programas ?? []).filter((p) => !p.id.startsWith('_'));
export const programa = (id: string) => programas.find((p) => p.id === id);

// ── Imágenes: solo las que ya existen en public/academia (manifiesto src/data/academia-imagenes.json) ──
const imagenes = new Set<string>((imagenesJson as { ids: string[] }).ids);
export const urlImagen = (id: string) => (imagenes.has(id) ? asset(`academia/${id}.webp`) : null);

// ── Contenido local (solo demo) ──
// Con VITE_API_URL la condición es constante y el bundler elimina la rama: el contenido no viaja público.
const RAIZ = '../../api/content/academia';
const locales: Record<string, () => Promise<unknown>> = import.meta.env.VITE_API_URL
  ? {}
  : import.meta.glob(['../../api/content/academia/*/modulo-*.json', '!../../api/content/academia/_*/**'], { import: 'default' });
const rutaLocal = (p: string, n: number) => `${RAIZ}/${p}/modulo-${String(n).padStart(2, '0')}.json`;
export const moduloDisponibleLocal = (p: string, n: number) => !!locales[rutaLocal(p, n)];

const uid = () => Auth.usuario?.uid || 'anonimo';
function leerLS<T>(clave: string, defecto: T): T {
  try { const v = JSON.parse(localStorage.getItem(clave) || 'null'); return v && typeof v === 'object' ? v : defecto; } catch { return defecto; }
}
function escribirLS(clave: string, valor: unknown) { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ } }

// ── Modo revisor del demo: el usuario demo es admin, pero sin este modo vive el flujo normal de un miembro ──
const CLAVE_REVISOR = 'dermalysse:academia:modo-revisor';
export function modoRevisorDemo() { try { return !MODO_API && localStorage.getItem(CLAVE_REVISOR) === '1'; } catch { return false; } }
export function alternarModoRevisorDemo() { try { if (modoRevisorDemo()) localStorage.removeItem(CLAVE_REVISOR); else localStorage.setItem(CLAVE_REVISOR, '1'); } catch { /* sin almacenamiento */ } }
/** Admin con efecto en la Academia: en API, el claim verificado; en demo, solo con el modo revisor. */
export const esAdminAcademia = () => !!Auth.usuario?.esAdmin && (MODO_API || modoRevisorDemo());
const esVip = () => !!Auth.usuario?.esVip;

// ── Revisiones editoriales del demo (en API viven en el servidor) ──
const CLAVE_REVISIONES = 'dermalysse:academia:revisiones:demo';
type RevisionLocal = { estado: EstadoRevision; nota: string; fecha: string };
const revisionesLocales = () => leerLS<Record<string, RevisionLocal>>(CLAVE_REVISIONES, {});
const claveRev = (p: string, n: number) => `${p}/${n}`;
const estadoValido = (e: unknown): e is EstadoRevision => e === 'borrador' || e === 'revision' || e === 'aprobado';
const estadoEfectivoLocal = (p: string, n: number, m: Modulo | null) => {
  if (!m) return null;
  const r = revisionesLocales()[claveRev(p, n)];
  return r && estadoValido(r.estado) ? r.estado : estadoValido(m.estado) ? m.estado : 'borrador';
};

// ── Ajustes del calendario en el demo (en API viven en el servidor) ──
const CLAVE_LANZAMIENTOS = 'dermalysse:academia:lanzamiento:demo';
type AjusteLocal = { inicio: string; cadaDias?: number; fecha: string };
const ajustesLocales = () => leerLS<Record<string, AjusteLocal>>(CLAVE_LANZAMIENTOS, {});
/** Calendario efectivo del demo: ajuste local ?? catálogo. */
function lanzamientoLocal(p: Programa): LanzamientoAdmin | null {
  const cat = lanzamientoDelCatalogo(p);
  const a = ajustesLocales()[p.id];
  if (a && fechaCalendarioValida(a.inicio)) {
    return { inicio: a.inicio, cadaDias: cadaDiasValido(a.cadaDias) ? a.cadaDias : cat?.cadaDias ?? CADA_DIAS_DEFECTO, origen: 'admin', catalogo: cat, ajuste: { por: 'demo', fecha: a.fecha } };
  }
  return cat ? { ...cat, origen: 'catalogo', catalogo: cat, ajuste: null } : null;
}

// ── Estado remoto (modo API) ──
let avanceRemoto: Avance = {};
let catalogoRemoto: Programa[] | null = null;
let catalogoEn = 0;
let uidCargado: string | null = null;
const TTL = 30_000;
const cacheModulos = new Map<string, Modulo>();

function revisarUsuario() {
  const actual = Auth.usuario?.uid ?? null;
  if (actual !== uidCargado) {
    uidCargado = actual;
    avanceRemoto = {}; catalogoRemoto = null; catalogoEn = 0; cacheModulos.clear();
  }
}

/** Catálogo con disponibilidad por módulo. En API también refresca el avance de la cuenta. */
export async function cargarCatalogo(forzar = false): Promise<Programa[]> {
  if (!MODO_API) {
    const rev = revisionesLocales();
    return programas.map((p) => {
      const l = lanzamientoLocal(p);
      return {
        ...p,
        lanzamiento: l ? { inicio: l.inicio, cadaDias: l.cadaDias } : null,
        // El demo funciona como ACADEMIA_MOSTRAR_BORRADORES: muestra borradores con su aviso de vista previa.
        modulos: p.modulos.map((m) => {
          const desde = disponibleDesdeDe(l, m.n);
          return {
            ...m, disponible: moduloDisponibleLocal(p.id, m.n), estado: moduloDisponibleLocal(p.id, m.n) ? rev[claveRev(p.id, m.n)]?.estado ?? null : null,
            disponibleDesde: desde, programado: programadoEn(desde),
          };
        }),
      };
    });
  }
  revisarUsuario();
  if (catalogoRemoto && !forzar && Date.now() - catalogoEn < TTL) return catalogoRemoto;
  try {
    const r = await api<{ programas: Programa[]; progreso: Avance }>('/academia');
    catalogoRemoto = r.programas;
    avanceRemoto = r.progreso ?? {};
    catalogoEn = Date.now();
    return catalogoRemoto;
  } catch (e) { throw comoError(e, 'No se pudo cargar la Academia.'); }
}

/**
 * Módulo del catálogo ya cargado, con su fecha (sin pedir nada a la red). En API, el último catálogo
 * recibido; en el demo, se calcula al momento. Sirve para avisos como «el módulo 2 se abre el …».
 */
export function infoModulo(p: string, n: number): ModuloCatalogo | undefined {
  if (MODO_API) return catalogoRemoto?.find((x) => x.id === p)?.modulos.find((m) => m.n === n);
  const prog = programa(p);
  const m = prog?.modulos.find((x) => x.n === n);
  if (!prog || !m) return undefined;
  const desde = disponibleDesdeDe(lanzamientoLocal(prog), n);
  return { ...m, disponibleDesde: desde, programado: programadoEn(desde) };
}

async function moduloLocalCrudo(p: string, n: number): Promise<Modulo | null> {
  const cargar = locales[rutaLocal(p, n)];
  if (!cargar) return null;
  const clave = `${p}/${n}`;
  const guardado = cacheModulos.get(clave);
  if (guardado) return guardado;
  try {
    const m = (await cargar()) as Modulo;
    cacheModulos.set(clave, m);
    return m;
  } catch { return null; }
}

/** Mismas reglas que la API, en el mismo orden: existencia, fecha de lanzamiento, visibilidad, VIP, desbloqueo. */
async function prepararLocal(p: string, n: number): Promise<Modulo> {
  const prog = programa(p);
  if (!prog || !prog.modulos.some((x) => x.n === n)) throw new ErrorAcademia('no-encontrado', 'Este módulo no existe.');
  const admin = esAdminAcademia();
  // Igual que la API: la fecha va primero y el admin (en el demo, solo con el modo revisor) la salta.
  const desde = disponibleDesdeDe(lanzamientoLocal(prog), n);
  if (!admin && desde && programadoEn(desde)) throw new ErrorAcademia('modulo_programado', 'Este módulo todavía no está disponible. Se abre en la fecha indicada.', desde);
  const m = await moduloLocalCrudo(p, n);
  if (!m) throw new ErrorAcademia('modulo_en_preparacion', 'Este módulo está en preparación.');
  if (n > 1 && !esVip() && !admin) throw new ErrorAcademia('requiere_vip', 'Este módulo es para miembros VIP. El módulo 1 de cada programa es gratis.');
  if (n > 1 && !admin && !moduloAprobado(p, n - 1)) throw new ErrorAcademia('modulo_bloqueado', `Aprueba el examen del módulo ${n - 1} con 70 % o más para desbloquear este módulo.`);
  return { ...m, estado: estadoEfectivoLocal(p, n, m) ?? 'borrador' };
}

export async function cargarModulo(p: string, n: number): Promise<Modulo> {
  if (!MODO_API) return prepararLocal(p, n);
  revisarUsuario();
  const clave = `${p}/${n}`;
  const guardado = cacheModulos.get(clave);
  if (guardado) return guardado;
  try {
    const m = await api<Modulo>(`/academia/${encodeURIComponent(p)}/${n}`);
    cacheModulos.set(clave, m);
    return m;
  } catch (e) { throw comoError(e, 'No se pudo cargar el módulo.'); }
}

// ── Avance ──
const claveAvance = () => `dermalysse:academia:v1:${uid()}`;
const leerLocal = (): Avance => leerLS<Avance>(claveAvance(), {});
export const avance = (): Avance => (MODO_API ? avanceRemoto : leerLocal());
export const avanceModulo = (p: string, n: number): AvanceModulo => avance()[p]?.modulos?.[String(n)] ?? {};
export async function refrescarAvance() {
  if (!MODO_API) return;
  revisarUsuario();
  avanceRemoto = await api<Avance>('/academia/progreso');
}

function mutarLocal(p: string, n: number, fn: (m: AvanceModulo) => void) {
  const a = leerLocal();
  const prog = (a[p] ||= {}); const mods = (prog.modulos ||= {}); fn((mods[String(n)] ||= {}));
  escribirLS(claveAvance(), a);
}
function mutarCache(p: string, n: number, fn: (m: AvanceModulo) => void) {
  const prog = (avanceRemoto[p] ||= {}); const mods = (prog.modulos ||= {}); fn((mods[String(n)] ||= {}));
}

// Respaldo local de los temas que el servidor ya confirmó: si responde temas_pendientes
// (p. ej. reinició su memoria en desarrollo), se reenvían una vez antes de reintentar el examen.
const claveLeidos = () => `dermalysse:academia:leidos:${uid()}`;
function recordarLeido(p: string, n: number, tema: string) {
  const todos = leerLS<Record<string, string[]>>(claveLeidos(), {});
  const k = `${p}/${n}`;
  if (!(todos[k] ||= []).includes(tema)) todos[k].push(tema);
  escribirLS(claveLeidos(), todos);
}
const temasConocidos = (p: string, n: number) => [...new Set([...Object.keys(avanceModulo(p, n).temas || {}), ...(leerLS<Record<string, string[]>>(claveLeidos(), {})[`${p}/${n}`] || [])])];
const postTema = (p: string, n: number, tema: string) => api<{ ok: boolean; temas?: Record<string, string> }>(`/academia/${encodeURIComponent(p)}/${n}/tema`, { method: 'POST', json: { tema } });

/** Marca un tema como leído. Devuelve false si no se pudo registrar (la marca optimista se revierte). */
export async function marcarTemaLeido(p: string, n: number, tema: string): Promise<boolean> {
  const ahora = new Date().toISOString();
  if (!MODO_API) { mutarLocal(p, n, (m) => { (m.temas ||= {})[tema] ||= ahora; }); return true; }
  if (avanceModulo(p, n).temas?.[tema]) return true;
  mutarCache(p, n, (m) => { (m.temas ||= {})[tema] = ahora; });
  try {
    const r = await postTema(p, n, tema);
    if (r?.temas) mutarCache(p, n, (m) => { m.temas = { ...(m.temas || {}), ...r.temas }; });
    recordarLeido(p, n, tema);
    return true;
  } catch {
    mutarCache(p, n, (m) => { if (m.temas) delete m.temas[tema]; });
    return false;
  }
}

// En demo la marca sigue local y se identifica como vista previa. En API, tablero, validación,
// progreso y recompensa vienen del servidor; nunca se sustituyen con el contenido local.
const claveJuegos = () => `dermalysse:academia:juegos:${uid()}`;
const cacheJuegos = new Map<string, JuegoAcademia>();
export function marcarJuego(p: string, n: number) {
  if (MODO_API) return;
  const j = leerLS<Record<string, string>>(claveJuegos(), {});
  j[`${p}/${n}`] ||= new Date().toISOString();
  escribirLS(claveJuegos(), j);
}
export const juegoCompletado = (p: string, n: number) => MODO_API
  ? cacheJuegos.get(`${p}/${n}`)?.progreso.completado === true || avanceModulo(p, n).juego?.completado === true
  : !!leerLS<Record<string, string>>(claveJuegos(), {})[`${p}/${n}`];

export async function cargarJuegoRemoto(p: string, n: number): Promise<JuegoAcademia> {
  if (!MODO_API) throw new ErrorAcademia('juego_demo', 'El demo prepara el laboratorio desde el contenido local.');
  try {
    const juego = await api<JuegoAcademia>(`/academia/${encodeURIComponent(p)}/${n}/juego`);
    cacheJuegos.set(`${p}/${n}`, juego);
    return juego;
  } catch (e) { throw comoError(e, 'No se pudo cargar el laboratorio.'); }
}

export async function enviarJugadaRemota(p: string, n: number, entrada: Record<string, unknown>): Promise<JuegoAcademia> {
  try {
    const juego = await api<JuegoAcademia>(`/academia/${encodeURIComponent(p)}/${n}/juego`, { method: 'POST', json: entrada });
    cacheJuegos.set(`${p}/${n}`, juego);
    const anterior = avanceModulo(p, n).juego;
    mutarCache(p, n, (a) => {
      a.juego = {
        version: juego.version, tipo: juego.tipo, resueltos: [...juego.progreso.resueltos], jugadas: juego.progreso.jugadas,
        errores: juego.progreso.errores, completado: juego.progreso.completado,
        iniciadoEn: anterior?.iniciadoEn || new Date().toISOString(), actualizadoEn: new Date().toISOString(),
        ...(juego.progreso.completadoEn ? { completadoEn: juego.progreso.completadoEn } : {}),
        recompensaAcreditada: juego.progreso.recompensaAcreditada,
      };
    });
    return juego;
  } catch (e) { throw comoError(e, 'No se pudo validar la jugada.'); }
}

export const moduloAprobado = (p: string, n: number) => !!avanceModulo(p, n).aprobado;
/** Pista visual del candado (la decisión real la toma la API o prepararLocal). */
export const moduloDesbloqueado = (p: string, n: number) => n === 1 || moduloAprobado(p, n - 1) || esAdminAcademia();
export const puedeVip = () => esVip() || esAdminAcademia();
export function temasLeidos(p: string, m: Modulo) { const t = avanceModulo(p, m.modulo).temas || {}; return m.temas.filter((x) => t[x.n]).length; }

export function resumenPrograma(p: Programa) {
  const aprobados = p.modulos.filter((m) => moduloAprobado(p.id, m.n)).length;
  const siguiente = p.modulos.find((m) => !moduloAprobado(p.id, m.n))?.n ?? p.modulos.length;
  const iniciado = Object.keys(avance()[p.id]?.modulos || {}).length > 0;
  const total = p.modulos.length || 1;
  return { aprobados, total: p.modulos.length, pct: Math.round((aprobados / total) * 100), siguiente, iniciado, completo: p.modulos.length > 0 && aprobados === p.modulos.length };
}

// ── Examen ──
interface IntentoLocal { ids: string[]; calificado: boolean; ultimo?: { aprobado: boolean; fecha: string } }
const claveIntentos = () => `dermalysse:academia:intentos:v1:${uid()}`;
const leerIntentos = () => leerLS<Record<string, IntentoLocal>>(claveIntentos(), {});

function barajar<T>(lista: T[]) {
  const b = [...lista];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

const rutaExamen = (p: string, n: number) => `/academia/${encodeURIComponent(p)}/${n}/examen`;

export async function emitirExamen(p: string, n: number): Promise<ExamenEmitido> {
  if (MODO_API) {
    try { return await api<ExamenEmitido>(rutaExamen(p, n)); }
    catch (e) {
      const err = comoError(e, 'No se pudo iniciar el examen.');
      if (err.codigo !== 'temas_pendientes') throw err;
      // Reenvía una vez los temas que este navegador sabe leídos y reintenta.
      const conocidos = temasConocidos(p, n);
      if (!conocidos.length) throw err;
      await Promise.allSettled(conocidos.map((t) => postTema(p, n, t)));
      try { return await api<ExamenEmitido>(rutaExamen(p, n)); } catch (e2) { throw comoError(e2, 'No se pudo iniciar el examen.'); }
    }
  }
  const m = await prepararLocal(p, n);
  const banco = m.examen.preguntas || [];
  if (!banco.length) throw new ErrorAcademia('examen_no_disponible', 'Este módulo todavía no tiene examen.');
  const intentos = leerIntentos();
  const clave = `${p}/${n}`;
  if (!esAdminAcademia()) {
    const faltan = m.temas.length - temasLeidos(p, m);
    if (faltan > 0) throw new ErrorAcademia('temas_pendientes', `Lee ${faltan === 1 ? 'el tema que falta' : `los ${faltan} temas que faltan`} para presentar el examen.`);
    const ultimo = intentos[clave]?.ultimo;
    if (ultimo && !ultimo.aprobado) {
      const restante = Date.parse(ultimo.fecha) + ESPERA_EXAMEN_MS - Date.now();
      if (restante > 0) { const min = Math.ceil(restante / 60000); throw new ErrorAcademia('espera_examen', `Repasa los temas y vuelve a intentarlo en ${min} minuto${min === 1 ? '' : 's'}.`); }
    }
  }
  const elegidas = barajar(banco).slice(0, Math.min(m.examen.mostrar || 10, banco.length));
  intentos[clave] = { ids: elegidas.map((q) => q.id), calificado: false, ...(intentos[clave]?.ultimo ? { ultimo: intentos[clave].ultimo } : {}) };
  escribirLS(claveIntentos(), intentos);
  return { aprobar: m.examen.aprobar || APROBATORIO, total: elegidas.length, preguntas: elegidas.map(({ id, q, opciones }) => ({ id, q, opciones })) };
}

export async function calificarExamen(p: string, n: number, respuestas: Record<string, number | null>): Promise<ResultadoExamen> {
  if (MODO_API) {
    let r: ResultadoExamen;
    try { r = await api<ResultadoExamen>(rutaExamen(p, n), { method: 'POST', json: { respuestas } }); }
    catch (e) { throw comoError(e, 'No se pudo calificar el examen.'); }
    mutarCache(p, n, (a) => { a.mejor = r.mejor; a.intentos = (a.intentos || 0) + 1; if (r.aprobado) a.aprobado = true; });
    catalogoEn = 0;
    if (r.aprobado) cacheModulos.delete(`${p}/${n + 1}`);
    return r;
  }
  const m = await prepararLocal(p, n);
  const intentos = leerIntentos();
  const clave = `${p}/${n}`;
  const intento = intentos[clave];
  if (!intento || intento.calificado) throw new ErrorAcademia('examen_no_emitido', 'Inicia el examen de nuevo para recibir preguntas.');
  const banco = new Map((m.examen.preguntas || []).map((q) => [q.id, q]));
  if (intento.ids.some((id) => !banco.has(id))) throw new ErrorAcademia('examen_desactualizado', 'El examen cambió; inícialo de nuevo.');
  intento.calificado = true;
  const calificadas = intento.ids.map((id) => { const q = banco.get(id)!; return { id, acertada: respuestas[id] === q.correcta, correcta: q.correcta, explicacion: q.explicacion || '' }; });
  const correctas = calificadas.filter((d) => d.acertada).length;
  const total = calificadas.length;
  const porcentaje = Math.round((correctas / total) * 100);
  const aprobado = (correctas / total) * 100 >= (m.examen.aprobar || APROBATORIO);
  const fecha = new Date().toISOString();
  intento.ultimo = { aprobado, fecha };
  escribirLS(claveIntentos(), intentos);
  let mejor = porcentaje;
  let revelado = false;
  mutarLocal(p, n, (a) => {
    a.mejor = Math.max(a.mejor || 0, porcentaje); mejor = a.mejor;
    a.intentos = (a.intentos || 0) + 1;
    if (aprobado && !a.aprobado) { a.aprobado = true; a.aprobadoEn = fecha; }
    revelado = a.aprobado === true;
  });
  const prog = programa(p)!;
  const ultimo = Math.max(...prog.modulos.map((x) => x.n));
  return {
    correctas, total, porcentaje, aprobado, mejor, revelado,
    // Igual que la API: sin aprobación, solo { id, acertada }.
    detalle: calificadas.map((d) => (revelado ? d : { id: d.id, acertada: d.acertada })),
    siguiente: aprobado && n < ultimo ? n + 1 : null,
    programaCompleto: prog.modulos.every((x) => moduloAprobado(p, x.n)),
  };
}

// ── Revisión editorial (panel admin) ──
const palabrasDe = (s: unknown) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;
function metricas(m: Modulo) {
  let palabras = 0, figuras = 0, actividades = 0;
  for (const t of m.temas || []) for (const b of t.bloques || []) {
    if (b.tipo === 'texto' || b.tipo === 'recuadro') palabras += palabrasDe(b.md);
    else if (b.tipo === 'lista') palabras += palabrasDe(b.items.join(' '));
    else if (b.tipo === 'pasos') palabras += palabrasDe(b.pasos.map((x) => `${x.titulo} ${x.md}`).join(' '));
    else if (b.tipo === 'tabla') palabras += palabrasDe(b.filas.flat().join(' '));
    else if (b.tipo === 'figura') figuras++;
    else if (b.tipo === 'actividad') actividades++;
  }
  return { palabras, figuras, actividades, temas: m.temas?.length || 0, preguntas: m.examen?.preguntas?.length || 0 };
}

export async function cargarRevisionAcademia(): Promise<ProgramaRevision[]> {
  if (MODO_API) return (await api<{ programas: ProgramaRevision[] }>('/admin/academia')).programas;
  const rev = revisionesLocales();
  return Promise.all(programas.map(async (p) => {
    const l = lanzamientoLocal(p);
    return {
      id: p.id, numero: p.numero, titulo: p.titulo, area: p.area, lanzamiento: l,
      modulos: await Promise.all(p.modulos.map(async (mm): Promise<FilaRevision> => {
        const m = await moduloLocalCrudo(p.id, mm.n);
        const r = rev[claveRev(p.id, mm.n)];
        const desde = disponibleDesdeDe(l, mm.n);
        return {
          n: mm.n, titulo: mm.titulo, existe: !!m,
          estadoArchivo: m ? (estadoValido(m.estado) ? m.estado : 'borrador') : null,
          estado: estadoEfectivoLocal(p.id, mm.n, m), nota: r?.nota ?? '',
          revision: r ? { estado: r.estado, revisor: 'demo', fecha: r.fecha, nota: r.nota } : null,
          ...(m ? metricas(m) : { palabras: 0, figuras: 0, actividades: 0, temas: 0, preguntas: 0 }),
          disponibleDesde: desde, programado: programadoEn(desde),
        };
      })),
    };
  }));
}

/**
 * Mueve la fecha de inicio del calendario de un programa: todo el calendario se desplaza.
 * En API lo guarda el servidor (PATCH /admin/academia/:programa/lanzamiento); en el demo, este navegador.
 */
export async function fijarLanzamiento(p: string, inicio: string, cadaDias?: number) {
  if (!fechaCalendarioValida(inicio)) throw new ErrorAcademia('validacion', 'Elige una fecha válida.');
  if (cadaDias !== undefined && !cadaDiasValido(cadaDias)) throw new ErrorAcademia('validacion', 'El intervalo debe ser de 1 a 60 días.');
  if (MODO_API) {
    try { await api(`/admin/academia/${encodeURIComponent(p)}/lanzamiento`, { method: 'PATCH', json: cadaDias === undefined ? { inicio } : { inicio, cadaDias } }); }
    catch (e) { throw comoError(e, 'No se pudo guardar la fecha de inicio.'); }
    catalogoEn = 0; cacheModulos.clear();
    return;
  }
  const a = ajustesLocales();
  a[p] = { inicio, ...(cadaDias === undefined ? {} : { cadaDias }), fecha: new Date().toISOString() };
  escribirLS(CLAVE_LANZAMIENTOS, a);
}

/** Borra el ajuste del admin: vuelve la fecha del catálogo. */
export async function borrarLanzamiento(p: string) {
  if (MODO_API) {
    try { await api(`/admin/academia/${encodeURIComponent(p)}/lanzamiento`, { method: 'DELETE' }); }
    catch (e) { throw comoError(e, 'No se pudo restablecer la fecha del catálogo.'); }
    catalogoEn = 0; cacheModulos.clear();
    return;
  }
  const a = ajustesLocales();
  delete a[p];
  escribirLS(CLAVE_LANZAMIENTOS, a);
}

export async function revisarModulo(p: string, n: number, estado: EstadoRevision, nota = '') {
  if (MODO_API) {
    await api(`/admin/academia/${encodeURIComponent(p)}/${n}`, { method: 'PATCH', json: { estado, nota } });
    catalogoEn = 0; cacheModulos.delete(`${p}/${n}`);
    return;
  }
  const rev = revisionesLocales();
  rev[claveRev(p, n)] = { estado, nota, fecha: new Date().toISOString() };
  escribirLS(CLAVE_REVISIONES, rev);
}
