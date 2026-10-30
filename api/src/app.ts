// Ensambla la app Express. Sin estado global: las dependencias se inyectan, lo que permite probar
// con adaptadores dev/memoria y con el Firestore falso + fetch falso del modo producción.
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { AuthAdapter, ContentStore, DirectorioAuthAdmin, ExperienceStore, ForumStore, HistoriaStore, LeagueStore, ProfileStore } from './adapters/interfaces.js';
import { NotImplementedError } from './adapters/interfaces.js';
import { DevAuthAdapter } from './adapters/dev/devAuth.js';
import { FixtureContentStore } from './adapters/dev/fixtureContent.js';
import { MemoryExperienceStore } from './adapters/dev/memoryExperiences.js';
import { FixtureLearningStore } from './adapters/dev/fixtureQuizzes.js';
import { MemoryProgressStore } from './adapters/dev/memoryProgress.js';
import { MemoryCertificateStore } from './adapters/dev/memoryCertificates.js';
import { FixtureLeagueStore } from './adapters/dev/fixtureLeague.js';
import { MemoryForumStore } from './adapters/dev/memoryForum.js';
import { MemoryProfileStore } from './adapters/dev/memoryProfile.js';
import { MemoryHistoriaStore } from './adapters/dev/memoryHistoria.js';
import { FirebaseAuthAdapter, type VerificadorIdToken } from './adapters/firebase/firebaseAuth.js';
import type { FirestorePort } from './adapters/firestore/port.js';
import { AdminFirestore, FirebaseAdminPerezoso } from './adapters/firestore/admin.js';
import {
  cargarCatalogoEditorial, FirestoreCertificateStore, FirestoreContentStore, FirestoreForumStore, FirestoreProfileStore,
  FirestoreProgressStore, type CursoEditorial,
} from './adapters/firestore/club.js';
import { FirestoreExperienceStore, FirestoreHistoriaStore, FirestoreLeagueStore, FirestoreLearningStore } from './adapters/firestore/v2.js';
import { FirestoreAcademiaAttemptStore, FirestoreAcademiaProgressStore, FirestoreAcademiaReviewStore } from './adapters/firestore/academia.js';
import { LegacyWebhookClient, type FetchLike } from './adapters/legacy/webhook.js';
import { crearAuth } from './middleware/auth.js';
import { crearRateLimiter } from './middleware/rateLimit.js';
import { CodedError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from './services/errors.js';
import { LearningService } from './services/learning.js';
import { AcademiaService } from './services/academia.js';
import { ClubProduccionService } from './services/clubProduccion.js';
import { DiskAcademiaContentStore } from './adapters/dev/diskAcademia.js';
import { MemoryAcademiaAttemptStore, MemoryAcademiaProgressStore, MemoryAcademiaReviewStore } from './adapters/dev/memoryAcademia.js';
import { ErrorConfiguracion, leerConfig } from './config.js';
import { rutaAcademia, rutaAdminAcademia } from './routes/academia.js';
import { rutaConfig } from './routes/config.js';
import { rutaCatalogo } from './routes/catalogo.js';
import { rutaNoticias } from './routes/noticias.js';
import { rutaForo } from './routes/foro.js';
import { rutaMe } from './routes/me.js';
import { rutaAdminExperiencias, rutaExperiencias } from './routes/experiencias.js';
import { rutaQuiz } from './routes/quiz.js';
import { rutaProgreso } from './routes/progreso.js';
import { rutaCertificados } from './routes/certificados.js';
import { rutaVerificar } from './routes/verificar.js';
import { rutaLiga } from './routes/liga.js';
import { rutaHistoria } from './routes/historia.js';
import { rutaCertificadosProduccion, rutaProgresoProduccion, rutaStripe, rutaVerificarProduccion, rutaVideo } from './routes/club.js';
import { MemoryFirestore } from './adapters/firestore/memoria.js';
import type { ModuloApi } from './modulos/tipos.js';
import { moduloVip } from './modulos/vip.js';
import { crearServicioContenido, moduloContenido } from './modulos/contenido.js';
import { cargarQuizzesEmpaquetados } from './adapters/firestore/contenido.js';
import { moduloExperiencia } from './modulos/experiencia.js';
import { moduloAdmin } from './modulos/admin.js';
import { moduloCursoGratis } from './modulos/cursoGratis.js';
import { moduloRetos } from './modulos/retos.js';
import { moduloCampanas } from './modulos/campanas.js';
import { moduloDirectorio } from './modulos/directorio.js';
import { PuntosService } from './services/puntos.js';

export interface Dependencias {
  auth: AuthAdapter;
  content: ContentStore;
  experiences: ExperienceStore;
  learning: LearningService;
  league: LeagueStore;
  forum: ForumStore;
  profiles: ProfileStore;
  /** Avance del Modo Historia (GET/PATCH /historia). Opcional para que los ensamblajes de prueba previos sigan válidos. */
  historia?: HistoriaStore;
  /** Academia (programas de lectura). Opcional para que los ensamblajes de prueba previos sigan válidos. */
  academia?: AcademiaService;
  /**
   * Producción (firebase + firestore): video, avance, certificados y Stripe por el webhook actual.
   * Si está, reemplaza /progreso, /certificados y /verificar del modo dev y agrega /video y /stripe.
   */
  produccion?: ClubProduccionService;
  /** Leer el foro exige sesión (producción: igual que las reglas actuales de Firestore). */
  foroRequiereSesion?: boolean;
  /** Nombre del modo de datos (solo informativo en GET /). */
  dataMode?: string;
  corsOrigins: string[];
  /**
   * Limitador de tasa (opt-in). Si está, monta un límite global por IP y uno más estricto
   * en /cupones y /stripe. `ahora` permite inyectar el reloj en pruebas.
   */
  rateLimit?: {
    ventanaMs: number;
    max: number;
    sensibleMax: number;
    trustProxy: number | boolean;
    ahora?: () => number;
  };
  /** Módulos que montan sus propias rutas (recompensas, cupones, materiales, admin…); ver src/modulos/tipos.ts. */
  modulos?: ModuloApi[];
}

/** CORS: solo refleja orígenes de la allowlist (CORS_ORIGINS). */
function cors(origenesPermitidos: string[]) {
  const permitido = new Set(origenesPermitidos.map((o) => o.trim()).filter(Boolean));
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.header('origin');
    if (origin && permitido.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    }
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  };
}

export function createApp(deps: Dependencias): Express {
  const app = express();
  app.disable('x-powered-by');
  // Detrás de Railway la IP real viene en X-Forwarded-For; confiar solo en los saltos declarados.
  if (deps.rateLimit) app.set('trust proxy', deps.rateLimit.trustProxy);
  app.use(cors(deps.corsOrigins));
  if (deps.rateLimit) {
    const rl = deps.rateLimit;
    // Límite global por IP. El CORS ya respondió los preflight OPTIONS, así que no se cuentan.
    app.use(crearRateLimiter({ ventanaMs: rl.ventanaMs, max: rl.max, ahora: rl.ahora }));
    // Límite estricto en endpoints sensibles (canje de cupones = fuerza bruta de códigos; Stripe = externo).
    app.use('/cupones', crearRateLimiter({ ventanaMs: rl.ventanaMs, max: rl.sensibleMax, ahora: rl.ahora }));
    app.use('/stripe', crearRateLimiter({ ventanaMs: rl.ventanaMs, max: rl.sensibleMax, ahora: rl.ahora }));
  }
  app.use(express.json({ limit: '32kb' }));

  const { requireUser, requireAdmin } = crearAuth(deps.auth);

  // Salud / meta (no expone secretos ni datos sensibles).
  app.get('/', (_req, res) => {
    res.json({ servicio: 'dermalysse-api', authMode: deps.auth.modo, dataMode: deps.dataMode ?? 'memoria', estado: 'ok' });
  });

  app.use('/config', rutaConfig(deps.content));
  app.use('/catalogo', rutaCatalogo(deps.content));
  app.use('/noticias', rutaNoticias(deps.content));
  app.use('/foro', rutaForo(deps.forum, requireUser, { lecturaRequiereSesion: deps.foroRequiereSesion }));
  app.use('/me', rutaMe(requireUser, deps.profiles));
  app.use('/liga', rutaLiga(deps.league, requireUser));
  app.use('/experiencias', rutaExperiencias(deps.experiences, requireUser));
  app.use('/admin/experiencias', rutaAdminExperiencias(deps.experiences, requireAdmin));
  app.use('/quiz', rutaQuiz(deps.learning, requireUser));
  if (deps.historia) app.use('/historia', rutaHistoria(deps.historia, requireUser));
  if (deps.produccion) {
    app.use('/progreso', rutaProgresoProduccion(deps.produccion, requireUser));
    app.use('/certificados', rutaCertificadosProduccion(deps.produccion, requireUser));
    app.use('/verificar', rutaVerificarProduccion(deps.produccion));
    app.use('/video', rutaVideo(deps.produccion, requireUser));
    app.use('/stripe', rutaStripe(deps.produccion, requireUser));
  } else {
    app.use('/progreso', rutaProgreso(deps.learning, requireUser));
    app.use('/certificados', rutaCertificados(deps.learning, requireUser));
    app.use('/verificar', rutaVerificar(deps.learning));
  }
  if (deps.academia) {
    app.use('/academia', rutaAcademia(deps.academia, requireUser));
    app.use('/admin/academia', rutaAdminAcademia(deps.academia, requireAdmin));
  }
  for (const modulo of deps.modulos ?? []) modulo({ app, requireUser, requireAdmin });

  // 404 honesto para rutas no definidas.
  app.use((_req, res) => {
    res.status(404).json({ error: 'no-encontrado', mensaje: 'Ruta no encontrada.' });
  });

  // Manejo de errores: estado honesto, nunca datos demo para enmascarar un fallo.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof CodedError) {
      res.status(err.status).json({ ...(err.datos ?? {}), error: err.codigo, mensaje: err.message });
      return;
    }
    if (err instanceof ValidationError) {
      res.status(400).json({ error: 'validacion', mensaje: err.message });
      return;
    }
    if (err instanceof ForbiddenError) {
      res.status(403).json({ error: 'sin-acceso', mensaje: err.message });
      return;
    }
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: 'no-encontrado', mensaje: err.message });
      return;
    }
    if (err instanceof ConflictError) {
      res.status(409).json({ error: 'conflicto', mensaje: err.message });
      return;
    }
    if (err instanceof NotImplementedError) {
      res.status(501).json({ error: 'no-implementado', mensaje: err.message });
      return;
    }
    if ((err as { type?: unknown })?.type === 'entity.too.large') { // cuerpo mayor que el límite de express.json
      res.status(413).json({ error: 'cuerpo-demasiado-grande', mensaje: 'El cuerpo de la petición excede el tamaño permitido.' });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) { // JSON inválido en el cuerpo
      res.status(400).json({ error: 'json-invalido', mensaje: 'El cuerpo de la petición no es JSON válido.' });
      return;
    }
    // Sin volcar el error completo (podría traer rutas o datos internos de Firestore).
    console.error('[api] error no controlado:', (err as { name?: string })?.name ?? 'Error', (err as { message?: string })?.message ?? '');
    res.status(500).json({ error: 'interno', mensaje: 'Error interno del servidor.' });
  });

  return app;
}

/** Piezas reales de producción inyectables (pruebas: Firestore falso, verificador y fetch falsos). */
export interface Inyecciones {
  firestore?: FirestorePort;
  verificador?: VerificadorIdToken;
  fetch?: FetchLike;
  catalogoEditorial?: CursoEditorial[];
  /** Reloj inyectable para pruebas de los módulos. */
  ahora?: () => Date;
  /** Solo pruebas/integraciones: padrón de Firebase Auth para /admin/miembros. */
  directorioAuth?: DirectorioAuthAdmin;
}

/**
 * Adaptador de auth por modo. 'firebase' exige el verificador de ID tokens y Firestore
 * (admins/{uid}, users/{uid}); sin ellos falla con un error de configuración claro.
 */
export function seleccionarAuth(modo: string | undefined, firebase?: { verificador: VerificadorIdToken; db: FirestorePort }): AuthAdapter {
  if (modo === 'firebase') {
    if (!firebase) throw new ErrorConfiguracion(['AUTH_MODE=firebase requiere FIREBASE_SERVICE_ACCOUNT (usa buildApp con la configuración completa).']);
    return new FirebaseAuthAdapter(firebase.verificador, firebase.db);
  }
  return new DevAuthAdapter();
}

/**
 * Arma la app según AUTH_MODE / DATA_MODE. Valida el entorno y lanza ErrorConfiguracion si falta algo.
 * No conecta con Firebase al construirse: firebase-admin se inicializa en la primera petición.
 */
export function buildApp(env: NodeJS.ProcessEnv = process.env, inyecciones: Inyecciones = {}): Express {
  const config = leerConfig(env);

  const ahora = inyecciones.ahora ?? (() => new Date());
  const rateLimit = config.rateLimit ? { ...config.rateLimit, ahora: () => ahora().getTime() } : undefined;
  if (!config.produccion) {
    // Desarrollo: los módulos usan un Firestore en memoria (vacío al arrancar).
    const db = inyecciones.firestore ?? new MemoryFirestore();
    const puntosAcademia = new PuntosService(db, ahora);
    const modulos: ModuloApi[] = crearModulos({ db, ahora, produccion: false, codigoCampanaBienvenida: 'DEMO-BIENVENIDA-50' });
    const content = new FixtureContentStore();
    const learning = new LearningService(content, new FixtureLearningStore(), new MemoryProgressStore(), new MemoryCertificateStore());
    return createApp({
      auth: seleccionarAuth('dev'),
      content,
      experiences: new MemoryExperienceStore(),
      learning,
      league: new FixtureLeagueStore(),
      forum: new MemoryForumStore(),
      profiles: new MemoryProfileStore(),
      historia: new MemoryHistoriaStore(),
      academia: new AcademiaService(
        new DiskAcademiaContentStore(),
        new MemoryAcademiaProgressStore(),
        new MemoryAcademiaAttemptStore(),
        new MemoryAcademiaReviewStore(),
        {
          mostrarBorradores: config.academiaMostrarBorradores,
          ahora,
          recompensarJuego: (uid, programa, n) => puntosAcademia.acreditarJuegoAcademia(uid, programa, n),
        },
      ),
      dataMode: config.dataMode,
      corsOrigins: config.corsOrigins,
      rateLimit,
      modulos,
    });
  }

  const p = config.produccion;
  const firebase = new FirebaseAdminPerezoso(p.cuenta);
  const db = inyecciones.firestore ?? new AdminFirestore(firebase);
  const puntosAcademia = new PuntosService(db, ahora);
  const verificador = inyecciones.verificador ?? firebase.verificador();
  const editorial = inyecciones.catalogoEditorial ?? cargarCatalogoEditorial();
  const forum = new FirestoreForumStore(db);
  const content = new FirestoreContentStore(db, editorial, forum, crearServicioContenido(db, ahora));
  const progreso = new FirestoreProgressStore(db, editorial);
  const certificados = new FirestoreCertificateStore(db);
  const webhook = new LegacyWebhookClient({ baseUrl: p.webhookUrl, fetch: inyecciones.fetch, timeoutMs: p.webhookTimeoutMs });

  return createApp({
    auth: seleccionarAuth('firebase', { verificador, db }),
    content,
    experiences: new FirestoreExperienceStore(db),
    learning: new LearningService(content, new FirestoreLearningStore(db, cargarQuizzesEmpaquetados()), progreso, certificados),
    league: new FirestoreLeagueStore(db),
    forum,
    profiles: new FirestoreProfileStore(db),
    historia: new FirestoreHistoriaStore(db),
    academia: new AcademiaService(
      new DiskAcademiaContentStore(),
      new FirestoreAcademiaProgressStore(db),
      new FirestoreAcademiaAttemptStore(db),
      new FirestoreAcademiaReviewStore(db),
      {
        mostrarBorradores: config.academiaMostrarBorradores,
        ahora,
        recompensarJuego: (uid, programa, n) => puntosAcademia.acreditarJuegoAcademia(uid, programa, n),
      },
    ),
    produccion: new ClubProduccionService(db, webhook, progreso, certificados, { appUrl: p.appUrl }),
    foroRequiereSesion: true,
    dataMode: config.dataMode,
    corsOrigins: config.corsOrigins,
    rateLimit,
    modulos: crearModulos({
      db,
      ahora,
      produccion: true,
      codigoCampanaBienvenida: p.codigoCampanaBienvenida,
      // Las pruebas que inyectan Firestore no deben abrir Firebase real salvo que también inyecten este puerto.
      directorioAuth: inyecciones.directorioAuth ?? (inyecciones.firestore ? undefined : firebase.directorioAdmin()),
    }),
  });
}

/**
 * Módulos del club con sus rutas propias. Cada uno recibe el mismo Firestore (memoria en desarrollo,
 * el real en producción). Agrega aquí una línea por módulo.
 */
function crearModulos(ctx: { db: FirestorePort; ahora: () => Date; produccion: boolean; codigoCampanaBienvenida: string; directorioAuth?: DirectorioAuthAdmin }): ModuloApi[] {
  return [
    moduloVip(ctx),
    moduloContenido(ctx),
    moduloExperiencia(ctx),
    moduloAdmin(ctx),
    moduloCursoGratis(ctx),
    moduloRetos(ctx),
    moduloCampanas(ctx),
    moduloDirectorio(ctx),
  ];
}
