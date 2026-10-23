import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { preguntaConRespuesta } from '../src/core/pregunta-practica.ts';
import { crearCacheSesion } from '../src/core/cache-sesion.ts';
import { crearAlmacenPorCuenta } from '../src/core/almacen-cuenta.ts';

const diferida = () => { let resolve, reject; const p = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { p, resolve, reject }; };
function remoto(api) {
  let uid = 'cuenta-a';
  const datos = new Map();
  const invalidaciones = [];
  const Datos = { modo: 'api', invalidarAdmin: (...keys) => { invalidaciones.push(keys); keys.forEach(k => datos.delete(k)); },
    hidratarAdmin: (k,v) => datos.set(k,v), quizzes: () => datos.get('quizzes') || [], config: () => ({}) };
  const mocks = {
    './auth': { Auth: { get usuario() { return uid ? { uid } : null; } }, api },
    './datos': { Datos }, './cache-sesion': { crearCacheSesion },
    './historia': { cargarHistoriaRemota: async () => {} },
    './recompensas': { Recompensas: { cargar: async () => {}, invalidar() {} } },
    './minijuegos-clase': { configurarMinijuegosClase() {} },
  };
  const source = fs.readFileSync(new URL('../src/core/remoto.ts', import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText,
    { exports, require: (name) => { assert.ok(name in mocks, name); return mocks[name]; } });
  return { ...exports, datos, invalidaciones, cambiar: value => { uid = value; } };
}

test('dos vistas concurrentes esperan el mismo quiz; no muestran un éxito antes de recibirlo', async () => {
  const quiz = diferida(); let consultas = 0;
  const r = remoto(async ruta => { if (ruta === '/catalogo') return { cursos: [] }; consultas++; return quiz.p; });
  await r.cargarClub();
  let segundaLista = false;
  const a = r.cargarClub('/curso/piloto/clase/1');
  const b = r.cargarClub('/curso/piloto/clase/1').then(() => { segundaLista = true; });
  await new Promise(ok => setImmediate(ok));
  assert.equal(consultas, 1); assert.equal(segundaLista, false);
  quiz.resolve({ preguntas: [{ q: 'Pregunta', opciones: ['A','B'] }] });
  await Promise.all([a,b]);
  assert.equal(r.datos.get('quizzes').length, 1);
});

test('cambiar de cuenta limpia quizzes, miembros y catálogo antes de hidratar los nuevos', async () => {
  const r = remoto(async ruta => ruta === '/catalogo' ? { cursos: [] } : { preguntas: [{ q: 'Privada', opciones: ['A','B'] }] });
  await r.cargarClub('/curso/piloto/clase/1');
  r.datos.set('miembros', [{ nombre: 'Solo admin' }]);
  r.cambiar('cuenta-b');
  await r.cargarClub();
  assert.equal(r.datos.has('quizzes'), false);
  assert.equal(r.datos.has('miembros'), false);
  assert.ok(r.invalidaciones.at(-1).includes('quizzes'));
});

test('una respuesta anterior al cierre no repuebla la cuenta siguiente ni borra su petición pendiente', async () => {
  const a = diferida(), b = diferida(); let llamadas = 0;
  const r = remoto(() => ++llamadas === 1 ? a.p : b.p);
  const primera = r.cargarClub();
  const rechazada = assert.rejects(primera, /sesión cambió/);
  await new Promise(ok => setImmediate(ok));
  r.cambiar('cuenta-b'); r.invalidarClub();
  const segunda = r.cargarClub();
  await new Promise(ok => setImmediate(ok));
  a.resolve({ cursos: [{ id: 'privado-a', clases: [] }] });
  await rechazada;
  assert.equal(r.datos.has('cursos'), false);
  const tercera = r.cargarClub();
  b.resolve({ cursos: [{ id: 'propio-b', clases: [] }] });
  await Promise.all([segunda, tercera]);
  assert.equal(llamadas, 2);
  assert.equal(r.datos.get('cursos')[0].id, 'propio-b');
});

test('error de red se puede reintentar y un catálogo vacío permanece vacío', async () => {
  let intentos = 0;
  const r = remoto(async () => { if (++intentos === 1) throw new Error('Sin red'); return { cursos: [], materiales: [] }; });
  await assert.rejects(r.cargarClub(), /Sin red/);
  await r.cargarClub();
  assert.equal(intentos, 2); assert.equal(r.datos.get('cursos').length, 0);
});

test('retos separados por UID; el legado compartido solo se recupera en demo', () => {
  const valores = new Map([['marca:retos', JSON.stringify({ xp: 99 })]]);
  let cuenta = { uid: 'a', demo: false };
  const store = crearAlmacenPorCuenta('marca:retos', () => cuenta, () => ({ xp: 0 }), {
    getItem: k => valores.get(k) ?? null, setItem: (k,v) => valores.set(k,v),
  });
  assert.equal(store.leer().xp, 0);
  store.guardar({ xp: 10 });
  cuenta = { uid: 'b', demo: false }; assert.equal(store.leer().xp, 0);
  store.guardar({ xp: 20 });
  cuenta = { uid: 'a', demo: false }; assert.equal(store.leer().xp, 10);
  cuenta = { uid: 'demo', demo: true }; assert.equal(store.leer().xp, 99);
  assert.equal(JSON.parse(valores.get('marca:retos')).xp, 99, 'el legado no se borra');
});

test('un fallo de escritura no confirma avance y JSON roto no impide abrir los retos', () => {
  const store = crearAlmacenPorCuenta('marca', () => ({ uid: 'a', demo: false }), () => ({ xp: 0 }), {
    getItem: () => '{roto', setItem: () => { throw new Error('Sin espacio'); },
  });
  assert.equal(store.leer().xp, 0);
  assert.throws(() => store.guardar({ xp: 10 }), /Sin espacio/);
});



test('un quiz sin clave del servidor no se califica como acertado al agotar el tiempo', () => {
  for (const correcta of [-1, 2, null, '0', NaN, 0.5]) assert.equal(preguntaConRespuesta({ opciones: ['A','B'], correcta }), false);
  assert.equal(preguntaConRespuesta({ opciones: ['A','B'], correcta: 0 }), true);
  assert.equal(preguntaConRespuesta({ opciones: ['A','B'], correcta: 1 }), true);
});


async function clienteConFirebase(fetcher) {
  const instance = { currentUser: null };
  const firebase = { getAuth: () => instance, setPersistence: async () => {}, browserLocalPersistence: {},
    onAuthStateChanged: (_auth, cb) => { cb(null); return () => {}; } };
  const vacio = { usarUsuario() {}, set: () => ({}), hidratar: () => ({}) };
  const mocks = {
    './remoto': { invalidarClub() {} }, './datos': { Datos: { modo: 'api' } },
    './perfil': { Perfil: vacio }, './progreso': { Progreso: vacio },
    './historia': { usarUsuarioHistoria() {} },
    './member-api': { MEMBER_API_URL: '' }, './firebase-config': { FIREBASE_CONFIG: {} },
    'firebase/app': { initializeApp: () => ({}), getApps: () => [] },
    '@firebase/app': { initializeApp: () => ({}), getApps: () => [] },
    'firebase/auth': firebase, '@firebase/auth': firebase,
  };
  const env = { VITE_API_URL: 'http://prueba.invalid', VITE_FIREBASE_PROJECT_ID: 'globalvet-mexico',
    VITE_FIREBASE_API_KEY: 'prueba', VITE_FIREBASE_APP_ID: 'prueba', VITE_FIREBASE_AUTH_DOMAIN: 'prueba.invalid' };
  const source = fs.readFileSync(new URL('../src/core/auth.ts', import.meta.url), 'utf8').replaceAll('import.meta.env', JSON.stringify(env));
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText, {
    exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; }, fetch: fetcher,
    localStorage: { getItem: () => null }, location: { search: '' }, URLSearchParams,
  });
  await exports.Auth.iniciar();
  return { ...exports, instance };
}
test('no envía un token si la cuenta cambia mientras se obtiene', async () => {
  const token = diferida(); let envios = 0;
  const r = await clienteConFirebase(async () => { envios++; return { ok: true, json: async () => ({}) }; });
  r.instance.currentUser = { getIdToken: () => token.p };
  const respuesta = r.api('/me');
  r.instance.currentUser = { getIdToken: async () => 'token-b' };
  token.resolve('token-a');
  await assert.rejects(respuesta, /sesión cambió/);
  assert.equal(envios, 0);
});
test('descarta el cuerpo JSON que llega después de cambiar la cuenta de Firebase', async () => {
  const cuerpo = diferida();
  const r = await clienteConFirebase(async () => ({ ok: true, json: () => cuerpo.p }));
  r.instance.currentUser = { getIdToken: async () => 'token-a' };
  const respuesta = r.api('/me');
  await new Promise(ok => setImmediate(ok));
  r.instance.currentUser = { getIdToken: async () => 'token-b' };
  cuerpo.resolve({ perfil: { nombre: 'Privado de A' } });
  await assert.rejects(respuesta, /sesión cambió/);
});

