// Modo producción (AUTH_MODE=firebase + DATA_MODE=firestore) armado con buildApp, pero con el
// Firestore FALSO en memoria, un verificador de ID tokens falso y un fetch falso. SIN red.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { buildApp } from '../src/app.js';
import { ErrorConfiguracion } from '../src/config.js';
import { MemoryFirestore } from '../src/adapters/firestore/memoria.js';
import type { CursoEditorial } from '../src/adapters/firestore/club.js';
import { CAMPOS_PROTEGIDOS_USERS } from '../src/adapters/firestore/club.js';
import type { FetchLike } from '../src/adapters/legacy/webhook.js';
import type { TokenDecodificado } from '../src/adapters/firebase/firebaseAuth.js';

// ── Entorno (placeholders, nada real) ──
const CUENTA_FALSA = JSON.stringify({ project_id: 'club-dermalysse', client_email: 'prueba@example.invalid', private_key: 'llave-falsa-de-prueba' });
const ENV = {
  AUTH_MODE: 'firebase', DATA_MODE: 'firestore', FIREBASE_SERVICE_ACCOUNT: CUENTA_FALSA,
  LEGACY_WEBHOOK_URL: 'https://webhook.example.test/', APP_URL: 'https://club.example.test', CORS_ORIGINS: 'https://club.example.test',
  CAMPANA_BIENVENIDA_CODIGO: 'TEST-DERMALYSSE-50',
} as unknown as NodeJS.ProcessEnv;

const FUTURO = new Date(Date.now() + 40 * 86400000).toISOString();
const PASADO = new Date(Date.now() - 40 * 86400000).toISOString();
const VIDEO_IDS = ['aaaaaaaa-1111-2222-3333-444444444444', 'bbbbbbbb-1111-2222-3333-444444444444', 'cccccccc-1111-2222-3333-444444444444'];

const EDITORIAL: CursoEditorial[] = [
  { id: 'course-a', titulo: 'Curso A (editorial)', area: 'Estética facial', nivel: 'Profesional', instructor: 'Equipo', portada: '/cursos/a.jpg', descripcion: 'Descripción A', aprenderas: ['Punto 1'], orden: 2, clasesEsperadas: 3 },
  { id: 'course-b', titulo: 'Curso B', area: 'Nutrición', nivel: 'Básico', instructor: 'Equipo', portada: '/cursos/b.jpg', descripcion: 'B', aprenderas: [], orden: 1, clasesEsperadas: 1 },
];

// ── Tokens falsos ──
const TOKENS: Record<string, TokenDecodificado> = {
  'tok-vip': { uid: 'u-vip', email: 'ana@example.test', name: 'Ana López', picture: 'https://fotos.example.test/ana.png' },
  'tok-nuevo': { uid: 'u-nuevo', email: 'maria@example.test', name: 'María Pérez Gómez', picture: 'https://fotos.example.test/maria.png' },
  'tok-admin': { uid: 'u-admin', email: 'admin@example.test', name: 'Admin' },
  'tok-free': { uid: 'u-free', email: 'free@example.test', name: 'Free' },
  'tok-cortesia': { uid: 'u-cortesia', email: 'cortesia@example.test', name: 'Cortesía' },
};
const verificador = {
  llamadas: [] as { token: string; checkRevoked: boolean }[],
  async verifyIdToken(token: string, checkRevoked: boolean): Promise<TokenDecodificado> {
    this.llamadas.push({ token, checkRevoked });
    if (token === 'tok-red') throw Object.assign(new Error('network'), { code: 'app/network-error' });
    const t = TOKENS[token];
    if (!t) throw Object.assign(new Error('bad token'), { code: 'auth/argument-error' });
    return t;
  },
};

// ── fetch falso del webhook ──
interface Llamada { url: string; headers: Record<string, string>; body: Record<string, unknown> }
let llamadas: Llamada[] = [];
let responder: (url: string, body: Record<string, unknown>) => { status: number; body?: unknown } | 'red' | 'ilegible';
const fetchFalso: FetchLike = async (url, init) => {
  const body = JSON.parse(init.body) as Record<string, unknown>;
  llamadas.push({ url, headers: init.headers, body });
  const r = responder(url, body);
  if (r === 'red') throw new TypeError('fetch failed');
  if (r === 'ilegible') return { status: 200, ok: true, json: async () => { throw new SyntaxError('no json'); } };
  return { status: r.status, ok: r.status < 400, json: async () => r.body };
};

let db: MemoryFirestore;
let server: Server;
let base: string;

function sembrar(f: MemoryFirestore) {
  f.sembrar('users/u-vip', {
    name: 'Ana', lastname: 'López', email: 'ana@example.test', phone: '', city: 'Puebla', bio: 'Bio', gotas: 3, streak: 1, photo: '',
    subscription: { status: 'active', plan: 'anual', currentPeriodEnd: FUTURO, stripeCustomerId: 'cus_prueba', cancelAtPeriodEnd: false },
    progress: { 'course-a': [2, 1] }, settings: { notif_vivo: false },
  });
  f.sembrar('members/u-vip', { id: 'u-vip', uid: 'u-vip', name: 'Ana López', email: 'ana@example.test', plan: 'Free', status: 'active', joined: '2025-01-01', courses: 0 });
  f.sembrar('users/u-vip/courseProgress/course-a', { courseProgress: 67, updatedAt: '2026-05-01T10:00:00.000Z', completedLessonIds: ['course-a-s01', 'course-a-s02-03'] });
  f.sembrar('admins/u-admin', { email: 'admin@example.test' });
  f.sembrar('users/u-admin', { name: 'Admin', lastname: '', email: 'admin@example.test' });
  f.sembrar('members/u-admin', { id: 'u-admin', uid: 'u-admin', name: 'Admin', email: 'admin@example.test', plan: 'Free', status: 'active', joined: '2025-01-01', courses: 0 });
  f.sembrar('users/u-free', { name: 'Free', lastname: 'User', email: 'free@example.test', subscription: { status: 'canceled', plan: 'mensual', currentPeriodEnd: PASADO } });
  f.sembrar('users/u-cortesia', { name: 'Cortesía', lastname: '', email: 'cortesia@example.test', vigenciaHasta: FUTURO });
  f.sembrar('members/u-cortesia', { id: 'u-cortesia', uid: 'u-cortesia', name: 'Cortesía', email: 'cortesia@example.test', plan: 'Free', status: 'active', joined: '2025-01-01', courses: 0 });
  f.sembrar('config/club', { precioMes: 250 });
  f.sembrar('config/platform', { maintenance: false, openRegistration: true });
  f.sembrar('courses/course-a', {
    name: 'Curso A', desc: 'Desc Firestore', cat: 'Cosmiatría', level: 'Profesional', instructor: 'Dra. Ejemplo', status: 'published',
    bunnyCollectionId: 'dddddddd-1111-2222-3333-444444444444',
    lessons: [
      { id: 'course-a-s01', name: 'Sesión 01', durationSeconds: 600, isPreview: true, videoId: VIDEO_IDS[0] },
      { id: 'course-a-s02-03', name: 'Sesiones 02 y 03', durationSeconds: 3000, isPreview: false, videoId: VIDEO_IDS[1] },
      { id: 'course-a-s04', name: 'Sesión 04', dur: '1 h 5 min', videoId: VIDEO_IDS[2] },
    ],
  });
  f.sembrar('courses/course-b', { name: 'Curso B', status: 'draft', lessons: [{ id: 'course-b-s01', name: 'Sesión 01', videoId: VIDEO_IDS[0] }] });
  f.sembrar('courses/course-x', { name: 'Fuera del catálogo', status: 'published', lessons: [{ id: 'x-s01', name: 'S', videoId: VIDEO_IDS[0] }] });
  f.sembrar('certificates/DRML-2026-ABCDEF123456', { code: 'DRML-2026-ABCDEF123456', uid: 'u-vip', userName: 'Ana López', courseId: 'course-a', courseName: 'Curso A', category: 'Cosmiatría', instructor: 'Equipo', lessonCount: 3, status: 'valid', issuedAt: '2026-05-02T00:00:00.000Z' });
  f.sembrar('certificates/DRML-2026-000000000001', { code: 'DRML-2026-000000000001', uid: 'u-otro', userName: 'Otro', courseId: 'course-a', courseName: 'Curso A', status: 'valid', issuedAt: '2026-05-03T00:00:00.000Z' });
  f.sembrar('certificates/DRML-2026-0000000000FF', { code: 'DRML-2026-0000000000FF', uid: 'u-vip', userName: 'Ana López', courseId: 'course-b', courseName: 'Curso B', status: 'revoked', issuedAt: '2026-05-04T00:00:00.000Z' });
  f.sembrar('news/n1', { title: 'Noticia publicada', content: 'Texto', cat: 'Novedad', author: 'Equipo', status: 'published', date: '2026-10-01' });
  f.sembrar('news/n2', { title: 'Borrador', content: 'No', status: 'draft', date: '2026-10-02' });
  f.sembrar('forum/t1', { title: 'Duda de protocolo', tag: 'Consulta', body: 'Cuerpo del tema', authorUid: 'u-otro', authorName: 'Luis Ramos ', createdAt: 1760000000000, replyCount: 1, likes: ['u-otro'], views: 2 });
  f.sembrar('forum/t1/replies/r1', { text: 'Respuesta previa', authorUid: 'u-otro', authorName: 'Luis Ramos', createdAt: 1760000100000 });
  f.sembrar('forum/t2', { title: 'Experiencia', tag: 'Experiencia', body: 'Otro', authorUid: 'u-otro', authorName: 'Luis', createdAt: 1760000200000, replyCount: 0 });
}

before(async () => {
  db = new MemoryFirestore();
  sembrar(db);
  responder = () => ({ status: 500, body: { error: 'no configurado en la prueba' } });
  const app = buildApp(ENV, { firestore: db, verificador, fetch: fetchFalso, catalogoEditorial: EDITORIAL });
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server?.close(); });
beforeEach(() => { llamadas = []; });

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const get = (ruta: string, headers: Record<string, string> = {}) => fetch(base + ruta, { headers });
const send = (ruta: string, method: string, cuerpo?: unknown, headers: Record<string, string> = {}) =>
  fetch(base + ruta, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
const json = (r: Response): Promise<any> => r.json();

// ── Configuración: falla rápido ──

test('config: firebase sin FIREBASE_SERVICE_ACCOUNT o sin LEGACY_WEBHOOK_URL ⇒ ErrorConfiguracion clara', () => {
  assert.throws(() => buildApp({ ...ENV, FIREBASE_SERVICE_ACCOUNT: '' }), (e: unknown) => e instanceof ErrorConfiguracion && /FIREBASE_SERVICE_ACCOUNT/.test(e.message));
  assert.throws(() => buildApp({ ...ENV, LEGACY_WEBHOOK_URL: '' }), (e: unknown) => e instanceof ErrorConfiguracion && /LEGACY_WEBHOOK_URL/.test(e.message));
  assert.throws(() => buildApp({ ...ENV, APP_URL: 'http://club.example.test' }), /APP_URL/);
  assert.throws(() => buildApp({ ...ENV, CORS_ORIGINS: '' }), /CORS_ORIGINS/);
  assert.throws(() => buildApp({ ...ENV, ACADEMIA_MOSTRAR_BORRADORES: 'true' }), /ACADEMIA_MOSTRAR_BORRADORES/);
});

test('config: modos mixtos o desconocidos se rechazan; dev+memoria sigue siendo el predeterminado', () => {
  assert.throws(() => buildApp({ AUTH_MODE: 'dev', DATA_MODE: 'firestore' } as unknown as NodeJS.ProcessEnv), /deben ir juntos/);
  assert.throws(() => buildApp({ AUTH_MODE: 'firebase' } as unknown as NodeJS.ProcessEnv), /deben ir juntos/);
  assert.throws(() => buildApp({ AUTH_MODE: 'otro' } as unknown as NodeJS.ProcessEnv), /AUTH_MODE/);
  assert.doesNotThrow(() => buildApp({} as NodeJS.ProcessEnv));
});

test('config: el JSON inválido NO se cita en el error; otro proyecto se rechaza', () => {
  const secreto = '{"private_key":"SECRETO-NO-DEBE-APARECER"';
  assert.throws(() => buildApp({ ...ENV, FIREBASE_SERVICE_ACCOUNT: secreto }), (e: unknown) =>
    e instanceof ErrorConfiguracion && /no es un JSON válido/.test(e.message) && !e.message.includes('SECRETO'));
  const otro = JSON.stringify({ project_id: 'otro-proyecto', client_email: 'x@example.invalid', private_key: 'k' });
  assert.throws(() => buildApp({ ...ENV, FIREBASE_SERVICE_ACCOUNT: otro }), /otro proyecto/);
});

test('GET / — informa modos sin exponer nada sensible', async () => {
  const s = await json(await get('/'));
  assert.deepEqual([s.authMode, s.dataMode], ['firebase', 'firestore']);
});

// ── Auth ──

test('auth: verifica con revocación; token inválido ⇒ 401; falla del servicio ⇒ 500 (nunca un usuario inventado)', async () => {
  verificador.llamadas = [];
  assert.equal((await get('/me', auth('tok-vip'))).status, 200);
  assert.deepEqual(verificador.llamadas.at(-1), { token: 'tok-vip', checkRevoked: true });
  assert.equal((await get('/me', auth('basura'))).status, 401);
  assert.equal((await get('/me')).status, 401);
  assert.equal((await get('/me', auth('tok-red'))).status, 500);
});

test('admin = existe admins/{uid}: /admin/academia 200 para admin, 403 para VIP', async () => {
  const me = await json(await get('/me', auth('tok-admin')));
  assert.equal(me.esAdmin, true);
  assert.equal((await json(await get('/me', auth('tok-vip')))).esAdmin, false);
  assert.equal((await get('/admin/academia', auth('tok-admin'))).status, 200);
  assert.equal((await get('/admin/academia', auth('tok-vip'))).status, 403);
});

// ── /me ──

test('GET /me — VIP: plan, vence, motivo de la regla de acceso y perfil con nombres actuales; no escribe nada', async () => {
  const antes = db.escrituras.length;
  const me = await json(await get('/me', auth('tok-vip')));
  assert.equal(me.uid, 'u-vip');
  assert.equal(me.nombre, 'Ana López');
  assert.equal(me.esVip, true);
  assert.equal(me.plan, 'anual');
  assert.equal(me.vence, FUTURO);
  assert.equal(me.motivoAcceso, 'active');
  assert.equal(me.perfil.nombre, 'Ana');
  assert.equal(me.perfil.apellido, 'López');
  assert.equal(me.perfil.ciudad, 'Puebla');
  assert.equal(me.perfil.avisos.enVivo, false); // settings.notif_vivo = false
  assert.equal(me.perfil.avisos.nuevos, true);  // sin valor = activado
  assert.ok(!('subscription' in me.perfil) && !('progress' in me.perfil));
  assert.equal(db.escrituras.length, antes, 'usuario existente: /me no escribe');
});

test('GET /me — cortesía ⇒ plan "cortesia"; suscripción cancelada y vencida ⇒ sin VIP, motivo expired', async () => {
  const c = await json(await get('/me', auth('tok-cortesia')));
  assert.deepEqual([c.esVip, c.plan, c.vence, c.motivoAcceso], [true, 'cortesia', FUTURO, 'courtesy']);
  const f = await json(await get('/me', auth('tok-free')));
  assert.deepEqual([f.esVip, f.plan, f.vence, f.motivoAcceso], [false, null, null, 'expired']);
});

test('GET /me — alta: crea users/{uid} y members/{uid} con la forma EXACTA del club actual, una sola vez', async () => {
  const me = await json(await get('/me', auth('tok-nuevo')));
  assert.equal(me.esVip, false);
  assert.equal(me.motivoAcceso, 'none');
  assert.deepEqual(db.crudo('users/u-nuevo'), {
    name: 'María', lastname: 'Pérez Gómez', email: 'maria@example.test', phone: '', city: '', bio: '', gotas: 0, streak: 0,
    photo: 'https://fotos.example.test/maria.png',
  });
  const member = db.crudo('members/u-nuevo')!;
  assert.match(String(member.joined), /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual({ ...member, joined: 'X' }, {
    id: 'u-nuevo', uid: 'u-nuevo', name: 'María Pérez Gómez', email: 'maria@example.test', plan: 'Free', status: 'active', joined: 'X', courses: 0,
  });
  const antes = db.escrituras.length;
  await get('/me', auth('tok-nuevo'));
  assert.equal(db.escrituras.length, antes, 'la segunda vez no vuelve a escribir');
});

test('GET /me — users existe pero falta members ⇒ crea solo members (sin tocar users)', async () => {
  const antesUser = db.crudo('users/u-free');
  await get('/me', auth('tok-free'));
  assert.deepEqual(db.crudo('users/u-free'), antesUser);
  assert.equal(db.crudo('members/u-free')?.name, 'Free User');
  assert.equal(db.crudo('members/u-free')?.plan, 'Free');
});

test('GET /me — registro cerrado (config/platform.openRegistration=false) ⇒ 403 y no crea nada', async () => {
  const f = new MemoryFirestore();
  f.sembrar('config/platform', { openRegistration: false });
  const app = buildApp(ENV, { firestore: f, verificador, fetch: fetchFalso, catalogoEditorial: EDITORIAL });
  const s = app.listen(0, '127.0.0.1');
  await new Promise((r) => s.once('listening', r));
  const r = await fetch(`http://127.0.0.1:${(s.address() as AddressInfo).port}/me`, { headers: auth('tok-nuevo') });
  s.close();
  assert.equal(r.status, 403);
  assert.equal((await json(r)).error, 'registro-cerrado');
  assert.equal(f.crudo('users/u-nuevo'), undefined);
  assert.equal(f.crudo('members/u-nuevo'), undefined);
});

// ── PATCH /me/perfil ──

test('PATCH /me/perfil — mapea a name/lastname/phone/city/photo/settings.notif_* y NUNCA escribe campos protegidos', async () => {
  const subAntes = db.crudo('users/u-vip')!.subscription;
  const desde = db.escrituras.length;
  const r = await send('/me/perfil', 'PATCH', {
    nombre: '  Ana María ', apellido: 'López', telefono: '2221234567', ciudad: 'CDMX', foto: 'https://fotos.example.test/nueva.png',
    avisos: { enVivo: true, comunidad: false, raro: true },
    subscription: { status: 'active' }, vigenciaHasta: '2099-01-01', progress: { x: [1] }, plan: 'anual', status: 'active', admin: true,
    role: 'admin', uid: 'otro', esVip: true, email: 'otro@example.test',
  }, auth('tok-vip'));
  assert.equal(r.status, 200);
  const perfil = await json(r);
  assert.deepEqual([perfil.nombre, perfil.apellido, perfil.telefono, perfil.ciudad, perfil.foto], ['Ana María', 'López', '2221234567', 'CDMX', 'https://fotos.example.test/nueva.png']);
  assert.equal(perfil.avisos.enVivo, true);
  assert.equal(perfil.avisos.comunidad, false);
  const user = db.crudo('users/u-vip')!;
  assert.deepEqual(user.subscription, subAntes);
  assert.equal(user.vigenciaHasta, undefined);
  assert.deepEqual(user.progress, { 'course-a': [2, 1] });
  assert.equal(user.email, 'ana@example.test');
  assert.deepEqual(user.settings, { notif_vivo: true, notif_comunidad: false });
  for (const w of db.escrituras.slice(desde)) {
    for (const campo of CAMPOS_PROTEGIDOS_USERS) assert.ok(!(campo in (w.datos ?? {})), `escritura con campo protegido ${campo} en ${w.ruta}`);
  }
});

test('PATCH /me/perfil — foto no https o nombre vacío ⇒ 400', async () => {
  assert.equal((await send('/me/perfil', 'PATCH', { foto: 'javascript:alert(1)' }, auth('tok-vip'))).status, 400);
  assert.equal((await send('/me/perfil', 'PATCH', { nombre: '   ' }, auth('tok-vip'))).status, 400);
});

// ── Contenido ──

test('GET /config — precios de config/club (con los mismos valores por defecto que el webhook) y config/platform', async () => {
  const c = await json(await get('/config'));
  assert.deepEqual(c.precios, { mensual: 250, anual: 1799 });
  assert.equal(c.mantenimiento, false);
  assert.equal(c.registroAbierto, true);
});

test('GET /catalogo — publicados y del catálogo; clases por POSICIÓN; sin videoId ni ids de Bunny', async () => {
  const r = await get('/catalogo');
  const texto = await r.text();
  const cat = JSON.parse(texto);
  assert.deepEqual(cat.cursos.map((c: { id: string }) => c.id), ['course-a']); // course-b borrador; course-x fuera del catálogo
  const a = cat.cursos[0];
  assert.equal(a.titulo, 'Curso A');               // nombre vivo de Firestore
  assert.equal(a.area, 'Estética facial');         // taxonomía editorial del club nuevo
  assert.equal(a.portada, '/cursos/a.jpg');
  assert.equal(a.bunnyCollectionId, '');
  assert.deepEqual(a.clases, [
    { n: 1, titulo: 'Sesión 01', duracionMin: 10, gratis: true },
    { n: 2, titulo: 'Sesiones 02 y 03', duracionMin: 50, gratis: false }, // id "-s02-03": manda la posición
    { n: 3, titulo: 'Sesión 04', duracionMin: 65, gratis: false },
  ]);
  assert.ok(!/videoId/.test(texto));
  for (const id of [...VIDEO_IDS, 'dddddddd-1111-2222-3333-444444444444']) assert.ok(!texto.includes(id), 'fuga de id de Bunny');
});

test('GET /noticias — solo publicadas', async () => {
  const { noticias } = await json(await get('/noticias'));
  assert.deepEqual(noticias.map((n: { id: string }) => n.id), ['n1']);
  assert.deepEqual([noticias[0].titulo, noticias[0].texto, noticias[0].fecha, noticias[0].categoria], ['Noticia publicada', 'Texto', '2026-10-01', 'Novedad']);
});

test('GET /liga — sin datos v2_liga: solo la fila del propio usuario (nunca el fixture demo)', async () => {
  const liga = await json(await get('/liga', auth('tok-vip')));
  assert.equal(liga.participantes, 1);
  assert.equal(liga.yo.nombre, (await json(await get('/me', auth('tok-vip')))).nombre); // del token/users, no inventado
});

// ── Avance y certificados ──

test('GET /progreso — users.progress ⇒ vistas ordenadas; porcentaje de courseProgress', async () => {
  const p = await json(await get('/progreso', auth('tok-vip')));
  assert.deepEqual(p['course-a'].vistas, [1, 2]);
  assert.equal(p['course-a'].porcentaje, 67);
  assert.equal(p['course-a'].actualizado, '2026-05-01T10:00:00.000Z');
  assert.deepEqual(await json(await get('/progreso', auth('tok-admin'))), {});
});

test('POST /progreso/:cursoId/vista no existe en producción (solo el webhook acredita)', async () => {
  assert.equal((await send('/progreso/course-a/vista', 'POST', { n: 1, segundos: 9999 }, auth('tok-vip'))).status, 404);
});

test('GET /certificados — solo los válidos del propio uid', async () => {
  const lista = await json(await get('/certificados', auth('tok-vip')));
  assert.deepEqual(lista.map((c: { folio: string }) => c.folio), ['DRML-2026-ABCDEF123456']);
  assert.deepEqual([lista[0].nombre, lista[0].cursoTitulo, lista[0].clases], ['Ana López', 'Curso A', 3]);
});

test('GET /verificar/:folio — público, acepta DRML en minúsculas, sin uid/email; revocado o mal formado ⇒ no válido', async () => {
  const v = await json(await get('/verificar/drml-2026-abcdef123456'));
  assert.deepEqual(v, { valido: true, folio: 'DRML-2026-ABCDEF123456', nombre: 'Ana López', cursoTitulo: 'Curso A', curso: 'Curso A', emitido: '2026-05-02T00:00:00.000Z' });
  assert.ok(!('uid' in v) && !('email' in v));
  assert.equal((await json(await get('/verificar/DRML-2026-0000000000FF'))).valido, false);
  assert.equal((await json(await get('/verificar/DRM-2026-ABC'))).valido, false);
});

// ── Foro (forum + replies) ──

test('foro: leer exige sesión; listado con campos actuales (likes ⇒ útil, replyCount, createdAt ms ⇒ ISO)', async () => {
  assert.equal((await get('/foro')).status, 401);
  const hilos = await json(await get('/foro', auth('tok-vip')));
  assert.deepEqual(hilos.map((h: { id: string }) => h.id), ['t2', 't1']); // createdAt desc
  const t1 = hilos.find((h: { id: string }) => h.id === 't1');
  assert.deepEqual([t1.titulo, t1.texto, t1.autor, t1.util, t1.respuestas, t1.marcadoUtil, t1.etiqueta, t1.tipo],
    ['Duda de protocolo', 'Cuerpo del tema', 'Luis Ramos', 1, 1, false, 'Consulta', 'pregunta']);
  assert.equal(t1.fecha, new Date(1760000000000).toISOString());
});

test('foro: detalle con respuestas y suma una vista (como el club actual)', async () => {
  const d = await json(await get('/foro/t1', auth('tok-vip')));
  assert.equal(d.respuestas.length, 1);
  assert.deepEqual([d.respuestas[0].texto, d.respuestas[0].autor], ['Respuesta previa', 'Luis Ramos']);
  assert.equal(db.crudo('forum/t1')!.views, 3);
  assert.equal((await get('/foro/no-existe', auth('tok-vip'))).status, 404);
});

test('foro: crear tema guarda la forma actual con authorUid del TOKEN y createdAt en ms', async () => {
  const r = await send('/foro', 'POST', { titulo: 'Nuevo tema real', texto: 'Contenido suficiente para publicar.', etiqueta: 'Experiencia', authorUid: 'impostor', autor: 'Impostor' }, auth('tok-vip'));
  assert.equal(r.status, 201);
  const h = await json(r);
  const doc = db.crudo(`forum/${h.id}`)!;
  assert.equal(doc.authorUid, 'u-vip');
  assert.equal(doc.authorName, 'Ana María López');
  assert.equal(doc.tag, 'Experiencia');
  assert.equal(typeof doc.createdAt, 'number');
  assert.deepEqual([doc.title, doc.body, doc.replyCount], ['Nuevo tema real', 'Contenido suficiente para publicar.', 0]);
});

test('foro: responder suma replyCount y lastReplyBy; útil alterna el arreglo likes', async () => {
  const r = await send('/foro/t1/respuestas', 'POST', { texto: 'Gracias por compartir.' }, auth('tok-vip'));
  assert.equal(r.status, 201);
  const resp = await json(r);
  const reply = db.crudo(`forum/t1/replies/${resp.id}`)!;
  assert.deepEqual([reply.text, reply.authorUid, typeof reply.createdAt], ['Gracias por compartir.', 'u-vip', 'number']);
  assert.equal(db.crudo('forum/t1')!.replyCount, 2);
  assert.equal(db.crudo('forum/t1')!.lastReplyBy, 'Ana María López');

  const u1 = await json(await send('/foro/t1/util', 'POST', undefined, auth('tok-vip')));
  assert.deepEqual(u1, { util: 2, marcadoUtil: true });
  assert.deepEqual(db.crudo('forum/t1')!.likes, ['u-otro', 'u-vip']);
  const u2 = await json(await send('/foro/t1/util', 'POST', undefined, auth('tok-vip')));
  assert.deepEqual(u2, { util: 1, marcadoUtil: false });
});

test('foro: escribir exige VIP (regla actual)', async () => {
  assert.equal((await send('/foro', 'POST', { titulo: 'Un titulo valido', texto: 'x'.repeat(20) }, auth('tok-free'))).status, 403);
  assert.equal((await send('/foro/t1/util', 'POST', undefined, auth('tok-free'))).status, 403);
});

// ── Webhook: video ──

test('POST /video/token — clase n ⇒ lessons[n-1].id; reenvía Authorization; mapea la respuesta', async () => {
  responder = (url) => url.endsWith('/bunny/playback')
    ? { status: 200, body: { embedUrl: 'https://iframe.mediadelivery.net/embed/1/x?token=t', expires: 1760000000, preview: false, playbackSessionId: 'a'.repeat(36) } }
    : { status: 500 };
  const r = await send('/video/token', 'POST', { cursoId: 'course-a', n: 2 }, auth('tok-vip'));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store, private');
  assert.deepEqual(await json(r), { embedUrl: 'https://iframe.mediadelivery.net/embed/1/x?token=t', expires: 1760000000, preview: false, playbackSessionId: 'a'.repeat(36) });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, 'https://webhook.example.test/bunny/playback');
  assert.equal(llamadas[0].headers.Authorization, 'Bearer tok-vip');
  assert.deepEqual(llamadas[0].body, { courseId: 'course-a', lessonId: 'course-a-s02-03' });
});

test('POST /video/token — 403 del webhook ⇒ 403 { motivo, desbloqueo }', async () => {
  const unlockAt = Date.parse('2026-11-01T06:00:00.000Z');
  responder = () => ({ status: 403, body: { error: 'Este curso todavía no se ha liberado para tu membresía', reason: 'drip_locked', unlockAt } });
  const r = await send('/video/token', 'POST', { cursoId: 'course-a', n: 3 }, auth('tok-vip'));
  assert.equal(r.status, 403);
  const e = await json(r);
  assert.deepEqual([e.motivo, e.desbloqueo, e.mensaje], ['drip_locked', '2026-11-01T06:00:00.000Z', 'Este curso todavía no se ha liberado para tu membresía']);
  assert.ok(!('unlockAt' in e) && !('reason' in e));
});

test('POST /video/token — webhook caído (5xx, red o respuesta ilegible) ⇒ 502 honesto sin filtrar detalles', async () => {
  responder = () => ({ status: 500, body: { error: 'StripeError: detalle interno' } });
  let r = await send('/video/token', 'POST', { cursoId: 'course-a', n: 1 }, auth('tok-vip'));
  assert.equal(r.status, 502);
  assert.ok(!JSON.stringify(await json(r)).includes('detalle interno'));
  responder = () => 'red';
  r = await send('/video/token', 'POST', { cursoId: 'course-a', n: 1 }, auth('tok-vip'));
  assert.equal(r.status, 502);
  responder = () => 'ilegible';
  r = await send('/video/token', 'POST', { cursoId: 'course-a', n: 1 }, auth('tok-vip'));
  assert.equal(r.status, 502);
  responder = () => ({ status: 200, body: { embedUrl: 'javascript:alert(1)' } });
  r = await send('/video/token', 'POST', { cursoId: 'course-a', n: 1 }, auth('tok-vip'));
  assert.equal(r.status, 502);
});

test('POST /video/token — clase inexistente, curso en borrador o entrada inválida ⇒ 404/400 sin llamar al webhook', async () => {
  assert.equal((await send('/video/token', 'POST', { cursoId: 'course-a', n: 9 }, auth('tok-vip'))).status, 404);
  assert.equal((await send('/video/token', 'POST', { cursoId: 'course-b', n: 1 }, auth('tok-vip'))).status, 404);
  assert.equal((await send('/video/token', 'POST', { cursoId: 'course-a', n: 0 }, auth('tok-vip'))).status, 400);
  assert.equal((await send('/video/token', 'POST', { cursoId: 'course-a', n: 1 })).status, 401);
  assert.equal(llamadas.length, 0);
});

// ── Webhook: eventos de avance ──

test('POST /progreso/:cursoId/evento — reenvía el evento y mapea { completada, ratio, vistas, porcentaje }', async () => {
  responder = () => ({ status: 200, body: { completed: true, completionRatio: 0.91, watchedSeconds: 2730, completedLessonIndexes: [2, 1], courseProgress: 67 } });
  const sesion = 'b'.repeat(36);
  const r = await send('/progreso/course-a/evento', 'POST', { n: 2, playbackSessionId: sesion, positionSeconds: 2800, durationSeconds: 3000, event: 'ended', completada: true }, auth('tok-vip'));
  assert.equal(r.status, 200);
  assert.deepEqual(await json(r), { completada: true, ratio: 0.91, vistas: [1, 2], porcentaje: 67 });
  assert.equal(llamadas[0].url, 'https://webhook.example.test/courses/progress');
  assert.equal(llamadas[0].headers.Authorization, 'Bearer tok-vip');
  assert.deepEqual(llamadas[0].body, { courseId: 'course-a', lessonId: 'course-a-s02-03', playbackSessionId: sesion, positionSeconds: 2800, durationSeconds: 3000, event: 'ended' });
});

test('POST /progreso/:cursoId/evento — sesión inválida ⇒ 400 sin llamar; 410/403 del webhook se propagan', async () => {
  assert.equal((await send('/progreso/course-a/evento', 'POST', { n: 1, playbackSessionId: 'x', positionSeconds: 5 }, auth('tok-vip'))).status, 400);
  assert.equal(llamadas.length, 0);
  responder = () => ({ status: 410, body: { error: 'La sesión de reproducción expiró' } });
  const r = await send('/progreso/course-a/evento', 'POST', { n: 1, playbackSessionId: 'c'.repeat(36), positionSeconds: 5, event: 'timeupdate' }, auth('tok-vip'));
  assert.equal(r.status, 410);
  assert.equal((await json(r)).mensaje, 'La sesión de reproducción expiró');
  responder = () => ({ status: 403, body: { error: 'Esta clase requiere una membresía vigente' } });
  const p = await send('/progreso/course-a/evento', 'POST', { n: 1, playbackSessionId: 'c'.repeat(36), positionSeconds: 5 }, auth('tok-free'));
  assert.equal(p.status, 403);
  assert.equal((await json(p)).motivo, 'sin-acceso');
});

// ── Webhook: certificados ──

test('POST /certificados — lo emite el webhook (folio DRML); 409 honesto si faltan clases', async () => {
  responder = () => ({ status: 200, body: { code: 'DRML-2026-ABCDEF123456', uid: 'u-vip', userName: 'Ana López', courseId: 'course-a', courseName: 'Curso A', category: 'Cosmiatría', lessonCount: 3, status: 'valid', issuedAt: '2026-10-15T00:00:00.000Z' } });
  const r = await send('/certificados', 'POST', { cursoId: 'course-a' }, auth('tok-vip'));
  assert.equal(r.status, 201);
  const c = await json(r);
  assert.deepEqual([c.folio, c.cursoId, c.nombre, c.emitido], ['DRML-2026-ABCDEF123456', 'course-a', 'Ana López', '2026-10-15T00:00:00.000Z']);
  assert.equal(llamadas[0].url, 'https://webhook.example.test/courses/certificate');
  assert.deepEqual(llamadas[0].body, { courseId: 'course-a' });
  assert.equal(llamadas[0].headers.Authorization, 'Bearer tok-vip');

  responder = () => ({ status: 409, body: { error: 'Completa al menos 85% de cada clase para emitir el certificado' } });
  const no = await send('/certificados', 'POST', { cursoId: 'course-a' }, auth('tok-vip'));
  assert.equal(no.status, 409);
});

// ── Webhook: Stripe ──

test('POST /stripe/checkout — plan válido; successUrl con {CHECKOUT_SESSION_ID} hacia la suscripción del club', async () => {
  responder = () => ({ status: 200, body: { url: 'https://checkout.stripe.com/c/pay/cs_prueba', sessionId: 'cs_prueba' } });
  const r = await send('/stripe/checkout', 'POST', { plan: 'anual', successUrl: 'https://malicioso.example', uid: 'otro' }, auth('tok-vip'));
  assert.equal(r.status, 200);
  assert.deepEqual(await json(r), { url: 'https://checkout.stripe.com/c/pay/cs_prueba' });
  assert.equal(llamadas[0].url, 'https://webhook.example.test/create-checkout-session');
  assert.equal(llamadas[0].headers.Authorization, 'Bearer tok-vip');
  assert.deepEqual(llamadas[0].body, {
    plan: 'anual',
    successUrl: 'https://club.example.test/#/suscripcion?pago=exito&session_id={CHECKOUT_SESSION_ID}',
    cancelUrl: 'https://club.example.test/#/suscripcion?pago=cancelado',
  });
  assert.equal((await send('/stripe/checkout', 'POST', { plan: 'vitalicio' }, auth('tok-vip'))).status, 400);
  assert.equal(llamadas.length, 1);
});

test('POST /stripe/portal y /stripe/confirmar', async () => {
  responder = () => ({ status: 200, body: { url: 'https://billing.stripe.com/p/session/prueba' } });
  const p = await json(await send('/stripe/portal', 'POST', undefined, auth('tok-vip')));
  assert.equal(p.url, 'https://billing.stripe.com/p/session/prueba');
  assert.deepEqual(llamadas[0].body, { returnUrl: 'https://club.example.test/#/suscripcion' });

  responder = () => ({ status: 400, body: { error: 'No se encontró suscripción activa' } });
  const sin = await send('/stripe/portal', 'POST', undefined, auth('tok-free'));
  assert.equal(sin.status, 400);
  assert.equal((await json(sin)).mensaje, 'No se encontró suscripción activa');

  assert.deepEqual(await json(await send('/stripe/confirmar', 'POST', { sessionId: 'cs_prueba' }, auth('tok-vip'))), { activa: true, plan: 'anual', vence: FUTURO });
  assert.deepEqual(await json(await send('/stripe/confirmar', 'POST', {}, auth('tok-free'))), { activa: false, plan: 'mensual', vence: PASADO });
});

// ── Stores v2 por HTTP ──

test('experiencias y quiz usan colecciones v2_*', async () => {
  const r = await send('/experiencias', 'POST', { titulo: 'Mi forma de estudiar', texto: 'Repaso cada clase con notas breves al final del día.', categoria: 'aprendizaje', confirmoPrivacidad: true }, auth('tok-vip'));
  assert.equal(r.status, 201);
  const exp = await json(r);
  assert.equal(db.crudo(`v2_experiencias/${exp.id}`)?.titulo, 'Mi forma de estudiar');
  assert.equal(db.crudo(`v2_experiencias/${exp.id}`)?.estado, 'pendiente');
  assert.equal((await json(await get('/experiencias', auth('tok-vip')))).length, 0, 'el aporte espera revisión antes de hacerse público');

  assert.equal((await get('/quiz/course-a/1', auth('tok-vip'))).status, 404); // sin banco ⇒ 404 honesto
  db.sembrar('v2_quiz/course-a__1', { preguntas: [{ q: '¿Pregunta?', opciones: ['a', 'b'], correcta: 1, explicacion: 'porque' }] });
  const q = await json(await get('/quiz/course-a/1', auth('tok-vip')));
  assert.deepEqual(q, { preguntas: [{ q: '¿Pregunta?', opciones: ['a', 'b'] }] });
});

test('academia: avance desde v2_academia_progreso', async () => {
  db.sembrar('v2_academia_progreso/u-vip', { uid: 'u-vip', programas: { 'fundamentos-de-la-piel': { modulos: { 1: { temas: { '1.1': '2026-10-01T00:00:00.000Z' } } } } } });
  const p = await json(await get('/academia/progreso', auth('tok-vip')));
  assert.deepEqual(p['fundamentos-de-la-piel'].modulos['1'].temas, { '1.1': '2026-10-01T00:00:00.000Z' });
});
