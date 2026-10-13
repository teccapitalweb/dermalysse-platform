import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp, seleccionarAuth } from '../src/app.js';
import { FixtureContentStore } from '../src/adapters/dev/fixtureContent.js';
import { MemoryExperienceStore } from '../src/adapters/dev/memoryExperiences.js';
import { FixtureLearningStore } from '../src/adapters/dev/fixtureQuizzes.js';
import { MemoryProgressStore } from '../src/adapters/dev/memoryProgress.js';
import { MemoryCertificateStore } from '../src/adapters/dev/memoryCertificates.js';
import { FixtureLeagueStore } from '../src/adapters/dev/fixtureLeague.js';
import { MemoryForumStore } from '../src/adapters/dev/memoryForum.js';
import { MemoryProfileStore } from '../src/adapters/dev/memoryProfile.js';
import { LearningService } from '../src/services/learning.js';

let server: Server;
let base: string;

before(async () => {
  const content = new FixtureContentStore();
  const app = createApp({
    auth: seleccionarAuth('dev'),
    content,
    experiences: new MemoryExperienceStore(),
    learning: new LearningService(content, new FixtureLearningStore(), new MemoryProgressStore(), new MemoryCertificateStore()),
    league: new FixtureLeagueStore(),
    forum: new MemoryForumStore(),
    profiles: new MemoryProfileStore(),
    corsOrigins: ['http://localhost:5173'],
  });
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server?.close(); });

const get = (ruta: string, headers?: Record<string, string>) => fetch(base + ruta, { headers });
const send = (ruta: string, method: string, body?: unknown, headers: Record<string, string> = {}) =>
  fetch(base + ruta, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const body = (r: Response): Promise<any> => r.json();
const DEV = { Authorization: 'Bearer dev-token' };

// ── /liga ──
test('GET /liga — 401 sin token', async () => {
  assert.equal((await get('/liga')).status, 401);
});

test('GET /liga — con token: clasificación de fixture + "yo" del usuario', async () => {
  const r = await get('/liga', DEV);
  assert.equal(r.status, 200);
  const liga = await body(r);
  assert.ok(Array.isArray(liga.clasificacion) && liga.clasificacion.length >= 1);
  assert.equal(liga.participantes, liga.clasificacion.length);
  assert.ok(liga.yo && liga.yo.esYo === true);
  assert.equal(liga.yo.nombre, 'Usuario Demo (dev)'); // del token, no inventado
  assert.ok(typeof liga.actualizado === 'string');
});

// ── foro (escritura, VIP) ──
test('POST /foro — 401 sin token', async () => {
  assert.equal((await send('/foro', 'POST', { titulo: 'Un titulo valido', texto: 'x'.repeat(20) })).status, 401);
});

test('POST /foro — 403 si el usuario no es VIP', async () => {
  // Un AuthAdapter que resuelve un usuario sin VIP.
  const noVip = {
    modo: 'dev-free',
    async verificar() { return { uid: 'u-free', email: 'free@local', esVip: false, esAdmin: false, nombre: 'Free' }; },
  };
  const content = new FixtureContentStore();
  const app = createApp({
    auth: noVip, content, experiences: new MemoryExperienceStore(),
    learning: new LearningService(content, new FixtureLearningStore(), new MemoryProgressStore(), new MemoryCertificateStore()),
    league: new FixtureLeagueStore(), forum: new MemoryForumStore(), profiles: new MemoryProfileStore(),
    corsOrigins: [],
  });
  const s = app.listen(0, '127.0.0.1');
  await new Promise((r) => s.once('listening', r));
  const b = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  const res = await fetch(`${b}/foro`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' }, body: JSON.stringify({ titulo: 'Un titulo valido', texto: 'x'.repeat(20) }) });
  assert.equal(res.status, 403);
  s.close();
});

test('POST /foro — crea hilo; el servidor asigna autor del token (ignora el del cuerpo)', async () => {
  const r = await send('/foro', 'POST', { titulo: 'Como repaso mis notas', texto: 'Comparto un metodo que me funciono muy bien.', autor: 'Impostor', id: 'forzado', esVip: false }, DEV);
  assert.equal(r.status, 201);
  const h = await body(r);
  assert.notEqual(h.id, 'forzado');
  assert.equal(h.autor, 'Usuario Demo (dev)');
  assert.equal(h.respuestas, 0);
  assert.equal(h.util, 0);
  // aparece en el listado
  const lista = await body(await get('/foro'));
  assert.ok(lista.some((x: { id: string }) => x.id === h.id));
});

test('POST /foro — 400 con título corto', async () => {
  const r = await send('/foro', 'POST', { titulo: 'ab', texto: 'x'.repeat(20) }, DEV);
  assert.equal(r.status, 400);
});

test('POST /foro/:id/respuestas — crea respuesta; 404 si el hilo no existe', async () => {
  const ok = await send('/foro/hilo-ejemplo-1/respuestas', 'POST', { texto: 'Gracias por compartir, muy util.' }, DEV);
  assert.equal(ok.status, 201);
  const resp = await body(ok);
  assert.equal(resp.autor, 'Usuario Demo (dev)');
  assert.ok(resp.id && resp.fecha);

  const nope = await send('/foro/no-existe/respuestas', 'POST', { texto: 'Hola, texto valido.' }, DEV);
  assert.equal(nope.status, 404);
});

test('POST /foro/:id/util — alterna útil y responde conteo', async () => {
  const antes = await body(await get('/foro/hilo-ejemplo-1'));
  const baseUtil = antes.hilo.util;
  const r1 = await body(await send('/foro/hilo-ejemplo-1/util', 'POST', undefined, DEV));
  assert.equal(r1.util, baseUtil + 1);
  assert.equal(r1.marcadoUtil, true);
  const r2 = await body(await send('/foro/hilo-ejemplo-1/util', 'POST', undefined, DEV));
  assert.equal(r2.util, baseUtil); // alterna de vuelta
  assert.equal(r2.marcadoUtil, false);
});

// ── /me/perfil ──
test('PATCH /me/perfil — 401 sin token', async () => {
  assert.equal((await send('/me/perfil', 'PATCH', { nombre: 'X' })).status, 401);
});

test('PATCH /me/perfil — actualiza solo el propio perfil; ignora uid/rol del cuerpo', async () => {
  const r = await send('/me/perfil', 'PATCH', { nombre: 'Dra. Ejemplo', whatsapp: '555', ciudad: 'CDMX', uid: 'otro', esAdmin: true, esVip: false }, DEV);
  assert.equal(r.status, 200);
  const perfil = await body(r);
  assert.equal(perfil.nombre, 'Dra. Ejemplo');
  assert.equal(perfil.ciudad, 'CDMX');
  assert.ok(!('uid' in perfil) && !('esAdmin' in perfil)); // no refleja campos no permitidos
  // se refleja en GET /me y NO cambió uid/esVip (siguen del token)
  const me = await body(await get('/me', DEV));
  assert.equal(me.uid, 'dev-uid');
  assert.equal(me.esVip, true);
  assert.equal(me.perfil.nombre, 'Dra. Ejemplo');
});
