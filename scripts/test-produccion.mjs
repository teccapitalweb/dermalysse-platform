// Pruebas de la lógica pura del modo producción (sin red ni navegador).
// Node 22.18+/24 ejecuta los .ts importados quitando los tipos (sin compilar).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearReportadorProgreso, normalizarPosicion, leerMensajePlayerJs, mensajePlayerJs, clasificarBloqueo, INTERVALO_PROGRESO_MS,
} from '../src/core/video-progreso.ts';
import { hashVerificacionLegada, busquedaSinCodigo, normalizarFolio, esFolioDermalysse, anioFolio } from '../src/core/legado.ts';

function reloj(inicio = 1_000_000) {
  let t = inicio;
  return { ahora: () => t, avanzar: (ms) => { t += ms; } };
}

function reportadorDePrueba(opciones = {}) {
  const r = reloj();
  const enviados = [];
  const resultados = [];
  let resolver = null;
  const rep = crearReportadorProgreso({
    ahora: r.ahora,
    enviar: (evento, posicion) => {
      enviados.push({ evento, ...posicion });
      if (opciones.manual) return new Promise((ok) => { resolver = ok; });
      return Promise.resolve({ completada: false, evento });
    },
    alResultado: (res, evento) => resultados.push(evento),
    ...opciones,
  });
  return { rep, r, enviados, resultados, liberar: (v = { completada: false }) => { const f = resolver; resolver = null; f?.(v); } };
}

test('timeupdate se limita a un envío cada ~15 s', async () => {
  const { rep, r, enviados } = reportadorDePrueba();
  assert.equal(INTERVALO_PROGRESO_MS, 15_000);
  assert.equal(rep.evento('timeupdate', { seconds: 1, duration: 600 }), true);
  await rep.esperar();
  for (let s = 2; s <= 15; s++) { r.avanzar(1000); assert.equal(rep.evento('timeupdate', { seconds: s, duration: 600 }), false); }
  r.avanzar(1000);
  assert.equal(rep.evento('timeupdate', { seconds: 16, duration: 600 }), true);
  await rep.esperar();
  assert.deepEqual(enviados.map((e) => [e.evento, e.seconds]), [['timeupdate', 1], ['timeupdate', 16]]);
});

test('sin duración conocida no se reporta nada', () => {
  const { rep, enviados } = reportadorDePrueba();
  assert.equal(rep.evento('timeupdate', { seconds: 5 }), false);
  assert.equal(rep.evento('pause'), false);
  assert.equal(enviados.length, 0);
});

test('pause solo se envía si hay posición nueva; ended siempre y al final del video', async () => {
  const { rep, r, enviados } = reportadorDePrueba();
  rep.evento('timeupdate', { seconds: 10, duration: 300 });
  await rep.esperar();
  assert.equal(rep.evento('pause'), false, 'la pausa no repite una posición ya enviada');
  r.avanzar(2000);
  rep.evento('timeupdate', { seconds: 12, duration: 300 });
  assert.equal(rep.evento('pause'), true);
  await rep.esperar();
  assert.equal(rep.evento('ended', { seconds: 297, duration: 300 }), true);
  await rep.esperar();
  assert.deepEqual(enviados.map((e) => [e.evento, e.seconds, e.duration]), [['timeupdate', 10, 300], ['pause', 12, 300], ['ended', 300, 300]]);
});

test('con un envío en curso, timeupdate se descarta y ended se encola con prioridad', async () => {
  const { rep, r, enviados, liberar } = reportadorDePrueba({ manual: true });
  rep.evento('timeupdate', { seconds: 100, duration: 200 });
  r.avanzar(20_000);
  assert.equal(rep.evento('timeupdate', { seconds: 120, duration: 200 }), false, 'nunca dos envíos a la vez');
  assert.equal(rep.evento('pause'), true);
  assert.equal(rep.evento('ended'), true);
  assert.equal(enviados.length, 1);
  liberar();
  await new Promise((ok) => setTimeout(ok, 0));
  assert.deepEqual(enviados.map((e) => e.evento), ['timeupdate', 'ended']);
  liberar();
});

test('detener reporta la última posición pendiente y luego ignora eventos', async () => {
  const { rep, r, enviados } = reportadorDePrueba();
  rep.evento('timeupdate', { seconds: 30, duration: 90 });
  await rep.esperar();
  r.avanzar(3000);
  rep.evento('timeupdate', { seconds: 33, duration: 90 });
  assert.equal(rep.detener(), true);
  await rep.esperar();
  assert.equal(rep.evento('ended', { seconds: 90, duration: 90 }), false);
  assert.deepEqual(enviados.map((e) => [e.evento, e.seconds]), [['timeupdate', 30], ['pause', 33]]);
});

test('normalizarPosicion acepta texto numérico y conserva la duración anterior', () => {
  assert.deepEqual(normalizarPosicion({ seconds: '12.5', duration: '100' }), { seconds: 12.5, duration: 100 });
  assert.deepEqual(normalizarPosicion({ seconds: 20 }, { seconds: 10, duration: 50 }), { seconds: 20, duration: 50 });
  assert.deepEqual(normalizarPosicion({ seconds: 80, duration: 60 }), { seconds: 60, duration: 60 });
  assert.equal(normalizarPosicion(undefined), null);
  assert.equal(normalizarPosicion({ seconds: -1, duration: 10 }), null);
});

test('mensajes player.js: lectura estricta y envío con el formato de la librería', () => {
  assert.deepEqual(leerMensajePlayerJs('{"context":"player.js","version":"0.0.11","event":"timeupdate","value":{"seconds":3,"duration":9},"listener":"drm-timeupdate"}'),
    { event: 'timeupdate', value: { seconds: 3, duration: 9 }, listener: 'drm-timeupdate' });
  assert.deepEqual(leerMensajePlayerJs({ context: 'player.js', event: 'ready', value: {} }), { event: 'ready', value: {}, listener: undefined });
  assert.equal(leerMensajePlayerJs('{"context":"otro","event":"ready"}'), null);
  assert.equal(leerMensajePlayerJs('no es json player.js'), null);
  assert.equal(leerMensajePlayerJs({ event: 'ready' }), null);
  assert.deepEqual(JSON.parse(mensajePlayerJs('addEventListener', 'ended', 'drm-ended')),
    { context: 'player.js', version: '0.0.11', method: 'addEventListener', value: 'ended', listener: 'drm-ended' });
  assert.deepEqual(JSON.parse(mensajePlayerJs('play')), { context: 'player.js', version: '0.0.11', method: 'play' });
});

test('403 de /video/token se traduce a estados honestos', () => {
  assert.equal(clasificarBloqueo(403, { motivo: 'membership_required' }).tipo, 'membresia');
  assert.equal(clasificarBloqueo(402, { error: 'requiere_vip' }).tipo, 'membresia');
  assert.deepEqual(clasificarBloqueo(403, { motivo: 'previous_lesson_required' }, 4), { tipo: 'clase_anterior', clase: 3 });
  assert.equal(clasificarBloqueo(403, { motivo: 'clase_anterior', desbloqueo: { n: 2 } }, 5).clase, 2);
  const programado = clasificarBloqueo(403, { motivo: 'scheduled_locked', desbloqueo: '2026-11-02T00:00:00.000Z' });
  assert.equal(programado.tipo, 'no_liberado');
  assert.equal(programado.fecha, '2026-11-02T00:00:00.000Z');
  assert.equal(clasificarBloqueo(403, { motivo: 'drip_locked', desbloqueo: { unlockAt: Date.UTC(2026, 10, 9), daysLeft: 3.2 } }).dias, 4);
  // Mensajes del webhook actual (texto): «no liberado para tu membresía» no debe pedir pago.
  assert.equal(clasificarBloqueo(403, { error: 'Este curso todavía no se ha liberado para tu membresía' }).tipo, 'no_liberado');
  assert.equal(clasificarBloqueo(403, { error: 'Completa la clase anterior antes de continuar' }, 2).tipo, 'clase_anterior');
  assert.equal(clasificarBloqueo(401, {}).tipo, 'sesion');
  assert.equal(clasificarBloqueo(404, {}).tipo, 'sin_video');
  assert.equal(clasificarBloqueo(500, { mensaje: 'Falla temporal del servidor' }).mensaje, 'Falla temporal del servidor');
});

test('?code= del verify.html actual lleva a #/verificar/:folio', () => {
  assert.equal(hashVerificacionLegada('?code=drml-2026-0a1b2c3d4e5f', ''), '#/verificar/DRML-2026-0A1B2C3D4E5F');
  assert.equal(hashVerificacionLegada('?code=DRML-2026-0A1B2C3D4E5F', '#/'), '#/verificar/DRML-2026-0A1B2C3D4E5F');
  assert.equal(hashVerificacionLegada('?code=DRML-2026-0A1B2C3D4E5F', '#/cursos'), null, 'no secuestra otras rutas');
  assert.equal(hashVerificacionLegada('?code=%3Cscript%3E', ''), null, 'rechaza folios con caracteres no válidos');
  assert.equal(hashVerificacionLegada('', ''), null);
  assert.equal(busquedaSinCodigo('?code=DRML-2026-0A1B2C3D4E5F&utm_source=qr'), '?utm_source=qr');
  assert.equal(busquedaSinCodigo('?code=X'), '');
});

test('formato de folio DRML-YYYY-XXXXXXXXXXXX', () => {
  assert.equal(normalizarFolio('  drml-2026-abcdef012345 '), 'DRML-2026-ABCDEF012345');
  assert.ok(esFolioDermalysse('DRML-2026-ABCDEF012345'));
  assert.ok(!esFolioDermalysse('DRML-2026-ABCDEF01234'));
  assert.ok(!esFolioDermalysse('DRM-2026-00001'));
  assert.equal(anioFolio('DRML-2027-ABCDEF012345'), '2027');
  assert.equal(anioFolio('DRM-2026-00001'), '2026');
  assert.equal(normalizarFolio('a/b'), null);
});
