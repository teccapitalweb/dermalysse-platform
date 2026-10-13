// Seam de pagos REALES (Stripe). NO implementado en este slice.
// Las operaciones de pago (checkout, portal, webhook, estado de suscripción) solo deben
// ocurrir en el servidor con STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET provistos por entorno.
import { NotImplementedError } from '../interfaces.js';

export interface PaymentGateway {
  crearCheckout(uid: string): Promise<{ url: string }>;
  estadoSuscripcion(uid: string): Promise<{ esVip: boolean; plan: string | null; vence: string | null }>;
}

export class StripeGatewayStub implements PaymentGateway {
  async crearCheckout(_uid: string): Promise<{ url: string }> {
    throw new NotImplementedError('Stripe Checkout. Requiere STRIPE_SECRET_KEY por entorno.');
  }
  async estadoSuscripcion(_uid: string): Promise<{ esVip: boolean; plan: string | null; vence: string | null }> {
    throw new NotImplementedError('consulta de suscripción en Stripe/almacén de membresía.');
  }
}
