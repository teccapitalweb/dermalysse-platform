import { api } from './auth';
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

let cargado = false;
let pendiente: Promise<void> | null = null;
const quizzesCargados = new Set<string>();

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
  if (quizzesCargados.has(id)) return;
  quizzesCargados.add(id);
  try {
    const respuesta = await api<{ preguntas: { q: string; opciones: string[] }[] }>(`/quiz/${encodeURIComponent(cursoId)}/${n}`);
    const quiz: Quiz = {
      id, cursoId, n, estado: 'aprobado', actualizado: '',
      preguntas: respuesta.preguntas.map((p) => ({ ...p, correcta: -1, explicacion: '' })),
    };
    Datos.hidratarAdmin('quizzes', [...Datos.quizzes().filter((q) => q.id !== id), quiz]);
  } catch (error: any) {
    if (error?.status !== 404 && error?.status !== 403) {
      quizzesCargados.delete(id);
      throw error;
    }
  }
}

export async function cargarClub(path = '/', forzar = false) {
  if (Datos.modo !== 'api') return;
  if (cargado && !forzar) return cargarQuizDeRuta(path);
  if (pendiente) { await pendiente; return cargarQuizDeRuta(path); }

  pendiente = (async () => {
    const respuesta = await api<CatalogoRemoto>('/catalogo');
    Datos.hidratarAdmin('cursos', (respuesta.cursos || []).map(adaptarCurso));
    Datos.hidratarAdmin('materiales', (respuesta.materiales || []).map(adaptarMaterial));
    Datos.hidratarAdmin('eventos', (respuesta.eventos || []).map(adaptarEvento));

    const remota = respuesta.config || {};
    const actual = Datos.config();
    const config: Config = {
      precioMensual: Number(remota.precios?.mensual) || actual.precioMensual,
      precioAnual: Number(remota.precios?.anual) || actual.precioAnual,
      descuentoVIP: Number(remota.descuentoVIP) || actual.descuentoVIP,
      whatsappSoporte: remota.whatsappSoporte || actual.whatsappSoporte,
      canalWhatsApp: remota.canalWhatsApp || actual.canalWhatsApp,
    };
    Datos.hidratarAdmin('config', config);
    cargado = true;
  })().finally(() => { pendiente = null; });

  await pendiente;
  await cargarQuizDeRuta(path);
}

export function invalidarClub() {
  cargado = false;
  quizzesCargados.clear();
  Datos.invalidarAdmin('cursos', 'materiales', 'eventos', 'config');
}
