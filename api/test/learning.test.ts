import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { buildApp } from '../src/app.js';

let server: Server;
let base: string;
let folioEmitido = '';

before(async () => {
  const app = buildApp({ AUTH_MODE: 'dev' } as NodeJS.ProcessEnv);
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server?.close(); });

const get = (ruta: string, headers?: Record<string, string>) => fetch(base + ruta, { headers });
const postJson = (ruta: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const body = (r: Response): Promise<any> => r.json();
const DEV = { Authorization: 'Bearer dev-token' };

test('AUTH: endpoints de aprendizaje exigen token (401 sin él)', async () => {
  assert.equal((await get('/quiz/curso-ejemplo-1/1')).status, 401);
  assert.equal((await postJson('/quiz/curso-ejemplo-1/1', { respuestas: [0] })).status, 401);
  assert.equal((await get('/progreso')).status, 401);
  assert.equal((await postJson('/progreso/curso-ejemplo-1/vista', { n: 1 })).status, 401);
  assert.equal((await get('/certificados')).status, 401);
  assert.equal((await postJson('/certificados', { cursoId: 'curso-ejemplo-1' })).status, 401);
});

test('GET /quiz — NO expone respuestas correctas ni explicación', async () => {
  const r = await get('/quiz/curso-ejemplo-1/1', DEV);
  assert.equal(r.status, 200);
  const data = await body(r);
  assert.ok(Array.isArray(data.preguntas) && data.preguntas.length === 2);
  for (const p of data.preguntas) {
    assert.deepEqual(Object.keys(p).sort(), ['opciones', 'q']); // solo q + opciones
    assert.ok(!('correcta' in p) && !('explicacion' in p));
  }
  assert.ok(!/correcta/.test(JSON.stringify(data))); // ni rastro del índice correcto
});

test('POST /quiz — califica en el servidor y NO revela el índice correcto', async () => {
  // Respuestas: 1ª correcta (correcta=1), 2ª incorrecta (correcta=0, enviamos 1)
  const r = await postJson('/quiz/curso-ejemplo-1/1', { respuestas: [1, 1] }, DEV);
  assert.equal(r.status, 200);
  const res = await body(r);
  assert.equal(res.total, 2);
  assert.equal(res.correctas, 1);
  assert.equal(typeof res.aprobado, 'boolean');
  for (const d of res.detalle) {
    assert.ok('acertada' in d && 'explicacion' in d);
    assert.ok(!('correcta' in d)); // nunca el índice correcto
  }
  assert.ok(!/"correcta"/.test(JSON.stringify(res)));
});

test('GET /quiz — 404 honesto si la clase no tiene quiz', async () => {
  const r = await get('/quiz/curso-ejemplo-1/99', DEV);
  assert.equal(r.status, 404);
});

test('POST /progreso — rechaza saltarse la clase anterior (409)', async () => {
  // La clase 2 (premium) exige la 1 acreditada.
  const r = await postJson('/progreso/curso-ejemplo-1/vista', { n: 2, segundos: 700 }, DEV);
  assert.equal(r.status, 409);
});

test('POST /progreso — no acredita con tiempo insuficiente (<85%)', async () => {
  const r = await postJson('/progreso/curso-ejemplo-1/vista', { n: 1, segundos: 100 }, DEV); // 480s*0.85=408
  assert.equal(r.status, 200);
  const res = await body(r);
  assert.equal(res.acreditada, false);
  assert.deepEqual(res.progreso.vistas, []);
});

test('POST /progreso — el cuerpo NO puede declararse completado/acreditado', async () => {
  const r = await postJson('/progreso/curso-ejemplo-1/vista',
    { n: 1, segundos: 10, completado: true, acreditada: true, vistas: [1, 2] }, DEV);
  assert.equal(r.status, 200);
  const res = await body(r);
  assert.equal(res.acreditada, false);         // el tiempo manda, no el cuerpo
  assert.deepEqual(res.progreso.vistas, []);    // no se coló [1,2]
});

test('POST /progreso — acredita con ≥85% y respeta el orden; completar emite certificado', async () => {
  // Clase 1 (480s): 0.85*480=408 → 420 acredita.
  const c1 = await body(await postJson('/progreso/curso-ejemplo-1/vista', { n: 1, segundos: 420 }, DEV));
  assert.equal(c1.acreditada, true);
  assert.deepEqual(c1.progreso.vistas, [1]);
  assert.equal(c1.certificado, undefined); // falta la clase 2

  // Clase 2 (720s): 0.85*720=612 → 999999 se topa a 720 (el servidor no acredita de más) y completa.
  const c2 = await body(await postJson('/progreso/curso-ejemplo-1/vista', { n: 2, segundos: 999999 }, DEV));
  assert.equal(c2.acreditada, true);
  assert.deepEqual(c2.progreso.vistas, [1, 2]);
  assert.ok(c2.certificado && typeof c2.certificado.folio === 'string');
  folioEmitido = c2.certificado.folio;
});

test('GET /progreso — refleja la autoridad del servidor', async () => {
  const mapa = await body(await get('/progreso', DEV));
  assert.deepEqual(mapa['curso-ejemplo-1'].vistas, [1, 2]);
});

test('POST /certificados — 409 si el curso no está completo; idempotente si ya emitido', async () => {
  const bloqueado = await postJson('/certificados', { cursoId: 'curso-ejemplo-2' }, DEV);
  assert.equal(bloqueado.status, 409);

  const ok = await postJson('/certificados', { cursoId: 'curso-ejemplo-1' }, DEV);
  assert.equal(ok.status, 201);
  const cert = await body(ok);
  assert.equal(cert.folio, folioEmitido); // mismo folio (idempotente), no se duplica
  assert.equal(cert.cursoId, 'curso-ejemplo-1');
});

test('GET /certificados — lista del propio usuario', async () => {
  const lista = await body(await get('/certificados', DEV));
  assert.ok(Array.isArray(lista) && lista.some((c: { folio: string }) => c.folio === folioEmitido));
});

test('GET /verificar/:folio — público, sin datos privados; honesto si no existe', async () => {
  const r = await get(`/verificar/${encodeURIComponent(folioEmitido)}`);
  assert.equal(r.status, 200);
  const v = await body(r);
  assert.equal(v.valido, true);
  assert.equal(v.folio, folioEmitido);
  assert.deepEqual(Object.keys(v).sort(), ['cursoTitulo', 'emitido', 'folio', 'nombre', 'valido']);
  assert.ok(!('uid' in v) && !('email' in v)); // nunca datos privados

  const no = await body(await get('/verificar/DRM-0000-00000'));
  assert.equal(no.valido, false);
});
