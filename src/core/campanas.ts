import { api } from './auth';
import { Datos } from './datos';
import { acreditarCampanaDemo } from './puntos';

export type EstadoCampana = 'activa' | 'pausada' | 'agotada' | 'terminada';

export interface BeneficioManualCampana {
  id: string;
  nombre: string;
  descripcion: string;
  instrucciones: string;
  responsable: string;
}

export interface BeneficiosCampana {
  diamantes: number;
  vipDias: number;
  materiales: { id: string; nombre: string }[];
  manuales: BeneficioManualCampana[];
}

export interface CanjeCampana {
  id: string;
  campanaId: string;
  estado: 'pendiente' | 'entregado' | 'cancelado';
  solicitadoEn: string;
  emitidoEn: string | null;
  activadoEn: string | null;
  beneficios: BeneficiosCampana;
  manuales: (BeneficioManualCampana & { estado: 'pendiente' | 'entregado' | 'cancelado'; entregadoEn: string | null })[];
}

export interface CampanaMiembro {
  id: string;
  nombre: string;
  descripcion: string;
  estado: EstadoCampana;
  cupoTotal: number;
  lugaresRestantes: number;
  inicio: string;
  fin: string;
  beneficios: BeneficiosCampana;
  canje: CanjeCampana | null;
  pospuestaHasta: string | null;
  debeMostrar: boolean;
}

const BENEFICIOS_DEMO: BeneficiosCampana = {
  diamantes: 750,
  vipDias: 7,
  materiales: [
    { id: 'p-1784228079707', nombre: 'Regulación cosmética' },
    { id: 'p-1784228150217', nombre: 'Estudios de estabilidad cosmética' },
  ],
  manuales: [],
};

let demoCanje: CanjeCampana | null = null;
let demoPospuesta: string | null = null;
let cache: { campana: CampanaMiembro; en: number } | null = null;
let pendiente: Promise<CampanaMiembro> | null = null;

function campanaDemo(): CampanaMiembro {
  const pospuesta = !!demoPospuesta && Date.parse(demoPospuesta) > Date.now();
  return {
    id: 'bienvenida-dermalysse-50',
    nombre: 'Bienvenida Dermalysse · Primera Edición',
    descripcion: 'Un paquete digital de bienvenida para las primeras 50 cuentas que canjeen el código oficial.',
    estado: 'activa',
    cupoTotal: 50,
    lugaresRestantes: demoCanje ? 49 : 50,
    inicio: '2026-10-28T06:00:00.000Z',
    fin: '2027-01-01T05:59:59.999Z',
    beneficios: BENEFICIOS_DEMO,
    canje: demoCanje,
    pospuestaHasta: demoPospuesta,
    debeMostrar: !demoCanje && !pospuesta,
  };
}

export function invalidarCampanaBienvenida() {
  cache = null;
  pendiente = null;
}

export async function cargarCampanaBienvenida(forzar = false): Promise<CampanaMiembro> {
  if (Datos.modo === 'demo') return campanaDemo();
  if (!forzar && cache && Date.now() - cache.en < 120_000) return cache.campana;
  if (pendiente) return pendiente;
  pendiente = api<CampanaMiembro>('/campanas/bienvenida').then((campana) => {
    cache = { campana, en: Date.now() };
    return campana;
  }).finally(() => { pendiente = null; });
  return pendiente;
}

export async function posponerCampanaBienvenida(id: string): Promise<string> {
  if (Datos.modo === 'demo') {
    demoPospuesta = new Date(Date.now() + 7 * 86_400_000).toISOString();
    invalidarCampanaBienvenida();
    return demoPospuesta;
  }
  const r = await api<{ ok: true; pospuestaHasta: string }>(`/campanas/${encodeURIComponent(id)}/posponer`, { method: 'POST' });
  invalidarCampanaBienvenida();
  return r.pospuestaHasta;
}

export async function canjearCampanaBienvenida(codigo: string): Promise<CampanaMiembro> {
  if (Datos.modo === 'demo') {
    if (codigo.trim().toUpperCase() !== 'DERMALYSSE50') throw new Error('El código no corresponde a una campaña vigente.');
    if (demoCanje) throw new Error('Esta cuenta ya recibió el beneficio de la campaña.');
    const ahora = new Date().toISOString();
    demoCanje = {
      id: 'demo-bienvenida', campanaId: 'bienvenida-dermalysse-50', estado: 'entregado', solicitadoEn: ahora,
      emitidoEn: ahora, activadoEn: ahora, beneficios: BENEFICIOS_DEMO, manuales: [],
    };
    acreditarCampanaDemo(BENEFICIOS_DEMO.diamantes, 'Bienvenida Dermalysse · Primera Edición', ahora);
    demoPospuesta = null;
    invalidarCampanaBienvenida();
    return campanaDemo();
  }
  const r = await api<{ ok: true; campana: CampanaMiembro }>('/campanas/canjear', { method: 'POST', json: { codigo } });
  cache = { campana: r.campana, en: Date.now() };
  return r.campana;
}
