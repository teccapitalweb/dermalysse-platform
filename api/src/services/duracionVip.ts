// Duraciones de acceso VIP que usan recompensas y cupones (mismas claves que el cliente:
// src/pages/recompensas.ts y src/admin/cupones.ts). «1 mes» = 30 días, «1 año» = 365 días.
import { diasVipValidos } from './vip.js';

export const DURACIONES_VIP = { '15d': 15, '1m': 30, '3m': 90, '1y': 365 } as const;

export type DuracionVip = keyof typeof DURACIONES_VIP | 'personalizada';

export function esDuracionVip(v: unknown): v is DuracionVip {
  return v === 'personalizada' || (typeof v === 'string' && Object.prototype.hasOwnProperty.call(DURACIONES_VIP, v));
}

/** Días efectivos de una duración; null si la duración o los días personalizados no son válidos. */
export function diasDeDuracion(duracion: unknown, dias: unknown): number | null {
  if (duracion === 'personalizada') return diasVipValidos(dias) ? dias : null;
  if (esDuracionVip(duracion)) return DURACIONES_VIP[duracion as keyof typeof DURACIONES_VIP];
  return null;
}
