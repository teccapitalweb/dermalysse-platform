// Almacenes de PRODUCCIÓN sobre las colecciones ACTUALES del club (proyecto club-dermalysse).
// Leen sin romper las formas que usan el club actual, el panel admin y el webhook; escriben solo
// campos no protegidos (perfil, foro) y el alta de users/members con la forma exacta del club actual.
//
// Campos protegidos de users (firestore.rules · protectedUserFields): NUNCA se escriben aquí.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { CertificateStore, ContentStore, ForumStore, ProfileStore, ProgressStore } from '../interfaces.js';
import type {
  CatalogoRemoto, CertificadoRemoto, ClaseRemota, ConfigPublica, CursoRemoto, DetalleRemoto, HiloRemoto, Noticia,
  PerfilRemoto, ProgresoCurso, ProgresoMapa, RespuestaForo, Usuario,
} from '../../domain/types.js';
import { CodedError, ValidationError } from '../../services/errors.js';
import { aIso, aMillis, texto, type Datos, type FirestorePort } from './port.js';

export const CAMPOS_PROTEGIDOS_USERS = [
  'subscription', 'vigenciaHasta', 'regaloDesde', 'stripeCustomerId', 'stripeSubscriptionId', 'plan', 'status',
  'role', 'admin', 'courtesy', 'isCourtesy', 'progress', 'playbackProgress',
] as const;

/** Precios por defecto: los MISMOS que cobra el webhook si config/club no los define (leerPreciosConfig). */
export const PRECIO_MES_POR_DEFECTO = 200;
export const PRECIO_ANO_POR_DEFECTO = 1799;

/** Folio de certificado del webhook: DRML-YYYY-<12 hex>. */
export const FOLIO_DRML = /^DRML-\d{4}-[0-9A-F]{12}$/;

// ── Catálogo editorial empaquetado (api/content/club/cursos.json) ──

export interface CursoEditorial {
  id: string;
  titulo: string;
  area: string;
  nivel: string;
  instructor: string;
  portada: string;
  descripcion: string;
  aprenderas: string[];
  orden: number;
  clasesEsperadas: number;
}

export function cargarCatalogoEditorial(url = new URL('../../../content/club/cursos.json', import.meta.url)): CursoEditorial[] {
  return (JSON.parse(readFileSync(url, 'utf8')) as { cursos: CursoEditorial[] }).cursos;
}

const lista = (v: unknown): Datos[] => (Array.isArray(v) ? v.filter((x): x is Datos => typeof x === 'object' && x !== null) : []);

/** "1 h 51 min" → 111; "45 min" → 45; sin datos → null. */
export function minutosDeTexto(dur: unknown): number | null {
  const s = texto(dur);
  const h = /(\d+)\s*h/.exec(s);
  const m = /(\d+)\s*min/.exec(s);
  if (!h && !m) return null;
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

/**
 * Clases de un curso de Firestore, POR POSICIÓN: la clase n es lessons[n-1] (los ids como
 * `<curso>-s01-02` agrupan sesiones y no se interpretan). Nunca incluye videoId ni ids de Bunny.
 */
export function clasesDesdeLessons(lessons: unknown): ClaseRemota[] {
  return lista(lessons).map((l, i) => {
    const seg = Number(l.durationSeconds);
    return {
      n: i + 1,
      titulo: texto(l.name).trim() || `Sesión ${String(i + 1).padStart(2, '0')}`,
      duracionMin: Number.isFinite(seg) && seg > 0 ? Math.max(1, Math.round(seg / 60)) : minutosDeTexto(l.dur),
      gratis: l.isPreview === true,
    };
  });
}

/** Cursos publicados de Firestore `courses` cuyo id está en el catálogo editorial. */
export async function cursosPublicados(db: FirestorePort, editorial: CursoEditorial[]): Promise<{ editorial: CursoEditorial; datos: Datos }[]> {
  const porId = new Map(editorial.map((c) => [c.id, c]));
  const docs = await db.query('courses');
  return docs
    .map((d) => ({ editorial: porId.get(d.id), datos: d.data() ?? {} }))
    .filter((x): x is { editorial: CursoEditorial; datos: Datos } => !!x.editorial && x.datos.status === 'published');
}

/** lessonId de la clase n del curso (por posición). null si el curso o la clase no existen / no publicados. */
export async function resolverLeccion(db: FirestorePort, cursoId: string, n: number): Promise<{ lessonId: string; total: number } | null> {
  if (!cursoId || cursoId.includes('/') || !Number.isInteger(n) || n < 1) return null;
  const doc = await db.get(`courses/${cursoId}`);
  const datos = doc.data();
  if (!doc.exists || !datos || datos.status !== 'published') return null;
  const lessons = lista(datos.lessons);
  const leccion = lessons[n - 1];
  const lessonId = leccion ? texto(leccion.id) : '';
  return lessonId ? { lessonId, total: lessons.length } : null;
}

// ── Perfil y alta (users/{uid}, members/{uid}) ──

const LIMITES = { nombre: 80, apellido: 80, telefono: 30, ciudad: 80, foto: 500 };
const AVISOS: Record<string, string> = { enVivo: 'notif_vivo', nuevos: 'notif_cursos', comunidad: 'notif_comunidad', materiales: 'notif_pdfs', promociones: 'notif_promos' };

export function perfilDesdeUsers(d: Datos): PerfilRemoto {
  const settings = (typeof d.settings === 'object' && d.settings !== null ? d.settings : {}) as Datos;
  const avisos: Record<string, boolean> = {};
  for (const [clave, campo] of Object.entries(AVISOS)) avisos[clave] = settings[campo] !== false; // sin valor = activado (club actual)
  return {
    nombre: texto(d.name),
    apellido: texto(d.lastname),
    email: texto(d.email),
    telefono: texto(d.phone),
    ciudad: texto(d.city),
    foto: texto(d.photo),
    avisos,
  };
}

/** Traduce el cuerpo de PATCH /me/perfil a campos NO protegidos de users. Ignora todo lo demás. */
export function cambiosPerfilUsers(cuerpo: Record<string, unknown>): Datos {
  const salida: Datos = {};
  const cadena = (clave: keyof typeof LIMITES, valor: unknown): string | undefined =>
    typeof valor === 'string' ? valor.trim().slice(0, LIMITES[clave]) : undefined;

  const nombre = cadena('nombre', cuerpo.nombre);
  if (nombre !== undefined) {
    if (!nombre) throw new ValidationError('El nombre no puede quedar vacío.');
    salida.name = nombre;
  }
  const apellido = cadena('apellido', cuerpo.apellido);
  if (apellido !== undefined) salida.lastname = apellido;
  const telefono = cadena('telefono', cuerpo.telefono ?? cuerpo.whatsapp);
  if (telefono !== undefined) salida.phone = telefono;
  const ciudad = cadena('ciudad', cuerpo.ciudad);
  if (ciudad !== undefined) salida.city = ciudad;
  const foto = cadena('foto', cuerpo.foto);
  if (foto !== undefined) {
    if (foto && !/^https:\/\/[^\s"'<>]+$/i.test(foto)) throw new ValidationError('La foto debe ser una URL https.');
    salida.photo = foto;
  }
  if (typeof cuerpo.avisos === 'object' && cuerpo.avisos !== null) {
    const settings: Datos = {};
    for (const [clave, campo] of Object.entries(AVISOS)) {
      const v = (cuerpo.avisos as Record<string, unknown>)[clave];
      if (typeof v === 'boolean') settings[campo] = v;
    }
    if (Object.keys(settings).length) salida.settings = settings;
  }
  for (const p of CAMPOS_PROTEGIDOS_USERS) delete salida[p]; // defensa en profundidad
  return salida;
}

const hoyUtc = () => new Date().toISOString().split('T')[0];

export class FirestoreProfileStore implements ProfileStore {
  constructor(private readonly db: FirestorePort) {}

  /**
   * Alta con la forma EXACTA del club actual (registro con Google): users/{uid} y members/{uid}.
   * Usa create() para no pisar nunca un documento existente. Respeta config/platform.openRegistration.
   */
  async asegurarAlta(u: Usuario): Promise<Datos> {
    const rutaUser = `users/${u.uid}`;
    let user = await this.db.get(rutaUser);
    const display = (u.cuenta?.nombre ?? '').trim();
    if (!user.exists) {
      const plataforma = (await this.db.get('config/platform')).data() ?? {};
      if (plataforma.openRegistration === false) {
        throw new CodedError(403, 'registro-cerrado', 'El registro está cerrado temporalmente.');
      }
      await this.db.create(rutaUser, {
        name: display ? display.split(' ')[0] : 'Miembro',
        lastname: display ? display.split(' ').slice(1).join(' ') : '',
        email: u.email,
        phone: '', city: '', bio: '', gotas: 0, streak: 0,
        photo: u.cuenta?.foto || '',
      });
      user = await this.db.get(rutaUser);
    }
    const datos = user.data() ?? {};
    const rutaMember = `members/${u.uid}`;
    if (!(await this.db.get(rutaMember)).exists) {
      const nombre = [texto(datos.name), texto(datos.lastname)].filter(Boolean).join(' ').trim() || display || 'Miembro';
      await this.db.create(rutaMember, {
        id: u.uid, uid: u.uid, name: nombre, email: u.email, plan: 'Free', status: 'active', joined: hoyUtc(), courses: 0,
      });
    }
    return datos;
  }

  async get(u: Usuario): Promise<PerfilRemoto> {
    return perfilDesdeUsers(await this.asegurarAlta(u));
  }

  async patch(u: Usuario, cuerpo: Record<string, unknown>): Promise<PerfilRemoto> {
    const cambios = cambiosPerfilUsers(cuerpo);
    await this.asegurarAlta(u);
    if (Object.keys(cambios).length) await this.db.set(`users/${u.uid}`, cambios, { merge: true });
    return perfilDesdeUsers((await this.db.get(`users/${u.uid}`)).data() ?? {});
  }
}

// ── Contenido: config, catálogo, noticias ──

/** Materiales y eventos públicos del catálogo (sin enlaces). Ver services/contenido.ts. */
export interface FuenteContenidoCatalogo {
  materialesPublicos(): Promise<unknown[]>;
  eventosPublicos(): Promise<unknown[]>;
}

export class FirestoreContentStore implements ContentStore {
  constructor(
    private readonly db: FirestorePort,
    private readonly editorial: CursoEditorial[],
    private readonly foroStore: ForumStore,
    private readonly contenido?: FuenteContenidoCatalogo,
  ) {}

  async config(): Promise<ConfigPublica> {
    const [club, plataforma] = await Promise.all([this.db.get('config/club'), this.db.get('config/platform')]);
    const c = club.data() ?? {};
    const p = plataforma.data() ?? {};
    const contacto: ConfigPublica['contacto'] = {};
    if (texto(c.whatsappSoporte)) contacto.whatsappSoporte = texto(c.whatsappSoporte);
    if (texto(c.canalWhatsApp)) contacto.canalWhatsApp = texto(c.canalWhatsApp);
    return {
      precios: {
        mensual: Number(c.precioMes) > 0 ? Number(c.precioMes) : PRECIO_MES_POR_DEFECTO,
        anual: Number(c.precioAno) > 0 ? Number(c.precioAno) : PRECIO_ANO_POR_DEFECTO,
      },
      descuentoVIP: Number(c.descuentoVIP) > 0 ? Number(c.descuentoVIP) : 0,
      contacto,
      mantenimiento: p.maintenance === true,
      registroAbierto: p.openRegistration !== false,
    };
  }

  async catalogo(): Promise<CatalogoRemoto> {
    const [config, publicados, materiales, eventos] = await Promise.all([
      this.config(), cursosPublicados(this.db, this.editorial),
      this.contenido?.materialesPublicos() ?? [], this.contenido?.eventosPublicos() ?? [],
    ]);
    const cursos: CursoRemoto[] = publicados.map(({ editorial: e, datos }) => ({
      id: e.id,
      titulo: texto(datos.name).trim() || e.titulo,
      area: e.area || texto(datos.cat),
      nivel: e.nivel || texto(datos.level),
      instructor: texto(datos.instructor).trim() || e.instructor,
      portada: e.portada,
      descripcion: e.descripcion || texto(datos.desc),
      aprenderas: [...e.aprenderas],
      orden: e.orden,
      publicado: true,
      bunnyCollectionId: '', // nunca se expone
      clases: clasesDesdeLessons(datos.lessons),
    })).sort((a, b) => a.orden - b.orden);
    return {
      cursos,
      materiales,
      eventos,
      config: {
        precios: config.precios,
        descuentoVIP: config.descuentoVIP,
        whatsappSoporte: config.contacto.whatsappSoporte ?? '',
        canalWhatsApp: config.contacto.canalWhatsApp ?? '',
      },
    };
  }

  async noticias(): Promise<Noticia[]> {
    const docs = await this.db.query('news', { where: [{ campo: 'status', op: '==', valor: 'published' }] });
    return docs
      .map((d) => {
        const n = d.data() ?? {};
        const noticia: Noticia = { id: d.id, titulo: texto(n.title), texto: texto(n.content), fecha: texto(n.date) || (aIso(n.date) ?? ''), enlace: null };
        if (texto(n.cat)) noticia.categoria = texto(n.cat);
        if (texto(n.author)) noticia.autor = texto(n.author);
        return noticia;
      })
      .filter((n) => n.titulo)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 50);
  }

  foro(): Promise<HiloRemoto[]> { return this.foroStore.listar(); }
  hilo(id: string): Promise<DetalleRemoto | null> { return this.foroStore.detalle(id); }
}

// ── Foro: forum/{id} y forum/{id}/replies/{rid} con los campos actuales ──

const idValido = (id: string) => /^[A-Za-z0-9_-]{1,128}$/.test(id);
const likesDe = (d: Datos): string[] => (Array.isArray(d.likes) ? d.likes.filter((x): x is string => typeof x === 'string') : []);

export function hiloDesdeForum(id: string, d: Datos, uid?: string): HiloRemoto {
  const likes = likesDe(d);
  const etiqueta = texto(d.tag);
  const hilo: HiloRemoto = {
    id,
    titulo: texto(d.title),
    texto: texto(d.body),
    autor: texto(d.authorName).trim() || 'Miembro',
    fecha: aIso(d.createdAt) ?? '',
    cursoId: texto(d.courseId) || null,
    util: likes.length,
    respuestas: Math.max(0, Number(d.replyCount) || 0),
    tipo: etiqueta === 'Consulta' ? 'pregunta' : 'post',
  };
  if (etiqueta) hilo.etiqueta = etiqueta;
  if (uid) hilo.marcadoUtil = likes.includes(uid);
  return hilo;
}

export class FirestoreForumStore implements ForumStore {
  constructor(private readonly db: FirestorePort, private readonly limite = 200) {}

  async listar(uid?: string): Promise<HiloRemoto[]> {
    const docs = await this.db.query('forum', { orderBy: { campo: 'createdAt', dir: 'desc' }, limit: this.limite });
    return docs.filter((d) => d.data()?.oculto !== true).map((d) => hiloDesdeForum(d.id, d.data() ?? {}, uid));
  }

  async detalle(id: string, uid?: string): Promise<DetalleRemoto | null> {
    if (!idValido(id)) return null;
    const doc = await this.db.get(`forum/${id}`);
    const d = doc.data();
    if (!doc.exists || !d || d.oculto === true) return null;
    const replies = await this.db.query(`forum/${id}/replies`, { orderBy: { campo: 'createdAt', dir: 'asc' } });
    // Igual que el club actual: abrir un tema suma una vista (si falla, no se interrumpe la lectura).
    await this.db.increment(`forum/${id}`, 'views', 1).catch(() => undefined);
    return {
      hilo: hiloDesdeForum(id, d, uid),
      respuestas: replies.map((r) => {
        const x = r.data() ?? {};
        return { id: r.id, autor: texto(x.authorName).trim() || 'Miembro', texto: texto(x.text), fecha: aIso(x.createdAt) ?? '' };
      }),
    };
  }

  async crearHilo(hilo: HiloRemoto, autorUid: string): Promise<HiloRemoto> {
    const createdAt = Number.isFinite(aMillis(hilo.fecha)) ? aMillis(hilo.fecha) : Date.now();
    const id = await this.db.add('forum', {
      title: hilo.titulo,
      tag: hilo.etiqueta || 'Consulta',
      body: hilo.texto,
      authorUid: autorUid,
      authorName: hilo.autor,
      createdAt, // ms, como el club actual
      replyCount: 0,
      likes: [],
      views: 0,
      ...(hilo.cursoId ? { courseId: hilo.cursoId } : {}),
    });
    return hiloDesdeForum(id, { title: hilo.titulo, tag: hilo.etiqueta || 'Consulta', body: hilo.texto, authorName: hilo.autor, createdAt, replyCount: 0, likes: [], courseId: hilo.cursoId ?? undefined }, autorUid);
  }

  async agregarRespuesta(id: string, respuesta: RespuestaForo, autorUid: string): Promise<RespuestaForo | null> {
    if (!idValido(id)) return null;
    const createdAt = Number.isFinite(aMillis(respuesta.fecha)) ? aMillis(respuesta.fecha) : Date.now();
    const rid = randomBytes(10).toString('hex');
    const creada = await this.db.runTransaction(async (tx) => {
      const tema = await tx.get(`forum/${id}`);
      const d = tema.data();
      if (!tema.exists || !d || d.oculto === true) return false;
      tx.set(`forum/${id}/replies/${rid}`, { text: respuesta.texto, authorUid: autorUid, authorName: respuesta.autor, createdAt, likes: [] });
      tx.set(`forum/${id}`, { replyCount: Math.max(0, Number(d.replyCount) || 0) + 1, lastReplyBy: respuesta.autor.trim() || 'Miembro' }, { merge: true });
      return true;
    });
    return creada ? { ...respuesta, id: rid } : null;
  }

  async alternarUtil(id: string, uid: string): Promise<{ util: number; marcadoUtil: boolean } | null> {
    if (!idValido(id)) return null;
    return this.db.runTransaction(async (tx) => {
      const tema = await tx.get(`forum/${id}`);
      const d = tema.data();
      if (!tema.exists || !d || d.oculto === true) return null;
      const likes = likesDe(d);
      const marcadoUtil = !likes.includes(uid);
      const siguiente = marcadoUtil ? [...likes, uid] : likes.filter((x) => x !== uid);
      tx.set(`forum/${id}`, { likes: siguiente }, { merge: true });
      return { util: siguiente.length, marcadoUtil };
    });
  }
}

// ── Avance (users.progress, users/{uid}/courseProgress) — SOLO lectura: lo acredita el webhook ──

export class FirestoreProgressStore implements ProgressStore {
  private readonly clasesPorCurso: Map<string, number>;

  constructor(private readonly db: FirestorePort, editorial: CursoEditorial[]) {
    this.clasesPorCurso = new Map(editorial.map((c) => [c.id, c.clasesEsperadas]));
  }

  async del(uid: string): Promise<ProgresoMapa> {
    const [user, detalle] = await Promise.all([this.db.get(`users/${uid}`), this.db.query(`users/${uid}/courseProgress`)]);
    const progress = (user.data()?.progress ?? {}) as Datos;
    const porCurso = new Map(detalle.map((d) => [d.id, d.data() ?? {}]));
    const mapa: ProgresoMapa = {};
    if (typeof progress !== 'object' || progress === null) return mapa;
    for (const [cursoId, valor] of Object.entries(progress)) {
      const vistas = [...new Set((Array.isArray(valor) ? valor : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
      const cp = porCurso.get(cursoId) ?? {};
      const total = this.clasesPorCurso.get(cursoId) ?? 0;
      const porcentaje = typeof cp.courseProgress === 'number' && Number.isFinite(cp.courseProgress)
        ? cp.courseProgress
        : total > 0 ? Math.round((vistas.length / total) * 100) : 0;
      mapa[cursoId] = { vistas, ultima: vistas.length ? vistas[vistas.length - 1] : 0, actualizado: aIso(cp.updatedAt) ?? '', porcentaje };
    }
    return mapa;
  }

  async curso(uid: string, cursoId: string): Promise<ProgresoCurso> {
    return (await this.del(uid))[cursoId] ?? { vistas: [], ultima: 0, actualizado: '', porcentaje: 0 };
  }

  async acreditar(): Promise<ProgresoCurso> {
    throw new CodedError(409, 'progreso/solo-webhook', 'El avance lo acredita el reproductor (POST /progreso/:cursoId/evento).');
  }
}

// ── Certificados (certificates/{code}) — SOLO lectura: los emite el webhook ──

export function certificadoDesdeDoc(id: string, d: Datos): CertificadoRemoto {
  return {
    folio: texto(d.code) || id,
    uid: texto(d.uid),
    nombre: texto(d.userName),
    cursoId: texto(d.courseId),
    cursoTitulo: texto(d.courseName),
    area: texto(d.category),
    clases: Number(d.lessonCount) || 0,
    emitido: aIso(d.issuedAt) ?? '',
  };
}

export class FirestoreCertificateStore implements CertificateStore {
  constructor(private readonly db: FirestorePort) {}

  async listar(uid: string): Promise<CertificadoRemoto[]> {
    const docs = await this.db.query('certificates', { where: [{ campo: 'uid', op: '==', valor: uid }] });
    return docs
      .filter((d) => d.data()?.status === 'valid')
      .map((d) => certificadoDesdeDoc(d.id, d.data() ?? {}))
      .sort((a, b) => b.emitido.localeCompare(a.emitido));
  }

  async porFolio(folio: string): Promise<CertificadoRemoto | null> {
    const code = String(folio || '').trim().toUpperCase();
    if (!FOLIO_DRML.test(code)) return null;
    const doc = await this.db.get(`certificates/${code}`);
    const d = doc.data();
    if (!doc.exists || !d || d.status !== 'valid') return null;
    return certificadoDesdeDoc(doc.id, d);
  }

  async emitir(): Promise<CertificadoRemoto> {
    throw new CodedError(409, 'certificado/solo-webhook', 'Los certificados los emite el servidor del club (POST /certificados).');
  }
}
