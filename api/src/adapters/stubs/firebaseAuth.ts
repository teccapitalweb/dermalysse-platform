// Seam del adaptador de auth REAL (Firebase Admin). NO implementado en este slice.
// Cuando AUTH_MODE=firebase, requiere un service account provisto por entorno del servidor
// (FIREBASE_SERVICE_ACCOUNT) para verificar el ID token. No se cablea con credenciales aquí.
import { NotImplementedError, type AuthAdapter } from '../interfaces.js';
import type { Usuario } from '../../domain/types.js';

export class FirebaseAuthAdapter implements AuthAdapter {
  readonly modo = 'firebase';
  async verificar(_token: string): Promise<Usuario | null> {
    throw new NotImplementedError(
      'verificación de Firebase ID token. Configura FIREBASE_SERVICE_ACCOUNT por entorno e implementa el verificador con firebase-admin.',
    );
  }
}
