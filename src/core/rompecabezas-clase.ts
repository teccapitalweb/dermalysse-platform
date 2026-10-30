import rompecabezasJson from '../data/rompecabezas-clase.json';

export interface RompecabezasClase {
  id: string;
  cursoId: string;
  claseN: number;
  titulo: string;
  descripcion: string;
  imagen: string;
  alt: string;
  cierre: string;
}

export interface MarcaRompecabezas {
  completadoEn: string;
  mejorMovimientos: number;
  mejorSegundos: number;
  vecesCompletado: number;
}

const ROMPECABEZAS = rompecabezasJson as RompecabezasClase[];
const STORAGE_PREFIX = 'dermalysse:rompecabezas-clase:v1';

const claveUsuario = (uid: string) => `${STORAGE_PREFIX}:${uid || 'anonimo'}`;

function leerMarcas(uid: string): Record<string, MarcaRompecabezas> {
  try {
    return JSON.parse(localStorage.getItem(claveUsuario(uid)) || '{}') as Record<string, MarcaRompecabezas>;
  } catch {
    return {};
  }
}

export function rompecabezasDeClase(cursoId: string, claseN: number) {
  return ROMPECABEZAS.find((item) => item.cursoId === cursoId && item.claseN === claseN) ?? null;
}

export function marcaRompecabezas(uid: string, id: string) {
  return leerMarcas(uid)[id] ?? null;
}

export function registrarRompecabezasCompletado(uid: string, id: string, movimientos: number, segundos: number) {
  const marcas = leerMarcas(uid);
  const anterior = marcas[id];
  const nueva: MarcaRompecabezas = {
    completadoEn: new Date().toISOString(),
    mejorMovimientos: anterior ? Math.min(anterior.mejorMovimientos, movimientos) : movimientos,
    mejorSegundos: anterior ? Math.min(anterior.mejorSegundos, segundos) : segundos,
    vecesCompletado: (anterior?.vecesCompletado ?? 0) + 1,
  };
  marcas[id] = nueva;
  try { localStorage.setItem(claveUsuario(uid), JSON.stringify(marcas)); } catch { /* La práctica sigue funcionando sin almacenamiento. */ }
  return nueva;
}
