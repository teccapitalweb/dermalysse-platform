// Regla de acceso: port literal de dermalysse-webhook/access-policy.js. Cada rama.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasCurrentMembership, membershipAccess, resumenAcceso, toTimestamp } from '../src/adapters/firebase/accessPolicy.js';

const AHORA = Date.parse('2026-10-15T12:00:00.000Z');
const FUTURO = '2026-12-01T00:00:00.000Z';
const PASADO = '2026-09-01T00:00:00.000Z';

test('toTimestamp: vacío ⇒ NaN; Timestamp (toDate/toMillis) e ISO', () => {
  assert.ok(Number.isNaN(toTimestamp(undefined)));
  assert.ok(Number.isNaN(toTimestamp('')));
  assert.equal(toTimestamp({ toDate: () => new Date(FUTURO) }), Date.parse(FUTURO));
  assert.equal(toTimestamp({ toMillis: () => 123 }), 123);
  assert.equal(toTimestamp(FUTURO), Date.parse(FUTURO));
});

test('1. cortesía: vigenciaHasta en el futuro ⇒ courtesy (aunque no haya suscripción)', () => {
  const r = membershipAccess({ vigenciaHasta: FUTURO }, AHORA);
  assert.deepEqual(r, { allowed: true, reason: 'courtesy', expiresAt: Date.parse(FUTURO) });
});

test('1b. cortesía vencida no da acceso por sí sola: sigue a la suscripción', () => {
  assert.equal(membershipAccess({ vigenciaHasta: PASADO }, AHORA).reason, 'none');
  assert.equal(membershipAccess({ vigenciaHasta: PASADO, subscription: { status: 'active' } }, AHORA).reason, 'active');
});

test('2. active / trialing: sin currentPeriodEnd ⇒ acceso; futuro ⇒ acceso; pasado ⇒ expired', () => {
  assert.deepEqual(membershipAccess({ subscription: { status: 'active' } }, AHORA).allowed, true);
  assert.equal(membershipAccess({ subscription: { status: 'active' } }, AHORA).reason, 'active');
  assert.equal(membershipAccess({ subscription: { status: 'trialing', currentPeriodEnd: FUTURO } }, AHORA).reason, 'trialing');
  const vencida = membershipAccess({ subscription: { status: 'active', currentPeriodEnd: PASADO } }, AHORA);
  assert.deepEqual([vencida.allowed, vencida.reason], [false, 'expired']);
  // El estado se normaliza a minúsculas, como en el webhook.
  assert.equal(membershipAccess({ subscription: { status: 'ACTIVE', currentPeriodEnd: FUTURO } }, AHORA).allowed, true);
});

test('3. canceled o cancelAtPeriodEnd con currentPeriodEnd futuro ⇒ canceling; pasado ⇒ expired', () => {
  assert.equal(membershipAccess({ subscription: { status: 'canceled', currentPeriodEnd: FUTURO } }, AHORA).reason, 'canceling');
  assert.equal(membershipAccess({ subscription: { status: 'past_due', cancelAtPeriodEnd: true, currentPeriodEnd: FUTURO } }, AHORA).reason, 'canceling');
  const r = membershipAccess({ subscription: { status: 'canceled', currentPeriodEnd: PASADO } }, AHORA);
  assert.deepEqual([r.allowed, r.reason], [false, 'expired']);
});

test('3b. canceled sin currentPeriodEnd ⇒ none (no entra en la rama 3)', () => {
  assert.deepEqual([membershipAccess({ subscription: { status: 'canceled' } }, AHORA).allowed, membershipAccess({ subscription: { status: 'canceled' } }, AHORA).reason], [false, 'none']);
});

test('4. past_due ⇒ past_due; sin datos o estado desconocido ⇒ none', () => {
  assert.equal(membershipAccess({ subscription: { status: 'past_due', currentPeriodEnd: FUTURO } }, AHORA).reason, 'past_due');
  assert.equal(membershipAccess(undefined, AHORA).reason, 'none');
  assert.equal(membershipAccess({}, AHORA).reason, 'none');
  assert.equal(membershipAccess({ subscription: { status: 'incomplete' } }, AHORA).reason, 'none');
  assert.equal(hasCurrentMembership({}, AHORA), false);
});

test('Timestamps de Firestore en vigenciaHasta y currentPeriodEnd', () => {
  const ts = (iso: string) => ({ toDate: () => new Date(iso) });
  assert.equal(membershipAccess({ vigenciaHasta: ts(FUTURO) }, AHORA).reason, 'courtesy');
  assert.equal(membershipAccess({ subscription: { status: 'active', currentPeriodEnd: ts(PASADO) } }, AHORA).reason, 'expired');
});

test('resumenAcceso: plan/vence/motivo para /me', () => {
  assert.deepEqual(resumenAcceso({ vigenciaHasta: FUTURO, subscription: { status: 'active', plan: 'anual' } }, AHORA),
    { esVip: true, plan: 'cortesia', vence: FUTURO, motivo: 'courtesy' });
  assert.deepEqual(resumenAcceso({ subscription: { status: 'active', plan: 'mensual', currentPeriodEnd: FUTURO } }, AHORA),
    { esVip: true, plan: 'mensual', vence: FUTURO, motivo: 'active' });
  assert.deepEqual(resumenAcceso({ subscription: { status: 'active', plan: 'raro' } }, AHORA),
    { esVip: true, plan: null, vence: null, motivo: 'active' });
  assert.deepEqual(resumenAcceso({ subscription: { status: 'canceled', plan: 'anual', currentPeriodEnd: PASADO } }, AHORA),
    { esVip: false, plan: null, vence: null, motivo: 'expired' });
});
