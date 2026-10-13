// Progreso por usuario en MEMORIA (modo dev). No persiste en disco ni base real.
// El servidor es la autoridad: solo `acreditar` cambia el estado; el cuerpo de la petición no.
import type { ProgressStore } from '../interfaces.js';
import type { ProgresoCurso, ProgresoMapa } from '../../domain/types.js';

const vacio = (): ProgresoCurso => ({ vistas: [], ultima: 0, actualizado: '' });

export class MemoryProgressStore implements ProgressStore {
  private readonly porUsuario = new Map<string, ProgresoMapa>();

  private mapa(uid: string): ProgresoMapa {
    let m = this.porUsuario.get(uid);
    if (!m) { m = {}; this.porUsuario.set(uid, m); }
    return m;
  }

  async del(uid: string): Promise<ProgresoMapa> {
    // Copia defensiva para que nadie mute el estado interno desde fuera.
    return structuredClone(this.mapa(uid));
  }

  async curso(uid: string, cursoId: string): Promise<ProgresoCurso> {
    return structuredClone(this.mapa(uid)[cursoId] ?? vacio());
  }

  async acreditar(uid: string, cursoId: string, n: number): Promise<ProgresoCurso> {
    const mapa = this.mapa(uid);
    const actual = mapa[cursoId] ?? vacio();
    const vistas = actual.vistas.includes(n) ? actual.vistas : [...actual.vistas, n].sort((a, b) => a - b);
    const siguiente: ProgresoCurso = { vistas, ultima: n, actualizado: new Date().toISOString() };
    mapa[cursoId] = siguiente;
    return structuredClone(siguiente);
  }
}
