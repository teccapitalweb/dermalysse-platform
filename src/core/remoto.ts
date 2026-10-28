import { api, Auth } from './auth';
import { crearCacheSesion } from './cache-sesion';
import { Datos, type Config, type Curso, type Evento, type Material, type Quiz } from './datos';

interface CatalogoRemoto {
  cursos?: unknown[];
  materiales?: unknown[];
  eventos?: unknown[];
  config?: {
    precios?: { mensual?: number; anual?: number };
    descuentoVIP?: number;
    whatsappSoporte?: string;
    canalWhatsApp?: string;
  };
}

const cache = crearCacheSesion(() => Auth.usuario?.uid ?? null, () => {
  Datos.invalidarAdmin('cursos', 'materiales', 'eventos', 'avisos', 'config', 'quizzes', 'miembros');
});

const VISORES_PUBLICOS = new Set<string>();

const adaptarCurso = (valor: any): Curso => ({
  ...valor,
  portada: valor.portada || '/media/hero-background.png',
  aprenderas: Array.isArray(valor.aprenderas) ? valor.aprenderas : [],
  clases: (Array.isArray(valor.clases) ? valor.clases : []).map((clase: any) => ({
    ...clase,
    duracion: clase.duracionMin ?? clase.duracion ?? null,
  })),
});

const adaptarMaterial = (valor: any): Material => ({
  ...valor,
  portada: valor.portada || '/media/hidrafacial.png',
  url: valor.url || (VISORES_PUBLICOS.has(valor.id) ? 'visor' : ''),
});

const adaptarEvento = (valor: any): Evento => ({
  ...valor,
  reservas: Array.isArray(valor.reservas) ? valor.reservas.length : Number(valor.reservas) || 0,
});

/**
 * Carga el catálogo que puede ver un miembro. En producción `Datos` no usa
 * semillas locales: esta hidratación debe terminar antes de pintar cualquier
 * ruta del club para evitar pantallas momentáneamente vacías.
 */
async function cargarQuizDeRuta(path: string) {
  const coincidencia = path.match(/^\/curso\/([^/]+)\/clase\/(\d+)$/);
  if (!coincidencia) return;
  const cursoId = decodeURIComponent(coincidencia[1]);
  const n = Number(coincidencia[2]);
  const id = `${cursoId}_${n}`;
  await cache.cargar(`quiz:${id}`, async () => {
    try { return await api<{ preguntas?: unknown }>(`/quiz/${encodeURIComponent(cursoId)}/${n}`); } catch (error: any) {
      if (error?.status === 403 || error?.status === 404) return null;
      throw error;
    }
  }, (respuesta) => {
    if (!respuesta) return;
    // Solo preguntas bien formadas; si no queda ninguna, la clase muestra «estará disponible pronto».
    const preguntas = (Array.isArray(respuesta?.preguntas) ? respuesta.preguntas : [])
      .filter((p): p is { q: string; opciones: string[] } => !!p && typeof p.q === 'string' && Array.isArray(p.opciones) && p.opciones.length > 1 && p.opciones.every((o: unknown) => typeof o === 'string'));
    if (!preguntas.length) return;
    const quiz: Quiz = {
      id, cursoId, n, estado: 'aprobado', actualizado: '',
      preguntas: preguntas.map((p) => ({ q: p.q, opciones: p.opciones, correcta: -1, explicacion: '' })),
    };
    Datos.hidratarAdmin('quizzes', [...Datos.quizzes().filter((q) => q.id !== id), quiz]);
  });
}

export async function cargarClub(path = '/', forzar = false) {
  if (Datos.modo !== 'api') return;
  if (forzar) cache.invalidar();
  await cache.cargar('catalogo', () => api<CatalogoRemoto>('/catalogo'), (respuesta) => {
    Datos.hidratarAdmin('cursos', (respuesta.cursos || []).map(adaptarCurso));
    Datos.hidratarAdmin('materiales', (respuesta.materiales || []).map(adaptarMaterial));
    Datos.hidratarAdmin('eventos', (respuesta.eventos || []).map(adaptarEvento));

    const remota = respuesta.config || {};
    const actual = Datos.config();
    const config: Config = {
      ...actual,
      precioMensual: Number(remota.precios?.mensual) || actual.precioMensual,
      precioAnual: Number(remota.precios?.anual) || actual.precioAnual,
      descuentoVIP: Number(remota.descuentoVIP) || actual.descuentoVIP,
      whatsappSoporte: remota.whatsappSoporte || actual.whatsappSoporte,
      canalWhatsApp: remota.canalWhatsApp || actual.canalWhatsApp,
    };
    Datos.hidratarAdmin('config', config);
  });
  await cargarQuizDeRuta(path);
}

export function invalidarClub() {
  cache.invalidar();
}
