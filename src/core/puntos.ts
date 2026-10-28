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
  moneda: { nombre: 'Diamantes Dermalysse'; singular: 'diamante'; plural: 'diamantes'; icono: 'gem' };
  recompensaInicial: { nombre: 'Cofre de bienvenida'; diamantes: number; acreditada: boolean; descripcion: string };
  reglas: { clases: number; cursos: number; certificados: number; retos: string };
  metricas: { clases: number; cursos: number; certificados: number; xpRetos: number; rachaRetos: number };
}

export interface BeneficioPuntos {
  id: string; nombre: string; descripcion: string; categoria: 'material' | 'vip' | 'paquete'; costo: number; icono: string;
  destacado?: boolean; materialId?: string; materialIds?: string[]; diasVip?: number;
  costoOriginal?: number; ahorro?: number; faltanMateriales?: number; incluye?: string[]; esObjetivo?: boolean; esFavorito?: boolean;
  disponible: boolean; canjeado: boolean; puedeCanjear: boolean; motivo: string | null;
}

export interface MovimientoPuntos { id: string; tipo: 'ganado' | 'canje'; puntos: number; concepto: string; detalle: string; fecha: string }
export interface CanjePuntos { id: string; beneficioId: string; nombre: string; categoria: 'material' | 'vip' | 'paquete'; costo: number; costoOriginal?: number; ahorro?: number; fecha: string; materialId: string | null; materialIds?: string[]; diasVip: number | null; vigenciaHasta: string | null; origen?: 'puntos' | 'nivel'; origenId?: string | null }
export interface CotizacionAtelier {
  materialIds: string[];
  materiales: Array<{ materialId: string; beneficioId: string; nombre: string; icono: string; costo: number }>;
  cantidad: number; descuento: number; costoOriginal: number; costo: number; ahorro: number;
  saldo: number; faltan: number; puedeCanjear: boolean;
}
export interface InteligenciaPuntos {
  ultimos30Dias: { ganados: number; gastados: number; balance: number };
  valorCanjeado: number; ahorroAcumulado: number; materialesPermanentes: number; diasVipEntregados: number; promedioSemanalObservado: number;
  historialMensual: Array<{ mes: string; ganados: number; gastados: number }>;
  distribucionCanjes: { materiales: number; colecciones: number; vip: number; premiosNivel: number };
}
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
  clasesEquivalentes: number; cursosEquivalentes: number; personalizado: boolean;
}
export interface MisionPuntos {
  id: string; nombre: string; descripcion: string; icono: string; ruta: 'estudio' | 'programas' | 'practica'; tramo: number;
  premio: number; progreso: number; meta: number; porcentaje: number;
  estado: 'disponible' | 'bloqueada' | 'activa' | 'completada'; puedeActivar: boolean; motivo: string | null;
  activadaEn: string | null; completadaEn: string | null;
}
export interface NivelPublico {
  id: string; nombre: string; desde: number; siguiente: number | null; descripcion: string; alcanzado: boolean; actual: boolean;
}
export interface PremioNivelPuntos {
  nivelId: string; nivelNombre: string; desde: number; descripcion: string;
  desbloqueado: boolean; canjeado: boolean; puedeCanjear: boolean; canjeadoEn: string | null; beneficioElegido: string | null;
  opciones: Array<Pick<BeneficioPuntos, 'id' | 'nombre' | 'descripcion' | 'categoria' | 'icono' | 'diasVip' | 'faltanMateriales' | 'disponible' | 'canjeado' | 'motivo'>>;
}
export interface PanelPuntos {
  recompensas: RecompensaServidor[];
  puntos: ResumenPuntos;
  boutique: BeneficioPuntos[];
  favoritos: BeneficioPuntos[];
  atelier: {
    minimo: number; maximo: number;
    descuentos: Array<{ cantidad: number; porcentaje: number }>;
    materiales: Array<Pick<BeneficioPuntos, 'id' | 'materialId' | 'nombre' | 'descripcion' | 'icono' | 'costo'>>;
  };
  inteligencia: InteligenciaPuntos;
  movimientos: MovimientoPuntos[];
  canjes: CanjePuntos[];
  hitos: HitoPuntos[];
  misiones: MisionPuntos[];
  niveles: NivelPublico[];
  premiosNivel: PremioNivelPuntos[];
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
    moneda: { nombre: 'Diamantes Dermalysse', singular: 'diamante', plural: 'diamantes', icono: 'gem' },
    recompensaInicial: { nombre: 'Cofre de bienvenida', diamantes: 350, acreditada: true, descripcion: 'Saldo inicial real para elegir un material permanente o un pase VIP de 24 horas.' },
    reglas: { clases: 10, cursos: 100, certificados: 50, retos: '1 diamante por cada 2 XP verificados' },
    metricas: { clases: 18, cursos: 2, certificados: 1, xpRetos: 320, rachaRetos: 6 },
  },
  boutique: [
    { id: 'material-regulacion-cosmetica', nombre: 'Guía de regulación cosmética', descripcion: 'Acceso permanente al documento disponible en la biblioteca.', categoria: 'material', costo: 200, icono: 'scale', disponible: true, canjeado: true, puedeCanjear: false, motivo: 'Ya forma parte de tu biblioteca permanente.' },
    { id: 'material-nutricion-prevencion', materialId: 'nutricion-prevencion', nombre: 'Manual de nutrición y prevención', descripcion: 'Acceso permanente al manual de 80 páginas.', categoria: 'material', costo: 450, icono: 'book-open', destacado: true, esFavorito: true, disponible: true, canjeado: false, puedeCanjear: true, motivo: null },
    { id: 'material-tecnologias-cosmiatria', materialId: 'tecnologias-cosmiatria', nombre: 'Tecnologías avanzadas en cosmiatría', descripcion: 'Acceso permanente al PDF de 62 páginas.', categoria: 'material', costo: 560, icono: 'scan-face', disponible: true, canjeado: false, puedeCanjear: true, motivo: null },
    { id: 'vip-1-dia', nombre: 'Pase VIP de 24 horas', descripcion: 'Un día completo de acceso VIP para una sesión intensiva.', categoria: 'vip', costo: 350, icono: 'clock-3', diasVip: 1, disponible: true, canjeado: false, puedeCanjear: true, motivo: null },
    { id: 'vip-2-dias', nombre: 'Pase VIP de fin de semana', descripcion: 'Dos días completos para una ruta de estudio concentrada.', categoria: 'vip', costo: 650, icono: 'calendar-days', diasVip: 2, disponible: true, canjeado: false, puedeCanjear: true, motivo: null },
    { id: 'vip-3-dias', nombre: '3 días VIP', descripcion: 'Desbloquea cursos, biblioteca y beneficios VIP durante 3 días.', categoria: 'vip', costo: 900, icono: 'crown', diasVip: 3, disponible: true, canjeado: false, puedeCanjear: false, motivo: 'Te faltan 160 diamantes.' },
    { id: 'vip-5-dias', nombre: '5 días VIP', descripcion: 'Cinco días para avanzar una ruta con flexibilidad.', categoria: 'vip', costo: 1400, icono: 'calendar-range', diasVip: 5, disponible: true, canjeado: false, puedeCanjear: false, motivo: 'Te faltan 660 diamantes.' },
    { id: 'vip-7-dias', nombre: '7 días VIP', descripcion: 'Una semana completa de acceso VIP.', categoria: 'vip', costo: 1800, icono: 'gem', diasVip: 7, destacado: true, disponible: true, canjeado: false, puedeCanjear: false, motivo: 'Te faltan 1,060 diamantes.' },
    { id: 'vip-10-dias', nombre: '10 días VIP', descripcion: 'Diez días de acceso para profundizar en varios programas.', categoria: 'vip', costo: 2500, icono: 'calendar-check', diasVip: 10, disponible: true, canjeado: false, puedeCanjear: false, motivo: 'Te faltan 1,760 diamantes.' },
    { id: 'vip-15-dias', nombre: '15 días VIP', descripcion: 'Quince días de acceso VIP para avanzar con mayor profundidad.', categoria: 'vip', costo: 3500, icono: 'badge-check', diasVip: 15, disponible: true, canjeado: false, puedeCanjear: false, motivo: 'Te faltan 2,760 diamantes.' },
    { id: 'vip-30-dias', nombre: '30 días VIP', descripcion: 'Un mes completo de acceso VIP; utiliza el cupo anual disponible.', categoria: 'vip', costo: 6500, icono: 'calendar-heart', diasVip: 30, disponible: true, canjeado: false, puedeCanjear: false, motivo: 'Te faltan 5,760 diamantes.' },
    { id: 'paquete-fundamentos-profesionales', nombre: 'Colección Fundamentos Profesionales', descripcion: 'Regulación cosmética, estabilidad y prevención en una colección permanente.', categoria: 'paquete', costo: 760, costoOriginal: 910, ahorro: 150, faltanMateriales: 3, incluye: ['Guía de regulación cosmética', 'Estudios de estabilidad cosmética', 'Manual de nutrición y prevención'], esObjetivo: false, icono: 'briefcase-business', destacado: true, disponible: true, canjeado: false, puedeCanjear: false, motivo: 'Te faltan 20 diamantes.' },
    { id: 'paquete-rejuvenecimiento-facial', nombre: 'Colección Rejuvenecimiento Facial', descripcion: 'Guía, manual y cuadernillo avanzado para una ruta editorial completa.', categoria: 'paquete', costo: 990, costoOriginal: 1220, ahorro: 230, faltanMateriales: 3, incluye: ['Guía de rejuvenecimiento facial', 'Manual de técnicas avanzadas', 'Cuadernillo de técnicas avanzadas'], esObjetivo: true, icono: 'sparkles', disponible: true, canjeado: false, puedeCanjear: false, motivo: 'Te faltan 250 diamantes.' },
    { id: 'paquete-tecnologia-aplicada', nombre: 'Colección Tecnología Aplicada', descripcion: 'Tecnologías, radiofrecuencia y Dermapen en acceso permanente.', categoria: 'paquete', costo: 1140, costoOriginal: 1400, ahorro: 260, faltanMateriales: 3, incluye: ['Tecnologías avanzadas en cosmiatría', 'Radiofrecuencia y ultracavitación', 'Dermapen'], esObjetivo: false, icono: 'scan-face', disponible: true, canjeado: false, puedeCanjear: false, motivo: 'Te faltan 400 diamantes.' },
    { id: 'paquete-biblioteca-completa', nombre: 'Biblioteca Dermalysse Completa', descripcion: 'Los nueve materiales en una sola colección con ahorro preferente.', categoria: 'paquete', costo: 2860, costoOriginal: 3530, ahorro: 670, faltanMateriales: 8, incluye: ['Guía de regulación cosmética', 'Estudios de estabilidad cosmética', 'Manual de nutrición y prevención', 'Guía de rejuvenecimiento facial', 'Manual de técnicas avanzadas', 'Cuadernillo de técnicas avanzadas', 'Tecnologías avanzadas en cosmiatría', 'Radiofrecuencia y ultracavitación', 'Dermapen'], esObjetivo: false, icono: 'library-big', destacado: true, disponible: true, canjeado: false, puedeCanjear: false, motivo: 'Te faltan 2,120 diamantes.' },
  ],
  favoritos: [
    { id: 'material-nutricion-prevencion', materialId: 'nutricion-prevencion', nombre: 'Manual de nutrición y prevención', descripcion: 'Acceso permanente al manual de 80 páginas.', categoria: 'material', costo: 450, icono: 'book-open', destacado: true, esFavorito: true, disponible: true, canjeado: false, puedeCanjear: true, motivo: null },
  ],
  atelier: {
    minimo: 2,
    maximo: 5,
    descuentos: [{ cantidad: 2, porcentaje: 8 }, { cantidad: 3, porcentaje: 12 }, { cantidad: 4, porcentaje: 16 }, { cantidad: 5, porcentaje: 20 }],
    materiales: [
      { id: 'material-nutricion-prevencion', materialId: 'nutricion-prevencion', nombre: 'Manual de nutrición y prevención', descripcion: 'Acceso permanente al manual de 80 páginas.', icono: 'book-open', costo: 450 },
      { id: 'material-tecnologias-cosmiatria', materialId: 'tecnologias-cosmiatria', nombre: 'Tecnologías avanzadas en cosmiatría', descripcion: 'Acceso permanente al PDF de 62 páginas.', icono: 'scan-face', costo: 560 },
      { id: 'material-radiofrecuencia', materialId: 'radiofrecuencia-ultracavitacion', nombre: 'Radiofrecuencia y ultracavitación', descripcion: 'Acceso permanente a la guía aplicada.', icono: 'waves', costo: 480 },
    ],
  },
  inteligencia: {
    ultimos30Dias: { ganados: 140, gastados: 200, balance: -60 },
    valorCanjeado: 200, ahorroAcumulado: 0, materialesPermanentes: 1, diasVipEntregados: 0, promedioSemanalObservado: 33,
    historialMensual: [
      { mes: '2026-05', ganados: 0, gastados: 0 }, { mes: '2026-06', ganados: 120, gastados: 0 },
      { mes: '2026-07', ganados: 180, gastados: 0 }, { mes: '2026-08', ganados: 300, gastados: 0 },
      { mes: '2026-09', ganados: 600, gastados: 0 }, { mes: '2026-10', ganados: 140, gastados: 200 },
    ],
    distribucionCanjes: { materiales: 1, colecciones: 0, vip: 0, premiosNivel: 0 },
  },
  movimientos: [
    { id: 'm1', tipo: 'ganado', puntos: 100, concepto: 'Curso completado', detalle: '100 diamantes por curso', fecha: '2026-10-25T18:00:00.000Z' },
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
    { id: 'cincuenta-clases', nombre: 'Archivo de estudio', descripcion: 'Acredita 50 clases.', icono: 'library', rareza: 'elite', progreso: 18, meta: 50, porcentaje: 36, premio: 350, completado: false },
    { id: 'setenta-cinco-clases', nombre: 'Constancia extraordinaria', descripcion: 'Acredita 75 clases.', icono: 'star', rareza: 'elite', progreso: 18, meta: 75, porcentaje: 24, premio: 600, completado: false },
    { id: 'cien-clases', nombre: 'Centenario de conocimiento', descripcion: 'Acredita 100 clases.', icono: 'crown', rareza: 'elite', progreso: 18, meta: 100, porcentaje: 18, premio: 1000, completado: false },
    { id: 'ocho-cursos', nombre: 'Ruta de especialización', descripcion: 'Completa 8 cursos.', icono: 'route', rareza: 'elite', progreso: 2, meta: 8, porcentaje: 25, premio: 800, completado: false },
    { id: 'doce-cursos', nombre: 'Atlas de formación', descripcion: 'Completa 12 cursos.', icono: 'map', rareza: 'elite', progreso: 2, meta: 12, porcentaje: 17, premio: 1400, completado: false },
    { id: 'cinco-certificados', nombre: 'Portafolio certificado', descripcion: 'Obtén 5 certificados válidos.', icono: 'scroll-text', rareza: 'elite', progreso: 1, meta: 5, porcentaje: 20, premio: 500, completado: false },
    { id: 'diez-certificados', nombre: 'Archivo de excelencia', descripcion: 'Obtén 10 certificados válidos.', icono: 'medal', rareza: 'elite', progreso: 1, meta: 10, porcentaje: 10, premio: 1200, completado: false },
    { id: 'retos-500', nombre: 'Laboratorio avanzado', descripcion: 'Convierte 1,000 XP verificados de Retos.', icono: 'microscope', rareza: 'elite', progreso: 160, meta: 500, porcentaje: 32, premio: 500, completado: false },
    { id: 'retos-1250', nombre: 'Criterio en acción', descripcion: 'Convierte 2,500 XP verificados de Retos.', icono: 'brain-circuit', rareza: 'elite', progreso: 160, meta: 1250, porcentaje: 13, premio: 1100, completado: false },
    { id: 'racha-3', nombre: 'Tres días de enfoque', descripcion: 'Alcanza una racha verificada de 3 días en Retos.', icono: 'flame', rareza: 'esencial', progreso: 3, meta: 3, porcentaje: 100, premio: 60, completado: true },
    { id: 'racha-7', nombre: 'Semana impecable', descripcion: 'Alcanza una racha verificada de 7 días en Retos.', icono: 'calendar-check', rareza: 'distinguido', progreso: 6, meta: 7, porcentaje: 86, premio: 160, completado: false },
    { id: 'racha-14', nombre: 'Ritual de dos semanas', descripcion: 'Alcanza una racha verificada de 14 días en Retos.', icono: 'calendar-heart', rareza: 'elite', progreso: 6, meta: 14, porcentaje: 43, premio: 350, completado: false },
    { id: 'racha-30', nombre: 'Mes de constancia', descripcion: 'Alcanza una racha verificada de 30 días en Retos.', icono: 'badge-check', rareza: 'elite', progreso: 6, meta: 30, porcentaje: 20, premio: 800, completado: false },
  ],
  misiones: [
    { id: 'estudio-1', nombre: 'Impulso de estudio I', descripcion: 'Acredita 5 clases nuevas después de activar la misión.', icono: 'play-circle', ruta: 'estudio', tramo: 1, premio: 75, progreso: 3, meta: 5, porcentaje: 60, estado: 'activa', puedeActivar: false, motivo: null, activadaEn: '2026-10-24T18:00:00.000Z', completadaEn: null },
    { id: 'estudio-2', nombre: 'Impulso de estudio II', descripcion: 'Acredita 10 clases nuevas.', icono: 'library-big', ruta: 'estudio', tramo: 2, premio: 175, progreso: 0, meta: 10, porcentaje: 0, estado: 'bloqueada', puedeActivar: false, motivo: 'Completa el tramo anterior para desbloquearla.', activadaEn: null, completadaEn: null },
    { id: 'estudio-3', nombre: 'Impulso de estudio III', descripcion: 'Acredita 20 clases nuevas.', icono: 'sparkles', ruta: 'estudio', tramo: 3, premio: 400, progreso: 0, meta: 20, porcentaje: 0, estado: 'bloqueada', puedeActivar: false, motivo: 'Completa el tramo anterior para desbloquearla.', activadaEn: null, completadaEn: null },
    { id: 'programas-1', nombre: 'Ruta de programas I', descripcion: 'Completa 1 curso nuevo después de activar la misión.', icono: 'book-check', ruta: 'programas', tramo: 1, premio: 175, progreso: 0, meta: 1, porcentaje: 0, estado: 'disponible', puedeActivar: true, motivo: null, activadaEn: null, completadaEn: null },
    { id: 'programas-2', nombre: 'Ruta de programas II', descripcion: 'Completa 2 cursos nuevos.', icono: 'layers-3', ruta: 'programas', tramo: 2, premio: 400, progreso: 0, meta: 2, porcentaje: 0, estado: 'bloqueada', puedeActivar: false, motivo: 'Completa el tramo anterior para desbloquearla.', activadaEn: null, completadaEn: null },
    { id: 'programas-3', nombre: 'Ruta de programas III', descripcion: 'Completa 3 cursos nuevos.', icono: 'trophy', ruta: 'programas', tramo: 3, premio: 750, progreso: 0, meta: 3, porcentaje: 0, estado: 'bloqueada', puedeActivar: false, motivo: 'Completa el tramo anterior para desbloquearla.', activadaEn: null, completadaEn: null },
    { id: 'practica-1', nombre: 'Laboratorio de Retos I', descripcion: 'Obtén 100 XP nuevos en Retos.', icono: 'gamepad-2', ruta: 'practica', tramo: 1, premio: 75, progreso: 50, meta: 50, porcentaje: 100, estado: 'completada', puedeActivar: false, motivo: null, activadaEn: '2026-10-20T18:00:00.000Z', completadaEn: '2026-10-25T18:00:00.000Z' },
    { id: 'practica-2', nombre: 'Laboratorio de Retos II', descripcion: 'Obtén 300 XP nuevos en Retos.', icono: 'brain-circuit', ruta: 'practica', tramo: 2, premio: 250, progreso: 0, meta: 150, porcentaje: 0, estado: 'disponible', puedeActivar: true, motivo: null, activadaEn: null, completadaEn: null },
    { id: 'practica-3', nombre: 'Laboratorio de Retos III', descripcion: 'Obtén 600 XP nuevos en Retos.', icono: 'microscope', ruta: 'practica', tramo: 3, premio: 550, progreso: 0, meta: 300, porcentaje: 0, estado: 'bloqueada', puedeActivar: false, motivo: 'Completa el tramo anterior para desbloquearla.', activadaEn: null, completadaEn: null },
  ],
  niveles: [
    { id: 'descubrimiento', nombre: 'Descubrimiento', desde: 0, siguiente: 300, descripcion: 'Comienza tu ruta.', alcanzado: true, actual: false },
    { id: 'constancia', nombre: 'Constancia', desde: 300, siguiente: 900, descripcion: 'Ritmo sostenido.', alcanzado: true, actual: false },
    { id: 'criterio', nombre: 'Criterio', desde: 900, siguiente: 1800, descripcion: 'Trayectoria sólida.', alcanzado: true, actual: true },
    { id: 'circulo', nombre: 'Círculo Dermalysse', desde: 1800, siguiente: 3500, descripcion: 'Participación avanzada.', alcanzado: false, actual: false },
    { id: 'curaduria', nombre: 'Curaduría', desde: 3500, siguiente: 6000, descripcion: 'Trayectoria amplia.', alcanzado: false, actual: false },
    { id: 'legado', nombre: 'Legado Dermalysse', desde: 6000, siguiente: 10000, descripcion: 'Gran profundidad.', alcanzado: false, actual: false },
    { id: 'maestria', nombre: 'Maestría Editorial', desde: 10000, siguiente: 18000, descripcion: 'Participación excepcional.', alcanzado: false, actual: false },
    { id: 'icono', nombre: 'Ícono Dermalysse', desde: 18000, siguiente: null, descripcion: 'Nivel máximo.', alcanzado: false, actual: false },
  ],
  premiosNivel: [
    { nivelId: 'constancia', nivelNombre: 'Constancia', desde: 300, descripcion: 'Celebra tu primer ritmo sostenido.', desbloqueado: true, canjeado: true, puedeCanjear: false, canjeadoEn: '2026-10-10T12:00:00.000Z', beneficioElegido: 'vip-1-dia', opciones: [
      { id: 'vip-1-dia', nombre: 'Pase VIP de 24 horas', descripcion: 'Un día completo de acceso VIP.', categoria: 'vip', icono: 'clock-3', diasVip: 1, disponible: true, canjeado: false, motivo: null },
      { id: 'material-regulacion-cosmetica', nombre: 'Guía de regulación cosmética', descripcion: 'Acceso permanente a la guía.', categoria: 'material', icono: 'scale', disponible: true, canjeado: true, motivo: 'Ya forma parte de tu biblioteca.' },
    ] },
    { nivelId: 'criterio', nivelNombre: 'Criterio', desde: 900, descripcion: 'Convierte tu trayectoria sólida en un beneficio.', desbloqueado: true, canjeado: false, puedeCanjear: true, canjeadoEn: null, beneficioElegido: null, opciones: [
      { id: 'vip-2-dias', nombre: 'Pase VIP de fin de semana', descripcion: 'Dos días completos de acceso VIP.', categoria: 'vip', icono: 'calendar-days', diasVip: 2, disponible: true, canjeado: false, motivo: null },
      { id: 'material-estudios-estabilidad', nombre: 'Estudios de estabilidad', descripcion: 'Acceso permanente al material.', categoria: 'material', icono: 'flask-conical', disponible: true, canjeado: false, motivo: null },
    ] },
    ...['circulo', 'curaduria', 'legado', 'maestria', 'icono'].map((nivelId, i) => ({ nivelId, nivelNombre: ['Círculo Dermalysse', 'Curaduría', 'Legado Dermalysse', 'Maestría Editorial', 'Ícono Dermalysse'][i], desde: [1800, 3500, 6000, 10000, 18000][i], descripcion: 'Una recompensa especial al alcanzar este nivel.', desbloqueado: false, canjeado: false, puedeCanjear: false, canjeadoEn: null, beneficioElegido: null, opciones: [
      { id: `vip-${[3, 5, 7, 10, 15][i]}-dias`, nombre: `${[3, 5, 7, 10, 15][i]} días VIP`, descripcion: 'Acceso VIP de cortesía.', categoria: 'vip' as const, icono: 'crown', diasVip: [3, 5, 7, 10, 15][i], disponible: true, canjeado: false, motivo: null },
      { id: ['material-nutricion-prevencion', 'material-rejuvenecimiento-manual', 'material-tecnologias-cosmiatria', 'paquete-rejuvenecimiento-facial', 'paquete-biblioteca-completa'][i], nombre: ['Manual de nutrición y prevención', 'Manual de técnicas avanzadas', 'Tecnologías avanzadas en cosmiatría', 'Colección Rejuvenecimiento Facial', 'Biblioteca Dermalysse Completa'][i], descripcion: 'Acceso permanente a contenido seleccionado.', categoria: (i > 2 ? 'paquete' : 'material') as 'material' | 'paquete', icono: i > 2 ? 'layers-3' : 'book-open', faltanMateriales: i > 2 ? [3, 8][i - 3] : undefined, disponible: true, canjeado: false, motivo: null },
    ] })),
  ],
  colecciones: [
    { id: 'primera-pieza', nombre: 'Primera pieza', descripcion: 'Tu primera obra permanente en la biblioteca.', icono: 'bookmark-check', progreso: 1, meta: 1, porcentaje: 100, completado: true },
    { id: 'biblioteca-profesional', nombre: 'Biblioteca profesional', descripcion: 'Una selección personal de 3 recursos.', icono: 'library', progreso: 1, meta: 3, porcentaje: 33, completado: false },
    { id: 'archivo-experto', nombre: 'Archivo experto', descripcion: 'Una colección avanzada de 6 recursos.', icono: 'library', progreso: 1, meta: 6, porcentaje: 17, completado: false },
    { id: 'coleccion-completa', nombre: 'Colección Dermalysse', descripcion: 'Los 9 materiales de la boutique en tu cuenta.', icono: 'gem', progreso: 1, meta: 9, porcentaje: 11, completado: false },
  ],
  objetivo: { beneficioId: 'paquete-rejuvenecimiento-facial', nombre: 'Colección Rejuvenecimiento Facial', costo: 990, faltan: 250, porcentaje: 75, clasesEquivalentes: 25, cursosEquivalentes: 3, personalizado: true },
  vipAnual: { anio: 2026, usados: 3, disponibles: 27, limite: 30 },
  proximasFormasDeGanar: [
    { nombre: 'Modo Historia', estado: 'En validación segura', descripcion: 'Se activará cuando cada nivel se acredite en el servidor.' },
    { nombre: 'Comunidad', estado: 'En moderación', descripcion: 'Premiará aportaciones aprobadas por calidad.' },
    { nombre: 'Eventos en vivo', estado: 'En diseño', descripcion: 'Se premiarán cuando asistencia y permanencia tengan validación autoritativa.' },
  ],
};

let cache: { panel: PanelPuntos; en: number } | null = null;
let pendiente: Promise<PanelPuntos> | null = null;

export function invalidarPanelPuntos() { cache = null; pendiente = null; }

/** Mantiene coherente la vista demostrativa tras probar el canje de la campaña; producción nunca usa este atajo. */
export function acreditarCampanaDemo(diamantes: number, concepto: string, fecha: string) {
  if (Datos.modo !== 'demo') return;
  panelDemo.puntos.saldo += diamantes;
  panelDemo.puntos.ganados += diamantes;
  panelDemo.inteligencia.ultimos30Dias.ganados += diamantes;
  panelDemo.inteligencia.ultimos30Dias.balance += diamantes;
  panelDemo.movimientos.unshift({ id: 'demo-campana-bienvenida', tipo: 'ganado', puntos: diamantes, concepto, detalle: 'Beneficio de campaña en modo demostración', fecha });
}

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
