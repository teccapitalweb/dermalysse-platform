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
  estado?: 'error' | 'sin-acceso';
}

let cache: ResumenLiga | null = null;
let carga: Promise<ResumenLiga> | null = null;

function vacio(estado?: ResumenLiga['estado']): ResumenLiga {
  return { actualizado: '', participantes: 0, clasificacion: [], yo: null, esDemo: false, estado };
}

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
  resumen(): ResumenLiga { return cache || (Datos.modo === 'demo' ? demo() : vacio(Auth.usuario ? undefined : 'sin-acceso')); },
  cargando() { return Datos.modo === 'api' && !!Auth.usuario && !cache; },
  async cargar(): Promise<ResumenLiga> {
    if (Datos.modo === 'demo') return (cache = demo());
    if (!Auth.usuario) return vacio('sin-acceso');
    if (cache) return cache;
    if (!carga) carga = api<ResumenLiga>('/liga').then((r) => {
      if (!r || !Array.isArray(r.clasificacion)) return (cache = vacio('error'));
      if (r.clasificacion.length === 0) return (cache = vacio());
      return (cache = { ...r, participantes: Number.isFinite(r.participantes) ? r.participantes : r.clasificacion.length, esDemo: false });
    }).catch(() => (cache = vacio('error'))).finally(() => { carga = null; });
    return carga;
  },
  limpiar() { cache = null; carga = null; },
};
