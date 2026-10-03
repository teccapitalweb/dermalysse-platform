// Router por hash: #/cursos, #/curso/:id, #/admin/cursos/:id …
export type Params = Record<string, string>;
export type Page = (params: Params, query: URLSearchParams) => string | Promise<string>;

const routes: { pattern: RegExp; keys: string[]; page: Page }[] = [];
const afterRender: (() => void)[] = [];
let beforeRender: (path: string) => boolean | Promise<boolean> = () => true;
let getOutlet: () => HTMLElement = () => document.getElementById('outlet')!;

export function route(path: string, page: Page) {
  const keys: string[] = [];
  const pattern = new RegExp('^' + path.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ pattern, keys, page });
}

export function onRender(fn: () => void) { afterRender.push(fn); }
export function onBeforeRender(fn: (path: string) => boolean | Promise<boolean>) { beforeRender = fn; }

export function navigate(hash: string) { location.hash = hash.startsWith('#') ? hash : '#' + hash; }

export function current() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, query: new URLSearchParams(qs) };
}

let token = 0;
let prevPath: string | null = null;
export async function render() {
  const mine = ++token;
  const { path, query } = current();
  if (!(await beforeRender(path)) || mine !== token) return;
  const outlet = getOutlet();
  for (const r of routes) {
    const m = path.match(r.pattern);
    if (!m) continue;
    const params: Params = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    const html = await r.page(params, query);
    if (mine !== token) return;
    // Render silencioso: si solo cambió el filtro (misma ruta), sin scroll ni animación de entrada.
    const quiet = prevPath === path;
    prevPath = path;
    if (quiet) outlet.setAttribute('data-quiet', ''); else outlet.removeAttribute('data-quiet');
    outlet.innerHTML = html;
    if (!quiet) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    afterRender.forEach((fn) => fn());
    return;
  }
  outlet.innerHTML = `<section class="stack" style="padding:80px 0;text-align:center"><h1 class="display">Página no encontrada</h1><p class="muted">La ruta <code class="mono">${path}</code> no existe.</p><a class="btn btn--brand" href="#/">Ir al inicio</a></section>`;
  afterRender.forEach((fn) => fn());
}

export function startRouter(outletGetter?: () => HTMLElement) {
  if (outletGetter) getOutlet = outletGetter;
  window.addEventListener('hashchange', render);
  render();
}
