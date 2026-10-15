// Contenido de la Academia leído del disco (api/content/academia): catalogo.json y
// <programa>/modulo-NN.json. Solo lectura; lo ya leído se conserva en memoria.
// - Un archivo que falta o que todavía no es JSON válido (alguien lo está escribiendo) cuenta como
//   «en preparación» y se reintenta en la siguiente lectura: no se guarda en caché.
// - Los ids de programa se validan antes de tocar el disco (sin "..", sin carpetas que empiecen con "_").
import { existsSync, readFileSync } from 'node:fs';
import type { AcademiaContentStore } from '../interfaces.js';
import type { CatalogoAcademia, ModuloAcademia, ProgramaAcademia } from '../../domain/types.js';

export const CONTENIDO_ACADEMIA = new URL('../../../content/academia/', import.meta.url);

const ID_PROGRAMA = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const programaValido = (id: unknown): id is string => typeof id === 'string' && ID_PROGRAMA.test(id);
export const nn = (n: number) => String(n).padStart(2, '0');

export class DiskAcademiaContentStore implements AcademiaContentStore {
  private readonly cache = new Map<string, unknown>();

  constructor(private readonly base: URL = CONTENIDO_ACADEMIA) {}

  private leer<T>(ruta: string): T | null {
    if (this.cache.has(ruta)) return this.cache.get(ruta) as T;
    const url = new URL(ruta, this.base);
    if (!existsSync(url)) return null;
    try {
      const valor = JSON.parse(readFileSync(url, 'utf8')) as T;
      this.cache.set(ruta, valor);
      return valor;
    } catch {
      return null; // archivo a medio escribir o inválido: honesto, en preparación
    }
  }

  async catalogo(): Promise<CatalogoAcademia> {
    const c = this.leer<CatalogoAcademia>('catalogo.json');
    const programas = Array.isArray(c?.programas)
      ? c.programas.filter((p): p is ProgramaAcademia => programaValido(p?.id) && Array.isArray(p.modulos))
      : [];
    return { ...(c ?? {}), programas };
  }

  async modulo(programa: string, n: number): Promise<ModuloAcademia | null> {
    if (!programaValido(programa) || !Number.isInteger(n) || n < 1 || n > 99) return null;
    return this.leer<ModuloAcademia>(`${programa}/modulo-${nn(n)}.json`);
  }
}
