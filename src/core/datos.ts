// Almacén de contenido editable desde el admin.
// Modo demo: localStorage sembrado con src/data/*.json. Modo api: se reemplaza por llamadas al backend (docs/contrato.md).
import catalogoSeed from '../data/catalogo.json';
import materialesSeed from '../data/materiales.json';
import eventosSeed from '../data/envivo.json';
import miembrosSeed from '../data/miembros-demo.json';
import quizzesSeed from '../data/quizzes-demo.json';

export interface Nota { resumen: string; conceptos: { t: string; texto: string }[] }
export interface Clase { n: number; titulo: string; videoId: string; duracion: number | null; gratis: boolean; notas?: Nota }
export interface Curso {
  id: string; titulo: string; area: string; nivel: string; instructor: string; portada: string; banner?: string;
  descripcion: string; aprenderas?: string[]; orden: number; publicado?: boolean; bunnyCollectionId: string; clases: Clase[];
}
export interface Material {
  id: string; titulo: string; tipo: string; categoria: string; area: string; autor: string; paginas: number; portada: string;
  cursoId: string | null; descripcion: string; estado: 'disponible' | 'proximamente' | 'oculto' | string; gratis?: boolean; url?: string;
}
export interface Evento { id: string; titulo: string; ponente: string; fecha: string; duracionMin: number; enlace?: string; cursoId?: string; publicado?: boolean; reservas?: number }
export interface Pregunta { q: string; opciones: string[]; correcta: number; explicacion: string }
export interface Quiz { id: string; cursoId: string; n: number; estado: 'borrador' | 'aprobado'; preguntas: Pregunta[]; actualizado: string }
export interface MiembroDemo { uid: string; nombre: string; email: string; plan: 'mensual' | 'anual' | 'cortesia' | 'cupon' | 'ninguno'; vence: string | null; alta: string; clasesVistas: number; ultimaActividad: string; cortesiaHasta?: string | null; cuponHasta?: string | null; cortesiaMotivo?: string; esVip?: boolean; esAdmin?: boolean }
export interface Aviso { id: string; titulo: string; texto: string; enlace?: string; fecha: string }
export interface Config { precioMensual: number; precioAnual: number; descuentoVIP: number; whatsappSoporte: string; canalWhatsApp: string }

const PREFIX = 'dermalysse:datos:v1:';
const CONFIG_DEF: Config = {
  precioMensual: 0, precioAnual: 0, descuentoVIP: 0, whatsappSoporte: '', canalWhatsApp: '',
};

function leer<T>(k: string, semilla: T): T {
  try { const v = localStorage.getItem(PREFIX + k); return v ? JSON.parse(v) : structuredClone(semilla); } catch { return structuredClone(semilla); }
}
function escribir<T>(k: string, v: T) {
  try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { alert('No hay espacio en el navegador para guardar este cambio. Usa imágenes más ligeras.'); throw e; }
  window.dispatchEvent(new CustomEvent('datos:cambio', { detail: k }));
}
const hoy = () => new Date().toISOString();

const cursosSeed: Curso[] = (catalogoSeed.cursos as Curso[]).map((c) => ({ ...c, publicado: c.publicado ?? true, aprenderas: [] }));
const MODO = (import.meta.env.VITE_API_URL ? 'api' : 'demo') as 'api' | 'demo';
type DatoAdmin = 'cursos' | 'materiales' | 'eventos' | 'quizzes' | 'miembros' | 'avisos' | 'config';
const remoto: Partial<Record<DatoAdmin, unknown>> = {};

function dato<T>(clave: DatoAdmin, semilla: T): T {
  if (MODO === 'api') return clave in remoto ? (remoto[clave] as T) : structuredClone(semilla);
  return leer<T>(clave, semilla);
}

function guardarDato<T>(clave: DatoAdmin, valor: T) {
  if (MODO === 'api') {
    remoto[clave] = valor;
    window.dispatchEvent(new CustomEvent('datos:cambio', { detail: clave }));
    return;
  }
  escribir(clave, valor);
}

export const Datos = {
  modo: MODO,
  libraryId: catalogoSeed.libraryId as string,

  cursos: () => dato<Curso[]>('cursos', cursosSeed)
    // Sin perder progreso ni ediciones locales, sincroniza reglas de acceso y portadas del catálogo publicado.
    .map((c) => {
      // En producción Firebase es la fuente de verdad; estas correcciones solo migran el demo local antiguo.
      if (MODO === 'api') return c;
      const s = cursosSeed.find((x) => x.id === c.id);
      if (!s) return c;
      const portada = /^\/cursos\/curso-\d+\.webp$/.test(c.portada) && s.portada !== c.portada ? s.portada : c.portada;
      const clases = c.clases.map((clase) => {
        const publicada = s.clases.find((x) => x.n === clase.n);
        return publicada && clase.gratis !== publicada.gratis ? { ...clase, gratis: publicada.gratis } : clase;
      });
      return { ...c, portada, clases };
    })
    .sort((a, b) => a.orden - b.orden),
  guardarCurso(c: Curso) { const l = [...this.cursos()]; const i = l.findIndex((x) => x.id === c.id); i >= 0 ? (l[i] = c) : l.push(c); guardarDato('cursos', l); },
  borrarCurso(id: string) { guardarDato('cursos', this.cursos().filter((c) => c.id !== id)); },
  reordenarCursos(ids: string[]) { const l = [...this.cursos()]; ids.forEach((id, i) => { const c = l.find((x) => x.id === id); if (c) c.orden = i + 1; }); guardarDato('cursos', l); },

  materiales: () => dato<Material[]>('materiales', materialesSeed as Material[]),
  guardarMaterial(m: Material) { const l = [...this.materiales()]; const i = l.findIndex((x) => x.id === m.id); i >= 0 ? (l[i] = m) : l.unshift(m); guardarDato('materiales', l); },
  borrarMaterial(id: string) { guardarDato('materiales', this.materiales().filter((m) => m.id !== id)); },

  eventos: () => dato<Evento[]>('eventos', eventosSeed as Evento[]).sort((a, b) => a.fecha.localeCompare(b.fecha)),
  guardarEvento(e: Evento) { const l = [...this.eventos()]; const i = l.findIndex((x) => x.id === e.id); i >= 0 ? (l[i] = e) : l.push(e); guardarDato('eventos', l); },
  borrarEvento(id: string) { guardarDato('eventos', this.eventos().filter((e) => e.id !== id)); },

  quizzes: () => dato<Quiz[]>('quizzes', quizzesSeed as Quiz[]),
  quiz: (cursoId: string, n: number) => Datos.quizzes().find((q) => q.cursoId === cursoId && q.n === n),
  guardarQuiz(q: Quiz) { const l = [...this.quizzes()]; q.actualizado = hoy(); const i = l.findIndex((x) => x.id === q.id); i >= 0 ? (l[i] = q) : l.push(q); guardarDato('quizzes', l); },

  miembros: () => dato<MiembroDemo[]>('miembros', miembrosSeed as MiembroDemo[]),
  guardarMiembro(m: MiembroDemo) { const l = [...this.miembros()]; const i = l.findIndex((x) => x.uid === m.uid); if (i >= 0) l[i] = m; else l.push(m); guardarDato('miembros', l); },

  avisos: () => dato<Aviso[]>('avisos', []).sort((a, b) => b.fecha.localeCompare(a.fecha)),
  publicarAviso(a: Omit<Aviso, 'id' | 'fecha'>) { const l = [...this.avisos()]; l.unshift({ ...a, id: Math.random().toString(36).slice(2, 10), fecha: hoy() }); guardarDato('avisos', l); },
  borrarAviso(id: string) { guardarDato('avisos', this.avisos().filter((a) => a.id !== id)); },

  config: () => ({ ...CONFIG_DEF, ...dato<Partial<Config>>('config', {}) }),
  guardarConfig(c: Config) { guardarDato('config', c); },

  hidratarAdmin(clave: DatoAdmin, valor: unknown) {
    remoto[clave] = valor;
    // Los índices derivados (catálogo, áreas y biblioteca) se crean al cargar
    // los módulos. Avísales cuando llegan datos reales para que no conserven
    // el arreglo vacío del primer render.
    window.dispatchEvent(new CustomEvent('datos:cambio', { detail: clave }));
  },
  invalidarAdmin(...claves: DatoAdmin[]) { claves.forEach((clave) => delete remoto[clave]); },

  restablecerDemo() { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)); window.dispatchEvent(new CustomEvent('datos:cambio', { detail: '*' })); },
};

export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';

// Reduce una imagen subida a WebP ligero (para portadas en modo demo)
export function imagenAWebp(file: File, maxLado = 900, calidad = 0.82): Promise<string> {
  return new Promise((ok, err) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxLado / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
      ok(cv.toDataURL('image/webp', calidad)); URL.revokeObjectURL(img.src);
    };
    img.onerror = err; img.src = URL.createObjectURL(file);
  });
}
