// Adaptador de auth REAL (AUTH_MODE=firebase) sobre el proyecto club-dermalysse.
//  - verifica el ID token con revocación (verifyIdToken(token, true));
//  - esAdmin = existe admins/{uid} (no hay custom claims);
//  - esVip / plan / vence / motivo = regla de acceso del webhook (accessPolicy.ts) sobre users/{uid}.
// El cuerpo de la petición nunca decide nada de esto.
import type { AuthAdapter } from '../interfaces.js';
import type { FirestorePort } from '../firestore/port.js';
import { texto } from '../firestore/port.js';
import type { Usuario } from '../../domain/types.js';
import { resumenAcceso } from './accessPolicy.js';

export interface TokenDecodificado {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  /** Claim estándar del ID token de Firebase. */
  email_verified?: boolean;
}

export interface VerificadorIdToken {
  verifyIdToken(token: string, checkRevoked: boolean): Promise<TokenDecodificado>;
}

/** Errores de firebase-admin que significan "token no válido" (⇒ 401), no una falla del servicio. */
function esTokenInvalido(e: unknown): boolean {
  const code = String((e as { code?: unknown })?.code ?? (e as { errorInfo?: { code?: unknown } })?.errorInfo?.code ?? '');
  return code.startsWith('auth/') && code !== 'auth/internal-error';
}

export class FirebaseAuthAdapter implements AuthAdapter {
  readonly modo = 'firebase';

  constructor(
    private readonly verificador: VerificadorIdToken,
    private readonly db: FirestorePort,
    private readonly ahora: () => number = () => Date.now(),
  ) {}

  async verificar(token: string): Promise<Usuario | null> {
    if (!token || !token.trim()) return null;
    let decodificado: TokenDecodificado;
    try {
      decodificado = await this.verificador.verifyIdToken(token, true);
    } catch (e) {
      if (esTokenInvalido(e)) return null; // vencido, revocado, mal formado, cuenta deshabilitada…
      throw e; // falla de red/servicio ⇒ 500 honesto, nunca un usuario inventado
    }
    const uid = decodificado.uid;
    const [admin, user] = await Promise.all([this.db.get(`admins/${uid}`), this.db.get(`users/${uid}`)]);
    const datos = user.data() ?? {};
    const acceso = resumenAcceso(datos, this.ahora());
    const email = decodificado.email || texto(datos.email);
    const nombreDoc = [texto(datos.name), texto(datos.lastname)].filter(Boolean).join(' ').trim();
    return {
      uid,
      email,
      esAdmin: admin.exists,
      esVip: acceso.esVip,
      emailVerificado: decodificado.email_verified === true,
      nombre: nombreDoc || decodificado.name || email.split('@')[0] || 'Miembro',
      acceso: { plan: acceso.plan, vence: acceso.vence, motivo: acceso.motivo },
      cuenta: { nombre: decodificado.name || '', foto: decodificado.picture || '' },
      cursoGratis: texto(datos.cursoGratis) || undefined,
    };
  }
}
