import { test, describe, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import type { AcademiaContentStore, AuthAdapter } from '../src/adapters/interfaces.js';
import { FixtureContentStore } from '../src/adapters/dev/fixtureContent.js';
import { MemoryExperienceStore } from '../src/adapters/dev/memoryExperiences.js';
import { FixtureLearningStore } from '../src/adapters/dev/fixtureQuizzes.js';
import { MemoryProgressStore } from '../src/adapters/dev/memoryProgress.js';
import { MemoryCertificateStore } from '../src/adapters/dev/memoryCertificates.js';
import { FixtureLeagueStore } from '../src/adapters/dev/fixtureLeague.js';
import { MemoryForumStore } from '../src/adapters/dev/memoryForum.js';
import { MemoryProfileStore } from '../src/adapters/dev/memoryProfile.js';
import { DiskAcademiaContentStore, nn } from '../src/adapters/dev/diskAcademia.js';
import { MemoryAcademiaAttemptStore, MemoryAcademiaProgressStore, MemoryAcademiaReviewStore } from '../src/adapters/dev/memoryAcademia.js';
import { LearningService } from '../src/services/learning.js';
import { AcademiaService, ESPERA_EXAMEN_MS, estadoEfectivo, moduloPublico } from '../src/services/academia.js';
import type { CatalogoAcademia, ModuloAcademia, Usuario } from '../src/domain/types.js';

// ── Contenido en memoria: un programa de 3 módulos, 2 temas cada uno y bancos de 6 preguntas (se muestran 4).
// Nunca se usan los archivos reales salvo en la prueba del catálogo en disco.
const pregunta = (id: string, correcta: number) => ({ id, q: `Pregunta ${id}`, opciones: ['A', 'B', 'C', 'D'], correcta, explicacion: `Porque ${id}` });
/** Respuesta correcta de la pregunta m<n>-p<i>: i % 4. */
const correctaDe = (id: string) => Number(id.split('-p')[1]) % 4;

function modulo(n: number, estado = 'aprobado'): ModuloAcademia {
  return {
    programa: 'prog', modulo: n, titulo: `Módulo ${n}`, estado, duracionMin: 40 + n,
    resumen: 'Resumen', objetivos: ['Explicar'],
    fuentes: [{ tipo: 'propia', titulo: 'Fuente del módulo', autor: 'Dermalysse', anio: 2026 }],
    temas: [1, 2].map((t) => ({
      n: `${n}.${t}`, titulo: `Tema ${n}.${t}`, minutos: 10,
      bloques: [{ tipo: 'texto', md: 'Uno dos tres cuatro.' }, { tipo: 'figura', id: `prog/m${nn(n)}/0${t}` }, { tipo: 'actividad', actividad: 'vf' }],
      glosario: [], verificacion: [],
      fuentes: [{ tipo: 'propia', titulo: `Fuente ${n}.${t}`, autor: 'Dermalysse', anio: 2026 }],
    })),
    examen: { aprobar: 70, mostrar: 4, preguntas: [0, 1, 2, 3, 4, 5].map((i) => pregunta(`m${n}-p${i}`, i % 4)) },
  };
}

class MemoriaContenido implements AcademiaContentStore {
  readonly mods: Record<number, ModuloAcademia | null>;
  constructor(estados: Record<number, string | null> = {}) {
    this.mods = Object.fromEntries([1, 2, 3].map((n) => {
      const e = estados[n] === undefined ? 'aprobado' : estados[n];
      return [n, e === null ? null : modulo(n, e)];
    }));
  }
  async catalogo(): Promise<CatalogoAcademia> {
    return { programas: [{ id: 'prog', numero: 1, titulo: 'Programa de prueba', area: 'Ciencia de la piel', modulos: [1, 2, 3].map((n) => ({ n, titulo: `Módulo ${n}` })) }] };
  }
  async modulo(p: string, n: number) { return p === 'prog' ? this.mods[n] ?? null : null; }
}

// ── Usuarios por token (el adaptador decide VIP/admin, nunca el cuerpo) ──
const USUARIOS: Record<string, Usuario> = {
  free: { uid: 'u-free', email: 'free@local', esVip: false, esAdmin: false, nombre: 'Free' },
  vip: { uid: 'u-vip', email: 'vip@local', esVip: true, esAdmin: false, nombre: 'VIP' },
  admin: { uid: 'u-admin', email: 'admin@local', esVip: false, esAdmin: true, nombre: 'Admin' },
};
const auth: AuthAdapter = { modo: 'test', async verificar(token) { return USUARIOS[token] ? { ...USUARIOS[token] } : null; } };

interface Entorno {
  contenido: MemoriaContenido;
  reloj: { ahora: Date };
  pedir: (metodo: string, ruta: string, token?: string | null, cuerpo?: unknown) => Promise<{ status: number; body: any }>;
}

async function entorno(t: TestContext, o: { estados?: Record<number, string | null>; borradores?: boolean; contenido?: MemoriaContenido } = {}): Promise<Entorno> {
  const contenido = o.contenido ?? new MemoriaContenido(o.estados);
  const reloj = { ahora: new Date('2026-10-15T10:00:00.000Z') };
  const content = new FixtureContentStore();
  const app = createApp({
    auth, content, experiences: new MemoryExperienceStore(),
    learning: new LearningService(content, new FixtureLearningStore(), new MemoryProgressStore(), new MemoryCertificateStore()),
    league: new FixtureLeagueStore(), forum: new MemoryForumStore(), profiles: new MemoryProfileStore(),
    academia: new AcademiaService(contenido, new MemoryAcademiaProgressStore(), new MemoryAcademiaAttemptStore(), new MemoryAcademiaReviewStore(), {
      mostrarBorradores: o.borradores === true,
      ahora: () => reloj.ahora,
    }),
    corsOrigins: [],
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(() => { server.close(); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const pedir = async (metodo: string, ruta: string, token: string | null = 'vip', cuerpo?: unknown) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetch(base + ruta, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  return { contenido, reloj, pedir };
}

const avanzar = (e: Entorno, ms: number) => { e.reloj.ahora = new Date(e.reloj.ahora.getTime() + ms); };

async function leerTodo(e: Entorno, n: number, token = 'vip') {
  for (const tema of [`${n}.1`, `${n}.2`]) {
    const r = await e.pedir('POST', `/academia/prog/${n}/tema`, token, { tema });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
}

async function rendir(e: Entorno, n: number, { acertar = true, token = 'vip' } = {}) {
  const ex = await e.pedir('GET', `/academia/prog/${n}/examen`, token);
  assert.equal(ex.status, 200, JSON.stringify(ex.body));
  const respuestas = Object.fromEntries(ex.body.preguntas.map((q: { id: string }) => [q.id, acertar ? correctaDe(q.id) : (correctaDe(q.id) + 1) % 4]));
  const r = await e.pedir('POST', `/academia/prog/${n}/examen`, token, { respuestas });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}

/** Lee y aprueba el módulo n. */
async function aprobar(e: Entorno, n: number, token = 'vip') {
  await leerTodo(e, n, token);
  const r = await rendir(e, n, { token });
  assert.equal(r.aprobado, true);
  return r;
}

const sinBanco = (json: unknown) => {
  const s = JSON.stringify(json);
  return !/"correcta"/.test(s) && !/"explicacion"/.test(s) && !/m\d-p\d/.test(s);
};

describe('academia · sesión y catálogo', () => {
  test('todas las rutas exigen sesión (401 sin token o con token inválido)', async (t) => {
    const e = await entorno(t);
    for (const [metodo, ruta] of [
      ['GET', '/academia'], ['GET', '/academia/progreso'], ['GET', '/academia/prog/1'], ['POST', '/academia/prog/1/tema'],
      ['GET', '/academia/prog/1/examen'], ['POST', '/academia/prog/1/examen'], ['GET', '/admin/academia'], ['PATCH', '/admin/academia/prog/1'],
    ] as const) {
      assert.equal((await e.pedir(metodo, ruta, null, metodo === 'GET' ? undefined : {})).status, 401, `${metodo} ${ruta}`);
      assert.equal((await e.pedir(metodo, ruta, 'falso', metodo === 'GET' ? undefined : {})).status, 401, `${metodo} ${ruta} token inválido`);
    }
  });

  test('GET /academia: disponibilidad, estado, temas y duración por módulo, sin datos del examen', async (t) => {
    const e = await entorno(t, { estados: { 2: 'borrador', 3: null } });
    const r = await e.pedir('GET', '/academia', 'free');
    assert.equal(r.status, 200);
    const [p] = r.body.programas;
    assert.equal(p.id, 'prog');
    assert.equal(p.titulo, 'Programa de prueba');
    assert.deepEqual(p.modulos.map((m: any) => m.disponible), [true, false, false]);
    assert.deepEqual(p.modulos.map((m: any) => m.estado), ['aprobado', 'borrador', null]);
    assert.deepEqual(p.modulos.map((m: any) => m.temas), [2, 2, 0]);
    assert.deepEqual(p.modulos.map((m: any) => m.duracionMin), [41, 42, null]);
    assert.deepEqual(Object.keys(p.modulos[0]).sort(), ['disponible', 'duracionMin', 'estado', 'n', 'temas', 'titulo']);
    assert.deepEqual(r.body.progreso, {});
    assert.ok(sinBanco(r.body), 'el catálogo no lleva preguntas, respuestas ni explicaciones');
    // El admin ve los borradores como disponibles.
    const adm = await e.pedir('GET', '/academia', 'admin');
    assert.deepEqual(adm.body.programas[0].modulos.map((m: any) => m.disponible), [true, true, false]);
  });

  test('GET /academia/:programa/:n entrega el módulo sin banco: examen = { aprobar, mostrar, total }', async (t) => {
    const e = await entorno(t);
    const r = await e.pedir('GET', '/academia/prog/1', 'free');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.examen, { aprobar: 70, mostrar: 4, total: 6 });
    assert.equal(r.body.estado, 'aprobado');
    assert.equal(r.body.temas.length, 2);
    assert.ok(sinBanco(r.body));
    // Las fuentes son para la revisión profesional: el miembro no las recibe; el admin sí.
    assert.equal(r.body.fuentes, undefined);
    assert.ok(r.body.temas.every((tema: any) => tema.fuentes === undefined));
    const adm = await e.pedir('GET', '/academia/prog/1', 'admin');
    assert.ok(Array.isArray(adm.body.fuentes) && Array.isArray(adm.body.temas[0].fuentes));
    assert.ok(sinBanco(adm.body), 'ni el admin recibe el banco por esta ruta');
  });

  test('programa, módulo o número inexistente ⇒ 404 no-encontrado', async (t) => {
    const e = await entorno(t);
    for (const ruta of ['/academia/nada/1', '/academia/prog/9', '/academia/prog/abc', '/academia/prog/1.5', '/academia/prog/01', '/academia/nada/1/examen']) {
      const r = await e.pedir('GET', ruta);
      assert.equal(r.status, 404, ruta);
      assert.equal(r.body.error, 'no-encontrado', ruta);
    }
  });
});

describe('academia · acceso y desbloqueo', () => {
  test('módulo 1 gratis; los demás exigen VIP (402 requiere_vip) y el cuerpo no puede declararse VIP', async (t) => {
    const e = await entorno(t);
    assert.equal((await e.pedir('GET', '/academia/prog/1', 'free')).status, 200);
    await leerTodo(e, 1, 'free');
    assert.equal((await e.pedir('GET', '/academia/prog/1/examen', 'free')).status, 200);
    for (const [metodo, ruta, cuerpo] of [
      ['GET', '/academia/prog/2', undefined],
      ['POST', '/academia/prog/2/tema', { tema: '2.1', esVip: true, esAdmin: true }],
      ['GET', '/academia/prog/2/examen', undefined],
      ['POST', '/academia/prog/2/examen', { respuestas: {}, esVip: true }],
    ] as const) {
      const r = await e.pedir(metodo, ruta, 'free', cuerpo);
      assert.equal(r.status, 402, `${metodo} ${ruta}`);
      assert.equal(r.body.error, 'requiere_vip');
    }
  });

  test('un módulo n>1 se abre solo al aprobar el anterior con 70 % (403 modulo_bloqueado)', async (t) => {
    const e = await entorno(t);
    const bloqueado = await e.pedir('GET', '/academia/prog/2');
    assert.equal(bloqueado.status, 403);
    assert.equal(bloqueado.body.error, 'modulo_bloqueado');
    assert.equal((await e.pedir('POST', '/academia/prog/2/tema', 'vip', { tema: '2.1' })).status, 403);
    assert.equal((await e.pedir('GET', '/academia/prog/2/examen')).status, 403);

    await leerTodo(e, 1);
    const reprobado = await rendir(e, 1, { acertar: false });
    assert.equal(reprobado.aprobado, false);
    assert.equal((await e.pedir('GET', '/academia/prog/2')).status, 403);

    avanzar(e, ESPERA_EXAMEN_MS + 1000);
    const ok = await rendir(e, 1);
    assert.equal(ok.aprobado, true);
    assert.equal(ok.porcentaje, 100);
    assert.equal(ok.siguiente, 2);
    assert.equal(ok.programaCompleto, false);
    assert.equal((await e.pedir('GET', '/academia/prog/2')).status, 200);
    // El 3 sigue cerrado hasta aprobar el 2.
    assert.equal((await e.pedir('GET', '/academia/prog/3')).body.error, 'modulo_bloqueado');
  });

  test('3 de 4 (75 %) aprueba; 2 de 4 (50 %) no', async (t) => {
    const e = await entorno(t);
    await leerTodo(e, 1);
    const pedirYResponder = async (aciertos: number) => {
      const ex = await e.pedir('GET', '/academia/prog/1/examen');
      const respuestas = Object.fromEntries(ex.body.preguntas.map((q: { id: string }, i: number) => [q.id, i < aciertos ? correctaDe(q.id) : (correctaDe(q.id) + 1) % 4]));
      return (await e.pedir('POST', '/academia/prog/1/examen', 'vip', { respuestas })).body;
    };
    const medio = await pedirYResponder(2);
    assert.equal(medio.porcentaje, 50);
    assert.equal(medio.aprobado, false);
    avanzar(e, ESPERA_EXAMEN_MS);
    const tres = await pedirYResponder(3);
    assert.equal(tres.porcentaje, 75);
    assert.equal(tres.aprobado, true);
  });

  test('el admin salta VIP, desbloqueo, temas pendientes y espera', async (t) => {
    const e = await entorno(t);
    assert.equal((await e.pedir('GET', '/academia/prog/3', 'admin')).status, 200);
    const reprobado = await rendir(e, 3, { acertar: false, token: 'admin' }); // sin leer temas
    assert.equal(reprobado.aprobado, false);
    assert.equal((await e.pedir('GET', '/academia/prog/3/examen', 'admin')).status, 200); // sin esperar
  });

  test('borradores y módulos en revisión solo los ve el admin (404 modulo_en_preparacion), salvo con la bandera', async (t) => {
    const e = await entorno(t, { estados: { 2: 'borrador', 3: 'revision' } });
    await aprobar(e, 1);
    for (const ruta of ['/academia/prog/2', '/academia/prog/2/examen']) {
      const r = await e.pedir('GET', ruta);
      assert.equal(r.status, 404, ruta);
      assert.equal(r.body.error, 'modulo_en_preparacion');
    }
    assert.equal((await e.pedir('POST', '/academia/prog/2/tema', 'vip', { tema: '2.1' })).body.error, 'modulo_en_preparacion');
    const adm = await e.pedir('GET', '/academia/prog/2', 'admin');
    assert.equal(adm.status, 200);
    assert.equal(adm.body.estado, 'borrador');
    assert.equal((await e.pedir('GET', '/academia/prog/3', 'admin')).body.estado, 'revision');

    const conBandera = await entorno(t, { estados: { 2: 'borrador', 3: 'revision' }, borradores: true });
    await aprobar(conBandera, 1);
    const visible = await conBandera.pedir('GET', '/academia/prog/2');
    assert.equal(visible.status, 200);
    assert.equal(visible.body.estado, 'borrador');
    assert.equal((await conBandera.pedir('GET', '/academia')).body.programas[0].modulos[1].disponible, true);
  });

  test('un módulo sin archivo está en preparación incluso para el admin', async (t) => {
    const e = await entorno(t, { estados: { 2: null } });
    const r = await e.pedir('GET', '/academia/prog/2', 'admin');
    assert.equal(r.status, 404);
    assert.equal(r.body.error, 'modulo_en_preparacion');
  });
});

describe('academia · temas y examen', () => {
  test('POST tema valida que el tema pertenezca al módulo y queda en el avance', async (t) => {
    const e = await entorno(t);
    const ok = await e.pedir('POST', '/academia/prog/1/tema', 'vip', { tema: '1.1' });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.temas['1.1']);
    for (const tema of ['9.9', 11, null, '']) {
      assert.equal((await e.pedir('POST', '/academia/prog/1/tema', 'vip', { tema })).status, 400, String(tema));
    }
    assert.equal((await e.pedir('POST', '/academia/prog/1/tema', 'vip', {})).status, 400);
    const prog = await e.pedir('GET', '/academia/progreso');
    assert.deepEqual(Object.keys(prog.body.prog.modulos['1'].temas), ['1.1']);
    // Idempotente: conserva la primera fecha.
    const primera = prog.body.prog.modulos['1'].temas['1.1'];
    avanzar(e, 60_000);
    await e.pedir('POST', '/academia/prog/1/tema', 'vip', { tema: '1.1' });
    assert.equal((await e.pedir('GET', '/academia/progreso')).body.prog.modulos['1'].temas['1.1'], primera);
  });

  test('el examen exige todos los temas leídos (403 temas_pendientes)', async (t) => {
    const e = await entorno(t);
    let r = await e.pedir('GET', '/academia/prog/1/examen');
    assert.equal(r.status, 403);
    assert.equal(r.body.error, 'temas_pendientes');
    await e.pedir('POST', '/academia/prog/1/tema', 'vip', { tema: '1.1' });
    r = await e.pedir('GET', '/academia/prog/1/examen');
    assert.equal(r.body.error, 'temas_pendientes');
    await e.pedir('POST', '/academia/prog/1/tema', 'vip', { tema: '1.2' });
    assert.equal((await e.pedir('GET', '/academia/prog/1/examen')).status, 200);
  });

  test('GET examen: `mostrar` preguntas al azar del banco, sin respuestas ni explicaciones', async (t) => {
    const e = await entorno(t);
    await leerTodo(e, 1);
    const vistos = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const r = await e.pedir('GET', '/academia/prog/1/examen');
      assert.equal(r.status, 200);
      assert.equal(r.body.aprobar, 70);
      assert.equal(r.body.total, 4);
      assert.equal(r.body.preguntas.length, 4);
      assert.equal(new Set(r.body.preguntas.map((q: any) => q.id)).size, 4);
      for (const q of r.body.preguntas) {
        assert.deepEqual(Object.keys(q).sort(), ['id', 'opciones', 'q']);
        assert.match(q.id, /^m1-p[0-5]$/);
        vistos.add(q.id);
      }
      assert.ok(!/correcta|explicacion|Porque/.test(JSON.stringify(r.body)));
    }
    assert.ok(vistos.size > 4, 'las preguntas salen al azar de todo el banco');
  });

  test('POST examen califica solo las preguntas emitidas y una sola vez (409 en otro caso)', async (t) => {
    const e = await entorno(t);
    await leerTodo(e, 1);
    const sinEmitir = await e.pedir('POST', '/academia/prog/1/examen', 'vip', { respuestas: {} });
    assert.equal(sinEmitir.status, 409);
    assert.equal(sinEmitir.body.error, 'examen_no_emitido');

    const ex = await e.pedir('GET', '/academia/prog/1/examen');
    const emitidas = ex.body.preguntas.map((q: any) => q.id) as string[];
    // Validación del cuerpo (no consume el examen).
    assert.equal((await e.pedir('POST', '/academia/prog/1/examen', 'vip', { respuestas: [1, 2] })).status, 400);
    assert.equal((await e.pedir('POST', '/academia/prog/1/examen', 'vip', {})).status, 400);
    assert.equal((await e.pedir('POST', '/academia/prog/1/examen', 'vip', { respuestas: { [emitidas[0]]: '1' } })).status, 400);
    assert.equal((await e.pedir('POST', '/academia/prog/1/examen', 'vip', { respuestas: { [emitidas[0]]: 1.5 } })).status, 400);

    // Responde TODO el banco correctamente: solo cuentan las 4 emitidas.
    const todas = Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [`m1-p${i}`, i % 4]));
    const r = await e.pedir('POST', '/academia/prog/1/examen', 'vip', { respuestas: todas });
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 4);
    assert.equal(r.body.correctas, 4);
    assert.deepEqual(r.body.detalle.map((d: any) => d.id), emitidas);

    const otraVez = await e.pedir('POST', '/academia/prog/1/examen', 'vip', { respuestas: todas });
    assert.equal(otraVez.status, 409);
    assert.equal(otraVez.body.error, 'examen_no_emitido');
    assert.equal((await e.pedir('GET', '/academia/progreso')).body.prog.modulos['1'].intentos, 1);
  });

  test('preguntas sin responder cuentan como incorrectas', async (t) => {
    const e = await entorno(t);
    await leerTodo(e, 1);
    await e.pedir('GET', '/academia/prog/1/examen');
    const r = await e.pedir('POST', '/academia/prog/1/examen', 'vip', { respuestas: {} });
    assert.equal(r.status, 200);
    assert.equal(r.body.correctas, 0);
    assert.equal(r.body.porcentaje, 0);
  });

  test('si el banco cambia entre emitir y calificar ⇒ 409 examen_desactualizado', async (t) => {
    const e = await entorno(t);
    await leerTodo(e, 1);
    await e.pedir('GET', '/academia/prog/1/examen');
    e.contenido.mods[1]!.examen!.preguntas = [pregunta('nueva-p0', 0), pregunta('nueva-p1', 1)];
    const r = await e.pedir('POST', '/academia/prog/1/examen', 'vip', { respuestas: {} });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'examen_desactualizado');
  });

  test('al reprobar NO se revelan respuestas ni explicaciones (detalle = { id, acertada }, revelado:false)', async (t) => {
    const e = await entorno(t);
    await leerTodo(e, 1);
    const r = await rendir(e, 1, { acertar: false });
    assert.equal(r.aprobado, false);
    assert.equal(r.revelado, false);
    assert.equal(r.detalle.length, 4);
    for (const d of r.detalle) assert.deepEqual(Object.keys(d).sort(), ['acertada', 'id']);
    assert.ok(!/"correcta"|"explicacion"|Porque/.test(JSON.stringify(r)));
    assert.equal(r.siguiente, null);
  });

  test('al aprobar se revelan la correcta y la explicación (revelado:true)', async (t) => {
    const e = await entorno(t);
    const r = await aprobar(e, 1);
    assert.equal(r.revelado, true);
    for (const d of r.detalle) {
      assert.equal(d.acertada, true);
      assert.equal(d.correcta, correctaDe(d.id));
      assert.equal(d.explicacion, `Porque ${d.id}`);
    }
  });

  test('tras reprobar hay 3 minutos de espera (429 espera_examen)', async (t) => {
    const e = await entorno(t);
    await leerTodo(e, 1);
    await rendir(e, 1, { acertar: false });
    const r = await e.pedir('GET', '/academia/prog/1/examen');
    assert.equal(r.status, 429);
    assert.equal(r.body.error, 'espera_examen');
    assert.match(r.body.mensaje, /3 minutos/);
    avanzar(e, ESPERA_EXAMEN_MS - 30_000);
    const casi = await e.pedir('GET', '/academia/prog/1/examen');
    assert.equal(casi.status, 429);
    assert.match(casi.body.mensaje, /1 minuto\b/);
    avanzar(e, 30_000);
    assert.equal((await e.pedir('GET', '/academia/prog/1/examen')).status, 200);
  });

  test('aprobar no genera espera; reprobar después revela (aprobado antes), conserva la mejor marca y la aprobación', async (t) => {
    const e = await entorno(t);
    await aprobar(e, 1);
    const despues = await rendir(e, 1, { acertar: false }); // sin espera tras aprobar
    assert.equal(despues.aprobado, false);
    assert.equal(despues.mejor, 100);
    assert.equal(despues.revelado, true, 'el módulo ya estaba aprobado');
    assert.ok(despues.detalle.every((d: any) => typeof d.correcta === 'number' && typeof d.explicacion === 'string'));
    const prog = (await e.pedir('GET', '/academia/progreso')).body.prog.modulos['1'];
    assert.equal(prog.aprobado, true);
    assert.equal(prog.mejor, 100);
    assert.equal(prog.intentos, 2);
    assert.ok(prog.aprobadoEn);
    assert.equal((await e.pedir('GET', '/academia/prog/2')).status, 200);
  });

  test('aprobar todos los módulos marca programaCompleto (sin certificado: aún no se emite)', async (t) => {
    const e = await entorno(t);
    await aprobar(e, 1);
    await aprobar(e, 2);
    const fin = await aprobar(e, 3);
    assert.equal(fin.programaCompleto, true);
    assert.equal(fin.siguiente, null);
    assert.equal(fin.certificado, undefined);
    const cat = await e.pedir('GET', '/academia');
    assert.deepEqual(Object.keys(cat.body.progreso.prog.modulos).sort(), ['1', '2', '3']);
  });

  test('el avance es por cuenta', async (t) => {
    const e = await entorno(t);
    await aprobar(e, 1);
    assert.deepEqual((await e.pedir('GET', '/academia/progreso', 'free')).body, {});
  });
});

describe('academia · revisión administrativa', () => {
  test('GET /admin/academia: estado del archivo, estado efectivo, nota y métricas; solo admin', async (t) => {
    const e = await entorno(t, { estados: { 2: 'borrador', 3: null } });
    const prohibido = await e.pedir('GET', '/admin/academia', 'vip');
    assert.equal(prohibido.status, 403);
    const r = await e.pedir('GET', '/admin/academia', 'admin');
    assert.equal(r.status, 200);
    const [p] = r.body.programas;
    assert.equal(p.id, 'prog');
    const [m1, m2, m3] = p.modulos;
    assert.equal(m1.estadoArchivo, 'aprobado');
    assert.equal(m2.estadoArchivo, 'borrador');
    assert.equal(m2.estado, 'borrador');
    assert.equal(m2.nota, '');
    assert.equal(m2.revision, null);
    assert.equal(m2.existe, true);
    assert.equal(m2.temas, 2);
    assert.equal(m2.palabras, 8);
    assert.equal(m2.figuras, 2);
    assert.equal(m2.actividades, 2);
    assert.equal(m2.preguntas, 6);
    assert.equal(m3.existe, false);
    assert.equal(m3.estado, null);
    assert.equal(m3.estadoArchivo, null);
    assert.ok(sinBanco(r.body));
  });

  test('aprobar desde el admin publica un borrador; la nota y el revisor quedan guardados', async (t) => {
    const e = await entorno(t, { estados: { 2: 'borrador' } });
    await aprobar(e, 1);
    assert.equal((await e.pedir('GET', '/academia/prog/2')).status, 404);
    assert.equal((await e.pedir('PATCH', '/admin/academia/prog/2', 'vip', { estado: 'aprobado' })).status, 403);
    const r = await e.pedir('PATCH', '/admin/academia/prog/2', 'admin', { estado: 'aprobado', nota: 'Revisado por la cosmetóloga titular' });
    assert.equal(r.status, 200);
    assert.equal(r.body.estado, 'aprobado');
    assert.equal(r.body.estadoArchivo, 'borrador');
    assert.equal(r.body.nota, 'Revisado por la cosmetóloga titular');
    assert.equal(r.body.revision.revisor, 'u-admin');
    const mod = await e.pedir('GET', '/academia/prog/2');
    assert.equal(mod.status, 200);
    assert.equal(mod.body.estado, 'aprobado');
    assert.equal((await e.pedir('GET', '/academia')).body.programas[0].modulos[1].disponible, true);
    const lista = await e.pedir('GET', '/admin/academia', 'admin');
    assert.equal(lista.body.programas[0].modulos[1].nota, 'Revisado por la cosmetóloga titular');
  });

  test('enviar a revisión o devolver a borrador oculta un módulo aprobado en el JSON', async (t) => {
    const e = await entorno(t);
    assert.equal((await e.pedir('PATCH', '/admin/academia/prog/3', 'admin', { estado: 'revision' })).status, 200);
    assert.deepEqual((await e.pedir('GET', '/academia')).body.programas[0].modulos.map((m: any) => m.disponible), [true, true, false]);
    assert.equal((await e.pedir('PATCH', '/admin/academia/prog/2', 'admin', { estado: 'borrador', nota: 'Corregir la tabla 2.1' })).status, 200);
    await aprobar(e, 1);
    const oculto = await e.pedir('GET', '/academia/prog/2');
    assert.equal(oculto.status, 404);
    assert.equal(oculto.body.error, 'modulo_en_preparacion');
    assert.equal((await e.pedir('GET', '/academia/prog/2', 'admin')).body.estado, 'borrador');
  });

  test('PATCH valida estado, nota y existencia', async (t) => {
    const e = await entorno(t, { estados: { 3: null } });
    for (const cuerpo of [{ estado: 'publicado' }, {}, { estado: 'revision', nota: '<b>x</b>' }, { estado: 'revision', nota: 'x'.repeat(501) }, { estado: 'revision', nota: 5 }]) {
      const r = await e.pedir('PATCH', '/admin/academia/prog/2', 'admin', cuerpo);
      assert.equal(r.status, 400, JSON.stringify(cuerpo));
    }
    assert.equal((await e.pedir('PATCH', '/admin/academia/nada/1', 'admin', { estado: 'aprobado' })).status, 404);
    assert.equal((await e.pedir('PATCH', '/admin/academia/prog/9', 'admin', { estado: 'aprobado' })).status, 404);
    const sin = await e.pedir('PATCH', '/admin/academia/prog/3', 'admin', { estado: 'aprobado' });
    assert.equal(sin.status, 409);
    assert.equal(sin.body.error, 'modulo_sin_contenido');
  });
});

describe('academia · contenido', () => {
  test('el estado efectivo prefiere la revisión; el módulo público no lleva el banco', () => {
    const rev = (estado: string) => ({ estado, nota: '', revisor: 'x', fecha: '' }) as never;
    assert.equal(estadoEfectivo(null, rev('aprobado')), null);
    assert.equal(estadoEfectivo(modulo(1, 'borrador'), rev('aprobado')), 'aprobado');
    assert.equal(estadoEfectivo(modulo(1, 'aprobado'), rev('otro')), 'aprobado');
    assert.equal(estadoEfectivo(modulo(1, 'raro'), null), 'borrador');
    const pub = moduloPublico(modulo(1), 'aprobado');
    assert.deepEqual(pub.examen, { aprobar: 70, mostrar: 4, total: 6 });
    assert.ok(sinBanco(pub));
  });

  test('el cargador de disco ignora ids inválidos, carpetas con "_" y JSON a medio escribir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'academia-'));
    try {
      writeFileSync(join(dir, 'catalogo.json'), JSON.stringify({ programas: [
        { id: 'piel', titulo: 'Piel', modulos: [{ n: 1, titulo: 'Uno' }, { n: 2, titulo: 'Dos' }] },
        { id: '_muestra', titulo: 'Muestra', modulos: [{ n: 1, titulo: 'Uno' }] },
        { id: 'Mal ID', titulo: 'Mal', modulos: [] },
      ] }));
      mkdirSync(join(dir, 'piel'));
      mkdirSync(join(dir, '_muestra'));
      writeFileSync(join(dir, 'piel', 'modulo-01.json'), JSON.stringify(modulo(1)));
      writeFileSync(join(dir, 'piel', 'modulo-02.json'), '{"programa": "piel", "titu');
      writeFileSync(join(dir, '_muestra', 'modulo-01.json'), JSON.stringify(modulo(1)));
      const c = new DiskAcademiaContentStore(pathToFileURL(`${dir}/`));
      assert.deepEqual((await c.catalogo()).programas.map((p) => p.id), ['piel']);
      assert.equal((await c.modulo('piel', 1))?.titulo, 'Módulo 1');
      assert.equal(await c.modulo('piel', 2), null, 'a medio escribir cuenta como en preparación');
      writeFileSync(join(dir, 'piel', 'modulo-02.json'), JSON.stringify(modulo(2)));
      assert.equal((await c.modulo('piel', 2))?.titulo, 'Módulo 2', 'se reintenta: no quedó en caché');
      assert.equal(await c.modulo('_muestra', 1), null);
      assert.equal(await c.modulo('../piel', 1), null);
      assert.equal(await c.modulo('piel', 0), null);
      assert.equal(await c.modulo('piel', 3), null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('el catálogo real en disco carga 5 programas y cada módulo existente coincide con su título', async () => {
    const c = new DiskAcademiaContentStore();
    const { programas } = await c.catalogo();
    assert.equal(programas.length, 5);
    assert.equal(new Set(programas.map((p) => p.id)).size, 5);
    const AREAS = new Set(['Ciencia de la piel', 'Cosmetología', 'Estética facial', 'Práctica profesional']);
    for (const p of programas) {
      assert.ok(p.titulo && AREAS.has(p.area ?? ''), `${p.id}: título y área conocida`);
      assert.ok(p.modulos.length > 0, `${p.id}: tiene módulos`);
      assert.deepEqual(p.modulos.map((m) => m.n), p.modulos.map((_, i) => i + 1), `${p.id}: módulos consecutivos`);
      for (const mm of p.modulos) {
        // Los redactores pueden estar escribiendo ahora mismo: un archivo que falta no es un error.
        const m = await c.modulo(p.id, mm.n);
        if (!m) continue;
        assert.equal(m.titulo, mm.titulo, `${p.id}/modulo-${nn(mm.n)}: el título coincide con el catálogo`);
        assert.equal(m.programa, p.id, `${p.id}/modulo-${nn(mm.n)}: programa`);
        assert.equal(m.modulo, mm.n, `${p.id}/modulo-${nn(mm.n)}: número`);
      }
    }
  });
});
