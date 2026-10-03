import { api, Auth } from './auth';
import { Datos } from './datos';
import { Perfil } from './perfil';
import { Progreso } from './progreso';
import { xpTotal } from './juegos';

export interface FilaLiga {
  puesto: number;
  nombre: string;
  foto: string;
  clases: number;
  cursos: number;
  aportes: number;
  xp: number;
  nivel: string;
  ultimaActividad: string | null;
  esYo: boolean;
}

export interface ResumenLiga {
  actualizado: string;
  participantes: number;
  clasificacion: FilaLiga[];
  yo: FilaLiga | null;
  esDemo?: boolean;
}

let cache: ResumenLiga | null = null;
let carga: Promise<ResumenLiga> | null = null;

const NIVEL = (xp: number) => xp >= 6000 ? 'Maestro' : xp >= 3000 ? 'Platino' : xp >= 1400 ? 'Oro' : xp >= 600 ? 'Plata' : xp >= 200 ? 'Bronce' : 'Aprendiz';

function demo(): ResumenLiga {
  const nombres = ['María Fernanda R.', 'José Luis M.', 'Ana Sofía P.', 'Carlos E. G.', 'Lupita N.', 'Roberto C.', 'Elena V. M.', 'Miguel A. T.'];
  const clases = [67, 58, 52, 44, 39, 31, 24, 18];
  const filas: Omit<FilaLiga, 'puesto'>[] = nombres.map((nombre, i) => {
    const cursos = Math.floor(clases[i] / 5);
    const aportes = Math.max(0, 7 - i);
    const xp = clases[i] * 10 + cursos * 50 + aportes * 5;
    return { nombre, foto: '', clases: clases[i], cursos, aportes, xp, nivel: NIVEL(xp), ultimaActividad: new Date(Date.now() - i * 86400000).toISOString(), esYo: false };
  });
  const xp = xpTotal();
  filas.push({
    nombre: Perfil.get().nombre || 'Tú',
    foto: Auth.usuario?.foto || Perfil.get().foto || '',
    clases: Progreso.totalVistas(),
    cursos: Progreso.completados().length,
    aportes: 0,
    xp,
    nivel: NIVEL(xp),
    ultimaActividad: new Date().toISOString(),
    esYo: true,
  });
  filas.sort((a, b) => b.xp - a.xp || b.cursos - a.cursos || a.nombre.localeCompare(b.nombre, 'es'));
  const clasificacion = filas.map((f, i) => ({ ...f, puesto: i + 1 }));
  return { actualizado: new Date().toISOString(), participantes: clasificacion.length, clasificacion, yo: clasificacion.find((f) => f.esYo) || null, esDemo: true };
}

export const Liga = {
  resumen(): ResumenLiga { return cache || demo(); },
  cargando() { return Datos.modo === 'api' && !cache; },
  async cargar(): Promise<ResumenLiga> {
    if (Datos.modo === 'demo' || !Auth.usuario) return (cache = demo());
    if (cache) return cache;
    if (!carga) carga = api<ResumenLiga>('/liga').then((r) => (cache = r)).catch(() => (cache = demo())).finally(() => { carga = null; });
    return carga;
  },
  limpiar() { cache = null; carga = null; },
};
