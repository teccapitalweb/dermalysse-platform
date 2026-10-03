import { api } from '../core/auth';
import { Datos, type Aviso, type Config, type Curso, type Evento, type Material, type MiembroDemo, type Quiz } from '../core/datos';

export interface ResumenAdmin {
  miembrosActivos: number;
  altas30d: number;
  bajas30d: number;
  clasesVistas30d: number;
  certificados30d: number;
  temasForo30d: number;
  cursosTop: { cursoId: string; titulo: string; vistas: number }[];
}

export interface MiembroDetalle {
  uid: string; nombre: string; email: string; esVip: boolean; esAdmin: boolean;
  plan: string | null; vence: string | null; cortesiaHasta: string | null;
  cuponHasta?: string | null;
  accesoCupon?: { hasta?: string; ultimoCodigo?: string } | null;
  cortesia?: { motivo?: string; hasta?: string } | null;
  suscripcion?: { estado?: string; plan?: string; periodoFin?: string; customerId?: string } | null;
  miembro?: { activa?: boolean | null; activo?: boolean | null; estado?: string | null; cancelado?: boolean | null; plan?: string | null; tipoPlan?: string | null; expira?: string | null; whatsapp?: string | null } | null;
  progreso?: { cursoId: string; titulo: string; vistas: number[]; total: number; actualizado?: string | null; certificado?: string | null }[];
  certificados?: { folio: string; cursoTitulo: string; emitido: string }[];
}

export interface HiloAdmin {
  id: string; titulo: string; texto: string; autor: string; fecha: string; cursoId?: string | null;
  util?: number; respuestas?: number | unknown[]; oculto?: boolean;
}

export interface CuponAdmin { codigo: string; loteId: string; duracion: string; dias: number | null; maxUsos: number; usos: number; activo: boolean; creadoEn: string }
export interface LoteCupones { id: string; modalidad: 'compartido' | 'individuales'; cantidad: number; duracion: string; dias: number | null; codigos: string[]; creadoEn: string }

type Clave = 'resumen' | 'cursos' | 'materiales' | 'eventos' | 'quizzes' | 'miembros' | 'foro' | 'avisos' | 'config' | 'cupones';
const cargadas = new Set<Clave>();
const pendientes = new Map<Clave, Promise<void>>();
let resumen: ResumenAdmin | null = null;
let foro: HiloAdmin[] = [];
let cupones: CuponAdmin[] = [];
const detalles = new Map<string, MiembroDetalle>();

const planMiembro = (m: any): MiembroDemo['plan'] => {
  if (m.cortesiaHasta) return 'cortesia';
  if (m.plan === 'cupon') return 'cupon';
  if (m.plan === 'mensual' || m.plan === 'anual') return m.plan;
  return 'ninguno';
};

const adaptarCurso = (c: any): Curso => ({
  ...c,
  portada: c.portada || '/media/hero-background.png',
  aprenderas: Array.isArray(c.aprenderas) ? c.aprenderas : [],
  clases: (Array.isArray(c.clases) ? c.clases : []).map((k: any) => ({ ...k, duracion: k.duracionMin ?? k.duracion ?? null })),
});

const adaptarMaterial = (m: any): Material => ({ ...m, portada: m.portada || '/media/hidrafacial.png', url: m.archivo || '' });
const adaptarEvento = (e: any): Evento => ({ ...e, reservas: Array.isArray(e.reservas) ? e.reservas.length : Number(e.reservas) || 0 });
const adaptarMiembro = (m: any): MiembroDemo => ({
  uid: m.uid, nombre: m.nombre || 'Sin nombre', email: m.email || '', plan: planMiembro(m),
  vence: m.vence || m.cortesiaHasta || null, alta: m.alta || '', clasesVistas: Number(m.clasesVistas) || 0,
  ultimaActividad: m.ultimaActividad || '', cortesiaHasta: m.cortesiaHasta || null,
  cuponHasta: m.cuponHasta || null,
  cortesiaMotivo: m.cortesiaMotivo || '', esVip: m.esVip === true, esAdmin: m.esAdmin === true,
});

async function una(clave: Clave, tarea: () => Promise<void>, forzar = false) {
  if (Datos.modo !== 'api') return;
  if (!forzar && cargadas.has(clave)) return;
  const enCurso = pendientes.get(clave);
  if (enCurso) return enCurso;
  const p = tarea().then(() => { cargadas.add(clave); }).finally(() => pendientes.delete(clave));
  pendientes.set(clave, p);
  return p;
}

export async function cargarAdmin(path: string, forzar = false) {
  if (Datos.modo !== 'api') return;
  const cargas: Promise<void>[] = [];
  const cargar = (clave: Clave, tarea: () => Promise<void>) => cargas.push(una(clave, tarea, forzar));

  const cursos = () => cargar('cursos', async () => Datos.hidratarAdmin('cursos', (await api<any[]>('/admin/cursos')).map(adaptarCurso)));
  const quizzes = () => cargar('quizzes', async () => Datos.hidratarAdmin('quizzes', await api<Quiz[]>('/admin/quizzes')));
  const materiales = () => cargar('materiales', async () => Datos.hidratarAdmin('materiales', (await api<any[]>('/admin/materiales')).map(adaptarMaterial)));
  const eventos = () => cargar('eventos', async () => Datos.hidratarAdmin('eventos', (await api<any[]>('/admin/eventos')).map(adaptarEvento)));
  const miembros = () => cargar('miembros', async () => Datos.hidratarAdmin('miembros', (await api<any[]>('/admin/miembros?estado=todos')).map(adaptarMiembro)));
  const avisos = () => cargar('avisos', async () => Datos.hidratarAdmin('avisos', await api<Aviso[]>('/admin/avisos')));
  const config = () => cargar('config', async () => {
    const c = await api<any>('/admin/config');
    const adaptada: Config = { precioMensual: Number(c.precios?.mensual) || 0, precioAnual: Number(c.precios?.anual) || 0, descuentoVIP: Number(c.descuentoVIP) || 0, whatsappSoporte: c.whatsappSoporte || '', canalWhatsApp: c.canalWhatsApp || '' };
    Datos.hidratarAdmin('config', adaptada);
  });

  if (path === '/admin' || path === '/admin/') {
    cargar('resumen', async () => { resumen = await api<ResumenAdmin>('/admin/resumen'); });
    cursos(); quizzes(); materiales(); eventos(); miembros();
  } else if (path.startsWith('/admin/cursos')) { cursos(); quizzes(); }
  else if (path.startsWith('/admin/quizzes')) { cursos(); quizzes(); }
  else if (path.startsWith('/admin/materiales')) { materiales(); cursos(); }
  else if (path.startsWith('/admin/en-vivo')) { eventos(); cursos(); }
  else if (path === '/admin/miembros') miembros();
  else if (path === '/admin/cupones') cargar('cupones', async () => { cupones = await api<CuponAdmin[]>('/admin/cupones'); });
  else if (path.startsWith('/admin/miembros/')) {
    const uid = decodeURIComponent(path.split('/')[3] || '');
    if (uid) cargas.push(api<MiembroDetalle>(`/admin/miembros/${encodeURIComponent(uid)}`).then((d) => { detalles.set(uid, d); }));
  } else if (path === '/admin/comunidad') cargar('foro', async () => { foro = await api<HiloAdmin[]>('/admin/foro'); });
  else if (path === '/admin/avisos') avisos();
  else if (path === '/admin/ajustes') config();

  await Promise.all(cargas);
}

export function invalidarAdmin(...claves: Clave[]) {
  claves.forEach((clave) => cargadas.delete(clave));
  Datos.invalidarAdmin(...claves.filter((c): c is Exclude<Clave, 'resumen' | 'foro' | 'cupones'> => c !== 'resumen' && c !== 'foro' && c !== 'cupones'));
  if (claves.includes('resumen')) resumen = null;
  if (claves.includes('foro')) foro = [];
  if (claves.includes('cupones')) cupones = [];
}

export const AdminRemoto = {
  resumen: () => resumen,
  foro: () => foro,
  cupones: () => cupones,
  detalleMiembro: (uid: string) => detalles.get(uid),
  olvidarDetalle: (uid: string) => detalles.delete(uid),
};

export function cursoParaApi(c: Curso) {
  return { ...c, clases: c.clases.map(({ duracion, ...k }) => ({ ...k, duracionMin: duracion ?? null })) };
}

export function materialParaApi(m: Material) {
  const { url: _url, ...resto } = m;
  return resto;
}
