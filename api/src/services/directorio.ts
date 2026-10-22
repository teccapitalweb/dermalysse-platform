import { createHash } from 'node:crypto';
import type { FirestorePort } from '../adapters/firestore/port.js';
import type { Usuario } from '../domain/types.js';
import { CodedError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from './errors.js';

export const ETAPAS_DERMALYSSE = [
  'estudiante',
  'cosmetologa',
  'cosmiatra',
  'medico_estetico',
  'duena_cabina',
  'docente',
  'especialista',
  'otro',
] as const;

export const MODALIDADES_DERMALYSSE = ['presencial', 'remoto', 'hibrido'] as const;

export const DISPONIBILIDAD_DERMALYSSE = [
  'empleo',
  'colaboraciones',
  'interconsulta',
  'renta_cabina',
  'renta_aparatologia',
  'mentoria',
  'suplencias',
] as const;

export const TIPOS_OPORTUNIDAD = [
  'empleo',
  'renta_cabina',
  'renta_aparatologia',
  'colaboracion',
  'colaboraciones',
  'interconsulta',
  'mentoria',
] as const;

export const MOTIVOS_REPORTE = ['spam', 'suplantacion', 'contenido_inapropiado', 'datos_falsos', 'otro'] as const;

export const COLECCIONES_DIRECTORIO = {
  perfiles: 'v2_directorio_perfiles',
  oportunidades: 'v2_directorio_oportunidades',
  conexiones: 'v2_directorio_conexiones',
  reportes: 'v2_directorio_reportes',
  /** Contador por usuario: cupos activos y ventanas de rate limit. */
  contadores: 'v2_directorio_contadores',
} as const;

const C = COLECCIONES_DIRECTORIO;
const VENTANA_MS = 86400000;

interface ContadorUsuario {
  oportunidadesActivas?: number;
  conexionesVentana?: string;
  conexionesCuenta?: number;
  reportesVentana?: string;
  reportesCuenta?: number;
}
const PARECE_HTML = /<\s*[a-zA-Z!/?]/;
const CONTROL_Y_SALTOS = /[\x00-\x1F\x7F]/g;
const CONTROL_MULTILINEA = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const LIMITE_CONEXIONES = 100;
const MAX_CONEXIONES_DIA = 10;
const MAX_OPORTUNIDADES_ACTIVAS = 3;
const MAX_REPORTES_DIA = 10;
const REINTENTO_RECHAZADO_MS = 30 * 86400000;

export interface ContactoDirectorio {
  canal: 'whatsapp' | 'correo';
  valor: string;
}

export interface ExperienciaItem {
  puesto: string;
  organizacion: string;
  periodo: string;
  descripcion?: string;
}

export interface FormacionItem {
  programa: string;
  institucion: string;
  periodo: string;
}

export interface CredencialItem {
  nombre: string;
  emisor?: string;
  anio?: string;
}

export interface PerfilDirectorio {
  uid: string;
  nombre: string;
  titular: string;
  etapa: (typeof ETAPAS_DERMALYSSE)[number];
  especialidades: string[];
  aparatologia: string[];
  ciudad: string;
  estado: string;
  modalidades: (typeof MODALIDADES_DERMALYSSE)[number][];
  disponibilidad: (typeof DISPONIBILIDAD_DERMALYSSE)[number][];
  habilidades: string[];
  bio: string;
  foto?: string | null;
  banner?: string | null;
  anosExperiencia?: number | null;
  idiomas: string[];
  experiencia: ExperienciaItem[];
  formacion: FormacionItem[];
  credenciales: CredencialItem[];
  visible: boolean;
  /**
   * Marcado por admins vía moderación. Mientras sea `true`, el servidor
   * fuerza `visible = false` aunque el dueño lo edite: el perfil solo vuelve a
   * ser visible cuando un admin reactive la visibilidad explícitamente.
   */
  ocultoPorModeracion?: boolean;
  contacto: ContactoDirectorio;
  actualizado: string;
}

export interface OportunidadDirectorio {
  id: string;
  autorUid: string;
  autor: string;
  titulo: string;
  tipo: (typeof TIPOS_OPORTUNIDAD)[number];
  organizacion: string;
  modalidad: (typeof MODALIDADES_DERMALYSSE)[number];
  ciudad: string;
  entidad: string;
  especialidades: string[];
  aparatologia: string[];
  resumen: string;
  requisitos: string;
  compensacion: string;
  estado: 'publicada' | 'cerrada';
  fecha: string;
  expira: string;
}

export interface ConexionDirectorio {
  id: string;
  deUid: string;
  paraUid: string;
  oportunidadId?: string | null;
  mensaje: string;
  estado: 'pendiente' | 'aceptada' | 'rechazada';
  creado: string;
  actualizado: string;
}

export interface ReporteDirectorio {
  id: string;
  reportanteUid: string;
  tipo: 'perfil' | 'oportunidad';
  objetivoId: string;
  motivo: (typeof MOTIVOS_REPORTE)[number];
  detalle: string;
  resumenObjetivo: string;
  autorUid: string;
  estado: 'pendiente' | 'revisado' | 'descartado' | 'resuelto';
  resolucion?: string;
  resueltoPor?: string;
  creado: string;
  actualizado: string;
}

function idEstable(...partes: string[]): string {
  return createHash('sha256').update(partes.join('|')).digest('hex').slice(0, 40);
}

function texto(valor: unknown, campo: string, min = 0, max = 500, multilinea = false, requerido = false): string {
  if (valor === undefined || valor === null || valor === '') {
    if (requerido) throw new ValidationError(`El campo "${campo}" es obligatorio.`);
    return '';
  }
  if (typeof valor !== 'string') throw new ValidationError(`El campo "${campo}" debe ser texto.`);
  const limpio = multilinea
    ? valor.replace(/\r\n?/g, '\n').replace(CONTROL_MULTILINEA, '').trim()
    : valor.replace(CONTROL_Y_SALTOS, ' ').trim();
  if (limpio.length === 0) {
    if (requerido) throw new ValidationError(`El campo "${campo}" es obligatorio.`);
    return '';
  }
  if (PARECE_HTML.test(limpio)) throw new ValidationError(`El campo "${campo}" no puede contener HTML.`);
  if (limpio.length < min) throw new ValidationError(`El campo "${campo}" debe tener al menos ${min} caracteres.`);
  if (limpio.length > max) throw new ValidationError(`El campo "${campo}" admite como máximo ${max} caracteres.`);
  return limpio;
}

function listaDeTextos(valor: unknown, campo: string, maxItems = 10, maxLargo = 60): string[] {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) throw new ValidationError(`El campo "${campo}" debe ser una lista.`);
  if (valor.length > maxItems) throw new ValidationError(`El campo "${campo}" admite hasta ${maxItems} elementos.`);
  return valor.map((item, idx) => texto(item, `${campo}[${idx}]`, 1, maxLargo, false, true));
}

function unoDe<T extends string>(valor: unknown, permitidos: readonly T[], campo: string, requerido = true): T {
  if (typeof valor !== 'string' || !permitidos.includes(valor as T)) {
    if (requerido) throw new ValidationError(`El campo "${campo}" debe ser uno de: ${permitidos.join(', ')}.`);
    return permitidos[0];
  }
  return valor as T;
}

// Allowlist estricta de hosts para fotos y banners del directorio: evita que un
// perfil cargue un recurso de un dominio ajeno que podría usarse como pixel de
// rastreo (quien abra el perfil le entrega IP y user-agent al tercero). Solo
// orígenes operados por el proyecto o por Firebase Storage son aceptables.
// Configurable con `DERMALYSSE_IMAGE_HOSTS` (lista separada por comas).
const HOSTS_IMAGENES_PERMITIDOS: readonly string[] = (
  (process.env.DERMALYSSE_IMAGE_HOSTS ?? 'firebasestorage.googleapis.com,storage.googleapis.com,club-dermalysse.firebasestorage.app')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
);

function urlValida(valor: unknown, campo: string): string | null {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string' || valor.length > 2000) {
    throw new ValidationError(`El campo "${campo}" debe ser una URL https válida.`);
  }
  let url: URL;
  try { url = new URL(valor); } catch { throw new ValidationError(`El campo "${campo}" debe ser una URL https válida.`); }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new ValidationError(`El campo "${campo}" debe ser una URL https sin credenciales.`);
  }
  if (!HOSTS_IMAGENES_PERMITIDOS.includes(url.hostname.toLowerCase())) {
    throw new ValidationError(`El campo "${campo}" solo acepta recursos del almacenamiento oficial de Dermalysse.`);
  }
  return url.toString();
}

export class DirectorioService {
  constructor(private readonly db: FirestorePort, private readonly ahora: () => Date) {}

  private resolverNombre(usuario: Usuario): string {
    const candidato = [usuario.nombre, usuario.cuenta?.nombre].find((v) => typeof v === 'string' && v.trim());
    if (candidato) return candidato.trim().slice(0, 80);
    // Nunca usar `email.split('@')[0]`: expone la parte local del correo en
    // vistas públicas del directorio. Si no hay nombre explícito, se muestra
    // un alias genérico y el perfil puede editarse para añadir uno real.
    return 'Miembro Dermalysse';
  }

  async obtenerDirectorio(usuario: Usuario, limite = 24, perfilesAntes?: string, oportunidadesAntes?: string) {
    const uid = usuario.uid;
    const ahoraIso = this.ahora().toISOString();

    const [todosPerfiles, todasOportunidades, miPerfilDoc, conexionesDe, conexionesPara] = await Promise.all([
      this.db.query(C.perfiles, { where: [{ campo: 'visible', op: '==', valor: true }], orderBy: { campo: 'actualizado', dir: 'desc' }, limit: 200 }),
      this.db.query(C.oportunidades, { where: [{ campo: 'estado', op: '==', valor: 'publicada' }], orderBy: { campo: 'fecha', dir: 'desc' }, limit: 200 }),
      this.db.get(`${C.perfiles}/${uid}`),
      this.db.query(C.conexiones, { where: [{ campo: 'deUid', op: '==', valor: uid }], limit: LIMITE_CONEXIONES }),
      this.db.query(C.conexiones, { where: [{ campo: 'paraUid', op: '==', valor: uid }], limit: LIMITE_CONEXIONES }),
    ]);

    const misOportunidades = await this.db.query(C.oportunidades, { where: [{ campo: 'autorUid', op: '==', valor: uid }], limit: 20 });

    // Paginación perfiles
    let perfilesDocs = todosPerfiles;
    if (perfilesAntes) {
      const idx = perfilesDocs.findIndex((d) => d.id === perfilesAntes);
      perfilesDocs = idx >= 0 ? perfilesDocs.slice(idx + 1) : perfilesDocs;
    }
    const paginaPerfiles = perfilesDocs.slice(0, limite);

    // Si el usuario tiene perfil propio, asegurarse de incluirlo en la vista si no hay cursor
    const miPerfilData = miPerfilDoc.exists ? (miPerfilDoc.data() as unknown as PerfilDirectorio) : null;
    const mapaPerfiles = new Map<string, PerfilDirectorio>();
    if (!perfilesAntes && miPerfilData) mapaPerfiles.set(uid, miPerfilData);
    for (const d of paginaPerfiles) {
      mapaPerfiles.set(d.id, { ...(d.data() as unknown as PerfilDirectorio), uid: d.id });
    }

    const perfiles = [...mapaPerfiles.values()].map((p) => this.filtrarPerfilPublico(p, uid));

    // Paginación oportunidades
    let opsDocs = todasOportunidades;
    if (oportunidadesAntes) {
      const idx = opsDocs.findIndex((d) => d.id === oportunidadesAntes);
      opsDocs = idx >= 0 ? opsDocs.slice(idx + 1) : opsDocs;
    }
    const paginaOps = opsDocs.slice(0, limite);
    const mapaOps = new Map<string, OportunidadDirectorio>();
    for (const d of paginaOps) {
      const data = d.data() as unknown as OportunidadDirectorio;
      if (!data.expira || data.expira >= ahoraIso) {
        mapaOps.set(d.id, { ...data, id: d.id });
      }
    }
    for (const d of misOportunidades) {
      mapaOps.set(d.id, { ...(d.data() as unknown as OportunidadDirectorio), id: d.id });
    }
    const oportunidades = [...mapaOps.values()]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map((o) => this.filtrarOportunidadPublica(o, uid));

    // Conexiones
    const unicasConexiones = new Map<string, ConexionDirectorio>();
    for (const d of [...conexionesDe, ...conexionesPara]) {
      unicasConexiones.set(d.id, { ...(d.data() as unknown as ConexionDirectorio), id: d.id });
    }
    const conexionesLista = [...unicasConexiones.values()].sort((a, b) => b.creado.localeCompare(a.creado));

    // Nombres y contactos de contrapartes
    const uidsContrapartes = [...new Set(conexionesLista.map((c) => (c.deUid === uid ? c.paraUid : c.deUid)))];
    const perfilesContrapartes = await Promise.all(uidsContrapartes.map((id) => this.db.get(`${C.perfiles}/${id}`)));
    const mapaContrapartes = new Map<string, PerfilDirectorio | null>();
    uidsContrapartes.forEach((id, i) => {
      const snap = perfilesContrapartes[i];
      mapaContrapartes.set(id, snap.exists ? (snap.data() as unknown as PerfilDirectorio) : null);
    });

    const conexiones = conexionesLista.map((c) => {
      const otraUid = c.deUid === uid ? c.paraUid : c.deUid;
      const otra = mapaContrapartes.get(otraUid);
      return {
        id: c.id,
        deUid: c.deUid,
        paraUid: c.paraUid,
        oportunidadId: c.oportunidadId ?? null,
        mensaje: c.mensaje,
        estado: c.estado,
        creado: c.creado,
        actualizado: c.actualizado,
        esEntrante: c.paraUid === uid,
        otraPersona: otra?.nombre ?? 'Miembro Dermalysse',
        contacto: c.estado === 'aceptada' && otra?.contacto ? otra.contacto : null,
      };
    });

    return {
      perfiles,
      oportunidades,
      conexiones,
      miPerfil: miPerfilData ? { ...this.filtrarPerfilPublico(miPerfilData, uid), visible: miPerfilData.visible, contacto: miPerfilData.contacto } : null,
      paginacion: {
        perfiles: {
          hayMas: perfilesDocs.length > limite,
          siguiente: perfilesDocs.length > limite ? paginaPerfiles.at(-1)?.id ?? null : null,
        },
        oportunidades: {
          hayMas: opsDocs.length > limite,
          siguiente: opsDocs.length > limite ? paginaOps.at(-1)?.id ?? null : null,
        },
      },
    };
  }

  async guardarPerfil(usuario: Usuario, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const uid = usuario.uid;
    const previoDoc = await this.db.get(`${C.perfiles}/${uid}`);
    const previo = previoDoc.exists ? (previoDoc.data() as unknown as PerfilDirectorio) : null;
    const nombre = this.resolverNombre(usuario);

    const titular = texto(body.titular, 'titular', 4, 100, false, true);
    const etapa = unoDe(body.etapa, ETAPAS_DERMALYSSE, 'etapa', true);
    const especialidades = listaDeTextos(body.especialidades, 'especialidades', 6, 60);
    const aparatologia = listaDeTextos(body.aparatologia, 'aparatologia', 10, 60);
    const ciudad = texto(body.ciudad, 'ciudad', 0, 80, false, false);
    const estado = texto(body.estado, 'estado', 0, 80, false, false);
    const bio = texto(body.bio, 'bio', 30, 600, true, true);

    const modalidadesRaw = Array.isArray(body.modalidades) ? body.modalidades : ['presencial'];
    const modalidades = modalidadesRaw.map((m) => unoDe(m, MODALIDADES_DERMALYSSE, 'modalidades', true));

    const dispRaw = Array.isArray(body.disponibilidad) ? body.disponibilidad : ['colaboraciones'];
    const disponibilidad = dispRaw.map((d) => unoDe(d, DISPONIBILIDAD_DERMALYSSE, 'disponibilidad', true));

    const habilidades = listaDeTextos(body.habilidades, 'habilidades', 10, 60);
    const idiomas = listaDeTextos(body.idiomas, 'idiomas', 6, 40);

    const anosExperiencia =
      body.anosExperiencia === null || body.anosExperiencia === undefined
        ? null
        : typeof body.anosExperiencia === 'number' && Number.isInteger(body.anosExperiencia) && body.anosExperiencia >= 0 && body.anosExperiencia <= 70
          ? body.anosExperiencia
          : (() => {
              throw new ValidationError('El campo "anosExperiencia" debe ser un entero entre 0 y 70 o null.');
            })();

    const experiencia = this.validarExperiencia(body.experiencia ?? previo?.experiencia ?? []);
    const formacion = this.validarFormacion(body.formacion ?? previo?.formacion ?? []);
    const credenciales = this.validarCredenciales(body.credenciales ?? previo?.credenciales ?? []);

    // Un perfil ocultado por moderación no puede re-publicarse desde el cliente.
    // El flag persiste hasta que un admin reactive la visibilidad vía panel.
    const ocultoPorModeracion = previo?.ocultoPorModeracion === true;
    const visible = ocultoPorModeracion
      ? false
      : (typeof body.visible === 'boolean' ? body.visible : (previo?.visible ?? true));

    const contactoBody = (body.contacto as Record<string, unknown> | undefined) ?? {};
    const contactoCanal = unoDe(contactoBody.canal ?? previo?.contacto?.canal ?? 'correo', ['correo', 'whatsapp'] as const, 'contacto.canal', true);
    const contactoValor =
      contactoCanal === 'correo'
        ? String(usuario.email || '').trim().toLowerCase()
        : texto(contactoBody.valor ?? previo?.contacto?.valor, 'contacto.valor', 5, 30, false, true);

    const foto = body.foto === null ? null : urlValida(body.foto ?? previo?.foto, 'foto');
    const banner = body.banner === null ? null : urlValida(body.banner ?? previo?.banner, 'banner');
    const ahoraIso = this.ahora().toISOString();

    const perfil: PerfilDirectorio = {
      uid,
      nombre,
      titular,
      etapa,
      especialidades,
      aparatologia,
      ciudad,
      estado,
      modalidades,
      disponibilidad,
      habilidades,
      bio,
      foto,
      banner,
      anosExperiencia,
      idiomas,
      experiencia,
      formacion,
      credenciales,
      visible,
      ocultoPorModeracion,
      contacto: { canal: contactoCanal, valor: contactoValor },
      actualizado: ahoraIso,
    };

    await this.db.set(`${C.perfiles}/${uid}`, perfil as unknown as Record<string, unknown>);
    return { ...this.filtrarPerfilPublico(perfil, uid), visible: perfil.visible, contacto: perfil.contacto };
  }

  async eliminarPerfil(usuario: Usuario): Promise<{ ok: true }> {
    const uid = usuario.uid;
    const ref = `${C.perfiles}/${uid}`;
    const snap = await this.db.get(ref);
    if (!snap.exists) throw new NotFoundError('No tienes un perfil en el directorio.');

    const [oportunidades, conexionesSalientes, conexionesEntrantes] = await Promise.all([
      this.db.query(C.oportunidades, { where: [{ campo: 'autorUid', op: '==', valor: uid }] }),
      this.db.query(C.conexiones, { where: [{ campo: 'deUid', op: '==', valor: uid }] }),
      this.db.query(C.conexiones, { where: [{ campo: 'paraUid', op: '==', valor: uid }] }),
    ]);

    const ahoraIso = this.ahora().toISOString();
    const teniaPublicadas = oportunidades.some((d) => (d.data() as unknown as OportunidadDirectorio).estado === 'publicada');
    await Promise.all([
      ...oportunidades
        .filter((d) => (d.data() as unknown as OportunidadDirectorio).estado === 'publicada')
        .map((d) => this.db.set(`${C.oportunidades}/${d.id}`, { estado: 'cerrada', actualizado: ahoraIso }, { merge: true })),
      ...[...conexionesSalientes, ...conexionesEntrantes]
        .filter((d) => (d.data() as unknown as ConexionDirectorio).estado === 'pendiente')
        .map((d) => this.db.set(`${C.conexiones}/${d.id}`, { estado: 'rechazada', actualizado: ahoraIso }, { merge: true })),
      this.db.delete(ref),
    ]);
    // Al eliminar el perfil cerramos sus oportunidades publicadas; el contador
    // vuelve a cero para no bloquear futuras publicaciones si el usuario crea
    // perfil otra vez.
    if (teniaPublicadas) {
      await this.db.set(`${C.contadores}/${uid}`, { oportunidadesActivas: 0 }, { merge: true });
    }

    return { ok: true };
  }

  async crearOportunidad(usuario: Usuario, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!usuario.esVip && !usuario.esAdmin) {
      throw new ForbiddenError('Publicar oportunidades es un beneficio VIP. Puedes explorar y conectar gratis.');
    }

    const titulo = texto(body.titulo, 'titulo', 8, 120, false, true);
    const tipo = unoDe(body.tipo, TIPOS_OPORTUNIDAD, 'tipo', true);
    const organizacion = texto(body.organizacion, 'organizacion', 2, 120, false, true);
    const modalidad = unoDe(body.modalidad, MODALIDADES_DERMALYSSE, 'modalidad', true);
    const ciudad = texto(body.ciudad, 'ciudad', 0, 80, false, false);
    const entidad = texto(body.entidad, 'entidad', 0, 80, false, false);
    const especialidades = listaDeTextos(body.especialidades, 'especialidades', 6, 60);
    const aparatologia = listaDeTextos(body.aparatologia, 'aparatologia', 10, 60);
    const resumen = texto(body.resumen, 'resumen', 40, 1000, true, true);
    const requisitos = texto(body.requisitos, 'requisitos', 0, 1000, true, false);
    const compensacion = texto(body.compensacion, 'compensacion', 0, 180, false, false);

    const ahora = this.ahora();
    const expira = new Date(ahora.getTime() + 45 * 86400000).toISOString();
    const id = idEstable(usuario.uid, titulo, ahora.toISOString());

    const oportunidad: OportunidadDirectorio = {
      id,
      autorUid: usuario.uid,
      autor: this.resolverNombre(usuario),
      titulo,
      tipo,
      organizacion,
      modalidad,
      ciudad,
      entidad,
      especialidades,
      aparatologia,
      resumen,
      requisitos,
      compensacion,
      estado: 'publicada',
      fecha: ahora.toISOString(),
      expira,
    };

    // Contador atómico leído y escrito dentro de la transacción: dos peticiones
    // concurrentes del mismo usuario entran en conflicto y reintentan, en vez
    // de hacer un `query` fuera de la tx (TOCTOU) que permitiría superar el
    // tope `MAX_OPORTUNIDADES_ACTIVAS`.
    const contadorRef = `${C.contadores}/${usuario.uid}`;
    await this.db.runTransaction(async (tx) => {
      const contadorSnap = await tx.get(contadorRef);
      const contador = (contadorSnap.exists ? (contadorSnap.data() as ContadorUsuario) : {}) ?? {};
      const activas = Number(contador.oportunidadesActivas) || 0;
      if (activas >= MAX_OPORTUNIDADES_ACTIVAS) {
        throw new ConflictError(`Puedes mantener hasta ${MAX_OPORTUNIDADES_ACTIVAS} oportunidades activas. Cierra una antes de publicar otra.`);
      }
      tx.set(`${C.oportunidades}/${id}`, oportunidad as unknown as Record<string, unknown>);
      tx.set(contadorRef, { ...contador, oportunidadesActivas: activas + 1 } as unknown as Record<string, unknown>, { merge: true });
    });

    return this.filtrarOportunidadPublica(oportunidad, usuario.uid);
  }

  async cerrarOportunidad(usuario: Usuario, id: string): Promise<Record<string, unknown>> {
    const ruta = `${C.oportunidades}/${id}`;
    const snap = await this.db.get(ruta);
    if (!snap.exists) throw new NotFoundError('No encontramos la oportunidad.');
    const actual = snap.data() as unknown as OportunidadDirectorio;
    if (actual.autorUid !== usuario.uid && !usuario.esAdmin) throw new ForbiddenError('No tienes permiso para modificar esta oportunidad.');

    const actualizado = this.ahora().toISOString();
    // Transacción: baja el contador del autor solo si la oportunidad estaba
    // publicada; evita que un doble-cierre descuente dos veces.
    await this.db.runTransaction(async (tx) => {
      const act = await tx.get(ruta);
      if (!act.exists) return;
      const data = act.data() as unknown as OportunidadDirectorio;
      let contadorRef: string | null = null;
      let contador: ContadorUsuario = {};
      if (data.estado === 'publicada') {
        contadorRef = `${C.contadores}/${data.autorUid}`;
        const contadorSnap = await tx.get(contadorRef);
        contador = (contadorSnap.exists ? (contadorSnap.data() as ContadorUsuario) : {}) ?? {};
      }
      tx.set(ruta, { estado: 'cerrada', actualizado }, { merge: true });
      if (contadorRef) {
        const activas = Math.max(0, (Number(contador.oportunidadesActivas) || 0) - 1);
        tx.set(contadorRef, { ...contador, oportunidadesActivas: activas } as unknown as Record<string, unknown>, { merge: true });
      }
    });
    return this.filtrarOportunidadPublica({ ...actual, estado: 'cerrada' }, usuario.uid);
  }

  async crearConexion(usuario: Usuario, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    let paraUid = typeof body.paraUid === 'string' ? body.paraUid.trim() : null;
    const oportunidadId = typeof body.oportunidadId === 'string' ? body.oportunidadId.trim() : null;

    if (oportunidadId) {
      const opSnap = await this.db.get(`${C.oportunidades}/${oportunidadId}`);
      if (!opSnap.exists) throw new NotFoundError('La oportunidad ya no está disponible.');
      const op = opSnap.data() as unknown as OportunidadDirectorio;
      if (op.estado !== 'publicada' || (op.expira && op.expira < this.ahora().toISOString())) {
        throw new NotFoundError('La oportunidad ya no está disponible.');
      }
      paraUid = op.autorUid;
    }

    if (!paraUid) throw new NotFoundError('Selecciona una profesional u oportunidad.');
    if (paraUid === usuario.uid) throw new ConflictError('No puedes enviarte una solicitud a ti misma.');

    const destinoSnap = await this.db.get(`${C.perfiles}/${paraUid}`);
    if (!destinoSnap.exists) throw new NotFoundError('Ese perfil ya no está disponible.');
    const destino = destinoSnap.data() as unknown as PerfilDirectorio;
    if (destino.visible !== true) throw new NotFoundError('Ese perfil ya no está disponible.');

    const mensaje = texto(body.mensaje, 'mensaje', 20, 500, true, true);
    const connId = idEstable(usuario.uid, paraUid, oportunidadId ?? 'perfil');
    const ahoraIso = this.ahora().toISOString();

    const conexion: ConexionDirectorio = {
      id: connId,
      deUid: usuario.uid,
      paraUid,
      oportunidadId,
      mensaje,
      estado: 'pendiente',
      creado: ahoraIso,
      actualizado: ahoraIso,
    };

    // Rate limit por contador atómico: lectura y escritura dentro de la tx. Dos
    // peticiones concurrentes del mismo uid chocan y reintentan, en vez de que
    // ambas pasen el `query` externo (TOCTOU) y superen MAX_CONEXIONES_DIA.
    const contadorRef = `${C.contadores}/${usuario.uid}`;
    await this.db.runTransaction(async (tx) => {
      const existente = await tx.get(`${C.conexiones}/${connId}`);
      const contadorSnap = await tx.get(contadorRef);
      const contador = (contadorSnap.exists ? (contadorSnap.data() as ContadorUsuario) : {}) ?? {};
      const ahoraMs = this.ahora().getTime();
      const ventanaMs = contador.conexionesVentana ? Date.parse(contador.conexionesVentana) : 0;
      const dentroVentana = Number.isFinite(ventanaMs) && ventanaMs > 0 && (ahoraMs - ventanaMs) < VENTANA_MS;
      const cuenta = dentroVentana ? (Number(contador.conexionesCuenta) || 0) : 0;
      if (cuenta >= MAX_CONEXIONES_DIA) {
        throw new CodedError(429, 'limite_alcanzado', `Puedes enviar hasta ${MAX_CONEXIONES_DIA} solicitudes de conexión cada 24 horas.`);
      }
      if (existente.exists) {
        const actual = existente.data() as unknown as ConexionDirectorio;
        if (['pendiente', 'aceptada'].includes(actual.estado)) {
          throw new ConflictError('Ya existe una solicitud activa con esta colega.');
        }
        const reintentoEn = new Date(actual.actualizado ?? actual.creado ?? 0).getTime() + REINTENTO_RECHAZADO_MS;
        if (reintentoEn > ahoraMs) {
          throw new CodedError(409, 'reintento_bloqueado', 'Esta solicitud fue declinada recientemente. Respeta la decisión antes de volver a intentarlo.');
        }
      }
      tx.set(`${C.conexiones}/${connId}`, conexion as unknown as Record<string, unknown>);
      tx.set(contadorRef, {
        ...contador,
        conexionesVentana: dentroVentana ? contador.conexionesVentana : new Date(ahoraMs).toISOString(),
        conexionesCuenta: cuenta + 1,
      } as unknown as Record<string, unknown>, { merge: true });
    });

    return {
      ...conexion,
      esEntrante: false,
      otraPersona: destino.nombre,
      contacto: null,
    };
  }

  async responderConexion(usuario: Usuario, id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const ruta = `${C.conexiones}/${id}`;
    const snap = await this.db.get(ruta);
    if (!snap.exists) throw new NotFoundError('No encontramos la solicitud.');
    const actual = snap.data() as unknown as ConexionDirectorio;
    if (actual.paraUid !== usuario.uid) throw new ForbiddenError('Solo quien recibe puede responder esta solicitud.');
    if (actual.estado !== 'pendiente') throw new ConflictError('Esta solicitud ya fue respondida.');

    const estado = unoDe(body.estado, ['aceptada', 'rechazada'] as const, 'estado', true);
    const actualizado = this.ahora().toISOString();
    await this.db.set(ruta, { estado, actualizado }, { merge: true });

    const otraSnap = await this.db.get(`${C.perfiles}/${actual.deUid}`);
    const otra = otraSnap.exists ? (otraSnap.data() as unknown as PerfilDirectorio) : null;

    return {
      ...actual,
      estado,
      actualizado,
      esEntrante: true,
      otraPersona: otra?.nombre ?? 'Miembro Dermalysse',
      contacto: estado === 'aceptada' ? otra?.contacto ?? null : null,
    };
  }

  async crearReporte(usuario: Usuario, body: Record<string, unknown>): Promise<{ id: string; estado: 'pendiente' }> {
    const tipo = unoDe(body.tipo, ['perfil', 'oportunidad'] as const, 'tipo', true);
    const objetivoId = texto(body.objetivoId, 'objetivoId', 1, 200, false, true);
    const motivo = unoDe(body.motivo, MOTIVOS_REPORTE, 'motivo', true);
    const detalle = texto(body.detalle, 'detalle', 0, 500, true, false);

    const coleccion = tipo === 'perfil' ? C.perfiles : C.oportunidades;
    const objetivoSnap = await this.db.get(`${coleccion}/${objetivoId}`);
    if (!objetivoSnap.exists) throw new NotFoundError('Ese contenido ya no está disponible.');
    const objData = objetivoSnap.data() as Record<string, unknown>;

    if (tipo === 'perfil' && objData.visible !== true) throw new NotFoundError('Ese contenido ya no está disponible.');
    if (tipo === 'oportunidad' && objData.estado !== 'publicada') throw new NotFoundError('Ese contenido ya no está disponible.');

    const autorUid = tipo === 'perfil' ? objetivoId : (objData.autorUid as string);
    if (autorUid === usuario.uid) throw new ConflictError('No puedes denunciar tu propio contenido.');

    const repId = idEstable(usuario.uid, tipo, objetivoId);
    const ahoraIso = this.ahora().toISOString();

    const reporte: ReporteDirectorio = {
      id: repId,
      reportanteUid: usuario.uid,
      tipo,
      objetivoId,
      motivo,
      detalle,
      resumenObjetivo: (tipo === 'perfil' ? (objData.nombre as string) : (objData.titulo as string)) ?? 'Contenido reportado',
      autorUid,
      estado: 'pendiente',
      creado: ahoraIso,
      actualizado: ahoraIso,
    };

    const contadorRef = `${C.contadores}/${usuario.uid}`;
    await this.db.runTransaction(async (tx) => {
      const existente = await tx.get(`${C.reportes}/${repId}`);
      const contadorSnap = await tx.get(contadorRef);
      if (existente.exists) throw new ConflictError('Ya enviaste una denuncia sobre este contenido.');

      const contador = (contadorSnap.exists ? (contadorSnap.data() as ContadorUsuario) : {}) ?? {};
      const ahoraMs = this.ahora().getTime();
      const ventanaMs = contador.reportesVentana ? Date.parse(contador.reportesVentana) : 0;
      const dentroVentana = Number.isFinite(ventanaMs) && ventanaMs > 0 && (ahoraMs - ventanaMs) < VENTANA_MS;
      const cuenta = dentroVentana ? (Number(contador.reportesCuenta) || 0) : 0;
      if (cuenta >= MAX_REPORTES_DIA) {
        throw new CodedError(429, 'limite_alcanzado', `Puedes enviar hasta ${MAX_REPORTES_DIA} denuncias cada 24 horas.`);
      }
      tx.set(`${C.reportes}/${repId}`, reporte as unknown as Record<string, unknown>);
      tx.set(contadorRef, {
        ...contador,
        reportesVentana: dentroVentana ? contador.reportesVentana : new Date(ahoraMs).toISOString(),
        reportesCuenta: cuenta + 1,
      } as unknown as Record<string, unknown>, { merge: true });
    });

    return { id: repId, estado: 'pendiente' };
  }

  async listarReportesAdmin(): Promise<ReporteDirectorio[]> {
    const docs = await this.db.query(C.reportes);
    const lista = docs.map((d) => d.data() as unknown as ReporteDirectorio);
    lista.sort((a, b) => String(b.creado || '').localeCompare(String(a.creado || '')));
    return lista;
  }

  async moderarReporteAdmin(usuario: Usuario, id: string, body: Record<string, unknown>): Promise<ReporteDirectorio> {
    const accion = unoDe(body.accion, ['descartar', 'ocultar_perfil', 'cerrar_oportunidad'] as const, 'accion', true);
    const repSnap = await this.db.get(`${C.reportes}/${id}`);
    if (!repSnap.exists) throw new NotFoundError('Ese reporte no existe.');
    const reporte = repSnap.data() as unknown as ReporteDirectorio;

    const ahoraIso = this.ahora().toISOString();
    let nuevoEstado: ReporteDirectorio['estado'] = 'descartado';
    let resolucion = 'descartado';

    if (accion === 'ocultar_perfil') {
      const pSnap = await this.db.get(`${C.perfiles}/${reporte.objetivoId}`);
      if (pSnap.exists) {
        // Marca el flag de moderación: aunque el dueño vuelva a editar el
        // perfil con visible=true, guardarPerfil lo fuerza a false mientras
        // este flag siga activo.
        await this.db.set(`${C.perfiles}/${reporte.objetivoId}`, { visible: false, ocultoPorModeracion: true, actualizado: ahoraIso }, { merge: true });
      }
      nuevoEstado = 'resuelto';
      resolucion = 'perfil_ocultado';
    } else if (accion === 'cerrar_oportunidad') {
      const oSnap = await this.db.get(`${C.oportunidades}/${reporte.objetivoId}`);
      if (oSnap.exists) {
        await this.db.set(`${C.oportunidades}/${reporte.objetivoId}`, { estado: 'cerrada', actualizado: ahoraIso }, { merge: true });
      }
      nuevoEstado = 'resuelto';
      resolucion = 'oportunidad_cerrada';
    }

    const actualizado: ReporteDirectorio = {
      ...reporte,
      estado: nuevoEstado,
      resolucion,
      resueltoPor: usuario.email || usuario.uid,
      actualizado: ahoraIso,
    };

    await this.db.set(`${C.reportes}/${id}`, actualizado as unknown as Record<string, unknown>);
    return actualizado;
  }

  async listarPerfilesAdmin(): Promise<Record<string, unknown>[]> {
    const docs = await this.db.query(C.perfiles);
    const lista = docs.map((d) => d.data() as unknown as PerfilDirectorio);
    lista.sort((a, b) => String(b.actualizado || '').localeCompare(String(a.actualizado || '')));
    return lista.map((p) => ({
      uid: p.uid,
      nombre: p.nombre,
      titular: p.titular,
      etapa: p.etapa,
      especialidades: p.especialidades ?? [],
      aparatologia: p.aparatologia ?? [],
      ciudad: p.ciudad ?? '',
      estado: p.estado ?? '',
      visible: p.visible === true,
      actualizado: p.actualizado,
    }));
  }

  async actualizarVisibilidadPerfilAdmin(uid: string, visible: boolean): Promise<{ uid: string; visible: boolean; actualizado: string }> {
    const pSnap = await this.db.get(`${C.perfiles}/${uid}`);
    if (!pSnap.exists) throw new NotFoundError('Ese perfil no existe.');
    const ahoraIso = this.ahora().toISOString();
    // Al reactivar visibilidad desde el panel admin, también se levanta el
    // flag de moderación. Ocultar desde admin lo deja marcado para que el
    // dueño no pueda re-publicarlo con una edición propia.
    await this.db.set(`${C.perfiles}/${uid}`, { visible, ocultoPorModeracion: !visible, actualizado: ahoraIso }, { merge: true });
    return { uid, visible, actualizado: ahoraIso };
  }

  private filtrarPerfilPublico(p: PerfilDirectorio, miUid: string): Record<string, unknown> {
    return {
      uid: p.uid,
      nombre: p.nombre,
      titular: p.titular,
      etapa: p.etapa,
      especialidades: p.especialidades ?? [],
      aparatologia: p.aparatologia ?? [],
      ciudad: p.ciudad ?? '',
      estado: p.estado ?? '',
      modalidades: p.modalidades ?? [],
      disponibilidad: p.disponibilidad ?? [],
      habilidades: p.habilidades ?? [],
      bio: p.bio ?? '',
      foto: p.foto ?? null,
      banner: p.banner ?? null,
      anosExperiencia: p.anosExperiencia ?? null,
      idiomas: p.idiomas ?? [],
      experiencia: p.experiencia ?? [],
      formacion: p.formacion ?? [],
      credenciales: p.credenciales ?? [],
      actualizado: p.actualizado,
      esMio: p.uid === miUid,
    };
  }

  private filtrarOportunidadPublica(o: OportunidadDirectorio, miUid: string): Record<string, unknown> {
    return {
      id: o.id,
      autorUid: o.autorUid,
      autor: o.autor,
      titulo: o.titulo,
      tipo: o.tipo,
      organizacion: o.organizacion,
      modalidad: o.modalidad,
      ciudad: o.ciudad ?? '',
      entidad: o.entidad ?? '',
      especialidades: o.especialidades ?? [],
      aparatologia: o.aparatologia ?? [],
      resumen: o.resumen,
      requisitos: o.requisitos ?? '',
      compensacion: o.compensacion ?? '',
      estado: o.estado,
      fecha: o.fecha,
      expira: o.expira,
      esMia: o.autorUid === miUid,
    };
  }

  private validarExperiencia(items: unknown): ExperienciaItem[] {
    if (!Array.isArray(items)) return [];
    return items.slice(0, 8).map((it, idx) => {
      const obj = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
      return {
        puesto: texto(obj.puesto, `experiencia[${idx}].puesto`, 1, 100, false, true),
        organizacion: texto(obj.organizacion, `experiencia[${idx}].organizacion`, 1, 120, false, true),
        periodo: texto(obj.periodo, `experiencia[${idx}].periodo`, 1, 60, false, true),
        descripcion: texto(obj.descripcion, `experiencia[${idx}].descripcion`, 0, 500, true, false),
      };
    });
  }

  private validarFormacion(items: unknown): FormacionItem[] {
    if (!Array.isArray(items)) return [];
    return items.slice(0, 8).map((it, idx) => {
      const obj = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
      return {
        programa: texto(obj.programa, `formacion[${idx}].programa`, 1, 120, false, true),
        institucion: texto(obj.institucion, `formacion[${idx}].institucion`, 1, 120, false, true),
        periodo: texto(obj.periodo, `formacion[${idx}].periodo`, 1, 60, false, true),
      };
    });
  }

  private validarCredenciales(items: unknown): CredencialItem[] {
    if (!Array.isArray(items)) return [];
    return items.slice(0, 12).map((it, idx) => {
      const obj = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
      return {
        nombre: texto(obj.nombre, `credenciales[${idx}].nombre`, 1, 120, false, true),
        emisor: texto(obj.emisor, `credenciales[${idx}].emisor`, 0, 120, false, false),
        anio: texto(obj.anio, `credenciales[${idx}].anio`, 0, 20, false, false),
      };
    });
  }
}
