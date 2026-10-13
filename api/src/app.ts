// Ensambla la app Express del slice. Sin estado global: las dependencias se inyectan,
// lo que permite probar con adaptadores dev/memoria.
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { AuthAdapter, ContentStore, ExperienceStore } from './adapters/interfaces.js';
import { NotImplementedError } from './adapters/interfaces.js';
import { DevAuthAdapter } from './adapters/dev/devAuth.js';
import { FixtureContentStore } from './adapters/dev/fixtureContent.js';
import { MemoryExperienceStore } from './adapters/dev/memoryExperiences.js';
import { FixtureLearningStore } from './adapters/dev/fixtureQuizzes.js';
import { MemoryProgressStore } from './adapters/dev/memoryProgress.js';
import { MemoryCertificateStore } from './adapters/dev/memoryCertificates.js';
import { FirebaseAuthAdapter } from './adapters/stubs/firebaseAuth.js';
import { crearAuth } from './middleware/auth.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from './services/errors.js';
import { LearningService } from './services/learning.js';
import { rutaConfig } from './routes/config.js';
import { rutaCatalogo } from './routes/catalogo.js';
import { rutaNoticias } from './routes/noticias.js';
import { rutaForo } from './routes/foro.js';
import { rutaMe } from './routes/me.js';
import { rutaExperiencias } from './routes/experiencias.js';
import { rutaQuiz } from './routes/quiz.js';
import { rutaProgreso } from './routes/progreso.js';
import { rutaCertificados } from './routes/certificados.js';
import { rutaVerificar } from './routes/verificar.js';

export interface Dependencias {
  auth: AuthAdapter;
  content: ContentStore;
  experiences: ExperienceStore;
  learning: LearningService;
  corsOrigins: string[];
}

/** CORS para desarrollo: solo refleja orígenes de la allowlist. Los dominios de prod se deciden después. */
function corsDev(origenesPermitidos: string[]) {
  const permitido = new Set(origenesPermitidos.map((o) => o.trim()).filter(Boolean));
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.header('origin');
    if (origin && permitido.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    }
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  };
}

export function createApp(deps: Dependencias): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(corsDev(deps.corsOrigins));
  app.use(express.json({ limit: '32kb' }));

  const { requireUser } = crearAuth(deps.auth);

  // Salud / meta (no expone secretos ni datos sensibles).
  app.get('/', (_req, res) => {
    res.json({ servicio: 'dermalysse-api', slice: 'etapa-4', authMode: deps.auth.modo, estado: 'ok' });
  });

  app.use('/config', rutaConfig(deps.content));
  app.use('/catalogo', rutaCatalogo(deps.content));
  app.use('/noticias', rutaNoticias(deps.content));
  app.use('/foro', rutaForo(deps.content));
  app.use('/me', rutaMe(requireUser));
  app.use('/experiencias', rutaExperiencias(deps.experiences, requireUser));
  app.use('/quiz', rutaQuiz(deps.learning, requireUser));
  app.use('/progreso', rutaProgreso(deps.learning, requireUser));
  app.use('/certificados', rutaCertificados(deps.learning, requireUser));
  app.use('/verificar', rutaVerificar(deps.learning));

  // 404 honesto para rutas no definidas.
  app.use((_req, res) => {
    res.status(404).json({ error: 'no-encontrado', mensaje: 'Ruta no encontrada.' });
  });

  // Manejo de errores: estado honesto, nunca datos demo para enmascarar un fallo.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
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
    if (err instanceof SyntaxError && 'body' in err) { // JSON inválido en el cuerpo
      res.status(400).json({ error: 'json-invalido', mensaje: 'El cuerpo de la petición no es JSON válido.' });
      return;
    }
    console.error('[api] error no controlado:', err);
    res.status(500).json({ error: 'interno', mensaje: 'Error interno del servidor.' });
  });

  return app;
}

/** Elige el adaptador de auth según AUTH_MODE (dev por defecto; firebase es un seam no implementado). */
export function seleccionarAuth(modo: string | undefined): AuthAdapter {
  return modo === 'firebase' ? new FirebaseAuthAdapter() : new DevAuthAdapter();
}

/** Arma la app con adaptadores dev/memoria y configuración desde el entorno. */
export function buildApp(env: NodeJS.ProcessEnv = process.env): Express {
  const corsOrigins = (env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',');
  const content = new FixtureContentStore();
  const learning = new LearningService(
    content,
    new FixtureLearningStore(),
    new MemoryProgressStore(),
    new MemoryCertificateStore(),
  );
  return createApp({
    auth: seleccionarAuth(env.AUTH_MODE),
    content,
    experiences: new MemoryExperienceStore(),
    learning,
    corsOrigins,
  });
}
