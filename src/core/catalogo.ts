// Vista del catálogo para miembros: solo cursos publicados, en orden. Se recarga cuando el admin cambia algo.
import { Datos, type Curso, type Clase } from './datos';
export type { Curso, Clase };

export const LIBRARY_ID: string = Datos.libraryId;
export const cursos: Curso[] = [];
export const areas: string[] = [];

export function recargarCatalogo() {
  const publicados = Datos.cursos().filter((c) => c.publicado !== false);
  cursos.splice(0, cursos.length, ...publicados);
  areas.splice(0, areas.length, ...[...new Set(publicados.map((c) => c.area))].sort((a, b) => a.localeCompare(b, 'es')));
}
recargarCatalogo();
window.addEventListener('datos:cambio', recargarCatalogo);

export const curso = (id: string) => cursos.find((c) => c.id === id);
export const buscar = (q: string) => {
  const n = q.trim().toLowerCase();
  if (!n) return cursos;
  return cursos.filter((c) => (c.titulo + ' ' + c.area + ' ' + c.instructor).toLowerCase().includes(n));
};
export const duracionCurso = (c: Curso) => {
  const min = c.clases.reduce((a, k) => a + (k.duracion ?? 0), 0);
  return min ? fmtMin(min) : `${c.clases.length} clases`;
};
export const fmtMin = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`);
