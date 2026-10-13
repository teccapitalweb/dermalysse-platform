// Lógica del Directorio de experiencias: validación en SERVIDOR y construcción del registro.
// El servidor asigna id/fecha/autor; el cliente nunca los decide.
import { randomUUID } from 'node:crypto';
import {
  CATEGORIAS_EXPERIENCIA, type CategoriaExperiencia, type ExperienciaCompartida, type Usuario,
} from '../domain/types.js';

export class ValidationError extends Error {
  readonly code = 'VALIDATION';
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface EntradaExperiencia {
  titulo?: unknown;
  texto?: unknown;
  categoria?: unknown;
  anonima?: unknown;
}

function esCategoria(valor: unknown): valor is CategoriaExperiencia {
  return typeof valor === 'string' && (CATEGORIAS_EXPERIENCIA as readonly string[]).includes(valor);
}

/** Valida la entrada y devuelve la experiencia lista para persistir. Lanza ValidationError (⇒ 400) si algo falla. */
export function construirExperiencia(entrada: EntradaExperiencia, usuario: Usuario): ExperienciaCompartida {
  const titulo = typeof entrada.titulo === 'string' ? entrada.titulo.trim() : '';
  const texto = typeof entrada.texto === 'string' ? entrada.texto.trim() : '';

  if (!esCategoria(entrada.categoria)) {
    throw new ValidationError('Selecciona una categoría válida.');
  }
  if (titulo.length < 4 || titulo.length > 100) {
    throw new ValidationError('El título debe tener entre 4 y 100 caracteres.');
  }
  if (texto.length < 20 || texto.length > 900) {
    throw new ValidationError('La experiencia debe tener entre 20 y 900 caracteres.');
  }

  const anonima = entrada.anonima === true;
  const autor = anonima ? 'Miembro del club' : usuario.nombre.trim() || 'Miembro del club';

  return {
    id: randomUUID(),
    titulo,
    texto,
    categoria: entrada.categoria,
    autor,
    anonima,
    fecha: new Date().toISOString(),
  };
}
