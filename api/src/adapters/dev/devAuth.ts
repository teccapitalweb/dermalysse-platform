// Adaptador de auth en modo DEV. Cualquier token Bearer no vacío resuelve a un usuario de desarrollo.
// Es SOLO para desarrollo local: no valida nada criptográficamente. El usuario y sus privilegios
// (esVip/esAdmin) los decide el servidor, nunca el cuerpo de la petición.
import type { AuthAdapter } from '../interfaces.js';
import type { Usuario } from '../../domain/types.js';

const USUARIO_DEV: Usuario = {
  uid: 'dev-uid',
  email: 'dev@local',
  esVip: true,
  esAdmin: false,
  nombre: 'Usuario Demo (dev)',
};

export class DevAuthAdapter implements AuthAdapter {
  readonly modo = 'dev';
  async verificar(token: string): Promise<Usuario | null> {
    if (!token || !token.trim()) return null;
    return { ...USUARIO_DEV };
  }
}
