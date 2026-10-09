// Logros, racha semanal y puntos calculados del progreso real.
import { cursos } from './catalogo';
import { Progreso } from './progreso';
import { Comunidad } from './comunidad';

export type RarezaLogro = 'Esencial' | 'Avanzado' | 'Distintivo';

export interface Logro {
  id: string;
  titulo: string;
  desc: string;
  icon: string;
  cat: string;
  ok: boolean;
  actual: number;
  meta: number;
  rareza: RarezaLogro;
  progreso: string;
}

export function puntos() {
  return Progreso.totalVistas() * 10 + Progreso.completados().length * 50 + Comunidad.misHilos().length * 5;
}

// Semanas consecutivas (hasta hoy) con al menos una clase vista
export function racha() {
  const fechas = Progreso.fechas().map((f) => new Date(f));
  const semana = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); };
  const set = new Set(fechas.map(semana));
  let n = 0; let s = semana(new Date());
  while (set.has(s)) { n++; s -= 7 * 86400000; }
  const diasSemana = [1, 2, 3, 4, 5, 6, 0].map((dow) => fechas.some((f) => f.getDay() === dow && semana(f) === semana(new Date())));
  return { semanas: n, dias: diasSemana, activaEstaSemana: set.has(semana(new Date())) };
}

export function logros(): Logro[] {
  const vistas = Progreso.totalVistas();
  const completos = Progreso.completados().length;
  const r = racha().semanas;
  const hilos = Comunidad.misHilos().length;
  const areas = new Set(Progreso.completados().map((c) => c.area)).size;
  return [
    { id: 'primer-paso', titulo: 'Primer paso', desc: 'Completa tu primera clase', icon: 'footprints', cat: 'Constancia', ok: vistas >= 1, actual: vistas, meta: 1, rareza: 'Esencial', progreso: `${Math.min(vistas, 1)}/1` },
    { id: 'en-marcha', titulo: 'En marcha', desc: 'Completa 5 clases', icon: 'play', cat: 'Constancia', ok: vistas >= 5, actual: vistas, meta: 5, rareza: 'Esencial', progreso: `${Math.min(vistas, 5)}/5` },
    { id: 'constante', titulo: 'Constante', desc: 'Estudia durante 3 semanas consecutivas', icon: 'flame', cat: 'Constancia', ok: r >= 3, actual: r, meta: 3, rareza: 'Avanzado', progreso: `${Math.min(r, 3)}/3` },
    { id: 'imparable', titulo: 'Imparable', desc: 'Mantén una racha de 8 semanas', icon: 'zap', cat: 'Constancia', ok: r >= 8, actual: r, meta: 8, rareza: 'Distintivo', progreso: `${Math.min(r, 8)}/8` },
    { id: 'certificado', titulo: 'Primera credencial', desc: 'Completa tu primer curso', icon: 'award', cat: 'Formación', ok: completos >= 1, actual: completos, meta: 1, rareza: 'Esencial', progreso: `${Math.min(completos, 1)}/1` },
    { id: 'especialista', titulo: 'Especialista', desc: 'Completa 3 cursos', icon: 'badge-check', cat: 'Formación', ok: completos >= 3, actual: completos, meta: 3, rareza: 'Avanzado', progreso: `${Math.min(completos, 3)}/3` },
    { id: 'multidisciplinar', titulo: 'Mirada multidisciplinar', desc: 'Completa cursos de 3 áreas distintas', icon: 'layers-3', cat: 'Formación', ok: areas >= 3, actual: areas, meta: 3, rareza: 'Avanzado', progreso: `${Math.min(areas, 3)}/3` },
    { id: 'maestro', titulo: 'Maestro Dermalysse', desc: 'Completa 10 cursos', icon: 'crown', cat: 'Maestría', ok: completos >= 10, actual: completos, meta: 10, rareza: 'Distintivo', progreso: `${Math.min(completos, 10)}/10` },
    { id: 'voz', titulo: 'Voz de la comunidad', desc: 'Publica tu primer tema', icon: 'message-circle', cat: 'Comunidad', ok: hilos >= 1, actual: hilos, meta: 1, rareza: 'Esencial', progreso: `${Math.min(hilos, 1)}/1` },
    { id: 'coleccionista', titulo: 'Colección completa', desc: `Completa los ${cursos.length} cursos del catálogo`, icon: 'library', cat: 'Maestría', ok: completos >= cursos.length, actual: completos, meta: cursos.length, rareza: 'Distintivo', progreso: `${Math.min(completos, cursos.length)}/${cursos.length}` },
  ];
}
