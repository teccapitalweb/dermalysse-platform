// Cambiar esta versión cuando se reemplacen las imágenes conservando sus nombres.
// La consulta fuerza una URL nueva sin duplicar archivos ni depender de limpiar la caché.
export const VERSION_PORTADAS_CURSOS = '20261026-flow';

const PORTADA_LOCAL_CURSO = /^\/cursos\/course-[a-z0-9-]+\.jpe?g(?:[?#].*)?$/i;

export function versionarPortadaCurso(valor: unknown): string {
  const portada = typeof valor === 'string' ? valor.trim() : '';
  if (!PORTADA_LOCAL_CURSO.test(portada)) return portada;
  const [sinFragmento, fragmento] = portada.split('#', 2);
  const ruta = sinFragmento.split('?', 1)[0];
  return `${ruta}?v=${VERSION_PORTADAS_CURSOS}${fragmento ? `#${fragmento}` : ''}`;
}
