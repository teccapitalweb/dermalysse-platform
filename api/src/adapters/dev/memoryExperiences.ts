// Almacén del Directorio de experiencias en MEMORIA (modo dev). No persiste en disco ni en base real.
// Arranca vacío: el estado vacío es honesto, no se siembran datos demo.
import type { ExperienceStore, FiltroExperiencias } from '../interfaces.js';
import type { EstadoExperiencia, ExperienciaCompartida, ExperienciaModerada, ExperienciaPropia } from '../../domain/types.js';

export class MemoryExperienceStore implements ExperienceStore {
  private readonly datos: ExperienciaModerada[] = [];

  async listar(filtro: FiltroExperiencias): Promise<ExperienciaCompartida[]> {
    const q = (filtro.q || '').trim().toLocaleLowerCase('es-MX');
    const categoria = filtro.categoria;
    return this.datos
      .filter((e) => e.estado === 'aprobada')
      .filter((e) => (!categoria || categoria === 'todas' ? true : e.categoria === categoria))
      .filter((e) => (!q ? true : `${e.titulo} ${e.texto} ${e.autor}`.toLocaleLowerCase('es-MX').includes(q)))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map(({ autorUid: _uid, revisorUid: _revisor, revisadaEn: _revisada, estado: _estado, ...exp }) => exp);
  }

  async propias(uid: string): Promise<ExperienciaPropia[]> {
    return this.datos.filter((e) => e.autorUid === uid).map(({ autorUid: _uid, revisorUid: _revisor, ...e }) => ({ ...e }));
  }

  async pendientes(): Promise<ExperienciaModerada[]> {
    return this.datos.filter((e) => e.estado === 'pendiente').map((e) => ({ ...e }));
  }

  async crear(exp: ExperienciaModerada): Promise<ExperienciaModerada> {
    this.datos.unshift(exp);
    return { ...exp };
  }

  async revisar(id: string, estado: Exclude<EstadoExperiencia, 'pendiente'>, revisorUid: string): Promise<ExperienciaModerada | null> {
    const exp = this.datos.find((e) => e.id === id);
    if (!exp) return null;
    exp.estado = estado;
    exp.revisadaEn = new Date().toISOString();
    exp.revisorUid = revisorUid;
    return { ...exp };
  }
}
