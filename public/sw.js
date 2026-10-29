// Club Dermalysse · service worker
// Navegación: red primero, sin red la última copia. Estáticos propios: responde con caché y actualiza por detrás.
// Nunca toca el backend, Firebase, Stripe ni Bunny.
// Vive bajo la base del sitio ('/' en desarrollo, '/dermalysse-platform/' en GitHub Pages): todas las rutas
// se calculan desde el ámbito con que se registró.
const VERSION = 'dermalysse-v8-premium-app-icon';
const BASE = new URL(self.registration.scope).pathname;
const APP_SHELL = BASE + 'club/';
const OFFLINE = BASE + 'offline.html';
const SHELL = [
  APP_SHELL,
  BASE + 'manifest.webmanifest',
  BASE + 'brand/dermalysse-app-icon-192.png',
  BASE + 'brand/dermalysse-app-icon-512.png',
  BASE + 'brand/dermalysse-app-icon-maskable-512.png',
  BASE + 'brand/dermalysse-horizontal.svg',
  OFFLINE,
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Ruta relativa a la base, siempre con '/' inicial ('/assets/…', '/club/…').
const relativa = (url) => (url.pathname.startsWith(BASE) ? '/' + url.pathname.slice(BASE.length) : null);
const bundle = (ruta) => ruta.startsWith('/assets/');
const imagen = (ruta) => /^\/(brand|img|media)\//.test(ruta);

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const ruta = relativa(url);
  if (ruta === null) return; // fuera de este sitio (otro repo bajo el mismo dominio)
  if (ruta.startsWith('/@') || ruta.startsWith('/src/') || ruta.startsWith('/node_modules/')) return; // servidor de desarrollo

  if (req.mode === 'navigate') {
    const esClub = ruta === '/club' || ruta.startsWith('/club/');
    e.respondWith(fetch(req).then((r) => {
      if (esClub) {
        const copia = r.clone();
        caches.open(VERSION).then((c) => c.put(APP_SHELL, copia));
      }
      return r;
    }).catch(() => esClub
      ? caches.match(APP_SHELL).then((r) => r || caches.match(OFFLINE))
      : caches.match(OFFLINE)));
    return;
  }
  // Bundles del cliente: red primero (los deploys nuevos se ven de inmediato).
  if (bundle(ruta)) {
    e.respondWith(
      fetch(req).then((r) => {
        if (r.ok) caches.open(VERSION).then((c) => c.put(req, r.clone()));
        return r;
      }).catch(() => caches.match(req)),
    );
    return;
  }
  // Imágenes: cache-first con revalidación en segundo plano.
  if (imagen(ruta)) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      const red = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || red;
    }));
  }
});
