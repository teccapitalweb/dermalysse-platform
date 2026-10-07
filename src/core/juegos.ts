// Motor de "Retos" (arcade): XP, niveles, racha diaria, repetición espaciada,
// mazo de flashcards y banco de preguntas — TODO alimentado por el contenido real
// de los cursos (quizzes y notas). En modo demo el progreso vive en localStorage.
import { Datos } from './datos';
import { cursos, curso as getCurso } from './catalogo';
import { puntos as puntosProgreso } from './logros';
import { esc } from '../ui/partials';
import casosSeed from '../data/casos.json';

const KEY = 'dermalysse:retos:v1';

interface SR { due: string; reps: number } // repetición espaciada por tarjeta
interface Estado {
  xp: number;                       // XP ganado en juegos (se suma al de progreso)
  quizBest: number;                 // mejor puntaje en Quiz Relámpago
  casos: Record<string, boolean>;   // casos resueltos correctamente
  sr: Record<string, SR>;           // estado de repetición espaciada de cada flashcard
  diaria: { fecha: string; racha: number }; // reto diario
}

const HOY = () => new Date().toISOString().slice(0, 10);
const clon = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function leer(): Estado {
  const def: Estado = { xp: 0, quizBest: 0, casos: {}, sr: {}, diaria: { fecha: '', racha: 0 } };
  try { return { ...def, ...(JSON.parse(localStorage.getItem(KEY) || '{}')) }; } catch { return clon(def); }
}
function guardar(e: Estado) {
  try { localStorage.setItem(KEY, JSON.stringify(e)); } catch {}
  window.dispatchEvent(new CustomEvent('retos:cambio'));
}

// ── Niveles (XP total = progreso real + XP de juegos) ──
export const NIVELES = [
  { nombre: 'Aprendiz', min: 0, icon: 'sprout', color: '#8a94b3' },
  { nombre: 'Bronce', min: 200, icon: 'medal', color: '#c98a5b' },
  { nombre: 'Plata', min: 600, icon: 'award', color: '#9aa7bd' },
  { nombre: 'Oro', min: 1400, icon: 'trophy', color: '#e0b341' },
  { nombre: 'Platino', min: 3000, icon: 'gem', color: '#4fa899' },
  { nombre: 'Maestro Dermalysse', min: 6000, icon: 'crown', color: '#4a7fc1' },
] as const;

export const xpTotal = () => puntosProgreso() + leer().xp;

export function nivel() {
  const xp = xpTotal();
  let i = 0;
  for (let j = 0; j < NIVELES.length; j++) if (xp >= NIVELES[j].min) i = j;
  const actual = NIVELES[i];
  const sig = NIVELES[i + 1];
  const pct = sig ? Math.round(((xp - actual.min) / (sig.min - actual.min)) * 100) : 100;
  return { ...actual, indice: i, xp, siguiente: sig || null, faltan: sig ? sig.min - xp : 0, pct };
}

export function ganarXP(n: number) { const e = leer(); e.xp += n; guardar(e); }

// ── Reto diario (mantiene una racha) ──
export function retoDiario() {
  const e = leer();
  const hoy = HOY();
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const hechoHoy = e.diaria.fecha === hoy;
  const racha = e.diaria.fecha === hoy || e.diaria.fecha === ayer ? e.diaria.racha : 0;
  // pregunta del día: determinística por fecha
  const banco = bancoPreguntas();
  const idx = banco.length ? hashFecha(hoy) % banco.length : 0;
  return { hechoHoy, racha, pregunta: banco[idx] || null };
}
export function completarDiaria(acierto: boolean) {
  const e = leer(); const hoy = HOY();
  if (e.diaria.fecha === hoy) return leer().diaria; // ya se hizo
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  e.diaria.racha = (e.diaria.fecha === ayer ? e.diaria.racha : 0) + 1;
  e.diaria.fecha = hoy;
  e.xp += acierto ? 30 : 10;
  guardar(e);
  return e.diaria;
}
const hashFecha = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// ── Banco de preguntas (extraído de los quizzes reales de los cursos) ──
export interface Pregunta { id: string; curso: string; area: string; q: string; opciones: string[]; correcta: number; explicacion: string }

export function bancoPreguntas(): Pregunta[] {
  const out: Pregunta[] = [];
  for (const qz of Datos.quizzes()) {
    const c = getCurso(qz.cursoId);
    qz.preguntas.forEach((p, i) => out.push({
      id: `${qz.id}#${i}`, curso: c?.titulo || qz.cursoId, area: c?.area || 'General',
      q: p.q, opciones: p.opciones, correcta: p.correcta, explicacion: p.explicacion,
    }));
  }
  return out;
}

// ── Flashcards (de los quizzes + notas de clase de los cursos) ──
export interface Flashcard { id: string; area: string; curso: string; frente: string; reverso: string }

export function mazoCompleto(): Flashcard[] {
  const cards: Flashcard[] = [];
  // 1) De cada pregunta de quiz: frente = pregunta, reverso = respuesta + explicación.
  //    El wrapper HTML es confiable; los valores dinámicos van escapados para evitar
  //    inyecciones en el modo API, donde los textos vienen del backend.
  for (const p of bancoPreguntas()) {
    cards.push({ id: 'q:' + p.id, area: p.area, curso: p.curso,
      frente: p.q, reverso: `<strong>${esc(p.opciones[p.correcta])}</strong><br>${esc(p.explicacion)}` });
  }
  // 2) De las notas de clase: concepto (con su marca de tiempo) como repaso.
  for (const c of cursos) {
    for (const k of c.clases) {
      if (!k.notas) continue;
      k.notas.conceptos?.forEach((x, i) => cards.push({
        id: `n:${c.id}:${k.n}:${i}`, area: c.area, curso: c.titulo,
        frente: `${x.texto}`, reverso: `<span class="faint">${esc(c.titulo)} · clase ${k.n} · ${esc(x.t)}</span>` }));
    }
  }
  return cards;
}

// Tarjetas "para hoy": vencidas por repetición espaciada + nuevas, mezcladas
export function mazoDeHoy(limite = 15): Flashcard[] {
  const e = leer(); const ahora = Date.now();
  const todas = mazoCompleto();
  const vencidas = todas.filter((c) => e.sr[c.id] && new Date(e.sr[c.id].due).getTime() <= ahora);
  const nuevas = todas.filter((c) => !e.sr[c.id]);
  return [...vencidas, ...nuevas].slice(0, limite);
}

export type TipoCarta = 'todas' | 'quiz' | 'concepto';

// Mazo temático: conserva el orden inteligente (vencidas primero, después nuevas)
// pero permite estudiar por área o por origen del contenido.
export function mazoFiltrado(area = 'Todas', tipo: TipoCarta = 'todas', limite = 15): Flashcard[] {
  const e = leer(); const ahora = Date.now();
  const coincide = (c: Flashcard) =>
    (area === 'Todas' || c.area === area) &&
    (tipo === 'todas' || (tipo === 'quiz' ? c.id.startsWith('q:') : c.id.startsWith('n:')));
  const todas = mazoCompleto().filter(coincide);
  const vencidas = todas.filter((c) => e.sr[c.id] && new Date(e.sr[c.id].due).getTime() <= ahora);
  const nuevas = todas.filter((c) => !e.sr[c.id]);
  const futuras = todas.filter((c) => e.sr[c.id] && new Date(e.sr[c.id].due).getTime() > ahora);
  return [...vencidas, ...nuevas, ...futuras].slice(0, limite);
}
const INTERVALOS = [1, 3, 7, 16, 35]; // días
export function repasarCarta(id: string, bien: boolean) {
  const e = leer();
  const prev = e.sr[id] || { due: '', reps: 0 };
  const reps = bien ? Math.min(prev.reps + 1, INTERVALOS.length - 1) : 0;
  const dias = bien ? INTERVALOS[reps] : 0; // si falla, vuelve hoy
  e.sr[id] = { reps, due: new Date(Date.now() + dias * 86400000).toISOString() };
  if (bien) e.xp += 3;
  guardar(e);
}
export function estatsMazo() {
  const e = leer(); const todas = mazoCompleto();
  const dominadas = todas.filter((c) => (e.sr[c.id]?.reps || 0) >= 3).length;
  return { total: todas.length, dominadas, estudiadas: Object.keys(e.sr).length };
}

export function estatsMazoFiltrado(area = 'Todas', tipo: TipoCarta = 'todas') {
  const e = leer();
  const todas = mazoCompleto().filter((c) =>
    (area === 'Todas' || c.area === area) &&
    (tipo === 'todas' || (tipo === 'quiz' ? c.id.startsWith('q:') : c.id.startsWith('n:'))));
  const dominadas = todas.filter((c) => (e.sr[c.id]?.reps || 0) >= 3).length;
  const estudiadas = todas.filter((c) => !!e.sr[c.id]).length;
  return { total: todas.length, dominadas, estudiadas };
}

// ── Quiz Relámpago ──
export function registrarQuiz(puntaje: number) {
  const e = leer(); e.xp += Math.round(puntaje / 10); e.quizBest = Math.max(e.quizBest, puntaje); guardar(e);
}
export const mejorQuiz = () => leer().quizBest;

// ── Casos Dermalysse (escenarios educativos) ──
export interface Caso {
  id: string; area: string; titulo: string; paciente: string; presentacion: string; hallazgos: string[];
  diagnostico: { pregunta: string; opciones: string[]; correcta: number; explicacion: string };
  plan: { pregunta: string; opciones: string[]; correcta: number; explicacion: string };
}
export const casos = (): Caso[] => casosSeed as Caso[];
export function resolverCaso(id: string, perfecto: boolean) {
  const e = leer();
  if (!e.casos[id] && perfecto) { e.casos[id] = true; e.xp += 50; }
  guardar(e);
}
export const casosResueltos = () => Object.values(leer().casos).filter(Boolean).length;
export const idsCasosResueltos = () => new Set(Object.entries(leer().casos).filter(([, ok]) => ok).map(([id]) => id));

export const barajar = <T>(a: T[]): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
