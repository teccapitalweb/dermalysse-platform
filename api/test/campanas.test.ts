import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { buildApp } from '../src/app.js';
import { MemoryFirestore } from '../src/adapters/firestore/memoria.js';
import type { FetchLike } from '../src/adapters/legacy/webhook.js';
import type { TokenDecodificado } from '../src/adapters/firebase/firebaseAuth.js';
import { CAMPANA_BIENVENIDA_ID, CampanasService, COLECCION_CAMPANAS, CODIGO_BIENVENIDA } from '../src/services/campanas.js';

const CUENTA_FALSA = JSON.stringify({ project_id: 'club-dermalysse', client_email: 'prueba@example.invalid', private_key: 'llave-falsa-de-prueba' });
const ENV = {
  AUTH_MODE: 'firebase', DATA_MODE: 'firestore', FIREBASE_SERVICE_ACCOUNT: CUENTA_FALSA,
  LEGACY_WEBHOOK_URL: 'https://webhook.example.test/', APP_URL: 'https://club.example.test', CORS_ORIGINS: 'https://club.example.test',
} as unknown as NodeJS.ProcessEnv;
const AHORA = new Date('2026-10-28T18:00:00.000Z');
const fetchFalso: FetchLike = async () => { throw new TypeError('sin red en esta prueba'); };
const verificador = {
  async verifyIdToken(token: string): Promise<TokenDecodificado> {
    if (!token.startsWith('tok-')) throw Object.assign(new Error('bad token'), { code: 'auth/argument-error' });
    const uid = token.slice(4);
    return { uid, email: `${uid}@example.test`, name: uid };
  },
};

function materiales(db: MemoryFirestore) {
  db.sembrar('pdfs/p-1784228079707', { name: 'REGULACIÓN COSMÉTICA', estado: 'disponible', drive: 'https://drive.google.com/file/d/regulacion/view' });
  db.sembrar('pdfs/p-1784228150217', { name: 'ESTUDIOS DE ESTABILIDAD', estado: 'disponible', drive: 'https://drive.google.com/file/d/estabilidad/view' });
}

let db: MemoryFirestore;
let server: Server;
let base: string;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const get = (ruta: string, token?: string) => fetch(base + ruta, { headers: token ? auth(token) : {} });
const send = (ruta: string, method: string, cuerpo?: unknown, token?: string) => fetch(base + ruta, {
  method,
  headers: { 'Content-Type': 'application/json', ...(token ? auth(token) : {}) },
  body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
});

before(async () => {
  db = new MemoryFirestore();
  materiales(db);
  db.sembrar('users/miembro', { name: 'Miembro', email: 'miembro@example.test' });
  db.sembrar('users/admin', { name: 'Admin', email: 'admin@example.test' });
  db.sembrar('admins/admin', { email: 'admin@example.test' });
  const app = buildApp(ENV, { firestore: db, verificador, fetch: fetchFalso, catalogoEditorial: [], ahora: () => AHORA });
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => { server?.close(); });

test('campaña de bienvenida exige sesión y nunca expone el código oficial en GET', async () => {
  assert.equal((await get('/campanas/bienvenida')).status, 401);
  const respuesta = await get('/campanas/bienvenida', 'tok-miembro');
  assert.equal(respuesta.status, 200);
  const campana = await respuesta.json() as any;
  assert.equal(campana.id, CAMPANA_BIENVENIDA_ID);
  assert.equal(campana.cupoTotal, 50);
  assert.equal(campana.lugaresRestantes, 50);
  assert.equal(campana.debeMostrar, true);
  assert.equal(campana.beneficios.diamantes, 750);
  assert.equal(campana.beneficios.vipDias, 7);
  assert.equal(campana.beneficios.materiales.length, 2);
  assert.equal('codigo' in campana, false);
});

test('las dos formas de cerrar pueden posponer siete días en backend', async () => {
  const r = await send(`/campanas/${CAMPANA_BIENVENIDA_ID}/posponer`, 'POST', {}, 'tok-miembro');
  assert.equal(r.status, 200);
  const pospuesta = await r.json() as any;
  assert.equal(pospuesta.pospuestaHasta, '2026-11-04T18:00:00.000Z');
  const campana = await (await get('/campanas/bienvenida', 'tok-miembro')).json() as any;
  assert.equal(campana.debeMostrar, false);
  assert.equal(campana.pospuestaHasta, pospuesta.pospuestaHasta);
});

test('un código inválido no reserva cupo ni entrega beneficios', async () => {
  const r = await send('/campanas/canjear', 'POST', { codigo: 'NO-EXISTE' }, 'tok-miembro');
  assert.equal(r.status, 404);
  assert.equal(db.crudo(`${COLECCION_CAMPANAS}/${CAMPANA_BIENVENIDA_ID}`)?.solicitudes, 0);
  assert.equal(db.crudo('v2_puntos/miembro'), undefined);
});

test('canje válido entrega Diamantes, VIP y dos materiales en una sola operación', async () => {
  const r = await send('/campanas/canjear', 'POST', { codigo: ' dermalysse 50 ' }, 'tok-miembro');
  assert.equal(r.status, 200);
  const cuerpo = await r.json() as any;
  assert.equal(cuerpo.ok, true);
  assert.equal(cuerpo.campana.canje.estado, 'entregado');
  assert.equal('codigo' in cuerpo.campana.canje, false, 'ni el canje exitoso vuelve a publicar el código');
  assert.equal('uid' in cuerpo.campana.canje, false, 'la respuesta del miembro no necesita identificadores internos');
  assert.equal(cuerpo.campana.debeMostrar, false);
  assert.equal(db.crudo('v2_puntos/miembro')?.saldo, 750);
  assert.equal(db.crudo('v2_puntos/miembro')?.experiencia, 0, 'una promoción no adelanta niveles');
  assert.equal(db.crudo('users/miembro')?.vigenciaHasta, '2026-11-04T18:00:00.000Z');
  assert.equal(db.crudo('v2_beneficios/miembro__p-1784228079707')?.origen, 'campana');
  assert.equal(db.crudo('v2_beneficios/miembro__p-1784228150217')?.origen, 'campana');
  const campaña = db.crudo(`${COLECCION_CAMPANAS}/${CAMPANA_BIENVENIDA_ID}`)!;
  assert.deepEqual([campaña.solicitudes, campaña.emitidos, campaña.activados], [1, 1, 1]);

  const repetido = await send('/campanas/canjear', 'POST', { codigo: CODIGO_BIENVENIDA }, 'tok-miembro');
  assert.equal(repetido.status, 409);
  assert.equal(db.crudo('v2_puntos/miembro')?.saldo, 750, 'repetir nunca duplica el saldo');
  const despues = await (await get('/campanas/bienvenida', 'tok-miembro')).text();
  assert.equal(despues.includes(CODIGO_BIENVENIDA), false, 'GET sigue sin filtrar el código después del canje');
});

test('el cupo de 50 se reserva atómicamente bajo concurrencia', async () => {
  const local = new MemoryFirestore();
  materiales(local);
  const servicio = new CampanasService(local, () => AHORA);
  const resultados = await Promise.allSettled(Array.from({ length: 51 }, (_, i) => servicio.canjear(`cuenta-${i + 1}`, CODIGO_BIENVENIDA)));
  assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 50);
  assert.equal(resultados.filter((r) => r.status === 'rejected').length, 1);
  const campaña = local.crudo(`${COLECCION_CAMPANAS}/${CAMPANA_BIENVENIDA_ID}`)!;
  assert.deepEqual([campaña.solicitudes, campaña.emitidos, campaña.activados], [50, 50, 50]);
  assert.equal((await servicio.bienvenida('cuenta-51')).estado, 'agotada');
});

test('el admin ve métricas agregadas y puede pausar o ampliar el cupo', async () => {
  const listado = await get('/admin/campanas', 'tok-admin');
  assert.equal(listado.status, 200);
  const [campana] = await listado.json() as any[];
  assert.equal(campana.codigo, CODIGO_BIENVENIDA);
  assert.equal(campana.solicitudes, 1);
  assert.equal(campana.grafica[0].solicitudes, 1);
  assert.equal('email' in campana.grafica[0], false);

  const pausa = await send(`/admin/campanas/${CAMPANA_BIENVENIDA_ID}`, 'PATCH', { estado: 'pausada', cupoTotal: 60 }, 'tok-admin');
  assert.equal(pausa.status, 200);
  const actualizada = await pausa.json() as any;
  assert.equal(actualizada.estado, 'pausada');
  assert.equal(actualizada.cupoTotal, 60);
});
