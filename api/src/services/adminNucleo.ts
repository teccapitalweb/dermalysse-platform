// Núcleo del panel de administración nuevo sobre las colecciones ACTUALES del club (club-dermalysse):
// resumen, cursos, miembros (+ cortesía), avisos, moderación del foro y configuración.
//
// Compatibilidad con el panel admin actual (admin_club_dermalysse) y el club actual:
//  - se escriben EXACTAMENTE sus nombres de campo (courses.name/desc/cat/level/status/order/lessons,
//    notifications.type/title/msg/recipients/date, config/club.precioMes/precioAno, config/platform…), siempre con merge;
//  - nunca se borra un campo que lo viejo usa; los `videoId` / `bunnyCollectionId` de `courses` no salen
//    al navegador ni se editan desde aquí (se conservan tal cual al reescribir `lessons`);
//  - la cortesía (días VIP) va SOLO por services/vip.ts; nunca se escribe `subscription` (Stripe/webhook)
//    ni otro campo protegido de users (CAMPOS_PROTEGIDOS_USERS);
//  - lo nuevo vive en colecciones `v2_*` (motivo de la última cortesía: v2_admin_cortesias).
import { membershipAccess, resumenAcceso } from '../adapters/firebase/accessPolicy.js';
import { cargarCatalogoEditorial, hiloDesdeForum, minutosDeTexto, PRECIO_ANO_POR_DEFECTO, PRECIO_MES_POR_DEFECTO, type CursoEditorial } from '../adapters/firestore/club.js';
import { aIso, aMillis, texto, type Datos, type FirestorePort } from '../adapters/firestore/port.js';
import { segmento } from '../adapters/firestore/v2.js';
import type { Usuario } from '../domain/types.js';
import { CodedError, ConflictError, NotFoundError, ValidationError } from './errors.js';
import { diasVipValidos, DIAS_VIP_MAX, otorgarDiasVipEnTx } from './vip.js';

export const COLECCION_CORTESIAS_ADMIN = 'v2_admin_cortesias';

const DIA_MS = 86_400_000;
const VENTANA_MS = 30 * DIA_MS;
const ID_SEGURO = /^[A-Za-z0-9_.-]{1,200}$/;
/** Tipos de aviso del panel actual (NOTIF_TYPES) + 'info' (icono de campana en el club actual). */
const TIPOS_AVISO = ['info', 'curso', 'vivo', 'pdf', 'promo'] as const;

// ── Formas de respuesta (las que espera src/admin/remoto.ts) ──

export interface ResumenAdmin {
  miembrosActivos: number;
  altas30d: number;
  bajas30d: number;
  clasesVistas30d: number;
  certificados30d: number;
  temasForo30d: number;
  cursosTop: { cursoId: string; titulo: string; vistas: number }[];
}

export interface ClaseAdmin {
  n: number;
  /** Id estable de la clase en Firestore (lessons[i].id). Sirve para detectar reordenamientos. */
  id: string;
  titulo: string;
  descripcion: string;
  duracionMin: number | null;
  gratis: boolean;
  /** true si la clase ya tiene video vinculado (el id del video nunca se expone). */
  conVideo: boolean;
  videoId: '';
}

export interface CursoAdmin {
  id: string;
  titulo: string;
  area: string;
  nivel: string;
  instructor: string;
  portada: string;
  descripcion: string;
  aprenderas: string[];
  orden: number;
  publicado: boolean;
  /** Nunca se expone: siempre ''. */
  bunnyCollectionId: '';
  liberacion: string;
  /** true si el curso está en el catálogo editorial del club nuevo (solo esos se muestran a los miembros). */
  enCatalogo: boolean;
  clases: ClaseAdmin[];
}

export interface MiembroFila {
  uid: string;
  nombre: string;
  email: string;
  plan: 'mensual' | 'anual' | 'cortesia' | null;
  vence: string | null;
  alta: string;
  clasesVistas: number;
  ultimaActividad: string;
  cortesiaHasta: string | null;
  cortesiaMotivo: string;
  esVip: boolean;
  esAdmin: boolean;
}

export interface MiembroDetalle {
  uid: string; nombre: string; email: string; esVip: boolean; esAdmin: boolean;
  plan: 'mensual' | 'anual' | 'cortesia' | null; vence: string | null; cortesiaHasta: string | null;
  motivoAcceso: string;
  cortesia: { motivo: string; hasta: string } | null;
  /** Sin ids de Stripe (customer/subscription). */
  suscripcion: { estado: string; plan: string; periodoFin: string | null; cancelaAlFinal: boolean } | null;
  miembro: { plan: string | null; estado: string | null } | null;
  progreso: { cursoId: string; titulo: string; vistas: number[]; total: number; actualizado: string | null; certificado: string | null }[];
  certificados: { folio: string; cursoTitulo: string; emitido: string }[];
}

export interface AvisoAdmin { id: string; titulo: string; texto: string; enlace?: string; fecha: string; tipo: string; destinatarios: number }

export interface ConfigAdmin {
  precios: { mensual: number; anual: number };
  descuentoVIP: number;
  whatsappSoporte: string;
  canalWhatsApp: string;
  mantenimiento: boolean;
  registroAbierto: boolean;
  avisoNuevoMiembro: boolean;
  actualizadoPor: string | null;
  actualizadoEn: string | null;
}

// ── Utilidades ──

const lista = (v: unknown): Datos[] => (Array.isArray(v) ? v.filter((x): x is Datos => typeof x === 'object' && x !== null) : []);
const mapa = (v: unknown): Datos => (typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Datos : {});
const esCadena = (v: unknown): v is string => typeof v === 'string';

/** Id de documento recibido en la URL: si no es seguro para Firestore, el recurso no existe (404). */
export function idDeRuta(valor: unknown, que = 'Recurso'): string {
  const s = String(valor ?? '');
  if (!ID_SEGURO.test(s) || s === '.' || s === '..') throw new NotFoundError(`${que} no encontrado.`);
  return segmento(s);
}

function cadenaValidada(valor: unknown, campo: string, max: number, { requerido = false } = {}): string {
  if (!esCadena(valor)) throw new ValidationError(`«${campo}» debe ser texto.`);
  const s = valor.trim();
  if (requerido && !s) throw new ValidationError(`«${campo}» no puede quedar vacío.`);
  if (s.length > max) throw new ValidationError(`«${campo}» admite como máximo ${max} caracteres.`);
  return s;
}

/** Fecha ISO de un valor de Firestore; las fechas 'YYYY-MM-DD' se toman a mediodía UTC. */
function isoDeFecha(v: unknown): string | null {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T12:00:00.000Z`).toISOString();
  return aIso(v);
}

function enVentana(v: unknown, ahoraMs: number): boolean {
  const iso = isoDeFecha(v);
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) && ms <= ahoraMs && ahoraMs - ms <= VENTANA_MS;
}

function clasesVistasDe(user: Datos): number {
  return Object.values(mapa(user.progress)).reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
}

function nombreDe(user: Datos | undefined, member: Datos | undefined, email: string): string {
  const deUser = [texto(user?.name), texto(user?.lastname)].filter(Boolean).join(' ').trim();
  return deUser || texto(member?.name).trim() || email.split('@')[0] || 'Sin nombre';
}

function claseDesdeLesson(l: Datos, i: number): ClaseAdmin {
  const seg = Number(l.durationSeconds);
  return {
    n: i + 1,
    id: texto(l.id),
    titulo: texto(l.name).trim() || `Sesión ${String(i + 1).padStart(2, '0')}`,
    descripcion: texto(l.desc),
    duracionMin: Number.isFinite(seg) && seg > 0 ? Math.max(1, Math.round(seg / 60)) : minutosDeTexto(l.dur),
    gratis: l.isPreview === true,
    conVideo: !!texto(l.videoId).trim(),
    videoId: '',
  };
}

// ── Servicio ──

export class ServicioAdminNucleo {
  private editorialCache?: Map<string, CursoEditorial>;

  constructor(
    private readonly db: FirestorePort,
    private readonly ahora: () => Date,
    private readonly cargarEditorial: () => CursoEditorial[] = cargarCatalogoEditorial,
  ) {}

  private editorial(): Map<string, CursoEditorial> {
    if (!this.editorialCache) {
      try { this.editorialCache = new Map(this.cargarEditorial().map((c) => [c.id, c])); }
      catch { this.editorialCache = new Map(); }
    }
    return this.editorialCache;
  }

  private async datosDe(coleccion: string): Promise<Map<string, Datos>> {
    const docs = await this.db.query(coleccion);
    return new Map(docs.map((d) => [d.id, d.data() ?? {}]));
  }

  // ═══ RESUMEN ═══

  async resumen(): Promise<ResumenAdmin> {
    const ahoraMs = this.ahora().getTime();
    const [users, members, courses, certificados, foro] = await Promise.all([
      this.datosDe('users'), this.datosDe('members'), this.datosDe('courses'),
      this.db.query('certificates'), this.db.query('forum', { orderBy: { campo: 'createdAt', dir: 'desc' }, limit: 1000 }),
    ]);

    let miembrosActivos = 0;
    let bajas30d = 0;
    const conAvance: string[] = [];
    for (const [uid, u] of users) {
      if (membershipAccess(u, ahoraMs).allowed) miembrosActivos++;
      else {
        // Baja = el último acceso (cortesía o periodo pagado) terminó dentro de los últimos 30 días.
        const fin = Math.max(aMillis(u.vigenciaHasta) || 0, aMillis(mapa(u.subscription).currentPeriodEnd) || 0);
        if (fin > 0 && fin <= ahoraMs && ahoraMs - fin <= VENTANA_MS) bajas30d++;
      }
      if (clasesVistasDe(u) > 0) conAvance.push(uid);
    }

    const altas30d = [...members.values()].filter((m) => enVentana(m.joined, ahoraMs)).length;

    // Clases completadas en 30 días: users/{uid}/courseProgress.lessonProgress[*] con completed y lastSeenAt reciente.
    const vistasPorCurso = new Map<string, number>();
    for (let i = 0; i < conAvance.length; i += 20) {
      const lote = await Promise.all(conAvance.slice(i, i + 20).map((uid) => this.db.query(`users/${uid}/courseProgress`)));
      for (const docs of lote) {
        for (const d of docs) {
          const datos = d.data() ?? {};
          const cursoId = texto(datos.courseId) || d.id;
          const recientes = Object.values(mapa(datos.lessonProgress))
            .filter((l) => mapa(l).completed === true && enVentana(mapa(l).lastSeenAt, ahoraMs)).length;
          if (recientes) vistasPorCurso.set(cursoId, (vistasPorCurso.get(cursoId) ?? 0) + recientes);
        }
      }
    }
    const clasesVistas30d = [...vistasPorCurso.values()].reduce((a, b) => a + b, 0);
    const cursosTop = [...vistasPorCurso.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cursoId, vistas]) => ({
        cursoId,
        titulo: texto(courses.get(cursoId)?.name).trim() || this.editorial().get(cursoId)?.titulo || cursoId,
        vistas,
      }));

    const certificados30d = certificados
      .map((d) => d.data() ?? {})
      .filter((c) => c.status === 'valid' && enVentana(c.issuedAt, ahoraMs)).length;
    const temasForo30d = foro.filter((d) => enVentana(d.data()?.createdAt, ahoraMs)).length;

    return { miembrosActivos, altas30d, bajas30d, clasesVistas30d, certificados30d, temasForo30d, cursosTop };
  }

  // ═══ CURSOS ═══

  private cursoDesdeDoc(id: string, d: Datos, i = 0): CursoAdmin {
    const e = this.editorial().get(id);
    return {
      id,
      titulo: texto(d.name).trim() || e?.titulo || id,
      area: texto(d.cat) || e?.area || '',
      nivel: texto(d.level) || e?.nivel || '',
      instructor: texto(d.instructor),
      portada: e?.portada ?? '',
      descripcion: texto(d.desc),
      aprenderas: e ? [...e.aprenderas] : [],
      orden: Number(d.order) > 0 ? Number(d.order) : i + 1,
      publicado: d.status === 'published',
      bunnyCollectionId: '',
      liberacion: texto(d.releaseType) || 'immediate',
      enCatalogo: !!e,
      clases: lista(d.lessons).map(claseDesdeLesson),
    };
  }

  async cursos(): Promise<CursoAdmin[]> {
    const docs = await this.db.query('courses');
    return docs
      .map((d, i) => this.cursoDesdeDoc(d.id, d.data() ?? {}, i))
      .sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, 'es'));
  }

  /**
   * Metadatos editables → campos del panel actual. Solo lo presente en el cuerpo; lo demás se ignora
   * (portada, aprenderas, videoId, bunnyCollectionId nunca se escriben desde aquí).
   */
  private metadatosCurso(cuerpo: Datos): Datos {
    const cambios: Datos = {};
    if (cuerpo.titulo !== undefined) cambios.name = cadenaValidada(cuerpo.titulo, 'titulo', 140, { requerido: true });
    if (cuerpo.descripcion !== undefined) cambios.desc = cadenaValidada(cuerpo.descripcion, 'descripcion', 2000);
    if (cuerpo.area !== undefined) cambios.cat = cadenaValidada(cuerpo.area, 'area', 60, { requerido: true });
    if (cuerpo.nivel !== undefined) cambios.level = cadenaValidada(cuerpo.nivel, 'nivel', 40, { requerido: true });
    if (cuerpo.instructor !== undefined) cambios.instructor = cadenaValidada(cuerpo.instructor, 'instructor', 120);
    if (cuerpo.publicado !== undefined) {
      if (typeof cuerpo.publicado !== 'boolean') throw new ValidationError('«publicado» debe ser verdadero o falso.');
      cambios.status = cuerpo.publicado ? 'published' : 'draft';
    }
    if (cuerpo.orden !== undefined) {
      if (!Number.isInteger(cuerpo.orden) || (cuerpo.orden as number) < 1 || (cuerpo.orden as number) > 999) {
        throw new ValidationError('«orden» debe ser un entero de 1 a 999.');
      }
      cambios.order = cuerpo.orden;
    }
    return cambios;
  }

  /** PATCH /admin/cursos/:id — merge sobre courses/{id} con la forma del panel actual. */
  async editarCurso(idCrudo: string, cuerpo: unknown): Promise<CursoAdmin> {
    const id = idDeRuta(idCrudo, 'Curso');
    const c = mapa(cuerpo);
    const cambios = this.metadatosCurso(c);
    const clasesNuevas = c.clases;
    if (clasesNuevas !== undefined && !Array.isArray(clasesNuevas)) throw new ValidationError('«clases» debe ser una lista.');
    if (!Object.keys(cambios).length && clasesNuevas === undefined) throw new ValidationError('No hay cambios válidos que guardar.');

    const ruta = `courses/${id}`;
    const resultado = await this.db.runTransaction(async (tx) => {
      const doc = await tx.get(ruta);
      const actual = doc.data();
      if (!doc.exists || !actual) throw new NotFoundError('Curso no encontrado.');
      const lessons = lista(actual.lessons);

      if (Array.isArray(clasesNuevas)) {
        // Solo títulos y descripciones de las clases EXISTENTES, en su misma posición: la clase n es
        // lessons[n-1] para el avance y los certificados, y cada una conserva su videoId.
        if (clasesNuevas.length !== lessons.length) {
          throw new CodedError(409, 'cursos/estructura-clases', 'Agregar, quitar o reordenar clases se hace en el panel actual (vincula los videos de Bunny). Aquí solo se editan títulos y descripciones.');
        }
        let cambio = false;
        const siguientes = lessons.map((l, i) => {
          const k = mapa(clasesNuevas[i]);
          const idClase = k.id === undefined ? '' : String(k.id);
          if (idClase && texto(l.id) && idClase !== texto(l.id)) {
            throw new CodedError(409, 'cursos/estructura-clases', 'El orden de las clases cambió: recarga el curso. Reordenar clases se hace en el panel actual.');
          }
          const siguiente: Datos = { ...l };
          if (k.titulo !== undefined) siguiente.name = cadenaValidada(k.titulo, `clase ${i + 1}: titulo`, 140, { requerido: true });
          if (k.descripcion !== undefined) siguiente.desc = cadenaValidada(k.descripcion, `clase ${i + 1}: descripcion`, 1000);
          if (siguiente.name !== l.name || siguiente.desc !== l.desc) cambio = true;
          return siguiente;
        });
        if (cambio) cambios.lessons = siguientes;
      }

      if (cambios.status === 'published' && (!lessons.length || lessons.some((l) => !texto(l.videoId).trim()))) {
        throw new CodedError(409, 'cursos/sin-video', 'No se puede publicar: hay clases sin video vinculado. Vincúlalos en el panel actual.');
      }
      if (cambios.order !== undefined && texto(actual.releaseType).toLowerCase() === 'drip' && Number(actual.order) !== cambios.order) {
        throw new CodedError(409, 'cursos/orden-goteo', 'Este curso se libera por goteo: su orden define cuándo se desbloquea para cada miembro. Cámbialo en el panel actual.');
      }

      const escribir: Datos = { ...cambios, updatedAt: this.ahora().toISOString() };
      tx.set(ruta, escribir, { merge: true });
      return { ...actual, ...escribir };
    });
    return this.cursoDesdeDoc(id, resultado);
  }

  /**
   * POST /admin/cursos — alta con la forma de `addCurso` del panel actual. Se crea SIEMPRE como borrador:
   * sus clases no tienen video hasta que se vinculen con Bunny en el panel actual.
   */
  async crearCurso(cuerpo: unknown): Promise<CursoAdmin> {
    const c = mapa(cuerpo);
    const id = typeof c.id === 'string' && ID_SEGURO.test(c.id) ? c.id : '';
    if (!id) throw new ValidationError('«id» debe tener solo letras, números, guion, guion bajo o punto (máx. 200).');
    const meta = this.metadatosCurso({ ...c, publicado: undefined, orden: undefined });
    if (!meta.name) throw new ValidationError('«titulo» es obligatorio.');
    const clases = Array.isArray(c.clases) ? c.clases.map(mapa) : [];
    if (!clases.length || clases.length > 200) throw new ValidationError('El curso necesita de 1 a 200 clases.');
    const lessons = clases.map((k, i) => {
      const min = Number(k.duracionMin);
      return {
        id: `${id}-s${String(i + 1).padStart(2, '0')}`,
        name: cadenaValidada(k.titulo, `clase ${i + 1}: titulo`, 140, { requerido: true }),
        desc: k.descripcion === undefined ? '' : cadenaValidada(k.descripcion, `clase ${i + 1}: descripcion`, 1000),
        dur: Number.isInteger(min) && min > 0 && min < 10_000 ? `${min} min` : '',
        videoId: '', drive: '', isPreview: k.gratis === true, order: i + 1, provider: '',
      };
    });
    const existentes = await this.db.query('courses');
    const orden = existentes.reduce((m, d) => Math.max(m, Number(d.data()?.order) || 0), 0) + 1;
    const ahora = this.ahora().toISOString();
    const doc: Datos = {
      id, name: meta.name, desc: meta.desc ?? '', cat: meta.cat ?? '', level: meta.level ?? 'Básico',
      instructor: meta.instructor ?? '', status: 'draft', temario: '', img: '', lessons,
      releaseType: 'immediate', order: orden, unlockDate: '', date: ahora.split('T')[0], updatedAt: ahora,
    };
    if (!(await this.db.create(`courses/${segmento(id)}`, doc))) throw new ConflictError('Ya existe un curso con ese id.');
    return this.cursoDesdeDoc(id, doc);
  }

  /** DELETE /admin/cursos/:id — solo borradores sin avance ni certificados (nunca un curso con historial). */
  async borrarCurso(idCrudo: string): Promise<{ ok: true; id: string }> {
    const id = idDeRuta(idCrudo, 'Curso');
    const doc = await this.db.get(`courses/${id}`);
    const d = doc.data();
    if (!doc.exists || !d) throw new NotFoundError('Curso no encontrado.');
    if (d.status === 'published') throw new CodedError(409, 'cursos/publicado', 'Oculta el curso antes de borrarlo.');
    if (this.editorial().has(id)) throw new CodedError(409, 'cursos/en-catalogo', 'Este curso es parte del catálogo del club; ocúltalo en lugar de borrarlo.');
    const [certs, users] = await Promise.all([
      this.db.query('certificates', { where: [{ campo: 'courseId', op: '==', valor: id }], limit: 1 }),
      this.db.query('users'),
    ]);
    const conAvance = users.some((u) => { const v = mapa(u.data()?.progress)[id]; return Array.isArray(v) && v.length > 0; });
    if (certs.length || conAvance) throw new CodedError(409, 'cursos/con-historial', 'Hay miembros con avance o certificados en este curso; ocúltalo en lugar de borrarlo.');
    await this.db.delete(`courses/${id}`);
    return { ok: true, id };
  }

  // ═══ MIEMBROS ═══

  async miembros(estado: unknown = 'todos'): Promise<MiembroFila[]> {
    const filtro = estado === undefined || estado === '' ? 'todos' : String(estado);
    if (!['todos', 'vip', 'cortesia', 'sin'].includes(filtro)) throw new ValidationError('«estado» debe ser todos, vip, cortesia o sin.');
    const ahoraMs = this.ahora().getTime();
    const [members, users, admins, cortesias] = await Promise.all([
      this.datosDe('members'), this.datosDe('users'), this.datosDe('admins'), this.datosDe(COLECCION_CORTESIAS_ADMIN),
    ]);
    // Base: members (como el panel actual) + cuentas de users con correo que no tengan members.
    const uids = new Set<string>(members.keys());
    for (const [uid, u] of users) if (texto(u.email)) uids.add(uid);

    const filas = [...uids].map((uid): MiembroFila => {
      const m = members.get(uid);
      const u = users.get(uid) ?? {};
      const email = texto(u.email) || texto(m?.email);
      const acceso = resumenAcceso(u, ahoraMs);
      const cortesiaMs = aMillis(u.vigenciaHasta);
      const cortesiaHasta = Number.isFinite(cortesiaMs) && cortesiaMs > ahoraMs ? new Date(cortesiaMs).toISOString() : null;
      return {
        uid,
        nombre: nombreDe(u, m, email),
        email,
        plan: acceso.plan,
        vence: acceso.vence,
        alta: isoDeFecha(m?.joined) ?? isoDeFecha(mapa(u.subscription).subscribedAt) ?? '',
        clasesVistas: clasesVistasDe(u),
        ultimaActividad: isoDeFecha(u._lastLoginDate) ?? '',
        cortesiaHasta,
        cortesiaMotivo: cortesiaHasta ? texto(cortesias.get(uid)?.motivo) : '',
        esVip: acceso.esVip,
        esAdmin: admins.has(uid),
      };
    });

    const filtradas = filas.filter((f) => {
      if (filtro === 'vip') return f.esVip && !f.cortesiaHasta;
      if (filtro === 'cortesia') return !!f.cortesiaHasta;
      if (filtro === 'sin') return !f.esVip;
      return true;
    });
    return filtradas.sort((a, b) => b.alta.localeCompare(a.alta) || a.nombre.localeCompare(b.nombre, 'es'));
  }

  async miembro(uidCrudo: string): Promise<MiembroDetalle> {
    const uid = idDeRuta(uidCrudo, 'Miembro');
    const ahoraMs = this.ahora().getTime();
    const [userDoc, memberDoc, adminDoc, cortesiaDoc, avance, certs, courses] = await Promise.all([
      this.db.get(`users/${uid}`), this.db.get(`members/${uid}`), this.db.get(`admins/${uid}`),
      this.db.get(`${COLECCION_CORTESIAS_ADMIN}/${uid}`), this.db.query(`users/${uid}/courseProgress`),
      this.db.query('certificates', { where: [{ campo: 'uid', op: '==', valor: uid }] }), this.datosDe('courses'),
    ]);
    if (!userDoc.exists && !memberDoc.exists) throw new NotFoundError('Miembro no encontrado.');
    const u = userDoc.data() ?? {};
    const m = memberDoc.data();
    const email = texto(u.email) || texto(m?.email);
    const acceso = resumenAcceso(u, ahoraMs);
    const cortesiaMs = aMillis(u.vigenciaHasta);
    const cortesiaHasta = Number.isFinite(cortesiaMs) && cortesiaMs > ahoraMs ? new Date(cortesiaMs).toISOString() : null;
    const sub = mapa(u.subscription);

    const validos = certs.map((d) => ({ id: d.id, d: d.data() ?? {} })).filter((c) => c.d.status === 'valid');
    const certPorCurso = new Map(validos.map((c) => [texto(c.d.courseId), texto(c.d.code) || c.id]));
    const detallePorCurso = new Map(avance.map((d) => [texto(d.data()?.courseId) || d.id, d.data() ?? {}]));
    const tituloDe = (cursoId: string) => texto(courses.get(cursoId)?.name).trim() || this.editorial().get(cursoId)?.titulo || cursoId;

    const progreso = Object.entries(mapa(u.progress)).map(([cursoId, valor]) => ({
      cursoId,
      titulo: tituloDe(cursoId),
      vistas: [...new Set((Array.isArray(valor) ? valor : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b),
      total: lista(courses.get(cursoId)?.lessons).length || this.editorial().get(cursoId)?.clasesEsperadas || 0,
      actualizado: aIso(detallePorCurso.get(cursoId)?.updatedAt),
      certificado: certPorCurso.get(cursoId) ?? null,
    }));

    return {
      uid,
      nombre: nombreDe(u, m, email),
      email,
      esVip: acceso.esVip,
      esAdmin: adminDoc.exists,
      plan: acceso.plan,
      vence: acceso.vence,
      cortesiaHasta,
      motivoAcceso: acceso.motivo,
      cortesia: cortesiaHasta ? { motivo: texto(cortesiaDoc.data()?.motivo), hasta: cortesiaHasta } : null,
      suscripcion: texto(sub.status)
        ? { estado: texto(sub.status), plan: texto(sub.plan), periodoFin: aIso(sub.currentPeriodEnd), cancelaAlFinal: sub.cancelAtPeriodEnd === true }
        : null,
      miembro: m ? { plan: texto(m.plan) || null, estado: texto(m.status) || null } : null,
      progreso,
      certificados: validos
        .map((c) => ({ folio: texto(c.d.code) || c.id, cursoTitulo: texto(c.d.courseName) || tituloDe(texto(c.d.courseId)), emitido: aIso(c.d.issuedAt) ?? '' }))
        .sort((a, b) => b.emitido.localeCompare(a.emitido)),
    };
  }

  /**
   * POST /admin/miembros/:uid/cortesia — body { dias, motivo }. Días VIP con la regla de vip.ts (fuente
   * 'admin', referencia = uid del admin) y el motivo en v2_admin_cortesias/{uid}, en la misma transacción.
   */
  async otorgarCortesia(admin: Usuario, uidCrudo: string, cuerpo: unknown): Promise<{ uid: string; cortesiaHasta: string; regaloDesde: string; dias: number; motivo: string }> {
    const uid = idDeRuta(uidCrudo, 'Miembro');
    const c = mapa(cuerpo);
    if (!diasVipValidos(c.dias)) throw new ValidationError(`«dias» debe ser un entero de 1 a ${DIAS_VIP_MAX}.`);
    const motivo = cadenaValidada(c.motivo, 'motivo', 200, { requerido: true });
    const ahora = this.ahora();
    const idBitacora = `admin_${uid}_${ahora.getTime()}_${Math.random().toString(36).slice(2, 8)}`;
    const r = await this.db.runTransaction(async (tx) => {
      // Nunca se crea una cuenta nueva por error de uid: users/{uid} debe existir.
      if (!(await tx.get(`users/${uid}`)).exists) throw new NotFoundError('Miembro no encontrado.');
      const otorgado = await otorgarDiasVipEnTx(tx, { uid, dias: c.dias as number, fuente: 'admin', referencia: admin.uid }, ahora, idBitacora);
      tx.set(`${COLECCION_CORTESIAS_ADMIN}/${uid}`, {
        uid, motivo, dias: c.dias, hasta: otorgado.vigenciaHasta, adminUid: admin.uid, adminEmail: admin.email, fecha: ahora.toISOString(), bitacora: idBitacora,
      });
      return otorgado;
    });
    return { uid, cortesiaHasta: r.vigenciaHasta, regaloDesde: r.regaloDesde, dias: r.dias, motivo };
  }

  // ═══ AVISOS (notifications) ═══

  private avisoDesdeDoc(id: string, n: Datos): AvisoAdmin {
    const aviso: AvisoAdmin = {
      id,
      titulo: texto(n.title) || texto(n.text),
      texto: texto(n.msg) || texto(n.body) || texto(n.text),
      fecha: aIso(n.createdAt) ?? isoDeFecha(n.date) ?? '',
      tipo: texto(n.type) || 'info',
      destinatarios: Number(n.recipients) || 0,
    };
    if (texto(n.link)) aviso.enlace = texto(n.link);
    return aviso;
  }

  /** Avisos a miembros. Excluye las alertas internas del admin (type 'member', las crea el club al registrarse alguien). */
  async avisos(): Promise<AvisoAdmin[]> {
    const docs = await this.db.query('notifications');
    return docs
      .filter((d) => d.data()?.type !== 'member')
      .map((d) => this.avisoDesdeDoc(d.id, d.data() ?? {}))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  /** POST /admin/avisos — body { titulo, texto, enlace?, tipo? }. Forma de sendNotification() del panel actual. */
  async publicarAviso(cuerpo: unknown): Promise<AvisoAdmin> {
    const c = mapa(cuerpo);
    const titulo = cadenaValidada(c.titulo, 'titulo', 120, { requerido: true });
    const msg = cadenaValidada(c.texto, 'texto', 1000, { requerido: true });
    let enlace = '';
    if (c.enlace !== undefined && c.enlace !== null) {
      enlace = cadenaValidada(c.enlace, 'enlace', 300);
      if (enlace && !/^#\/[^\s"'<>]*$/.test(enlace) && !/^https:\/\/[^\s"'<>]+$/i.test(enlace)) {
        throw new ValidationError('«enlace» debe ser una ruta del club (#/…) o una URL https.');
      }
    }
    const tipo = c.tipo === undefined ? 'info' : String(c.tipo);
    if (!(TIPOS_AVISO as readonly string[]).includes(tipo)) throw new ValidationError(`«tipo» debe ser uno de: ${TIPOS_AVISO.join(', ')}.`);
    // Destinatarios: miembros con status 'active' en members (mismo conteo que el panel actual).
    const recipients = (await this.db.query('members', { where: [{ campo: 'status', op: '==', valor: 'active' }] })).length;
    const ahora = this.ahora();
    const datos: Datos = {
      type: tipo, title: titulo, msg, recipients, date: ahora.toISOString().split('T')[0], createdAt: ahora.toISOString(),
      ...(enlace ? { link: enlace } : {}),
    };
    for (let intento = 0; intento < 5; intento++) {
      const id = `notif-${ahora.getTime()}${intento ? `-${intento}` : ''}`;
      if (await this.db.create(`notifications/${id}`, { id, ...datos })) return this.avisoDesdeDoc(id, datos);
    }
    throw new ConflictError('No se pudo asignar un id al aviso; inténtalo de nuevo.');
  }

  async borrarAviso(idCrudo: string): Promise<{ ok: true; id: string }> {
    const id = idDeRuta(idCrudo, 'Aviso');
    const doc = await this.db.get(`notifications/${id}`);
    if (!doc.exists || doc.data()?.type === 'member') throw new NotFoundError('Aviso no encontrado.');
    await this.db.delete(`notifications/${id}`);
    return { ok: true, id };
  }

  // ═══ FORO (forum) ═══

  async foro(): Promise<(ReturnType<typeof hiloDesdeForum> & { oculto: boolean; vistas: number })[]> {
    const docs = await this.db.query('forum', { orderBy: { campo: 'createdAt', dir: 'desc' }, limit: 500 });
    return docs.map((d) => {
      const datos = d.data() ?? {};
      return { ...hiloDesdeForum(d.id, datos), oculto: datos.oculto === true, vistas: Number(datos.views) || 0 };
    });
  }

  /** PATCH /admin/foro/:id — body { oculto: boolean }. El club nuevo ya no lista ni abre temas ocultos. */
  async moderarHilo(admin: Usuario, idCrudo: string, cuerpo: unknown) {
    const id = idDeRuta(idCrudo, 'Tema');
    const c = mapa(cuerpo);
    if (typeof c.oculto !== 'boolean') throw new ValidationError('«oculto» debe ser verdadero o falso.');
    const ruta = `forum/${id}`;
    const datos = await this.db.runTransaction(async (tx): Promise<Datos> => {
      const doc = await tx.get(ruta);
      const actual = doc.data();
      if (!doc.exists || !actual) throw new NotFoundError('Tema no encontrado.');
      const cambios = { oculto: c.oculto, moderadoPor: admin.uid, moderadoEn: this.ahora().toISOString() };
      tx.set(ruta, cambios, { merge: true });
      return { ...actual, ...cambios };
    });
    return { ...hiloDesdeForum(id, datos), oculto: datos.oculto === true, vistas: Number(datos.views) || 0 };
  }

  // ═══ CONFIGURACIÓN (config/club, config/platform) ═══

  async config(): Promise<ConfigAdmin> {
    const [club, plataforma] = await Promise.all([this.db.get('config/club'), this.db.get('config/platform')]);
    const c = club.data() ?? {};
    const p = plataforma.data() ?? {};
    return {
      precios: {
        mensual: Number(c.precioMes) > 0 ? Number(c.precioMes) : PRECIO_MES_POR_DEFECTO,
        anual: Number(c.precioAno) > 0 ? Number(c.precioAno) : PRECIO_ANO_POR_DEFECTO,
      },
      descuentoVIP: Number(c.descuentoVIP) > 0 ? Number(c.descuentoVIP) : 0,
      whatsappSoporte: texto(c.whatsappSoporte),
      canalWhatsApp: texto(c.canalWhatsApp),
      // Mismos valores por defecto que el club actual (_platformConfig).
      mantenimiento: p.maintenance === true,
      registroAbierto: p.openRegistration !== false,
      avisoNuevoMiembro: p.notifNewMember !== false,
      actualizadoPor: texto(c.actualizadoPor) || null,
      actualizadoEn: texto(c.actualizadoEn) || null,
    };
  }

  /**
   * PATCH /admin/config — body (todo opcional) { precios:{mensual?, anual?}, descuentoVIP?, whatsappSoporte?,
   * canalWhatsApp?, mantenimiento?, registroAbierto?, avisoNuevoMiembro? }. Merge en config/club y config/platform.
   * OJO: precioMes/precioAno son los que cobra el webhook en los checkouts nuevos (igual que el panel actual).
   */
  async editarConfig(admin: Usuario, cuerpo: unknown): Promise<ConfigAdmin> {
    const c = mapa(cuerpo);
    const club: Datos = {};
    const plataforma: Datos = {};
    const precio = (v: unknown, campo: string) => {
      // Stripe no acepta cargos menores a $10 MXN (mismo límite que el panel actual).
      if (!Number.isInteger(v) || (v as number) < 10 || (v as number) > 100_000) throw new ValidationError(`«${campo}» debe ser un entero de 10 a 100000 (MXN).`);
      return v as number;
    };
    if (c.precios !== undefined) {
      const p = mapa(c.precios);
      if (p.mensual !== undefined) club.precioMes = precio(p.mensual, 'precios.mensual');
      if (p.anual !== undefined) club.precioAno = precio(p.anual, 'precios.anual');
    }
    if (c.descuentoVIP !== undefined) {
      if (typeof c.descuentoVIP !== 'number' || !Number.isFinite(c.descuentoVIP) || c.descuentoVIP < 0 || c.descuentoVIP > 100) {
        throw new ValidationError('«descuentoVIP» debe ser un número de 0 a 100.');
      }
      club.descuentoVIP = c.descuentoVIP;
    }
    if (c.whatsappSoporte !== undefined) {
      const w = cadenaValidada(c.whatsappSoporte, 'whatsappSoporte', 15);
      if (w && !/^\d{10,15}$/.test(w)) throw new ValidationError('«whatsappSoporte» debe tener de 10 a 15 dígitos (con lada).');
      club.whatsappSoporte = w;
    }
    if (c.canalWhatsApp !== undefined) {
      const u = cadenaValidada(c.canalWhatsApp, 'canalWhatsApp', 300);
      if (u && !/^https:\/\/[^\s"'<>]+$/i.test(u)) throw new ValidationError('«canalWhatsApp» debe ser una URL https.');
      club.canalWhatsApp = u;
    }
    const booleano = (v: unknown, campo: string) => {
      if (typeof v !== 'boolean') throw new ValidationError(`«${campo}» debe ser verdadero o falso.`);
      return v;
    };
    if (c.mantenimiento !== undefined) plataforma.maintenance = booleano(c.mantenimiento, 'mantenimiento');
    if (c.registroAbierto !== undefined) plataforma.openRegistration = booleano(c.registroAbierto, 'registroAbierto');
    if (c.avisoNuevoMiembro !== undefined) plataforma.notifNewMember = booleano(c.avisoNuevoMiembro, 'avisoNuevoMiembro');
    if (!Object.keys(club).length && !Object.keys(plataforma).length) throw new ValidationError('No hay cambios válidos que guardar.');

    if (Object.keys(club).length) {
      await this.db.set('config/club', { ...club, actualizadoPor: admin.email || 'admin', actualizadoEn: this.ahora().toISOString() }, { merge: true });
    }
    if (Object.keys(plataforma).length) await this.db.set('config/platform', plataforma, { merge: true });
    return this.config();
  }
}
