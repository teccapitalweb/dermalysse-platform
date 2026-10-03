// Historial local de los quizzes de clase. Mantiene compatibilidad con el
// formato anterior para no perder resultados de miembros existentes.
const KEY = 'dermalysse:intentos:v1';

export interface ResumenQuiz {
  intentos: number;
  mejor: number;
  aprobado: boolean;
  ultimaFecha: string;
}

interface RegistroQuiz extends ResumenQuiz {
  ultimoAciertos: number;
  total: number;
  recompensaEntregada: boolean;
}

const vacio = (): RegistroQuiz => ({
  intentos: 0,
  mejor: 0,
  aprobado: false,
  ultimaFecha: '',
  ultimoAciertos: 0,
  total: 0,
  recompensaEntregada: false,
});

function leerTodo(): Record<string, Partial<RegistroQuiz> & { ok?: number; fecha?: string }> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

function normalizar(raw?: Partial<RegistroQuiz> & { ok?: number; fecha?: string }): RegistroQuiz {
  if (!raw) return vacio();
  const total = Number(raw.total) || 0;
  const aciertos = Number(raw.ultimoAciertos ?? raw.ok) || 0;
  const mejorAnterior = Number(raw.mejor);
  const mejor = Number.isFinite(mejorAnterior) && mejorAnterior > 0
    ? mejorAnterior
    : total ? Math.round((aciertos / total) * 100) : 0;
  return {
    intentos: Number(raw.intentos) || (raw.fecha || raw.ultimaFecha ? 1 : 0),
    mejor,
    aprobado: Boolean(raw.aprobado),
    ultimaFecha: String(raw.ultimaFecha || raw.fecha || ''),
    ultimoAciertos: aciertos,
    total,
    recompensaEntregada: Boolean(raw.recompensaEntregada || raw.aprobado),
  };
}

export function claveQuiz(cursoId: string, n: number) { return `${cursoId}_${n}`; }

export function resumenQuiz(cursoId: string, n: number): ResumenQuiz {
  const r = normalizar(leerTodo()[claveQuiz(cursoId, n)]);
  return { intentos: r.intentos, mejor: r.mejor, aprobado: r.aprobado, ultimaFecha: r.ultimaFecha };
}

export function registrarIntentoQuiz(cursoId: string, n: number, aciertos: number, total: number) {
  const all = leerTodo();
  const key = claveQuiz(cursoId, n);
  const anterior = normalizar(all[key]);
  const porcentaje = total ? Math.round((aciertos / total) * 100) : 0;
  const aprobado = porcentaje >= 70;
  const primeraAprobacion = aprobado && !anterior.recompensaEntregada;
  const registro: RegistroQuiz = {
    intentos: anterior.intentos + 1,
    mejor: Math.max(anterior.mejor, porcentaje),
    aprobado: anterior.aprobado || aprobado,
    ultimaFecha: new Date().toISOString(),
    ultimoAciertos: aciertos,
    total,
    recompensaEntregada: anterior.recompensaEntregada || aprobado,
  };
  all[key] = registro;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
  return { ...registro, porcentaje, aprobado, primeraAprobacion };
}
