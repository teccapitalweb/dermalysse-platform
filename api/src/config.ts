// Configuración por entorno. Valida TODO al arrancar y falla rápido con un mensaje claro que solo
// nombra variables (nunca imprime valores: FIREBASE_SERVICE_ACCOUNT es un secreto).
//  - dev + memoria      (predeterminado): usuario de desarrollo y datos en memoria/fixtures.
//  - firebase + firestore (producción): proyecto club-dermalysse + webhook actual.
// Las combinaciones mixtas se rechazan: con auth dev no se debe escribir en el Firestore real, y
// con Firestore real hace falta el ID token real para delegar en el webhook.
import type { CuentaServicio } from './adapters/firestore/admin.js';

export const PROYECTO_FIREBASE = 'club-dermalysse';

export type ModoAuth = 'dev' | 'firebase';
export type ModoDatos = 'memoria' | 'firestore';

export interface ConfigProduccion {
  cuenta: CuentaServicio;
  webhookUrl: string;
  webhookTimeoutMs: number;
  appUrl: string;
}

export interface ConfigApi {
  authMode: ModoAuth;
  dataMode: ModoDatos;
  corsOrigins: string[];
  academiaMostrarBorradores: boolean;
  /** Solo en firebase + firestore. */
  produccion?: ConfigProduccion;
}

export class ErrorConfiguracion extends Error {
  constructor(readonly problemas: string[]) {
    super(`Configuración inválida de la API:\n - ${problemas.join('\n - ')}`);
    this.name = 'ErrorConfiguracion';
  }
}

const esLocal = (host: string) => host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

/** URL base https (http solo para localhost), sin query ni hash, sin barra final. null si no es válida. */
function urlBase(valor: string | undefined): string | null {
  if (!valor || !valor.trim()) return null;
  try {
    const u = new URL(valor.trim());
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && esLocal(u.hostname))) return null;
    if (u.search || u.hash || u.username || u.password) return null;
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/** Lee la cuenta de servicio sin reenviar jamás el texto del error de JSON.parse (podría citar el secreto). */
function cuentaServicio(valor: string | undefined, problemas: string[]): CuentaServicio | null {
  if (!valor || !valor.trim()) { problemas.push('Falta FIREBASE_SERVICE_ACCOUNT (JSON de la cuenta de servicio de club-dermalysse).'); return null; }
  let json: Record<string, unknown>;
  try {
    const crudo = JSON.parse(valor) as unknown;
    if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) throw new Error('no es objeto');
    json = crudo as Record<string, unknown>;
  } catch {
    problemas.push('FIREBASE_SERVICE_ACCOUNT no es un JSON válido (pega el archivo de la cuenta de servicio completo, en una línea).');
    return null;
  }
  const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = json;
  if (typeof projectId !== 'string' || typeof clientEmail !== 'string' || typeof privateKey !== 'string' || !projectId || !clientEmail || !privateKey) {
    problemas.push('FIREBASE_SERVICE_ACCOUNT no trae project_id, client_email y private_key.');
    return null;
  }
  if (projectId !== PROYECTO_FIREBASE) {
    problemas.push(`FIREBASE_SERVICE_ACCOUNT pertenece a otro proyecto de Firebase (se espera ${PROYECTO_FIREBASE}).`);
    return null;
  }
  // Algunos paneles guardan los saltos de línea de la llave como "\n" literal.
  return { projectId, clientEmail, privateKey: privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey };
}

export function leerConfig(env: NodeJS.ProcessEnv): ConfigApi {
  const problemas: string[] = [];
  const authCrudo = (env.AUTH_MODE || 'dev').trim();
  const datosCrudo = (env.DATA_MODE || 'memoria').trim();
  if (authCrudo !== 'dev' && authCrudo !== 'firebase') problemas.push('AUTH_MODE debe ser "dev" o "firebase".');
  if (datosCrudo !== 'memoria' && datosCrudo !== 'firestore') problemas.push('DATA_MODE debe ser "memoria" o "firestore".');
  if (problemas.length) throw new ErrorConfiguracion(problemas);
  const authMode = authCrudo as ModoAuth;
  const dataMode = datosCrudo as ModoDatos;

  if ((authMode === 'firebase') !== (dataMode === 'firestore')) {
    throw new ErrorConfiguracion([
      'AUTH_MODE y DATA_MODE deben ir juntos: "dev" + "memoria" (desarrollo) o "firebase" + "firestore" (producción).',
    ]);
  }

  const base = {
    authMode,
    dataMode,
    academiaMostrarBorradores: env.ACADEMIA_MOSTRAR_BORRADORES === 'true',
  };

  if (authMode === 'dev') {
    return { ...base, corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((o) => o.trim()).filter(Boolean) };
  }

  const cuenta = cuentaServicio(env.FIREBASE_SERVICE_ACCOUNT, problemas);
  const webhookUrl = urlBase(env.LEGACY_WEBHOOK_URL);
  if (!webhookUrl) problemas.push('Falta LEGACY_WEBHOOK_URL o no es una URL https válida (URL base del webhook actual, sin ruta de endpoint).');
  const appUrl = urlBase(env.APP_URL);
  if (!appUrl) problemas.push('Falta APP_URL o no es una URL https válida (URL pública del club nuevo; se usa para volver de Stripe).');
  const corsOrigins = (env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (!corsOrigins.length) problemas.push('Falta CORS_ORIGINS (orígenes del club nuevo separados por coma).');
  if (base.academiaMostrarBorradores) problemas.push('ACADEMIA_MOSTRAR_BORRADORES=true solo se permite en desarrollo (mostraría borradores a todos los miembros).');
  let webhookTimeoutMs = 15000;
  if (env.LEGACY_WEBHOOK_TIMEOUT_MS) {
    webhookTimeoutMs = Number(env.LEGACY_WEBHOOK_TIMEOUT_MS);
    if (!Number.isInteger(webhookTimeoutMs) || webhookTimeoutMs < 1000 || webhookTimeoutMs > 60000) {
      problemas.push('LEGACY_WEBHOOK_TIMEOUT_MS debe ser un entero entre 1000 y 60000.');
    }
  }
  if (problemas.length || !cuenta || !webhookUrl || !appUrl) throw new ErrorConfiguracion(problemas);
  return { ...base, corsOrigins, produccion: { cuenta, webhookUrl, webhookTimeoutMs, appUrl } };
}
