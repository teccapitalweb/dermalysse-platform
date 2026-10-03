import { Datos, type Pregunta } from './datos';
import { curso as getCurso } from './catalogo';

const KEY = 'dermalysse:examen-final:v1';

export interface ResultadoExamen {
  intentos: number;
  mejor: number;
  aprobado: boolean;
  ultimaFecha: string;
  recompensaEntregada: boolean;
}

export interface PreguntaExamen extends Pregunta {
  claseN: number;
  claseTitulo: string;
}

const vacio = (): ResultadoExamen => ({
  intentos: 0, mejor: 0, aprobado: false, ultimaFecha: '', recompensaEntregada: false,
});

function leerTodo(): Record<string, ResultadoExamen> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function resultadoExamen(cursoId: string): ResultadoExamen {
  return leerTodo()[cursoId] || vacio();
}

export function examenAprobado(cursoId: string): boolean {
  return resultadoExamen(cursoId).aprobado;
}

export function registrarIntentoExamen(cursoId: string, aciertos: number, total: number) {
  const all = leerTodo();
  const anterior = all[cursoId] || vacio();
  const porcentaje = total ? Math.round((aciertos / total) * 100) : 0;
  const aprobado = porcentaje >= 70;
  const primeraAprobacion = aprobado && !anterior.recompensaEntregada;
  const registro = {
    intentos: anterior.intentos + 1,
    mejor: Math.max(anterior.mejor, porcentaje),
    aprobado: anterior.aprobado || aprobado,
    ultimaFecha: new Date().toISOString(),
    recompensaEntregada: anterior.recompensaEntregada || aprobado,
    porcentaje,
    primeraAprobacion,
  };
  all[cursoId] = registro;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
  return registro;
}

let _preguntas: PreguntaExamen[] = [];

export function generarExamen(cursoId: string, max = 10): PreguntaExamen[] {
  const curso = getCurso(cursoId);
  if (!curso) return (_preguntas = []);
  const quizzes = Datos.quizzes().filter((q) => q.cursoId === cursoId && q.estado === 'aprobado');
  const todas: PreguntaExamen[] = [];
  for (const quiz of quizzes) {
    const clase = curso.clases.find((k) => k.n === quiz.n);
    for (const p of quiz.preguntas) todas.push({ ...p, claseN: quiz.n, claseTitulo: clase?.titulo || `Clase ${quiz.n}` });
  }
  for (let i = todas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [todas[i], todas[j]] = [todas[j], todas[i]];
  }
  return (_preguntas = todas.slice(0, Math.min(max, todas.length)));
}

export function preguntaExamenActual(idx: number): PreguntaExamen | undefined {
  return _preguntas[idx];
}
