// Perfil por usuario en MEMORIA (modo dev). Solo el propio uid; no persiste en disco.
import type { ProfileStore } from '../interfaces.js';
import type { PerfilData, PerfilRemoto, Usuario } from '../../domain/types.js';
import { sanitizarPerfil } from '../../services/community.js';

const vacio = (nombre: string): PerfilData => ({ nombre, foto: '', whatsapp: '', especialidad: '', ciudad: '' });

export class MemoryProfileStore implements ProfileStore {
  private readonly porUid = new Map<string, PerfilData>();

  async get(usuario: Usuario): Promise<PerfilRemoto> {
    return { ...(this.porUid.get(usuario.uid) ?? vacio(usuario.nombre)) };
  }

  async patch(usuario: Usuario, cuerpo: Record<string, unknown>): Promise<PerfilRemoto> {
    const actual = this.porUid.get(usuario.uid) ?? vacio(usuario.nombre);
    const siguiente: PerfilData = { ...actual, ...sanitizarPerfil(cuerpo) };
    this.porUid.set(usuario.uid, siguiente);
    return { ...siguiente };
  }
}
