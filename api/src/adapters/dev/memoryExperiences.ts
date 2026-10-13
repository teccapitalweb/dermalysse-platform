// Almacén del Directorio de experiencias en MEMORIA (modo dev). No persiste en disco ni en base real.
// Arranca vacío: el estado vacío es honesto, no se siembran datos demo.
import type { ExperienceStore, FiltroExperiencias } from '../interfaces.js';
import type { ExperienciaCompartida } from '../../domain/types.js';

export class MemoryExperienceStore implements ExperienceStore {
  private readonly datos: ExperienciaCompartida[] = [];

  async listar(filtro: FiltroExperiencias): Promise<ExperienciaCompartida[]> {
    const q = (filtro.q || '').trim().toLocaleLowerCase('es-MX');
    const categoria = filtro.categoria;
    return this.datos
      .filter((e) => (!categoria || categoria === 'todas' ? true : e.categoria === categoria))
      .filter((e) => (!q ? true : `${e.titulo} ${e.texto} ${e.autor}`.toLocaleLowerCase('es-MX').includes(q)))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  async crear(exp: ExperienciaCompartida): Promise<ExperienciaCompartida> {
    this.datos.unshift(exp);
    return exp;
  }
}
