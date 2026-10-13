// Puertos (interfaces) que la API consume. Los adaptadores dev usan fixtures/memoria;
// los adaptadores reales (Firebase/Stripe/Bunny) son seams marcados que aún no se implementan.
import type {
  CatalogoRemoto, CertificadoRemoto, ConfigPublica, DetalleRemoto, ExperienciaCompartida,
  HiloRemoto, Noticia, ProgresoCurso, ProgresoMapa, QuizFixture, Usuario,
} from '../domain/types.js';

/** Error honesto para seams no implementados. El servidor responde 501, nunca datos demo. */
export class NotImplementedError extends Error {
  readonly code = 'NOT_IMPLEMENTED';
  constructor(detalle: string) {
    super(`No implementado en este slice: ${detalle}`);
    this.name = 'NotImplementedError';
  }
}

/** Verifica credenciales y devuelve el usuario (fuente de verdad del servidor). */
export interface AuthAdapter {
  readonly modo: string;
  /** Devuelve el usuario si el token es válido; null si no lo es. El cuerpo de la petición NUNCA decide identidad/VIP/admin. */
  verificar(token: string): Promise<Usuario | null>;
}

/** Contenido de solo lectura del club (catálogo, noticias, foro, config). */
export interface ContentStore {
  config(): Promise<ConfigPublica>;
  catalogo(): Promise<CatalogoRemoto>;
  noticias(): Promise<Noticia[]>;
  foro(): Promise<HiloRemoto[]>;
  hilo(id: string): Promise<DetalleRemoto | null>;
}

export interface FiltroExperiencias {
  categoria?: string;
  q?: string;
}

/** Almacén del Directorio de experiencias. */
export interface ExperienceStore {
  listar(filtro: FiltroExperiencias): Promise<ExperienciaCompartida[]>;
  crear(exp: ExperienciaCompartida): Promise<ExperienciaCompartida>;
}

/** Banco de quizzes (con respuestas). El contenido completo NUNCA sale del servidor. */
export interface LearningStore {
  quiz(cursoId: string, n: number): Promise<QuizFixture | null>;
}

/** Progreso por usuario (memoria en dev). El servidor es la autoridad; nada del cuerpo lo decide. */
export interface ProgressStore {
  del(uid: string): Promise<ProgresoMapa>;
  curso(uid: string, cursoId: string): Promise<ProgresoCurso>;
  /** Acredita la clase n (idempotente) y devuelve el progreso del curso. */
  acreditar(uid: string, cursoId: string, n: number): Promise<ProgresoCurso>;
}

/** Certificados emitidos (memoria en dev). */
export interface CertificateStore {
  listar(uid: string): Promise<CertificadoRemoto[]>;
  porFolio(folio: string): Promise<CertificadoRemoto | null>;
  /** Emite (idempotente por uid+cursoId): si ya existe para ese curso, devuelve el existente. */
  emitir(cert: CertificadoRemoto): Promise<CertificadoRemoto>;
}
