import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { buildApp } from '../src/app.js';

let server: Server;
let base: string;

before(async () => {
  const app = buildApp({ AUTH_MODE: 'dev', CORS_ORIGINS: 'http://localhost:5173' } as NodeJS.ProcessEnv);
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

after(() => { server?.close(); });

const get = (ruta: string, headers?: Record<string, string>) => fetch(base + ruta, { headers });
const postJson = (ruta: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
// Response.json() es `unknown` bajo los tipos de Node; en pruebas lo tratamos como dinámico.
const body = (r: Response): Promise<any> => r.json();
const DEV = { Authorization: 'Bearer dev-token' };

test('GET /config — forma { precios, descuentoVIP, contacto }', async () => {
  const r = await get('/config');
  assert.equal(r.status, 200);
  const c = await body(r);
  assert.ok(c.precios && typeof c.precios.mensual === 'number' && typeof c.precios.anual === 'number');
  assert.equal(typeof c.descuentoVIP, 'number');
  assert.ok(c.contacto && 'whatsappSoporte' in c.contacto);
});

test('GET /catalogo — CatalogoRemoto sin URLs premium', async () => {
  const r = await get('/catalogo');
  assert.equal(r.status, 200);
  const cat = await body(r);
  assert.ok(Array.isArray(cat.cursos) && cat.cursos.length === 2);
  assert.ok(Array.isArray(cat.materiales) && Array.isArray(cat.eventos));
  assert.ok(cat.config?.precios);
  for (const curso of cat.cursos) {
    assert.equal(curso.bunnyCollectionId, '');
    for (const clase of curso.clases) assert.equal(clase.videoId, '');
  }
});

test('GET /noticias — { noticias: [] } honesto', async () => {
  const r = await get('/noticias');
  assert.equal(r.status, 200);
  const data = await body(r);
  assert.ok(Array.isArray(data.noticias));
});

test('GET /foro — listado con respuestas como conteo', async () => {
  const r = await get('/foro');
  assert.equal(r.status, 200);
  const hilos = await body(r);
  assert.ok(Array.isArray(hilos) && hilos.length === 2);
  assert.equal(typeof hilos[0].respuestas, 'number');
  assert.equal(hilos[0].respuestas, 1);
});

test('GET /foro/:id — detalle y 404 honesto', async () => {
  const ok = await get('/foro/hilo-ejemplo-1');
  assert.equal(ok.status, 200);
  const detalle = await body(ok);
  assert.equal(detalle.hilo.id, 'hilo-ejemplo-1');
  assert.ok(Array.isArray(detalle.respuestas) && detalle.respuestas.length === 1);

  const nope = await get('/foro/no-existe');
  assert.equal(nope.status, 404);
});

test('GET /me — 401 sin token, usuario dev con token', async () => {
  const sin = await get('/me');
  assert.equal(sin.status, 401);

  const con = await get('/me', DEV);
  assert.equal(con.status, 200);
  const me = await body(con);
  assert.equal(me.uid, 'dev-uid');
  assert.equal(me.esVip, true);
  assert.equal(me.esAdmin, false);
  assert.ok('perfil' in me);
});

test('GET /experiencias — requiere sesión y lista vacía honesta al inicio', async () => {
  assert.equal((await get('/experiencias')).status, 401);
  const r = await get('/experiencias', DEV);
  assert.equal(r.status, 200);
  const lista = await body(r);
  assert.deepEqual(lista, []);
});

test('POST /experiencias — 401 sin token', async () => {
  const r = await postJson('/experiencias', { titulo: 'Un titulo valido', texto: 'x'.repeat(30), categoria: 'aprendizaje' });
  assert.equal(r.status, 401);
});

test('POST /experiencias — 400 con título corto', async () => {
  const r = await postJson('/experiencias', { titulo: 'ab', texto: 'x'.repeat(30), categoria: 'aprendizaje' }, DEV);
  assert.equal(r.status, 400);
  const e = await body(r);
  assert.match(e.mensaje, /t[ií]tulo/i);
});

test('POST /experiencias — crea y el servidor asigna id/fecha/autor; el cuerpo no es autoridad', async () => {
  const r = await postJson('/experiencias', {
    titulo: 'Como organizo mis notas de clase',
    texto: 'Separo cada tema en bloques cortos y los repaso al final del dia. ' + 'x'.repeat(5),
    categoria: 'organizacion',
    anonima: false,
    confirmoPrivacidad: true,
    autor: 'Impostor', id: 'forzado', esAdmin: true, uid: 'otro',
  }, DEV);
  assert.equal(r.status, 201);
  const exp = await body(r);
  assert.notEqual(exp.id, 'forzado');
  assert.equal(exp.autor, 'Usuario Demo (dev)');
  assert.equal(exp.categoria, 'organizacion');
  assert.equal(exp.estado, 'pendiente');
  assert.equal(exp.autorUid, undefined, 'la identidad interna no vuelve al cliente');
  assert.ok(exp.fecha && !Number.isNaN(Date.parse(exp.fecha)));
});

test('POST /experiencias — anonima=true ⇒ autor "Miembro del club"', async () => {
  const r = await postJson('/experiencias', {
    titulo: 'Una pregunta antes de estudiar',
    texto: 'Escribo una pregunta que quiero responder al terminar la sesion. ' + 'x'.repeat(5),
    categoria: 'aprendizaje',
    anonima: true,
    confirmoPrivacidad: true,
  }, DEV);
  assert.equal(r.status, 201);
  const exp = await body(r);
  assert.equal(exp.autor, 'Miembro del club');
});

test('GET /experiencias — los envíos pendientes no son públicos; cada miembro ve su estado', async () => {
  const porCategoria = await body(await get('/experiencias?categoria=organizacion', DEV));
  assert.deepEqual(porCategoria, []);

  const porTexto = await body(await get('/experiencias?q=pregunta', DEV));
  assert.deepEqual(porTexto, []);

  const propias = await body(await get('/experiencias/mias', DEV));
  assert.equal(propias.length, 2);
  assert.ok(propias.every((e: { estado: string }) => e.estado === 'pendiente'));
  assert.ok(propias.some((e: { titulo: string; texto: string }) => /pregunta/i.test(e.titulo + ' ' + e.texto)));

  const todas = await body(await get('/experiencias', DEV));
  assert.deepEqual(todas, []);
});

test('POST /experiencias — exige confirmar que el aporte protege datos personales', async () => {
  const r = await postJson('/experiencias', {
    titulo: 'Una práctica de estudio reflexiva', texto: 'Comparto una reflexión educativa sin datos personales de pacientes.', categoria: 'aprendizaje',
  }, DEV);
  assert.equal(r.status, 400);
  assert.match((await body(r)).mensaje, /confirma/i);
});
