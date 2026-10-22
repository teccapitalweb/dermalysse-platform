/** Un índice oculto (-1) no es una respuesta: tampoco debe acertarse por agotar el tiempo. */
export function preguntaConRespuesta(p: { opciones?: unknown; correcta?: unknown }): boolean {
  return Array.isArray(p.opciones) && p.opciones.length > 1
    && Number.isInteger(p.correcta) && (p.correcta as number) >= 0
    && (p.correcta as number) < p.opciones.length;
}

