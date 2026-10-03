import { Auth, api } from './auth';
import { Datos } from './datos';

export interface BeneficioExperiencia {
  estado: 'no-disponible' | 'reservado' | 'otorgado' | 'demo';
  dias: number | null;
  hasta: string | null;
  motivo: string;
  venceOferta: string | null;
}
export interface ProgresoExperiencia {
  estado: 'pendiente' | 'en-curso' | 'pospuesta' | 'completada';
  revision: number;
  paso: number;
  respuestas: Record<string, unknown>;
  completadaEn: string | null;
  pospuestaHasta: string | null;
}
export interface EncuestaExperiencia extends Omit<ProgresoExperiencia, 'estado'> {
  id: 'experiencia-inicial-v1';
  estado: 'bloqueada' | 'disponible' | 'en-curso' | 'pospuesta' | 'completada';
  motivo: string;
  disponibleEn: string | null;
}
export interface RecomendacionExperiencia { id: string; titulo: string; area: string; nivel: string; portada: string }
export interface ExperienciaDTO {
  version: 1;
  fuente: 'api' | 'demo';
  cohorte: 'nueva' | 'existente' | 'demo';
  primerAccesoEn: string | null;
  areas: string[];
  recomendaciones: RecomendacionExperiencia[];
  entrevista: ProgresoExperiencia;
  encuesta: EncuestaExperiencia;
  beneficios: { bienvenida: BeneficioExperiencia; experiencia: BeneficioExperiencia };
}
export type FlujoExperiencia = 'entrevista' | 'encuesta';
export const ROLES_EXPERIENCIA = ['estudiante', 'veterinario', 'tecnico', 'productor', 'docente', 'otro', 'prefiero-no-decir'] as const;
export const OPCIONES_EXPERIENCIA = {
  objetivo: ['aprender', 'produccion', 'actualizar', 'estudios', 'certificacion', 'otro'],
  experiencia: ['inicio', 'basico', 'practica', 'avanzado'],
  formato: ['grabados', 'envivo', 'ambos', 'no-se'],
  tiempo: ['cortos', 'semana', 'fines'],
  origen: ['facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp', 'google', 'recomendacion', 'escuela-evento', 'redes', 'otro'],
  etapa: ['iniciando', 'intermedia', 'final', 'egresado'],
  dificultad: ['ninguna', 'encontrar', 'video', 'movil', 'acceso', 'otra'],
} as const;

const BASE_KEY = 'dermalysse:experiencia:v1:';
let cuenta: string | null = null;
let cache: ExperienciaDTO | null = null;
let errorActual: Error | null = null;
let pendiente: Promise<ExperienciaDTO> | null = null;
let generacion = 0;
const sesiones = new Set<string>();
const sesionesPendientes = new Map<string, Promise<ExperienciaDTO | null>>();
const objeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const fecha = (v: unknown) => v === null || typeof v === 'string' && Number.isFinite(Date.parse(v));
function imagenSegura(valor: unknown) {
  if (typeof valor !== 'string' || valor.length > 2000) return false;
  if (valor.startsWith('/') && !valor.startsWith('//') && !valor.startsWith('/\\')) return true;
  try { return new URL(valor).protocol === 'https:'; } catch { return false; }
}

/** El estado remoto es la autoridad. Un DTO roto nunca activa una promoción. */
export function validarExperienciaDTO(v: unknown, fuente: ExperienciaDTO['fuente']): v is ExperienciaDTO {
  if (!objeto(v) || v.version !== 1 || v.fuente !== fuente || !['nueva', 'existente', 'demo'].includes(String(v.cohorte)) || !fecha(v.primerAccesoEn)) return false;
  if (fuente === 'api' && v.cohorte === 'demo' || fuente === 'demo' && v.cohorte !== 'demo') return false;
  if (!Array.isArray(v.areas) || v.areas.length > 80 || !v.areas.every(a => typeof a === 'string' && a.length > 0 && a.length <= 120)) return false;
  if (!Array.isArray(v.recomendaciones) || v.recomendaciones.length > 30 || !v.recomendaciones.every(c => objeto(c) && ['id', 'titulo', 'area', 'nivel', 'portada'].every(k => typeof c[k] === 'string') && imagenSegura(c.portada))) return false;
  const progreso = (p: unknown, estados: string[]) => objeto(p) && estados.includes(String(p.estado)) && Number.isInteger(p.revision) && Number(p.revision) >= 0 && Number.isInteger(p.paso) && Number(p.paso) >= 0 && Number(p.paso) <= 7 && objeto(p.respuestas) && fecha(p.completadaEn) && fecha(p.pospuestaHasta);
  if (!progreso(v.entrevista, ['pendiente', 'en-curso', 'pospuesta', 'completada'])) return false;
  if (!progreso(v.encuesta, ['bloqueada', 'disponible', 'en-curso', 'pospuesta', 'completada']) || !objeto(v.encuesta) || v.encuesta.id !== 'experiencia-inicial-v1' || typeof v.encuesta.motivo !== 'string' || !fecha(v.encuesta.disponibleEn)) return false;
  if (!objeto(v.beneficios)) return false;
  return ['bienvenida', 'experiencia'].every(k => {
    const b = (v.beneficios as Record<string, unknown>)[k];
    return objeto(b) && ['no-disponible', 'reservado', 'otorgado', 'demo'].includes(String(b.estado)) && (fuente === 'demo' || b.estado !== 'demo') && (b.dias === null || Number.isInteger(b.dias) && Number(b.dias) > 0) && fecha(b.hasta) && fecha(b.venceOferta) && typeof b.motivo === 'string';
  });
}

function usuarioActual() {
  const uid = Auth.usuario?.uid || null;
  if (uid !== cuenta) { limpiarExperiencia(); cuenta = uid; }
  return uid;
}
export function limpiarExperiencia() {
  generacion++;
  cuenta = null; cache = null; errorActual = null; pendiente = null;
}
export function getExperiencia(): ExperienciaDTO | null { usuarioActual(); return cache; }
export function getErrorExperiencia(): Error | null { usuarioActual(); return errorActual; }

function baseDemo(): ExperienciaDTO {
  const publicados = Datos.cursos().filter(c => c.publicado !== false);
  const p: ProgresoExperiencia = { estado: 'pendiente', revision: 0, paso: 0, respuestas: {}, completadaEn: null, pospuestaHasta: null };
  const beneficio = (dias: number): BeneficioExperiencia => ({ estado: 'demo', dias, hasta: null, motivo: 'Ejemplo de demostración. No otorga acceso VIP.', venceOferta: null });
  return {
    version: 1, fuente: 'demo', cohorte: 'demo', primerAccesoEn: null,
    areas: [...new Set(publicados.map(c => c.area))], recomendaciones: [], entrevista: p,
    encuesta: { ...structuredClone(p), id: 'experiencia-inicial-v1', estado: 'bloqueada', motivo: 'La encuesta se habilita después de usar el club. En desarrollo puedes previsualizarla con el control de demostración.', disponibleEn: null },
    beneficios: { bienvenida: beneficio(7), experiencia: beneficio(15) },
  };
}
function leerDemo(uid: string) {
  try {
    const guardado: unknown = JSON.parse(localStorage.getItem(BASE_KEY + uid) || 'null');
    if (validarExperienciaDTO(guardado, 'demo')) return guardado;
  } catch { /* Una demostración inválida se reconstruye, nunca datos API. */ }
  return baseDemo();
}
function confirmar(valor: unknown, uid: string, versionLocal: number): ExperienciaDTO {
  const fuente = Datos.modo === 'api' ? 'api' : 'demo';
  if (!validarExperienciaDTO(valor, fuente)) throw new Error('La respuesta de tu experiencia no es válida. Intenta de nuevo.');
  if (Auth.usuario?.uid !== uid || versionLocal !== generacion) throw new Error('La cuenta cambió. Vuelve a abrir esta pantalla.');
  const siguiente = structuredClone(valor);
  if (cache) {
    // /sesion y GET pueden terminar después de un autosave o un canje. Sus DTO
    // completos no deben deshacer una revisión más reciente de otra solicitud.
    for (const flujo of ['entrevista', 'encuesta'] as const) {
      const anterior = cache[flujo], nuevo = siguiente[flujo];
      const finalAnterior = anterior.estado === 'completada';
      const atrasado = nuevo.revision < anterior.revision || finalAnterior && nuevo.estado !== 'completada';
      const beneficio = flujo === 'entrevista' ? 'bienvenida' : 'experiencia';
      if (atrasado) {
        if (flujo === 'entrevista') { siguiente.entrevista = structuredClone(cache.entrevista); siguiente.recomendaciones = structuredClone(cache.recomendaciones); }
        else siguiente.encuesta = structuredClone(cache.encuesta);
        siguiente.beneficios[beneficio] = structuredClone(cache.beneficios[beneficio]);
      } else if (nuevo.revision === anterior.revision) {
        if (cache.beneficios[beneficio].estado === 'otorgado' && siguiente.beneficios[beneficio].estado !== 'otorgado') siguiente.beneficios[beneficio] = structuredClone(cache.beneficios[beneficio]);
        if (flujo === 'encuesta' && cache.encuesta.estado !== 'bloqueada' && siguiente.encuesta.estado === 'bloqueada') siguiente.encuesta = structuredClone(cache.encuesta);
        if (flujo === 'entrevista' && cache.entrevista.estado !== 'pendiente' && siguiente.entrevista.estado === 'pendiente') {
          siguiente.entrevista = structuredClone(cache.entrevista); siguiente.recomendaciones = structuredClone(cache.recomendaciones);
        }
      }
    }
    if (cache.primerAccesoEn && !siguiente.primerAccesoEn) siguiente.primerAccesoEn = cache.primerAccesoEn;
  }
  cache = siguiente; errorActual = null;
  window.dispatchEvent(new CustomEvent('experiencia:cambio', { detail: { uid } }));
  return siguiente;
}
export async function cargarExperiencia(forzar = false): Promise<ExperienciaDTO> {
  const uid = usuarioActual();
  if (!uid) throw new Error('Inicia sesión para personalizar tu experiencia.');
  if (!forzar && cache) return cache;
  if (pendiente) return pendiente;
  const versionLocal = generacion;
  const tarea = (async () => {
    try {
      const valor = Datos.modo === 'demo' ? leerDemo(uid) : await api<unknown>('/me/experiencia');
      return confirmar(valor, uid, versionLocal);
    } catch (e) {
      if (versionLocal === generacion) { errorActual = e instanceof Error ? e : new Error('No pudimos cargar tu experiencia.'); cache = null; }
      throw e;
    }
  })();
  pendiente = tarea;
  try { return await tarea; } finally { if (pendiente === tarea) pendiente = null; }
}
function recomendacionesDemo(e: ExperienciaDTO) {
  const elegidas = Array.isArray(e.entrevista.respuestas.areas) ? e.entrevista.respuestas.areas : [];
  e.recomendaciones = Datos.cursos().filter(c => c.publicado !== false && elegidas.includes(c.area)).slice(0, 4).map(({ id, titulo, area, nivel, portada }) => ({ id, titulo, area, nivel, portada }));
}
async function mutar(ruta: string, cuerpo: Record<string, unknown>, demo: (e: ExperienciaDTO) => void): Promise<ExperienciaDTO> {
  const uid = usuarioActual();
  if (!uid) throw new Error('Tu sesión terminó. Inicia sesión para continuar.');
  const actual = cache || await cargarExperiencia();
  const versionLocal = generacion;
  if (Datos.modo === 'demo') {
    const siguiente = structuredClone(actual);
    demo(siguiente);
    localStorage.setItem(BASE_KEY + uid, JSON.stringify(siguiente));
    return confirmar(siguiente, uid, versionLocal);
  }
  try {
    return confirmar(await api<unknown>(ruta, { method: ruta.endsWith('/entrevista') || ruta.endsWith('/encuesta') ? 'PATCH' : 'POST', json: cuerpo }), uid, versionLocal);
  } catch (e) {
    if ((e as { status?: number })?.status === 409 && versionLocal === generacion) {
      // Refrescar revisión sin tocar el borrador que conserva la interfaz.
      try { await cargarExperiencia(true); } catch { /* El error de guardado original sigue visible. */ }
    }
    throw e;
  }
}
export async function iniciarExperiencia(): Promise<ExperienciaDTO> {
  return mutar('/me/experiencia/iniciar', { privacidadAceptada: true }, e => {
    if (e.entrevista.estado !== 'pendiente') return;
    e.primerAccesoEn = new Date().toISOString(); e.entrevista.estado = 'en-curso'; e.entrevista.revision++;
  });
}
export async function guardarRespuestasExperiencia(flujo: FlujoExperiencia, paso: number, respuestas: Record<string, unknown>) {
  const e = getExperiencia() || await cargarExperiencia();
  return mutar(`/me/${flujo}`, { revision: e[flujo].revision, paso, respuestas }, siguiente => {
    const p = siguiente[flujo];
    if (p.estado === 'completada' || p.estado === 'bloqueada') throw new Error('Esta actividad no admite cambios.');
    p.estado = 'en-curso'; p.respuestas = structuredClone(respuestas); p.paso = paso; p.revision++; p.pospuestaHasta = null;
    if (flujo === 'entrevista') recomendacionesDemo(siguiente);
  });
}
export async function posponerExperiencia(flujo: FlujoExperiencia) {
  const e = getExperiencia() || await cargarExperiencia();
  return mutar(`/me/${flujo}/posponer`, { revision: e[flujo].revision }, siguiente => {
    const p = siguiente[flujo]; p.estado = 'pospuesta'; p.revision++; p.pospuestaHasta = new Date(Date.now() + 86400000).toISOString();
  });
}
export async function completarExperiencia(flujo: FlujoExperiencia) {
  const e = getExperiencia() || await cargarExperiencia();
  const siguiente = await mutar(`/me/${flujo}/completar`, { revision: e[flujo].revision, privacidadAceptada: true }, siguiente => {
    const p = siguiente[flujo];
    if (p.estado === 'completada') return;
    p.estado = 'completada'; p.revision++; p.completadaEn = new Date().toISOString(); p.pospuestaHasta = null;
    if (flujo === 'entrevista') recomendacionesDemo(siguiente);
  });
  if (Datos.modo === 'api' && siguiente.beneficios[flujo === 'entrevista' ? 'bienvenida' : 'experiencia'].estado === 'otorgado') {
    // Solo /me puede actualizar el acceso: no fabricar VIP a partir de los días del premio.
    try { await Auth.refrescarEstado(); } catch { /* El beneficio queda confirmado; el acceso se reconsultará al volver a la cuenta. */ }
  }
  return siguiente;
}
/** Una sesión de uso diario solo se registra después del consentimiento y del inicio. */
export async function registrarSesion(): Promise<ExperienciaDTO | null> {
  const uid = usuarioActual(); const e = cache;
  if (!uid || !e || !e.primerAccesoEn || e.entrevista.estado === 'pendiente' || Datos.modo !== 'api' || Auth.usuario?.esAdmin) return e;
  const clave = `${uid}:${new Date().toISOString().slice(0, 10)}`;
  if (sesiones.has(clave)) return e;
  if (sesionesPendientes.has(clave)) return sesionesPendientes.get(clave)!;
  const tarea = mutar('/me/experiencia/sesion', {}, () => {}).then(siguiente => { sesiones.add(clave); return siguiente; });
  sesionesPendientes.set(clave, tarea);
  try { return await tarea; } finally { sesionesPendientes.delete(clave); }
}
export function puedePrevisualizarEncuestaDemo() { return !!import.meta.env.DEV && Datos.modo === 'demo'; }
export async function previsualizarEncuestaDemo() {
  if (!puedePrevisualizarEncuestaDemo()) throw new Error('La previsualización solo está disponible en desarrollo y modo demo.');
  return mutar('/me/encuesta', {}, e => {
    if (e.encuesta.estado === 'completada') return;
    e.encuesta.estado = 'disponible'; e.encuesta.disponibleEn = new Date().toISOString(); e.encuesta.motivo = 'Encuesta de demostración; no representa uso verificado ni otorga VIP.';
  });
}
