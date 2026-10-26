// Módulo VIP (recompensas + cupones) en modo producción armado con buildApp: Firestore FALSO en memoria,
// verificador de ID tokens falso y fetch falso. SIN red. Reloj fijo inyectado (ahora).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { buildApp } from '../src/app.js';
import { MemoryFirestore } from '../src/adapters/firestore/memoria.js';
import type { FetchLike } from '../src/adapters/legacy/webhook.js';
import type { TokenDecodificado } from '../src/adapters/firebase/firebaseAuth.js';
import { avanceDesdeProgress } from '../src/adapters/firestore/metricasVip.js';
import { REGLAS_RECOMPENSAS, diasDeRegla } from '../src/services/recompensas.js';
import { normalizarCodigo } from '../src/services/cupones.js';
import { COLECCION_BITACORA_VIP } from '../src/services/vip.js';
import { nivelDe } from '../src/services/puntos.js';

const CUENTA_FALSA = JSON.stringify({ project_id: 'club-dermalysse', client_email: 'prueba@example.invalid', private_key: 'llave-falsa-de-prueba' });
const ENV = {
  AUTH_MODE: 'firebase', DATA_MODE: 'firestore', FIREBASE_SERVICE_ACCOUNT: CUENTA_FALSA,
  LEGACY_WEBHOOK_URL: 'https://webhook.example.test/', APP_URL: 'https://club.example.test', CORS_ORIGINS: 'https://club.example.test',
} as unknown as NodeJS.ProcessEnv;

const AHORA = new Date('2026-10-15T12:00:00.000Z');
const DIA = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const CORTESIA = iso(AHORA.getTime() + 10 * DIA); // cortesía vigente de u-avance
const SUSCRIPCION = { status: 'active', plan: 'anual', currentPeriodEnd: iso(AHORA.getTime() + 200 * DIA), stripeCustomerId: 'cus_prueba', cancelAtPeriodEnd: false };

const TOKENS: Record<string, TokenDecodificado> = {
  'tok-avance': { uid: 'u-avance', email: 'avance@example.test', name: 'Avance' },
  'tok-libre': { uid: 'u-libre', email: 'libre@example.test', name: 'Libre' },
  'tok-tercero': { uid: 'u-tercero', email: 'tercero@example.test', name: 'Tercero' },
  'tok-puntos-vip': { uid: 'u-puntos-vip', email: 'puntos@example.test', name: 'Puntos' },
  'tok-admin': { uid: 'u-admin', email: 'admin@example.test', name: 'Admin' },
};
const verificador = {
  async verifyIdToken(token: string): Promise<TokenDecodificado> {
    const t = TOKENS[token];
    if (!t) throw Object.assign(new Error('bad token'), { code: 'auth/argument-error' });
    return t;
  },
};
const fetchFalso: FetchLike = async () => { throw new TypeError('sin red en esta prueba'); };

let db: MemoryFirestore;
let server: Server;
let base: string;

function sembrar(f: MemoryFirestore) {
  const leccion = (id: string) => ({ id, name: id, videoId: 'aaaaaaaa-1111-2222-3333-444444444444' });
  f.sembrar('courses/course-a', { name: 'A', status: 'published', lessons: [leccion('a1'), leccion('a2'), leccion('a3')] });
  f.sembrar('courses/course-c', { name: 'C', status: 'published', lessons: [leccion('c1'), leccion('c2'), leccion('c3'), leccion('c4')] });
  f.sembrar('courses/course-borrador', { name: 'B', status: 'draft', lessons: [leccion('b1')] });

  // u-avance: course-a completo (3; el 9 está fuera de rango y el 3 repetido), 2 de course-c, borrador ignorado ⇒ 5 clases, 1 curso.
  f.sembrar('users/u-avance', {
    name: 'Avance', email: 'avance@example.test', subscription: SUSCRIPCION,
    vigenciaHasta: CORTESIA, regaloDesde: '2026-10-01T00:00:00.000Z',
    progress: { 'course-a': [1, 2, 3, 3, 9], 'course-c': [1, 2], 'course-borrador': [1] },
  });
  // 6 niveles REALES + ids inventados: solo los reales cuentan (impide inflar el progreso con PATCH /historia).
  f.sembrar('v2_historia/u-avance', { uid: 'u-avance', completados: ['fototipo-ii-fotoproteccion', 'primera-consulta-cosmiatria', 'etiqueta-cosmetica-incompleta', 'limpieza-piel-sensibilizada', 'expectativas-corporal', 'bioseguridad-cabina-contratiempo', 'nivel-inventado-1', 'nivel-inventado-2', 'nivel-inventado-3', 'nivel-inventado-4'], puntajes: {} });
  f.sembrar('forum/h1', { title: 'Uno', authorUid: 'u-avance', createdAt: 1 });
  f.sembrar('forum/h2', { title: 'Dos', authorUid: 'u-avance', createdAt: 2 });
  f.sembrar('forum/h3', { title: 'Tres', authorUid: 'u-avance', createdAt: 3 });
  f.sembrar('forum/h4', { title: 'Oculto', authorUid: 'u-avance', createdAt: 4, oculto: true });
  f.sembrar('forum/h5', { title: 'Ajeno', authorUid: 'u-otro', createdAt: 5 });
  f.sembrar('certificates/DRML-2026-AAAAAAAAAAAA', { uid: 'u-avance', courseId: 'course-a', status: 'valid' });
  f.sembrar('certificates/DRML-2026-BBBBBBBBBBBB', { uid: 'u-avance', courseId: 'course-c', status: 'revoked' });
  f.sembrar('v2_retos_estado/u-avance', { xp: 80, quizBest: 300, casos: {}, sr: {}, diaria: { fecha: '2026-10-15', racha: 2 } });
  f.sembrar('pdfs/p-1784228079707', { id: 'p-1784228079707', name: 'REGULACIÓN COSMÉTICA', status: 'published', estado: 'disponible', drive: 'https://drive.google.com/file/d/archivo-prueba/view', downloads: 0 });

  // u-libre: cortesía vencida, 5 clases de course-c (sin completar el curso).
  f.sembrar('users/u-libre', { name: 'Libre', email: 'libre@example.test', vigenciaHasta: '2026-01-01T00:00:00.000Z', progress: { 'course-c': [1, 2, 3], 'course-a': [1, 2] } });
  f.sembrar('users/u-tercero', { name: 'Tercero', email: 'tercero@example.test' });
  f.sembrar('v2_puntos/u-tercero', { uid: 'u-tercero', saldo: 300, experiencia: 300, ganados: 300, gastados: 0, canjes: 0, acreditado: { clases: 0, cursos: 0, certificados: 0, puntosRetos: 0 }, vipDiasPorAnio: {}, actualizado: AHORA.toISOString() });
  f.sembrar('users/u-puntos-vip', { name: 'Puntos', email: 'puntos@example.test', subscription: { status: 'inactive', plan: null } });
  f.sembrar('v2_puntos/u-puntos-vip', { uid: 'u-puntos-vip', saldo: 8000, experiencia: 8000, ganados: 8000, gastados: 0, canjes: 0, acreditado: { clases: 0, cursos: 0, certificados: 0, puntosRetos: 0 }, vipDiasPorAnio: {}, actualizado: AHORA.toISOString() });
  f.sembrar('admins/u-admin', { email: 'admin@example.test' });
  f.sembrar('users/u-admin', { name: 'Admin', email: 'admin@example.test' });

  // Cupones sembrados para los errores.
  f.sembrar('v2_cupones/VENCIDO-1', { codigo: 'VENCIDO-1', duracion: '15d', dias: 15, maxUsos: 10, usos: 0, activo: true, venceEn: '2026-10-01T00:00:00.000Z', creadoEn: '2026-09-01T00:00:00.000Z' });
  f.sembrar('v2_cupones/INACTIVO-1', { codigo: 'INACTIVO-1', duracion: '15d', dias: 15, maxUsos: 10, usos: 0, activo: false, venceEn: null, creadoEn: '2026-09-01T00:00:00.000Z' });
}

before(async () => {
  db = new MemoryFirestore();
  sembrar(db);
  const app = buildApp(ENV, { firestore: db, verificador, fetch: fetchFalso, catalogoEditorial: [], ahora: () => AHORA });
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server?.close(); });

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const get = (ruta: string, token?: string) => fetch(base + ruta, { headers: token ? auth(token) : {} });
const send = (ruta: string, method: string, cuerpo?: unknown, token?: string) =>
  fetch(base + ruta, { method, headers: { 'Content-Type': 'application/json', ...(token ? auth(token) : {}) }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
const json = (r: Response): Promise<any> => r.json();
const usuario = (uid: string) => db.crudo(`users/${uid}`)!;
const porId = (lista: any[]) => Object.fromEntries(lista.map((r) => [r.id, r]));

// ── Unidades ──

test('reglas: las 8 del club con sus metas y días (1 mes = 30)', () => {
  const resumen = REGLAS_RECOMPENSAS.map((r) => `${r.id}:${r.meta}:${diasDeRegla(r)}`);
  assert.deepEqual(resumen, ['primer-paso:5:7', 'curso-completo:1:15', 'doble-logro:2:30', 'explorador:5:7', 'aventurero:10:15', 'participativo:3:7', 'certificado:1:15', 'maestro:5:30']);
});

test('avanceDesdeProgress: solo índices válidos de cursos publicados, sin repetidos', () => {
  const clases = new Map([['a', 3], ['c', 4]]);
  assert.deepEqual(avanceDesdeProgress({ a: [3, 1, 2, 2, 0, 9, 'x'], c: [4], z: [1, 2] }, clases), { clasesVistas: 4, cursosCompletados: 1 });
  assert.deepEqual(avanceDesdeProgress(null, clases), { clasesVistas: 0, cursosCompletados: 0 });
});

test('Puntos Dermalysse conserva seis niveles y Legado es el nivel máximo', () => {
  assert.equal(nivelDe(0).id, 'descubrimiento');
  assert.equal(nivelDe(300).id, 'constancia');
  assert.equal(nivelDe(3500).id, 'curaduria');
  assert.deepEqual(nivelDe(6000), {
    id: 'legado', nombre: 'Legado Dermalysse', desde: 6000, siguiente: null,
    descripcion: 'El nivel de participación más alto del club.',
  });
});

test('normalizarCodigo: mayúsculas, sin espacios; formatos imposibles ⇒ null', () => {
  assert.equal(normalizarCodigo('  derma-ab cd '), 'DERMA-ABCD');
  assert.equal(normalizarCodigo('a/b'), null);
  assert.equal(normalizarCodigo(''), null);
  assert.equal(normalizarCodigo(7), null);
});

// ── Recompensas ──

test('GET /recompensas exige sesión', async () => {
  assert.equal((await get('/recompensas')).status, 401);
  assert.equal((await send('/beneficios/material-regulacion-cosmetica/canjear', 'POST')).status, 401);
});

test('GET /recompensas: progreso y Puntos Dermalysse calculados en el servidor', async () => {
  const r = await get('/recompensas', 'tok-avance');
  assert.equal(r.status, 200);
  const { recompensas, puntos, boutique, movimientos, hitos, colecciones, objetivo, vipAnual, proximasFormasDeGanar } = await json(r);
  assert.equal(recompensas.length, 8);
  const x = porId(recompensas);
  const resumen = (id: string) => `${x[id].progreso}/${x[id].meta}:${x[id].completado}`;
  assert.equal(resumen('primer-paso'), '5/5:true');
  assert.equal(resumen('curso-completo'), '1/1:true');
  assert.equal(resumen('doble-logro'), '1/2:false');
  assert.equal(resumen('explorador'), '5/5:true'); // 6 niveles REALES (los 4 inventados no cuentan), tope en la meta
  assert.equal(resumen('aventurero'), '6/10:false'); // 6 de 10 niveles reales; los inventados por PATCH /historia no suben el progreso
  assert.equal(resumen('participativo'), '3/3:true'); // el hilo oculto y el ajeno no cuentan
  assert.equal(resumen('certificado'), '1/1:true'); // el revocado no cuenta
  assert.equal(resumen('maestro'), '1/5:false');
  // Forma exacta del cliente.
  assert.deepEqual(Object.keys(x['curso-completo']).sort(), ['canjeadoEn', 'canjeado', 'completado', 'descripcion', 'disponible', 'icono', 'id', 'meta', 'motivoPausa', 'nombre', 'premio', 'progreso'].sort());
  assert.deepEqual(x['curso-completo'].premio, { duracion: '15d', dias: null });
  assert.deepEqual(x['primer-paso'].premio, { duracion: 'personalizada', dias: 7 });
  assert.equal(x['primer-paso'].canjeado, false);
  assert.equal(x['primer-paso'].canjeadoEn, null);
  assert.equal(x['explorador'].disponible, false, 'Historia no entrega valor hasta ser autoritativa');
  assert.equal(x['participativo'].disponible, false, 'el foro requiere moderación de calidad');
  assert.equal(puntos.saldo, 540, '240 base + bonos vitalicios de primera clase, 5 clases, primer curso y certificado');
  assert.equal(puntos.experiencia, 540);
  assert.equal(puntos.nivel.id, 'constancia');
  assert.deepEqual(puntos.metricas, { clases: 5, cursos: 1, certificados: 1, xpRetos: 80 });
  assert.ok(boutique.some((b: any) => b.id === 'material-regulacion-cosmetica' && b.disponible));
  assert.ok(boutique.some((b: any) => b.id === 'vip-1-dia'));
  assert.ok(boutique.some((b: any) => b.id === 'vip-30-dias'));
  assert.ok(boutique.some((b: any) => b.id === 'vip-7-dias'));
  assert.equal(movimientos.length, 8);
  assert.equal(hitos.length, 11);
  assert.equal(hitos.filter((h: any) => h.completado).length, 4);
  assert.equal(porId(hitos)['primer-curso'].premio, 125);
  assert.equal(colecciones.length, 4);
  assert.equal(objetivo.beneficioId, 'material-regulacion-cosmetica');
  assert.deepEqual(vipAnual, { anio: 2026, usados: 0, disponibles: 30, limite: 30 });
  assert.equal(proximasFormasDeGanar.length, 3);

  const repetido = await json(await get('/recompensas', 'tok-avance'));
  assert.equal(repetido.puntos.saldo, 540, 'la reconciliación y los bonos son idempotentes');
  assert.equal(repetido.movimientos.length, 8, 'no duplica movimientos ni bonos');
});

test('recompensas no autoritativas conservan avance, pero no se pueden canjear', async () => {
  const r = await send('/recompensas/explorador/canjear', 'POST', undefined, 'tok-avance');
  assert.equal(r.status, 409);
  assert.equal((await json(r)).error, 'recompensa/validacion-pendiente');
});

test('no se puede canjear una recompensa incompleta ni una inexistente', async () => {
  const antes = usuario('u-avance');
  const r = await send('/recompensas/doble-logro/canjear', 'POST', undefined, 'tok-avance');
  assert.equal(r.status, 403);
  const cuerpo = await json(r);
  assert.equal(cuerpo.error, 'recompensa/incompleta');
  assert.equal(cuerpo.progreso, 1);
  assert.equal((await send('/recompensas/no-existe/canjear', 'POST', undefined, 'tok-avance')).status, 404);
  assert.deepEqual(usuario('u-avance'), antes);
  assert.equal(db.crudo('v2_recompensas/u-avance'), undefined);
});

test('canje de recompensa: extiende desde la cortesía vigente, conserva regaloDesde y el segundo intento es 409', async () => {
  const r = await send('/recompensas/curso-completo/canjear', 'POST', undefined, 'tok-avance');
  assert.equal(r.status, 200);
  const cuerpo = await json(r);
  const esperado = iso(Date.parse(CORTESIA) + 15 * DIA);
  assert.equal(cuerpo.hasta, esperado);
  assert.equal(cuerpo.dias, 15);
  assert.equal(cuerpo.recompensa.canjeado, true);
  assert.equal(cuerpo.recompensa.canjeadoEn, AHORA.toISOString());
  const u = usuario('u-avance');
  assert.equal(u.vigenciaHasta, esperado);
  assert.equal(u.regaloDesde, '2026-10-01T00:00:00.000Z');
  assert.deepEqual(u.subscription, SUSCRIPCION);

  const otra = await send('/recompensas/curso-completo/canjear', 'POST', undefined, 'tok-avance');
  assert.equal(otra.status, 409);
  assert.equal((await json(otra)).error, 'recompensa/canjeada');
  assert.equal(usuario('u-avance').vigenciaHasta, esperado, 'el segundo intento no suma días');

  const lista = porId((await json(await get('/recompensas', 'tok-avance'))).recompensas);
  assert.equal(lista['curso-completo'].canjeado, true);
  assert.equal(lista['curso-completo'].canjeadoEn, AHORA.toISOString());
  assert.equal(lista['primer-paso'].canjeado, false);
});

test('canjes sucesivos se suman sobre la nueva vigencia', async () => {
  const previa = usuario('u-avance').vigenciaHasta as string;
  const cuerpo = await json(await send('/recompensas/primer-paso/canjear', 'POST', undefined, 'tok-avance'));
  assert.equal(cuerpo.hasta, iso(Date.parse(previa) + 7 * DIA));
});

test('canje con cortesía vencida: cuenta desde ahora y regaloDesde arranca hoy', async () => {
  const cuerpo = await json(await send('/recompensas/primer-paso/canjear', 'POST', undefined, 'tok-libre'));
  assert.equal(cuerpo.hasta, iso(AHORA.getTime() + 7 * DIA));
  assert.equal(usuario('u-libre').regaloDesde, AHORA.toISOString());
});

// ── Boutique de beneficios ──

test('material canjeado con puntos queda disponible permanentemente y no se cobra dos veces', async () => {
  const antes = await get('/materiales/p-1784228079707/acceso', 'tok-tercero');
  assert.equal(antes.status, 403);
  const r = await send('/beneficios/material-regulacion-cosmetica/canjear', 'POST', undefined, 'tok-tercero');
  assert.equal(r.status, 200);
  const cuerpo = await json(r);
  assert.equal(cuerpo.canje.costo, 200);
  assert.equal(cuerpo.canje.materialId, 'p-1784228079707');
  assert.equal(cuerpo.puntos.saldo, 100);
  assert.equal(cuerpo.puntos.experiencia, 300, 'gastar no baja el nivel ni la experiencia');
  assert.equal(db.crudo('v2_beneficios/u-tercero__p-1784228079707')?.permanente, true);
  const acceso = await json(await get('/materiales/p-1784228079707/acceso', 'tok-tercero'));
  assert.equal(acceso.url, 'https://drive.google.com/file/d/archivo-prueba/view');
  const repetido = await send('/beneficios/material-regulacion-cosmetica/canjear', 'POST', undefined, 'tok-tercero');
  assert.equal(repetido.status, 409);
  assert.equal((await json(repetido)).error, 'beneficio/ya-canjeado');
  assert.equal(db.crudo('v2_puntos/u-tercero')?.saldo, 100);
});

test('beneficio rechaza saldo insuficiente sin crear canje', async () => {
  const r = await send('/beneficios/vip-3-dias/canjear', 'POST', undefined, 'tok-libre');
  assert.equal(r.status, 409);
  const cuerpo = await json(r);
  assert.equal(cuerpo.error, 'puntos/insuficientes');
  assert.equal(cuerpo.costo, 900);
  assert.equal((await send('/beneficios/no-existe/canjear', 'POST', undefined, 'tok-libre')).status, 404);
});

test('días VIP con puntos se suman por vip.ts y respetan el máximo de 30 días por año', async () => {
  const primero = await json(await send('/beneficios/vip-15-dias/canjear', 'POST', undefined, 'tok-puntos-vip'));
  assert.equal(primero.canje.diasVip, 15);
  assert.equal(primero.puntos.saldo, 4500);
  const segundo = await json(await send('/beneficios/vip-15-dias/canjear', 'POST', undefined, 'tok-puntos-vip'));
  assert.equal(segundo.puntos.saldo, 1000);
  assert.equal(segundo.canje.vigenciaHasta, iso(AHORA.getTime() + 30 * DIA));
  const limite = await send('/beneficios/vip-3-dias/canjear', 'POST', undefined, 'tok-puntos-vip');
  assert.equal(limite.status, 409);
  assert.equal((await json(limite)).error, 'beneficio/limite-vip');
  assert.equal(db.crudo('v2_puntos/u-puntos-vip')?.saldo, 1000, 'el rechazo no descuenta puntos');
  assert.deepEqual(usuario('u-puntos-vip').subscription, { status: 'inactive', plan: null });
  const panel = await json(await get('/recompensas', 'tok-puntos-vip'));
  assert.deepEqual(panel.vipAnual, { anio: 2026, usados: 30, disponibles: 0, limite: 30 });
  assert.ok(panel.boutique.filter((b: any) => b.categoria === 'vip').every((b: any) => b.puedeCanjear === false));
});

// ── Cupones (admin) ──

let compartido = '';

test('admin de cupones: 401 sin sesión y 403 para quien no es admin', async () => {
  assert.equal((await get('/admin/cupones')).status, 401);
  assert.equal((await get('/admin/cupones', 'tok-libre')).status, 403);
  assert.equal((await send('/admin/cupones', 'POST', { duracion: '1m', modalidad: 'compartido', cantidad: 2 }, 'tok-libre')).status, 403);
  assert.equal((await send('/admin/cupones/VENCIDO-1', 'PATCH', { activo: true }, 'tok-libre')).status, 403);
  assert.equal(db.crudo('v2_cupones/VENCIDO-1')!.activo, true);
});

test('POST /admin/cupones compartido: 1 código con N usos e idempotente', async () => {
  const cuerpo = { duracion: '1m', modalidad: 'compartido', cantidad: 2, idempotencia: 'lote-prueba-0001' };
  const r = await send('/admin/cupones', 'POST', cuerpo, 'tok-admin');
  assert.equal(r.status, 201);
  const lote = await json(r);
  assert.equal(lote.id, 'lote-prueba-0001');
  assert.equal(lote.modalidad, 'compartido');
  assert.equal(lote.codigos.length, 1);
  assert.match(lote.codigos[0], /^DERMA-[A-Z2-9]{8}$/);
  compartido = lote.codigos[0];
  const doc = db.crudo(`v2_cupones/${compartido}`)!;
  assert.equal(doc.maxUsos, 2);
  assert.equal(doc.dias, 30);
  assert.equal(doc.usos, 0);

  const repetido = await json(await send('/admin/cupones', 'POST', cuerpo, 'tok-admin'));
  assert.deepEqual(repetido.codigos, lote.codigos, 'misma idempotencia ⇒ mismo lote');
});

test('POST /admin/cupones individuales y validaciones', async () => {
  const lote = await json(await send('/admin/cupones', 'POST', { duracion: 'personalizada', dias: 20, modalidad: 'individuales', cantidad: 3 }, 'tok-admin'));
  assert.equal(lote.codigos.length, 3);
  assert.equal(new Set(lote.codigos).size, 3);
  for (const c of lote.codigos) assert.equal(db.crudo(`v2_cupones/${c}`)!.maxUsos, 1);
  assert.equal(lote.dias, 20);

  for (const malo of [
    { duracion: 'personalizada', dias: 400, modalidad: 'compartido', cantidad: 1 },
    { duracion: '2y', modalidad: 'compartido', cantidad: 1 },
    { duracion: '1m', modalidad: 'otro', cantidad: 1 },
    { duracion: '1m', modalidad: 'compartido', cantidad: 101 },
  ]) assert.equal((await send('/admin/cupones', 'POST', malo, 'tok-admin')).status, 400, JSON.stringify(malo));

  const lista = await json(await get('/admin/cupones', 'tok-admin'));
  assert.ok(Array.isArray(lista));
  const codigos = lista.map((c: any) => c.codigo);
  for (const c of [compartido, ...lote.codigos, 'VENCIDO-1', 'INACTIVO-1']) assert.ok(codigos.includes(c), c);
  assert.deepEqual(Object.keys(lista[0]).sort(), ['activo', 'codigo', 'creadoEn', 'dias', 'duracion', 'loteId', 'maxUsos', 'usos', 'venceEn'].sort());
  assert.ok(!lista.some((c: any) => c.codigo === 'u-libre'), 'los canjes (subcolección) no aparecen como cupones');
});

// ── Cupones (canje) ──

test('canje de cupón: normaliza el código, suma 30 días y un segundo uso de la misma cuenta es 409', async () => {
  const previa = usuario('u-libre').vigenciaHasta as string; // vigente por la recompensa de arriba
  const r = await send('/cupones/canjear', 'POST', { codigo: `  ${compartido.toLowerCase()} ` }, 'tok-libre');
  assert.equal(r.status, 200);
  const cuerpo = await json(r);
  assert.equal(cuerpo.codigo, compartido);
  assert.equal(cuerpo.dias, 30);
  assert.equal(cuerpo.hasta, iso(Date.parse(previa) + 30 * DIA));
  assert.equal(db.crudo(`v2_cupones/${compartido}`)!.usos, 1);
  assert.equal(db.crudo(`v2_cupones/${compartido}/canjes/u-libre`)!.dias, 30);

  const otra = await send('/cupones/canjear', 'POST', { codigo: compartido }, 'tok-libre');
  assert.equal(otra.status, 409);
  assert.equal((await json(otra)).error, 'cupon/ya-usado');
  assert.equal(db.crudo(`v2_cupones/${compartido}`)!.usos, 1);
});

test('cupón agotado: el tercer canje de un código de 2 usos es 409', async () => {
  assert.equal((await send('/cupones/canjear', 'POST', { codigo: compartido }, 'tok-avance')).status, 200);
  const r = await send('/cupones/canjear', 'POST', { codigo: compartido }, 'tok-tercero');
  assert.equal(r.status, 409);
  assert.equal((await json(r)).error, 'cupon/agotado');
  assert.equal(usuario('u-tercero').vigenciaHasta, undefined);
});

test('cupón vencido (410), inactivo (409), inexistente (404), vacío (400) y sin sesión (401)', async () => {
  const casos: [unknown, number, string | null][] = [
    ['vencido-1', 410, 'cupon/vencido'],
    ['INACTIVO-1', 409, 'cupon/inactivo'],
    ['NO-EXISTE-99', 404, 'cupon/no-existe'],
    ['a/b', 404, 'cupon/no-existe'],
    ['', 400, null],
  ];
  for (const [codigo, status, error] of casos) {
    const r = await send('/cupones/canjear', 'POST', { codigo }, 'tok-tercero');
    assert.equal(r.status, status, String(codigo));
    const cuerpo = await json(r);
    if (error) assert.equal(cuerpo.error, error);
    assert.ok(typeof cuerpo.mensaje === 'string' && cuerpo.mensaje.length > 0);
  }
  assert.equal((await send('/cupones/canjear', 'POST', { codigo: 'VENCIDO-1' })).status, 401);
  assert.equal(usuario('u-tercero').vigenciaHasta, undefined);
});

test('PATCH /admin/cupones/:codigo desactiva y reactiva; desactivado no se canjea', async () => {
  const lote = await json(await send('/admin/cupones', 'POST', { duracion: '15d', modalidad: 'compartido', cantidad: 5 }, 'tok-admin'));
  const codigo = lote.codigos[0];
  const r = await send(`/admin/cupones/${codigo.toLowerCase()}`, 'PATCH', { activo: false }, 'tok-admin');
  assert.equal(r.status, 200);
  assert.equal((await json(r)).activo, false);
  assert.equal((await json(await send('/cupones/canjear', 'POST', { codigo }, 'tok-tercero'))).error, 'cupon/inactivo');
  assert.equal((await send(`/admin/cupones/${codigo}`, 'PATCH', { activo: true }, 'tok-admin')).status, 200);
  const ok = await json(await send('/cupones/canjear', 'POST', { codigo }, 'tok-tercero'));
  assert.equal(ok.hasta, iso(AHORA.getTime() + 15 * DIA));
  assert.equal((await send('/admin/cupones/NO-EXISTE-1', 'PATCH', { activo: true }, 'tok-admin')).status, 404);
  assert.equal((await send(`/admin/cupones/${codigo}`, 'PATCH', { activo: 'no' }, 'tok-admin')).status, 400);
});

// ── Invariantes ──

test('nunca se toca subscription: users/* solo recibe vigenciaHasta y regaloDesde, y todo queda en la bitácora', async () => {
  const escriturasUsers = db.escrituras.filter((e) => e.ruta.startsWith('users/'));
  assert.ok(escriturasUsers.length > 0);
  for (const e of escriturasUsers) {
    assert.equal(e.op, 'set-merge', e.ruta);
    assert.deepEqual(Object.keys(e.datos ?? {}).sort(), ['regaloDesde', 'vigenciaHasta'], e.ruta);
  }
  assert.deepEqual(usuario('u-avance').subscription, SUSCRIPCION);
  const bitacora = (await db.query(COLECCION_BITACORA_VIP)).map((d) => d.data()!);
  assert.equal(bitacora.length, escriturasUsers.length);
  assert.deepEqual(new Set(bitacora.map((b) => b.fuente)), new Set(['recompensa', 'cupon', 'puntos']));
});
