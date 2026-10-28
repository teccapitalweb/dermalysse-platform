// Módulo de contenido en modo producción (AUTH_MODE=firebase + DATA_MODE=firestore) con el Firestore
// FALSO en memoria y un verificador de tokens falso. SIN red. Usa el catálogo editorial real
// (api/content/club/cursos.json) para que los quizzes empaquetados coincidan con sus cursos.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { buildApp } from '../src/app.js';
import { MemoryFirestore } from '../src/adapters/firestore/memoria.js';
import type { FetchLike } from '../src/adapters/legacy/webhook.js';
import type { TokenDecodificado } from '../src/adapters/firebase/firebaseAuth.js';
import { fechaLegadoDesdeIso, fechaWebinar, minutosDuracion } from '../src/adapters/firestore/contenido.js';

const CUENTA_FALSA = JSON.stringify({ project_id: 'club-dermalysse', client_email: 'prueba@example.invalid', private_key: 'llave-falsa-de-prueba' });
const ENV = {
  AUTH_MODE: 'firebase', DATA_MODE: 'firestore', FIREBASE_SERVICE_ACCOUNT: CUENTA_FALSA,
  LEGACY_WEBHOOK_URL: 'https://webhook.example.test/', APP_URL: 'https://club.example.test', CORS_ORIGINS: 'https://club.example.test',
  CAMPANA_BIENVENIDA_CODIGO: 'TEST-DERMALYSSE-50',
} as unknown as NodeJS.ProcessEnv;

const AHORA = new Date('2026-10-15T18:00:00.000Z');
const FUTURO = new Date(Date.now() + 40 * 86400000).toISOString();
const CURSO = 'course-uso-de-tecnologias-avanzadas-en-cosmiatria'; // 2 clases en el catálogo editorial
const EDITORIALES = (JSON.parse(readFileSync(new URL('../content/club/materiales.json', import.meta.url), 'utf8')) as { materiales: { id: string }[] }).materiales.map((m) => m.id);
const QUIZZES = (JSON.parse(readFileSync(new URL('../content/club/quizzes.json', import.meta.url), 'utf8')) as {
  quizzes: { cursoId: string; n: number; preguntas: { correcta: number }[] }[];
}).quizzes;

// Enlaces de prueba (dominios .test / .invalid; ninguno es real).
const DRIVE_PDF = 'https://drive.example.test/file/d/archivo-real-1/view';
const LIVE = 'https://meet.example.test/sala-real';
const GRABACION = 'https://drive.example.test/file/d/grabacion-1/view';

const TOKENS: Record<string, TokenDecodificado> = {
  'tok-vip': { uid: 'u-vip', email: 'vip@example.test', name: 'VIP' },
  'tok-free': { uid: 'u-free', email: 'free@example.test', name: 'Free' },
  'tok-admin': { uid: 'u-admin', email: 'admin@example.test', name: 'Admin' },
};
const verificador = {
  async verifyIdToken(token: string): Promise<TokenDecodificado> {
    const t = TOKENS[token];
    if (!t) throw Object.assign(new Error('bad token'), { code: 'auth/argument-error' });
    return t;
  },
};
const fetchFalso: FetchLike = async () => ({ status: 500, ok: false, json: async () => ({}) });

let db: MemoryFirestore;
let server: Server;
let base: string;

function sembrar(f: MemoryFirestore) {
  f.sembrar('users/u-vip', { name: 'VIP', email: 'vip@example.test', subscription: { status: 'active', plan: 'anual', currentPeriodEnd: FUTURO } });
  f.sembrar('members/u-vip', { id: 'u-vip', uid: 'u-vip', name: 'VIP', email: 'vip@example.test', plan: 'Free', status: 'active', joined: '2025-01-01', courses: 0 });
  f.sembrar('users/u-free', { name: 'Free', email: 'free@example.test' });
  f.sembrar('members/u-free', { id: 'u-free', uid: 'u-free', name: 'Free', email: 'free@example.test', plan: 'Free', status: 'active', joined: '2025-01-01', courses: 0 });
  f.sembrar('admins/u-admin', { email: 'admin@example.test' });
  f.sembrar('users/u-admin', { name: 'Admin', email: 'admin@example.test' });
  f.sembrar('members/u-admin', { id: 'u-admin', uid: 'u-admin', name: 'Admin', email: 'admin@example.test', plan: 'Free', status: 'active', joined: '2025-01-01', courses: 0 });
  f.sembrar(`courses/${CURSO}`, {
    name: 'Tecnologías', status: 'published',
    lessons: [
      { id: `${CURSO}-s01`, name: 'Sesión 01', durationSeconds: 600, isPreview: true, videoId: 'v1' },
      { id: `${CURSO}-s02`, name: 'Sesión 02', durationSeconds: 900, isPreview: false, videoId: 'v2' },
    ],
  });
  // pdfs: forma del panel viejo (addPdf) + demos que nunca deben salir.
  f.sembrar('pdfs/p-1760000000000', { id: 'p-1760000000000', name: 'Protocolo real de limpieza', cat: 'Protocolo', pages: 12, downloads: 3, date: '2026-09-01', drive: DRIVE_PDF, img: '' });
  f.sembrar('pdfs/p-sin-archivo', { id: 'p-sin-archivo', name: 'Manual en preparación', cat: 'Manual', pages: 8, downloads: 0, date: '2026-08-01', drive: '', img: '' });
  f.sembrar('pdfs/p-gratis', { id: 'p-gratis', name: 'Guía abierta', cat: 'Guía', pages: 2, downloads: 0, date: '2026-07-01', drive: 'https://drive.example.test/file/d/abierta/view', img: '', gratis: true });
  f.sembrar('pdfs/p-oculto', { id: 'p-oculto', name: 'Oculto', cat: 'Guía', pages: 2, downloads: 0, date: '2026-07-02', drive: 'https://drive.example.test/file/d/oculto/view', img: '', estado: 'oculto' });
  f.sembrar('pdfs/p-01', { id: 'p-01', name: 'Guía · Protocolos de limpieza facial', cat: 'Guía', pages: 32, downloads: 124, date: '2026-03-05', drive: 'https://drive.google.com/file/d/ejemplo-pdf1', img: '' });
  f.sembrar('pdfs/p-02', { id: 'p-02', name: 'Manual · Tipos de piel', cat: 'Manual', pages: 18, downloads: 89, date: '2026-03-20', drive: '', img: '' });
  f.sembrar('pdfs/p-03', { id: 'p-03', name: 'Fichas técnicas', cat: 'Ficha técnica', pages: 45, downloads: 67, date: '2026-04-10', drive: '', img: '' });
  f.sembrar('pdfs/p-copia-demo', { id: 'p-copia-demo', name: 'Copia demo', cat: 'Guía', pages: 1, downloads: 0, date: '2026-04-11', drive: 'https://drive.google.com/file/d/ejemplo-pdf9', img: '' });
  // webinars: forma del panel viejo (addWebinar) + demos.
  f.sembrar('webinars/w-1760000000000', { id: 'w-1760000000000', title: 'Sesión en vivo real', date: '2026-11-20T19:00', duration: '90 min', speaker: 'Equipo Dermalysse', registered: 4, status: 'scheduled', cv: '', live: LIVE, drive: GRABACION, img: '' });
  f.sembrar('webinars/w-borrador', { id: 'w-borrador', title: 'Borrador', date: '2026-12-01T19:00', duration: '60 min', speaker: 'X', registered: 0, status: 'draft', cv: '', live: '', drive: '', img: '' });
  f.sembrar('webinars/w-01', { id: 'w-01', title: 'Peelings químicos', date: '2026-11-22T19:00', duration: '60 min', speaker: 'Demo', registered: 87, status: 'scheduled', cv: '', live: 'https://zoom.us/j/ejemplo123', drive: '', img: '' });
  f.sembrar('webinars/w-02', { id: 'w-02', title: 'Rutinas', date: '2026-11-29T19:00', duration: '75 min', speaker: 'Demo', registered: 54, status: 'scheduled', cv: '', live: '', drive: '', img: '' });
}

before(async () => {
  db = new MemoryFirestore();
  sembrar(db);
  const app = buildApp(ENV, { firestore: db, verificador, fetch: fetchFalso, ahora: () => AHORA });
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server?.close(); });

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const get = (ruta: string, headers: Record<string, string> = {}) => fetch(base + ruta, { headers });
const send = (ruta: string, method: string, cuerpo?: unknown, headers: Record<string, string> = {}) =>
  fetch(base + ruta, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
const json = (r: Response): Promise<any> => r.json();

// ── Utilidades de formato ──

test('formato viejo: fechas en hora de CDMX y duraciones libres', () => {
  assert.equal(fechaWebinar('2026-11-20T19:00'), '2026-11-21T01:00:00.000Z');
  assert.equal(fechaWebinar('2026-11-20'), '2026-11-20T06:00:00.000Z');
  assert.equal(fechaWebinar('2026-11-20T19:00:00.000Z'), '2026-11-20T19:00:00.000Z');
  assert.equal(fechaWebinar('pronto'), null);
  assert.equal(fechaLegadoDesdeIso('2026-11-21T01:00:00.000Z'), '2026-11-20T19:00');
  assert.equal(minutosDuracion('60 min'), 60);
  assert.equal(minutosDuracion('1 Hora'), 60);
  assert.equal(minutosDuracion('1h 30min'), 90);
  assert.equal(minutosDuracion('45'), 45);
  assert.equal(minutosDuracion(''), 60);
});

// ── /catalogo (público) ──

test('/catalogo: materiales reales + editoriales, sin demos, sin ocultos y SIN enlaces', async () => {
  const r = await get('/catalogo');
  assert.equal(r.status, 200);
  const texto = await r.text();
  const cat = JSON.parse(texto);
  const ids = cat.materiales.map((m: { id: string }) => m.id);
  for (const id of EDITORIALES) assert.ok(ids.includes(id), `falta editorial ${id}`);
  assert.equal(EDITORIALES.length, 5);
  for (const demo of ['p-01', 'p-02', 'p-03', 'p-copia-demo', 'p-oculto']) assert.ok(!ids.includes(demo), `no debe salir ${demo}`);
  assert.deepEqual(ids.slice(0, 3), ['p-1760000000000', 'p-sin-archivo', 'p-gratis']); // más recientes primero

  const real = cat.materiales.find((m: { id: string }) => m.id === 'p-1760000000000');
  assert.deepEqual(real, {
    id: 'p-1760000000000', titulo: 'Protocolo real de limpieza', tipo: 'PDF', categoria: 'Protocolo', area: 'Protocolo', autor: 'Club Dermalysse',
    paginas: 12, portada: '', cursoId: null, descripcion: '', estado: 'disponible', gratis: false, enlaceProtegido: true,
  });
  const pendiente = cat.materiales.find((m: { id: string }) => m.id === 'p-sin-archivo');
  assert.equal(pendiente.estado, 'proximamente');
  assert.equal(pendiente.enlaceProtegido, undefined);

  // Ningún enlace privado ni campo viejo de enlaces en la respuesta pública.
  for (const prohibido of [DRIVE_PDF, LIVE, GRABACION, 'abierta/view', '"drive"', '"live"', '"cv"', 'ejemplo']) {
    assert.ok(!texto.includes(prohibido), `/catalogo filtra ${prohibido}`);
  }
});

test('/catalogo: eventos desde webinars scheduled, sin demos ni borradores', async () => {
  const cat = await json(await get('/catalogo'));
  assert.deepEqual(cat.eventos, [{
    id: 'w-1760000000000', titulo: 'Sesión en vivo real', ponente: 'Equipo Dermalysse', fecha: '2026-11-21T01:00:00.000Z',
    duracionMin: 90, publicado: true, reservas: 4, conTransmision: true, conGrabacion: true,
  }]);
});

// ── Enlaces con sesión ──

test('GET /materiales/:id/acceso: 401 sin sesión, 403 sin VIP, enlace a VIP/admin y a todos si es gratis', async () => {
  assert.equal((await get('/materiales/p-1760000000000/acceso')).status, 401);
  const sinVip = await get('/materiales/p-1760000000000/acceso', auth('tok-free'));
  assert.equal(sinVip.status, 403);
  assert.ok(!(await sinVip.text()).includes(DRIVE_PDF));

  const vip = await get('/materiales/p-1760000000000/acceso', auth('tok-vip'));
  assert.equal(vip.status, 200);
  assert.equal(vip.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await json(vip), { id: 'p-1760000000000', tipo: 'enlace', url: DRIVE_PDF });
  assert.equal(db.crudo('pdfs/p-1760000000000')?.downloads, 4); // suma la descarga que muestra el panel viejo

  assert.equal((await get('/materiales/p-1760000000000/acceso', auth('tok-admin'))).status, 200);
  assert.equal((await json(await get('/materiales/p-gratis/acceso', auth('tok-free')))).url, 'https://drive.example.test/file/d/abierta/view');
});

test('GET /materiales/:id/acceso: 404 demos/ocultos/inexistentes, 409 sin archivo o editorial próximamente', async () => {
  for (const id of ['p-01', 'p-copia-demo', 'p-oculto', 'no-existe', 'a.b']) {
    assert.equal((await get(`/materiales/${id}/acceso`, auth('tok-vip'))).status, 404, id);
  }
  const sinArchivo = await get('/materiales/p-sin-archivo/acceso', auth('tok-vip'));
  assert.equal(sinArchivo.status, 409);
  assert.equal((await json(sinArchivo)).error, 'material/no-disponible');
  assert.equal((await get(`/materiales/${EDITORIALES[0]}/acceso`, auth('tok-vip'))).status, 409);
});

test('GET /eventos/:id/acceso: enlaces solo con sesión VIP o admin; demos y borradores 404', async () => {
  assert.equal((await get('/eventos/w-1760000000000/acceso')).status, 401);
  assert.equal((await get('/eventos/w-1760000000000/acceso', auth('tok-free'))).status, 403);
  assert.deepEqual(await json(await get('/eventos/w-1760000000000/acceso', auth('tok-vip'))), { id: 'w-1760000000000', transmision: LIVE, grabacion: GRABACION });
  assert.equal((await get('/eventos/w-1760000000000/acceso', auth('tok-admin'))).status, 200);
  for (const id of ['w-01', 'w-02', 'w-borrador', 'nada']) assert.equal((await get(`/eventos/${id}/acceso`, auth('tok-vip'))).status, 404, id);
});

// ── Quizzes de clase ──

test('quiz: banco empaquetado sin respuestas en GET; POST califica en servidor', async () => {
  const empaquetado = QUIZZES.find((q) => q.cursoId === CURSO && q.n === 1)!;
  const r = await get(`/quiz/${CURSO}/1`, auth('tok-free')); // clase 1 es abierta (isPreview)
  assert.equal(r.status, 200);
  const texto = await r.text();
  assert.ok(!texto.includes('correcta') && !texto.includes('explicacion'));
  const { preguntas } = JSON.parse(texto);
  assert.equal(preguntas.length, empaquetado.preguntas.length);
  for (const p of preguntas) assert.deepEqual(Object.keys(p).sort(), ['opciones', 'q']);

  assert.equal((await get(`/quiz/${CURSO}/2`, auth('tok-free'))).status, 403); // clase VIP
  assert.equal((await get(`/quiz/${CURSO}/2`)).status, 401);

  const bien = await json(await send(`/quiz/${CURSO}/1`, 'POST', { respuestas: empaquetado.preguntas.map((p) => p.correcta) }, auth('tok-vip')));
  assert.equal(bien.correctas, bien.total);
  assert.equal(bien.aprobado, true);
  assert.ok(!JSON.stringify(bien).includes('"correcta"'));
  const mal = await json(await send(`/quiz/${CURSO}/1`, 'POST', { respuestas: empaquetado.preguntas.map((p) => (p.correcta + 1) % 4) }, auth('tok-vip')));
  assert.equal(mal.correctas, 0);
  assert.equal(mal.aprobado, false);
});

// ── Admin: permisos ──

test('admin de contenido: 401 sin sesión y 403 sin admin', async () => {
  for (const [ruta, metodo] of [
    ['/admin/materiales', 'GET'], ['/admin/materiales', 'POST'], ['/admin/materiales/p-gratis', 'PATCH'], ['/admin/materiales/p-gratis', 'DELETE'],
    ['/admin/materiales/p-gratis/subida', 'POST'], ['/admin/eventos', 'GET'], ['/admin/eventos', 'POST'], ['/admin/eventos/w-borrador', 'PATCH'],
    ['/admin/eventos/w-borrador', 'DELETE'], ['/admin/quizzes', 'GET'], [`/admin/quizzes/${CURSO}_1`, 'PATCH'],
  ] as const) {
    const cuerpo = metodo === 'GET' || metodo === 'DELETE' ? undefined : {};
    assert.equal((await send(ruta, metodo, cuerpo)).status, 401, `${metodo} ${ruta}`);
    assert.equal((await send(ruta, metodo, cuerpo, auth('tok-vip'))).status, 403, `${metodo} ${ruta}`);
  }
  assert.ok(db.crudo('pdfs/p-gratis')); // nada se borró
});

// ── Admin: materiales ──

test('admin materiales: lista con archivo, editoriales de solo lectura y sin demos', async () => {
  const lista = await json(await get('/admin/materiales', auth('tok-admin')));
  const ids = lista.map((m: { id: string }) => m.id);
  for (const demo of ['p-01', 'p-02', 'p-03', 'p-copia-demo']) assert.ok(!ids.includes(demo));
  assert.ok(ids.includes('p-oculto')); // el admin sí ve los ocultos
  assert.equal(lista.find((m: { id: string }) => m.id === 'p-1760000000000').archivo, DRIVE_PDF);
  const editorial = lista.find((m: { id: string }) => m.id === EDITORIALES[0]);
  assert.equal(editorial.editorial, true);

  assert.equal((await send(`/admin/materiales/${EDITORIALES[0]}`, 'PATCH', { titulo: 'X' }, auth('tok-admin'))).status, 409);
  assert.equal((await send(`/admin/materiales/${EDITORIALES[0]}`, 'DELETE', undefined, auth('tok-admin'))).status, 409);
  assert.equal((await send('/admin/materiales/p-01', 'PATCH', { titulo: 'X' }, auth('tok-admin'))).status, 404);
  assert.equal((await send('/admin/materiales/p-gratis/subida', 'POST', { tipo: 'archivo', contentType: 'application/pdf' }, auth('tok-admin'))).status, 501);
});

test('admin materiales: validación', async () => {
  const valido = { id: 'guia-nueva', titulo: 'Guía nueva', tipo: 'PDF', categoria: 'Guía', area: 'Cosmiatría', autor: 'Equipo', paginas: 3, portada: '/media/hidrafacial.png', cursoId: null, descripcion: 'D', estado: 'proximamente' };
  const casos: [Record<string, unknown>, number][] = [
    [{ ...valido, titulo: undefined }, 400],
    [{ ...valido, titulo: '  ' }, 400],
    [{ ...valido, id: 'con espacio' }, 400],
    [{ ...valido, id: 'p-01' }, 400],
    [{ ...valido, tipo: 'Video' }, 400],
    [{ ...valido, paginas: -1 }, 400],
    [{ ...valido, archivo: 'http://drive.example.test/x' }, 400],
    [{ ...valido, archivo: 'https://drive.google.com/file/d/ejemplo-x' }, 400],
    [{ ...valido, estado: 'disponible' }, 400], // disponible exige archivo
    [{ ...valido, estado: 'publicado' }, 400],
    [{ ...valido, cursoId: 'no-existe' }, 400],
    [{ ...valido, portada: 'javascript:alert(1)' }, 400],
    [{ ...valido, id: EDITORIALES[0] }, 409],
    [{ ...valido, id: 'p-gratis' }, 409],
  ];
  for (const [cuerpo, estado] of casos) {
    const r = await send('/admin/materiales', 'POST', cuerpo, auth('tok-admin'));
    assert.equal(r.status, estado, JSON.stringify(cuerpo));
  }
  assert.equal(db.crudo('pdfs/guia-nueva'), undefined);
});

test('admin materiales: crear/editar/borrar con la forma del panel viejo (merge)', async () => {
  const r = await send('/admin/materiales', 'POST', {
    id: 'protocolo-cabina', titulo: 'Protocolo de cabina', tipo: 'Guía', categoria: 'Protocolo', area: 'Estética facial', autor: 'Equipo académico Dermalysse',
    paginas: 6, portada: '/media/hidrafacial.png', cursoId: CURSO, descripcion: 'Pasos de preparación.', estado: 'disponible',
    archivo: 'https://drive.example.test/file/d/cabina/view', url: 'se-ignora',
  }, auth('tok-admin'));
  assert.equal(r.status, 201);
  const creado = await json(r);
  assert.equal(creado.archivo, 'https://drive.example.test/file/d/cabina/view');
  const crudo = db.crudo('pdfs/protocolo-cabina')!;
  // Campos del panel viejo (addPdf) presentes con sus tipos.
  assert.deepEqual(
    { id: crudo.id, name: crudo.name, cat: crudo.cat, pages: crudo.pages, downloads: crudo.downloads, date: crudo.date, drive: crudo.drive, img: crudo.img },
    { id: 'protocolo-cabina', name: 'Protocolo de cabina', cat: 'Protocolo', pages: 6, downloads: 0, date: '2026-10-15', drive: 'https://drive.example.test/file/d/cabina/view', img: '' },
  );
  assert.equal(crudo.url, undefined);
  assert.equal(crudo.portada, undefined); // la portada por defecto del cliente no se guarda

  // Aparece en /catalogo sin el enlace.
  const cat = await (await get('/catalogo')).text();
  assert.ok(cat.includes('"protocolo-cabina"') && !cat.includes('cabina/view'));

  // PATCH parcial: fusiona y conserva lo que usa el panel viejo (downloads, date) y campos desconocidos.
  db.sembrar('pdfs/protocolo-cabina', { ...db.crudo('pdfs/protocolo-cabina')!, downloads: 7, campoDelPanel: 'se conserva' });
  const p = await send('/admin/materiales/protocolo-cabina', 'PATCH', { portada: 'https://drive.example.test/file/d/portada-cabina/view', estado: 'oculto' }, auth('tok-admin'));
  assert.equal(p.status, 200);
  const editado = db.crudo('pdfs/protocolo-cabina')!;
  assert.equal(editado.img, 'https://drive.example.test/file/d/portada-cabina/view');
  assert.equal(editado.downloads, 7);
  assert.equal(editado.date, '2026-10-15');
  assert.equal(editado.campoDelPanel, 'se conserva');
  assert.equal(editado.name, 'Protocolo de cabina');
  assert.ok(!(await (await get('/catalogo')).text()).includes('"protocolo-cabina"')); // oculto ⇒ fuera del catálogo

  // Quitar el archivo de un material disponible ⇒ 400.
  db.sembrar('pdfs/protocolo-cabina', { ...db.crudo('pdfs/protocolo-cabina')!, estado: 'disponible' });
  assert.equal((await send('/admin/materiales/protocolo-cabina', 'PATCH', { archivo: '' }, auth('tok-admin'))).status, 400);

  assert.deepEqual(await json(await send('/admin/materiales/protocolo-cabina', 'DELETE', undefined, auth('tok-admin'))), { ok: true });
  assert.equal(db.crudo('pdfs/protocolo-cabina'), undefined);
  assert.equal((await send('/admin/materiales/protocolo-cabina', 'DELETE', undefined, auth('tok-admin'))).status, 404);
});

test('admin materiales: portada de Drive ⇒ miniatura pública; reenviarla sin cambios no reescribe img', async () => {
  db.sembrar('pdfs/p-con-portada', { id: 'p-con-portada', name: 'Con portada', cat: 'Guía', pages: 4, downloads: 0, date: '2026-06-01', drive: '', img: 'https://drive.google.com/file/d/PortadaReal_123/view' });
  const miniatura = 'https://drive.google.com/thumbnail?id=PortadaReal_123&sz=w800';
  const cat = await json(await get('/catalogo'));
  assert.equal(cat.materiales.find((m: { id: string }) => m.id === 'p-con-portada').portada, miniatura);

  const admin = (await json(await get('/admin/materiales', auth('tok-admin')))).find((m: { id: string }) => m.id === 'p-con-portada');
  // Lo que reenvía el formulario del admin (materialParaApi): el objeto completo con la portada recibida.
  const r = await send('/admin/materiales/p-con-portada', 'PATCH', { ...admin, titulo: 'Con portada (editado)' }, auth('tok-admin'));
  assert.equal(r.status, 200);
  const crudo = db.crudo('pdfs/p-con-portada')!;
  assert.equal(crudo.img, 'https://drive.google.com/file/d/PortadaReal_123/view');
  assert.equal(crudo.name, 'Con portada (editado)');
  assert.equal(crudo.descargas, undefined); // los campos solo de lectura del admin no se escriben
  assert.equal(crudo.editorial, undefined);
  db.sembrar('pdfs/p-con-portada', { ...crudo, estado: 'oculto' });
});

// ── Admin: eventos ──

test('admin eventos: crear (forma del cliente) ⇒ webinars con la forma vieja; editar y borrar', async () => {
  const lista = await json(await get('/admin/eventos', auth('tok-admin')));
  const ids = lista.map((e: { id: string }) => e.id);
  assert.ok(ids.includes('w-borrador') && !ids.includes('w-01') && !ids.includes('w-02'));
  assert.equal(lista.find((e: { id: string }) => e.id === 'w-1760000000000').enlace, LIVE);

  const invalidos: Record<string, unknown>[] = [
    { id: 'x1', titulo: 'T', ponente: 'P', fecha: 'mañana' },
    { id: 'x2', titulo: 'T', ponente: '', fecha: '2026-12-01T01:00:00.000Z' },
    { id: 'x3', titulo: 'T', ponente: 'P', fecha: '2026-12-01T01:00:00.000Z', enlace: 'https://zoom.us/j/ejemplo123' },
    { id: 'x4', titulo: 'T', ponente: 'P', fecha: '2026-12-01T01:00:00.000Z', duracionMin: 0 },
    { id: 'w-01', titulo: 'T', ponente: 'P', fecha: '2026-12-01T01:00:00.000Z' },
    { titulo: 'T', ponente: 'P', fecha: '2026-12-01T01:00:00.000Z' },
  ];
  for (const cuerpo of invalidos) assert.equal((await send('/admin/eventos', 'POST', cuerpo, auth('tok-admin'))).status, 400, JSON.stringify(cuerpo));

  // Cuerpo tal como lo arma src/admin/acciones.ts.
  const r = await send('/admin/eventos', 'POST', {
    id: 'clase-abierta-mo2x', titulo: 'Clase abierta', ponente: 'Equipo académico', fecha: '2026-12-02T01:30:00.000Z', duracionMin: 75,
    enlace: 'https://meet.example.test/clase-abierta', publicado: true, reservas: 0,
  }, auth('tok-admin'));
  assert.equal(r.status, 201);
  assert.equal((await json(r)).fecha, '2026-12-02T01:30:00.000Z');
  assert.deepEqual(db.crudo('webinars/clase-abierta-mo2x'), {
    id: 'clase-abierta-mo2x', title: 'Clase abierta', date: '2026-12-01T19:30', duration: '75 min', speaker: 'Equipo académico',
    cv: '', live: 'https://meet.example.test/clase-abierta', drive: '', img: '', registered: 0, status: 'scheduled',
    actualizado: AHORA.toISOString(), actualizadoPor: 'u-admin',
  });
  assert.equal((await send('/admin/eventos', 'POST', { id: 'clase-abierta-mo2x', titulo: 'T', ponente: 'P', fecha: '2026-12-01T01:00:00.000Z' }, auth('tok-admin'))).status, 409);
  const cat = await (await get('/catalogo')).text();
  assert.ok(cat.includes('"clase-abierta-mo2x"') && !cat.includes('meet.example.test'));

  // Ocultar ⇒ status 'draft' (fuera del club viejo y del nuevo), conservando cv/registered.
  db.sembrar('webinars/clase-abierta-mo2x', { ...db.crudo('webinars/clase-abierta-mo2x')!, cv: 'https://drive.example.test/cv', registered: 9 });
  const p = await json(await send('/admin/eventos/clase-abierta-mo2x', 'PATCH', { publicado: false, reservas: 0 }, auth('tok-admin')));
  assert.equal(p.publicado, false);
  const crudo = db.crudo('webinars/clase-abierta-mo2x')!;
  assert.equal(crudo.status, 'draft');
  assert.equal(crudo.cv, 'https://drive.example.test/cv');
  assert.equal(crudo.registered, 9);
  assert.ok(!(await (await get('/catalogo')).text()).includes('"clase-abierta-mo2x"'));

  assert.equal((await send('/admin/eventos/w-01', 'PATCH', { titulo: 'X' }, auth('tok-admin'))).status, 404);
  assert.deepEqual(await json(await send('/admin/eventos/clase-abierta-mo2x', 'DELETE', undefined, auth('tok-admin'))), { ok: true });
  assert.equal(db.crudo('webinars/clase-abierta-mo2x'), undefined);
});

// ── Admin: quizzes ──

test('admin quizzes: banco completo para el admin; v2_quiz aprobado manda, borrador no', async () => {
  const lista = await json(await get('/admin/quizzes', auth('tok-admin')));
  assert.equal(lista.length, 45);
  const q1 = lista.find((q: { id: string }) => q.id === `${CURSO}_1`);
  assert.equal(q1.estado, 'aprobado');
  assert.equal(typeof q1.preguntas[0].correcta, 'number');

  const nueva = { q: '¿Pregunta editada?', opciones: ['Uno', 'Dos', 'Tres', 'Cuatro'], correcta: 2, explicacion: 'Porque sí.' };
  const invalidos: [string, unknown, number][] = [
    [`${CURSO}_9`, { estado: 'aprobado', preguntas: [nueva] }, 404],
    ['curso-inexistente_1', { estado: 'aprobado', preguntas: [nueva] }, 404],
    [`${CURSO}_1`, { estado: 'publicado', preguntas: [nueva] }, 400],
    [`${CURSO}_1`, { estado: 'aprobado', preguntas: [] }, 400],
    [`${CURSO}_1`, { estado: 'aprobado', preguntas: [{ ...nueva, opciones: ['A', 'a', 'B', 'C'] }] }, 400],
    [`${CURSO}_1`, { estado: 'aprobado', preguntas: [{ ...nueva, correcta: 4 }] }, 400],
    [`${CURSO}_1`, { estado: 'aprobado', preguntas: 'no' }, 400],
  ];
  for (const [id, cuerpo, estado] of invalidos) assert.equal((await send(`/admin/quizzes/${id}`, 'PATCH', cuerpo, auth('tok-admin'))).status, estado, JSON.stringify(cuerpo));

  // Borrador: se guarda en v2_quiz pero los miembros siguen viendo el empaquetado.
  const borrador = await send(`/admin/quizzes/${CURSO}_1`, 'PATCH', { estado: 'borrador', preguntas: [nueva] }, auth('tok-admin'));
  assert.equal(borrador.status, 200);
  assert.equal(db.crudo(`v2_quiz/${CURSO}__1`)?.estado, 'borrador');
  const miembroBorrador = await json(await get(`/quiz/${CURSO}/1`, auth('tok-vip')));
  assert.notEqual(miembroBorrador.preguntas[0].q, nueva.q);

  // Aprobado: v2_quiz manda.
  const aprobado = await json(await send(`/admin/quizzes/${CURSO}_1`, 'PATCH', { estado: 'aprobado', preguntas: [nueva] }, auth('tok-admin')));
  assert.deepEqual(aprobado, { id: `${CURSO}_1`, cursoId: CURSO, n: 1, estado: 'aprobado', preguntas: [nueva], actualizado: AHORA.toISOString() });
  assert.equal(db.crudo(`v2_quiz/${CURSO}__1`)?.por, 'u-admin');
  assert.deepEqual(await json(await get(`/quiz/${CURSO}/1`, auth('tok-vip'))), { preguntas: [{ q: nueva.q, opciones: nueva.opciones }] });
  const resultado = await json(await send(`/quiz/${CURSO}/1`, 'POST', { respuestas: [2] }, auth('tok-vip')));
  assert.deepEqual(resultado, { correctas: 1, total: 1, aprobado: true, detalle: [{ acertada: true, explicacion: 'Porque sí.' }] });
  assert.equal((await json(await get('/admin/quizzes', auth('tok-admin')))).find((q: { id: string }) => q.id === `${CURSO}_1`).preguntas[0].q, nueva.q);
});
