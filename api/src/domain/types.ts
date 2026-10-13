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
