// Biblioteca, clases en vivo y quizzes de clase (producción sobre las colecciones actuales).
// Reglas:
//  - /catalogo es público: nunca lleva enlaces (drive, live, cv). Los enlaces se piden con sesión.
//  - Material: VIP, admin o material marcado gratis. Evento (transmisión/grabación): VIP o admin
//    (igual que requireMembership del club actual).
//  - Escrituras del admin en pdfs/webinars con la forma del panel viejo y merge; quizzes en v2_quiz.
import type { CursoEditorial } from '../adapters/firestore/club.js';
import {
  COLECCIONES_LEGADO, eventoDesdeWebinar, fechaLegadoDesdeIso, materialDesdePdf, IDS_DEMO_LEGADO, portadaLegado,
  type EventoPublico, type FirestoreContenidoStore, type MaterialPublico, type QuizGuardado,
} from '../adapters/firestore/contenido.js';
import { texto, type Datos } from '../adapters/firestore/port.js';
import type { PreguntaConRespuesta, QuizFixture, Usuario } from '../domain/types.js';
import { CodedError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from './errors.js';

/** Respuesta de GET /materiales/:id/acceso. */
export interface AccesoMaterial { id: string; tipo: 'enlace' | 'visor'; url: string | null }
/** Respuesta de GET /eventos/:id/acceso. */
export interface AccesoEvento { id: string; transmision: string | null; grabacion: string | null }

/** Material del admin: el del cliente + el enlace del archivo (solo con requireAdmin). */
export interface MaterialAdmin extends MaterialPublico { archivo: string; descargas: number; editorial?: boolean }
/** Evento del admin: con enlaces (solo con requireAdmin). */
export interface EventoAdmin extends EventoPublico { enlace: string; grabacion: string; estadoLegado: string }
/** Quiz del admin (forma de src/core/datos.ts · Quiz). */
export interface QuizAdmin { id: string; cursoId: string; n: number; estado: 'borrador' | 'aprobado'; preguntas: PreguntaConRespuesta[]; actualizado: string }

const TIPOS_MATERIAL = ['PDF', 'Libro', 'Presentación', 'Guía'];
const ESTADOS_MATERIAL = ['disponible', 'proximamente', 'oculto'];
const ID_VALIDO = /^[A-Za-z0-9_-]{1,120}$/;
const PORTADA_POR_DEFECTO = '/media/hidrafacial.png'; // respaldo visual del cliente: no se guarda
const MAX_PREGUNTAS = 30;

const accesoTotal = (u: Usuario) => u.esVip || u.esAdmin;

// ── Validación del cuerpo ──

function cadena(cuerpo: Record<string, unknown>, campo: string, max: number, etiqueta: string): string | undefined {
  const v = cuerpo[campo];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw new ValidationError(`${etiqueta}: se espera texto.`);
  const s = v.trim();
  if (s.length > max) throw new ValidationError(`${etiqueta}: máximo ${max} caracteres.`);
  return s;
}

/** Enlace https opcional ('' lo deja vacío). Rechaza los enlaces de ejemplo del panel viejo. */
function enlace(cuerpo: Record<string, unknown>, campo: string, etiqueta: string): string | undefined {
  const s = cadena(cuerpo, campo, 1000, etiqueta);
  if (s === undefined || s === '') return s;
  if (!/^https:\/\/[^\s"'<>]+$/i.test(s)) throw new ValidationError(`${etiqueta}: debe ser una URL https.`);
  if (/ejemplo/i.test(s)) throw new ValidationError(`${etiqueta}: parece un enlace de ejemplo.`);
  return s;
}

function idNuevo(valor: unknown): string {
  const id = typeof valor === 'string' ? valor.trim() : '';
  if (!ID_VALIDO.test(id)) throw new ValidationError('El id debe tener de 1 a 120 caracteres: letras, números, guion o guion bajo.');
  if (IDS_DEMO_LEGADO.has(id)) throw new ValidationError('Ese id está reservado para los valores de ejemplo del panel anterior.');
  return id;
}

function cursoIdDe(cuerpo: Record<string, unknown>, cursos: Set<string>): string | null | undefined {
  const v = cuerpo.cursoId;
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || !cursos.has(v)) throw new ValidationError('El curso relacionado no existe.');
  return v;
}

const hoy = (d: Date) => d.toISOString().split('T')[0];

export interface OpcionesContenido {
  editoriales: MaterialPublico[];
  cursos: CursoEditorial[];
  quizzes: QuizFixture[];
  ahora?: () => Date;
}

export class ContenidoService {
  private readonly editoriales: Map<string, MaterialPublico>;
  private readonly cursos: Map<string, CursoEditorial>;
  private readonly quizzesEmpaquetados: QuizFixture[];
  private readonly ahora: () => Date;

  constructor(private readonly store: FirestoreContenidoStore, opciones: OpcionesContenido) {
    this.editoriales = new Map(opciones.editoriales.map((m) => [m.id, m]));
    this.cursos = new Map(opciones.cursos.map((c) => [c.id, c]));
    this.quizzesEmpaquetados = opciones.quizzes;
    this.ahora = opciones.ahora ?? (() => new Date());
  }

  // ── Público (/catalogo) ──

  /** Documentos reales de `pdfs` (más recientes primero) y luego los editoriales. Sin ocultos ni enlaces. */
  async materialesPublicos(): Promise<MaterialPublico[]> {
    const legado = (await this.store.listar(COLECCIONES_LEGADO.pdfs))
      .map((d) => materialDesdePdf(d.id, d.datos))
      .filter((m) => m.estado !== 'oculto' && !this.editoriales.has(m.id))
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
      .map(({ fecha: _fecha, ...m }) => m);
    return [...legado, ...[...this.editoriales.values()].map((m) => structuredClone(m))];
  }

  /** Webinars con status 'scheduled' (como el club actual), por fecha. Sin enlaces. */
  async eventosPublicos(): Promise<EventoPublico[]> {
    return (await this.store.listar(COLECCIONES_LEGADO.webinars))
      .filter((d) => d.datos.status === 'scheduled')
      .map((d) => eventoDesdeWebinar(d.id, d.datos))
      .filter((e): e is EventoPublico => e !== null)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  // ── Con sesión ──

  async accesoMaterial(usuario: Usuario, id: string): Promise<AccesoMaterial> {
    const editorial = this.editoriales.get(id);
    if (editorial) {
      if (editorial.estado !== 'disponible' || !editorial.url) throw new CodedError(409, 'material/no-disponible', 'Este material aún no está disponible.');
      if (!accesoTotal(usuario) && editorial.gratis !== true) throw new ForbiddenError('Este material es exclusivo para miembros VIP.');
      return { id, tipo: 'visor', url: null };
    }
    const datos = await this.store.leer(COLECCIONES_LEGADO.pdfs, id);
    if (!datos) throw new NotFoundError('El material no existe.');
    const material = materialDesdePdf(id, datos);
    if (material.estado === 'oculto') throw new NotFoundError('El material no existe.');
    const url = texto(datos.drive).trim();
    if (material.estado !== 'disponible' || !url) throw new CodedError(409, 'material/no-disponible', 'Este material aún no está disponible.');
    if (!accesoTotal(usuario) && !material.gratis) throw new ForbiddenError('Este material es exclusivo para miembros VIP.');
    await this.store.sumarDescarga(id);
    return { id, tipo: 'enlace', url };
  }

  async accesoEvento(usuario: Usuario, id: string): Promise<AccesoEvento> {
    const datos = await this.store.leer(COLECCIONES_LEGADO.webinars, id);
    if (!datos || datos.status !== 'scheduled') throw new NotFoundError('La clase en vivo no existe.');
    if (!accesoTotal(usuario)) throw new ForbiddenError('Las clases en vivo son para miembros VIP.');
    return { id, transmision: texto(datos.live).trim() || null, grabacion: texto(datos.drive).trim() || null };
  }

  // ── Admin · materiales (pdfs) ──

  private materialAdmin(id: string, d: Datos): MaterialAdmin {
    const { fecha: _fecha, ...m } = materialDesdePdf(id, d);
    return { ...m, archivo: texto(d.drive).trim(), descargas: Math.max(0, Number(d.downloads) || 0) };
  }

  async adminMateriales(): Promise<MaterialAdmin[]> {
    const legado = (await this.store.listar(COLECCIONES_LEGADO.pdfs))
      .filter((d) => !this.editoriales.has(d.id))
      .sort((a, b) => texto(b.datos.date).localeCompare(texto(a.datos.date)))
      .map((d) => this.materialAdmin(d.id, d.datos));
    const editoriales = [...this.editoriales.values()].map((m) => ({ ...structuredClone(m), archivo: '', descargas: 0, editorial: true }));
    return [...legado, ...editoriales];
  }

  /** Traduce el cuerpo del admin a campos de pdfs (forma vieja + campos propios). */
  private cambiosPdf(cuerpo: Record<string, unknown>, previo: Datos | null): Datos {
    const c: Datos = {};
    const titulo = cadena(cuerpo, 'titulo', 120, 'Título');
    if (titulo !== undefined) { if (!titulo) throw new ValidationError('El título es obligatorio.'); c.name = titulo; }
    const categoria = cadena(cuerpo, 'categoria', 80, 'Categoría');
    if (categoria !== undefined) c.cat = categoria;
    if (cuerpo.paginas !== undefined) {
      const p = Number(cuerpo.paginas);
      if (!Number.isInteger(p) || p < 0 || p > 5000) throw new ValidationError('Páginas: entero de 0 a 5000.');
      c.pages = p;
    }
    const archivo = enlace(cuerpo, 'archivo', 'Archivo');
    if (archivo !== undefined) c.drive = archivo;
    const portada = cadena(cuerpo, 'portada', 500, 'Portada');
    // La portada que el admin recibió (p. ej. la miniatura calculada de Drive) vuelve sin cambios: no se reescribe `img`.
    if (portada !== undefined && portada !== PORTADA_POR_DEFECTO && !(previo && portada === portadaLegado(previo))) {
      if (/^https:\/\/[^\s"'<>]+$/i.test(portada)) {
        if (/ejemplo/i.test(portada)) throw new ValidationError('Portada: parece un enlace de ejemplo.');
        c.img = portada; // campo del panel viejo
        if (previo?.portada) c.portada = ''; // que no gane una ruta local anterior
      } else if (/^\/[A-Za-z0-9_./-]+$/.test(portada) && !portada.includes('..')) c.portada = portada;
      else if (portada) throw new ValidationError('Portada: debe ser una URL https o una ruta del sitio.');
    }
    if (cuerpo.tipo !== undefined) {
      if (typeof cuerpo.tipo !== 'string' || !TIPOS_MATERIAL.includes(cuerpo.tipo)) throw new ValidationError(`Tipo: uno de ${TIPOS_MATERIAL.join(', ')}.`);
      c.tipo = cuerpo.tipo;
    }
    const area = cadena(cuerpo, 'area', 80, 'Área');
    if (area !== undefined) c.area = area;
    const autor = cadena(cuerpo, 'autor', 120, 'Autor');
    if (autor !== undefined) c.autor = autor;
    const descripcion = cadena(cuerpo, 'descripcion', 2000, 'Descripción');
    if (descripcion !== undefined) c.descripcion = descripcion;
    const cursoId = cursoIdDe(cuerpo, new Set(this.cursos.keys()));
    if (cursoId !== undefined) c.cursoId = cursoId ?? '';
    if (cuerpo.estado !== undefined) {
      if (typeof cuerpo.estado !== 'string' || !ESTADOS_MATERIAL.includes(cuerpo.estado)) throw new ValidationError('Estado: disponible, proximamente u oculto.');
      c.estado = cuerpo.estado;
    }
    if (cuerpo.gratis !== undefined) {
      if (typeof cuerpo.gratis !== 'boolean') throw new ValidationError('Gratis: se espera verdadero o falso.');
      c.gratis = cuerpo.gratis;
    }
    const estadoFinal = (c.estado ?? previo?.estado) as string | undefined;
    const driveFinal = (c.drive ?? texto(previo?.drive)) as string;
    if (estadoFinal === 'disponible' && !driveFinal) throw new ValidationError('Para marcarlo disponible indica el enlace del archivo.');
    return c;
  }

  async crearMaterial(usuario: Usuario, cuerpo: Record<string, unknown>): Promise<MaterialAdmin> {
    const id = idNuevo(cuerpo.id);
    if (this.editoriales.has(id)) throw new ConflictError('Ya existe un material con ese id.');
    if (cuerpo.titulo === undefined) throw new ValidationError('El título es obligatorio.');
    const cambios = this.cambiosPdf(cuerpo, null);
    const ahora = this.ahora();
    const datos: Datos = {
      // Forma del panel viejo (addPdf): todos sus campos presentes.
      id, name: cambios.name, cat: cambios.cat ?? 'Guía', pages: cambios.pages ?? 0, downloads: 0, date: hoy(ahora),
      drive: cambios.drive ?? '', img: cambios.img ?? '',
      ...cambios,
      actualizado: ahora.toISOString(), actualizadoPor: usuario.uid,
    };
    if (!(await this.store.crear(COLECCIONES_LEGADO.pdfs, id, datos))) throw new ConflictError('Ya existe un material con ese id.');
    return this.materialAdmin(id, datos);
  }

  async actualizarMaterial(usuario: Usuario, id: string, cuerpo: Record<string, unknown>): Promise<MaterialAdmin> {
    if (this.editoriales.has(id)) throw new ConflictError('Este material editorial se edita en el repositorio del club, no desde el admin.');
    const previo = await this.store.leer(COLECCIONES_LEGADO.pdfs, id);
    if (!previo) throw new NotFoundError('El material no existe.');
    const cambios = this.cambiosPdf(cuerpo, previo);
    await this.store.fusionar(COLECCIONES_LEGADO.pdfs, id, { ...cambios, actualizado: this.ahora().toISOString(), actualizadoPor: usuario.uid });
    return this.materialAdmin(id, (await this.store.leer(COLECCIONES_LEGADO.pdfs, id)) ?? previo);
  }

  async borrarMaterial(id: string): Promise<void> {
    if (this.editoriales.has(id)) throw new ConflictError('Este material editorial se edita en el repositorio del club, no desde el admin.');
    if (!(await this.store.leer(COLECCIONES_LEGADO.pdfs, id))) throw new NotFoundError('El material no existe.');
    await this.store.borrar(COLECCIONES_LEGADO.pdfs, id);
  }

  // ── Admin · eventos (webinars) ──

  private eventoAdmin(id: string, d: Datos): EventoAdmin | null {
    const e = eventoDesdeWebinar(id, d);
    if (!e) return null;
    return { ...e, enlace: texto(d.live).trim(), grabacion: texto(d.drive).trim(), estadoLegado: texto(d.status) };
  }

  async adminEventos(): Promise<EventoAdmin[]> {
    return (await this.store.listar(COLECCIONES_LEGADO.webinars))
      .map((d) => this.eventoAdmin(d.id, d.datos))
      .filter((e): e is EventoAdmin => e !== null)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  private cambiosWebinar(cuerpo: Record<string, unknown>, previo: Datos | null): Datos {
    const c: Datos = {};
    const titulo = cadena(cuerpo, 'titulo', 140, 'Título');
    if (titulo !== undefined) { if (!titulo) throw new ValidationError('El título es obligatorio.'); c.title = titulo; }
    const ponente = cadena(cuerpo, 'ponente', 120, 'Ponente');
    if (ponente !== undefined) { if (!ponente) throw new ValidationError('El ponente es obligatorio.'); c.speaker = ponente; }
    if (cuerpo.fecha !== undefined) {
      const ms = typeof cuerpo.fecha === 'string' ? Date.parse(cuerpo.fecha) : NaN;
      if (!Number.isFinite(ms)) throw new ValidationError('Fecha: se espera una fecha ISO válida.');
      c.date = fechaLegadoDesdeIso(new Date(ms).toISOString());
    }
    if (cuerpo.duracionMin !== undefined) {
      const m = Number(cuerpo.duracionMin);
      if (!Number.isInteger(m) || m < 1 || m > 1440) throw new ValidationError('Duración: minutos enteros de 1 a 1440.');
      c.duration = `${m} min`;
    }
    const live = enlace(cuerpo, 'enlace', 'Enlace de la transmisión');
    if (live !== undefined) c.live = live;
    const grabacion = enlace(cuerpo, 'grabacion', 'Grabación');
    if (grabacion !== undefined) c.drive = grabacion;
    const cursoId = cursoIdDe(cuerpo, new Set(this.cursos.keys()));
    if (cursoId !== undefined) c.cursoId = cursoId ?? '';
    if (cuerpo.publicado !== undefined) {
      if (typeof cuerpo.publicado !== 'boolean') throw new ValidationError('Publicado: se espera verdadero o falso.');
      const actual = texto(previo?.status);
      // Visible = 'scheduled' (lo único que muestra el club actual). Oculto = 'draft', salvo otro estado ya puesto en el panel viejo.
      if (cuerpo.publicado) c.status = 'scheduled';
      else if (!actual || actual === 'scheduled') c.status = 'draft';
    }
    return c;
  }

  async crearEvento(usuario: Usuario, cuerpo: Record<string, unknown>): Promise<EventoAdmin> {
    const id = idNuevo(cuerpo.id);
    for (const campo of ['titulo', 'ponente', 'fecha'] as const) {
      if (cuerpo[campo] === undefined) throw new ValidationError(`Falta ${campo}.`);
    }
    const cambios = this.cambiosWebinar({ publicado: true, duracionMin: 60, ...cuerpo }, null);
    const datos: Datos = {
      // Forma del panel viejo (addWebinar).
      id, title: cambios.title, date: cambios.date, duration: cambios.duration, speaker: cambios.speaker,
      cv: '', live: '', drive: '', img: '', registered: 0, status: 'scheduled',
      ...cambios,
      actualizado: this.ahora().toISOString(), actualizadoPor: usuario.uid,
    };
    if (!(await this.store.crear(COLECCIONES_LEGADO.webinars, id, datos))) throw new ConflictError('Ya existe una clase en vivo con ese id.');
    return this.eventoAdmin(id, datos)!;
  }

  async actualizarEvento(usuario: Usuario, id: string, cuerpo: Record<string, unknown>): Promise<EventoAdmin> {
    const previo = await this.store.leer(COLECCIONES_LEGADO.webinars, id);
    if (!previo) throw new NotFoundError('La clase en vivo no existe.');
    const cambios = this.cambiosWebinar(cuerpo, previo);
    await this.store.fusionar(COLECCIONES_LEGADO.webinars, id, { ...cambios, actualizado: this.ahora().toISOString(), actualizadoPor: usuario.uid });
    const actual = (await this.store.leer(COLECCIONES_LEGADO.webinars, id)) ?? previo;
    const e = this.eventoAdmin(id, actual);
    if (!e) throw new ValidationError('La clase en vivo guardada no tiene una fecha válida.');
    return e;
  }

  async borrarEvento(id: string): Promise<void> {
    if (!(await this.store.leer(COLECCIONES_LEGADO.webinars, id))) throw new NotFoundError('La clase en vivo no existe.');
    await this.store.borrar(COLECCIONES_LEGADO.webinars, id);
  }

  // ── Admin · quizzes (v2_quiz sobre el banco empaquetado) ──

  async adminQuizzes(): Promise<QuizAdmin[]> {
    const porId = new Map<string, QuizAdmin>();
    for (const q of this.quizzesEmpaquetados) {
      porId.set(`${q.cursoId}_${q.n}`, { id: `${q.cursoId}_${q.n}`, cursoId: q.cursoId, n: q.n, estado: 'aprobado', preguntas: structuredClone(q.preguntas), actualizado: '' });
    }
    for (const q of await this.store.quizzes()) {
      porId.set(`${q.cursoId}_${q.n}`, { id: `${q.cursoId}_${q.n}`, ...q });
    }
    return [...porId.values()].sort((a, b) => a.cursoId.localeCompare(b.cursoId) || a.n - b.n);
  }

  async guardarQuiz(usuario: Usuario, id: string, cuerpo: Record<string, unknown>): Promise<QuizAdmin> {
    const m = /^(.+)_(\d+)$/.exec(id);
    const curso = m ? this.cursos.get(m[1]) : undefined;
    const n = m ? Number(m[2]) : 0;
    if (!m || !curso || !Number.isInteger(n) || n < 1 || n > curso.clasesEsperadas) throw new NotFoundError('La clase no existe.');
    const estado = cuerpo.estado;
    if (estado !== 'borrador' && estado !== 'aprobado') throw new ValidationError('Estado: borrador o aprobado.');
    const preguntas = validarPreguntas(cuerpo.preguntas, estado === 'aprobado');
    const quiz: QuizGuardado = { cursoId: curso.id, n, estado, preguntas, actualizado: this.ahora().toISOString() };
    await this.store.guardarQuiz(quiz, usuario.uid);
    return { id: `${curso.id}_${n}`, ...quiz };
  }
}

/** Valida las preguntas del admin. Aprobado: al menos una, sin vacíos y con opciones distintas. */
export function validarPreguntas(valor: unknown, estricto: boolean): PreguntaConRespuesta[] {
  if (!Array.isArray(valor)) throw new ValidationError('Preguntas: se espera un arreglo.');
  if (valor.length > MAX_PREGUNTAS) throw new ValidationError(`Máximo ${MAX_PREGUNTAS} preguntas.`);
  if (estricto && !valor.length) throw new ValidationError('Agrega al menos una pregunta para aprobar.');
  return valor.map((p, i) => {
    const etiqueta = `Pregunta ${i + 1}`;
    if (typeof p !== 'object' || p === null) throw new ValidationError(`${etiqueta}: formato inválido.`);
    const x = p as Record<string, unknown>;
    if (typeof x.q !== 'string' || x.q.trim().length > 500) throw new ValidationError(`${etiqueta}: el enunciado debe ser texto de hasta 500 caracteres.`);
    if (!Array.isArray(x.opciones) || x.opciones.length < 2 || x.opciones.length > 6 || !x.opciones.every((o) => typeof o === 'string' && o.trim().length <= 300)) {
      throw new ValidationError(`${etiqueta}: de 2 a 6 opciones de texto (hasta 300 caracteres).`);
    }
    const opciones = (x.opciones as string[]).map((o) => o.trim());
    const correcta = Number(x.correcta);
    if (!Number.isInteger(correcta) || correcta < 0 || correcta >= opciones.length) throw new ValidationError(`${etiqueta}: la respuesta correcta no es una opción válida.`);
    if (x.explicacion !== undefined && (typeof x.explicacion !== 'string' || x.explicacion.length > 1000)) throw new ValidationError(`${etiqueta}: la explicación debe ser texto de hasta 1000 caracteres.`);
    const q = x.q.trim();
    if (estricto) {
      if (!q || opciones.some((o) => !o)) throw new ValidationError(`${etiqueta}: hay campos vacíos.`);
      if (new Set(opciones.map((o) => o.toLocaleLowerCase('es-MX'))).size !== opciones.length) throw new ValidationError(`${etiqueta}: hay opciones repetidas.`);
    }
    return { q, opciones, correcta, explicacion: typeof x.explicacion === 'string' ? x.explicacion.trim() : '' };
  });
}
