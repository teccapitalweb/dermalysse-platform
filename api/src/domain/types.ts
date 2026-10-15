// Tipos del contrato de la API. Reflejan EXACTAMENTE las formas que el cliente ya espera:
//  - RespuestaMe          ↔ src/core/auth.ts (interface RespuestaMe)
//  - PerfilRemoto         ↔ src/core/perfil.ts (interface PerfilRemoto)
//  - CatalogoRemoto       ↔ src/core/remoto.ts (interface CatalogoRemoto)
//  - HiloRemoto/Detalle   ↔ src/core/comunidad.ts (HiloRemoto, DetalleRemoto, Respuesta)
//  - ExperienciaCompartida↔ src/core/directorio-experiencias.ts

export interface PerfilRemoto {
  nombre?: string;
  /** Solo modo Firestore (users.lastname). */
  apellido?: string;
  /** Solo modo Firestore (users.phone). */
  telefono?: string;
  /** Solo lectura (users.email). */
  email?: string;
  foto?: string;
  whatsapp?: string;
  especialidad?: string;
  ciudad?: string;
  /** En Firestore: users.settings.notif_* (vivo, cursos, comunidad, pdfs, promos). Sin valor = activado. */
  avisos?: { enVivo?: boolean; nuevos?: boolean; comunidad?: boolean; materiales?: boolean; promociones?: boolean };
}

/** Usuario resuelto por el adaptador de auth (fuente de verdad del servidor). */
export interface Usuario {
  uid: string;
  email: string;
  esVip: boolean;
  esAdmin: boolean;
  nombre: string;
  /** Modo firebase: detalle de la membresía según la regla de acceso del webhook. */
  acceso?: { plan: 'mensual' | 'anual' | 'cortesia' | null; vence: string | null; motivo: string };
  /** Modo firebase: datos de la cuenta (ID token) para el alta de users/members. */
  cuenta?: { nombre: string; foto: string };
}

/** Respuesta de GET /me. */
export interface RespuestaMe {
  uid: string;
  email: string;
  nombre: string;
  esVip: boolean;
  esAdmin: boolean;
  plan: string | null;
  vence: string | null;
  /** Motivo de la regla de acceso: courtesy, active, trialing, canceling, expired, past_due o none. */
  motivoAcceso: string;
  perfil: PerfilRemoto;
}

/** Respuesta de GET /config (precios y contacto para planes). */
export interface ConfigPublica {
  precios: { mensual: number; anual: number };
  descuentoVIP: number;
  contacto: { whatsappSoporte?: string; canalWhatsApp?: string };
  /** Modo Firestore: config/platform.maintenance. */
  mantenimiento?: boolean;
  /** Modo Firestore: config/platform.openRegistration (sin valor = abierto). */
  registroAbierto?: boolean;
}

export interface ClaseRemota {
  n: number;
  titulo: string;
  /** Solo en fixtures (vacío). En modo Firestore NUNCA se incluye: los ids de Bunny viven en el servidor. */
  videoId?: string;
  duracionMin: number | null;
  gratis: boolean;
}

export interface CursoRemoto {
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
  bunnyCollectionId: string;
  clases: ClaseRemota[];
}

/** Respuesta de GET /catalogo (sin URLs premium ni IDs de video productivos). */
export interface CatalogoRemoto {
  cursos: CursoRemoto[];
  materiales: unknown[];
  eventos: unknown[];
  config: {
    precios: { mensual: number; anual: number };
    descuentoVIP: number;
    whatsappSoporte: string;
    canalWhatsApp: string;
  };
}

export interface Noticia {
  id: string;
  titulo: string;
  texto: string;
  fecha: string;
  enlace?: string | null;
  categoria?: string;
  autor?: string;
}

export interface RespuestaForo {
  id: string;
  autor: string;
  texto: string;
  fecha: string;
}

/** Hilo tal como lo entrega la API: respuestas es un CONTEO (no el arreglo). */
export interface HiloRemoto {
  id: string;
  titulo: string;
  texto: string;
  autor: string;
  fecha: string;
  cursoId: string | null;
  util: number;
  respuestas: number;
  marcadoUtil?: boolean;
  oculto?: boolean;
  imagen?: string;
  verificado?: boolean;
  tipo?: 'post' | 'pregunta';
  /** Modo Firestore: forum.tag (Consulta, Experiencia, Curso, General). */
  etiqueta?: string;
}

export interface DetalleRemoto {
  hilo: HiloRemoto;
  respuestas: RespuestaForo[];
}

export const CATEGORIAS_EXPERIENCIA = ['aprendizaje', 'organizacion', 'comunicacion', 'trayectoria'] as const;
export type CategoriaExperiencia = (typeof CATEGORIAS_EXPERIENCIA)[number];

export interface ExperienciaCompartida {
  id: string;
  titulo: string;
  texto: string;
  categoria: CategoriaExperiencia;
  autor: string;
  anonima: boolean;
  fecha: string;
}

// ── Aprendizaje: quiz, progreso, certificados ─────────────────────────────

/** Pregunta COMPLETA (con la respuesta correcta). Vive SOLO en el servidor; nunca sale al cliente. */
export interface PreguntaConRespuesta {
  q: string;
  opciones: string[];
  correcta: number;
  explicacion: string;
}

/** Quiz de fixture (server-side). */
export interface QuizFixture {
  cursoId: string;
  n: number;
  preguntas: PreguntaConRespuesta[];
}

/** Pregunta tal como se expone al cliente (GET /quiz): SIN respuesta correcta ni explicación. */
export interface PreguntaPublica {
  q: string;
  opciones: string[];
}

/** Detalle por pregunta tras calificar: si acertó y la explicación. NO incluye el índice correcto. */
export interface DetalleCalificacion {
  acertada: boolean;
  explicacion: string;
}

/** Respuesta de POST /quiz/:cursoId/:n. Coincide con lo que lee el cliente (correctas, total, aprobado, detalle). */
export interface ResultadoQuiz {
  correctas: number;
  total: number;
  aprobado: boolean;
  detalle: DetalleCalificacion[];
}

/** Progreso de un curso (forma que hidrata el cliente). */
export interface ProgresoCurso {
  vistas: number[];
  ultima: number;
  actualizado: string;
  historial?: string[];
  /** Modo Firestore: porcentaje del curso (courseProgress del webhook, o vistas / clases). */
  porcentaje?: number;
}

export type ProgresoMapa = Record<string, ProgresoCurso>;

/** Certificado emitido (lista del propio usuario incluye uid; /verificar NO lo expone). */
export interface CertificadoRemoto {
  folio: string;
  uid: string;
  nombre: string;
  cursoId: string;
  cursoTitulo: string;
  area: string;
  clases: number;
  emitido: string;
}

/** Verificación pública de un folio: SIN datos privados (ni uid ni email). */
export interface VerificacionPublica {
  valido: boolean;
  folio: string;
  nombre: string;
  cursoTitulo: string;
  /** Modo Firestore: igual a cursoTitulo (nombre del contrato de producción). */
  curso?: string;
  emitido: string;
}

// ── Club interactivo: liga y perfil ──

/** Fila de la clasificacion (liga). Refleja src/core/liga.ts (interface FilaLiga). */
export interface FilaLiga {
  puesto: number;
  nombre: string;
  foto: string;
  clases: number;
  cursos: number;
  aportes: number;
  xp: number;
  nivel: string;
  ultimaActividad: string | null;
  esYo: boolean;
}

/** Respuesta de GET /liga. Refleja src/core/liga.ts (interface ResumenLiga). */
export interface ResumenLiga {
  actualizado: string;
  participantes: number;
  clasificacion: FilaLiga[];
  yo: FilaLiga | null;
  esDemo?: boolean;
  estado?: 'error' | 'sin-acceso';
}

/** Perfil almacenado por usuario (dev). Se expone como PerfilRemoto. */
export interface PerfilData {
  nombre: string;
  foto: string;
  whatsapp: string;
  especialidad: string;
  ciudad: string;
}

/**
 * Avance del Modo Historia por usuario. Refleja src/core/historia.ts (interface ProgresoHistoria):
 * ids de niveles completados, mejor puntaje (0–100) por nivel, último nivel abierto y fecha ISO.
 */
export interface ProgresoHistoria {
  completados: string[];
  puntajes: Record<string, number>;
  ultimoNivel: string;
  actualizado: string;
}

// ── Academia: programas de lectura por módulos (api/content/academia) ──
// Formato del contenido: docs/ACADEMIA-FORMATO.md. Los tipos solo fijan lo que la API usa;
// el resto de cada módulo (bloques, glosario, minijuego…) viaja tal como está en el JSON.

export const ESTADOS_ACADEMIA = ['borrador', 'revision', 'aprobado'] as const;
export type EstadoAcademia = (typeof ESTADOS_ACADEMIA)[number];

export interface ModuloCatalogoAcademia { n: number; titulo: string }

/**
 * Calendario de lanzamiento de un programa: el módulo n se abre en inicio + (n − 1) × cadaDias días,
 * a las 00:00 de la Ciudad de México (UTC−6, sin horario de verano).
 */
export interface LanzamientoAcademia { inicio: string; cadaDias: number }

/** Ajuste del administrador sobre el calendario del catálogo (tiene prioridad sobre el JSON). */
export interface AjusteLanzamientoAcademia {
  inicio: string;
  /** Sin valor: se usa el del catálogo (o 7). */
  cadaDias?: number;
  por: string;
  fecha: string;
}

export interface ProgramaAcademia {
  id: string;
  numero?: number;
  titulo: string;
  area?: string;
  descripcion?: string;
  nivel?: string;
  publico?: string[];
  portada?: { id: string; proporcion: string };
  /** Opcional: sin él, el programa no tiene fecha de apertura por módulo. */
  lanzamiento?: { inicio: string; cadaDias?: number };
  modulos: ModuloCatalogoAcademia[];
}

export interface CatalogoAcademia {
  version?: number;
  actualizado?: string;
  programas: ProgramaAcademia[];
}

/** Pregunta del banco del examen. `correcta` y `explicacion` NUNCA salen antes de calificar. */
export interface PreguntaAcademia {
  id: string;
  q: string;
  opciones: string[];
  correcta: number;
  explicacion?: string;
}

export interface TemaAcademia {
  n: string;
  titulo: string;
  [campo: string]: unknown;
}

export interface ModuloAcademia {
  programa: string;
  modulo: number;
  titulo: string;
  estado?: string;
  duracionMin?: number;
  temas?: TemaAcademia[];
  examen?: { aprobar?: number; mostrar?: number; preguntas?: PreguntaAcademia[] };
  [campo: string]: unknown;
}

/** Avance de un módulo (forma que hidrata el cliente). */
export interface AvanceModuloAcademia {
  temas?: Record<string, string>;
  mejor?: number;
  intentos?: number;
  aprobado?: boolean;
  aprobadoEn?: string;
}

export type ProgresoAcademia = Record<string, { modulos: Record<string, AvanceModuloAcademia> }>;

/** Último examen emitido a un usuario para un módulo (vive solo en el servidor). */
export interface IntentoAcademia {
  ids: string[];
  emitido: string;
  calificado: boolean;
  /** Resultado del último examen calificado (para la espera tras reprobar). */
  ultimo?: { aprobado: boolean; fecha: string };
}

/** Revisión editorial guardada por un administrador. Tiene prioridad sobre el `estado` del JSON. */
export interface RevisionAcademia {
  estado: EstadoAcademia;
  nota: string;
  revisor: string;
  fecha: string;
}
