// Avance del Modo Historia en MEMORIA (modo dev). Arranca vacío; no persiste.
import type { HistoriaStore } from '../interfaces.js';
import type { ProgresoHistoria } from '../../domain/types.js';
import { fusionarHistoria, historiaVacia } from '../../services/historia.js';

export class MemoryHistoriaStore implements HistoriaStore {
  private readonly datos = new Map<string, ProgresoHistoria>();

  async get(uid: string): Promise<ProgresoHistoria> {
    return structuredClone(this.datos.get(uid) ?? historiaVacia());
  }

  async fusionar(uid: string, entrada: ProgresoHistoria): Promise<ProgresoHistoria> {
    const siguiente = fusionarHistoria(this.datos.get(uid) ?? historiaVacia(), entrada);
    this.datos.set(uid, siguiente);
    return structuredClone(siguiente);
  }
}
