import { api } from './auth';
import { Datos } from './datos';

export interface PerfilDirectorio {
  uid: string;
  nombre: string;
  titular: string;
  etapa: string;
  especialidades: string[];
  ciudad: string;
  estado: string;
  modalidades: string[];
  disponibilidad: string[];
  habilidades: string[];
  bio: string;
  foto?: string | null;
  banner?: string | null;
  anosExperiencia?: number | null;
  idiomas?: string[];
  experiencia?: ExperienciaDirectorio[];
  formacion?: FormacionDirectorio[];
  credenciales?: CredencialDirectorio[];
  contacto?: { canal: string; valor: string } | null;
  actualizado: string;
  esMio?: boolean;
  visible?: boolean;
}

export interface ExperienciaDirectorio {
  puesto: string;
  organizacion: string;
  periodo: string;
  descripcion: string;
}

export interface FormacionDirectorio {
  programa: string;
  institucion: string;
  periodo: string;
}

export interface CredencialDirectorio {
  nombre: string;
  emisor: string;
  anio: string;
}

export interface OportunidadDirectorio {
  id: string;
  autorUid: string;
  autor: string;
  titulo: string;
  tipo: string;
  organizacion: string;
  modalidad: string;
  ciudad: string;
  entidad: string;
  especialidades: string[];
  resumen: string;
  requisitos: string;
  compensacion: string;
  estado: string;
  fecha: string;
  expira: string;
  esMia?: boolean;
}

export interface ConexionDirectorio {
  id: string;
  deUid: string;
  paraUid: string;
  oportunidadId: string | null;
  mensaje: string;
  estado: string;
  creado: string;
  actualizado: string;
  esEntrante: boolean;
  otraPersona: string;
  contacto: { canal: string; valor: string } | null;
}

export interface PaginacionDirectorio {
  perfiles: { hayMas: boolean; siguiente: string | null };
  oportunidades: { hayMas: boolean; siguiente: string | null };
  conexiones: { truncadas: boolean };
}

export interface EstadoDirectorio {
  perfiles: PerfilDirectorio[];
  oportunidades: OportunidadDirectorio[];
  conexiones: ConexionDirectorio[];
  miPerfil: PerfilDirectorio | null;
  paginacion?: PaginacionDirectorio;
}

export interface ImagenDirectorioPreparada {
  blob: Blob;
  preview: string;
}

export type FotoPreparada = ImagenDirectorioPreparada;

const KEY = 'dermalysse:directorio:v1';
const DEMO: EstadoDirectorio = {
  perfiles: [
    {
      uid: 'demo-sofia',
      nombre: 'Dra. Sofía Montemayor',
      foto: null,
      banner: null,
      titular: 'Cosmiatra Médica · Especialista en Tecnologías Láser y Diodo',
      etapa: 'cosmiatra',
      especialidades: ['Láser Diodo', 'Rejuvenecimiento Facial', 'Aparatología'],
      ciudad: 'San Pedro Garza García',
      estado: 'Nuevo León',
      modalidades: ['presencial'],
      disponibilidad: ['interconsulta', 'capacitacion'],
      habilidades: ['Depilación médica trionda', 'HIFU 7D', 'Radiofrecuencia fraccionada'],
      idiomas: ['Español', 'Inglés'],
      anosExperiencia: 9,
      bio: 'Especialista en protocolos combinados de tecnología lumínica y principios activos despigmentantes.',
      experiencia: [
        { puesto: 'Directora de cabina clínica', organizacion: 'DermaLaser MedSpa', periodo: '2020 · Actualidad', descripcion: 'Tratamientos de fotorejuvenecimiento y seguimiento de protocolos posquirúrgicos.' },
        { puesto: 'Cosmiatra asociada', organizacion: 'Clínica Estética del Norte', periodo: '2016 · 2020', descripcion: 'Manejo de equipos de alta gama y asesoría en cabinas independientes.' }
      ],
      formacion: [
        { programa: 'Especialidad en Cosmiatría Médica', institucion: 'Instituto de Posgrados en Estética', periodo: '2014 · 2016' }
      ],
      credenciales: [
        { nombre: 'Operador Certificado Láser Clase IV', emisor: 'Sociedad Iberoamericana de Tecnologías Estéticas', anio: '2023' }
      ],
      actualizado: '2026-10-18T12:00:00Z',
    },
    {
      uid: 'demo-camila',
      nombre: 'Lic. Camila Restrepo',
      foto: null,
      banner: null,
      titular: 'Cosmetóloga Clínica · Especialista en Biotipos Cutáneos',
      etapa: 'cosmetologa',
      especialidades: ['Peelings Químicos', 'Dermapen', 'Cosmetología'],
      ciudad: 'Ciudad de México',
      estado: 'CDMX',
      modalidades: ['presencial', 'hibrido'],
      disponibilidad: ['interconsulta', 'colaboraciones'],
      habilidades: ['Peelings enzimáticos', 'Microneedling', 'Preparación prequirúrgica'],
      idiomas: ['Español'],
      anosExperiencia: 7,
      bio: 'Atención especializada en acné inflamatorio, rosácea y protocolos no invasivos de regeneración epidérmica.',
      experiencia: [
        { puesto: 'Cosmetóloga titular', organizacion: 'Cabina Boutique Polanco', periodo: '2019 · Actualidad', descripcion: 'Planes de choque para pieles sensibles y rehabilitación de barrera cutánea.' }
      ],
      formacion: [
        { programa: 'Licenciatura en Cosmetología e Imagen Integral', institucion: 'Universidad del Valle', periodo: '2014 · 2018' }
      ],
      credenciales: [],
      actualizado: '2026-10-17T11:00:00Z',
    },
    {
      uid: 'demo-lumiere',
      nombre: 'Clínica Lumière Esthétique',
      foto: null,
      banner: null,
      titular: 'Centro Integral de Estética · Espacios y Aparatología en Renta',
      etapa: 'clinica_estetica',
      especialidades: ['Renta de Cabinas', 'Aparatología Avanzada', 'HIFU'],
      ciudad: 'Guadalajara',
      estado: 'Jalisco',
      modalidades: ['presencial'],
      disponibilidad: ['renta_cabina', 'renta_aparatologia'],
      habilidades: ['Cabinas certificadas COFEPRIS', 'Camillas eléctricas', 'Esterilización hospitalaria'],
      idiomas: ['Español', 'Inglés'],
      anosExperiencia: 12,
      bio: 'Ofrecemos cabinas equipadas para profesionales independientes y renta de equipos de última generación por jornada.',
      experiencia: [
        { puesto: 'Administración y Renta de Espacios', organizacion: 'Lumière Medical Suites', periodo: '2015 · Actualidad', descripcion: 'Soporte y renta de cabinas a más de 40 cosmetólogas y médicos estéticos.' }
      ],
      formacion: [],
      credenciales: [
        { nombre: 'Acreditación Sanitaria de Cabinas Estéticas', emisor: 'Secretaría de Salud Jalisco', anio: '2024' }
      ],
      actualizado: '2026-10-16T14:00:00Z',
    }
  ],
  oportunidades: [
    {
      id: 'demo-op-1',
      autorUid: 'demo-lumiere',
      autor: 'Clínica Lumière Esthétique',
      titulo: 'Renta de Cabina Estética Premium por Jornada (Incluye camilla eléctrica)',
      tipo: 'renta_cabina',
      organizacion: 'Lumière Esthétique',
      modalidad: 'presencial',
      ciudad: 'Guadalajara',
      entidad: 'Jalisco',
      especialidades: ['Renta de Cabinas', 'Cosmetología'],
      resumen: 'Cabina amueblada en Providencia con recepción, autoclave, luz cálida regulable y estacionamiento para pacientes.',
      requisitos: 'Cédula profesional o constancia certificada de cosmetología/cosmiatría.',
      compensacion: '$650 MXN / Jornada de 6 horas',
      estado: 'publicada',
      fecha: '2026-10-18T10:00:00Z',
      expira: '2026-12-01T10:00:00Z',
    },
    {
      id: 'demo-op-2',
      autorUid: 'demo-sofia',
      autor: 'Dra. Sofía Montemayor',
      titulo: 'Renta de Equipo Láser Diodo Trionda con Certificado COFEPRIS',
      tipo: 'renta_aparatologia',
      organizacion: 'DermaLaser MedSpa',
      modalidad: 'presencial',
      ciudad: 'San Pedro Garza García',
      entidad: 'Nuevo León',
      especialidades: ['Láser Diodo', 'Aparatología'],
      resumen: 'Equipo portátil de depilación médica y fotorejuvenecimiento disponible por día completo con entrega en cabina.',
      requisitos: 'Depósito en garantía y comprobante de capacitación técnica previa.',
      compensacion: '$2,800 MXN / Día completo con consumibles',
      estado: 'publicada',
      fecha: '2026-10-17T09:00:00Z',
      expira: '2026-11-30T09:00:00Z',
    }
  ],
  conexiones: [],
  miPerfil: null,
};

let estado: EstadoDirectorio = structuredClone(DEMO);
let cargadoEn = 0;

const combinar = <T extends { id?: string; uid?: string }>(a: T[], b: T[]) =>
  [...new Map([...a, ...b].map((v) => [v.id || v.uid, v])).values()];

const alInicio = <T extends { id: string }>(lista: T[], v: T) => [v, ...lista.filter((x) => x.id !== v.id)];
const reemplazar = <T extends { id: string }>(lista: T[], v: T) => lista.map((x) => (x.id === v.id ? v : x));

function guardar() {
  if (Datos.modo === 'demo') {
    try {
      localStorage.setItem(KEY, JSON.stringify(estado));
    } catch {}
  }
}

function cargarDemo() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v?.perfiles) estado = v;
  } catch {}
}
cargarDemo();

const blobADataUrl = (blob: Blob) =>
  new Promise<string>((ok, err) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => err(r.error);
    r.readAsDataURL(blob);
  });

async function prepararImagenDirectorio(file: File, tipo: 'foto' | 'banner'): Promise<ImagenDirectorioPreparada> {
  if (!file.type.startsWith('image/')) throw new Error('Selecciona una imagen JPG, PNG o WebP.');
  if (file.size > 8_000_000) throw new Error('La imagen original debe pesar menos de 8 MB.');
  const source = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, err) => {
      const el = new Image();
      el.onload = () => ok(el);
      el.onerror = () => err(new Error('No pudimos leer la imagen.'));
      el.src = source;
    });
    const ancho = tipo === 'foto' ? 720 : 1600;
    const alto = tipo === 'foto' ? 720 : 560;
    const escala = Math.max(ancho / img.naturalWidth, alto / img.naturalHeight);
    const origenAncho = ancho / escala;
    const origenAlto = alto / escala;
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    canvas.getContext('2d')!.drawImage(
      img,
      (img.naturalWidth - origenAncho) / 2,
      (img.naturalHeight - origenAlto) / 2,
      origenAncho,
      origenAlto,
      0,
      0,
      ancho,
      alto
    );
    const blob = await new Promise<Blob>((ok, err) =>
      canvas.toBlob((v) => (v ? ok(v) : err(new Error('No pudimos optimizar la imagen.'))), 'image/webp', tipo === 'foto' ? 0.86 : 0.82)
    );
    const max = tipo === 'foto' ? 2_000_000 : 3_000_000;
    if (blob.size > max) throw new Error(`La ${tipo === 'foto' ? 'foto' : 'portada'} optimizada todavía supera ${max / 1_000_000} MB. Prueba otra imagen.`);
    return { blob, preview: URL.createObjectURL(blob) };
  } finally {
    URL.revokeObjectURL(source);
  }
}

export const prepararFotoDirectorio = (file: File) => prepararImagenDirectorio(file, 'foto');
export const prepararBannerDirectorio = (file: File) => prepararImagenDirectorio(file, 'banner');

export const Directorio = {
  get: () => estado,
  cargado: () => cargadoEn > 0,
  vigente: (ttl: number) => Date.now() - cargadoEn < ttl,
  invalidar() {
    cargadoEn = 0;
  },
  hidratar(v: EstadoDirectorio) {
    estado = v;
  },
  async cargar(mas?: 'perfiles' | 'oportunidades') {
    if (Datos.modo === 'api') {
      const qs = new URLSearchParams({ limite: '24' });
      const siguiente = mas ? estado.paginacion?.[mas]?.siguiente : null;
      if (mas === 'perfiles' && siguiente) qs.set('perfilesAntes', siguiente);
      if (mas === 'oportunidades' && siguiente) qs.set('oportunidadesAntes', siguiente);
      const remoto = await api<EstadoDirectorio>(`/directorio?${qs}`);
      estado =
        mas === 'perfiles'
          ? {
              ...remoto,
              perfiles: combinar(estado.perfiles, remoto.perfiles),
              oportunidades: estado.oportunidades,
              paginacion: { ...remoto.paginacion!, oportunidades: estado.paginacion?.oportunidades ?? remoto.paginacion!.oportunidades },
            }
          : mas === 'oportunidades'
          ? {
              ...remoto,
              perfiles: estado.perfiles,
              oportunidades: combinar(estado.oportunidades, remoto.oportunidades),
              paginacion: { ...remoto.paginacion!, perfiles: estado.paginacion?.perfiles ?? remoto.paginacion!.perfiles },
            }
          : remoto;
      cargadoEn = Date.now();
    }
    return estado;
  },
  async guardarPerfil(
    v: Omit<PerfilDirectorio, 'uid' | 'nombre' | 'actualizado' | 'esMio' | 'foto' | 'banner'> & { contacto: { canal: string; valor?: string } },
    foto?: ImagenDirectorioPreparada | null,
    quitarFoto = false,
    banner?: ImagenDirectorioPreparada | null,
    quitarBanner = false
  ) {
    if (Datos.modo === 'api') {
      if (quitarFoto) await api('/directorio/perfil/foto', { method: 'DELETE' });
      if (quitarBanner) await api('/directorio/perfil/banner', { method: 'DELETE' });
      let fotoPropia = false;
      if (foto) {
        const firma = await api<{ uploadUrl: string; publicUrl: string; contentType: string }>('/directorio/perfil/foto/subida', {
          method: 'POST',
          json: { contentType: 'image/webp', bytes: foto.blob.size },
        });
        const subida = await fetch(firma.uploadUrl, { method: 'PUT', headers: { 'Content-Type': firma.contentType }, body: foto.blob });
        if (!subida.ok) throw new Error(`No pudimos subir la foto (${subida.status}).`);
        fotoPropia = true;
      }
      let bannerPropio = false;
      if (banner) {
        const firma = await api<{ uploadUrl: string; publicUrl: string; contentType: string }>('/directorio/perfil/banner/subida', {
          method: 'POST',
          json: { contentType: 'image/webp', bytes: banner.blob.size },
        });
        const subida = await fetch(firma.uploadUrl, { method: 'PUT', headers: { 'Content-Type': firma.contentType }, body: banner.blob });
        if (!subida.ok) throw new Error(`No pudimos subir la portada (${subida.status}).`);
        bannerPropio = true;
      }
      await api('/directorio/perfil', {
        method: 'PUT',
        json: {
          ...v,
          ...(fotoPropia ? { foto: 'propia' } : quitarFoto ? { foto: null } : {}),
          ...(bannerPropio ? { banner: 'propio' } : quitarBanner ? { banner: null } : {}),
        },
      });
      this.invalidar();
      return estado;
    }
    const fotoFinal = quitarFoto ? null : foto ? await blobADataUrl(foto.blob) : estado.miPerfil?.foto ?? null;
    const bannerFinal = quitarBanner ? null : banner ? await blobADataUrl(banner.blob) : estado.miPerfil?.banner ?? null;
    const { contacto: _contacto, ...publico } = v;
    const perfil: PerfilDirectorio = {
      ...publico,
      foto: fotoFinal,
      banner: bannerFinal,
      uid: 'demo',
      nombre: 'Modo demo',
      actualizado: new Date().toISOString(),
      esMio: true,
    };
    estado.perfiles = [...estado.perfiles.filter((p) => p.uid !== 'demo'), perfil];
    estado.miPerfil = { ...perfil, contacto: { canal: v.contacto.canal, valor: v.contacto.valor || '' } };
    guardar();
    return estado;
  },
  async publicar(v: Record<string, unknown>) {
    if (Datos.modo === 'api') {
      const op = await api<OportunidadDirectorio>('/directorio/oportunidades', { method: 'POST', json: v });
      if (op?.id) estado = { ...estado, oportunidades: alInicio(estado.oportunidades, op) };
      else this.invalidar();
      return estado;
    }
    const op = {
      ...v,
      id: `demo-op-${Date.now()}`,
      autorUid: 'demo',
      autor: 'Modo demo',
      estado: 'publicada',
      fecha: new Date().toISOString(),
      expira: new Date(Date.now() + 45 * 86400000).toISOString(),
      esMia: true,
    } as OportunidadDirectorio;
    estado.oportunidades.unshift(op);
    guardar();
    return estado;
  },
  async cerrarOportunidad(id: string) {
    if (Datos.modo === 'api') {
      const op = await api<OportunidadDirectorio>(`/directorio/oportunidades/${encodeURIComponent(id)}`, { method: 'PATCH', json: { estado: 'cerrada' } });
      if (op?.id) estado = { ...estado, oportunidades: reemplazar(estado.oportunidades, op) };
      else this.invalidar();
      return estado;
    }
    const op = estado.oportunidades.find((x) => x.id === id);
    if (op) op.estado = 'cerrada';
    guardar();
    return estado;
  },
  async eliminarPerfil() {
    if (Datos.modo === 'api') {
      await api('/directorio/perfil', { method: 'DELETE' });
      this.invalidar();
      return estado;
    }
    estado.perfiles = estado.perfiles.filter((p) => !p.esMio && p.uid !== 'demo');
    estado.oportunidades.forEach((o) => {
      if (o.esMia || o.autorUid === 'demo') o.estado = 'cerrada';
    });
    estado.conexiones = estado.conexiones.map((c) => (c.estado === 'pendiente' ? { ...c, estado: 'rechazada' } : c));
    estado.miPerfil = null;
    guardar();
    return estado;
  },
  // Asegura un perfil mínimo OCULTO cuando el miembro omite llenar sus datos (usuario nuevo).
  async asegurarPerfil() {
    if (Datos.modo !== 'api') return estado;
    await api('/directorio/perfil/asegurar', { method: 'POST', json: {} });
    this.invalidar();
    await this.cargar();
    return estado;
  },
  async reportar(tipo: 'perfil' | 'oportunidad', objetivoId: string, motivo: string, detalle: string) {
    if (Datos.modo === 'api') return api<{ id: string; estado: string }>('/directorio/reportes', { method: 'POST', json: { tipo, objetivoId, motivo, detalle } });
    return { id: `demo-reporte-${Date.now()}`, estado: 'pendiente' };
  },
  async conectar(paraUid: string, oportunidadId: string | null, mensaje: string) {
    if (Datos.modo === 'api') {
      const c = await api<ConexionDirectorio>('/directorio/conexiones', { method: 'POST', json: { paraUid, oportunidadId, mensaje } });
      if (c?.id) estado = { ...estado, conexiones: alInicio(estado.conexiones, c) };
      else this.invalidar();
      return estado;
    }
    const persona = estado.perfiles.find((p) => p.uid === paraUid)?.nombre || estado.oportunidades.find((o) => o.id === oportunidadId)?.autor || 'Colega';
    estado.conexiones.unshift({
      id: `demo-cn-${Date.now()}`,
      deUid: 'demo',
      paraUid,
      oportunidadId,
      mensaje,
      estado: 'pendiente',
      creado: new Date().toISOString(),
      actualizado: new Date().toISOString(),
      esEntrante: false,
      otraPersona: persona,
      contacto: null,
    });
    guardar();
    return estado;
  },
  async responder(id: string, respuesta: 'aceptada' | 'rechazada') {
    if (Datos.modo === 'api') {
      const c = await api<ConexionDirectorio>(`/directorio/conexiones/${encodeURIComponent(id)}`, { method: 'PATCH', json: { estado: respuesta } });
      if (c?.id) estado = { ...estado, conexiones: reemplazar(estado.conexiones, c) };
      else this.invalidar();
      return estado;
    }
    const c = estado.conexiones.find((x) => x.id === id);
    if (c) c.estado = respuesta;
    guardar();
    return estado;
  },
};
