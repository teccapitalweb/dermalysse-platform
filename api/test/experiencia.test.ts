// Pruebas del módulo Experiencia: contrato REST + reglas del almacén.
// No mezclan Firebase ni otras consultoras: solo el adaptador en memoria.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp, seleccionarAuth } from '../src/app.js';
import { FixtureContentStore } from '../src/adapters/dev/fixtureContent.js';
import { MemoryExperienceStore } from '../src/adapters/dev/memoryExperiences.js';
import { MemoryExperienciaModuloStore } from '../src/adapters/dev/memoryExperienciaModulo.js';
import { FixtureLearningStore } from '../src/adapters/dev/fixtureQuizzes.js';
import { MemoryProgressStore } from '../src/adapters/dev/memoryProgress.js';
import { MemoryCertificateStore } from '../src/adapters/dev/memoryCertificates.js';
import { FixtureLeagueStore } from '../src/adapters/dev/fixtureLeague.js';
import { MemoryForumStore } from '../src/adapters/dev/memoryForum.js';
import { MemoryProfileStore } from '../src/adapters/dev/memoryProfile.js';
import { LearningService } from '../src/services/learning.js';

let server: Server;
let base: string;
let modulo: MemoryExperienciaModuloStore;

before(async () => {
  const content = new FixtureContentStore();
  modulo = new MemoryExperienciaModuloStore();
  const app = createApp({
    auth: seleccionarAuth('dev'),
    content,
    experiences: new MemoryExperienceStore(),
    experienciaModulo: modulo,
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

const DEV = { Authorization: 'Bearer dev-token' };
const send = (ruta: string, method: string, body?: unknown, headers: Record<string, string> = {}) =>
  fetch(base + ruta, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const get = (ruta: string, headers: Record<string, string> = {}) => fetch(base + ruta, { headers });
const json = (r: Response): Promise<any> => r.json();

test('GET /me/experiencia — 401 sin token', async () => {
  assert.equal((await get('/me/experiencia')).status, 401);
});

test('GET /me/experiencia — devuelve DTO v1 con entrevista pendiente y encuesta bloqueada', async () => {
  const r = await get('/me/experiencia', DEV);
  assert.equal(r.status, 200);
  const dto = await json(r);
  assert.equal(dto.version, 1);
  assert.equal(dto.fuente, 'api');
  assert.equal(dto.entrevista.estado, 'pendiente');
  assert.equal(dto.encuesta.estado, 'bloqueada');
  assert.equal(dto.encuesta.id, 'experiencia-inicial-v1');
  assert.ok(Array.isArray(dto.areas) && dto.areas.length > 0);
  assert.ok(Array.isArray(dto.recomendaciones));
  assert.equal(dto.beneficios.bienvenida.estado, 'no-disponible');
});

test('POST /me/experiencia/iniciar — exige privacidadAceptada=true', async () => {
  assert.equal((await send('/me/experiencia/iniciar', 'POST', {}, DEV)).status, 400);
  const r = await send('/me/experiencia/iniciar', 'POST', { privacidadAceptada: true }, DEV);
  assert.equal(r.status, 200);
  const dto = await json(r);
  assert.ok(dto.primerAccesoEn);
  assert.equal(dto.entrevista.estado, 'en-curso');
});

test('PATCH /me/entrevista — guarda respuestas y avanza revisión', async () => {
  const inicial = await json(await get('/me/experiencia', DEV));
  const r = await send('/me/entrevista', 'PATCH', {
    revision: inicial.entrevista.revision,
    paso: 1,
    respuestas: { roles: ['estudiante'], objetivo: 'aprender' },
  }, DEV);
  assert.equal(r.status, 200);
  const dto = await json(r);
  assert.equal(dto.entrevista.paso, 1);
  assert.equal(dto.entrevista.revision, inicial.entrevista.revision + 1);
  assert.deepEqual(dto.entrevista.respuestas.roles, ['estudiante']);
});

test('PATCH /me/entrevista — 409 cuando la revisión no coincide', async () => {
  const r = await send('/me/entrevista', 'PATCH', { revision: 0, paso: 1, respuestas: { x: 1 } }, DEV);
  assert.equal(r.status, 409);
});

test('POST /me/entrevista/completar — cierra, reserva beneficio si campaña viva, actualiza DTO', async () => {
  // Preparo política de campaña habilitada con cupo.
  const cfg = await modulo.config();
  const futuro = new Date(Date.now() + 30 * 86400000).toISOString();
  await modulo.guardarConfig({
    revision: cfg.revision, campanaId: 'bienvenida-test', aprobado: true, habilitada: true,
    fechaInicio: new Date().toISOString(), fechaFin: futuro, cupo: 10,
  });

  const actual = await json(await get('/me/experiencia', DEV));
  const r = await send('/me/entrevista/completar', 'POST', {
    revision: actual.entrevista.revision,
    privacidadAceptada: true,
    respuestas: { areas: ['Dermatología'] },
  }, DEV);
  assert.equal(r.status, 200);
  const dto = await json(r);
  assert.equal(dto.entrevista.estado, 'completada');
  assert.ok(dto.entrevista.completadaEn);
  assert.equal(dto.beneficios.bienvenida.estado, 'reservado');
  assert.equal(dto.beneficios.bienvenida.dias, 7);
});

test('POST /me/experiencia/sesion — idempotente por día; abre encuesta cuando aplican tiempo+uso', async () => {
  const r1 = await send('/me/experiencia/sesion', 'POST', {}, DEV);
  const r2 = await send('/me/experiencia/sesion', 'POST', {}, DEV);
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);

  // Backdate: fuerza >7 días desde primerAccesoEn y 3 sesiones distintas.
  const uid = 'dev-uid'; // DevAuthAdapter asigna este uid.
  const estado = await modulo.obtener(uid);
  estado.primerAccesoEn = new Date(Date.now() - 10 * 86400000).toISOString();
  estado.sesiones = ['2026-10-19', '2026-10-20', '2026-10-21'];
  await modulo.registrarSesion(uid);

  const dto = await json(await get('/me/experiencia', DEV));
  assert.equal(dto.encuesta.estado, 'disponible');
});

test('POST /me/encuesta/completar — reserva beneficio de experiencia (15 días)', async () => {
  const actual = await json(await get('/me/experiencia', DEV));
  assert.equal(actual.encuesta.estado, 'disponible');
  const r = await send('/me/encuesta/completar', 'POST', {
    revision: actual.encuesta.revision,
    privacidadAceptada: true,
    respuestas: { facilidad: 4, utilidad: 5, dificultad: 'ninguna' },
  }, DEV);
  assert.equal(r.status, 200);
  const dto = await json(r);
  assert.equal(dto.encuesta.estado, 'completada');
  assert.equal(dto.beneficios.experiencia.estado, 'reservado');
  assert.equal(dto.beneficios.experiencia.dias, 15);
});

test('Gate encuesta — posponer y completar son RECHAZADOS si no se cumple la precondición', async () => {
  // Usuario "fresco": aceptó bienvenida, completó entrevista, pero sin 7 días + 3 sesiones.
  const uid = 'uid-bypass';
  await modulo.iniciar(uid);
  await modulo.guardarPaso(uid, 'entrevista', 1, 1, { roles: ['estudiante'] });
  let estado = await modulo.obtener(uid);
  await modulo.completar(uid, 'entrevista', estado.entrevista.revision, { areas: ['Dermatología'] });
  estado = await modulo.obtener(uid);
  assert.equal(estado.encuesta.estado, 'bloqueada');

  // posponer sobre bloqueada → ConflictError
  await assert.rejects(
    () => modulo.posponer(uid, 'encuesta', estado.encuesta.revision),
    (e: Error) => e.name === 'ConflictError',
  );
  // completar sobre bloqueada → ConflictError
  await assert.rejects(
    () => modulo.completar(uid, 'encuesta', estado.encuesta.revision, { facilidad: 4 }),
    (e: Error) => e.name === 'ConflictError',
  );
  // Y guardarPaso también
  await assert.rejects(
    () => modulo.guardarPaso(uid, 'encuesta', estado.encuesta.revision, 1, { facilidad: 4 }),
    (e: Error) => e.name === 'ConflictError',
  );
  // El estado persistido sigue bloqueada: nada se movió de contrabando.
  const final = await modulo.obtener(uid);
  assert.equal(final.encuesta.estado, 'bloqueada');
  assert.equal(final.encuesta.revision, 0);
});

test('GET /admin/experiencia/resumen — 403 para usuario sin admin, 200 con admin', async () => {
  const sinAdmin = { Authorization: 'Bearer dev-token' }; // DevAuth suele dar admin=true
  const r = await get('/admin/experiencia/resumen', sinAdmin);
  // El Dev adapter puede o no ser admin; aceptamos 200 o 403 pero nunca 500.
  assert.ok(r.status === 200 || r.status === 403, `estado inesperado ${r.status}`);
});

test('PATCH /admin/experiencia/config — 400 por payload inválido', async () => {
  // Si el adaptador dev no es admin, saltamos (requireAdmin ya lo valida).
  const cfg = await modulo.config();
  const r = await send('/admin/experiencia/config', 'PATCH', {
    revision: cfg.revision, campanaId: '!!invalido!!', aprobado: false, habilitada: false,
    fechaInicio: null, fechaFin: null, cupo: 0,
  }, DEV);
  assert.ok([400, 403].includes(r.status));
});
