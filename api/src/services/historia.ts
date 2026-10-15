// Reglas del avance del Modo Historia (GET/PATCH /historia).
// El cliente (src/core/historia.ts) guarda el avance en el dispositivo y, al iniciar sesión, lo une
// con el del servidor y lo reenvía completo. Por eso el servidor FUSIONA de forma aditiva:
//  - completados: unión (el orden existente se conserva; nunca se quita un nivel);
//  - puntajes: máximo por nivel (0–100, entero);
//  - ultimoNivel: el de la fuente con `actualizado` más reciente (si trae uno);
//  - actualizado: el más reciente, topado a la hora del servidor (una fecha futura no "congela" el avance).
// Un PATCH con datos más viejos o parciales nunca hace retroceder el avance.
import type { ProgresoHistoria } from '../domain/types.js';
import { ValidationError } from './errors.js';

/** Límites de tamaño (el cuerpo además está topado a 32 kB por express.json). */
export const LIMITES_HISTORIA = { niveles: 300, largoId: 64, largoFecha: 40 } as const;

/** Id de nivel: empieza con letra o número; sin "/" ni "__" iniciales (seguro como clave de mapa en Firestore). */
const ID_NIVEL = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

export const historiaVacia = (): ProgresoHistoria => ({ completados: [], puntajes: {}, ultimoNivel: '', actualizado: '' });

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function idValido(v: unknown, campo: string): string {
  if (typeof v !== 'string' || !ID_NIVEL.test(v)) {
    throw new ValidationError(`${campo}: cada nivel debe ser un id de 1 a ${LIMITES_HISTORIA.largoId} caracteres (letras, números, "_", ".", ":" o "-").`);
  }
  return v;
}

/**
 * Valida el cuerpo de PATCH /historia y lo normaliza. Todos los campos son opcionales (los que faltan
 * cuentan como vacíos); los desconocidos se ignoran. Tipos incorrectos o tamaños excesivos ⇒ 400.
 */
export function validarHistoria(cuerpo: unknown): ProgresoHistoria {
  if (!esObjeto(cuerpo)) throw new ValidationError('El avance del Modo Historia debe ser un objeto.');
  const salida = historiaVacia();

  if (cuerpo.completados !== undefined) {
    if (!Array.isArray(cuerpo.completados)) throw new ValidationError('completados debe ser una lista de ids de nivel.');
    if (cuerpo.completados.length > LIMITES_HISTORIA.niveles) throw new ValidationError(`completados admite como máximo ${LIMITES_HISTORIA.niveles} niveles.`);
    salida.completados = [...new Set(cuerpo.completados.map((id) => idValido(id, 'completados')))];
  }

  if (cuerpo.puntajes !== undefined) {
    if (!esObjeto(cuerpo.puntajes)) throw new ValidationError('puntajes debe ser un objeto { idNivel: número }.');
    const entradas = Object.entries(cuerpo.puntajes);
    if (entradas.length > LIMITES_HISTORIA.niveles) throw new ValidationError(`puntajes admite como máximo ${LIMITES_HISTORIA.niveles} niveles.`);
    for (const [id, valor] of entradas) {
      idValido(id, 'puntajes');
      if (typeof valor !== 'number' || !Number.isFinite(valor)) throw new ValidationError('puntajes: cada valor debe ser un número.');
      // Misma normalización que el cliente: entero entre 0 y 100.
      salida.puntajes[id] = Math.max(0, Math.min(100, Math.round(valor)));
    }
  }

  if (cuerpo.ultimoNivel !== undefined && cuerpo.ultimoNivel !== '') salida.ultimoNivel = idValido(cuerpo.ultimoNivel, 'ultimoNivel');

  if (cuerpo.actualizado !== undefined && cuerpo.actualizado !== '') {
    const a = cuerpo.actualizado;
    if (typeof a !== 'string' || a.length > LIMITES_HISTORIA.largoFecha || !Number.isFinite(Date.parse(a))) {
      throw new ValidationError('actualizado debe ser una fecha ISO 8601.');
    }
    salida.actualizado = new Date(Date.parse(a)).toISOString();
  }

  return salida;
}

/** Lee defensivamente lo guardado (documentos viejos o editados a mano nunca rompen la respuesta). */
export function normalizarGuardada(d: Record<string, unknown> | undefined): ProgresoHistoria {
  if (!d) return historiaVacia();
  const completados = Array.isArray(d.completados) ? d.completados.filter((id): id is string => typeof id === 'string' && ID_NIVEL.test(id)) : [];
  const puntajes: Record<string, number> = {};
  if (esObjeto(d.puntajes)) {
    for (const [id, v] of Object.entries(d.puntajes)) {
      if (ID_NIVEL.test(id) && typeof v === 'number' && Number.isFinite(v)) puntajes[id] = Math.max(0, Math.min(100, Math.round(v)));
    }
  }
  return {
    completados: [...new Set(completados)],
    puntajes,
    ultimoNivel: typeof d.ultimoNivel === 'string' && ID_NIVEL.test(d.ultimoNivel) ? d.ultimoNivel : '',
    actualizado: typeof d.actualizado === 'string' && Number.isFinite(Date.parse(d.actualizado)) ? d.actualizado : '',
  };
}

/**
 * Fusión aditiva de lo guardado con lo recibido (ya validado). `ahora` permite fijar el reloj en pruebas.
 * Lanza ValidationError si la unión excede el límite de niveles (nunca se recorta en silencio).
 */
export function fusionarHistoria(guardada: ProgresoHistoria, entrada: ProgresoHistoria, ahora = new Date()): ProgresoHistoria {
  const completados = [...new Set([...guardada.completados, ...entrada.completados])];
  const puntajes: Record<string, number> = { ...guardada.puntajes };
  for (const [id, v] of Object.entries(entrada.puntajes)) puntajes[id] = Math.max(puntajes[id] ?? 0, v);
  if (completados.length > LIMITES_HISTORIA.niveles || Object.keys(puntajes).length > LIMITES_HISTORIA.niveles) {
    throw new ValidationError(`El avance del Modo Historia admite como máximo ${LIMITES_HISTORIA.niveles} niveles.`);
  }

  const tope = ahora.toISOString();
  const fechaEntrada = entrada.actualizado && entrada.actualizado > tope ? tope : entrada.actualizado;
  const entradaEsMasReciente = fechaEntrada >= guardada.actualizado;
  const ultimoNivel = entradaEsMasReciente
    ? entrada.ultimoNivel || guardada.ultimoNivel
    : guardada.ultimoNivel || entrada.ultimoNivel;
  const actualizado = fechaEntrada > guardada.actualizado ? fechaEntrada : guardada.actualizado;

  return { completados, puntajes, ultimoNivel, actualizado };
}
