import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { buildApp } from '../src/app.js';
import { MemoryFirestore } from '../src/adapters/firestore/memoria.js';
import type { Consulta } from '../src/adapters/firestore/port.js';
import type { FetchLike } from '../src/adapters/legacy/webhook.js';
import type { TokenDecodificado } from '../src/adapters/firebase/firebaseAuth.js';
import { DirectorioService } from '../src/services/directorio.js';

const CUENTA_FALSA = JSON.stringify({
  project_id: 'club-dermalysse',
  client_email: 'prueba@example.invalid',
  private_key: 'llave-falsa-de-prueba',
});

const ENV = {
  AUTH_MODE: 'firebase',
  DATA_MODE: 'firestore',
  FIREBASE_SERVICE_ACCOUNT: CUENTA_FALSA,
  LEGACY_WEBHOOK_URL: 'https://webhook.example.test/',
  APP_URL: 'https://club.example.test',
  CORS_ORIGINS: 'https://club.example.test',
  CAMPANA_BIENVENIDA_CODIGO: 'TEST-DERMALYSSE-50',
} as unknown as NodeJS.ProcessEnv;

const AHORA = new Date('2026-10-21T12:00:00.000Z');

const TOKENS: Record<string, TokenDecodificado> = {
  'tok-vip': { uid: 'u-vip', email: 'vip@example.test', name: 'Dra. Elena VIP' },
  'tok-libre': { uid: 'u-libre', email: 'libre@example.test', name: 'Carla Cosmiatra' },
  'tok-admin': { uid: 'u-admin', email: 'admin@example.test', name: 'Admin Dermalysse' },
  'tok-nuevo': { uid: 'u-nuevo', email: 'nuevo@example.test', name: 'Miembro Nuevo' },
};

const verificador = {
  async verifyIdToken(token: string): Promise<TokenDecodificado> {
    const t = TOKENS[token];
    if (!t) throw Object.assign(new Error('bad token'), { code: 'auth/argument-error' });
    return t;
  },
};

const fetchFalso: FetchLike = async () => {
  throw new TypeError('sin red en esta prueba');
};

let db: MemoryFirestore;
let server: Server;
let base: string;

function sembrar(f: MemoryFirestore) {
  f.sembrar('users/u-vip', {
    name: 'Dra. Elena VIP',
    email: 'vip@example.test',
    subscription: { status: 'active', plan: 'anual', currentPeriodEnd: '2027-01-01T00:00:00.000Z' },
  });
  f.sembrar('users/u-libre', {
    name: 'Carla Cosmiatra',
    email: 'libre@example.test',
  });
  f.sembrar('users/u-admin', {
    name: 'Admin Dermalysse',
    email: 'admin@example.test',
  });
  f.sembrar('admins/u-admin', { email: 'admin@example.test' });
}

before(async () => {
  db = new MemoryFirestore();
  sembrar(db);
  const app = buildApp(ENV, {
    firestore: db,
    verificador,
    fetch: fetchFalso,
    catalogoEditorial: [],
    ahora: () => AHORA,
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.close();
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const get = (ruta: string, token?: string) => fetch(base + ruta, { headers: token ? auth(token) : {} });
const send = (ruta: string, method: string, cuerpo?: unknown, token?: string) =>
  fetch(base + ruta, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? auth(token) : {}) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

const perfilDatos = (extra = {}) => ({
  titular: 'Cosmiatra Especialista en Tratamientos Faciales Avanzados',
  etapa: 'cosmiatra',
  especialidades: ['Anti-edad y Flacidez', 'Acné y Secuelas'],
  aparatologia: ['HIFU', 'Radiofrecuencia Fraccionada', 'Dermapen'],
  ciudad: 'Guadalajara',
  estado: 'Jalisco',
  modalidades: ['presencial'],
  disponibilidad: ['interconsulta', 'renta_aparatologia', 'colaboraciones'],
  habilidades: ['Peelings químicos', 'Protocolos combinados'],
  bio: 'Cosmiatra clínica con 6 años de experiencia en aparatología de vanguardia y tratamientos combinados.',
  anosExperiencia: 6,
  idiomas: ['Español', 'Inglés'],
  experiencia: [
    {
      puesto: 'Cosmiatra titular',
      organizacion: 'Clínica Dermasthetic',
      periodo: '2021 · Actualidad',
      descripcion: 'Aplicación de protocolos con HIFU y microagujas.',
    },
  ],
  formacion: [
    {
      programa: 'Diplomado en Cosmiatría Médica',
      institucion: 'Instituto Dermatológico de Jalisco',
      periodo: '2019 · 2020',
    },
  ],
  credenciales: [
    {
      nombre: 'Certificación en Seguridad y Manejo de Láser',
      emisor: 'Colegio de Cosmiatría',
      anio: '2022',
    },
  ],
  visible: true,
  contacto: { canal: 'correo' },
  ...extra,
});

const oportunidadDatos = (extra = {}) => ({
  titulo: 'Renta de Cabina equipada con HIFU y Radiofrecuencia',
  tipo: 'renta_cabina',
  organizacion: 'Clínica Dermasthetic',
  modalidad: 'presencial',
  ciudad: 'Guadalajara',
  entidad: 'Jalisco',
  especialidades: ['Aparatología facial'],
  aparatologia: ['HIFU', 'Radiofrecuencia'],
  resumen: 'Contamos con dos cabinas disponibles para cosmiatras independientes con clientela propia. Incluye recepción y esterilización.',
  requisitos: 'Cédula técnica o diplomado, comprobante de seguro de responsabilidad.',
  compensacion: 'Cuota fija mensual o por día quirúrgico.',
  ...extra,
});

class FirestoreSinIndicesCompuestos extends MemoryFirestore {
  override async query(coleccion: string, consulta: Consulta = {}) {
    if ((consulta.where?.length ?? 0) > 0 && consulta.orderBy) {
      throw Object.assign(new Error('The query requires an index.'), { code: 9 });
    }
    return super.query(coleccion, consulta);
  }
}

test('directorio profesional · carga y conserva el orden sin índices compuestos de Firestore', async () => {
  const firestore = new FirestoreSinIndicesCompuestos();
  firestore.sembrar('v2_directorio_perfiles/perfil-antiguo', {
    ...perfilDatos(), uid: 'perfil-antiguo', nombre: 'Perfil antiguo', actualizado: '2026-10-20T12:00:00.000Z',
  });
  firestore.sembrar('v2_directorio_perfiles/perfil-nuevo', {
    ...perfilDatos(), uid: 'perfil-nuevo', nombre: 'Perfil nuevo', actualizado: '2026-10-21T12:00:00.000Z',
  });
  firestore.sembrar('v2_directorio_oportunidades/oportunidad-antigua', {
    ...oportunidadDatos(), id: 'oportunidad-antigua', autorUid: 'otra-cuenta', autor: 'Otra persona',
    estado: 'publicada', fecha: '2026-10-20T12:00:00.000Z', expira: '2026-11-20T12:00:00.000Z',
  });
  firestore.sembrar('v2_directorio_oportunidades/oportunidad-nueva', {
    ...oportunidadDatos(), id: 'oportunidad-nueva', autorUid: 'otra-cuenta', autor: 'Otra persona',
    estado: 'publicada', fecha: '2026-10-21T12:00:00.000Z', expira: '2026-11-21T12:00:00.000Z',
  });

  const directorio = new DirectorioService(firestore, () => AHORA);
  const resultado = await directorio.obtenerDirectorio({
    uid: 'u-sin-indice', email: 'miembro@example.test', nombre: 'Miembro', esVip: false, esAdmin: false,
  });

  assert.deepEqual(resultado.perfiles.map((perfil) => perfil.uid), ['perfil-nuevo', 'perfil-antiguo']);
  assert.deepEqual(resultado.oportunidades.map((oportunidad) => oportunidad.id), ['oportunidad-nueva', 'oportunidad-antigua']);
});

test('directorio profesional · requiere sesión y permite crear perfil opt-in', async () => {
  const anon = await get('/directorio');
  assert.equal(anon.status, 401);

  const res = await send('/directorio/perfil', 'PUT', perfilDatos(), 'tok-libre');
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.equal(body.uid, 'u-libre');
  assert.equal(body.visible, true);
  assert.equal(body.anosExperiencia, 6);
  assert.equal(body.aparatologia[0], 'HIFU');
  assert.equal(body.contacto.canal, 'correo');
  assert.equal(body.contacto.valor, 'libre@example.test');
});

test('directorio profesional · nunca expone contactos al explorar perfiles ajenos', async () => {
  await send('/directorio/perfil', 'PUT', perfilDatos({ contacto: { canal: 'whatsapp', valor: '+52 331 123 4567' } }), 'tok-vip');

  const res = await get('/directorio', 'tok-libre');
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  const vipPerfil = body.perfiles.find((p: any) => p.uid === 'u-vip');
  assert.ok(vipPerfil);
  assert.equal(vipPerfil.contacto, undefined);
  assert.equal(JSON.stringify(body).includes('331 123 4567'), false);

  const propia = await get('/directorio', 'tok-vip');
  const propiaBody = (await propia.json()) as any;
  assert.deepEqual(propiaBody.miPerfil.contacto, { canal: 'whatsapp', valor: '+52 331 123 4567' });
});

test('directorio profesional · solo VIP publica oportunidades; todos pueden explorarlas', async () => {
  const op = oportunidadDatos();
  const intentoFree = await send('/directorio/oportunidades', 'POST', op, 'tok-libre');
  assert.equal(intentoFree.status, 403);

  const creada = await send('/directorio/oportunidades', 'POST', op, 'tok-vip');
  assert.equal(creada.status, 201);
  const creadaBody = (await creada.json()) as any;
  assert.equal(creadaBody.estado, 'publicada');
  assert.equal(creadaBody.aparatologia[0], 'HIFU');

  const lista = await get('/directorio', 'tok-libre');
  const listaBody = (await lista.json()) as any;
  assert.equal(listaBody.oportunidades.length, 1);
  assert.equal(listaBody.oportunidades[0].titulo, 'Renta de Cabina equipada con HIFU y Radiofrecuencia');
});

test('directorio profesional · el contacto solo aparece después de que la persona destinataria acepta', async () => {
  const cxRes = await send(
    '/directorio/conexiones',
    'POST',
    { paraUid: 'u-vip', mensaje: 'Hola colega, me interesa información sobre la renta de la cabina y colaboración.' },
    'tok-libre',
  );
  assert.equal(cxRes.status, 201);
  const cx = (await cxRes.json()) as any;
  assert.equal(cx.contacto, null);

  // Duplicado bloqueado
  const dup = await send(
    '/directorio/conexiones',
    'POST',
    { paraUid: 'u-vip', mensaje: 'Intento duplicado de conexión.' },
    'tok-libre',
  );
  assert.equal(dup.status, 409);

  // VIP acepta
  const resp = await send(`/directorio/conexiones/${cx.id}`, 'PATCH', { estado: 'aceptada' }, 'tok-vip');
  assert.equal(resp.status, 200);

  // Ahora libre ve el contacto de VIP
  const libreVista = await get('/directorio', 'tok-libre');
  const libreBody = (await libreVista.json()) as any;
  const conexionAceptada = libreBody.conexiones.find((c: any) => c.id === cx.id);
  assert.ok(conexionAceptada);
  assert.deepEqual(conexionAceptada.contacto, { canal: 'whatsapp', valor: '+52 331 123 4567' });
});

test('directorio profesional · rechaza conexión consigo mismo y perfil con HTML', async () => {
  const auto = await send(
    '/directorio/conexiones',
    'POST',
    { paraUid: 'u-libre', mensaje: 'Intentando conectar conmigo mismo para probar la regla.' },
    'tok-libre',
  );
  assert.equal(auto.status, 409);

  const xss = await send(
    '/directorio/perfil',
    'PUT',
    perfilDatos({ bio: '<script>alert(1)</script> intento malicioso que supera los 30 caracteres mínimos.' }),
    'tok-libre',
  );
  assert.equal(xss.status, 400);
});

test('directorio profesional · eliminar perfil cierra oportunidades y declina conexiones pendientes', async () => {
  // Crear una nueva oportunidad y una conexión pendiente
  const op = await send('/directorio/oportunidades', 'POST', oportunidadDatos({ titulo: 'Oportunidad a cerrar al eliminar' }), 'tok-vip');
  assert.equal(op.status, 201);
  const opBody = (await op.json()) as any;

  // Eliminar perfil VIP
  const del = await send('/directorio/perfil', 'DELETE', undefined, 'tok-vip');
  assert.equal(del.status, 200);

  // Verificar en DB cruda
  assert.equal(db.crudo('v2_directorio_perfiles/u-vip'), undefined);
  assert.equal(db.crudo(`v2_directorio_oportunidades/${opBody.id}`)?.estado, 'cerrada');
});

test('directorio profesional · reporta perfiles u oportunidades inapropiadas sin duplicar', async () => {
  // Re-crear perfil para el test de reportes
  await send('/directorio/perfil', 'PUT', perfilDatos(), 'tok-libre');

  const rep = await send(
    '/directorio/reportes',
    'POST',
    { tipo: 'perfil', objetivoId: 'u-libre', motivo: 'spam', detalle: 'Venta de productos no regulados por COFEPRIS.' },
    'tok-vip',
  );
  assert.equal(rep.status, 201);
  const repBody = (await rep.json()) as any;
  assert.equal(repBody.estado, 'pendiente');

  // Duplicado bloqueado
  const dup = await send(
    '/directorio/reportes',
    'POST',
    { tipo: 'perfil', objetivoId: 'u-libre', motivo: 'spam', detalle: 'Reintento' },
    'tok-vip',
  );
  assert.equal(dup.status, 409);

  // Auto-reporte bloqueado
  const auto = await send(
    '/directorio/reportes',
    'POST',
    { tipo: 'perfil', objetivoId: 'u-libre', motivo: 'spam' },
    'tok-libre',
  );
  assert.equal(auto.status, 409);
});

test('directorio profesional · bypass de moderación: dueño NO puede re-publicar perfil ocultado por admin', async () => {
  await send('/directorio/perfil', 'PUT', perfilDatos(), 'tok-libre');
  // Admin oculta directamente (equivalente a moderación)
  const ocultar = await send('/admin/directorio/perfiles/u-libre/visibilidad', 'PATCH', { visible: false }, 'tok-admin');
  assert.equal(ocultar.status, 200);
  const guardadoOculto = db.crudo('v2_directorio_perfiles/u-libre');
  assert.equal(guardadoOculto?.visible, false);
  assert.equal(guardadoOculto?.ocultoPorModeracion, true);

  // El dueño intenta re-publicarlo con visible=true: el server lo fuerza a false.
  const intentoVuelta = await send('/directorio/perfil', 'PUT', perfilDatos({ visible: true }), 'tok-libre');
  assert.equal(intentoVuelta.status, 200);
  const trasEdicion = db.crudo('v2_directorio_perfiles/u-libre');
  assert.equal(trasEdicion?.visible, false);
  assert.equal(trasEdicion?.ocultoPorModeracion, true);

  // Admin reactiva: la flag se levanta y el perfil puede ser visible otra vez.
  const reactivar = await send('/admin/directorio/perfiles/u-libre/visibilidad', 'PATCH', { visible: true }, 'tok-admin');
  assert.equal(reactivar.status, 200);
  const reactivado = db.crudo('v2_directorio_perfiles/u-libre');
  assert.equal(reactivado?.visible, true);
  assert.equal(reactivado?.ocultoPorModeracion, false);
});

test('directorio profesional · foto/banner solo acepta URLs del bucket oficial', async () => {
  const fuera = await send('/directorio/perfil', 'PUT', perfilDatos({ foto: 'https://pixel.evil.example/track.gif' }), 'tok-libre');
  assert.equal(fuera.status, 400);

  const bannerFuera = await send('/directorio/perfil', 'PUT', perfilDatos({ banner: 'https://attacker.test/b.jpg' }), 'tok-libre');
  assert.equal(bannerFuera.status, 400);

  const credenciales = await send('/directorio/perfil', 'PUT', perfilDatos({ foto: 'https://user:pass@firebasestorage.googleapis.com/x.jpg' }), 'tok-libre');
  assert.equal(credenciales.status, 400);

  // Host correcto pero bucket ajeno: también se rechaza (no basta validar host).
  const otroBucket = await send(
    '/directorio/perfil', 'PUT',
    perfilDatos({ foto: 'https://firebasestorage.googleapis.com/v0/b/otro-bucket.appspot.com/o/x.jpg' }),
    'tok-libre',
  );
  assert.equal(otroBucket.status, 400);

  const otroBucketGcs = await send(
    '/directorio/perfil', 'PUT',
    perfilDatos({ foto: 'https://storage.googleapis.com/otro-bucket/x.jpg' }),
    'tok-libre',
  );
  assert.equal(otroBucketGcs.status, 400);

  // Lookalike que explota `.` del regex (el bucket oficial tiene puntos):
  // antes del fix, el `.` matcheaba cualquier char y pasaba.
  const lookalike = await send(
    '/directorio/perfil', 'PUT',
    perfilDatos({ foto: 'https://firebasestorage.googleapis.com/v0/b/club-dermalyssexfirebasestoragexapp/o/x.jpg' }),
    'tok-libre',
  );
  assert.equal(lookalike.status, 400);

  const bueno = await send(
    '/directorio/perfil',
    'PUT',
    perfilDatos({ foto: 'https://firebasestorage.googleapis.com/v0/b/club-dermalysse.firebasestorage.app/o/perfiles%2Fu-libre.jpg?alt=media' }),
    'tok-libre',
  );
  assert.equal(bueno.status, 200);
});

test('directorio profesional · moderación persiste al borrar+recrear perfil (bypass delete+recreate)', async () => {
  // 1. Crea perfil
  await send('/directorio/perfil', 'PUT', perfilDatos(), 'tok-libre');
  // 2. Admin oculta vía panel
  const ocultar = await send('/admin/directorio/perfiles/u-libre/visibilidad', 'PATCH', { visible: false }, 'tok-admin');
  assert.equal(ocultar.status, 200);
  // 3. Dueño elimina perfil
  const del = await send('/directorio/perfil', 'DELETE', undefined, 'tok-libre');
  assert.equal(del.status, 200);
  // 4. Dueño re-crea perfil con visible=true: la moderación debe sobrevivir.
  const recreado = await send('/directorio/perfil', 'PUT', perfilDatos({ visible: true }), 'tok-libre');
  assert.equal(recreado.status, 200);
  const guardado = db.crudo('v2_directorio_perfiles/u-libre');
  assert.equal(guardado?.visible, false);
  assert.equal(guardado?.ocultoPorModeracion, true);
  // 5. Admin reactiva: la moderación se levanta
  await send('/admin/directorio/perfiles/u-libre/visibilidad', 'PATCH', { visible: true }, 'tok-admin');
  const tras = db.crudo('v2_directorio_perfiles/u-libre');
  assert.equal(tras?.visible, true);
  assert.equal(tras?.ocultoPorModeracion, false);
});

test('panel de administración modera reportes y visibilidad de cosmetólogas', async () => {
  // Asegurar que u-vip tiene perfil activo
  await send('/directorio/perfil', 'PUT', perfilDatos(), 'tok-vip');

  // u-libre reporta a u-vip
  const rep = await send(
    '/directorio/reportes',
    'POST',
    { tipo: 'perfil', objetivoId: 'u-vip', motivo: 'datos_falsos', detalle: 'Cédula de cosmiatría apócrifa.' },
    'tok-libre',
  );
  assert.equal(rep.status, 201);
  const repBody = (await rep.json()) as any;

  // Usuario normal no tiene acceso a admin
  const noAdmin = await get('/admin/directorio/reportes', 'tok-libre');
  assert.equal(noAdmin.status, 403);

  // Admin lista reportes
  const resAdmin = await get('/admin/directorio/reportes', 'tok-admin');
  assert.equal(resAdmin.status, 200);
  const reportes = (await resAdmin.json()) as any[];
  assert.ok(reportes.some((r) => r.id === repBody.id && r.motivo === 'datos_falsos'));

  // Admin modera ocultando perfil
  const mod = await send(
    `/admin/directorio/reportes/${repBody.id}`,
    'PATCH',
    { accion: 'ocultar_perfil' },
    'tok-admin',
  );
  assert.equal(mod.status, 200);
  const modBody = (await mod.json()) as any;
  assert.equal(modBody.estado, 'resuelto');
  assert.equal(modBody.resolucion, 'perfil_ocultado');

  // Perfil quedó oculto
  const perfilSnap = await db.get('v2_directorio_perfiles/u-vip');
  assert.equal((perfilSnap.data() as any).visible, false);

  // Admin reactiva visibilidad
  const react = await send(
    '/admin/directorio/perfiles/u-vip/visibilidad',
    'PATCH',
    { visible: true },
    'tok-admin',
  );
  assert.equal(react.status, 200);
  const reactSnap = await db.get('v2_directorio_perfiles/u-vip');
  assert.equal((reactSnap.data() as any).visible, true);
});

test('directorio profesional · migración obligatoria en eliminarPerfil: delete+recreate con flag legacy sigue oculto', async () => {
  TOKENS['tok-legacy2'] = { uid: 'u-legacy2', email: 'legacy2@example.test', name: 'Legacy Two' };
  db.sembrar('users/u-legacy2', { name: 'Legacy Two', email: 'legacy2@example.test', subscription: { status: 'active', plan: 'anual', currentPeriodEnd: '2027-01-01T00:00:00.000Z' } });
  // Perfil pre-fix con flag legacy y SIN doc en v2_directorio_moderacion.
  db.sembrar('v2_directorio_perfiles/u-legacy2', {
    ...perfilDatos({ contacto: { canal: 'correo' } }),
    uid: 'u-legacy2', nombre: 'Legacy Two',
    visible: false, ocultoPorModeracion: true,
    actualizado: '2026-10-20T10:00:00.000Z',
  });
  assert.equal(db.crudo('v2_directorio_moderacion/u-legacy2'), undefined);

  // El dueño borra el perfil directamente (sin pasar por PUT, que sería el otro
  // camino de migración). La migración obligatoria en DELETE debe correr.
  const del = await send('/directorio/perfil', 'DELETE', undefined, 'tok-legacy2');
  assert.equal(del.status, 200);
  assert.equal(db.crudo('v2_directorio_moderacion/u-legacy2')?.oculto, true);

  // Y al recrear con visible=true, queda oculto por la decisión persistida.
  const recreado = await send('/directorio/perfil', 'PUT', perfilDatos({ visible: true }), 'tok-legacy2');
  assert.equal(recreado.status, 200);
  assert.equal(db.crudo('v2_directorio_perfiles/u-legacy2')?.visible, false);
});

test('directorio profesional · ciclo de vida completo con moderación (crear → listar → ocultar → re-publicar → delete → recrear → reactivar)', async () => {
  // Suite nueva con un uid dedicado para no cruzar con otros tests.
  TOKENS['tok-flujo'] = { uid: 'u-flujo', email: 'flujo@example.test', name: 'Flujo Pro' };
  db.sembrar('users/u-flujo', { name: 'Flujo Pro', email: 'flujo@example.test', subscription: { status: 'active', plan: 'anual', currentPeriodEnd: '2027-01-01T00:00:00.000Z' } });

  // Para medir la visibilidad "pública" listo desde OTRA cuenta (tok-vip actúa
  // como visitante). El dueño siempre ve su propia tarjeta en el listado para
  // poder editarla — eso no es señal de visibilidad pública.
  const listarPublico = async () => (await (await get('/directorio', 'tok-vip')).json()) as any;
  const listarMio = async () => (await (await get('/directorio', 'tok-flujo')).json()) as any;
  const idEsta = (body: any) => (body.perfiles ?? []).some((p: any) => p.uid === 'u-flujo');
  const miVisible = (body: any) => body.miPerfil?.visible === true;

  // 1. Crear perfil
  const crear = await send('/directorio/perfil', 'PUT', perfilDatos({ visible: true }), 'tok-flujo');
  assert.equal(crear.status, 200);
  assert.ok(idEsta(await listarPublico()), 'tras crear, aparece en listado público');
  assert.ok(miVisible(await listarMio()), 'miPerfil.visible=true tras crear con visible=true');

  // 2. Admin oculta
  const ocultar = await send('/admin/directorio/perfiles/u-flujo/visibilidad', 'PATCH', { visible: false }, 'tok-admin');
  assert.equal(ocultar.status, 200);
  assert.ok(!idEsta(await listarPublico()), 'tras ocultar admin, NO aparece en listado público');
  assert.equal((await listarMio()).miPerfil?.visible, false, 'miPerfil.visible=false para el dueño');
  assert.equal(db.crudo('v2_directorio_moderacion/u-flujo')?.oculto, true);

  // 3. Dueño intenta re-publicar con visible=true: el server lo fuerza a false
  const bypass = await send('/directorio/perfil', 'PUT', perfilDatos({ visible: true }), 'tok-flujo');
  assert.equal(bypass.status, 200);
  assert.ok(!idEsta(await listarPublico()), 'bypass por PUT con visible=true no funciona');
  assert.equal((await listarMio()).miPerfil?.visible, false);

  // 4. Dueño elimina el perfil
  const del = await send('/directorio/perfil', 'DELETE', undefined, 'tok-flujo');
  assert.equal(del.status, 200);
  assert.ok(!idEsta(await listarPublico()));
  assert.equal((await listarMio()).miPerfil, null);
  // El flag de moderación sobrevive al delete:
  assert.equal(db.crudo('v2_directorio_moderacion/u-flujo')?.oculto, true);

  // 5. Dueño recrea el perfil con visible=true: delete+recreate NO debe evadir
  const recrear = await send('/directorio/perfil', 'PUT', perfilDatos({ visible: true }), 'tok-flujo');
  assert.equal(recrear.status, 200);
  assert.ok(!idEsta(await listarPublico()), 'tras recrear, sigue oculto por el flag persistente');
  assert.equal((await listarMio()).miPerfil?.visible, false);

  // 6. Admin reactiva: el perfil vuelve al listado y el flag se levanta
  const reactivar = await send('/admin/directorio/perfiles/u-flujo/visibilidad', 'PATCH', { visible: true }, 'tok-admin');
  assert.equal(reactivar.status, 200);
  assert.ok(idEsta(await listarPublico()), 'tras reactivar admin, vuelve al listado público');
  assert.ok(miVisible(await listarMio()));
  assert.equal(db.crudo('v2_directorio_moderacion/u-flujo')?.oculto, false);
});

test('directorio profesional · migración perezosa: flag legacy del perfil también bloquea re-publicar', async () => {
  // Simula un perfil pre-fix: ya existe con ocultoPorModeracion=true, pero
  // NO hay documento en v2_directorio_moderacion (vino de antes del split).
  // Usa un uid dedicado para no ensuciar los tests que compartirían u-vip.
  TOKENS['tok-legacy'] = { uid: 'u-legacy', email: 'legacy@example.test', name: 'Legacy Pro' };
  db.sembrar('users/u-legacy', { name: 'Legacy Pro', email: 'legacy@example.test', subscription: { status: 'active', plan: 'anual', currentPeriodEnd: '2027-01-01T00:00:00.000Z' } });
  db.sembrar('v2_directorio_perfiles/u-legacy', {
    ...perfilDatos({ contacto: { canal: 'correo' } }),
    uid: 'u-legacy',
    nombre: 'Legacy Pro',
    visible: false,
    ocultoPorModeracion: true,
    actualizado: '2026-10-20T10:00:00.000Z',
  });
  assert.equal(db.crudo('v2_directorio_moderacion/u-legacy'), undefined);

  // El dueño intenta re-publicar con visible=true: debe quedar oculto.
  const intento = await send('/directorio/perfil', 'PUT', perfilDatos({ visible: true }), 'tok-legacy');
  assert.equal(intento.status, 200);
  const tras = db.crudo('v2_directorio_perfiles/u-legacy');
  assert.equal(tras?.visible, false);
  // Y la migración perezosa debió crear el doc en la colección aparte.
  assert.equal(db.crudo('v2_directorio_moderacion/u-legacy')?.oculto, true);
});

test('directorio profesional · asegurar crea perfil mínimo OCULTO para usuario nuevo e idempotente', async () => {
  // Usuario nuevo sin perfil: asegurar crea uno mínimo y OCULTO.
  const r1 = await send('/directorio/perfil/asegurar', 'POST', {}, 'tok-nuevo');
  assert.equal(r1.status, 200);
  assert.equal(((await r1.json()) as any).creado, true);

  // Su perfil propio existe (para editarlo) con lo básico y sin publicar.
  const dir = (await (await get('/directorio', 'tok-nuevo')).json()) as any;
  assert.ok(dir.miPerfil, 'debe tener miPerfil tras asegurar');
  assert.equal(dir.miPerfil.nombre, 'Miembro Nuevo');
  assert.equal(dir.miPerfil.visible, false);
  // OCULTO: otro miembro NO lo ve en el listado público (solo se listan visibles).
  const dirOtro = (await (await get('/directorio', 'tok-vip')).json()) as any;
  assert.ok(!dirOtro.perfiles.some((p: any) => p.uid === 'u-nuevo'), 'un perfil oculto no lo ven otros');

  // Idempotente: un segundo asegurar no recrea.
  const r2 = await send('/directorio/perfil/asegurar', 'POST', {}, 'tok-nuevo');
  assert.equal(((await r2.json()) as any).creado, false);

  // No pisa un perfil ya completo.
  await send('/directorio/perfil', 'PUT', perfilDatos(), 'tok-nuevo');
  const r3 = await send('/directorio/perfil/asegurar', 'POST', {}, 'tok-nuevo');
  assert.equal(((await r3.json()) as any).creado, false);
});
