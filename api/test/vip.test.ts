import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryFirestore } from '../src/adapters/firestore/memoria.js';
import { extenderVigencia, otorgarDiasVip, diasVipValidos, COLECCION_BITACORA_VIP } from '../src/services/vip.js';

const AHORA = new Date('2026-10-15T12:00:00.000Z');
const DIA = 86_400_000;

test('extenderVigencia — sin cortesía vigente: desde ahora y regaloDesde arranca hoy', () => {
  const r = extenderVigencia({ vigenciaHasta: '2026-01-01T00:00:00.000Z', regaloDesde: '2025-12-01T00:00:00.000Z' }, 7, AHORA);
  assert.equal(r.vigenciaHasta, new Date(AHORA.getTime() + 7 * DIA).toISOString());
  assert.equal(r.regaloDesde, AHORA.toISOString());
});

test('extenderVigencia — con cortesía vigente: se suma a su fecha y conserva regaloDesde', () => {
  const r = extenderVigencia({ vigenciaHasta: '2026-11-01T00:00:00.000Z', regaloDesde: '2026-10-01T00:00:00.000Z' }, 15, AHORA);
  assert.equal(r.vigenciaHasta, new Date(Date.parse('2026-11-01T00:00:00.000Z') + 15 * DIA).toISOString());
  assert.equal(r.regaloDesde, '2026-10-01T00:00:00.000Z');
});

test('otorgarDiasVip — merge sin tocar subscription y deja bitácora', async () => {
  const db = new MemoryFirestore();
  db.sembrar('users/u1', { name: 'Ana', subscription: { status: 'active', plan: 'anual' } });
  const r = await otorgarDiasVip(db, { uid: 'u1', dias: 30, fuente: 'cupon', referencia: 'BIENVENIDA30' }, AHORA);
  const u = (await db.get('users/u1')).data()!;
  assert.deepEqual(u.subscription, { status: 'active', plan: 'anual' });
  assert.equal(u.name, 'Ana');
  assert.equal(u.vigenciaHasta, r.vigenciaHasta);
  const bit = await db.query(COLECCION_BITACORA_VIP);
  assert.equal(bit.length, 1);
  assert.equal(bit[0].data()!.referencia, 'BIENVENIDA30');
  assert.equal(bit[0].data()!.antes, null);
});

test('diasVipValidos — enteros de 1 a 366', () => {
  assert.ok(diasVipValidos(1) && diasVipValidos(366));
  assert.ok(!diasVipValidos(0) && !diasVipValidos(367) && !diasVipValidos(1.5) && !diasVipValidos('7'));
});
