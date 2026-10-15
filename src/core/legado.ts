// Compatibilidad con el club actual. Lógica pura (sin imports) probada en scripts/test-produccion.mjs.
//
// Los certificados del club actual usan el folio DRML-YYYY-<12 hex en mayúsculas> y sus QR impresos
// apuntan a club.dermalyssemx.com/verify.html?code=<folio>. En el corte, esa URL se redirige aquí
// (public/verify.html o el propio club con ?code=) y termina en #/verificar/<folio>.

export const PATRON_FOLIO_DERMALYSSE = /^DRML-\d{4}-[0-9A-F]{12}$/;

/** Limpia un folio recibido por URL. No exige el formato DRML: la API decide si existe. */
export function normalizarFolio(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z0-9][A-Z0-9-]{2,63}$/.test(limpio) ? limpio : null;
}

export const esFolioDermalysse = (folio: string) => PATRON_FOLIO_DERMALYSSE.test(folio);

/** Año del folio (DRML-2026-… o DRM-2026-… del demo), si lo trae. */
export function anioFolio(folio: string): string | null {
  return /^DRML?-(\d{4})-/i.exec(folio)?.[1] ?? null;
}

/**
 * Si la página se abrió con ?code=<folio> (forma de verify.html), devuelve el hash al que hay que ir.
 * Solo actúa cuando no hay otra ruta en el hash, para no secuestrar enlaces internos.
 */
export function hashVerificacionLegada(search: string, hash: string): string | null {
  const folio = normalizarFolio(new URLSearchParams(search).get('code'));
  if (!folio) return null;
  const ruta = hash.replace(/^#/, '');
  if (ruta && ruta !== '/' && !ruta.startsWith('/verificar/')) return null;
  return `#/verificar/${encodeURIComponent(folio)}`;
}

/** Quita `code` de la búsqueda para que la URL final quede limpia (conserva otros parámetros). */
export function busquedaSinCodigo(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('code');
  const resto = params.toString();
  return resto ? `?${resto}` : '';
}
