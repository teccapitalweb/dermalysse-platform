// Comunidad compartida. En producción consume el foro del backend; el modo demo
// conserva una experiencia local completa para poder recorrer la plataforma.
import { api } from './auth';
import { Datos } from './datos';
import { Perfil } from './perfil';

export interface Respuesta { id: string; autor: string; texto: string; fecha: string }
export interface Hilo {
  id: string;
  titulo: string;
  texto: string;
  autor: string;
  fecha: string;
  cursoId: string | null;
  respuestas: Respuesta[];
  respuestasTotal: number;
  util: number;
  marcadoUtil?: boolean;
  oculto?: boolean;
}

interface HiloRemoto extends Omit<Hilo, 'respuestas' | 'respuestasTotal'> { respuestas: number }
interface DetalleRemoto { hilo: HiloRemoto; respuestas: Respuesta[] }

const KEY = 'dermalysse:foro:v2';
const uid = () => Math.random().toString(36).slice(2, 10);
let listadoApi: Hilo[] | null = null;
const detallesApi = new Map<string, Hilo>();
let cargandoListado: Promise<void> | null = null;
const cargandoDetalle = new Map<string, Promise<void>>();

const SEMILLA: Hilo[] = [
  {
    id: 'notas-de-clase',
    titulo: '¿Cómo organizan sus notas después de cada clase?',
    texto: 'Estoy separando conceptos, dudas y ejemplos prácticos para poder repasar más rápido. ¿Qué estructura les funciona mejor?',
    autor: 'Mariana R.', fecha: '2026-09-18T17:20:00.000Z', cursoId: null, util: 18, respuestasTotal: 2,
    respuestas: [
      { id: 'r1', autor: 'Paola C.', fecha: '2026-09-18T18:05:00.000Z', texto: 'Uso tres bloques: lo esencial, lo que necesito investigar y una aplicación posible. Me ayuda a no confundir apuntes con indicaciones profesionales.' },
      { id: 'r2', autor: 'Equipo Dermalysse', fecha: '2026-09-18T19:10:00.000Z', texto: 'Muy buena estructura. También puedes guardar tus notas dentro de cada clase para retomarlas junto al contenido.' },
    ],
  },
  {
    id: 'bienvenida',
    titulo: 'Bienvenidas y bienvenidos a la comunidad Dermalysse',
    texto: 'Este es un espacio educativo para conversar sobre los cursos, compartir aprendizajes y formular preguntas. Evita datos personales, fotografías identificables y solicitudes de diagnóstico.',
    autor: 'Equipo Dermalysse', fecha: '2026-09-01T10:00:00.000Z', cursoId: null, respuestas: [], respuestasTotal: 0, util: 42,
  },
];

function normalizar(h: Partial<Hilo> & { id: string }): Hilo {
  const respuestas = Array.isArray(h.respuestas) ? h.respuestas : [];
  return {
    id: h.id,
    titulo: h.titulo || '', texto: h.texto || '', autor: h.autor || 'Miembro Dermalysse',
    fecha: h.fecha || new Date().toISOString(), cursoId: h.cursoId || null,
    respuestas, respuestasTotal: Number(h.respuestasTotal ?? respuestas.length) || 0,
    util: Number(h.util) || 0, marcadoUtil: h.marcadoUtil === true, oculto: h.oculto === true,
  };
}

function desdeRemoto(h: HiloRemoto, respuestas: Respuesta[] = []): Hilo {
  return normalizar({ ...h, respuestas, respuestasTotal: Number(h.respuestas) || respuestas.length });
}

function leer(): Hilo[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return Array.isArray(v) ? v.map(normalizar) : structuredClone(SEMILLA);
  } catch { return structuredClone(SEMILLA); }
}
function escribir(h: Hilo[]) { try { localStorage.setItem(KEY, JSON.stringify(h)); } catch {} }

export const Comunidad = {
  hilos(cursoId?: string | null): Hilo[] {
    const origen = Datos.modo === 'api' ? (listadoApi || []) : leer();
    const h = origen.filter((x) => !x.oculto).sort((a, b) => b.fecha.localeCompare(a.fecha));
    return cursoId === undefined ? h : h.filter((x) => x.cursoId === cursoId);
  },
  hilo(id: string) {
    if (Datos.modo === 'api') return detallesApi.get(id) || listadoApi?.find((h) => h.id === id);
    return leer().find((h) => h.id === id && !h.oculto);
  },
  cargando() { return Datos.modo === 'api' && listadoApi === null; },
  necesitaDetalle(id: string) { return Datos.modo === 'api' && !detallesApi.has(id); },
  async cargarListado() {
    if (Datos.modo !== 'api' || listadoApi) return;
    if (!cargandoListado) cargandoListado = api<HiloRemoto[]>('/foro')
      .then((hilos) => { listadoApi = hilos.map((h) => desdeRemoto(h)); })
      .finally(() => { cargandoListado = null; });
    return cargandoListado;
  },
  async cargarDetalle(id: string) {
    if (Datos.modo !== 'api' || detallesApi.has(id)) return;
    if (!cargandoDetalle.has(id)) cargandoDetalle.set(id, api<DetalleRemoto>(`/foro/${encodeURIComponent(id)}`)
      .then((d) => {
        const completo = desdeRemoto(d.hilo, d.respuestas || []);
        detallesApi.set(id, completo);
        if (listadoApi) listadoApi = listadoApi.map((h) => h.id === id ? completo : h);
      })
      .finally(() => { cargandoDetalle.delete(id); }));
    return cargandoDetalle.get(id);
  },
  todos() { return (Datos.modo === 'api' ? (listadoApi || []) : leer()).sort((a, b) => b.fecha.localeCompare(a.fecha)); },
  alternarOculto(id: string) {
    if (Datos.modo === 'api') return;
    const h = leer(); const t = h.find((x) => x.id === id); if (t) { t.oculto = !t.oculto; escribir(h); }
  },
  async crear(titulo: string, texto: string, cursoId: string | null) {
    if (Datos.modo === 'api') {
      const remoto = await api<HiloRemoto>('/foro', { method: 'POST', json: { titulo, texto, cursoId } });
      const nuevo = desdeRemoto(remoto); listadoApi = [nuevo, ...(listadoApi || [])]; detallesApi.set(nuevo.id, nuevo); return nuevo;
    }
    const h = leer();
    const nuevo: Hilo = { id: uid(), titulo, texto, autor: Perfil.get().nombre, fecha: new Date().toISOString(), cursoId, respuestas: [], respuestasTotal: 0, util: 0 };
    h.push(nuevo); escribir(h); return nuevo;
  },
  async responder(id: string, texto: string) {
    if (Datos.modo === 'api') {
      const respuesta = await api<Respuesta>(`/foro/${encodeURIComponent(id)}/respuestas`, { method: 'POST', json: { texto } });
      const t = detallesApi.get(id); if (t) { t.respuestas.push(respuesta); t.respuestasTotal += 1; }
      const lista = listadoApi?.find((h) => h.id === id); if (lista && lista !== t) lista.respuestasTotal += 1;
      return;
    }
    const h = leer(); const t = h.find((x) => x.id === id); if (!t) return;
    t.respuestas.push({ id: uid(), autor: Perfil.get().nombre, texto, fecha: new Date().toISOString() }); t.respuestasTotal = t.respuestas.length; escribir(h);
  },
  async util(id: string) {
    if (Datos.modo === 'api') {
      const r = await api<{ util: number }>(`/foro/${encodeURIComponent(id)}/util`, { method: 'POST' });
      const actualizar = (t?: Hilo) => { if (t) { t.util = r.util; t.marcadoUtil = true; } };
      actualizar(detallesApi.get(id)); actualizar(listadoApi?.find((h) => h.id === id)); return;
    }
    const h = leer(); const t = h.find((x) => x.id === id); if (t && !t.marcadoUtil) { t.util++; t.marcadoUtil = true; escribir(h); }
  },
  misHilos() { const n = Perfil.get().nombre; return (Datos.modo === 'api' ? (listadoApi || []) : leer()).filter((h) => h.autor === n); },
};

export const hace = (iso: string) => {
  const ms = new Date(iso).getTime();
  if (!iso || !Number.isFinite(ms)) return '—';
  const d = (Date.now() - ms) / 60000;
  if (d < 60) return `hace ${Math.max(1, Math.round(d))} min`;
  if (d < 1440) return `hace ${Math.round(d / 60)} h`;
  if (d < 43200) return `hace ${Math.round(d / 1440)} d`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};
