export interface ProgresoHistoria {
  completados: string[];
  puntajes: Record<string, number>;
  ultimoNivel: string;
  actualizado: string;
}

const PREFIX = 'dermalysse:historia:v2:';
const vacio = (): ProgresoHistoria => ({ completados: [], puntajes: {}, ultimoNivel: '', actualizado: '' });
let usuarioActivo = 'local';
const llave = () => PREFIX + usuarioActivo;

function normalizar(valor: Partial<ProgresoHistoria> | null | undefined): ProgresoHistoria {
  const puntajes: Record<string, number> = {};
  Object.entries(valor?.puntajes || {}).forEach(([id, puntos]) => {
    if (Number.isFinite(puntos)) puntajes[id] = Math.max(0, Math.min(100, Math.round(puntos)));
  });
  return {
    completados: Array.isArray(valor?.completados) ? [...new Set(valor.completados.filter((id): id is string => typeof id === 'string'))] : [],
    puntajes,
    ultimoNivel: typeof valor?.ultimoNivel === 'string' ? valor.ultimoNivel : '',
    actualizado: typeof valor?.actualizado === 'string' ? valor.actualizado : '',
  };
}

function leer(storageKey: string) {
  try { return normalizar(JSON.parse(localStorage.getItem(storageKey) || '{}')); }
  catch { return vacio(); }
}

function combinar(...fuentes: ProgresoHistoria[]): ProgresoHistoria {
  const validas = fuentes.map(normalizar);
  const puntajes: Record<string, number> = {};
  validas.forEach((fuente) => Object.entries(fuente.puntajes).forEach(([id, valor]) => { puntajes[id] = Math.max(puntajes[id] || 0, valor); }));
  const recientes = [...validas].sort((a, b) => a.actualizado.localeCompare(b.actualizado));
  return {
    completados: [...new Set(validas.flatMap((fuente) => fuente.completados))],
    puntajes,
    ultimoNivel: [...recientes].reverse().find((fuente) => fuente.ultimoNivel)?.ultimoNivel || '',
    actualizado: recientes.at(-1)?.actualizado || '',
  };
}

function guardar(progreso: ProgresoHistoria) {
  try { localStorage.setItem(llave(), JSON.stringify(progreso)); } catch { /* la navegación continúa sin persistencia */ }
}

/** Conserva la forma de datos del módulo interactivo sin publicar casos sin revisión académica. */
export function usarUsuarioHistoria(uid: string | null, remoto?: Partial<ProgresoHistoria> | null) {
  const anterior = usuarioActivo;
  usuarioActivo = uid || 'local';
  const local = leer(llave());
  const anonimo = uid && anterior === 'local' ? leer(PREFIX + 'local') : vacio();
  const unido = combinar(local, anonimo, normalizar(remoto));
  guardar(unido);
  return unido;
}
