// Lógica del club interactivo: validación/autoría de foro y saneamiento de perfil.
// El SERVIDOR asigna id/fecha/autor y valida; el cuerpo nunca decide identidad.
import { randomUUID } from 'node:crypto';
import type { HiloRemoto, PerfilData, RespuestaForo, Usuario } from '../domain/types.js';
import { ValidationError } from './errors.js';

const TITULO = { min: 4, max: 120 };
const TEXTO_HILO = { min: 10, max: 4000 };
const TEXTO_RESP = { min: 2, max: 2000 };

export interface EntradaHilo { titulo?: unknown; texto?: unknown; cursoId?: unknown; }

export function construirHilo(entrada: EntradaHilo, usuario: Usuario): HiloRemoto {
  const titulo = typeof entrada.titulo === 'string' ? entrada.titulo.trim() : '';
  const texto = typeof entrada.texto === 'string' ? entrada.texto.trim() : '';
  if (titulo.length < TITULO.min || titulo.length > TITULO.max) {
    throw new ValidationError(`El título debe tener entre ${TITULO.min} y ${TITULO.max} caracteres.`);
  }
  if (texto.length < TEXTO_HILO.min || texto.length > TEXTO_HILO.max) {
    throw new ValidationError(`El contenido debe tener entre ${TEXTO_HILO.min} y ${TEXTO_HILO.max} caracteres.`);
  }
  const cursoId = typeof entrada.cursoId === 'string' && entrada.cursoId.trim() ? entrada.cursoId.trim() : null;
  return {
    id: randomUUID(),
    titulo,
    texto,
    autor: usuario.nombre.trim() || 'Miembro del club',
    fecha: new Date().toISOString(),
    cursoId,
    util: 0,
    respuestas: 0,
    tipo: 'pregunta',
  };
}

export function construirRespuesta(entradaTexto: unknown, usuario: Usuario): RespuestaForo {
  const texto = typeof entradaTexto === 'string' ? entradaTexto.trim() : '';
  if (texto.length < TEXTO_RESP.min || texto.length > TEXTO_RESP.max) {
    throw new ValidationError(`La respuesta debe tener entre ${TEXTO_RESP.min} y ${TEXTO_RESP.max} caracteres.`);
  }
  return {
    id: randomUUID(),
    autor: usuario.nombre.trim() || 'Miembro del club',
    texto,
    fecha: new Date().toISOString(),
  };
}

const CAPS: Record<keyof PerfilData, number> = { nombre: 80, foto: 500, whatsapp: 30, especialidad: 80, ciudad: 80 };

/** Toma SOLO los campos permitidos del cuerpo, recortados y acotados. Ignora uid/rol/cualquier otro. */
export function sanitizarPerfil(body: Record<string, unknown>): Partial<PerfilData> {
  const salida: Partial<PerfilData> = {};
  for (const clave of Object.keys(CAPS) as (keyof PerfilData)[]) {
    const valor = body[clave];
    if (typeof valor === 'string') {
      const limpio = valor.trim().slice(0, CAPS[clave]);
      salida[clave] = limpio;
    }
  }
  return salida;
}
