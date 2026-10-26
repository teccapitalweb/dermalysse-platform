// Núcleo del admin (/admin/resumen, cursos, miembros, avisos, foro, config) en modo producción armado con
// buildApp, Firestore FALSO en memoria, verificador de tokens falso, fetch falso y reloj fijo. SIN red.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { buildApp } from '../src/app.js';
import { MemoryFirestore } from '../src/adapters/firestore/memoria.js';
import type { FetchLike } from '../src/adapters/legacy/webhook.js';
import type { TokenDecodificado } from '../src/adapters/firebase/firebaseAuth.js';
import { COLECCION_BITACORA_VIP } from '../src/services/vip.js';
import { COLECCION_CORTESIAS_ADMIN } from '../src/services/adminNucleo.js';

const CUENTA_FALSA = JSON.stringify({ project_id: 'club-dermalysse', client_email: 'prueba@example.invalid', private_key: 'llave-falsa-de-prueba' });
const ENV = {
  AUTH_MODE: 'firebase', DATA_MODE: 'firestore', FIREBASE_SERVICE_ACCOUNT: CUENTA_FALSA,
  LEGACY_WEBHOOK_URL: 'https://webhook.example.test/', APP_URL: 'https://club.example.test', CORS_ORIGINS: 'https://club.example.test',
} as unknown as NodeJS.ProcessEnv;

const AHORA = new Date('2026-10-15T12:00:00.000Z');
const DIA = 86_400_000;
const iso = (dias: number) => new Date(AHORA.getTime() + dias * DIA).toISOString();
const fecha = (dias: number) => iso(dias).split('T')[0];

/** Id real del catálogo editorial (api/content/club/cursos.json). */
const CURSO_CATALOGO = 'course-uso-de-tecnologias-avanzadas-en-cosmiatria';
const VIDEO = ['aaaaaaaa-1111-2222-3333-444444444444', 'bbbbbbbb-1111-2222-3333-444444444444'];
const COLECCION_BUNNY = 'dddddddd-1111-2222-3333-444444444444';

const TOKENS: Record<string, TokenDecodificado> = {
  'tok-admin': { uid: 'u-admin', email: 'admin@example.test', name: 'Admin' },
  'tok-vip': { uid: 'u-vip', email: 'ana@example.test', name: 'Ana' },
};
const verificador = {
  async verifyIdToken(token: string): Promise<TokenDecodificado> {
    const t = TOKENS[token];
    if (!t) throw Object.assign(new Error('bad token'), { code: 'auth/argument-error' });
    return t;
  },
};
let llamadasWebhook = 0;
const fetchFalso: FetchLike = async () => { llamadasWebhook++; throw new TypeError('sin red en pruebas'); };

let db: MemoryFirestore;
let server: Server;
let base: string;

function sembrar(f: MemoryFirestore) {
  f.sembrar('admins/u-admin', { email: 'admin@example.test' });
  f.sembrar('users/u-admin', { name: 'Admin', lastname: '', email: 'admin@example.test' });
  f.sembrar('members/u-admin', { id: 'u-admin', uid: 'u-admin', name: 'Admin', email: 'admin@example.test', plan: 'Free', status: 'active', joined: '2025-01-01', courses: 0 });

  f.sembrar('users/u-vip', {
    name: 'Ana', lastname: 'López', email: 'ana@example.test', phone: '5215512345678', _lastLoginDate: fecha(-1),
    subscription: { status: 'active', plan: 'anual', currentPeriodEnd: iso(200), stripeCustomerId: 'cus_secreto', stripeSubscriptionId: 'sub_secreto', cancelAtPeriodEnd: false },
    progress: { [CURSO_CATALOGO]: [1, 2] },
  });
  f.sembrar('members/u-vip', { id: 'u-vip', uid: 'u-vip', name: 'Ana López', email: 'ana@example.test', plan: 'Free', status: 'active', joined: fecha(-10), courses: 0 });
  f.sembrar(`users/u-vip/courseProgress/${CURSO_CATALOGO}`, {
    courseId: CURSO_CATALOGO, courseProgress: 100, updatedAt: iso(-2), completedLessonIds: [`${CURSO_CATALOGO}-s01`, `${CURSO_CATALOGO}-s02`],
    lessonProgress: {
      [`${CURSO_CATALOGO}-s01`]: { completed: true, lastSeenAt: AHORA.getTime() - 3 * DIA },
      [`${CURSO_CATALOGO}-s02`]: { completed: true, lastSeenAt: AHORA.getTime() - 40 * DIA },
    },
  });

  f.sembrar('users/u-cortesia', { name: 'Carla', lastname: '', email: 'carla@example.test', vigenciaHasta: iso(5), regaloDesde: iso(-25) });
  f.sembrar('members/u-cortesia', { id: 'u-cortesia', uid: 'u-cortesia', name: 'Carla', email: 'carla@example.test', plan: 'Free', status: 'active', joined: fecha(-100), courses: 0 });

  // Baja reciente: su periodo pagado terminó hace 10 días.
  f.sembrar('users/u-baja', { name: 'Beto', email: 'beto@example.test', subscription: { status: 'canceled', plan: 'mensual', currentPeriodEnd: iso(-10) } });
  f.sembrar('members/u-baja', { id: 'u-baja', uid: 'u-baja', name: 'Beto', email: 'beto@example.test', plan: 'Free', status: 'active', joined: fecha(-60), courses: 0 });
  // Solo en users (sin members) y sin acceso.
  f.sembrar('users/u-suelto', { name: 'Sol', email: 'sol@example.test', phone: '5213312345678' });

  f.sembrar(`courses/${CURSO_CATALOGO}`, {
    id: CURSO_CATALOGO, name: 'Tecnologías en Cosmiatría', desc: 'Desc', cat: 'Cosmiatría', level: 'Profesional', instructor: 'Equipo',
    status: 'published', releaseType: 'immediate', order: 1, unlockDate: '', temario: '', img: 'img/cursos/x.webp', date: '2025-11-17',
    bunnyCollectionId: COLECCION_BUNNY, videoProvider: 'bunny', previewPolicy: 'first_video_asset',
    lessons: [
      { id: `${CURSO_CATALOGO}-s01`, name: 'Sesión 01', desc: 'D1', dur: '1 h 51 min', durationSeconds: 6650, order: 1, videoId: VIDEO[0], isPreview: true, provider: 'bunny', assetName: 'a.mp4' },
      { id: `${CURSO_CATALOGO}-s02`, name: 'Sesión 02', desc: 'D2', dur: '2 h 6 min', order: 2, videoId: VIDEO[1], isPreview: false, provider: 'bunny', assetName: 'b.mp4' },
    ],
  });
  f.sembrar('courses/borrador-x', { id: 'borrador-x', name: 'Borrador', status: 'draft', order: 2, releaseType: 'drip', lessons: [{ id: 'borrador-x-s01', name: 'S1', videoId: '' }] });

  f.sembrar('certificates/DRML-2026-ABCDEF123456', { code: 'DRML-2026-ABCDEF123456', uid: 'u-vip', courseId: CURSO_CATALOGO, courseName: 'Tecnologías', status: 'valid', issuedAt: iso(-4) });
  f.sembrar('certificates/DRML-2025-000000000001', { code: 'DRML-2025-000000000001', uid: 'u-otro', courseId: CURSO_CATALOGO, status: 'valid', issuedAt: iso(-90) });

  f.sembrar('forum/t1', { title: 'Duda', tag: 'Consulta', body: 'Cuerpo', authorUid: 'u-vip', authorName: 'Ana', createdAt: AHORA.getTime() - 2 * DIA, replyCount: 1, likes: ['u-x'], views: 4 });
  f.sembrar('forum/t2', { title: 'Viejo', tag: 'General', body: 'Viejo', authorUid: 'u-vip', authorName: 'Ana', createdAt: AHORA.getTime() - 50 * DIA, replyCount: 0 });

  f.sembrar('notifications/notif-1', { id: 'notif-1', type: 'curso', title: 'Nuevo curso', msg: 'Ya disponible', recipients: 4, date: '2026-04-25' });
  f.sembrar('notifications/auto1', { type: 'member', title: 'Nuevo miembro registrado', msg: 'X se unió', date: iso(-1), read: false });

  f.sembrar('config/club', { precioMes: 250, actualizadoPor: 'viejo@example.test' });
  f.sembrar('config/platform', { maintenance: false, openRegistration: true, notifNewMember: true });
}

before(async () => {
  db = new MemoryFirestore();
  sembrar(db);
  const app = buildApp(ENV, { firestore: db, verificador, fetch: fetchFalso, ahora: () => AHORA });
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server?.close(); });
beforeEach(() => { llamadasWebhook = 0; });

const ADMIN = { Authorization: 'Bearer tok-admin' };
const VIP = { Authorization: 'Bearer tok-vip' };
const send = (ruta: string, method: string, cuerpo?: unknown, headers: Record<string, string> = {}) =>
  fetch(base + ruta, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
const get = (ruta: string, headers: Record<string, string> = {}) => fetch(base + ruta, { headers });
const json = (r: Response): Promise<any> => r.json();

// ── Acceso ──

const RUTAS: [string, string][] = [
  ['GET', '/admin/resumen'],
  ['GET', '/admin/cursos'], ['POST', '/admin/cursos'], ['PATCH', `/admin/cursos/${CURSO_CATALOGO}`], ['DELETE', '/admin/cursos/borrador-x'],
  ['GET', '/admin/miembros?estado=todos'], ['GET', '/admin/miembros/u-vip'], ['POST', '/admin/miembros/u-vip/cortesia'], ['DELETE', '/admin/miembros/u-vip/cortesia'],
  ['GET', '/admin/avisos'], ['POST', '/admin/avisos'], ['DELETE', '/admin/avisos/notif-1'],
  ['GET', '/admin/foro'], ['PATCH', '/admin/foro/t1'],
  ['GET', '/admin/config'], ['PATCH', '/admin/config'],
];

test('acceso — 401 sin token o con token inválido y 403 para no admin en TODAS las rutas; nada se escribe', async () => {
  const escriturasAntes = db.escrituras.length;
  for (const [metodo, ruta] of RUTAS) {
    const sin = await send(ruta, metodo, metodo === 'GET' ? undefined : {});
    assert.equal(sin.status, 401, `${metodo} ${ruta} sin token`);
    const malo = await send(ruta, metodo, metodo === 'GET' ? undefined : {}, { Authorization: 'Bearer basura' });
    assert.equal(malo.status, 401, `${metodo} ${ruta} token inválido`);
    const vip = await send(ruta, metodo, metodo === 'GET' ? undefined : { dias: 30, motivo: 'x', oculto: true, publicado: false }, VIP);
    assert.equal(vip.status, 403, `${metodo} ${ruta} no admin`);
    assert.equal((await json(vip)).error, 'auth/sin-permiso');
  }
  assert.equal(db.escrituras.length, escriturasAntes);
});

test('acceso — /admin/academia sigue montada por su propia ruta (no se pisa) y las rutas desconocidas dan 404', async () => {
  const academia = await get('/admin/academia', ADMIN);
  assert.equal(academia.status, 200);
  assert.equal((await get('/admin/no-existe', ADMIN)).status, 404);
});

// ── Resumen ──

test('GET /admin/resumen — métricas calculadas de users, members, courseProgress, certificates y forum', async () => {
  const r = await get('/admin/resumen', ADMIN);
  assert.equal(r.status, 200);
  const m = await json(r);
  assert.equal(m.miembrosActivos, 2); // u-vip (Stripe) + u-cortesia (cortesía)
  assert.equal(m.altas30d, 1); // u-vip
  assert.equal(m.bajas30d, 1); // u-baja
  assert.equal(m.clasesVistas30d, 1); // solo la clase completada hace 3 días
  assert.equal(m.certificados30d, 1);
  assert.equal(m.temasForo30d, 1);
  assert.deepEqual(m.cursosTop, [{ cursoId: CURSO_CATALOGO, titulo: 'Tecnologías en Cosmiatría', vistas: 1 }]);
  assert.equal(llamadasWebhook, 0);
});

// ── Cursos ──

test('GET /admin/cursos — forma del cliente, sin videoId ni bunnyCollectionId', async () => {
  const r = await get('/admin/cursos', ADMIN);
  assert.equal(r.status, 200);
  const texto = await r.clone().text();
  for (const secreto of [...VIDEO, COLECCION_BUNNY]) assert.ok(!texto.includes(secreto), `expone ${secreto}`);
  const cursos = await json(r);
  assert.deepEqual(cursos.map((c: any) => c.id), [CURSO_CATALOGO, 'borrador-x']);
  const c = cursos[0];
  assert.equal(c.titulo, 'Tecnologías en Cosmiatría');
  assert.equal(c.area, 'Cosmiatría');
  assert.equal(c.publicado, true);
  assert.equal(c.enCatalogo, true);
  assert.equal(c.bunnyCollectionId, '');
  assert.ok(c.portada.startsWith('/cursos/'));
  assert.deepEqual(c.clases[0], { n: 1, id: `${CURSO_CATALOGO}-s01`, titulo: 'Sesión 01', descripcion: 'D1', duracionMin: 111, gratis: true, conVideo: true, videoId: '' });
  assert.equal(cursos[1].publicado, false);
  assert.equal(cursos[1].clases[0].conVideo, false);
});

test('PATCH /admin/cursos/:id — metadatos con nombres viejos y merge; conserva videoId y campos del panel actual', async () => {
  const antes = db.crudo(`courses/${CURSO_CATALOGO}`)!;
  const cursos = await json(await get('/admin/cursos', ADMIN));
  const c = cursos[0];
  // El cliente manda el curso completo (cursoParaApi): portada, aprenderas, videoId '' y bunnyCollectionId '' se ignoran.
  const cuerpo = {
    ...c, titulo: 'Tecnologías avanzadas', descripcion: 'Nueva descripción', instructor: 'Dra. Ejemplo', area: 'Cosmiatría', nivel: 'Avanzado',
    portada: 'blob:http://x/1', bunnyCollectionId: '', videoId: 'intruso',
    clases: c.clases.map((k: any, i: number) => ({ ...k, titulo: i === 0 ? 'Introducción' : k.titulo, videoId: 'intruso', duracionMin: 5, gratis: !k.gratis })),
  };
  const r = await send(`/admin/cursos/${CURSO_CATALOGO}`, 'PATCH', cuerpo, ADMIN);
  assert.equal(r.status, 200);
  const respuesta = await r.clone().text();
  assert.ok(!respuesta.includes(VIDEO[0]) && !respuesta.includes(COLECCION_BUNNY));
  const d = db.crudo(`courses/${CURSO_CATALOGO}`)!;
  assert.equal(d.name, 'Tecnologías avanzadas');
  assert.equal(d.desc, 'Nueva descripción');
  assert.equal(d.instructor, 'Dra. Ejemplo');
  assert.equal(d.level, 'Avanzado');
  assert.equal(d.status, 'published');
  assert.equal(d.updatedAt, AHORA.toISOString());
  // Campos viejos intactos.
  for (const k of ['bunnyCollectionId', 'img', 'releaseType', 'order', 'unlockDate', 'temario', 'videoProvider', 'previewPolicy', 'date', 'id']) {
    assert.deepEqual(d[k], antes[k], `cambió ${k}`);
  }
  const lessons = d.lessons as any[];
  assert.equal(lessons[0].name, 'Introducción');
  assert.equal(lessons[1].name, 'Sesión 02');
  // videoId, duración, isPreview y demás campos de cada clase se conservan tal cual.
  (antes.lessons as any[]).forEach((l, i) => {
    for (const k of Object.keys(l)) if (k !== 'name') assert.deepEqual(lessons[i][k], l[k], `clase ${i + 1}: cambió ${k}`);
  });
  assert.ok(!('portada' in d) && !('aprenderas' in d) && !('titulo' in d));
});

test('PATCH /admin/cursos/:id — publicar/ocultar y orden como el panel actual (status, order)', async () => {
  assert.equal((await send(`/admin/cursos/${CURSO_CATALOGO}`, 'PATCH', { publicado: false }, ADMIN)).status, 200);
  assert.equal(db.crudo(`courses/${CURSO_CATALOGO}`)!.status, 'draft');
  assert.equal((await send(`/admin/cursos/${CURSO_CATALOGO}`, 'PATCH', { publicado: true }, ADMIN)).status, 200);
  assert.equal(db.crudo(`courses/${CURSO_CATALOGO}`)!.status, 'published');
  assert.equal((await send(`/admin/cursos/${CURSO_CATALOGO}`, 'PATCH', { orden: 3 }, ADMIN)).status, 200);
  assert.equal(db.crudo(`courses/${CURSO_CATALOGO}`)!.order, 3);
  assert.equal((await send(`/admin/cursos/${CURSO_CATALOGO}`, 'PATCH', { orden: 1 }, ADMIN)).status, 200);
});

test('PATCH /admin/cursos/:id — validación y reglas de seguridad', async () => {
  const p = (cuerpo: unknown, id = CURSO_CATALOGO) => send(`/admin/cursos/${id}`, 'PATCH', cuerpo, ADMIN);
  assert.equal((await p({})).status, 400);
  assert.equal((await p({ titulo: '   ' })).status, 400);
  assert.equal((await p({ publicado: 'si' })).status, 400);
  assert.equal((await p({ orden: 0 })).status, 400);
  assert.equal((await p({ orden: 1.5 })).status, 400);
  assert.equal((await p({ titulo: 'x'.repeat(141) })).status, 400);
  assert.equal((await p({ clases: 'no' })).status, 400);
  assert.equal((await p({ titulo: 'X' }, 'no-existe')).status, 404);
  assert.equal((await p({ titulo: 'X' }, 'id%20raro')).status, 404);
  // Agregar/quitar clases o reordenarlas: 409 (cambiaría qué video es la clase n).
  const una = await p({ clases: [{ n: 1, titulo: 'Sola' }] });
  assert.equal(una.status, 409);
  assert.equal((await json(una)).error, 'cursos/estructura-clases');
  const invertidas = await p({ clases: [{ id: `${CURSO_CATALOGO}-s02`, titulo: 'A' }, { id: `${CURSO_CATALOGO}-s01`, titulo: 'B' }] });
  assert.equal(invertidas.status, 409);
  // Publicar un curso con clases sin video: 409.
  const sinVideo = await p({ publicado: true }, 'borrador-x');
  assert.equal(sinVideo.status, 409);
  assert.equal((await json(sinVideo)).error, 'cursos/sin-video');
  // Curso por goteo: su order define el desbloqueo ⇒ no se mueve desde aquí.
  const goteo = await p({ orden: 7 }, 'borrador-x');
  assert.equal(goteo.status, 409);
  assert.equal((await json(goteo)).error, 'cursos/orden-goteo');
  assert.equal(db.crudo('courses/borrador-x')!.order, 2);
});

test('POST /admin/cursos — alta con la forma de addCurso, siempre en borrador y sin videos', async () => {
  const r = await send('/admin/cursos', 'POST', {
    id: 'peelings-quimicos', titulo: 'Peelings químicos', area: 'Estética facial', nivel: 'Básico', instructor: 'Dra. X', descripcion: 'D',
    publicado: true, bunnyCollectionId: 'intruso', portada: '/x.png',
    clases: [{ n: 1, titulo: 'Clase 1', videoId: 'intruso', duracionMin: 30, gratis: true }, { n: 2, titulo: 'Clase 2', videoId: '', duracionMin: null, gratis: false }],
  }, ADMIN);
  assert.equal(r.status, 201);
  const c = await json(r);
  assert.equal(c.publicado, false);
  assert.equal(c.enCatalogo, false);
  const d = db.crudo('courses/peelings-quimicos')!;
  assert.equal(d.status, 'draft');
  assert.equal(d.name, 'Peelings químicos');
  assert.equal(d.cat, 'Estética facial');
  assert.equal(d.releaseType, 'immediate');
  assert.equal(d.order, 3);
  assert.equal(d.img, '');
  assert.ok(!('bunnyCollectionId' in d));
  assert.deepEqual((d.lessons as any[])[0], { id: 'peelings-quimicos-s01', name: 'Clase 1', desc: '', dur: '30 min', videoId: '', drive: '', isPreview: true, order: 1, provider: '' });
  // Duplicado ⇒ 409; validación ⇒ 400.
  assert.equal((await send('/admin/cursos', 'POST', { id: 'peelings-quimicos', titulo: 'Otra', area: 'A', nivel: 'B', clases: [{ titulo: 'C' }] }, ADMIN)).status, 409);
  assert.equal((await send('/admin/cursos', 'POST', { id: 'sin-clases', titulo: 'Otra', area: 'A', nivel: 'B', clases: [] }, ADMIN)).status, 400);
  assert.equal((await send('/admin/cursos', 'POST', { id: '../x', titulo: 'Otra', area: 'A', nivel: 'B', clases: [{ titulo: 'C' }] }, ADMIN)).status, 400);
});

test('DELETE /admin/cursos/:id — solo borradores fuera del catálogo y sin historial', async () => {
  const publicado = await send(`/admin/cursos/${CURSO_CATALOGO}`, 'DELETE', undefined, ADMIN);
  assert.equal(publicado.status, 409);
  assert.ok(db.crudo(`courses/${CURSO_CATALOGO}`));
  // Borrador con avance de un miembro ⇒ 409.
  db.sembrar('users/u-avance', { name: 'Avance', email: 'av@example.test', progress: { 'borrador-x': [1] } });
  const conAvance = await send('/admin/cursos/borrador-x', 'DELETE', undefined, ADMIN);
  assert.equal(conAvance.status, 409);
  assert.equal((await json(conAvance)).error, 'cursos/con-historial');
  assert.equal((await send('/admin/cursos/peelings-quimicos', 'DELETE', undefined, ADMIN)).status, 200);
  assert.equal(db.crudo('courses/peelings-quimicos'), undefined);
  assert.equal((await send('/admin/cursos/peelings-quimicos', 'DELETE', undefined, ADMIN)).status, 404);
});

// ── Miembros ──

test('GET /admin/miembros — members + estado real de users (regla de acceso), sin ids de Stripe', async () => {
  const r = await get('/admin/miembros?estado=todos', ADMIN);
  assert.equal(r.status, 200);
  const texto = await r.clone().text();
  assert.ok(!texto.includes('cus_secreto') && !texto.includes('sub_secreto') && !texto.includes('stripe'));
  const l = await json(r);
  const por = new Map(l.map((m: any) => [m.uid, m]));
  assert.ok(por.has('u-suelto'), 'incluye cuentas de users sin members');
  const ana: any = por.get('u-vip');
  assert.deepEqual(ana, {
    uid: 'u-vip', nombre: 'Ana López', email: 'ana@example.test', telefono: '5215512345678', plan: 'anual', vence: iso(200), alta: `${fecha(-10)}T12:00:00.000Z`,
    clasesVistas: 2, ultimaActividad: `${fecha(-1)}T12:00:00.000Z`, cortesiaHasta: null, cortesiaMotivo: '', esVip: true, esAdmin: false,
  });
  assert.equal((por.get('u-suelto') as any).telefono, '5213312345678');
  const carla: any = por.get('u-cortesia');
  assert.equal(carla.plan, 'cortesia');
  assert.equal(carla.cortesiaHasta, iso(5));
  assert.equal(carla.esVip, true);
  const beto: any = por.get('u-baja');
  assert.equal(beto.esVip, false);
  assert.equal(beto.plan, null);
  assert.equal((por.get('u-admin') as any).esAdmin, true);
  // Filtros del servidor.
  assert.deepEqual((await json(await get('/admin/miembros?estado=cortesia', ADMIN))).map((m: any) => m.uid), ['u-cortesia']);
  assert.ok((await json(await get('/admin/miembros?estado=sin', ADMIN))).every((m: any) => !m.esVip));
  assert.equal((await get('/admin/miembros?estado=raro', ADMIN)).status, 400);
});

test('GET /admin/miembros/:uid — detalle con progreso y certificados, sin ids de Stripe', async () => {
  const r = await get('/admin/miembros/u-vip', ADMIN);
  assert.equal(r.status, 200);
  const texto = await r.clone().text();
  assert.ok(!texto.includes('cus_secreto') && !texto.includes('sub_secreto'));
  const d = await json(r);
  assert.equal(d.nombre, 'Ana López');
  assert.equal(d.telefono, '5215512345678');
  assert.equal(d.plan, 'anual');
  assert.equal(d.esVip, true);
  assert.deepEqual(d.suscripcion, { estado: 'active', plan: 'anual', periodoFin: iso(200), cancelaAlFinal: false });
  assert.deepEqual(d.miembro, { plan: 'Free', estado: 'active' });
  assert.equal(d.progreso.length, 1);
  assert.deepEqual(d.progreso[0].vistas, [1, 2]);
  assert.equal(d.progreso[0].total, 2);
  assert.equal(d.progreso[0].certificado, 'DRML-2026-ABCDEF123456');
  assert.deepEqual(d.certificados.map((c: any) => c.folio), ['DRML-2026-ABCDEF123456']);
  assert.equal((await get('/admin/miembros/nadie', ADMIN)).status, 404);
});

test('POST /admin/miembros/:uid/cortesia — regla de vip.ts (extiende desde la vigente), motivo en v2 y sin tocar subscription', async () => {
  const subAntes = db.crudo('users/u-vip')!.subscription;
  const r = await send('/admin/miembros/u-vip/cortesia', 'POST', { dias: 30, motivo: 'Ponente invitada' }, ADMIN);
  assert.equal(r.status, 200);
  const res = await json(r);
  assert.equal(res.cortesiaHasta, iso(30));
  const u = db.crudo('users/u-vip')!;
  assert.deepEqual(u.subscription, subAntes);
  assert.equal(u.vigenciaHasta, iso(30));
  assert.equal(u.regaloDesde, AHORA.toISOString());
  assert.deepEqual(u.progress, { [CURSO_CATALOGO]: [1, 2] });
  const bit = (await db.query(COLECCION_BITACORA_VIP)).map((d) => d.data()!).filter((b) => b.uid === 'u-vip');
  assert.equal(bit.length, 1);
  assert.equal(bit[0].fuente, 'admin');
  assert.equal(bit[0].referencia, 'u-admin');
  assert.equal(db.crudo(`${COLECCION_CORTESIAS_ADMIN}/u-vip`)!.motivo, 'Ponente invitada');

  // Cortesía vigente: se suma a su fecha y conserva regaloDesde (regla del panel actual).
  const r2 = await send('/admin/miembros/u-cortesia/cortesia', 'POST', { dias: 10, motivo: 'Compensación' }, ADMIN);
  assert.equal(r2.status, 200);
  const carla = db.crudo('users/u-cortesia')!;
  assert.equal(carla.vigenciaHasta, iso(15));
  assert.equal(carla.regaloDesde, iso(-25));
  const fila = (await json(await get('/admin/miembros', ADMIN))).find((m: any) => m.uid === 'u-cortesia');
  assert.equal(fila.cortesiaMotivo, 'Compensación');
  const det = await json(await get('/admin/miembros/u-cortesia', ADMIN));
  assert.deepEqual(det.cortesia, { motivo: 'Compensación', hasta: iso(15) });
});

test('POST /admin/miembros/:uid/cortesia — validación; nunca crea cuentas; revocar no está disponible', async () => {
  const c = (uid: string, cuerpo: unknown) => send(`/admin/miembros/${uid}/cortesia`, 'POST', cuerpo, ADMIN);
  for (const cuerpo of [{ dias: 0, motivo: 'x' }, { dias: 367, motivo: 'x' }, { dias: 1.5, motivo: 'x' }, { dias: '7', motivo: 'x' }, { dias: 7 }, { dias: 7, motivo: '  ' }]) {
    assert.equal((await c('u-vip', cuerpo)).status, 400, JSON.stringify(cuerpo));
  }
  assert.equal((await c('u-inexistente', { dias: 7, motivo: 'x' })).status, 404);
  assert.equal(db.crudo('users/u-inexistente'), undefined);
  const rev = await send('/admin/miembros/u-vip/cortesia', 'DELETE', undefined, ADMIN);
  assert.equal(rev.status, 409);
  assert.equal(db.crudo('users/u-vip')!.vigenciaHasta, iso(30));
});

// ── Avisos ──

test('avisos — GET sin alertas internas; POST con la forma de sendNotification(); DELETE', async () => {
  const l = await json(await get('/admin/avisos', ADMIN));
  assert.deepEqual(l.map((a: any) => a.id), ['notif-1']);
  assert.equal(l[0].titulo, 'Nuevo curso');
  assert.equal(l[0].texto, 'Ya disponible');

  const r = await send('/admin/avisos', 'POST', { titulo: 'Clase en vivo', texto: 'Mañana a las 7', enlace: '#/en-vivo' }, ADMIN);
  assert.equal(r.status, 201);
  const aviso = await json(r);
  assert.equal(aviso.id, `notif-${AHORA.getTime()}`);
  assert.deepEqual(db.crudo(`notifications/${aviso.id}`), {
    id: aviso.id, type: 'info', title: 'Clase en vivo', msg: 'Mañana a las 7', recipients: 4, date: '2026-10-15', createdAt: AHORA.toISOString(), link: '#/en-vivo',
  });
  const r2 = await send('/admin/avisos', 'POST', { titulo: 'Otro', texto: 'Mismo instante', enlace: null }, ADMIN);
  assert.equal((await json(r2)).id, `notif-${AHORA.getTime()}-1`);
  assert.equal((await json(await get('/admin/avisos', ADMIN)))[0].fecha, AHORA.toISOString());

  for (const cuerpo of [{ texto: 'x' }, { titulo: 'x' }, { titulo: 'x', texto: 'y', enlace: 'javascript:alert(1)' }, { titulo: 'x', texto: 'y', tipo: 'member' }]) {
    assert.equal((await send('/admin/avisos', 'POST', cuerpo, ADMIN)).status, 400, JSON.stringify(cuerpo));
  }
  assert.equal((await send('/admin/avisos/auto1', 'DELETE', undefined, ADMIN)).status, 404);
  assert.equal((await send('/admin/avisos/notif-1', 'DELETE', undefined, ADMIN)).status, 200);
  assert.equal(db.crudo('notifications/notif-1'), undefined);
});

// ── Foro ──

test('foro — GET incluye ocultos; PATCH oculta con merge y el club nuevo deja de listarlo', async () => {
  const l = await json(await get('/admin/foro', ADMIN));
  assert.deepEqual(l.map((h: any) => h.id), ['t1', 't2']);
  assert.equal(l[0].oculto, false);
  assert.equal(l[0].respuestas, 1);
  assert.equal(l[0].util, 1);

  const r = await send('/admin/foro/t1', 'PATCH', { oculto: true }, ADMIN);
  assert.equal(r.status, 200);
  assert.equal((await json(r)).oculto, true);
  const d = db.crudo('forum/t1')!;
  assert.equal(d.oculto, true);
  assert.equal(d.title, 'Duda');
  assert.deepEqual(d.likes, ['u-x']);
  assert.equal(d.replyCount, 1);
  const publico = await json(await get('/foro', VIP));
  assert.ok(!publico.some((h: any) => h.id === 't1'));
  assert.equal((await json(await get('/admin/foro', ADMIN)))[0].oculto, true);

  assert.equal((await send('/admin/foro/t1', 'PATCH', { oculto: false }, ADMIN)).status, 200);
  assert.ok((await json(await get('/foro', VIP))).some((h: any) => h.id === 't1'));
  assert.equal((await send('/admin/foro/t1', 'PATCH', { oculto: 'si' }, ADMIN)).status, 400);
  assert.equal((await send('/admin/foro/nada', 'PATCH', { oculto: true }, ADMIN)).status, 404);
});

// ── Configuración ──

test('config — GET con precios por defecto del webhook; PATCH con nombres viejos, merge y validación', async () => {
  const c = await json(await get('/admin/config', ADMIN));
  assert.deepEqual(c.precios, { mensual: 250, anual: 1799 });
  assert.equal(c.mantenimiento, false);
  assert.equal(c.registroAbierto, true);

  const r = await send('/admin/config', 'PATCH', {
    precios: { mensual: 299, anual: 2499 }, descuentoVIP: 15, whatsappSoporte: '5212221234567', canalWhatsApp: 'https://chat.whatsapp.com/abc',
    mantenimiento: true, registroAbierto: false,
  }, ADMIN);
  assert.equal(r.status, 200);
  const nueva = await json(r);
  assert.deepEqual(nueva.precios, { mensual: 299, anual: 2499 });
  assert.equal(nueva.mantenimiento, true);
  assert.deepEqual(db.crudo('config/club'), {
    precioMes: 299, precioAno: 2499, descuentoVIP: 15, whatsappSoporte: '5212221234567', canalWhatsApp: 'https://chat.whatsapp.com/abc',
    actualizadoPor: 'admin@example.test', actualizadoEn: AHORA.toISOString(),
  });
  assert.deepEqual(db.crudo('config/platform'), { maintenance: true, openRegistration: false, notifNewMember: true });
  // La config pública del club nuevo lee lo mismo.
  const publica = await json(await get('/config'));
  assert.deepEqual(publica.precios, { mensual: 299, anual: 2499 });
  assert.equal(publica.registroAbierto, false);

  for (const cuerpo of [
    {}, { precios: { mensual: 5 } }, { precios: { anual: 99.5 } }, { precios: { mensual: '200' } }, { descuentoVIP: 101 },
    { whatsappSoporte: '12-34' }, { canalWhatsApp: 'http://inseguro.test' }, { mantenimiento: 'si' },
  ]) {
    assert.equal((await send('/admin/config', 'PATCH', cuerpo, ADMIN)).status, 400, JSON.stringify(cuerpo));
  }
  assert.equal(db.crudo('config/club')!.precioMes, 299);
  await send('/admin/config', 'PATCH', { mantenimiento: false, registroAbierto: true }, ADMIN);
});

test('modo desarrollo — el módulo se monta y exige admin (el usuario dev no lo es)', async () => {
  const app = buildApp({} as NodeJS.ProcessEnv, { firestore: new MemoryFirestore(), ahora: () => AHORA });
  const s = await new Promise<Server>((resolve) => { const x = app.listen(0, '127.0.0.1', () => resolve(x)); });
  try {
    const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}/admin/resumen`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: { Authorization: 'Bearer dev' } })).status, 403);
  } finally { s.close(); }
});
