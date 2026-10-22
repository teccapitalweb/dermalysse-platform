// Puertos (interfaces) que la API consume. Los adaptadores dev usan fixtures/memoria;
// los adaptadores reales (Firebase/Stripe/Bunny) son seams marcados que aún no se implementan.
import type {
  CatalogoRemoto, CertificadoRemoto, ConfigExperiencia, ConfigPublica, DetalleRemoto,
  ExperienciaCompartida, ExperienciaUsuario, FilaLiga, HiloRemoto, Noticia, PerfilData,
  PerfilRemoto, ProgresoCurso, ProgresoMapa, QuizFixture, RespuestaForo, ResumenExperiencia,
  ResumenLiga, Usuario,
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

/** Clasificación de la liga (fixture en dev). La fila "yo" se deriva del usuario autenticado. */
export interface LeagueStore {
  resumen(filas: FilaLiga[]): Promise<ResumenLiga>;
  /** Filas base (sin "yo"). */
  filas(): Promise<FilaLiga[]>;
}

/** Foro de comunidad (memoria en dev; sembrado desde fixture). El servidor asigna id/autor/fecha. */
export interface ForumStore {
  listar(): Promise<HiloRemoto[]>;
  detalle(id: string): Promise<DetalleRemoto | null>;
  crearHilo(hilo: HiloRemoto): Promise<HiloRemoto>;
  /** Devuelve la respuesta creada, o null si el hilo no existe. */
  agregarRespuesta(id: string, respuesta: RespuestaForo): Promise<RespuestaForo | null>;
  /** Alterna "útil" para ese uid; devuelve el conteo y estado, o null si el hilo no existe. */
  alternarUtil(id: string, uid: string): Promise<{ util: number; marcadoUtil: boolean } | null>;
}

/** Perfil por usuario (memoria en dev). Solo el propio uid. */
export interface ProfileStore {
  get(uid: string, nombrePorDefecto: string): Promise<PerfilData>;
  patch(uid: string, cambios: Partial<PerfilData>, nombrePorDefecto: string): Promise<PerfilRemoto>;
}

/**
 * Módulo Experiencia: entrevista inicial + encuesta tras uso + beneficios VIP.
 * El servidor es la fuente de verdad. Las reglas de desbloqueo (gates), premios y
 * cupos NUNCA se evalúan en el cliente.
 */
export interface ExperienciaModuloStore {
  /** Devuelve el estado del usuario; lo crea si no existe (sin iniciar). */
  obtener(uid: string): Promise<ExperienciaUsuario>;
  /** Registra el consentimiento y marca el primer acceso. Idempotente. */
  iniciar(uid: string): Promise<ExperienciaUsuario>;
  /** Autosave: fusiona respuestas y avanza el paso. Valida revisión. */
  guardarPaso(uid: string, flujo: 'entrevista' | 'encuesta', revision: number, paso: number, respuestas: Record<string, unknown>): Promise<ExperienciaUsuario>;
  /** Pospone el flujo (reaparece pasado el día). */
  posponer(uid: string, flujo: 'entrevista' | 'encuesta', revision: number): Promise<ExperienciaUsuario>;
  /** Completa el flujo y reserva el beneficio bajo la política vigente. */
  completar(uid: string, flujo: 'entrevista' | 'encuesta', revision: number, respuestasFinales?: Record<string, unknown>): Promise<ExperienciaUsuario>;
  /** Registra una sesión diaria (idempotente por uid+día). */
  registrarSesion(uid: string): Promise<ExperienciaUsuario>;
  /** Política de campaña (lectura administrativa). */
  config(): Promise<ConfigExperiencia>;
  /** Actualiza la política; valida revisión y reglas internas. */
  guardarConfig(cambios: Omit<ConfigExperiencia, 'version' | 'reservadas' | 'premios'>): Promise<ConfigExperiencia>;
  /** Resumen agregado para el panel admin. Sin datos personales. */
  resumen(): Promise<ResumenExperiencia>;
}
