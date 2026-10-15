// Port LITERAL a TypeScript de dermalysse-webhook/access-policy.js (regla de acceso a la membresía).
// No cambiar la lógica sin cambiarla también en el webhook: ambos deben decidir lo mismo.
//  1. vigenciaHasta en el futuro ⇒ acceso ('courtesy').
//  2. status active/trialing ⇒ acceso si no hay currentPeriodEnd o si está en el futuro.
//  3. status canceled o cancelAtPeriodEnd === true, con currentPeriodEnd en el futuro ⇒ acceso ('canceling').
//  4. En otro caso, sin acceso ('past_due' o 'none'; 'expired' si venció el periodo de 2/3).

export interface AccesoMembresia {
  allowed: boolean;
  reason: 'courtesy' | 'active' | 'trialing' | 'canceling' | 'expired' | 'past_due' | 'none' | string;
  expiresAt: number;
}

export function toTimestamp(value: unknown): number {
  if (!value) return NaN;
  const v = value as { toDate?: () => Date; toMillis?: () => number };
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v.toMillis === 'function') return v.toMillis();
  return Date.parse(value as string);
}

export function membershipAccess(userData: unknown, nowValue?: number): AccesoMembresia {
  const data = (userData || {}) as { vigenciaHasta?: unknown; subscription?: Record<string, unknown> };
  const now = Number.isFinite(nowValue) ? (nowValue as number) : Date.now();
  const courtesyUntil = toTimestamp(data.vigenciaHasta);
  if (Number.isFinite(courtesyUntil) && courtesyUntil > now) {
    return { allowed: true, reason: 'courtesy', expiresAt: courtesyUntil };
  }

  const subscription = data.subscription || {};
  const status = String(subscription.status || 'none').toLowerCase();
  const periodEnd = toTimestamp(subscription.currentPeriodEnd);
  if (status === 'active' || status === 'trialing') {
    const allowed = !Number.isFinite(periodEnd) || periodEnd > now;
    return { allowed, reason: allowed ? status : 'expired', expiresAt: periodEnd };
  }
  if ((status === 'canceled' || subscription.cancelAtPeriodEnd === true) && Number.isFinite(periodEnd)) {
    const allowed = periodEnd > now;
    return { allowed, reason: allowed ? 'canceling' : 'expired', expiresAt: periodEnd };
  }
  return { allowed: false, reason: status === 'past_due' ? 'past_due' : 'none', expiresAt: periodEnd };
}

export function hasCurrentMembership(userData: unknown, nowValue?: number): boolean {
  return membershipAccess(userData, nowValue).allowed;
}

export type PlanAcceso = 'mensual' | 'anual' | 'cortesia' | null;

/** Plan y vencimiento que expone /me a partir de la regla anterior (no cambia la decisión de acceso). */
export function resumenAcceso(userData: unknown, nowValue?: number): { esVip: boolean; plan: PlanAcceso; vence: string | null; motivo: string } {
  const acceso = membershipAccess(userData, nowValue);
  const vence = Number.isFinite(acceso.expiresAt) ? new Date(acceso.expiresAt).toISOString() : null;
  if (!acceso.allowed) return { esVip: false, plan: null, vence: null, motivo: acceso.reason };
  if (acceso.reason === 'courtesy') return { esVip: true, plan: 'cortesia', vence, motivo: acceso.reason };
  const planCrudo = String(((userData || {}) as { subscription?: { plan?: unknown } }).subscription?.plan || '').toLowerCase();
  const plan: PlanAcceso = planCrudo === 'mensual' || planCrudo === 'anual' ? planCrudo : null;
  return { esVip: true, plan, vence, motivo: acceso.reason };
}
