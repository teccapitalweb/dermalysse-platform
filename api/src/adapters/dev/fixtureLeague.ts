// Liga en modo DEV: lee api/fixtures/league.json. Datos NO productivos.
import { readFileSync } from 'node:fs';
import type { LeagueStore } from '../interfaces.js';
import type { FilaLiga, ResumenLiga } from '../../domain/types.js';

interface LeagueFixture { actualizado: string; filas: FilaLiga[]; }

export class FixtureLeagueStore implements LeagueStore {
  private readonly data: LeagueFixture;

  constructor() {
    const url = new URL('../../../fixtures/league.json', import.meta.url);
    this.data = JSON.parse(readFileSync(url, 'utf8')) as LeagueFixture;
  }

  async filas(): Promise<FilaLiga[]> {
    return this.data.filas.map((f) => ({ ...f, esYo: false }));
  }

  async resumen(filas: FilaLiga[]): Promise<ResumenLiga> {
    return {
      actualizado: this.data.actualizado,
      participantes: filas.length,
      clasificacion: filas,
      yo: filas.find((f) => f.esYo) ?? null,
      esDemo: false, // dato de la API (fixture no productivo), no la semilla demo local del cliente
    };
  }
}
