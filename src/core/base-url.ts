// Prefijo correcto para assets servidos por Vite. En dev es '/'; en producción
// vive bajo /dermalysse-platform/ (GitHub Pages del repo). Normalizamos para que
// `asset('/brand/foo.png')` y `asset('brand/foo.png')` den el mismo resultado.
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/');

export function asset(path: string): string {
  if (!path) return BASE;
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path;
  return BASE + path.replace(/^\/+/, '');
}
