// Pruebas unitarias de los almacenes Firestore (con el Firestore FALSO) y del cliente del webhook. Sin red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryFirestore } from '../src/adapters/firestore/memoria.js';
import { FirestoreAcademiaAttemptStore, FirestoreAcademiaProgressStore, FirestoreAcademiaReviewStore } from '../src/adapters/firestore/academia.js';
import { cargarCatalogoEditorial, clasesDesdeLessons, minutosDeTexto, resolverLeccion } from '../src/adapters/firestore/club.js';
import { FirebaseAuthAdapter } from '../src/adapters/firebase/firebaseAuth.js';
import { LegacyWebhookClient } from '../src/adapters/legacy/webhook.js';
import { CodedError } from '../src/services/errors.js';

// ── Firestore falso: semánticas que la API asume ──

test('MemoryFirestore: set merge profundo, create no pisa, orderBy excluye documentos sin el campo', async () => {
  const db = new MemoryFirestore();
  await db.set('users/a', { name: 'A', settings: { notif_vivo: false }, subscription: { status: 'active' } });
  await db.set('users/a', { settings: { notif_cursos: true } }, { merge: true });
  assert.deepEqual(db.crudo('users/a'), { name: 'A', settings: { notif_vivo: false, notif_cursos: true }, subscription: { status: 'active' } });
  assert.equal(await db.create('users/a', { name: 'B' }), false);
  assert.equal(db.crudo('users/a')!.name, 'A');
  db.sembrar('forum/x', { createdAt: 2 });
  db.sembrar('forum/y', { title: 'sin fecha' });
  db.sembrar('forum/x/replies/r', { createdAt: 1 }); // subcolección: no aparece en forum
  assert.deepEqual((await db.query('forum', { orderBy: { campo: 'createdAt', dir: 'desc' } })).map((d) => d.id), ['x']);
});

// ── Catálogo por posición ──

test('clasesDesdeLessons: n = posición (ids combinados -s01-02 no se interpretan) y nunca videoId', () => {
  const clases = clasesDesdeLessons([
    { id: 'c-s01-02', name: 'Sesiones 01 y 02', durationSeconds: 89, isPreview: true, videoId: 'v1' },
    { id: 'c-s03', name: '', dur: '2 h 6 min', videoId: 'v2' },
    { id: 'c-s04', name: 'Sesión 04' },
  ]);
  assert.deepEqual(clases, [
    { n: 1, titulo: 'Sesiones 01 y 02', duracionMin: 1, gratis: true },
    { n: 2, titulo: 'Sesión 02', duracionMin: 126, gratis: false },
    { n: 3, titulo: 'Sesión 04', duracionMin: null, gratis: false },
  ]);
  assert.ok(!JSON.stringify(clases).includes('videoId'));
  assert.equal(minutosDeTexto('45 min'), 45);
  assert.equal(minutosDeTexto(''), null);
});

test('resolverLeccion: lessons[n-1].id; null si no publicado, fuera de rango o id con "/"', async () => {
  const db = new MemoryFirestore();
  db.sembrar('courses/c', { status: 'published', lessons: [{ id: 'c-s01' }, { id: 'c-s02-03' }] });
  db.sembrar('courses/d', { status: 'draft', lessons: [{ id: 'd-s01' }] });
  assert.deepEqual(await resolverLeccion(db, 'c', 2), { lessonId: 'c-s02-03', total: 2 });
  assert.equal(await resolverLeccion(db, 'c', 3), null);
  assert.equal(await resolverLeccion(db, 'd', 1), null);
  assert.equal(await resolverLeccion(db, 'c/../x', 1), null);
});

test('catálogo editorial empaquetado: 12 cursos y 45 clases, sin ids de Bunny', () => {
  const cursos = cargarCatalogoEditorial();
  assert.equal(cursos.length, 12);
  assert.equal(cursos.reduce((s, c) => s + c.clasesEsperadas, 0), 45);
  assert.ok(!/videoId|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(JSON.stringify(cursos)));
});

// ── Auth ──

test('FirebaseAuthAdapter: esAdmin por admins/{uid}; nombre de users; sin users ⇒ sin VIP', async () => {
  const db = new MemoryFirestore();
  db.sembrar('admins/u1', {});
  db.sembrar('users/u1', { name: 'Ana', lastname: 'López', vigenciaHasta: '2999-01-01T00:00:00.000Z' });
  const verificador = { verifyIdToken: async (t: string) => ({ uid: t, email: `${t}@example.test`, name: 'Del Token' }) };
  const a = new FirebaseAuthAdapter(verificador, db);
  const u1 = await a.verificar('u1');
  assert.deepEqual([u1?.esAdmin, u1?.esVip, u1?.nombre, u1?.acceso?.plan], [true, true, 'Ana López', 'cortesia']);
  const u2 = await a.verificar('u2');
  assert.deepEqual([u2?.esAdmin, u2?.esVip, u2?.nombre, u2?.acceso?.motivo], [false, false, 'Del Token', 'none']);
});

// ── Academia en Firestore (v2_academia_*) ──

test('academia/progreso: marcarTema idempotente; examen guarda la mejor marca y no retira la aprobación', async () => {
  const db = new MemoryFirestore();
  const s = new FirestoreAcademiaProgressStore(db);
  await s.marcarTema('u1', 'prog', 1, '1.1', 'F1');
  await s.marcarTema('u1', 'prog', 1, '1.1', 'F2');
  assert.deepEqual((await s.modulo('u1', 'prog', 1)).temas, { '1.1': 'F1' });
  await s.registrarExamen('u1', 'prog', 1, { porcentaje: 80, aprobado: true, fecha: 'F3' });
  const a = await s.registrarExamen('u1', 'prog', 1, { porcentaje: 40, aprobado: false, fecha: 'F4' });
  assert.deepEqual([a.mejor, a.intentos, a.aprobado, a.aprobadoEn], [80, 2, true, 'F3']);
  assert.ok(db.crudo('v2_academia_progreso/u1'));
  assert.deepEqual(Object.keys(await s.del('u2')), []);
});

test('academia/intentos: emitir, consumir UNA vez (también en paralelo) y conservar el último resultado', async () => {
  const db = new MemoryFirestore();
  const s = new FirestoreAcademiaAttemptStore(db);
  await s.emitir('u1', 'prog', 2, ['a', 'b'], 'F1');
  const [x, y] = await Promise.all([s.consumir('u1', 'prog', 2), s.consumir('u1', 'prog', 2)]);
  assert.deepEqual([x, y].filter(Boolean), [['a', 'b']]);
  await s.cerrar('u1', 'prog', 2, { aprobado: false, fecha: 'F2' });
  await s.emitir('u1', 'prog', 2, ['c'], 'F3');
  assert.deepEqual(await s.get('u1', 'prog', 2), { ids: ['c'], emitido: 'F3', calificado: false, ultimo: { aprobado: false, fecha: 'F2' } });
  assert.ok(db.crudo('v2_academia_intentos/u1__prog__2'));
  assert.equal(await s.consumir('u9', 'prog', 1), null);
});

test('academia/revisiones y lanzamiento: set/todas y borrar el ajuste', async () => {
  const db = new MemoryFirestore();
  const s = new FirestoreAcademiaReviewStore(db);
  await s.set('prog', 3, { estado: 'aprobado', nota: 'ok', revisor: 'admin@x', fecha: 'F' });
  assert.deepEqual([...(await s.todas()).entries()], [['prog/3', { estado: 'aprobado', nota: 'ok', revisor: 'admin@x', fecha: 'F' }]]);
  assert.ok(db.crudo('v2_academia_revisiones/prog__3'));
  await s.fijarLanzamiento('prog', { inicio: '2026-11-01', cadaDias: 7, por: 'admin@x', fecha: 'F' });
  assert.deepEqual(await s.lanzamiento('prog'), { inicio: '2026-11-01', cadaDias: 7, por: 'admin@x', fecha: 'F' });
  assert.equal((await s.lanzamientos()).size, 1);
  await s.fijarLanzamiento('prog', null);
  assert.equal(await s.lanzamiento('prog'), null);
  assert.equal(db.crudo('v2_academia_lanzamiento/prog'), undefined);
});

// ── Cliente del webhook ──

test('LegacyWebhookClient: tiempo agotado ⇒ 502; URL base sin barra doble', async () => {
  const urls: string[] = [];
  const lento = new LegacyWebhookClient({
    baseUrl: 'https://webhook.example.test/',
    timeoutMs: 20,
    fetch: (url, init) => { urls.push(url); return new Promise((_, rechazar) => init.signal.addEventListener('abort', () => rechazar(init.signal.reason))); },
  });
  await assert.rejects(() => lento.post('/bunny/playback', 'Bearer t', {}), (e: unknown) => e instanceof CodedError && e.status === 502);
  assert.deepEqual(urls, ['https://webhook.example.test/bunny/playback']);
});
