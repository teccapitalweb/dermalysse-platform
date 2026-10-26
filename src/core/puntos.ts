import { api } from './auth';
import { Datos } from './datos';

export interface RecompensaServidor {
  id: string; nombre: string; descripcion: string; icono: string;
  progreso: number; meta: number; completado: boolean; canjeado: boolean; canjeadoEn: string | null;
  premio: { duracion: string; dias: number | null };
  disponible: boolean; motivoPausa: string | null;
}

export interface ResumenPuntos {
  saldo: number; experiencia: number; ganados: number; gastados: number;
  nivel: { id: string; nombre: string; desde: number; siguiente: number | null; descripcion: string };
  progresoNivel: number; puntosSiguienteNivel: number | null;
  reglas: { clases: number; cursos: number; certificados: number; retos: string };
  metricas: { clases: number; cursos: number; certificados: number; xpRetos: number };
}

export interface BeneficioPuntos {
  id: string; nombre: string; descripcion: string; categoria: 'material' | 'vip'; costo: number; icono: string;
  destacado?: boolean; materialId?: string; diasVip?: number;
  disponible: boolean; canjeado: boolean; puedeCanjear: boolean; motivo: string | null;
}

export interface MovimientoPuntos { id: string; tipo: 'ganado' | 'canje'; puntos: number; concepto: string; detalle: string; fecha: string }
export interface CanjePuntos { id: string; beneficioId: string; nombre: string; categoria: 'material' | 'vip'; costo: number; fecha: string; materialId: string | null; diasVip: number | null; vigenciaHasta: string | null }
export interface HitoPuntos {
  id: string; nombre: string; descripcion: string; icono: string; rareza: 'esencial' | 'distinguido' | 'elite';
  progreso: number; meta: number; porcentaje: number; premio: number; completado: boolean;
}
export interface ColeccionPuntos {
  id: string; nombre: string; descripcion: string; icono: string;
  progreso: number; meta: number; porcentaje: number; completado: boolean;
}
export interface ObjetivoPuntos {
  beneficioId: string; nombre: string; costo: number; faltan: number; porcentaje: number;
  clasesEquivalentes: number; cursosEquivalentes: number;
}
export interface PanelPuntos {
  recompensas: RecompensaServidor[];
  puntos: ResumenPuntos;
  boutique: BeneficioPuntos[];
  movimientos: MovimientoPuntos[];
  canjes: CanjePuntos[];
  hitos: HitoPuntos[];
  colecciones: ColeccionPuntos[];
  objetivo: ObjetivoPuntos | null;
  vipAnual: { anio: number; usados: number; disponibles: number; limite: number };
  proximasFormasDeGanar: { nombre: string; estado: string; descripcion: string }[];
}

const recompensasDemo: RecompensaServidor[] = [
  { id: 'primer-paso', nombre: 'Primer Paso', descripcion: 'Mira 5 clases de cualquier curso', icono: 'play', progreso: 5, meta: 5, completado: true, canjeado: false, canjeadoEn: null, premio: { duracion: 'personalizada', dias: 7 }, disponible: true, motivoPausa: null },
  { id: 'curso-completo', nombre: 'Curso Completo', descripcion: 'Completa 1 curso', icono: 'book-check', progreso: 1, meta: 1, completado: true, canjeado: true, canjeadoEn: '2026-10-10T12:00:00.000Z', premio: { duracion: '15d', dias: null }, disponible: true, motivoPausa: null },
  { id: 'doble-logro', nombre: 'Doble Logro', descripcion: 'Completa 2 cursos', icono: 'trophy', progreso: 1, meta: 2, completado: false, canjeado: false, canjeadoEn: null, premio: { duracion: '1m', dias: null }, disponible: true, motivoPausa: null },
  { id: 'explorador', nombre: 'Explorador', descripcion: 'Completa 5 niveles de historia', icono: 'compass', progreso: 3, meta: 5, completado: false, canjeado: false, canjeadoEn: null, premio: { duracion: 'personalizada', dias: 7 }, disponible: false, motivoPausa: 'En validación segura del progreso.' },
  { id: 'certificado', nombre: 'Certificado', descripcion: 'Obtén tu primer certificado', icono: 'award', progreso: 1, meta: 1, completado: true, canjeado: false, canjeadoEn: null, premio: { duracion: '15d', dias: null }, disponible: true, motivoPausa: null },
];

const panelDemo: PanelPuntos = {
  recompensas: recompensasDemo,
  puntos: {
    saldo: 740, experiencia: 1140, ganados: 1340, gastados: 600,
    nivel: { id: 'criterio', nombre: 'Criterio', desde: 900, siguiente: 1800, descripcion: 'Distingue una trayectoria formativa sólida dentro del club.' },
    progresoNivel: 27, puntosSiguienteNivel: 660,
    reglas: { clases: 10, cursos: 100, certificados: 50, retos: '1 punto por cada 2 XP verificados' },
    metricas: { clases: 18, cursos: 2, certificados: 1, xpRetos: 320 },
  },
  boutique: [
    { id: 'material-regulacion-cosmetica', nombre: 'Guía de regulación cosmética', descripcion: 'Acceso permanente al documento disponible en la biblioteca.', categoria: 'material', costo: 200, icono: 'scale', disponible: true, canjeado: true, puedeCanjear: false, motivo: 'Ya forma parte de tu biblioteca permanente.' },
    { id: 'material-nutricion-prevencion', nombre: 'Manual de nutrición y prevención', descripcion: 'Acceso permanente al manual de 80 páginas.', categoria: 'material', costo: 450, icono: 'book-open', destacado: true, disponible: true, canjeado: false, puedeCanjear: true, motivo: null },
    { id: 'material-tecnologias-cosmiatria', nombre: 'Tecnologías avanzadas en cosmiatría', descripcion: 'Acceso permanente al PDF de 62 páginas.', categoria: 'material', costo: 560, icono: 'scan-face', disponible: true, canjeado: false, puedeCanjear: true, motivo: null },
    { id: 'vip-1-dia', nombre: 'Pase VIP de 24 horas', descripcion: 'Un día completo de acceso VIP para una sesión intensiva.', categoria: 'vip', costo: 350, icono: 'clock-3', diasVip: 1, disponible: true, canjeado: false, puedeCanjear: true, motivo: null },
    { id: 'vip-3-dias', nombre: '3 días VIP', descripcion: 'Desbloquea cursos, biblioteca y beneficios VIP durante 3 días.', categoria: 'vip', costo: 900, icono: 'crown', disponible: true, canjeado: false, puedeCanjear: false, motivo: 'Te faltan 160 puntos.' },
    { id: 'vip-7-dias', nombre: '7 días VIP', descripcion: 'Una semana completa de acceso VIP.', categoria: 'vip', costo: 1800, icono: 'gem', destacado: true, disponible: true, canjeado: false, puedeCanjear: false, motivo: 'Te faltan 1060 puntos.' },
    { id: 'vip-30-dias', nombre: '30 días VIP', descripcion: 'Un mes completo de acceso VIP; utiliza el cupo anual disponible.', categoria: 'vip', costo: 6500, icono: 'calendar-heart', diasVip: 30, disponible: true, canjeado: false, puedeCanjear: false, motivo: 'Te faltan 5760 puntos.' },
  ],
  movimientos: [
    { id: 'm1', tipo: 'ganado', puntos: 100, concepto: 'Curso completado', detalle: '100 puntos por curso', fecha: '2026-10-25T18:00:00.000Z' },
    { id: 'm2', tipo: 'ganado', puntos: 40, concepto: 'Práctica en Retos', detalle: 'XP verificado por servidor', fecha: '2026-10-24T18:00:00.000Z' },
    { id: 'm3', tipo: 'canje', puntos: -200, concepto: 'Guía de regulación cosmética', detalle: 'Acceso permanente a material', fecha: '2026-10-20T18:00:00.000Z' },
  ],
  canjes: [{ id: 'c1', beneficioId: 'material-regulacion-cosmetica', nombre: 'Guía de regulación cosmética', categoria: 'material', costo: 200, fecha: '2026-10-20T18:00:00.000Z', materialId: 'p-demo', diasVip: null, vigenciaHasta: null }],
  hitos: [
    { id: 'primera-clase', nombre: 'Primer ritual', descripcion: 'Acredita tu primera clase.', icono: 'sparkles', rareza: 'esencial', progreso: 1, meta: 1, porcentaje: 100, premio: 25, completado: true },
    { id: 'cinco-clases', nombre: 'Impulso inicial', descripcion: 'Acredita 5 clases.', icono: 'play-circle', rareza: 'esencial', progreso: 5, meta: 5, porcentaje: 100, premio: 50, completado: true },
    { id: 'quince-clases', nombre: 'Ritmo de estudio', descripcion: 'Acredita 15 clases.', icono: 'flame', rareza: 'distinguido', progreso: 15, meta: 15, porcentaje: 100, premio: 100, completado: true },
    { id: 'treinta-clases', nombre: 'Disciplina editorial', descripcion: 'Acredita 30 clases.', icono: 'library-big', rareza: 'elite', progreso: 18, meta: 30, porcentaje: 60, premio: 200, completado: false },
    { id: 'primer-curso', nombre: 'Ruta completa', descripcion: 'Completa tu primer curso.', icono: 'book-check', rareza: 'esencial', progreso: 1, meta: 1, porcentaje: 100, premio: 125, completado: true },
    { id: 'tres-cursos', nombre: 'Trilogía de aprendizaje', descripcion: 'Completa 3 cursos.', icono: 'layers-3', rareza: 'distinguido', progreso: 2, meta: 3, porcentaje: 67, premio: 300, completado: false },
    { id: 'cinco-cursos', nombre: 'Colección de conocimiento', descripcion: 'Completa 5 cursos.', icono: 'trophy', rareza: 'elite', progreso: 2, meta: 5, porcentaje: 40, premio: 500, completado: false },
    { id: 'primer-certificado', nombre: 'Primera constancia', descripcion: 'Obtén tu primer certificado válido.', icono: 'award', rareza: 'distinguido', progreso: 1, meta: 1, porcentaje: 100, premio: 100, completado: true },
    { id: 'tres-certificados', nombre: 'Trayectoria documentada', descripcion: 'Obtén 3 certificados válidos.', icono: 'badge-check', rareza: 'elite', progreso: 1, meta: 3, porcentaje: 33, premio: 250, completado: false },
    { id: 'retos-50', nombre: 'Mente en práctica', descripcion: 'Convierte 100 XP verificados de Retos.', icono: 'brain-circuit', rareza: 'esencial', progreso: 50, meta: 50, porcentaje: 100, premio: 50, completado: true },
    { id: 'retos-250', nombre: 'Dominio aplicado', descripcion: 'Convierte 500 XP verificados de Retos.', icono: 'gamepad-2', rareza: 'elite', progreso: 160, meta: 250, porcentaje: 64, premio: 250, completado: false },
  ],
  colecciones: [
    { id: 'primera-pieza', nombre: 'Primera pieza', descripcion: 'Tu primera obra permanente en la biblioteca.', icono: 'bookmark-check', progreso: 1, meta: 1, porcentaje: 100, completado: true },
    { id: 'biblioteca-profesional', nombre: 'Biblioteca profesional', descripcion: 'Una selección personal de 3 recursos.', icono: 'library', progreso: 1, meta: 3, porcentaje: 33, completado: false },
    { id: 'archivo-experto', nombre: 'Archivo experto', descripcion: 'Una colección avanzada de 6 recursos.', icono: 'library', progreso: 1, meta: 6, porcentaje: 17, completado: false },
    { id: 'coleccion-completa', nombre: 'Colección Dermalysse', descripcion: 'Los 9 materiales de la boutique en tu cuenta.', icono: 'gem', progreso: 1, meta: 9, porcentaje: 11, completado: false },
  ],
  objetivo: { beneficioId: 'material-nutricion-prevencion', nombre: 'Manual de nutrición y prevención', costo: 450, faltan: 0, porcentaje: 100, clasesEquivalentes: 0, cursosEquivalentes: 0 },
  vipAnual: { anio: 2026, usados: 3, disponibles: 27, limite: 30 },
  proximasFormasDeGanar: [
    { nombre: 'Modo Historia', estado: 'En validación segura', descripcion: 'Se activará cuando cada nivel se acredite en el servidor.' },
    { nombre: 'Comunidad', estado: 'En moderación', descripcion: 'Premiará aportaciones aprobadas por calidad.' },
    { nombre: 'Misiones mensuales', estado: 'Próximamente', descripcion: 'Metas editoriales con fecha y reglas verificables.' },
  ],
};

let cache: { panel: PanelPuntos; en: number } | null = null;
let pendiente: Promise<PanelPuntos> | null = null;

export function invalidarPanelPuntos() { cache = null; pendiente = null; }

export async function cargarPanelPuntos(forzar = false): Promise<PanelPuntos> {
  if (Datos.modo === 'demo') return structuredClone(panelDemo);
  if (!forzar && cache && Date.now() - cache.en < 120_000) return cache.panel;
  if (pendiente) return pendiente;
  pendiente = api<PanelPuntos>('/recompensas').then((panel) => {
    cache = { panel, en: Date.now() };
    return panel;
  }).finally(() => { pendiente = null; });
  return pendiente;
}

export async function actualizarPuntosShell(): Promise<void> {
  const nodos = [...document.querySelectorAll<HTMLElement>('[data-puntos-total]')];
  if (!nodos.length) return;
  try {
    const total = (await cargarPanelPuntos()).puntos.saldo.toLocaleString('es-MX');
    nodos.forEach((n) => { n.textContent = total; n.closest('[data-puntos-shell]')?.classList.remove('is-loading'); });
  } catch {
    nodos.forEach((n) => { n.textContent = '—'; });
  }
}
