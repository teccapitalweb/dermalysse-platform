import type { AvanceJuegoAcademia, MinijuegoAcademia, ModuloAcademia } from '../domain/types.js';
import { CodedError, ValidationError } from './errors.js';

export const DIAMANTES_JUEGO_ACADEMIA = 10;
const DIRECCIONES = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]] as const;

const hash = (valor: string) => [...valor].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);
const firma = (juego: MinijuegoAcademia) => `j2-${hash(JSON.stringify(juego)).toString(36)}`;
const plano = (valor: unknown): Record<string, unknown> => valor && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : {};

function aleatorio(semilla: number) {
  let estado = semilla >>> 0 || 1;
  return () => { estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0; return estado / 4294967296; };
}

function barajar<T>(lista: T[], semilla: number): T[] {
  const azar = aleatorio(semilla);
  const salida = [...lista];
  for (let i = salida.length - 1; i > 0; i -= 1) {
    const j = Math.floor(azar() * (i + 1));
    [salida[i], salida[j]] = [salida[j], salida[i]];
  }
  return salida;
}

interface SopaInterna {
  tipo: 'sopa'; titulo: string; version: string; total: number; tam: number; grilla: string[][];
  ubicaciones: { palabra: string; celdas: string[] }[];
}

interface CrucigramaInterno {
  tipo: 'crucigrama'; titulo: string; version: string; total: number; filas: number; cols: number;
  celdas: Map<string, string>; numeros: Map<string, number>;
  palabras: { id: string; numero: number; pista: string; largo: number; direccion: 'horizontal' | 'vertical'; celdas: string[] }[];
}

interface MemoramaInterno {
  tipo: 'memorama'; titulo: string; version: string; total: number;
  cartas: { id: string; texto: string; pareja: string; lado: 'a' | 'b' }[];
}

export type JuegoInterno = SopaInterna | CrucigramaInterno | MemoramaInterno;

export interface ProgresoJuegoPublico {
  resueltos: string[];
  marcadas: string[];
  jugadas: number;
  errores: number;
  puntaje: number;
  completado: boolean;
  completadoEn: string | null;
  recompensaAcreditada: boolean;
}

export interface JuegoPublico {
  version: string;
  tipo: JuegoInterno['tipo'];
  titulo: string;
  total: number;
  recompensa: { diamantes: number; acreditada: boolean };
  progreso: ProgresoJuegoPublico;
  tablero: Record<string, unknown>;
}

function sopa(palabrasCrudas: string[], titulo: string, version: string, semilla: number): SopaInterna {
  const palabras = palabrasCrudas.map((p) => String(p).toUpperCase());
  const tam = Math.min(15, Math.max(11, Math.max(...palabras.map((p) => p.length)) + 2));
  const azar = aleatorio(semilla);
  for (let intento = 0; intento < 40; intento += 1) {
    const grilla: string[][] = Array.from({ length: tam }, () => Array(tam).fill(''));
    const ubicaciones: { palabra: string; celdas: string[] }[] = [];
    let valido = true;
    for (const palabra of [...palabras].sort((a, b) => b.length - a.length)) {
      let puesta = false;
      for (let vuelta = 0; vuelta < 300 && !puesta; vuelta += 1) {
        const [dr, dc] = DIRECCIONES[Math.floor(azar() * (intento < 20 ? 4 : DIRECCIONES.length))];
        const r0 = Math.floor(azar() * tam), c0 = Math.floor(azar() * tam);
        const celdas: string[] = [];
        for (let k = 0; k < palabra.length; k += 1) {
          const r = r0 + dr * k, c = c0 + dc * k;
          if (r < 0 || c < 0 || r >= tam || c >= tam || (grilla[r][c] && grilla[r][c] !== palabra[k])) { celdas.length = 0; break; }
          celdas.push(`${r},${c}`);
        }
        if (celdas.length === palabra.length) {
          celdas.forEach((rc, k) => { const [r, c] = rc.split(',').map(Number); grilla[r][c] = palabra[k]; });
          ubicaciones.push({ palabra, celdas });
          puesta = true;
        }
      }
      if (!puesta) { valido = false; break; }
    }
    if (!valido) continue;
    const relleno = 'ABCDEFGHIJLMNOPRSTUVZ';
    for (const fila of grilla) for (let c = 0; c < tam; c += 1) if (!fila[c]) fila[c] = relleno[Math.floor(azar() * relleno.length)];
    return { tipo: 'sopa', titulo, version, total: palabras.length, tam, grilla, ubicaciones };
  }
  throw new CodedError(500, 'juego/generacion', 'No se pudo preparar este laboratorio.');
}

function crucigrama(pistasCrudas: { palabra: string; pista: string }[], titulo: string, version: string): CrucigramaInterno {
  type Puesta = { palabra: string; pista: string; r: number; c: number; horizontal: boolean };
  const pistas = pistasCrudas.map((p) => ({ ...p, palabra: String(p.palabra).toUpperCase() })).sort((a, b) => b.palabra.length - a.palabra.length);
  const puestas: Puesta[] = [];
  const mapa = new Map<string, string>();
  const clave = (r: number, c: number) => `${r},${c}`;
  const cabe = (palabra: string, r: number, c: number, horizontal: boolean) => {
    let cruces = 0;
    if (mapa.has(clave(r - (horizontal ? 0 : 1), c - (horizontal ? 1 : 0))) || mapa.has(clave(r + (horizontal ? 0 : palabra.length), c + (horizontal ? palabra.length : 0)))) return -1;
    for (let i = 0; i < palabra.length; i += 1) {
      const rr = r + (horizontal ? 0 : i), cc = c + (horizontal ? i : 0);
      const actual = mapa.get(clave(rr, cc));
      if (actual) { if (actual !== palabra[i]) return -1; cruces += 1; continue; }
      if (mapa.has(clave(rr + (horizontal ? 1 : 0), cc + (horizontal ? 0 : 1))) || mapa.has(clave(rr - (horizontal ? 1 : 0), cc - (horizontal ? 0 : 1)))) return -1;
    }
    return cruces;
  };
  const poner = (p: { palabra: string; pista: string }, r: number, c: number, horizontal: boolean) => {
    for (let i = 0; i < p.palabra.length; i += 1) mapa.set(clave(r + (horizontal ? 0 : i), c + (horizontal ? i : 0)), p.palabra[i]);
    puestas.push({ ...p, r, c, horizontal });
  };
  const sueltas: typeof pistas = [];
  pistas.forEach((p, indice) => {
    if (indice === 0) { poner(p, 0, 0, true); return; }
    let mejor: { r: number; c: number; horizontal: boolean; cruces: number } | null = null;
    for (const q of puestas) for (let i = 0; i < q.palabra.length; i += 1) for (let j = 0; j < p.palabra.length; j += 1) {
      if (q.palabra[i] !== p.palabra[j]) continue;
      const horizontal = !q.horizontal;
      const r = q.horizontal ? q.r - j : q.r + i, c = q.horizontal ? q.c + i : q.c - j;
      const cruces = cabe(p.palabra, r, c, horizontal);
      if (cruces > 0 && (!mejor || cruces > mejor.cruces)) mejor = { r, c, horizontal, cruces };
    }
    if (mejor) poner(p, mejor.r, mejor.c, mejor.horizontal); else sueltas.push(p);
  });
  let maxR = Math.max(...[...mapa.keys()].map((x) => Number(x.split(',')[0])));
  const minC = Math.min(...[...mapa.keys()].map((x) => Number(x.split(',')[1])));
  for (const p of sueltas) { maxR += 2; poner(p, maxR, minC, true); }
  const rs = [...mapa.keys()].map((x) => Number(x.split(',')[0])), cs = [...mapa.keys()].map((x) => Number(x.split(',')[1]));
  const r0 = Math.min(...rs), c0 = Math.min(...cs);
  const filas = Math.max(...rs) - r0 + 1, cols = Math.max(...cs) - c0 + 1;
  const celdas = new Map<string, string>();
  for (const [key, letra] of mapa) { const [r, c] = key.split(',').map(Number); celdas.set(clave(r - r0, c - c0), letra); }
  const numeros = new Map<string, number>();
  let numero = 0;
  const ordenadas = [...puestas].sort((a, b) => a.r - b.r || a.c - b.c);
  const palabras = ordenadas.map((p, indice) => {
    const inicio = clave(p.r - r0, p.c - c0);
    if (!numeros.has(inicio)) numeros.set(inicio, ++numero);
    return {
      id: `p${indice}`, numero: numeros.get(inicio)!, pista: p.pista, largo: p.palabra.length,
      direccion: p.horizontal ? 'horizontal' as const : 'vertical' as const,
      celdas: Array.from({ length: p.palabra.length }, (_, i) => clave(p.r - r0 + (p.horizontal ? 0 : i), p.c - c0 + (p.horizontal ? i : 0))),
    };
  });
  return { tipo: 'crucigrama', titulo, version, total: celdas.size, filas, cols, celdas, numeros, palabras };
}

function memorama(pares: { a: string; b: string }[], titulo: string, version: string, semilla: number): MemoramaInterno {
  const cartas = barajar(pares.flatMap((p, i) => [
    { id: `a${i}`, texto: p.a, pareja: `p${i}`, lado: 'a' as const },
    { id: `b${i}`, texto: p.b, pareja: `p${i}`, lado: 'b' as const },
  ]), semilla);
  return { tipo: 'memorama', titulo, version, total: pares.length, cartas };
}

function contenidoJuego(m: ModuloAcademia): MinijuegoAcademia {
  const juego = m.minijuego;
  if (!juego || !['sopa', 'crucigrama', 'memorama'].includes(juego.tipo)) throw new CodedError(404, 'juego_no_disponible', 'Este módulo todavía no tiene laboratorio.');
  return juego;
}

export function crearJuego(m: ModuloAcademia, uid: string, programa: string, n: number): JuegoInterno {
  const juego = contenidoJuego(m);
  const version = firma(juego);
  const semilla = hash(`${uid}|${programa}|${n}|${version}`);
  if (juego.tipo === 'sopa') return sopa(juego.palabras, juego.titulo, version, semilla);
  if (juego.tipo === 'crucigrama') return crucigrama(juego.pistas, juego.titulo, version);
  return memorama(juego.pares, juego.titulo, version, semilla);
}

export function evaluarJuego(juego: JuegoInterno, entradaDesconocida: unknown): { resueltos: string[]; acierto: boolean } {
  const entrada = plano(entradaDesconocida);
  if (juego.tipo === 'sopa') {
    if (!Array.isArray(entrada.ruta) || entrada.ruta.length < 2 || entrada.ruta.length > 20 || !entrada.ruta.every((x) => typeof x === 'string' && /^\d{1,2},\d{1,2}$/.test(x))) {
      throw new ValidationError('La selección de la sopa no es válida.');
    }
    const ruta = entrada.ruta as string[];
    const clave = ruta.join(';'), inversa = [...ruta].reverse().join(';');
    const encontrada = juego.ubicaciones.find((u) => u.celdas.join(';') === clave || u.celdas.join(';') === inversa);
    return { resueltos: encontrada ? [encontrada.palabra] : [], acierto: !!encontrada };
  }
  if (juego.tipo === 'crucigrama') {
    const respuestas = plano(entrada.respuestas);
    if (Object.keys(respuestas).length > 256 || Object.values(respuestas).some((v) => typeof v !== 'string' || String(v).length > 2)) throw new ValidationError('Las respuestas del crucigrama no son válidas.');
    const resueltos = [...juego.celdas].filter(([key, letra]) => String(respuestas[key] ?? '').trim().toUpperCase() === letra).map(([key]) => key);
    return { resueltos, acierto: resueltos.length > 0 };
  }
  if (!Array.isArray(entrada.cartas) || entrada.cartas.length !== 2 || entrada.cartas.some((x) => typeof x !== 'string') || entrada.cartas[0] === entrada.cartas[1]) {
    throw new ValidationError('La pareja elegida no es válida.');
  }
  const [a, b] = (entrada.cartas as string[]).map((id) => juego.cartas.find((c) => c.id === id));
  const acierto = !!a && !!b && a.pareja === b.pareja && a.lado !== b.lado;
  return { resueltos: acierto ? [a!.pareja] : [], acierto };
}

function resueltosValidos(juego: JuegoInterno, avance?: AvanceJuegoAcademia): string[] {
  if (!avance || avance.version !== juego.version || avance.tipo !== juego.tipo) return [];
  const permitidos = juego.tipo === 'sopa'
    ? new Set(juego.ubicaciones.map((u) => u.palabra))
    : juego.tipo === 'crucigrama' ? new Set(juego.celdas.keys()) : new Set(juego.cartas.map((c) => c.pareja));
  return [...new Set(avance.resueltos)].filter((x) => permitidos.has(x)).slice(0, juego.total);
}

export function publicarJuego(juego: JuegoInterno, avance?: AvanceJuegoAcademia): JuegoPublico {
  const resueltos = resueltosValidos(juego, avance);
  const completado = resueltos.length >= juego.total;
  const marcadas = juego.tipo === 'sopa'
    ? juego.ubicaciones.filter((u) => resueltos.includes(u.palabra)).flatMap((u) => u.celdas)
    : juego.tipo === 'crucigrama' ? resueltos : juego.cartas.filter((c) => resueltos.includes(c.pareja)).map((c) => c.id);
  const errores = avance?.version === juego.version ? avance.errores : 0;
  const progreso: ProgresoJuegoPublico = {
    resueltos, marcadas: [...new Set(marcadas)], jugadas: avance?.version === juego.version ? avance.jugadas : 0, errores,
    puntaje: completado ? Math.max(60, 100 - errores * 4) : Math.round((resueltos.length / Math.max(1, juego.total)) * 100),
    completado, completadoEn: completado ? avance?.completadoEn ?? null : null,
    recompensaAcreditada: completado && avance?.recompensaAcreditada === true,
  };
  const tablero: Record<string, unknown> = juego.tipo === 'sopa'
    ? { tam: juego.tam, filas: juego.grilla.map((fila) => fila.join('')), palabras: juego.ubicaciones.map((u) => u.palabra) }
    : juego.tipo === 'crucigrama'
      ? { filas: juego.filas, cols: juego.cols, celdas: [...juego.celdas.keys()], numeros: Object.fromEntries(juego.numeros), palabras: juego.palabras }
      : { cartas: juego.cartas.map(({ id, texto }) => ({ id, texto })) };
  return {
    version: juego.version, tipo: juego.tipo, titulo: juego.titulo, total: juego.total,
    recompensa: { diamantes: DIAMANTES_JUEGO_ACADEMIA, acreditada: progreso.recompensaAcreditada }, progreso, tablero,
  };
}
