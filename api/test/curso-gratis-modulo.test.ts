// Módulo «curso gratis» en modo PRODUCCIÓN (buildApp con Firestore falso, verificador y fetch falsos).
// El gratuito elige UN curso; es permanente; el VIP no elige; el campo nunca lo escribe PATCH /me/perfil.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { buildApp } from '../src/app.js';
import { MemoryFirestore } from '../src/adapters/firestore/memoria.js';
import { cargarCatalogoEditorial } from '../src/adapters/firestore/club.js';
import type { FetchLike } from '../src/adapters/legacy/webhook.js';
import type { TokenDecodificado } from '../src/adapters/firebase/firebaseAuth.js';
import { claseGratisPorEleccion, esUltimaClase } from '../src/modulos/cursoGratis.js';

const CUENTA_FALSA = JSON.stringify({ project_id: 'club-dermalysse', client_email: 'p@example.invalid', private_key: 'k' });
const ENV = {
  AUTH_MODE: 'firebase', DATA_MODE: 'firestore', FIREBASE_SERVICE_ACCOUNT: CUENTA_FALSA,
  LEGACY_WEBHOOK_URL: 'https://webhook.example.test/', APP_URL: 'https://club.example.test', CORS_ORIGINS: 'https://club.example.test',
  CAMPANA_BIENVENIDA_CODIGO: 'TEST-DERMALYSSE-50',
} as unknown as NodeJS.ProcessEnv;

const TOKENS: Record<string, TokenDecodificado> = {
  'tok-free': { uid: 'u-free', email: 'free@example.test', name: 'Free', email_verified: true },
  'tok-free2': { uid: 'u-free2', email: 'free2@example.test', name: 'Free Dos', email_verified: true },
  'tok-vip': { uid: 'u-vip', email: 'vip@example.test', name: 'Vip', email_verified: true },
};
const verificador = {
  async verifyIdToken(token: string): Promise<TokenDecodificado> {
    const t = TOKENS[token];
    if (!t) throw Object.assign(new Error('bad token'), { code: 'auth/argument-error' });
    return t;
  },
};
const fetchFalso: FetchLike = async () => ({ status: 500, ok: false, json: async () => ({}) });

const EDITORIAL = cargarCatalogoEditorial();
const CURSO_A = EDITORIAL[0].id;
const CURSO_B = EDITORIAL[1].id;
const FUTURO = new Date(Date.now() + 400 * 86400000).toISOString();

let db: MemoryFirestore;
let server: Server;
let base: string;

before(async () => {
  db = new MemoryFirestore();
  db.sembrar('users/u-free', { name: 'Free', email: 'free@example.test' });
  db.sembrar('members/u-free', { id: 'u-free', uid: 'u-free', name: 'Free', email: 'free@example.test', plan: 'Free', status: 'active', joined: '2025-01-01', courses: 0 });
  db.sembrar('users/u-free2', { name: 'Free Dos' });
  db.sembrar('members/u-free2', { id: 'u-free2', uid: 'u-free2', joined: '2025-01-01', plan: 'Free', status: 'active' });
  db.sembrar('users/u-vip', { name: 'Vip', subscription: { status: 'active', plan: 'anual', currentPeriodEnd: FUTURO } });
  db.sembrar('members/u-vip', { id: 'u-vip', uid: 'u-vip', joined: '2025-01-01', plan: 'Free', status: 'active' });
  db.sembrar(`courses/${CURSO_A}`, { name: 'Curso A', status: 'published', lessons: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }] });
  db.sembrar(`courses/${CURSO_B}`, { name: 'Curso B', status: 'published', lessons: [{ id: 'b1' }, { id: 'b2' }] });
  db.sembrar('courses/curso-borrador', { name: 'Borrador', status: 'draft', lessons: [{ id: 'x1' }] });
  const app = buildApp(ENV, { firestore: db, verificador, fetch: fetchFalso });
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server?.close(); });

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const post = (ruta: string, cuerpo: unknown, headers: Record<string, string> = {}) =>
  fetch(base + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(cuerpo) });
const patch = (ruta: string, cuerpo: unknown, headers: Record<string, string> = {}) =>
  fetch(base + ruta, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(cuerpo) });
const get = (ruta: string, headers: Record<string, string> = {}) => fetch(base + ruta, { headers });
const json = (r: Response): Promise<any> => r.json();

// ── Reglas puras ──

test('esUltimaClase: la última clase nunca es gratis', () => {
  assert.equal(esUltimaClase(3, 3), true);
  assert.equal(esUltimaClase(2, 3), false);
  assert.equal(esUltimaClase(1, 1), true); // curso de 1 clase: esa clase es la última
  assert.equal(esUltimaClase(1, 0), false);
});

test('claseGratisPorEleccion: VIP siempre; gratuito solo su curso y no la última', () => {
  assert.equal(claseGratisPorEleccion({ esVip: true, cursoGratis: undefined, cursoId: 'x', n: 3, totalClases: 3 }), true);
  assert.equal(claseGratisPorEleccion({ esVip: false, cursoGratis: 'a', cursoId: 'a', n: 2, totalClases: 3 }), true);
  assert.equal(claseGratisPorEleccion({ esVip: false, cursoGratis: 'a', cursoId: 'a', n: 3, totalClases: 3 }), false); // última
  assert.equal(claseGratisPorEleccion({ esVip: false, cursoGratis: 'a', cursoId: 'b', n: 1, totalClases: 2 }), false); // otro curso
  assert.equal(claseGratisPorEleccion({ esVip: false, cursoGratis: undefined, cursoId: 'a', n: 1, totalClases: 3 }), false); // no eligió
});

// ── Endpoint ──

test('POST /me/curso-gratis exige sesión', async () => {
  assert.equal((await post('/me/curso-gratis', { cursoId: CURSO_A })).status, 401);
});

test('POST /me/curso-gratis: el gratuito elige y se guarda; /me lo refleja', async () => {
  const r = await post('/me/curso-gratis', { cursoId: CURSO_A }, auth('tok-free'));
  assert.equal(r.status, 201);
  assert.deepEqual(await json(r), { cursoGratis: CURSO_A });
  const me = await json(await get('/me', auth('tok-free')));
  assert.equal(me.cursoGratis, CURSO_A);
  // no tocó otros campos
  assert.equal((db.crudo(`users/u-free`) as any).name, 'Free');
});

test('POST /me/curso-gratis: segunda elección rechazada (permanente)', async () => {
  const r = await post('/me/curso-gratis', { cursoId: CURSO_B }, auth('tok-free'));
  assert.equal(r.status, 409);
  const e = await json(r);
  assert.equal(e.error, 'curso-gratis/ya-elegido');
  assert.equal(e.cursoGratis, CURSO_A); // sigue el primero
});

test('POST /me/curso-gratis: curso inexistente o en borrador ⇒ 404', async () => {
  assert.equal((await post('/me/curso-gratis', { cursoId: 'no-existe' }, auth('tok-free2'))).status, 404);
  assert.equal((await post('/me/curso-gratis', { cursoId: 'curso-borrador' }, auth('tok-free2'))).status, 404);
  assert.equal((await post('/me/curso-gratis', { cursoId: '' }, auth('tok-free2'))).status, 400);
  // tras los rechazos, u-free2 sigue sin elegir
  assert.equal((await json(await get('/me', auth('tok-free2')))).cursoGratis, null);
});

test('POST /me/curso-gratis: un VIP no elige (403) y /me le devuelve cursoGratis null', async () => {
  assert.equal((await post('/me/curso-gratis', { cursoId: CURSO_A }, auth('tok-vip'))).status, 403);
  assert.equal((await json(await get('/me', auth('tok-vip')))).cursoGratis, null);
});

test('PATCH /me/perfil no puede escribir cursoGratis (campo protegido)', async () => {
  await patch('/me/perfil', { nombre: 'Free', cursoGratis: CURSO_B }, auth('tok-free'));
  assert.equal((await json(await get('/me', auth('tok-free')))).cursoGratis, CURSO_A); // sigue el elegido, no CURSO_B
});
