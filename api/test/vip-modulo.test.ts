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
import { COLECCION_BITACORA_ADMIN_PUNTOS, DIAMANTES_BIENVENIDA, nivelDe } from '../src/services/puntos.js';

const CUENTA_FALSA = JSON.stringify({ project_id: 'club-dermalysse', client_email: 'prueba@example.invalid', private_key: 'llave-falsa-de-prueba' });
const ENV = {
  AUTH_MODE: 'firebase', DATA_MODE: 'firestore', FIREBASE_SERVICE_ACCOUNT: CUENTA_FALSA,
  LEGACY_WEBHOOK_URL: 'https://webhook.example.test/', APP_URL: 'https://club.example.test', CORS_ORIGINS: 'https://club.example.test',
  CAMPANA_BIENVENIDA_CODIGO: 'TEST-DERMALYSSE-50',
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
  'tok-mision': { uid: 'u-mision', email: 'mision@example.test', name: 'Misión' },
  'tok-paquete': { uid: 'u-paquete', email: 'paquete@example.test', name: 'Paquete' },
  'tok-nivel': { uid: 'u-nivel', email: 'nivel@example.test', name: 'Nivel' },
  'tok-favoritos': { uid: 'u-favoritos', email: 'favoritos@example.test', name: 'Favoritos' },
  'tok-atelier': { uid: 'u-atelier', email: 'atelier@example.test', name: 'Atelier' },
  'tok-inicial': { uid: 'u-inicial', email: 'inicial@example.test', name: 'Inicial' },
  'tok-admin-ajuste': { uid: 'u-admin-ajuste', email: 'ajuste@example.test', name: 'Cuenta Ajuste' },
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
  for (const [id, name] of [
    ['p-1784228079707', 'REGULACIÓN COSMÉTICA'],
    ['p-1784228150217', 'ESTUDIOS DE ESTABILIDAD'],
    ['p-1784234741400', 'NUTRICIÓN Y PREVENCIÓN'],
    ['p-1781110394428', 'REJUVENECIMIENTO FACIAL'],
    ['p-1781111073624', 'MANUAL DE TÉCNICAS AVANZADAS'],
    ['p-1781111152335', 'CUADERNILLO DE TÉCNICAS AVANZADAS'],
    ['p-1778099917040', 'TECNOLOGÍAS EN COSMIATRÍA'],
    ['p-1778099998280', 'RADIOFRECUENCIA Y ULTRACAVITACIÓN'],
    ['p-1778100064887', 'DERMAPEN'],
  ]) f.sembrar(`pdfs/${id}`, { id, name, status: 'published', estado: 'disponible', drive: `https://drive.google.com/file/d/${id}/view`, downloads: 0 });

  // u-libre: cortesía vencida, 5 clases de course-c (sin completar el curso).
  f.sembrar('users/u-libre', { name: 'Libre', email: 'libre@example.test', vigenciaHasta: '2026-01-01T00:00:00.000Z', progress: { 'course-c': [1, 2, 3], 'course-a': [1, 2] } });
  f.sembrar('users/u-tercero', { name: 'Tercero', email: 'tercero@example.test' });
  f.sembrar('v2_puntos/u-tercero', { uid: 'u-tercero', saldo: 300, experiencia: 300, ganados: 300, gastados: 0, canjes: 0, acreditado: { clases: 0, cursos: 0, certificados: 0, puntosRetos: 0 }, vipDiasPorAnio: {}, actualizado: AHORA.toISOString() });
  f.sembrar('users/u-puntos-vip', { name: 'Puntos', email: 'puntos@example.test', subscription: { status: 'inactive', plan: null } });
  f.sembrar('users/u-mision', { name: 'Misión', email: 'mision@example.test', progress: {} });
  f.sembrar('users/u-paquete', { name: 'Paquete', email: 'paquete@example.test', progress: {} });
  f.sembrar('users/u-nivel', { name: 'Nivel', email: 'nivel@example.test', progress: {} });
  f.sembrar('users/u-favoritos', { name: 'Favoritos', email: 'favoritos@example.test', progress: {} });
  f.sembrar('users/u-atelier', { name: 'Atelier', email: 'atelier@example.test', progress: {} });
  f.sembrar('users/u-inicial', { name: 'Inicial', email: 'inicial@example.test', progress: {} });
  f.sembrar('users/u-admin-ajuste', { name: 'Cuenta', lastname: 'Ajuste', email: 'ajuste@example.test', progress: {} });
  f.sembrar('v2_puntos/u-puntos-vip', { uid: 'u-puntos-vip', saldo: 8000, experiencia: 8000, ganados: 8000, gastados: 0, canjes: 0, acreditado: { clases: 0, cursos: 0, certificados: 0, puntosRetos: 0 }, vipDiasPorAnio: {}, actualizado: AHORA.toISOString() });
  f.sembrar('v2_puntos/u-paquete', { uid: 'u-paquete', saldo: 2500, experiencia: 2500, ganados: 2500, gastados: 0, canjes: 0, acreditado: { clases: 0, cursos: 0, certificados: 0, puntosRetos: 0 }, vipDiasPorAnio: {}, actualizado: AHORA.toISOString() });
  f.sembrar('v2_puntos/u-nivel', { uid: 'u-nivel', saldo: 0, experiencia: 4000, ganados: 4000, gastados: 4000, canjes: 0, acreditado: { clases: 0, cursos: 0, certificados: 0, puntosRetos: 0 }, vipDiasPorAnio: {}, actualizado: AHORA.toISOString() });
  f.sembrar('v2_puntos/u-favoritos', { uid: 'u-favoritos', saldo: 2000, experiencia: 2000, ganados: 2000, gastados: 0, canjes: 0, acreditado: { clases: 0, cursos: 0, certificados: 0, puntosRetos: 0 }, vipDiasPorAnio: {}, actualizado: AHORA.toISOString() });
  f.sembrar('v2_puntos/u-atelier', { uid: 'u-atelier', saldo: 2000, experiencia: 2000, ganados: 2000, gastados: 0, canjes: 0, acreditado: { clases: 0, cursos: 0, certificados: 0, puntosRetos: 0 }, vipDiasPorAnio: {}, actualizado: AHORA.toISOString() });
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

test('Puntos Dermalysse conserva ocho niveles e Ícono es el nivel máximo', () => {
  assert.equal(nivelDe(0).id, 'descubrimiento');
  assert.equal(nivelDe(300).id, 'constancia');
  assert.equal(nivelDe(3500).id, 'curaduria');
  assert.equal(nivelDe(6000).id, 'legado');
  assert.equal(nivelDe(10000).id, 'maestria');
  assert.deepEqual(nivelDe(18000), {
    id: 'icono', nombre: 'Ícono Dermalysse', desde: 18000, siguiente: null,
    descripcion: 'El nivel de participación más alto del ecosistema Dermalysse.',
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
  assert.equal((await send('/puntos/misiones/estudio-1/activar', 'POST')).status, 401);
  assert.equal((await send('/puntos/objetivo', 'PUT', { beneficioId: 'vip-1-dia' })).status, 401);
  assert.equal((await send('/puntos/favoritos/vip-1-dia', 'PUT', { activo: true })).status, 401);
  assert.equal((await send('/beneficios/atelier/cotizar', 'POST', { materialIds: ['p-1784228079707', 'p-1784228150217'] })).status, 401);
  assert.equal((await send('/beneficios/atelier/canjear', 'POST', { materialIds: ['p-1784228079707', 'p-1784228150217'] })).status, 401);
  assert.equal((await send('/puntos/niveles/constancia/canjear', 'POST', { beneficioId: 'vip-1-dia' })).status, 401);
});

test('GET /recompensas: progreso y Puntos Dermalysse calculados en el servidor', async () => {
  const r = await get('/recompensas', 'tok-avance');
  assert.equal(r.status, 200);
  const { recompensas, puntos, boutique, movimientos, hitos, misiones, niveles, premiosNivel, colecciones, objetivo, favoritos, atelier, inteligencia, vipAnual, proximasFormasDeGanar } = await json(r);
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
  assert.equal(puntos.saldo, 890, 'incluye 350 diamantes de bienvenida más actividad y bonos vitalicios');
  assert.equal(puntos.experiencia, 540);
  assert.deepEqual(puntos.moneda, { nombre: 'Diamantes Dermalysse', singular: 'diamante', plural: 'diamantes', icono: 'gem' });
  assert.deepEqual(puntos.recompensaInicial, {
    nombre: 'Cofre de bienvenida', diamantes: DIAMANTES_BIENVENIDA, acreditada: true,
    descripcion: 'Saldo inicial real para elegir un material permanente o un pase VIP de 24 horas.',
  });
  assert.equal(puntos.nivel.id, 'constancia');
  assert.deepEqual(puntos.metricas, { clases: 5, cursos: 1, certificados: 1, xpRetos: 80, rachaRetos: 2 });
  assert.ok(boutique.some((b: any) => b.id === 'material-regulacion-cosmetica' && b.disponible));
  assert.ok(boutique.some((b: any) => b.id === 'vip-1-dia'));
  assert.ok(boutique.some((b: any) => b.id === 'vip-30-dias'));
  assert.ok(boutique.some((b: any) => b.id === 'vip-7-dias'));
  assert.equal(boutique.filter((b: any) => b.categoria === 'paquete').length, 4);
  assert.deepEqual(favoritos, []);
  assert.equal(atelier.minimo, 2);
  assert.equal(atelier.maximo, 5);
  assert.deepEqual(atelier.descuentos, [{ cantidad: 2, porcentaje: 8 }, { cantidad: 3, porcentaje: 12 }, { cantidad: 4, porcentaje: 16 }, { cantidad: 5, porcentaje: 20 }]);
  assert.equal(atelier.materiales.length, 9);
  assert.equal(inteligencia.materialesPermanentes, 0);
  assert.equal(inteligencia.historialMensual.length, 6);
  assert.equal(movimientos.length, 9);
  assert.equal(hitos.length, 24);
  assert.equal(hitos.filter((h: any) => h.completado).length, 4);
  assert.equal(porId(hitos)['primer-curso'].premio, 125);
  assert.equal(misiones.length, 9);
  assert.equal(misiones.filter((m: any) => m.estado === 'disponible').length, 3);
  assert.equal(niveles.length, 8);
  assert.equal(niveles.find((n: any) => n.actual).id, 'constancia');
  assert.equal(premiosNivel.length, 7);
  assert.equal(premiosNivel.find((n: any) => n.nivelId === 'constancia').desbloqueado, true);
  assert.equal(colecciones.length, 4);
  assert.equal(objetivo.beneficioId, 'material-regulacion-cosmetica');
  assert.deepEqual(vipAnual, { anio: 2026, usados: 0, disponibles: 30, limite: 30 });
  assert.equal(proximasFormasDeGanar.length, 3);

  const repetido = await json(await get('/recompensas', 'tok-avance'));
  assert.equal(repetido.puntos.saldo, 890, 'la reconciliación y los bonos son idempotentes');
  assert.equal(repetido.movimientos.length, 9, 'no duplica movimientos ni bonos');
});

test('toda cuenta recibe un Cofre de Bienvenida real, suficiente e idempotente', async () => {
  const inicial = await json(await get('/recompensas', 'tok-inicial'));
  assert.equal(inicial.puntos.saldo, DIAMANTES_BIENVENIDA);
  assert.equal(inicial.puntos.experiencia, 0, 'el regalo no infla el nivel educativo');
  assert.equal(inicial.puntos.nivel.id, 'descubrimiento');
  assert.equal(inicial.puntos.recompensaInicial.acreditada, true);
  assert.equal(inicial.movimientos.filter((m: any) => m.concepto === 'Cofre de bienvenida').length, 1);
  const canjeables = inicial.boutique.filter((b: any) => b.puedeCanjear).map((b: any) => b.id);
  assert.ok(canjeables.includes('material-regulacion-cosmetica'));
  assert.ok(canjeables.includes('material-estudios-estabilidad'));
  assert.ok(canjeables.includes('vip-1-dia'));
  const repetido = await json(await get('/recompensas', 'tok-inicial'));
  assert.equal(repetido.puntos.saldo, DIAMANTES_BIENVENIDA);
  assert.equal(repetido.movimientos.filter((m: any) => m.concepto === 'Cofre de bienvenida').length, 1);
});

test('misiones opt-in solo cuentan avance posterior, desbloquean tramos y no duplican premios', async () => {
  const inicial = await json(await send('/puntos/misiones/estudio-1/activar', 'POST', undefined, 'tok-mision'));
  assert.equal(inicial.mision.estado, 'activa');
  assert.equal(inicial.mision.progreso, 0);
  assert.equal(inicial.mision.meta, 5);

  const bloqueada = await send('/puntos/misiones/estudio-2/activar', 'POST', undefined, 'tok-mision');
  assert.equal(bloqueada.status, 409);
  assert.equal((await json(bloqueada)).error, 'mision/bloqueada');

  db.sembrar('users/u-mision', { name: 'Misión', email: 'mision@example.test', progress: { 'course-a': [1, 2, 3], 'course-c': [1, 2] } });
  const panel = await json(await get('/recompensas', 'tok-mision'));
  const misiones = porId(panel.misiones);
  assert.equal(misiones['estudio-1'].estado, 'completada');
  assert.equal(misiones['estudio-1'].progreso, 5);
  assert.equal(panel.puntos.saldo, 775, '350 de bienvenida + 50 de clases + 100 de curso + 200 de hitos + 75 de misión');
  assert.ok(panel.movimientos.some((m: any) => m.concepto.includes('Misión completada')));

  const segundo = await json(await send('/puntos/misiones/estudio-2/activar', 'POST', undefined, 'tok-mision'));
  assert.equal(segundo.mision.estado, 'activa');
  assert.equal(segundo.mision.meta, 10);
  assert.equal(segundo.mision.progreso, 0, 'el tramo nuevo captura una base nueva');

  const tercero = await send('/puntos/misiones/estudio-3/activar', 'POST', undefined, 'tok-mision');
  assert.equal(tercero.status, 409);
  assert.equal((await json(tercero)).error, 'mision/bloqueada');
  assert.equal((await send('/puntos/misiones/estudio-1/activar', 'POST', undefined, 'tok-mision')).status, 409);
  assert.equal((await send('/puntos/misiones/no-existe/activar', 'POST', undefined, 'tok-mision')).status, 404);

  const repetido = await json(await get('/recompensas', 'tok-mision'));
  assert.equal(repetido.puntos.saldo, 775, 'consultar de nuevo no repite bienvenida ni bono de misión');
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
  assert.equal(cuerpo.puntos.saldo, 450);
  assert.equal(cuerpo.puntos.experiencia, 300, 'gastar no baja el nivel ni la experiencia');
  assert.equal(db.crudo('v2_beneficios/u-tercero__p-1784228079707')?.permanente, true);
  const acceso = await json(await get('/materiales/p-1784228079707/acceso', 'tok-tercero'));
  assert.equal(acceso.url, 'https://drive.google.com/file/d/p-1784228079707/view');
  const repetido = await send('/beneficios/material-regulacion-cosmetica/canjear', 'POST', undefined, 'tok-tercero');
  assert.equal(repetido.status, 409);
  assert.equal((await json(repetido)).error, 'beneficio/ya-canjeado');
  assert.equal(db.crudo('v2_puntos/u-tercero')?.saldo, 450);
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
  assert.equal(primero.puntos.saldo, 4850);
  const segundo = await json(await send('/beneficios/vip-15-dias/canjear', 'POST', undefined, 'tok-puntos-vip'));
  assert.equal(segundo.puntos.saldo, 1350);
  assert.equal(segundo.canje.vigenciaHasta, iso(AHORA.getTime() + 30 * DIA));
  const limite = await send('/beneficios/vip-3-dias/canjear', 'POST', undefined, 'tok-puntos-vip');
  assert.equal(limite.status, 409);
  assert.equal((await json(limite)).error, 'beneficio/limite-vip');
  assert.equal(db.crudo('v2_puntos/u-puntos-vip')?.saldo, 1350, 'el rechazo no descuenta diamantes');
  assert.deepEqual(usuario('u-puntos-vip').subscription, { status: 'inactive', plan: null });
  const panel = await json(await get('/recompensas', 'tok-puntos-vip'));
  assert.deepEqual(panel.vipAnual, { anio: 2026, usados: 30, disponibles: 0, limite: 30 });
  assert.ok(panel.boutique.filter((b: any) => b.categoria === 'vip').every((b: any) => b.puedeCanjear === false));
});

test('colecciones: precio preferente, derechos reales y ajuste por materiales ya obtenidos', async () => {
  const inicial = await json(await get('/recompensas', 'tok-paquete'));
  const coleccion = inicial.boutique.find((b: any) => b.id === 'paquete-fundamentos-profesionales');
  assert.equal(coleccion.costo, 760);
  assert.equal(coleccion.costoOriginal, 910);
  assert.equal(coleccion.ahorro, 150);
  assert.equal(coleccion.faltanMateriales, 3);
  assert.equal(coleccion.incluye.length, 3);

  const r = await send('/beneficios/paquete-fundamentos-profesionales/canjear', 'POST', undefined, 'tok-paquete');
  assert.equal(r.status, 200);
  const cuerpo = await json(r);
  assert.equal(cuerpo.canje.categoria, 'paquete');
  assert.equal(cuerpo.canje.materialIds.length, 3);
  assert.equal(cuerpo.puntos.saldo, 2090);
  for (const id of ['p-1784228079707', 'p-1784228150217', 'p-1784234741400']) {
    assert.equal(db.crudo(`v2_beneficios/u-paquete__${id}`)?.permanente, true, id);
  }
  const panel = await json(await get('/recompensas', 'tok-paquete'));
  assert.equal(panel.boutique.find((b: any) => b.id === 'paquete-fundamentos-profesionales').canjeado, true);
  assert.ok(panel.boutique.filter((b: any) => b.categoria === 'material' && ['p-1784228079707', 'p-1784228150217', 'p-1784234741400'].includes(b.materialId)).every((b: any) => b.canjeado));
  assert.equal((await send('/beneficios/paquete-fundamentos-profesionales/canjear', 'POST', undefined, 'tok-paquete')).status, 409);

  const completa = panel.boutique.find((b: any) => b.id === 'paquete-biblioteca-completa');
  assert.equal(completa.faltanMateriales, 6);
  assert.ok(completa.costo < completa.costoOriginal, 'conserva el precio preferente únicamente sobre lo faltante');
});

test('meta de ahorro elegida persiste, se valida y puede despejarse', async () => {
  const elegida = await send('/puntos/objetivo', 'PUT', { beneficioId: 'paquete-rejuvenecimiento-facial' }, 'tok-paquete');
  assert.equal(elegida.status, 200);
  let panel = await json(await get('/recompensas', 'tok-paquete'));
  assert.equal(panel.objetivo.beneficioId, 'paquete-rejuvenecimiento-facial');
  assert.equal(panel.objetivo.personalizado, true);
  assert.equal(panel.boutique.find((b: any) => b.id === 'paquete-rejuvenecimiento-facial').esObjetivo, true);
  assert.equal((await send('/puntos/objetivo', 'PUT', { beneficioId: 'no-existe' }, 'tok-paquete')).status, 404);
  assert.equal((await send('/puntos/objetivo', 'PUT', { beneficioId: null }, 'tok-paquete')).status, 200);
  panel = await json(await get('/recompensas', 'tok-paquete'));
  assert.equal(panel.objetivo.personalizado, false);
});

test('ruta de deseos guarda hasta cinco beneficios reales y permite quitarlos', async () => {
  const ids = ['vip-1-dia', 'vip-2-dias', 'vip-3-dias', 'vip-5-dias', 'vip-7-dias'];
  for (const id of ids) {
    const r = await send(`/puntos/favoritos/${id}`, 'PUT', { activo: true }, 'tok-favoritos');
    assert.equal(r.status, 200, id);
  }
  let panel = await json(await get('/recompensas', 'tok-favoritos'));
  assert.deepEqual(panel.favoritos.map((b: any) => b.id), ids);
  assert.ok(ids.every((id) => panel.boutique.find((b: any) => b.id === id).esFavorito));
  const limite = await send('/puntos/favoritos/vip-10-dias', 'PUT', { activo: true }, 'tok-favoritos');
  assert.equal(limite.status, 409);
  assert.equal((await json(limite)).error, 'favorito/limite');
  assert.equal((await send('/puntos/favoritos/vip-1-dia', 'PUT', { activo: false }, 'tok-favoritos')).status, 200);
  assert.equal((await send('/puntos/favoritos/vip-1-dia', 'PUT', { activo: false }, 'tok-favoritos')).status, 200, 'quitar de nuevo es idempotente');
  assert.equal((await send('/puntos/favoritos/vip-2-dias', 'PUT', { activo: 'sí' }, 'tok-favoritos')).status, 400);
  panel = await json(await get('/recompensas', 'tok-favoritos'));
  assert.equal(panel.favoritos.length, 4);
  assert.equal(panel.boutique.find((b: any) => b.id === 'vip-1-dia').esFavorito, false);
});

test('Atelier cotiza y canjea una colección personalizada con precio autoritativo', async () => {
  const materialIds = ['p-1784228079707', 'p-1784228150217', 'p-1784234741400'];
  assert.equal((await send('/puntos/favoritos/material-regulacion-cosmetica', 'PUT', { activo: true }, 'tok-atelier')).status, 200);
  assert.equal((await send('/puntos/objetivo', 'PUT', { beneficioId: 'material-regulacion-cosmetica' }, 'tok-atelier')).status, 200);
  const cotizada = await send('/beneficios/atelier/cotizar', 'POST', { materialIds }, 'tok-atelier');
  assert.equal(cotizada.status, 200);
  const cotizacion = (await json(cotizada)).cotizacion;
  assert.equal(cotizacion.cantidad, 3);
  assert.equal(cotizacion.descuento, 12);
  assert.equal(cotizacion.costoOriginal, 910);
  assert.equal(cotizacion.costo, 800);
  assert.equal(cotizacion.ahorro, 110);
  assert.equal(cotizacion.puedeCanjear, true);

  for (const invalido of [
    ['p-1784228079707'],
    ['p-1784228079707', 'p-1784228079707'],
    ['p-1784228079707', 'no-existe'],
  ]) assert.equal((await send('/beneficios/atelier/cotizar', 'POST', { materialIds: invalido }, 'tok-atelier')).status, 400);

  const canje = await send('/beneficios/atelier/canjear', 'POST', { materialIds }, 'tok-atelier');
  assert.equal(canje.status, 200);
  const cuerpo = await json(canje);
  assert.equal(cuerpo.canje.categoria, 'paquete');
  assert.equal(cuerpo.canje.costo, 800);
  assert.equal(cuerpo.canje.costoOriginal, 910);
  assert.equal(cuerpo.canje.ahorro, 110);
  assert.equal(cuerpo.puntos.saldo, 1550);
  for (const id of materialIds) assert.equal(db.crudo(`v2_beneficios/u-atelier__${id}`)?.origen, 'atelier');

  const panel = await json(await get('/recompensas', 'tok-atelier'));
  assert.equal(panel.favoritos.length, 0, 'los materiales obtenidos dejan la ruta de deseos');
  assert.notEqual(panel.objetivo.beneficioId, 'material-regulacion-cosmetica', 'el objetivo obtenido deja de ser la meta activa');
  assert.equal(panel.inteligencia.valorCanjeado, 800);
  assert.equal(panel.inteligencia.ahorroAcumulado, 110);
  assert.equal(panel.inteligencia.materialesPermanentes, 3);
  assert.equal(panel.inteligencia.ultimos30Dias.gastados, 800);
  assert.equal(panel.inteligencia.distribucionCanjes.colecciones, 1);
  assert.equal((await send('/beneficios/atelier/cotizar', 'POST', { materialIds }, 'tok-atelier')).status, 409);
  assert.equal((await send('/beneficios/atelier/canjear', 'POST', { materialIds }, 'tok-atelier')).status, 409);
});

test('premio por nivel permite una elección real, no gasta saldo y es idempotente', async () => {
  await get('/recompensas', 'tok-nivel');
  const antes = db.crudo('v2_puntos/u-nivel')!;
  const r = await send('/puntos/niveles/constancia/canjear', 'POST', { beneficioId: 'vip-1-dia' }, 'tok-nivel');
  assert.equal(r.status, 200);
  const cuerpo = await json(r);
  assert.equal(cuerpo.canje.costo, 0);
  assert.equal(cuerpo.canje.origen, 'nivel');
  assert.equal(cuerpo.premio.canjeado, true);
  assert.equal(db.crudo('v2_puntos/u-nivel')?.saldo, antes.saldo);
  assert.equal(usuario('u-nivel').vigenciaHasta, iso(AHORA.getTime() + DIA));
  const repetido = await send('/puntos/niveles/constancia/canjear', 'POST', { beneficioId: 'material-regulacion-cosmetica' }, 'tok-nivel');
  assert.equal(repetido.status, 409);
  assert.equal((await json(repetido)).error, 'nivel/canjeado');

  const material = await send('/puntos/niveles/criterio/canjear', 'POST', { beneficioId: 'material-estudios-estabilidad' }, 'tok-nivel');
  assert.equal(material.status, 200);
  assert.equal(db.crudo('v2_beneficios/u-nivel__p-1784228150217')?.origen, 'nivel');
  assert.equal(db.crudo('v2_puntos/u-nivel')?.saldo, antes.saldo);
  const bloqueado = await send('/puntos/niveles/legado/canjear', 'POST', { beneficioId: 'vip-7-dias' }, 'tok-nivel');
  assert.equal(bloqueado.status, 403);
  assert.equal((await json(bloqueado)).error, 'nivel/bloqueado');
  const invalido = await send('/puntos/niveles/circulo/canjear', 'POST', { beneficioId: 'vip-15-dias' }, 'tok-nivel');
  assert.equal(invalido.status, 400);
  assert.equal((await json(invalido)).error, 'nivel/opcion-invalida');
});

// ── Centro administrativo de Diamantes ──

test('admin de Diamantes exige sesión y privilegios', async () => {
  assert.equal((await get('/admin/recompensas/resumen')).status, 401);
  assert.equal((await get('/admin/recompensas/cuentas', 'tok-libre')).status, 403);
  assert.equal((await get('/admin/recompensas/cuentas/u-admin-ajuste', 'tok-libre')).status, 403);
  assert.equal((await send('/admin/recompensas/ajustes', 'POST', { uid: 'u-admin-ajuste', diamantes: 100, motivo: 'Ajuste de prueba válido', idempotencia: 'ajuste-prueba-01' }, 'tok-libre')).status, 403);
});

test('admin de Diamantes lista cuentas sin acreditar premios por consultar', async () => {
  const cuentas = await json(await get('/admin/recompensas/cuentas', 'tok-admin'));
  const cuenta = cuentas.find((item: any) => item.uid === 'u-admin-ajuste');
  assert.equal(cuenta.nombre, 'Cuenta Ajuste');
  assert.equal(cuenta.email, 'ajuste@example.test');
  assert.equal(cuenta.saldo, 0);
  assert.equal(cuenta.bienvenidaAcreditada, false);
  assert.equal(db.crudo('v2_puntos/u-admin-ajuste'), undefined, 'una consulta administrativa no abre el cofre');

  const detalle = await json(await get('/admin/recompensas/cuentas/u-admin-ajuste', 'tok-admin'));
  assert.equal(detalle.cuenta.saldo, 0);
  assert.deepEqual(detalle.movimientos, []);
  assert.equal((await get('/admin/recompensas/cuentas/no-existe', 'tok-admin')).status, 404);
});

test('ajuste administrativo acredita o retira Diamantes con idempotencia y bitácora', async () => {
  const credito = { uid: 'u-admin-ajuste', diamantes: 150, motivo: 'Compensación autorizada por soporte', idempotencia: 'ajuste-credito-001' };
  const r = await send('/admin/recompensas/ajustes', 'POST', credito, 'tok-admin');
  assert.equal(r.status, 200);
  const primero = await json(r);
  assert.equal(primero.repetido, false);
  assert.equal(primero.cuenta.saldo, 500, '350 de bienvenida + 150 del ajuste');
  assert.equal(primero.cuenta.experiencia, 0, 'un ajuste no cambia el nivel educativo');
  assert.equal(primero.movimiento.puntos, 150);
  assert.equal(db.crudo(`${COLECCION_BITACORA_ADMIN_PUNTOS}/u-admin-ajuste__admin__ajuste-credito-001`)?.actorUid, 'u-admin');

  const repetido = await json(await send('/admin/recompensas/ajustes', 'POST', credito, 'tok-admin'));
  assert.equal(repetido.repetido, true);
  assert.equal(repetido.cuenta.saldo, 500);
  const movimientosCredito = (await db.query('v2_puntos_movimientos')).filter((doc) => doc.id === 'u-admin-ajuste__admin__ajuste-credito-001');
  assert.equal(movimientosCredito.length, 1);

  const reutilizada = await send('/admin/recompensas/ajustes', 'POST', { ...credito, diamantes: 151 }, 'tok-admin');
  assert.equal(reutilizada.status, 409);
  assert.equal((await json(reutilizada)).error, 'puntos/idempotencia-reutilizada');

  const debito = await json(await send('/admin/recompensas/ajustes', 'POST', {
    uid: 'u-admin-ajuste', diamantes: -200, motivo: 'Corrección autorizada de saldo duplicado', idempotencia: 'ajuste-debito-0001',
  }, 'tok-admin'));
  assert.equal(debito.cuenta.saldo, 300);
  assert.equal(debito.cuenta.gastados, 200);
  assert.equal(debito.cuenta.experiencia, 0);
  const insuficiente = await send('/admin/recompensas/ajustes', 'POST', {
    uid: 'u-admin-ajuste', diamantes: -1000, motivo: 'Intento controlado de saldo insuficiente', idempotencia: 'ajuste-debito-0002',
  }, 'tok-admin');
  assert.equal(insuficiente.status, 409);
  assert.equal((await json(insuficiente)).error, 'puntos/saldo-negativo');
  assert.equal(db.crudo('v2_puntos/u-admin-ajuste')?.saldo, 300);
});

test('admin de Diamantes valida ajustes y expone resumen operativo sin secretos', async () => {
  for (const cuerpo of [
    { uid: 'u-admin-ajuste', diamantes: 0, motivo: 'Motivo suficientemente largo', idempotencia: 'ajuste-malo-0001' },
    { uid: 'u-admin-ajuste', diamantes: 10.5, motivo: 'Motivo suficientemente largo', idempotencia: 'ajuste-malo-0002' },
    { uid: 'u-admin-ajuste', diamantes: 10, motivo: 'corto', idempotencia: 'ajuste-malo-0003' },
    { uid: 'u-admin-ajuste', diamantes: 10, motivo: 'Motivo suficientemente largo', idempotencia: 'mal' },
  ]) assert.equal((await send('/admin/recompensas/ajustes', 'POST', cuerpo, 'tok-admin')).status, 400);
  assert.equal((await send('/admin/recompensas/ajustes', 'POST', { uid: 'no-existe', diamantes: 10, motivo: 'Motivo suficientemente largo', idempotencia: 'ajuste-malo-0004' }, 'tok-admin')).status, 404);

  const resumen = await json(await get('/admin/recompensas/resumen', 'tok-admin'));
  assert.deepEqual(resumen.moneda, { nombre: 'Diamantes Dermalysse', icono: 'gem' });
  assert.equal(resumen.catalogo.materiales, 9);
  assert.equal(resumen.catalogo.colecciones, 4);
  assert.equal(resumen.catalogo.pasesVip, 8);
  assert.ok(resumen.saldoCirculante >= 300);
  assert.ok(resumen.cofresBienvenida >= 1);
  assert.ok(resumen.movimientosRecientes.every((m: any) => !('actorEmail' in m) && !('actorUid' in m)));

  const detalle = await json(await get('/admin/recompensas/cuentas/u-admin-ajuste', 'tok-admin'));
  assert.equal(detalle.cuenta.saldo, 300);
  assert.ok(detalle.movimientos.some((m: any) => m.concepto === 'Ajuste administrativo · crédito'));
  assert.ok(detalle.movimientos.some((m: any) => m.concepto === 'Ajuste administrativo · débito'));
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
  assert.deepEqual(new Set(bitacora.map((b) => b.fuente)), new Set(['recompensa', 'cupon', 'puntos', 'nivel']));
});
