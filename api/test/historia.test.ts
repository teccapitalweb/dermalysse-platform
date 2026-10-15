// GET/PATCH /historia (avance del Modo Historia) en los dos modos:
//  - dev + memoria (buildApp por defecto);
//  - firebase + firestore con el Firestore FALSO en memoria (colección v2_historia), sin red.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { buildApp } from '../src/app.js';
import { MemoryFirestore } from '../src/adapters/firestore/memoria.js';
import type { TokenDecodificado } from '../src/adapters/firebase/firebaseAuth.js';
import type { FetchLike } from '../src/adapters/legacy/webhook.js';
import { fusionarHistoria, historiaVacia, validarHistoria, LIMITES_HISTORIA } from '../src/services/historia.js';
import { ValidationError } from '../src/services/errors.js';

const json = (r: Response): Promise<any> => r.json();

async function levantar(app: ReturnType<typeof buildApp>): Promise<{ server: Server; base: string }> {
  const server = await new Promise<Server>((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

function cliente(base: string) {
  return {
    get: (token?: string) => fetch(`${base}/historia`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
    patch: (cuerpo: unknown, token?: string) => fetch(`${base}/historia`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
    }),
  };
}

// ── Reglas puras ──

describe('services/historia', () => {
  test('validarHistoria: normaliza puntajes (0–100, entero), quita duplicados e ignora campos desconocidos', () => {
    const v = validarHistoria({ completados: ['n1', 'n2', 'n1'], puntajes: { n1: 87.6, n2: 140, n3: -5 }, ultimoNivel: 'n2', actualizado: '2026-10-01T10:00:00Z', uid: 'otro', esVip: true });
    assert.deepEqual(v, { completados: ['n1', 'n2'], puntajes: { n1: 88, n2: 100, n3: 0 }, ultimoNivel: 'n2', actualizado: '2026-10-01T10:00:00.000Z' });
    assert.deepEqual(validarHistoria({}), historiaVacia());
  });

  test('validarHistoria: tipos incorrectos o tamaños excesivos ⇒ ValidationError', () => {
    const malos: unknown[] = [
      null, [], 'texto', 42,
      { completados: 'n1' }, { completados: [1] }, { completados: ['../x'] }, { completados: ['__reservado'] }, { completados: ['x'.repeat(65)] },
      { completados: Array.from({ length: LIMITES_HISTORIA.niveles + 1 }, (_, i) => `n${i}`) },
      { puntajes: [] }, { puntajes: { n1: '90' } }, { puntajes: { n1: null } }, { puntajes: { 'a/b': 1 } },
      { ultimoNivel: 7 }, { ultimoNivel: 'con espacio' },
      { actualizado: 'ayer' }, { actualizado: 1760000000000 },
    ];
    for (const m of malos) assert.throws(() => validarHistoria(m), ValidationError, JSON.stringify(m));
  });

  test('fusionarHistoria: unión de completados, máximo de puntajes; el avance nunca retrocede', () => {
    const ahora = new Date('2026-10-15T12:00:00.000Z');
    const guardada = { completados: ['n1', 'n2'], puntajes: { n1: 90, n2: 40 }, ultimoNivel: 'n2', actualizado: '2026-10-10T00:00:00.000Z' };
    const vieja = { completados: ['n1'], puntajes: { n1: 50, n2: 70 }, ultimoNivel: 'n1', actualizado: '2026-10-01T00:00:00.000Z' };
    assert.deepEqual(fusionarHistoria(guardada, vieja, ahora), { completados: ['n1', 'n2'], puntajes: { n1: 90, n2: 70 }, ultimoNivel: 'n2', actualizado: '2026-10-10T00:00:00.000Z' });
    const nueva = { completados: ['n3'], puntajes: { n3: 60 }, ultimoNivel: 'n3', actualizado: '2026-10-12T00:00:00.000Z' };
    assert.deepEqual(fusionarHistoria(guardada, nueva, ahora), { completados: ['n1', 'n2', 'n3'], puntajes: { n1: 90, n2: 40, n3: 60 }, ultimoNivel: 'n3', actualizado: '2026-10-12T00:00:00.000Z' });
    assert.deepEqual(fusionarHistoria(guardada, historiaVacia(), ahora), guardada, 'un PATCH vacío no borra nada');
  });

  test('fusionarHistoria: una fecha futura se topa a la hora del servidor; exceder el límite al unir ⇒ 400', () => {
    const ahora = new Date('2026-10-15T12:00:00.000Z');
    const r = fusionarHistoria(historiaVacia(), { ...historiaVacia(), ultimoNivel: 'n9', actualizado: '2099-01-01T00:00:00.000Z' }, ahora);
    assert.equal(r.actualizado, '2026-10-15T12:00:00.000Z');
    const mitad = (desde: number) => Array.from({ length: LIMITES_HISTORIA.niveles }, (_, i) => `n${desde + i}`);
    const llena = { ...historiaVacia(), completados: mitad(0) };
    assert.throws(() => fusionarHistoria(llena, { ...historiaVacia(), completados: mitad(1) }, ahora), ValidationError);
  });
});

// ── Modo dev + memoria ──

describe('/historia — dev + memoria', () => {
  let server: Server;
  let base: string;
  before(async () => { ({ server, base } = await levantar(buildApp({ AUTH_MODE: 'dev', CORS_ORIGINS: 'http://localhost:5173' } as NodeJS.ProcessEnv))); });
  after(() => { server?.close(); });

  test('sin sesión ⇒ 401 (GET y PATCH)', async () => {
    const c = cliente(base);
    assert.equal((await c.get()).status, 401);
    assert.equal((await c.patch({ completados: ['n1'] })).status, 401);
  });

  test('GET vacío ⇒ forma exacta del cliente; PATCH fusiona y GET lo devuelve', async () => {
    const c = cliente(base);
    const r0 = await c.get('dev');
    assert.equal(r0.status, 200);
    assert.equal(r0.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await json(r0), { completados: [], puntajes: {}, ultimoNivel: '', actualizado: '' });

    const r1 = await c.patch({ completados: ['mundo1-n1'], puntajes: { 'mundo1-n1': 80 }, ultimoNivel: 'mundo1-n1', actualizado: '2026-10-01T10:00:00.000Z' }, 'dev');
    assert.equal(r1.status, 200);
    const r2 = await c.patch({ completados: ['mundo1-n2'], puntajes: { 'mundo1-n1': 60, 'mundo1-n2': 95 }, ultimoNivel: 'mundo1-n2', actualizado: '2026-10-02T10:00:00.000Z' }, 'dev');
    assert.deepEqual(await json(r2), { completados: ['mundo1-n1', 'mundo1-n2'], puntajes: { 'mundo1-n1': 80, 'mundo1-n2': 95 }, ultimoNivel: 'mundo1-n2', actualizado: '2026-10-02T10:00:00.000Z' });
    assert.deepEqual(await json(await c.get('dev')), { completados: ['mundo1-n1', 'mundo1-n2'], puntajes: { 'mundo1-n1': 80, 'mundo1-n2': 95 }, ultimoNivel: 'mundo1-n2', actualizado: '2026-10-02T10:00:00.000Z' });
  });

  test('PATCH inválido ⇒ 400 sin tocar lo guardado; JSON roto ⇒ 400; cuerpo enorme ⇒ 413', async () => {
    const c = cliente(base);
    const antes = await json(await c.get('dev'));
    const r = await c.patch({ completados: [123] }, 'dev');
    assert.equal(r.status, 400);
    assert.equal((await json(r)).error, 'validacion');
    assert.equal((await c.patch('{"completados":', 'dev')).status, 400);
    assert.equal((await c.patch({ completados: ['x'.repeat(40 * 1024)] }, 'dev')).status, 413);
    assert.deepEqual(await json(await c.get('dev')), antes);
  });
});

// ── Modo producción (firebase + firestore) con el Firestore falso ──

describe('/historia — firebase + firestore (v2_historia)', () => {
  const ENV = {
    AUTH_MODE: 'firebase', DATA_MODE: 'firestore',
    FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: 'club-dermalysse', client_email: 'prueba@example.invalid', private_key: 'llave-falsa-de-prueba' }),
    LEGACY_WEBHOOK_URL: 'https://webhook.example.test/', APP_URL: 'https://club.example.test', CORS_ORIGINS: 'https://club.example.test',
  } as unknown as NodeJS.ProcessEnv;
  const TOKENS: Record<string, TokenDecodificado> = {
    'tok-ana': { uid: 'u-ana', email: 'ana@example.test', name: 'Ana' },
    'tok-luis': { uid: 'u-luis', email: 'luis@example.test', name: 'Luis' },
  };
  const verificador = {
    async verifyIdToken(token: string): Promise<TokenDecodificado> {
      const t = TOKENS[token];
      if (!t) throw Object.assign(new Error('bad token'), { code: 'auth/argument-error' });
      return t;
    },
  };
  const fetchSinRed: FetchLike = async () => { throw new Error('la historia no debe llamar al webhook'); };
  let db: MemoryFirestore;
  let server: Server;
  let base: string;

  before(async () => {
    db = new MemoryFirestore();
    db.sembrar('users/u-ana', { name: 'Ana', email: 'ana@example.test' });
    db.sembrar('users/u-luis', { name: 'Luis', email: 'luis@example.test' });
    db.sembrar('v2_historia/u-luis', { uid: 'u-luis', completados: ['n1', 'basura/x', 7], puntajes: { n1: 70, malo: 'x' }, ultimoNivel: 'n1', actualizado: '2026-10-05T00:00:00.000Z' });
    ({ server, base } = await levantar(buildApp(ENV, { firestore: db, verificador, fetch: fetchSinRed, catalogoEditorial: [] })));
  });
  after(() => { server?.close(); });

  test('token inválido ⇒ 401; sin documento ⇒ avance vacío y GET no escribe', async () => {
    const c = cliente(base);
    assert.equal((await c.get('basura')).status, 401);
    const antes = db.escrituras.length;
    assert.deepEqual(await json(await c.get('tok-ana')), { completados: [], puntajes: {}, ultimoNivel: '', actualizado: '' });
    assert.equal(db.escrituras.length, antes, 'GET /historia no escribe');
  });

  test('documento con datos viejos o inválidos se lee de forma defensiva', async () => {
    assert.deepEqual(await json(await cliente(base).get('tok-luis')), { completados: ['n1'], puntajes: { n1: 70 }, ultimoNivel: 'n1', actualizado: '2026-10-05T00:00:00.000Z' });
  });

  test('PATCH guarda en v2_historia/{uid del token} (nunca en users) y fusiona de forma aditiva', async () => {
    const c = cliente(base);
    const r = await c.patch({ uid: 'u-luis', completados: ['n1', 'n2'], puntajes: { n1: 55, n2: 90 }, ultimoNivel: 'n2', actualizado: '2026-10-06T00:00:00.000Z' }, 'tok-ana');
    assert.equal(r.status, 200);
    const doc = db.crudo('v2_historia/u-ana')!;
    assert.equal(doc.uid, 'u-ana');
    assert.deepEqual([doc.completados, doc.puntajes, doc.ultimoNivel, doc.actualizado], [['n1', 'n2'], { n1: 55, n2: 90 }, 'n2', '2026-10-06T00:00:00.000Z']);
    assert.equal(typeof doc.guardadoEn, 'string');
    assert.deepEqual(db.crudo('users/u-ana'), { name: 'Ana', email: 'ana@example.test' }, 'users no se toca');
    assert.deepEqual(db.crudo('v2_historia/u-luis')!.puntajes, { n1: 70, malo: 'x' }, 'el uid del cuerpo se ignora');

    // Un dispositivo con avance viejo no hace retroceder el puntaje ni el último nivel.
    const r2 = await c.patch({ completados: ['n1'], puntajes: { n1: 99, n2: 10 }, ultimoNivel: 'n1', actualizado: '2026-10-01T00:00:00.000Z' }, 'tok-ana');
    assert.deepEqual(await json(r2), { completados: ['n1', 'n2'], puntajes: { n1: 99, n2: 90 }, ultimoNivel: 'n2', actualizado: '2026-10-06T00:00:00.000Z' });
  });

  test('PATCH simultáneos no se pisan (transacción)', async () => {
    const c = cliente(base);
    await Promise.all(['m1', 'm2', 'm3', 'm4'].map((id) => c.patch({ completados: [id], puntajes: { [id]: 50 } }, 'tok-luis')));
    const fin = await json(await c.get('tok-luis'));
    for (const id of ['n1', 'm1', 'm2', 'm3', 'm4']) assert.ok(fin.completados.includes(id), id);
    assert.equal(Object.keys(fin.puntajes).length, 5);
  });

  test('PATCH inválido ⇒ 400 sin escribir', async () => {
    const antes = db.escrituras.length;
    assert.equal((await cliente(base).patch({ puntajes: { n1: 'mucho' } }, 'tok-ana')).status, 400);
    assert.equal(db.escrituras.length, antes);
  });
});
