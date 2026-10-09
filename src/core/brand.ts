// Datos de marca y contacto de Dermalysse. Los editables (precios, descuento y WhatsApp) vienen de Ajustes del admin.
import { Datos } from './datos';

export const BRAND = {
  nombre: 'Dermalysse',
  club: 'Club Dermalysse',
  sitio: 'https://www.dermalyssemx.com',
  praxia: 'https://app.praxiamedical.com/?utm_source=dermalysse-club&utm_medium=panel',
  whatsappSoporte: '',
  canalWhatsApp: '',
  descuentoVIP: 20,
  planes: [] as { id: 'mensual' | 'anual'; nombre: string; precio: number; periodo: string; ahorro?: string }[],
};

function aplicarConfig() {
  const c = Datos.config();
  BRAND.whatsappSoporte = c.whatsappSoporte;
  BRAND.canalWhatsApp = c.canalWhatsApp;
  BRAND.descuentoVIP = c.descuentoVIP;
  const ahorro = c.precioMensual * 12 - c.precioAnual;
  BRAND.planes = c.precioMensual > 0 && c.precioAnual > 0 ? [
    { id: 'mensual', nombre: 'VIP Mensual', precio: c.precioMensual, periodo: 'mes' },
    { id: 'anual', nombre: 'VIP Anual', precio: c.precioAnual, periodo: 'año', ahorro: ahorro > 0 ? `Ahorras $${ahorro.toLocaleString('es-MX')} al año` : undefined },
  ] : [];
}
aplicarConfig();
window.addEventListener('datos:cambio', aplicarConfig);

export const wa = (texto: string, num = BRAND.whatsappSoporte) => num ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}` : '#/configuracion';
