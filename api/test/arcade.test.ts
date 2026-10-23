// Oráculo cerrado del arcade: fallar NO revela la respuesta correcta ni la
// explicación. Regresión del hallazgo de seguridad: antes del fix un jugador
// podía responder mal, aprender la correcta del response, y en una partida/día
// siguiente ganar XP acertando con esa información.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearArcade, type Item, type Store } from '../src/services/arcade.js';

const PREGUNTA: Item = {
  id: 'p1', tipo: 'pregunta', estado: 'aprobado', gratis: true,
  revision: { responsable: 'Dra. Prueba', fecha: '2026-01-01' },
  contenido: { q: '¿Pigmento más común?', opciones: ['Carotenos', 'Melanina', 'Lipofuscina'], correcta: 1, explicacion: 'La melanina domina.' },
};
const CASO: Item = {
  id: 'c1', tipo: 'caso', estado: 'aprobado', gratis: true,
  revision: { responsable: 'Dra. Prueba', fecha: '2026-01-01' },
  contenido: {
    titulo: 'Mancha', paciente: '', presentacion: '', hallazgos: ['x'],
    diagnostico: { q: '¿Dx?', opciones: ['A','B','C'], correcta: 2, explicacion: 'Es C.' },
    plan: { q: '¿Plan?', opciones: ['x','y'], correcta: 0, explicacion: 'Es x.' },
  },
};

function fakeStore(items: Item[]): Store {
  const docs = new Map<string, any>();
  return {
    async banco() { return items; },
    async get(path: string) { return docs.get(path); },
    async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      const writes: Array<[string, any]> = [];
      const tx = {
        async get(path: string) { return docs.get(path); },
        set(path: string, data: any) { writes.push([path, data]); },
      };
      const result = await fn(tx);
      for (const [path, data] of writes) docs.set(path, data);
      return result;
    },
  };
}

test('arcade.responder — quiz fallido NO revela correcta ni explicación', async () => {
  const svc = crearArcade(fakeStore([PREGUNTA]), () => new Date('2026-10-21T12:00:00Z'));
  const resFallo = await svc.responder('u1', true, { id: 'p1', operacion: 'op-mal', tipo: 'quiz', respuesta: 0, partida: 'part-1' });
  assert.equal(resFallo.acertada, false);
  assert.equal(resFallo.correcta, -1);
  assert.equal(resFallo.explicacion, '');
});

test('arcade.responder — quiz acertado SÍ revela correcta y explicación', async () => {
  const svc = crearArcade(fakeStore([PREGUNTA]), () => new Date('2026-10-21T12:00:00Z'));
  const res = await svc.responder('u1', true, { id: 'p1', operacion: 'op-bien', tipo: 'quiz', respuesta: 1, partida: 'part-1' });
  assert.equal(res.acertada, true);
  assert.equal(res.correcta, 1);
  assert.equal(res.explicacion, 'La melanina domina.');
});

test('arcade.responder — caso: fallar una fase no filtra la correcta para reintentar', async () => {
  const svc = crearArcade(fakeStore([CASO]), () => new Date('2026-10-21T12:00:00Z'));
  const falla = await svc.responder('u1', true, { id: 'c1', operacion: 'op-c1', tipo: 'caso', respuesta: 0, fase: 'diagnostico' });
  assert.equal(falla.acertada, false);
  assert.equal(falla.correcta, -1);
  assert.equal(falla.explicacion, '');
});
