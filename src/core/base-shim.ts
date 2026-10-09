// Repara en caliente los paths absolutos a assets ('/brand/…', '/media/…', etc.)
// cuando la app se sirve bajo una subruta como /dermalysse-platform/ (GitHub Pages).
// En dev con base '/' no hace nada. Captura tanto los <img>/<link> ya presentes
// como los inyectados vía innerHTML por el router de la app.
const BASE = import.meta.env.BASE_URL || '/';
const PREFIXES = ['/brand/', '/media/', '/posts/', '/cursos/', '/materiales/', '/praxia/', '/manifest'];

function fixValue(v: string | null): string | null {
  if (!v) return v;
  for (const p of PREFIXES) if (v.startsWith(p)) return BASE + v.slice(1);
  return v;
}

function fixEl(el: Element) {
  for (const attr of ['src', 'href']) {
    const v = el.getAttribute(attr);
    const n = fixValue(v);
    if (n && n !== v) el.setAttribute(attr, n);
  }
}

function walk(root: Element) {
  if (root.hasAttribute?.('src') || root.hasAttribute?.('href')) fixEl(root);
  root.querySelectorAll?.('img, link, source, script[src]').forEach(fixEl);
}

export function instalarBaseShim() {
  if (BASE === '/') return;
  walk(document.documentElement);
  new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => { if (n.nodeType === 1) walk(n as Element); });
      if (m.type === 'attributes' && m.target.nodeType === 1) fixEl(m.target as Element);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href'] });
}
