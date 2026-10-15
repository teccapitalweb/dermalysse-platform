// Foro en MEMORIA (modo dev), sembrado desde api/fixtures/foro.json. Permite escritura.
// El servidor asigna id/autor/fecha; "útil" se registra por uid (sin duplicar).
import { readFileSync } from 'node:fs';
import type { ForumStore } from '../interfaces.js';
import type { DetalleRemoto, HiloRemoto, RespuestaForo } from '../../domain/types.js';

interface Entrada { hilo: HiloRemoto; respuestas: RespuestaForo[]; utilPor: Set<string>; }

export class MemoryForumStore implements ForumStore {
  private readonly entradas: Entrada[];

  constructor() {
    const url = new URL('../../../fixtures/foro.json', import.meta.url);
    const raw = JSON.parse(readFileSync(url, 'utf8')) as DetalleRemoto[];
    this.entradas = raw.map((d) => ({
      hilo: { ...d.hilo, respuestas: d.respuestas.length },
      respuestas: [...d.respuestas],
      utilPor: new Set<string>(),
    }));
  }

  private visible(e: Entrada): boolean { return !e.hilo.oculto; }

  async listar(): Promise<HiloRemoto[]> {
    return this.entradas
      .filter((e) => this.visible(e))
      .map((e) => ({ ...e.hilo, respuestas: e.respuestas.length }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  async detalle(id: string): Promise<DetalleRemoto | null> {
    const e = this.entradas.find((x) => x.hilo.id === id);
    if (!e || !this.visible(e)) return null;
    return { hilo: { ...e.hilo, respuestas: e.respuestas.length }, respuestas: [...e.respuestas] };
  }

  async crearHilo(hilo: HiloRemoto, _autorUid: string): Promise<HiloRemoto> {
    this.entradas.unshift({ hilo: { ...hilo, respuestas: 0 }, respuestas: [], utilPor: new Set() });
    return { ...hilo, respuestas: 0 };
  }

  async agregarRespuesta(id: string, respuesta: RespuestaForo, _autorUid: string): Promise<RespuestaForo | null> {
    const e = this.entradas.find((x) => x.hilo.id === id);
    if (!e || !this.visible(e)) return null;
    e.respuestas.push(respuesta);
    e.hilo.respuestas = e.respuestas.length;
    return respuesta;
  }

  async alternarUtil(id: string, uid: string): Promise<{ util: number; marcadoUtil: boolean } | null> {
    const e = this.entradas.find((x) => x.hilo.id === id);
    if (!e || !this.visible(e)) return null;
    const marcadoAntes = e.utilPor.has(uid);
    if (marcadoAntes) e.utilPor.delete(uid); else e.utilPor.add(uid);
    // Conteo expuesto = base del fixture + votos de usuarios registrados en memoria.
    const util = (e.hilo.util ?? 0) + e.utilPor.size;
    return { util, marcadoUtil: !marcadoAntes };
  }
}
