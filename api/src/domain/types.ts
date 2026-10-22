// Tipos del contrato de la API. Reflejan EXACTAMENTE las formas que el cliente ya espera:
//  - RespuestaMe          ↔ src/core/auth.ts (interface RespuestaMe)
//  - PerfilRemoto         ↔ src/core/perfil.ts (interface PerfilRemoto)
//  - CatalogoRemoto       ↔ src/core/remoto.ts (interface CatalogoRemoto)
//  - HiloRemoto/Detalle   ↔ src/core/comunidad.ts (HiloRemoto, DetalleRemoto, Respuesta)
//  - ExperienciaCompartida↔ src/core/directorio-experiencias.ts

export interface PerfilRemoto {
  nombre?: string;
  foto?: string;
  whatsapp?: string;
  especialidad?: string;
  ciudad?: string;
  avisos?: { enVivo?: boolean; nuevos?: boolean; comunidad?: boolean };
}

/** Usuario resuelto por el adaptador de auth (fuente de verdad del servidor). */
export interface Usuario {
  uid: string;
  email: string;
  esVip: boolean;
  esAdmin: boolean;
  nombre: string;
}

/** Respuesta de GET /me. */
export interface RespuestaMe {
  uid: string;
  email: string;
  esVip: boolean;
  esAdmin: boolean;
  plan: string | null;
  vence: string | null;
  perfil: PerfilRemoto;
}

/** Respuesta de GET /config (precios y contacto para planes). */
export interface ConfigPublica {
  precios: { mensual: number; anual: number };
  descuentoVIP: number;
  contacto: { whatsappSoporte?: string; canalWhatsApp?: string };
}

export interface ClaseRemota {
  n: number;
  titulo: string;
  videoId: string;
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

// ── Módulo Experiencia (entrevista + encuesta inicial) ────────────────────
// Refleja EXACTAMENTE las formas que consume src/core/experiencia.ts del
// cliente. Un DTO mal formado NUNCA debe otorgar beneficios reales.

export interface BeneficioExperiencia {
  estado: 'no-disponible' | 'reservado' | 'otorgado' | 'demo';
  dias: number | null;
  hasta: string | null;
  motivo: string;
  venceOferta: string | null;
}

export interface ProgresoExperiencia {
  estado: 'pendiente' | 'en-curso' | 'pospuesta' | 'completada';
  revision: number;
  paso: number;
  respuestas: Record<string, unknown>;
  completadaEn: string | null;
  pospuestaHasta: string | null;
}

export interface EncuestaExperiencia extends Omit<ProgresoExperiencia, 'estado'> {
  id: 'experiencia-inicial-v1';
  estado: 'bloqueada' | 'disponible' | 'en-curso' | 'pospuesta' | 'completada';
  motivo: string;
  disponibleEn: string | null;
}

export interface RecomendacionExperiencia {
  id: string;
  titulo: string;
  area: string;
  nivel: string;
  portada: string;
}

/** Estado completo del módulo Experiencia para un usuario. */
export interface ExperienciaDTO {
  version: 1;
  fuente: 'api' | 'demo';
  cohorte: 'nueva' | 'existente' | 'demo';
  primerAccesoEn: string | null;
  areas: string[];
  recomendaciones: RecomendacionExperiencia[];
  entrevista: ProgresoExperiencia;
  encuesta: EncuestaExperiencia;
  beneficios: { bienvenida: BeneficioExperiencia; experiencia: BeneficioExperiencia };
}

/** Política de campaña (admin). */
export interface ConfigExperiencia {
  version: 1;
  revision: number;
  campanaId: string | null;
  aprobado: boolean;
  habilitada: boolean;
  fechaInicio: string | null;
  fechaFin: string | null;
  cupo: number;
  reservadas: number;
  premios: { bienvenida: 7; experiencia: 15 };
}

export interface EscalaResultado {
  respuestas: number;
  sinEvaluar: number;
  promedio: number | null;
}

export interface ResultadosExperiencia {
  entrevista: {
    total: number;
    roles: Record<string, number>;
    objetivo: Record<string, number>;
    areas: Record<string, number>;
    experiencia: Record<string, number>;
    formato: Record<string, number>;
    tiempo: Record<string, number>;
    origen: Record<string, number>;
  };
  encuesta: {
    total: number;
    facilidad: EscalaResultado;
    utilidad: EscalaResultado;
    dificultad: Record<string, number>;
  };
}

/** Resumen agregado para el panel administrativo. */
export interface ResumenExperiencia {
  version: 1;
  cuentas: number;
  entrevistas: { pendientes: number; enCurso: number; pospuestas: number; completadas: number };
  encuestas: { enCurso: number; pospuestas: number; completadas: number };
  sesionesRegistradas: number;
  beneficios: {
    bienvenida: { otorgados: number; dias: number };
    experiencia: { otorgados: number; dias: number };
  };
  campana: { campanaId: string | null; reservadas: number; cupo: number };
  resultados?: ResultadosExperiencia;
}

/** Estado interno persistido por usuario (no se expone tal cual al cliente). */
export interface ExperienciaUsuario {
  version: 1;
  uid: string;
  primerAccesoEn: string | null;
  cohorte: 'nueva' | 'existente';
  privacidadAceptada: boolean;
  sesiones: string[];
  entrevista: ProgresoExperiencia;
  encuesta: EncuestaExperiencia;
  beneficios: { bienvenida: BeneficioExperiencia; experiencia: BeneficioExperiencia };
}
