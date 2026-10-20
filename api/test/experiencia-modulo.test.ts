// Módulo «experiencia» (bienvenida, encuesta y su beneficio VIP) en modo PRODUCCIÓN armado con buildApp,
// con Firestore FALSO en memoria, verificador de ID tokens falso, fetch falso y reloj inyectable. SIN red.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { buildApp } from '../src/app.js';
import { MemoryFirestore } from '../src/adapters/firestore/memoria.js';
import { cargarCatalogoEditorial } from '../src/adapters/firestore/club.js';
import type { FetchLike } from '../src/adapters/legacy/webhook.js';
import type { TokenDecodificado } from '../src/adapters/firebase/firebaseAuth.js';
import { normalizarConfig, PREMIOS_POR_DEFECTO, validarRespuestas } from '../src/services/experiencia.js';

const CUENTA_FALSA = JSON.stringify({ project_id: 'club-dermalysse', client_email: 'prueba@example.invalid', private_key: 'llave-falsa-de-prueba' });
const ENV = {
  AUTH_MODE: 'firebase', DATA_MODE: 'firestore', FIREBASE_SERVICE_ACCOUNT: CUENTA_FALSA,
  LEGACY_WEBHOOK_URL: 'https://webhook.example.test/', APP_URL: 'https://club.example.test', CORS_ORIGINS: 'https://club.example.test',
} as unknown as NodeJS.ProcessEnv;

const DIA = 86_400_000;
const INICIO = Date.parse('2026-10-15T12:00:00.000Z');
let reloj = INICIO;
const isoDe = (ms: number) => new Date(ms).toISOString();
const FUTURO_REAL = isoDe(Date.now() + 400 * DIA);
const PASADO_REAL = isoDe(Date.now() - 400 * DIA);

const TOKENS: Record<string, TokenDecodificado> = {
  'tok-nuevo': { uid: 'u-nuevo', email: 'nuevo@example.test', name: 'Nueva', email_verified: true },
  'tok-nuevo2': { uid: 'u-nuevo2', email: 'nuevo2@example.test', name: 'Nuevo Dos', email_verified: true },
  'tok-nuevo3': { uid: 'u-nuevo3', email: 'nuevo3@example.test', name: 'Nuevo Tres', email_verified: true },
  'tok-sinverificar': { uid: 'u-sinverificar', email: 'sv@example.test', name: 'Sin Verificar', email_verified: false },
  'tok-vip': { uid: 'u-vip', email: 'vip@example.test', name: 'Vip', email_verified: true },
  'tok-existente': { uid: 'u-existente', email: 'ex@example.test', name: 'Existente', email_verified: true },
  'tok-admin': { uid: 'u-admin', email: 'admin@example.test', name: 'Admin', email_verified: true },
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
const CURSO = EDITORIAL[0];
const AREA = CURSO.area;
const CAMPANA = 'bienvenida-2026';

let db: MemoryFirestore;
let server: Server;
let base: string;

function sembrar(f: MemoryFirestore) {
  const hoy = isoDe(INICIO).slice(0, 10);
  // u-nuevo: suscripción vencida (prueba que `subscription` nunca se toca).
  const subVencida = { status: 'canceled', plan: 'mensual', currentPeriodEnd: PASADO_REAL, stripeCustomerId: 'cus_prueba' };
  f.sembrar('users/u-nuevo', { name: 'Nueva', email: 'nuevo@example.test', subscription: subVencida });
  for (const uid of ['u-nuevo', 'u-nuevo2', 'u-nuevo3', 'u-sinverificar', 'u-vip']) {
    f.sembrar(`members/${uid}`, { id: uid, uid, name: uid, email: `${uid}@example.test`, plan: 'Free', status: 'active', joined: hoy, courses: 0 });
  }
  f.sembrar('users/u-vip', { name: 'Vip', subscription: { status: 'active', plan: 'anual', currentPeriodEnd: FUTURO_REAL } });
  f.sembrar('members/u-existente', { id: 'u-existente', uid: 'u-existente', joined: '2025-01-01', plan: 'Free', status: 'active' });
  f.sembrar('users/u-existente', { name: 'Existente' });
  f.sembrar('admins/u-admin', { email: 'admin@example.test' });
  f.sembrar('users/u-admin', { name: 'Admin' });
  f.sembrar(`courses/${CURSO.id}`, { name: 'Curso publicado', status: 'published', lessons: [{ id: 's01', name: 'S01' }] });
  f.sembrar('courses/curso-borrador', { name: 'Borrador', status: 'draft' });
}

before(async () => {
  db = new MemoryFirestore();
  sembrar(db);
  const app = buildApp(ENV, { firestore: db, verificador, fetch: fetchFalso, ahora: () => new Date(reloj) });
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server?.close(); });

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const get = (ruta: string, token?: string) => fetch(base + ruta, { headers: token ? auth(token) : {} });
const send = (ruta: string, method: string, cuerpo: unknown, token?: string) =>
  fetch(base + ruta, { method, headers: { 'Content-Type': 'application/json', ...(token ? auth(token) : {}) }, body: JSON.stringify(cuerpo) });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (r: Response): Promise<any> => r.json();
const vipEscrituras = () => db.escrituras.filter((e) => e.ruta.startsWith('v2_vip_bitacora/'));

const ENTREVISTA = { roles: ['estudiante'], objetivo: 'aprender', areas: [AREA], experiencia: 'inicio', formato: 'grabados', tiempo: 'cortos', origen: 'instagram', carrera: 'Cosmetología' };

/** Forma mínima que exige validarExperienciaDTO del cliente (src/core/experiencia.ts). */
function assertDTO(d: any) {
  assert.equal(d.version, 1);
  assert.equal(d.fuente, 'api');
  assert.ok(['nueva', 'existente'].includes(d.cohorte));
  assert.ok(Array.isArray(d.areas) && Array.isArray(d.recomendaciones));
  for (const f of [d.entrevista, d.encuesta]) {
    assert.ok(Number.isInteger(f.revision) && Number.isInteger(f.paso) && f.paso <= 7);
    assert.equal(typeof f.respuestas, 'object');
    assert.equal(f.ultimaOperacion, undefined, 'la firma interna no sale al cliente');
  }
  assert.equal(d.encuesta.id, 'experiencia-inicial-v1');
  for (const b of [d.beneficios.bienvenida, d.beneficios.experiencia]) {
    assert.ok(['no-disponible', 'reservado', 'otorgado'].includes(b.estado));
    assert.ok(b.dias === null || (Number.isInteger(b.dias) && b.dias > 0));
    assert.equal(typeof b.motivo, 'string');
  }
}

// ── Unidades puras ──

test('config: días de la configuración del admin y, si no hay, los del cliente (7 y 15)', () => {
  assert.deepEqual(PREMIOS_POR_DEFECTO, { bienvenida: 7, experiencia: 15 });
  assert.deepEqual(normalizarConfig(undefined).premios, { bienvenida: 7, experiencia: 15 });
  assert.deepEqual(normalizarConfig({ premios: { bienvenida: 10, experiencia: 'x' } }).premios, { bienvenida: 10, experiencia: 15 });
  assert.deepEqual(normalizarConfig({ premios: { bienvenida: 0, experiencia: 9999 } }).premios, { bienvenida: 7, experiencia: 15 });
});

test('validarRespuestas: opciones, máximos y textos acotados', () => {
  assert.deepEqual(validarRespuestas({ roles: ['profesional-estetica'], objetivo: 'elegir-activos' }, 'entrevista', [AREA]), { roles: ['profesional-estetica'], objetivo: 'elegir-activos' });
  assert.deepEqual(validarRespuestas({ roles: ['nutricion'], objetivo: 'nutricion-bienestar' }, 'entrevista', [AREA]), { roles: ['nutricion'], objetivo: 'nutricion-bienestar' });
  assert.throws(() => validarRespuestas({ roles: ['estudiante', 'docente', 'otro', 'tecnico'] }, 'entrevista', [AREA]), /hasta 3/);
  assert.throws(() => validarRespuestas({ roles: ['prefiero-no-decir', 'otro'] }, 'entrevista', [AREA]), /sola/);
  assert.throws(() => validarRespuestas({ areas: ['Inventada'] }, 'entrevista', [AREA]), /areas/);
  assert.throws(() => validarRespuestas({ diagnostico: 'x' }, 'entrevista', [AREA]), /no admitidas/);
  assert.throws(() => validarRespuestas({ comentario: 'x'.repeat(501) }, 'encuesta', []), /500/);
  assert.throws(() => validarRespuestas({ facilidad: 6 }, 'encuesta', []), /facilidad/);
  assert.deepEqual(validarRespuestas({ etapa: '', carrera: '  Estética\u0007 ' }, 'entrevista', [AREA]), { carrera: 'Estética' });
  assert.deepEqual(validarRespuestas({ comentario: 'línea 1\r\nlínea 2', facilidad: 0 }, 'encuesta', []), { comentario: 'línea 1\nlínea 2', facilidad: 0 });
});

// ── Rutas ──

test('GET /me/experiencia: /me no intercepta la ruta; 401 sin token y estado inicial sin escribir', async () => {
  const sin = await get('/me/experiencia');
  assert.equal(sin.status, 401);
  assert.equal((await json(sin)).error, 'auth/sin-token');
  const antes = db.escrituras.length;
  const r = await get('/me/experiencia', 'tok-nuevo');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const d = await json(r);
  assertDTO(d);
  assert.equal(d.cohorte, 'nueva');
  assert.equal(d.primerAccesoEn, null);
  assert.equal(d.entrevista.estado, 'pendiente');
  assert.equal(d.encuesta.estado, 'bloqueada');
  assert.equal(d.encuesta.motivo, 'inicia-entrevista');
  assert.deepEqual(d.areas, [AREA], 'solo áreas de cursos publicados del catálogo editorial');
  assert.deepEqual([d.beneficios.bienvenida.estado, d.beneficios.bienvenida.motivo], ['no-disponible', 'campana-inactiva']);
  assert.equal(db.escrituras.length, antes, 'GET no escribe');
  assert.equal((await json(await get('/me/experiencia', 'tok-existente'))).beneficios.bienvenida.motivo, 'cuenta-existente');
});

test('admin: 403 para no admin; GET por defecto; PATCH valida, guarda con revisión y detecta conflictos', async () => {
  for (const [ruta, metodo] of [['/admin/experiencia/config', 'GET'], ['/admin/experiencia/resumen', 'GET'], ['/admin/experiencia/config', 'PATCH']]) {
    const r = metodo === 'GET' ? await get(ruta, 'tok-nuevo') : await send(ruta, metodo, { revision: 0, cupo: 5 }, 'tok-nuevo');
    assert.equal(r.status, 403, `${metodo} ${ruta}`);
  }
  assert.equal((await get('/admin/experiencia/config')).status, 401);
  const c0 = await json(await get('/admin/experiencia/config', 'tok-admin'));
  assert.deepEqual(c0, { version: 1, revision: 0, campanaId: null, aprobado: false, habilitada: false, fechaInicio: null, fechaFin: null, cupo: 0, reservadas: 0, premios: { bienvenida: 7, experiencia: 15 } });

  const politica = { revision: 0, campanaId: CAMPANA, aprobado: true, habilitada: true, fechaInicio: isoDe(INICIO - DIA), fechaFin: isoDe(INICIO + 60 * DIA), cupo: 2 };
  assert.equal((await send('/admin/experiencia/config', 'PATCH', { ...politica, aprobado: false }, 'tok-admin')).status, 400, 'habilitar exige aprobación');
  assert.equal((await send('/admin/experiencia/config', 'PATCH', { ...politica, campanaId: 'con espacios' }, 'tok-admin')).status, 400);
  assert.equal((await send('/admin/experiencia/config', 'PATCH', { ...politica, fechaInicio: '2026-10-01' }, 'tok-admin')).status, 400, 'fecha sin zona');
  assert.equal((await send('/admin/experiencia/config', 'PATCH', { ...politica, premios: { bienvenida: 30 } }, 'tok-admin')).status, 400, 'premios no se cambian por aquí');
  const ok = await send('/admin/experiencia/config', 'PATCH', politica, 'tok-admin');
  assert.equal(ok.status, 200);
  const c1 = await json(ok);
  assert.deepEqual([c1.revision, c1.campanaId, c1.habilitada, c1.cupo, c1.reservadas, c1.premios.bienvenida], [1, CAMPANA, true, 2, 0, 7]);
  const stale = await send('/admin/experiencia/config', 'PATCH', politica, 'tok-admin');
  assert.equal(stale.status, 409);
  assert.equal((await json(stale)).error, 'revision_desactualizada');
  assert.equal(db.crudo('v2_config/experiencia')?.actualizadoPor, 'u-admin');
  assert.ok(db.crudo('v2_experiencia_cambios/config_1'));
});

test('sesión: 409 antes de iniciar; iniciar exige consentimiento y reserva plaza', async () => {
  assert.equal((await send('/me/experiencia/sesion', 'POST', {}, 'tok-nuevo')).status, 409);
  const sin = await send('/me/experiencia/iniciar', 'POST', {}, 'tok-nuevo');
  assert.equal(sin.status, 400);
  assert.equal((await json(sin)).error, 'privacidad_requerida');
  assert.equal((await send('/me/experiencia/iniciar', 'POST', { privacidadAceptada: true, uid: 'otro' }, 'tok-nuevo')).status, 400, 'campos no admitidos');

  const r = await send('/me/experiencia/iniciar', 'POST', { privacidadAceptada: true }, 'tok-nuevo');
  assert.equal(r.status, 200);
  const d = await json(r);
  assertDTO(d);
  assert.equal(d.entrevista.estado, 'en-curso');
  assert.equal(d.primerAccesoEn, isoDe(INICIO));
  assert.deepEqual([d.beneficios.bienvenida.estado, d.beneficios.bienvenida.dias, d.beneficios.bienvenida.motivo], ['reservado', 7, 'plaza-reservada']);
  assert.equal(d.beneficios.experiencia.dias, 15);
  assert.equal(db.crudo(`v2_experiencia_campanas/${CAMPANA}`)?.reservadas, 1);
  const estado = db.crudo('v2_experiencia/u-nuevo')!;
  assert.equal(estado.uid, 'u-nuevo');
  assert.equal(estado.email, undefined, 'sin datos personales en el estado');
  assert.equal((estado.privacidad as { usoAceptado: boolean }).usoAceptado, true);

  // Repetir iniciar no consume otra plaza.
  await send('/me/experiencia/iniciar', 'POST', { privacidadAceptada: true }, 'tok-nuevo');
  assert.equal(db.crudo(`v2_experiencia_campanas/${CAMPANA}`)?.reservadas, 1);

  const s1 = await json(await send('/me/experiencia/sesion', 'POST', {}, 'tok-nuevo'));
  assertDTO(s1);
  await send('/me/experiencia/sesion', 'POST', {}, 'tok-nuevo');
  assert.deepEqual(db.crudo('v2_experiencia/u-nuevo')?.sesiones, ['2026-10-15'], 'un día cuenta una vez');
});

test('entrevista: validación, conflicto de revisión, reintento idempotente y posponer', async () => {
  let d = await json(await get('/me/experiencia', 'tok-nuevo'));
  const rev = d.entrevista.revision;
  assert.equal((await send('/me/entrevista', 'PATCH', { revision: rev, paso: 1, respuestas: { roles: ['nadie'] } }, 'tok-nuevo')).status, 400);
  assert.equal((await send('/me/entrevista', 'PATCH', { revision: rev, paso: 9, respuestas: {} }, 'tok-nuevo')).status, 400);
  assert.equal((await send('/me/entrevista', 'PATCH', { revision: 'x', paso: 1, respuestas: {} }, 'tok-nuevo')).status, 400);
  assert.equal((await send('/me/entrevista', 'PATCH', { revision: rev, paso: 1, respuestas: {}, extra: 1 }, 'tok-nuevo')).status, 400);

  const cuerpo = { revision: rev, paso: 2, respuestas: { roles: ['estudiante'], objetivo: 'aprender' } };
  d = await json(await send('/me/entrevista', 'PATCH', cuerpo, 'tok-nuevo'));
  assert.equal(d.entrevista.revision, rev + 1);
  assert.deepEqual(d.entrevista.respuestas, cuerpo.respuestas);
  // Mismo cuerpo con la revisión anterior (reintento de red): 200 sin aplicar dos veces.
  const re = await send('/me/entrevista', 'PATCH', cuerpo, 'tok-nuevo');
  assert.equal(re.status, 200);
  assert.equal((await json(re)).entrevista.revision, rev + 1);
  // Otro cuerpo con revisión vieja: 409.
  const c = await send('/me/entrevista', 'PATCH', { ...cuerpo, paso: 3 }, 'tok-nuevo');
  assert.equal(c.status, 409);
  assert.deepEqual(await json(c), { revisionActual: rev + 1, error: 'revision_desactualizada', mensaje: 'Tus respuestas cambiaron en otra sesión. Recarga antes de continuar.' });

  d = await json(await send('/me/entrevista/posponer', 'POST', { revision: rev + 1 }, 'tok-nuevo'));
  assert.equal(d.entrevista.estado, 'pospuesta');
  assert.equal(d.entrevista.pospuestaHasta, isoDe(INICIO + DIA));

  // Un borrador posterior REEMPLAZA las respuestas (quita claves).
  d = await json(await send('/me/entrevista', 'PATCH', { revision: d.entrevista.revision, paso: 0, respuestas: { roles: ['docente'] } }, 'tok-nuevo'));
  assert.deepEqual(d.entrevista.respuestas, { roles: ['docente'] });
  assert.equal(d.entrevista.estado, 'en-curso');

  // Completar sin todas las obligatorias: 400.
  const inc = await send('/me/entrevista/completar', 'POST', { revision: d.entrevista.revision, privacidadAceptada: true }, 'tok-nuevo');
  assert.equal(inc.status, 400);
  assert.equal((await json(inc)).error, 'respuestas_incompletas');
});

test('completar entrevista: otorga 7 días UNA vez vía vip.ts, sin tocar subscription', async () => {
  const subAntes = structuredClone(db.crudo('users/u-nuevo')!.subscription);
  let d = await json(await get('/me/experiencia', 'tok-nuevo'));
  d = await json(await send('/me/entrevista', 'PATCH', { revision: d.entrevista.revision, paso: 6, respuestas: ENTREVISTA }, 'tok-nuevo'));
  assert.equal((await send('/me/entrevista/completar', 'POST', { revision: d.entrevista.revision }, 'tok-nuevo')).status, 400, 'exige privacidadAceptada');

  const r = await send('/me/entrevista/completar', 'POST', { revision: d.entrevista.revision, privacidadAceptada: true }, 'tok-nuevo');
  assert.equal(r.status, 200);
  d = await json(r);
  assertDTO(d);
  assert.equal(d.entrevista.estado, 'completada');
  assert.deepEqual([d.beneficios.bienvenida.estado, d.beneficios.bienvenida.dias, d.beneficios.bienvenida.hasta], ['otorgado', 7, isoDe(INICIO + 7 * DIA)]);
  assert.deepEqual(d.recomendaciones.map((c: { id: string }) => c.id), [CURSO.id]);

  const user = db.crudo('users/u-nuevo')!;
  assert.equal(user.vigenciaHasta, isoDe(INICIO + 7 * DIA));
  assert.deepEqual(user.subscription, subAntes, 'subscription intacta');
  const bitacora = vipEscrituras();
  assert.equal(bitacora.length, 1);
  assert.deepEqual([bitacora[0].datos?.fuente, bitacora[0].datos?.dias, bitacora[0].datos?.uid], ['bienvenida', 7, 'u-nuevo']);
  assert.deepEqual(db.crudo('v2_experiencia/u-nuevo')?.programa, { dias: 7, hasta: isoDe(INICIO + 7 * DIA) });
  assert.equal(db.crudo('v2_experiencia_beneficios/u-nuevo__bienvenida')?.dias, 7);

  // Repetir (doble clic, reintento o revisión vieja): no duplica el premio ni la vigencia.
  for (const revision of [d.entrevista.revision, 0]) {
    const otra = await send('/me/entrevista/completar', 'POST', { revision, privacidadAceptada: true }, 'tok-nuevo');
    assert.equal(otra.status, 200);
    assert.equal((await json(otra)).beneficios.bienvenida.estado, 'otorgado');
  }
  assert.equal(vipEscrituras().length, 1);
  assert.equal(db.crudo('users/u-nuevo')!.vigenciaHasta, isoDe(INICIO + 7 * DIA));
  assert.equal((await send('/me/entrevista', 'PATCH', { revision: d.entrevista.revision, paso: 0, respuestas: {} }, 'tok-nuevo')).status, 409, 'completada: sin cambios');
});

test('sin beneficio: correo sin verificar, VIP por suscripción, cuenta existente y cupo agotado', async () => {
  const completar = async (token: string) => {
    let d = await json(await send('/me/experiencia/iniciar', 'POST', { privacidadAceptada: true }, token));
    d = await json(await send('/me/entrevista', 'PATCH', { revision: d.entrevista.revision, paso: 6, respuestas: ENTREVISTA }, token));
    return json(await send('/me/entrevista/completar', 'POST', { revision: d.entrevista.revision, privacidadAceptada: true }, token));
  };
  const antes = vipEscrituras().length;
  assert.equal((await json(await get('/me/experiencia', 'tok-sinverificar'))).beneficios.bienvenida.motivo, 'correo-no-verificado');
  assert.equal((await json(await get('/me/experiencia', 'tok-vip'))).beneficios.bienvenida.motivo, 'otra-fuente-vip');
  assert.equal((await json(await get('/me/experiencia', 'tok-admin'))).beneficios.experiencia.motivo, 'otra-fuente-vip', 'admins no participan del premio');
  for (const token of ['tok-sinverificar', 'tok-vip']) {
    const d = await completar(token);
    assert.equal(d.entrevista.estado, 'completada', token);
    assert.notEqual(d.beneficios.bienvenida.estado, 'otorgado', token);
  }
  assert.equal(db.crudo('users/u-vip')!.vigenciaHasta, undefined);
  assert.equal(vipEscrituras().length, antes, 'ningún premio');
  assert.equal(db.crudo(`v2_experiencia_campanas/${CAMPANA}`)?.reservadas, 1, 'quien no es elegible no consume plaza');

  // Cupo 2: u-nuevo tomó una plaza, u-nuevo2 toma la otra; u-existente y u-nuevo3 ya no alcanzan.
  assert.equal((await completar('tok-nuevo2')).beneficios.bienvenida.estado, 'otorgado');
  const existente = await completar('tok-existente');
  assert.deepEqual([existente.beneficios.bienvenida.motivo, existente.beneficios.experiencia.motivo], ['cuenta-existente', 'cupo-agotado']);
  assert.equal(vipEscrituras().length, antes + 1);
  const tercero = await json(await get('/me/experiencia', 'tok-nuevo3'));
  assert.equal(tercero.beneficios.bienvenida.motivo, 'cupo-agotado');
  assert.equal((await completar('tok-nuevo3')).beneficios.bienvenida.estado, 'no-disponible');
  assert.equal(db.crudo(`v2_experiencia_campanas/${CAMPANA}`)?.reservadas, 2);

  // Con reservas no se cambia la identidad de la campaña ni se baja el cupo por debajo de ellas.
  const c = await json(await get('/admin/experiencia/config', 'tok-admin'));
  assert.equal(c.reservadas, 2);
  const otra = await send('/admin/experiencia/config', 'PATCH', { revision: c.revision, campanaId: 'otra-campana' }, 'tok-admin');
  assert.equal((await json(otra)).error, 'campana_con_reservas');
  const cupo = await send('/admin/experiencia/config', 'PATCH', { revision: c.revision, cupo: 1 }, 'tok-admin');
  assert.equal((await json(cupo)).error, 'cupo_inferior_reservas');
});

test('encuesta: bloqueada hasta 7 días + 3 días de uso + examen calificado; otorga 15 días una vez', async () => {
  let d = await json(await get('/me/experiencia', 'tok-nuevo'));
  assert.equal(d.encuesta.estado, 'bloqueada');
  assert.equal(d.encuesta.motivo, 'espera-7-dias');
  assert.equal(d.encuesta.disponibleEn, isoDe(INICIO + 7 * DIA));
  const bloq = await send('/me/encuesta', 'PATCH', { revision: 0, paso: 0, respuestas: { facilidad: 4 } }, 'tok-nuevo');
  assert.equal(bloq.status, 409);
  assert.equal((await json(bloq)).error, 'encuesta_no_disponible');

  for (const dias of [1, 2]) { reloj = INICIO + dias * DIA; await send('/me/experiencia/sesion', 'POST', {}, 'tok-nuevo'); }
  reloj = INICIO + 8 * DIA;
  await send('/me/experiencia/sesion', 'POST', {}, 'tok-nuevo');
  assert.equal((db.crudo('v2_experiencia/u-nuevo')?.sesiones as string[]).length, 3, 'máximo 3 días');
  d = await json(await get('/me/experiencia', 'tok-nuevo'));
  assert.equal(d.encuesta.motivo, 'falta-quiz-calificado');

  // Un examen calificado ANTES de iniciar no cuenta; uno posterior sí.
  db.sembrar('v2_academia_intentos/u-nuevo__p1__1', { uid: 'u-nuevo', programa: 'p1', n: 1, ids: [], emitido: isoDe(INICIO - DIA), calificado: true, ultimo: { aprobado: false, fecha: isoDe(INICIO - DIA) } });
  assert.equal((await json(await get('/me/experiencia', 'tok-nuevo'))).encuesta.motivo, 'falta-quiz-calificado');
  db.sembrar('v2_academia_intentos/u-nuevo__p1__2', { uid: 'u-nuevo', programa: 'p1', n: 2, ids: [], emitido: isoDe(INICIO + 3 * DIA), calificado: true, ultimo: { aprobado: true, fecha: isoDe(INICIO + 3 * DIA) } });
  d = await json(await get('/me/experiencia', 'tok-nuevo'));
  assert.deepEqual([d.encuesta.estado, d.encuesta.motivo], ['disponible', 'uso-verificado']);
  assert.deepEqual([d.beneficios.experiencia.estado, d.beneficios.experiencia.dias], ['reservado', 15]);

  d = await json(await send('/me/encuesta/posponer', 'POST', { revision: 0 }, 'tok-nuevo'));
  assert.equal(d.encuesta.estado, 'pospuesta');
  const encuesta = { facilidad: 4, utilidad: 0, dificultad: 'video', comentario: 'Me gustaría ver más casos.' };
  d = await json(await send('/me/encuesta', 'PATCH', { revision: d.encuesta.revision, paso: 4, respuestas: encuesta }, 'tok-nuevo'));
  d = await json(await send('/me/encuesta/completar', 'POST', { revision: d.encuesta.revision, privacidadAceptada: true }, 'tok-nuevo'));
  assertDTO(d);
  assert.equal(d.encuesta.estado, 'completada');
  // La cortesía de bienvenida ya venció (día 7): los 15 días corren desde ahora.
  assert.deepEqual([d.beneficios.experiencia.estado, d.beneficios.experiencia.hasta], ['otorgado', isoDe(reloj + 15 * DIA)]);
  assert.equal(db.crudo('users/u-nuevo')!.vigenciaHasta, isoDe(reloj + 15 * DIA));
  assert.deepEqual(db.crudo('v2_experiencia/u-nuevo')?.programa, { dias: 22, hasta: isoDe(reloj + 15 * DIA) });
  await send('/me/encuesta/completar', 'POST', { revision: d.encuesta.revision, privacidadAceptada: true }, 'tok-nuevo');
  assert.equal(vipEscrituras().filter((e) => e.datos?.uid === 'u-nuevo').length, 2, 'un premio por flujo');
  // Tras completar la encuesta ya no se anotan días de uso.
  reloj = INICIO + 9 * DIA;
  await send('/me/experiencia/sesion', 'POST', {}, 'tok-nuevo');
  assert.equal((db.crudo('v2_experiencia/u-nuevo')?.sesiones as string[]).length, 3);
  reloj = INICIO;
});

test('resumen admin: conteos y promedios agregados, sin datos personales ni textos libres', async () => {
  const r = await get('/admin/experiencia/resumen', 'tok-admin');
  assert.equal(r.status, 200);
  const crudo = await r.text();
  for (const prohibido of ['u-nuevo', '@example.test', 'Cosmetología', 'Me gustaría', 'comentario']) assert.ok(!crudo.includes(prohibido), prohibido);
  const s = JSON.parse(crudo);
  assert.equal(s.version, 1);
  assert.equal(s.cuentas, 6, 'u-nuevo, u-nuevo2, u-nuevo3, u-sinverificar, u-vip, u-existente');
  assert.equal(s.entrevistas.completadas, 6);
  assert.equal(s.encuestas.completadas, 1);
  assert.equal(s.sesionesRegistradas, 3);
  assert.deepEqual(s.beneficios, { bienvenida: { otorgados: 2, dias: 14 }, experiencia: { otorgados: 1, dias: 15 } });
  assert.deepEqual(s.campana, { campanaId: CAMPANA, reservadas: 2, cupo: 2 });
  assert.equal(s.resultados.entrevista.total, 6);
  assert.equal(s.resultados.entrevista.roles.estudiante, 6);
  assert.equal(s.resultados.entrevista.areas[AREA], 6);
  assert.deepEqual(s.resultados.encuesta.facilidad, { respuestas: 1, sinEvaluar: 0, promedio: 4 });
  assert.deepEqual(s.resultados.encuesta.utilidad, { respuestas: 0, sinEvaluar: 1, promedio: null });
  assert.equal(s.resultados.encuesta.dificultad.video, 1);
});
