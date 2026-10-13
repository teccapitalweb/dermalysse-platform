// Perfil por usuario en MEMORIA (modo dev). Solo el propio uid; no persiste en disco.
import type { ProfileStore } from '../interfaces.js';
import type { PerfilData, PerfilRemoto } from '../../domain/types.js';

const vacio = (nombre: string): PerfilData => ({ nombre, foto: '', whatsapp: '', especialidad: '', ciudad: '' });

export class MemoryProfileStore implements ProfileStore {
  private readonly porUid = new Map<string, PerfilData>();

  async get(uid: string, nombrePorDefecto: string): Promise<PerfilData> {
    return { ...(this.porUid.get(uid) ?? vacio(nombrePorDefecto)) };
  }

  async patch(uid: string, cambios: Partial<PerfilData>, nombrePorDefecto: string): Promise<PerfilRemoto> {
    const actual = this.porUid.get(uid) ?? vacio(nombrePorDefecto);
    const siguiente: PerfilData = { ...actual, ...cambios };
    this.porUid.set(uid, siguiente);
    return { ...siguiente };
  }
}
