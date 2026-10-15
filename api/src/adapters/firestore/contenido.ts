// Contenido de PRODUCCIÓN: biblioteca (colección actual `pdfs`), clases en vivo (colección actual
// `webinars`) y quizzes de clase (v2_quiz + banco empaquetado).
//
// Formas del panel admin actual (_fuentes/admin_club_dermalysse, addPdf/addWebinar/syncSave):
//   pdfs/{id}      { id, name, cat, pages, downloads, date('YYYY-MM-DD'), drive, img }
//   webinars/{id}  { id, title, date('YYYY-MM-DDTHH:mm', hora local de CDMX), duration('60 min'), speaker,
//                    registered, status('scheduled'|'draft'|…), cv, live, drive, img }
// El club actual muestra todos los pdfs y solo los webinars con status === 'scheduled'.
// Aquí se escriben SIEMPRE con merge y con esos mismos campos; lo propio del club nuevo (tipo, área,
// autor, descripción, estado, gratis, cursoId…) va en campos adicionales que lo viejo ignora.
//
// Los valores por defecto del panel viejo son DEMO (ids p-01…p-03, w-01, w-02 y enlaces «ejemplo»):
// nunca se exponen ni se editan.
import { readFileSync } from 'node:fs';
import type { PreguntaConRespuesta, QuizFixture } from '../../domain/types.js';
import { aMillis, texto, type Datos, type FirestorePort } from './port.js';
import { COLECCIONES_V2, segmento } from './v2.js';

export const COLECCIONES_LEGADO = { pdfs: 'pdfs', webinars: 'webinars' } as const;

/** Ids de los valores por defecto (demo) del panel admin actual. */
export const IDS_DEMO_LEGADO: ReadonlySet<string> = new Set(['p-01', 'p-02', 'p-03', 'w-01', 'w-02']);
const CAMPOS_URL_LEGADO = ['drive', 'live', 'cv', 'img'] as const;

/** true si el documento es un valor demo del panel viejo (id reservado o algún enlace con «ejemplo»). */
export function esDemoLegado(id: string, d: Datos): boolean {
  if (IDS_DEMO_LEGADO.has(id)) return true;
  return CAMPOS_URL_LEGADO.some((c) => /ejemplo/i.test(texto(d[c])));
}

/** Material tal como lo espera el cliente (src/core/datos.ts · Material). */
export interface MaterialPublico {
  id: string;
  titulo: string;
  tipo: string;
  categoria: string;
  area: string;
  autor: string;
  paginas: number;
  portada: string;
  cursoId: string | null;
  descripcion: string;
  estado: string;
  gratis?: boolean;
  url?: string;
  /** Hay un archivo protegido: el enlace se pide con sesión en GET /materiales/:id/acceso. */
  enlaceProtegido?: boolean;
  /** Fecha de publicación (pdfs.date), solo para ordenar. */
  fecha?: string;
}

/** Evento tal como lo espera el cliente (src/core/datos.ts · Evento), SIN enlaces. */
export interface EventoPublico {
  id: string;
  titulo: string;
  ponente: string;
  fecha: string;
  duracionMin: number;
  publicado: boolean;
  reservas: number;
  cursoId?: string;
  /** Hay enlace de transmisión (live): se pide con sesión VIP en GET /eventos/:id/acceso. */
  conTransmision: boolean;
  /** Hay grabación (drive): se pide con sesión VIP en GET /eventos/:id/acceso. */
  conGrabacion: boolean;
}

// ── Utilidades de formato del club actual ──

/** Id de archivo de Google Drive (mismos patrones que driveFileId del club actual). */
export function idArchivoDrive(url: string): string | null {
  for (const p of [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/, /\/folders\/([a-zA-Z0-9_-]+)/, /^([a-zA-Z0-9_-]{20,})$/]) {
    const m = p.exec(url);
    if (m) return m[1];
  }
  return null;
}

const esHttps = (v: string) => /^https:\/\/[^\s"'<>]+$/i.test(v);

/** Portada pública: `portada` del club nuevo (ruta local del sitio) o `img` del panel viejo (Drive ⇒ miniatura). */
export function portadaLegado(d: Datos): string {
  const propia = texto(d.portada);
  if (propia.startsWith('/')) return propia;
  const img = texto(d.img).trim();
  if (!img) return '';
  const id = idArchivoDrive(img);
  if (id && /drive\.google\.com|^[a-zA-Z0-9_-]{20,}$/.test(img)) return `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
  return esHttps(img) ? img : '';
}

/** "60 min" → 60; "1 Hora" → 60; "1h 30min" → 90; "90" → 90; sin dato → 60 (el club actual muestra «1 Hora»). */
export function minutosDuracion(valor: unknown): number {
  if (typeof valor === 'number' && Number.isFinite(valor) && valor > 0) return Math.round(valor);
  const s = texto(valor).toLowerCase().trim();
  if (/^\d+$/.test(s)) return Number(s) || 60;
  const h = /(\d+)\s*h/.exec(s);
  const m = /(\d+)\s*m/.exec(s);
  const total = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  return total > 0 ? total : 60;
}

/** Desfase de la Ciudad de México (UTC−6, sin horario de verano desde 2022). */
const CDMX_MS = 6 * 3600 * 1000;

/** Fecha del webinar a ISO. 'YYYY-MM-DDTHH:mm' sin zona = hora de CDMX (datetime-local del panel). null si no es fecha. */
export function fechaWebinar(valor: unknown): string | null {
  if (typeof valor === 'string') {
    const s = valor.trim();
    const local = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::(\d{2}))?)?$/.exec(s);
    if (local) {
      const ms = Date.parse(`${local[1]}T${local[2] ?? '00:00'}:${local[3] ?? '00'}-06:00`);
      return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    }
  }
  const ms = aMillis(valor);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** ISO → 'YYYY-MM-DDTHH:mm' en hora de CDMX (lo que escribe el datetime-local del panel viejo). */
export function fechaLegadoDesdeIso(iso: string): string {
  return new Date(Date.parse(iso) - CDMX_MS).toISOString().slice(0, 16);
}

// ── Mapeos legado → cliente ──

const ESTADOS_MATERIAL = ['disponible', 'proximamente', 'oculto'];

/** pdfs/{id} → Material del cliente. NUNCA incluye el enlace `drive`. */
export function materialDesdePdf(id: string, d: Datos): MaterialPublico {
  const drive = texto(d.drive).trim();
  const estado = ESTADOS_MATERIAL.includes(texto(d.estado)) ? texto(d.estado) : drive ? 'disponible' : 'proximamente';
  const material: MaterialPublico = {
    id,
    titulo: texto(d.name).trim() || 'Material',
    tipo: texto(d.tipo).trim() || 'PDF',
    categoria: texto(d.cat).trim() || 'Material',
    area: texto(d.area).trim() || texto(d.cat).trim() || 'Biblioteca',
    autor: texto(d.autor).trim() || 'Club Dermalysse',
    paginas: Math.max(0, Math.round(Number(d.pages) || 0)),
    portada: portadaLegado(d),
    cursoId: texto(d.cursoId) || null,
    descripcion: texto(d.descripcion),
    estado,
    gratis: d.gratis === true,
  };
  if (drive) material.enlaceProtegido = true;
  const fecha = texto(d.date);
  if (fecha) material.fecha = fecha;
  return material;
}

/** webinars/{id} → Evento del cliente (null si la fecha no es válida). NUNCA incluye live/drive/cv. */
export function eventoDesdeWebinar(id: string, d: Datos): EventoPublico | null {
  const fecha = fechaWebinar(d.date);
  if (!fecha) return null;
  const evento: EventoPublico = {
    id,
    titulo: texto(d.title).trim() || 'Clase en vivo',
    ponente: texto(d.speaker).trim() || 'Especialista',
    fecha,
    duracionMin: minutosDuracion(d.duration),
    publicado: d.status === 'scheduled',
    reservas: Math.max(0, Math.round(Number(d.registered) || 0)),
    conTransmision: !!texto(d.live).trim(),
    conGrabacion: !!texto(d.drive).trim(),
  };
  if (texto(d.cursoId)) evento.cursoId = texto(d.cursoId);
  return evento;
}

// ── Contenido empaquetado (api/content/club) ──

export function cargarMaterialesEditoriales(url = new URL('../../../content/club/materiales.json', import.meta.url)): MaterialPublico[] {
  return (JSON.parse(readFileSync(url, 'utf8')) as { materiales: MaterialPublico[] }).materiales;
}

export function cargarQuizzesEmpaquetados(url = new URL('../../../content/club/quizzes.json', import.meta.url)): QuizFixture[] {
  return (JSON.parse(readFileSync(url, 'utf8')) as { quizzes: QuizFixture[] }).quizzes
    .map((q) => ({ cursoId: q.cursoId, n: q.n, preguntas: q.preguntas }));
}

// ── Acceso a Firestore ──

export interface DocContenido { id: string; datos: Datos }

/** Quiz guardado por el admin en v2_quiz/{cursoId}__{n}. */
export interface QuizGuardado {
  cursoId: string;
  n: number;
  estado: 'borrador' | 'aprobado';
  preguntas: PreguntaConRespuesta[];
  actualizado: string;
}

export class FirestoreContenidoStore {
  constructor(private readonly db: FirestorePort, private readonly limite = 500) {}

  private ruta(coleccion: string, id: string) { return `${coleccion}/${segmento(id)}`; }

  /** Documentos reales de una colección vieja (sin demos). */
  async listar(coleccion: 'pdfs' | 'webinars'): Promise<DocContenido[]> {
    const docs = await this.db.query(coleccion, { limit: this.limite });
    return docs
      .map((d) => ({ id: d.id, datos: d.data() ?? {} }))
      .filter((d) => !esDemoLegado(d.id, d.datos));
  }

  /** Un documento real (null si no existe, el id no es válido o es demo). */
  async leer(coleccion: 'pdfs' | 'webinars', id: string): Promise<Datos | null> {
    let ruta: string;
    try { ruta = this.ruta(coleccion, id); } catch { return null; }
    const doc = await this.db.get(ruta);
    const datos = doc.data();
    if (!doc.exists || !datos || esDemoLegado(id, datos)) return null;
    return datos;
  }

  /** Crea SOLO si no existe (false si ya existía). */
  crear(coleccion: 'pdfs' | 'webinars', id: string, datos: Datos): Promise<boolean> {
    return this.db.create(this.ruta(coleccion, id), datos);
  }

  /** Fusiona (merge) sin tocar los campos que no vienen. */
  fusionar(coleccion: 'pdfs' | 'webinars', id: string, datos: Datos): Promise<void> {
    return this.db.set(this.ruta(coleccion, id), datos, { merge: true });
  }

  /** Borra el documento (lo mismo que deletePdf/deleteWebinar del panel viejo). */
  borrar(coleccion: 'pdfs' | 'webinars', id: string): Promise<void> {
    return this.db.delete(this.ruta(coleccion, id));
  }

  /** Suma una descarga (pdfs.downloads, que muestra el panel viejo). Nunca interrumpe la lectura. */
  async sumarDescarga(id: string): Promise<void> {
    await this.db.increment(this.ruta(COLECCIONES_LEGADO.pdfs, id), 'downloads', 1).catch(() => undefined);
  }

  async quizzes(): Promise<QuizGuardado[]> {
    const docs = await this.db.query(COLECCIONES_V2.quiz, { limit: 2000 });
    const salida: QuizGuardado[] = [];
    for (const d of docs) {
      const datos = d.data() ?? {};
      const m = /^(.+)__(\d+)$/.exec(d.id);
      const cursoId = texto(datos.cursoId) || m?.[1] || '';
      const n = Number(datos.n) || Number(m?.[2]) || 0;
      if (!cursoId || !Number.isInteger(n) || n < 1 || !Array.isArray(datos.preguntas)) continue;
      salida.push({
        cursoId, n,
        estado: datos.estado === 'borrador' ? 'borrador' : 'aprobado',
        preguntas: datos.preguntas as PreguntaConRespuesta[],
        actualizado: texto(datos.actualizado),
      });
    }
    return salida;
  }

  async guardarQuiz(quiz: QuizGuardado, por: string): Promise<void> {
    await this.db.set(`${COLECCIONES_V2.quiz}/${segmento(quiz.cursoId)}__${quiz.n}`, { ...quiz, por });
  }
}
