// Estado de la plataforma (GET /config): mantenimiento y registro abierto.
// Fuente: `config/platform{maintenance, openRegistration}` del club actual, expuesto por la API.
// En demo no hay servidor: el club siempre está abierto y el registro también.
import { api } from './auth';
import { Datos } from './datos';

export interface EstadoPlataforma {
  mantenimiento: boolean;
  registroAbierto: boolean;
  /** true cuando la respuesta vino del servidor; false si se usan los valores por omisión. */
  confirmado: boolean;
}

interface ConfigRemota {
  mantenimiento?: unknown;
  registroAbierto?: unknown;
  precios?: { mensual?: unknown; anual?: unknown };
}

const ABIERTO: EstadoPlataforma = { mantenimiento: false, registroAbierto: true, confirmado: false };
const VIGENCIA_MS = 60_000;

let estado: EstadoPlataforma = { ...ABIERTO };
let leidoEn = 0;
let carga: Promise<EstadoPlataforma> | null = null;

/** Interpreta la respuesta de /config. El registro solo se cierra con un `false` explícito. */
export function normalizarPlataforma(raw: ConfigRemota | null | undefined): EstadoPlataforma {
  return {
    mantenimiento: raw?.mantenimiento === true,
    registroAbierto: raw?.registroAbierto !== false,
    confirmado: !!raw,
  };
}

export function plataforma(): EstadoPlataforma { return estado; }

export async function cargarPlataforma(forzar = false): Promise<EstadoPlataforma> {
  if (Datos.modo !== 'api') return { ...ABIERTO, confirmado: true };
  if (!forzar && leidoEn && Date.now() - leidoEn < VIGENCIA_MS) return estado;
  if (carga) return carga;
  carga = api<ConfigRemota>('/config')
    .then((raw) => {
      estado = normalizarPlataforma(raw);
      leidoEn = Date.now();
      // Los precios también viven en /config; solo se usan si el catálogo aún no los trajo.
      const actual = Datos.config();
      const mensual = Number(raw?.precios?.mensual) || 0;
      const anual = Number(raw?.precios?.anual) || 0;
      if ((!actual.precioMensual && mensual) || (!actual.precioAnual && anual)) {
        Datos.hidratarAdmin('config', { ...actual, precioMensual: actual.precioMensual || mensual, precioAnual: actual.precioAnual || anual });
      }
      return estado;
    })
    // Si /config falla no se inventa un cierre: el servidor sigue validando registro y acceso.
    .catch(() => estado)
    .finally(() => { carga = null; });
  return carga;
}
