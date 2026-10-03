// Logros, racha semanal y puntos calculados del progreso real.
import { cursos } from './catalogo';
import { Progreso } from './progreso';
import { Comunidad } from './comunidad';

export interface Logro { id: string; titulo: string; desc: string; icon: string; cat: string; ok: boolean; progreso?: string }

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
    { id: 'primer-paso', titulo: 'Primer paso', desc: 'Completaste tu primera clase', icon: 'footprints', cat: 'Constancia', ok: vistas >= 1, progreso: `${Math.min(vistas, 1)}/1` },
    { id: 'en-marcha', titulo: 'En marcha', desc: '5 clases vistas', icon: 'play', cat: 'Constancia', ok: vistas >= 5, progreso: `${Math.min(vistas, 5)}/5` },
    { id: 'constante', titulo: 'Constante', desc: '3 semanas seguidas estudiando', icon: 'flame', cat: 'Constancia', ok: r >= 3, progreso: `${Math.min(r, 3)}/3` },
    { id: 'imparable', titulo: 'Imparable', desc: '8 semanas seguidas', icon: 'zap', cat: 'Constancia', ok: r >= 8, progreso: `${Math.min(r, 8)}/8` },
    { id: 'certificado', titulo: 'Certificado', desc: 'Termina tu primer curso', icon: 'award', cat: 'Clínica', ok: completos >= 1, progreso: `${Math.min(completos, 1)}/1` },
    { id: 'especialista', titulo: 'Especialista', desc: '3 cursos certificados', icon: 'badge-check', cat: 'Clínica', ok: completos >= 3, progreso: `${Math.min(completos, 3)}/3` },
    { id: 'multidisciplinar', titulo: 'Multidisciplinar', desc: 'Cursos completados en 3 áreas distintas', icon: 'layers', cat: 'Especialización', ok: areas >= 3, progreso: `${Math.min(areas, 3)}/3` },
    { id: 'maestro', titulo: 'Maestro Dermalysse', desc: '10 cursos certificados', icon: 'crown', cat: 'Maestría', ok: completos >= 10, progreso: `${Math.min(completos, 10)}/10` },
    { id: 'voz', titulo: 'Voz de la comunidad', desc: 'Abre tu primer tema en Comunidad', icon: 'message-circle', cat: 'Comunidad', ok: hilos >= 1, progreso: `${Math.min(hilos, 1)}/1` },
    { id: 'coleccionista', titulo: 'Coleccionista', desc: `Todos los cursos del catálogo (${cursos.length})`, icon: 'library', cat: 'Maestría', ok: completos >= cursos.length, progreso: `${completos}/${cursos.length}` },
  ];
}
