// Puntos Dermalysse: saldo canjeable y experiencia acumulada, ambos calculados por el servidor.
// Fuentes confiables en esta primera versión:
//  - clases y cursos acreditados por el webhook legado;
//  - certificados válidos emitidos por el servidor;
//  - XP de Retos, cuyo motor califica y limita las operaciones en la API.
//
// El saldo se puede gastar; la experiencia nunca disminuye y determina el nivel. Historia y foro
// quedan fuera del saldo hasta tener validación autoritativa/antispam. Los materiales canjeados se
// guardan como derechos permanentes en v2_beneficios y se verifican al pedir el enlace protegido.
import type { Datos, FirestorePort } from '../adapters/firestore/port.js';
import { texto } from '../adapters/firestore/port.js';
import { segmento } from '../adapters/firestore/v2.js';
import { leerMetricasVip } from '../adapters/firestore/metricasVip.js';
import { CodedError, NotFoundError } from './errors.js';
import { otorgarDiasVipEnTx } from './vip.js';
import type { Usuario } from '../domain/types.js';

export const COLECCION_PUNTOS = 'v2_puntos';
export const COLECCION_MOVIMIENTOS = 'v2_puntos_movimientos';
export const COLECCION_CANJES_PUNTOS = 'v2_puntos_canjes';
export const DIAMANTES_BIENVENIDA = 350;
export const COLECCION_BENEFICIOS = 'v2_beneficios';
export const COLECCION_BITACORA_ADMIN_PUNTOS = 'v2_admin_puntos_bitacora';

const PUNTOS_POR_CLASE = 10;
const PUNTOS_POR_CURSO = 100;
const PUNTOS_POR_CERTIFICADO = 50;
const XP_RETO_POR_PUNTO = 2;
const MAX_DIAS_VIP_ANIO = 30;

export interface NivelPuntos {
  id: 'descubrimiento' | 'constancia' | 'criterio' | 'circulo' | 'curaduria' | 'legado' | 'maestria' | 'icono';
  nombre: string;
  desde: number;
  siguiente: number | null;
  descripcion: string;
}

const NIVELES: readonly Omit<NivelPuntos, 'siguiente'>[] = [
  { id: 'descubrimiento', nombre: 'Descubrimiento', desde: 0, descripcion: 'Comienza tu ruta y descubre la biblioteca Dermalysse.' },
  { id: 'constancia', nombre: 'Constancia', desde: 300, descripcion: 'Reconoce un ritmo de aprendizaje sostenido.' },
  { id: 'criterio', nombre: 'Criterio', desde: 900, descripcion: 'Distingue una trayectoria formativa sólida dentro del club.' },
  { id: 'circulo', nombre: 'Círculo Dermalysse', desde: 1800, descripcion: 'Distingue una participación avanzada en el ecosistema.' },
  { id: 'curaduria', nombre: 'Curaduría', desde: 3500, descripcion: 'Reconoce una trayectoria amplia de estudio, práctica y selección de recursos.' },
  { id: 'legado', nombre: 'Legado Dermalysse', desde: 6000, descripcion: 'Distingue una trayectoria de gran profundidad dentro del club.' },
  { id: 'maestria', nombre: 'Maestría Editorial', desde: 10000, descripcion: 'Reconoce una participación excepcional y sostenida.' },
  { id: 'icono', nombre: 'Ícono Dermalysse', desde: 18000, descripcion: 'El nivel de participación más alto del ecosistema Dermalysse.' },
] as const;

type FuenteHito = keyof Acreditado;

interface HitoCatalogo {
  id: string;
  nombre: string;
  descripcion: string;
  fuente: FuenteHito;
  meta: number;
  premio: number;
  icono: string;
  rareza: 'esencial' | 'distinguido' | 'elite';
}

/** Bonos vitalicios, automáticos e idempotentes sobre métricas acreditadas por servidor. */
const HITOS: readonly HitoCatalogo[] = [
  { id: 'primera-clase', nombre: 'Primer ritual', descripcion: 'Acredita tu primera clase.', fuente: 'clases', meta: 1, premio: 25, icono: 'sparkles', rareza: 'esencial' },
  { id: 'cinco-clases', nombre: 'Impulso inicial', descripcion: 'Acredita 5 clases.', fuente: 'clases', meta: 5, premio: 50, icono: 'play-circle', rareza: 'esencial' },
  { id: 'quince-clases', nombre: 'Ritmo de estudio', descripcion: 'Acredita 15 clases.', fuente: 'clases', meta: 15, premio: 100, icono: 'flame', rareza: 'distinguido' },
  { id: 'treinta-clases', nombre: 'Disciplina editorial', descripcion: 'Acredita 30 clases.', fuente: 'clases', meta: 30, premio: 200, icono: 'library-big', rareza: 'elite' },
  { id: 'cincuenta-clases', nombre: 'Archivo de estudio', descripcion: 'Acredita 50 clases.', fuente: 'clases', meta: 50, premio: 350, icono: 'library', rareza: 'elite' },
  { id: 'setenta-cinco-clases', nombre: 'Constancia extraordinaria', descripcion: 'Acredita 75 clases.', fuente: 'clases', meta: 75, premio: 600, icono: 'star', rareza: 'elite' },
  { id: 'cien-clases', nombre: 'Centenario de conocimiento', descripcion: 'Acredita 100 clases.', fuente: 'clases', meta: 100, premio: 1000, icono: 'crown', rareza: 'elite' },
  { id: 'primer-curso', nombre: 'Ruta completa', descripcion: 'Completa tu primer curso.', fuente: 'cursos', meta: 1, premio: 125, icono: 'book-check', rareza: 'esencial' },
  { id: 'tres-cursos', nombre: 'Trilogía de aprendizaje', descripcion: 'Completa 3 cursos.', fuente: 'cursos', meta: 3, premio: 300, icono: 'layers-3', rareza: 'distinguido' },
  { id: 'cinco-cursos', nombre: 'Colección de conocimiento', descripcion: 'Completa 5 cursos.', fuente: 'cursos', meta: 5, premio: 500, icono: 'trophy', rareza: 'elite' },
  { id: 'ocho-cursos', nombre: 'Ruta de especialización', descripcion: 'Completa 8 cursos.', fuente: 'cursos', meta: 8, premio: 800, icono: 'route', rareza: 'elite' },
  { id: 'doce-cursos', nombre: 'Atlas de formación', descripcion: 'Completa 12 cursos.', fuente: 'cursos', meta: 12, premio: 1400, icono: 'map', rareza: 'elite' },
  { id: 'primer-certificado', nombre: 'Primera constancia', descripcion: 'Obtén tu primer certificado válido.', fuente: 'certificados', meta: 1, premio: 100, icono: 'award', rareza: 'distinguido' },
  { id: 'tres-certificados', nombre: 'Trayectoria documentada', descripcion: 'Obtén 3 certificados válidos.', fuente: 'certificados', meta: 3, premio: 250, icono: 'badge-check', rareza: 'elite' },
  { id: 'cinco-certificados', nombre: 'Portafolio certificado', descripcion: 'Obtén 5 certificados válidos.', fuente: 'certificados', meta: 5, premio: 500, icono: 'scroll-text', rareza: 'elite' },
  { id: 'diez-certificados', nombre: 'Archivo de excelencia', descripcion: 'Obtén 10 certificados válidos.', fuente: 'certificados', meta: 10, premio: 1200, icono: 'medal', rareza: 'elite' },
  { id: 'retos-50', nombre: 'Mente en práctica', descripcion: 'Convierte 100 XP verificados de Retos.', fuente: 'puntosRetos', meta: 50, premio: 50, icono: 'brain-circuit', rareza: 'esencial' },
  { id: 'retos-250', nombre: 'Dominio aplicado', descripcion: 'Convierte 500 XP verificados de Retos.', fuente: 'puntosRetos', meta: 250, premio: 250, icono: 'gamepad-2', rareza: 'elite' },
  { id: 'retos-500', nombre: 'Laboratorio avanzado', descripcion: 'Convierte 1,000 XP verificados de Retos.', fuente: 'puntosRetos', meta: 500, premio: 500, icono: 'microscope', rareza: 'elite' },
  { id: 'retos-1250', nombre: 'Criterio en acción', descripcion: 'Convierte 2,500 XP verificados de Retos.', fuente: 'puntosRetos', meta: 1250, premio: 1100, icono: 'brain-circuit', rareza: 'elite' },
  { id: 'racha-3', nombre: 'Tres días de enfoque', descripcion: 'Alcanza una racha verificada de 3 días en Retos.', fuente: 'rachaRetos', meta: 3, premio: 60, icono: 'flame', rareza: 'esencial' },
  { id: 'racha-7', nombre: 'Semana impecable', descripcion: 'Alcanza una racha verificada de 7 días en Retos.', fuente: 'rachaRetos', meta: 7, premio: 160, icono: 'calendar-check', rareza: 'distinguido' },
  { id: 'racha-14', nombre: 'Ritual de dos semanas', descripcion: 'Alcanza una racha verificada de 14 días en Retos.', fuente: 'rachaRetos', meta: 14, premio: 350, icono: 'calendar-heart', rareza: 'elite' },
  { id: 'racha-30', nombre: 'Mes de constancia', descripcion: 'Alcanza una racha verificada de 30 días en Retos.', fuente: 'rachaRetos', meta: 30, premio: 800, icono: 'badge-check', rareza: 'elite' },
] as const;

interface MisionCatalogo {
  id: string;
  nombre: string;
  descripcion: string;
  fuente: Exclude<FuenteHito, 'rachaRetos'>;
  incremento: number;
  premio: number;
  icono: string;
  ruta: 'estudio' | 'programas' | 'practica';
  tramo: 1 | 2 | 3;
  requiere?: string;
}

/** Misiones opt-in: la base se captura al activarlas, por lo que solo premian avance futuro. */
const MISIONES: readonly MisionCatalogo[] = [
  { id: 'estudio-1', nombre: 'Impulso de estudio I', descripcion: 'Acredita 5 clases nuevas después de activar la misión.', fuente: 'clases', incremento: 5, premio: 75, icono: 'play-circle', ruta: 'estudio', tramo: 1 },
  { id: 'estudio-2', nombre: 'Impulso de estudio II', descripcion: 'Acredita 10 clases nuevas.', fuente: 'clases', incremento: 10, premio: 175, icono: 'library-big', ruta: 'estudio', tramo: 2, requiere: 'estudio-1' },
  { id: 'estudio-3', nombre: 'Impulso de estudio III', descripcion: 'Acredita 20 clases nuevas.', fuente: 'clases', incremento: 20, premio: 400, icono: 'sparkles', ruta: 'estudio', tramo: 3, requiere: 'estudio-2' },
  { id: 'programas-1', nombre: 'Ruta de programas I', descripcion: 'Completa 1 curso nuevo después de activar la misión.', fuente: 'cursos', incremento: 1, premio: 175, icono: 'book-check', ruta: 'programas', tramo: 1 },
  { id: 'programas-2', nombre: 'Ruta de programas II', descripcion: 'Completa 2 cursos nuevos.', fuente: 'cursos', incremento: 2, premio: 400, icono: 'layers-3', ruta: 'programas', tramo: 2, requiere: 'programas-1' },
  { id: 'programas-3', nombre: 'Ruta de programas III', descripcion: 'Completa 3 cursos nuevos.', fuente: 'cursos', incremento: 3, premio: 750, icono: 'trophy', ruta: 'programas', tramo: 3, requiere: 'programas-2' },
  { id: 'practica-1', nombre: 'Laboratorio de Retos I', descripcion: 'Obtén 100 XP nuevos en Retos.', fuente: 'puntosRetos', incremento: 50, premio: 75, icono: 'gamepad-2', ruta: 'practica', tramo: 1 },
  { id: 'practica-2', nombre: 'Laboratorio de Retos II', descripcion: 'Obtén 300 XP nuevos en Retos.', fuente: 'puntosRetos', incremento: 150, premio: 250, icono: 'brain-circuit', ruta: 'practica', tramo: 2, requiere: 'practica-1' },
  { id: 'practica-3', nombre: 'Laboratorio de Retos III', descripcion: 'Obtén 600 XP nuevos en Retos.', fuente: 'puntosRetos', incremento: 300, premio: 550, icono: 'microscope', ruta: 'practica', tramo: 3, requiere: 'practica-2' },
] as const;

export interface BeneficioCatalogo {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: 'material' | 'vip' | 'paquete';
  costo: number;
  icono: string;
  destacado?: boolean;
  materialId?: string;
  materialIds?: readonly string[];
  descuento?: number;
  diasVip?: number;
}

/** Solo beneficios cuyo efecto puede cumplirse hoy por la API; no hay premios decorativos. */
export const CATALOGO_BENEFICIOS: readonly BeneficioCatalogo[] = [
  { id: 'material-regulacion-cosmetica', nombre: 'Guía de regulación cosmética', descripcion: 'Acceso permanente al documento disponible en la biblioteca.', categoria: 'material', costo: 200, icono: 'scale', materialId: 'p-1784228079707' },
  { id: 'material-estudios-estabilidad', nombre: 'Estudios de estabilidad cosmética', descripcion: 'Acceso permanente a la guía técnica de estabilidad.', categoria: 'material', costo: 260, icono: 'flask-conical', materialId: 'p-1784228150217' },
  { id: 'material-nutricion-prevencion', nombre: 'Manual de nutrición y prevención', descripcion: 'Acceso permanente al manual de 80 páginas.', categoria: 'material', costo: 450, icono: 'book-open', materialId: 'p-1784234741400', destacado: true },
  { id: 'material-rejuvenecimiento-guia', nombre: 'Guía de rejuvenecimiento facial', descripcion: 'Acceso permanente a la guía educativa disponible.', categoria: 'material', costo: 380, icono: 'sparkles', materialId: 'p-1781110394428' },
  { id: 'material-rejuvenecimiento-manual', nombre: 'Manual de técnicas avanzadas', descripcion: 'Acceso permanente al manual profesional de la biblioteca.', categoria: 'material', costo: 520, icono: 'notebook-tabs', materialId: 'p-1781111073624' },
  { id: 'material-rejuvenecimiento-cuadernillo', nombre: 'Cuadernillo de técnicas avanzadas', descripcion: 'Acceso permanente al cuadernillo complementario.', categoria: 'material', costo: 320, icono: 'clipboard-check', materialId: 'p-1781111152335' },
  { id: 'material-tecnologias-cosmiatria', nombre: 'Tecnologías avanzadas en cosmiatría', descripcion: 'Acceso permanente al PDF de 62 páginas.', categoria: 'material', costo: 560, icono: 'scan-face', materialId: 'p-1778099917040', destacado: true },
  { id: 'material-radiofrecuencia', nombre: 'Radiofrecuencia y ultracavitación', descripcion: 'Acceso permanente al material educativo.', categoria: 'material', costo: 340, icono: 'radio-tower', materialId: 'p-1778099998280' },
  { id: 'material-dermapen', nombre: 'Dermapen · material educativo', descripcion: 'Acceso permanente al PDF de 57 páginas.', categoria: 'material', costo: 500, icono: 'file-text', materialId: 'p-1778100064887' },
  { id: 'vip-1-dia', nombre: 'Pase VIP de 24 horas', descripcion: 'Un día completo de acceso VIP para una sesión intensiva.', categoria: 'vip', costo: 350, icono: 'clock-3', diasVip: 1 },
  { id: 'vip-2-dias', nombre: 'Pase VIP de fin de semana', descripcion: 'Dos días completos para una ruta de estudio concentrada.', categoria: 'vip', costo: 650, icono: 'calendar-days', diasVip: 2 },
  { id: 'vip-3-dias', nombre: '3 días VIP', descripcion: 'Desbloquea cursos, biblioteca y beneficios VIP durante 3 días.', categoria: 'vip', costo: 900, icono: 'crown', diasVip: 3 },
  { id: 'vip-5-dias', nombre: '5 días VIP', descripcion: 'Cinco días para avanzar una ruta con flexibilidad.', categoria: 'vip', costo: 1400, icono: 'calendar-range', diasVip: 5 },
  { id: 'vip-7-dias', nombre: '7 días VIP', descripcion: 'Una semana completa de acceso VIP.', categoria: 'vip', costo: 1800, icono: 'gem', diasVip: 7, destacado: true },
  { id: 'vip-10-dias', nombre: '10 días VIP', descripcion: 'Diez días de acceso para profundizar en varios programas.', categoria: 'vip', costo: 2500, icono: 'calendar-check', diasVip: 10 },
  { id: 'vip-15-dias', nombre: '15 días VIP', descripcion: 'Quince días de acceso VIP para avanzar con mayor profundidad.', categoria: 'vip', costo: 3500, icono: 'badge-check', diasVip: 15 },
  { id: 'vip-30-dias', nombre: '30 días VIP', descripcion: 'Un mes completo de acceso VIP; utiliza el cupo anual disponible.', categoria: 'vip', costo: 6500, icono: 'calendar-heart', diasVip: 30, destacado: true },
  { id: 'paquete-fundamentos-profesionales', nombre: 'Colección Fundamentos Profesionales', descripcion: 'Regulación cosmética, estabilidad y prevención en una colección permanente.', categoria: 'paquete', costo: 760, icono: 'briefcase-business', materialIds: ['p-1784228079707', 'p-1784228150217', 'p-1784234741400'], descuento: 0.16, destacado: true },
  { id: 'paquete-rejuvenecimiento-facial', nombre: 'Colección Rejuvenecimiento Facial', descripcion: 'Guía, manual y cuadernillo avanzado para una ruta editorial completa.', categoria: 'paquete', costo: 990, icono: 'sparkles', materialIds: ['p-1781110394428', 'p-1781111073624', 'p-1781111152335'], descuento: 0.19 },
  { id: 'paquete-tecnologia-aplicada', nombre: 'Colección Tecnología Aplicada', descripcion: 'Tecnologías en cosmiatría, radiofrecuencia y Dermapen en acceso permanente.', categoria: 'paquete', costo: 1140, icono: 'scan-face', materialIds: ['p-1778099917040', 'p-1778099998280', 'p-1778100064887'], descuento: 0.19 },
  { id: 'paquete-biblioteca-completa', nombre: 'Biblioteca Dermalysse Completa', descripcion: 'Los nueve materiales disponibles en una sola colección con ahorro preferente.', categoria: 'paquete', costo: 2860, icono: 'library-big', materialIds: ['p-1784228079707', 'p-1784228150217', 'p-1784234741400', 'p-1781110394428', 'p-1781111073624', 'p-1781111152335', 'p-1778099917040', 'p-1778099998280', 'p-1778100064887'], descuento: 0.19, destacado: true },
] as const;

interface PremioNivelCatalogo {
  nivelId: Exclude<NivelPuntos['id'], 'descubrimiento'>;
  descripcion: string;
  opciones: readonly [string, string];
}

/** Cada nivel permite elegir una sola recompensa real; la elección queda registrada de forma permanente. */
const PREMIOS_NIVEL: readonly PremioNivelCatalogo[] = [
  { nivelId: 'constancia', descripcion: 'Celebra tu primer ritmo sostenido.', opciones: ['vip-1-dia', 'material-regulacion-cosmetica'] },
  { nivelId: 'criterio', descripcion: 'Convierte tu trayectoria sólida en un beneficio.', opciones: ['vip-2-dias', 'material-estudios-estabilidad'] },
  { nivelId: 'circulo', descripcion: 'Un reconocimiento para participación avanzada.', opciones: ['vip-3-dias', 'material-nutricion-prevencion'] },
  { nivelId: 'curaduria', descripcion: 'Elige flexibilidad VIP o una pieza avanzada.', opciones: ['vip-5-dias', 'material-rejuvenecimiento-manual'] },
  { nivelId: 'legado', descripcion: 'Un beneficio de alto valor para una gran trayectoria.', opciones: ['vip-7-dias', 'material-tecnologias-cosmiatria'] },
  { nivelId: 'maestria', descripcion: 'Una colección o acceso amplio para una participación excepcional.', opciones: ['vip-10-dias', 'paquete-rejuvenecimiento-facial'] },
  { nivelId: 'icono', descripcion: 'La elección más alta del ecosistema Dermalysse.', opciones: ['vip-15-dias', 'paquete-biblioteca-completa'] },
] as const;

interface Acreditado { clases: number; cursos: number; certificados: number; puntosRetos: number; rachaRetos: number }
interface MisionGuardada {
  estado: 'activa' | 'completada';
  base: number;
  objetivo: number;
  activadaEn: string;
  completadaEn: string | null;
}
interface PremioNivelGuardado { beneficioId: string; canjeadoEn: string }
interface ResumenGuardado {
  uid: string;
  saldo: number;
  experiencia: number;
  ganados: number;
  gastados: number;
  canjes: number;
  acreditado: Acreditado;
  hitos: string[];
  misiones: Record<string, MisionGuardada>;
  premiosNivel: Record<string, PremioNivelGuardado>;
  objetivoElegido: string | null;
  favoritos: string[];
  bienvenidaAcreditada: boolean;
  vipDiasPorAnio: Record<string, number>;
  actualizado: string;
}

export interface ResumenPuntos {
  saldo: number;
  experiencia: number;
  ganados: number;
  gastados: number;
  nivel: NivelPuntos;
  progresoNivel: number;
  puntosSiguienteNivel: number | null;
  moneda: { nombre: 'Diamantes Dermalysse'; singular: 'diamante'; plural: 'diamantes'; icono: 'gem' };
  recompensaInicial: { nombre: 'Cofre de bienvenida'; diamantes: number; acreditada: boolean; descripcion: string };
  reglas: { clases: number; cursos: number; certificados: number; retos: string };
  metricas: { clases: number; cursos: number; certificados: number; xpRetos: number; rachaRetos: number };
}

export interface HitoPuntos {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  rareza: HitoCatalogo['rareza'];
  progreso: number;
  meta: number;
  porcentaje: number;
  premio: number;
  completado: boolean;
}

export interface ColeccionPuntos {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  progreso: number;
  meta: number;
  porcentaje: number;
  completado: boolean;
}

export interface ObjetivoPuntos {
  beneficioId: string;
  nombre: string;
  costo: number;
  faltan: number;
  porcentaje: number;
  clasesEquivalentes: number;
  cursosEquivalentes: number;
  personalizado: boolean;
}

export interface MisionPuntos {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  ruta: MisionCatalogo['ruta'];
  tramo: number;
  premio: number;
  progreso: number;
  meta: number;
  porcentaje: number;
  estado: 'disponible' | 'bloqueada' | 'activa' | 'completada';
  puedeActivar: boolean;
  motivo: string | null;
  activadaEn: string | null;
  completadaEn: string | null;
}

export interface NivelPublico extends NivelPuntos {
  alcanzado: boolean;
  actual: boolean;
}

export interface MovimientoPuntos {
  id: string;
  tipo: 'ganado' | 'canje';
  puntos: number;
  concepto: string;
  detalle: string;
  fecha: string;
}

export interface BeneficioPublico extends BeneficioCatalogo {
  costoOriginal: number;
  ahorro: number;
  faltanMateriales: number;
  incluye: string[];
  esObjetivo: boolean;
  esFavorito: boolean;
  disponible: boolean;
  canjeado: boolean;
  puedeCanjear: boolean;
  motivo: string | null;
}

export interface CanjePuntos {
  id: string;
  beneficioId: string;
  nombre: string;
  categoria: 'material' | 'vip' | 'paquete';
  costo: number;
  fecha: string;
  materialId: string | null;
  materialIds?: string[];
  diasVip: number | null;
  vigenciaHasta: string | null;
  origen?: 'puntos' | 'nivel';
  origenId?: string | null;
  costoOriginal?: number;
  ahorro?: number;
}

export interface CotizacionAtelier {
  materialIds: string[];
  materiales: Array<{ materialId: string; beneficioId: string; nombre: string; icono: string; costo: number }>;
  cantidad: number;
  descuento: number;
  costoOriginal: number;
  costo: number;
  ahorro: number;
  saldo: number;
  faltan: number;
  puedeCanjear: boolean;
}

export interface InteligenciaPuntos {
  ultimos30Dias: { ganados: number; gastados: number; balance: number };
  valorCanjeado: number;
  ahorroAcumulado: number;
  materialesPermanentes: number;
  diasVipEntregados: number;
  promedioSemanalObservado: number;
  historialMensual: Array<{ mes: string; ganados: number; gastados: number }>;
  distribucionCanjes: { materiales: number; colecciones: number; vip: number; premiosNivel: number };
}

export interface PremioNivelPublico {
  nivelId: PremioNivelCatalogo['nivelId'];
  nivelNombre: string;
  desde: number;
  descripcion: string;
  desbloqueado: boolean;
  canjeado: boolean;
  puedeCanjear: boolean;
  canjeadoEn: string | null;
  beneficioElegido: string | null;
  opciones: Array<Pick<BeneficioPublico, 'id' | 'nombre' | 'descripcion' | 'categoria' | 'icono' | 'diasVip' | 'faltanMateriales' | 'disponible' | 'canjeado' | 'motivo'>>;
}

export interface PanelPuntos {
  puntos: ResumenPuntos;
  boutique: BeneficioPublico[];
  movimientos: MovimientoPuntos[];
  canjes: CanjePuntos[];
  hitos: HitoPuntos[];
  misiones: MisionPuntos[];
  niveles: NivelPublico[];
  premiosNivel: PremioNivelPublico[];
  colecciones: ColeccionPuntos[];
  objetivo: ObjetivoPuntos | null;
  favoritos: BeneficioPublico[];
  atelier: { minimo: 2; maximo: 5; descuentos: Array<{ cantidad: number; porcentaje: number }>; materiales: Array<Pick<BeneficioPublico, 'id' | 'materialId' | 'nombre' | 'descripcion' | 'icono' | 'costo'>> };
  inteligencia: InteligenciaPuntos;
  vipAnual: { anio: number; usados: number; disponibles: number; limite: number };
  proximasFormasDeGanar: { nombre: string; estado: string; descripcion: string }[];
}

export interface CuentaPuntosAdmin {
  uid: string;
  nombre: string;
  email: string;
  saldo: number;
  experiencia: number;
  ganados: number;
  gastados: number;
  canjes: number;
  bienvenidaAcreditada: boolean;
  nivel: Pick<NivelPuntos, 'id' | 'nombre' | 'desde' | 'siguiente'>;
  actualizado: string;
}

export interface ResumenPuntosAdmin {
  moneda: { nombre: 'Diamantes Dermalysse'; icono: 'gem' };
  cuentas: number;
  saldoCirculante: number;
  diamantesGanados: number;
  diamantesGastados: number;
  canjes: number;
  materialesPermanentes: number;
  diasVipEntregados: number;
  cofresBienvenida: number;
  catalogo: { total: number; materiales: number; colecciones: number; pasesVip: number };
  movimientosRecientes: Array<MovimientoPuntos & { uid: string }>;
  canjesRecientes: Array<CanjePuntos & { uid: string }>;
}

export interface DetallePuntosAdmin {
  cuenta: CuentaPuntosAdmin;
  movimientos: MovimientoPuntos[];
  canjes: CanjePuntos[];
  materialesPermanentes: number;
}

const entero = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
const mapa = (v: unknown): Datos => typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Datos : {};

function identidadAdmin(user?: Datos, member?: Datos): { nombre: string; email: string } {
  const email = texto(user?.email) || texto(member?.email);
  const nombreUser = [texto(user?.name), texto(user?.lastname)].filter(Boolean).join(' ').trim();
  return { nombre: nombreUser || texto(member?.name).trim() || email.split('@')[0] || 'Sin nombre', email };
}

function cuentaAdmin(uid: string, d: Datos | undefined, user?: Datos, member?: Datos): CuentaPuntosAdmin {
  const resumen = resumenDesdeDoc(uid, d);
  const nivel = nivelDe(resumen.experiencia);
  return {
    uid,
    ...identidadAdmin(user, member),
    saldo: resumen.saldo,
    experiencia: resumen.experiencia,
    ganados: resumen.ganados,
    gastados: resumen.gastados,
    canjes: resumen.canjes,
    bienvenidaAcreditada: resumen.bienvenidaAcreditada,
    nivel: { id: nivel.id, nombre: nivel.nombre, desde: nivel.desde, siguiente: nivel.siguiente },
    actualizado: resumen.actualizado,
  };
}

function resumenDesdeDoc(uid: string, d: Datos | undefined): ResumenGuardado {
  const acreditado = mapa(d?.acreditado);
  const vip = mapa(d?.vipDiasPorAnio);
  const misionesCrudas = mapa(d?.misiones);
  const premiosCrudos = mapa(d?.premiosNivel);
  const misiones: Record<string, MisionGuardada> = {};
  for (const [id, valor] of Object.entries(misionesCrudas)) {
    if (!MISIONES.some((m) => m.id === id)) continue;
    const m = mapa(valor);
    if (m.estado !== 'activa' && m.estado !== 'completada') continue;
    misiones[id] = {
      estado: m.estado,
      base: entero(m.base), objetivo: entero(m.objetivo),
      activadaEn: texto(m.activadaEn), completadaEn: texto(m.completadaEn) || null,
    };
  }
  const premiosNivel: Record<string, PremioNivelGuardado> = {};
  for (const [nivelId, valor] of Object.entries(premiosCrudos)) {
    const premio = PREMIOS_NIVEL.find((p) => p.nivelId === nivelId);
    const guardado = mapa(valor);
    const beneficioId = texto(guardado.beneficioId);
    if (!premio || !premio.opciones.includes(beneficioId)) continue;
    premiosNivel[nivelId] = { beneficioId, canjeadoEn: texto(guardado.canjeadoEn) };
  }
  const objetivoElegido = texto(d?.objetivoElegido);
  const favoritos = Array.isArray(d?.favoritos)
    ? [...new Set(d.favoritos.map(texto).filter((id) => CATALOGO_BENEFICIOS.some((b) => b.id === id)))].slice(0, 5)
    : [];
  return {
    uid,
    saldo: entero(d?.saldo), experiencia: entero(d?.experiencia), ganados: entero(d?.ganados), gastados: entero(d?.gastados), canjes: entero(d?.canjes),
    acreditado: { clases: entero(acreditado.clases), cursos: entero(acreditado.cursos), certificados: entero(acreditado.certificados), puntosRetos: entero(acreditado.puntosRetos), rachaRetos: entero(acreditado.rachaRetos) },
    hitos: Array.isArray(d?.hitos) ? [...new Set(d.hitos.map(texto).filter(Boolean))] : [],
    misiones,
    premiosNivel,
    objetivoElegido: CATALOGO_BENEFICIOS.some((b) => b.id === objetivoElegido) ? objetivoElegido : null,
    favoritos,
    bienvenidaAcreditada: d?.bienvenidaAcreditada === true,
    vipDiasPorAnio: Object.fromEntries(Object.entries(vip).filter(([k]) => /^\d{4}$/.test(k)).map(([k, v]) => [k, entero(v)])),
    actualizado: texto(d?.actualizado),
  };
}

export function nivelDe(experiencia: number): NivelPuntos {
  let i = 0;
  for (let n = 1; n < NIVELES.length; n += 1) if (experiencia >= NIVELES[n].desde) i = n;
  const actual = NIVELES[i];
  return { ...actual, siguiente: NIVELES[i + 1]?.desde ?? null };
}

function resumenPublico(d: ResumenGuardado): ResumenPuntos {
  const nivel = nivelDe(d.experiencia);
  const rango = nivel.siguiente === null ? 1 : nivel.siguiente - nivel.desde;
  return {
    saldo: d.saldo, experiencia: d.experiencia, ganados: d.ganados, gastados: d.gastados, nivel,
    progresoNivel: nivel.siguiente === null ? 100 : Math.min(100, Math.round(((d.experiencia - nivel.desde) / rango) * 100)),
    puntosSiguienteNivel: nivel.siguiente === null ? null : Math.max(0, nivel.siguiente - d.experiencia),
    moneda: { nombre: 'Diamantes Dermalysse', singular: 'diamante', plural: 'diamantes', icono: 'gem' },
    recompensaInicial: {
      nombre: 'Cofre de bienvenida', diamantes: DIAMANTES_BIENVENIDA, acreditada: d.bienvenidaAcreditada,
      descripcion: 'Saldo inicial real para elegir un material permanente o un pase VIP de 24 horas.',
    },
    reglas: { clases: PUNTOS_POR_CLASE, cursos: PUNTOS_POR_CURSO, certificados: PUNTOS_POR_CERTIFICADO, retos: `1 diamante por cada ${XP_RETO_POR_PUNTO} XP verificados` },
    metricas: { clases: d.acreditado.clases, cursos: d.acreditado.cursos, certificados: d.acreditado.certificados, xpRetos: d.acreditado.puntosRetos * XP_RETO_POR_PUNTO, rachaRetos: d.acreditado.rachaRetos },
  };
}

function hitosPublicos(d: ResumenGuardado): HitoPuntos[] {
  const completados = new Set(d.hitos);
  return HITOS.map((h) => {
    const progreso = Math.min(h.meta, d.acreditado[h.fuente]);
    return { ...h, progreso, porcentaje: Math.min(100, Math.round((progreso / h.meta) * 100)), completado: completados.has(h.id) };
  });
}

function coleccionesPublicas(materiales: number): ColeccionPuntos[] {
  const catalogo = [
    { id: 'primera-pieza', nombre: 'Primera pieza', descripcion: 'Tu primera obra permanente en la biblioteca.', icono: 'bookmark-check', meta: 1 },
    { id: 'biblioteca-profesional', nombre: 'Biblioteca profesional', descripcion: 'Una selección personal de 3 recursos.', icono: 'library', meta: 3 },
    { id: 'archivo-experto', nombre: 'Archivo experto', descripcion: 'Una colección avanzada de 6 recursos.', icono: 'library', meta: 6 },
    { id: 'coleccion-completa', nombre: 'Colección Dermalysse', descripcion: 'Los 9 materiales de la boutique en tu cuenta.', icono: 'gem', meta: 9 },
  ] as const;
  return catalogo.map((c) => ({ ...c, progreso: Math.min(c.meta, materiales), porcentaje: Math.min(100, Math.round((materiales / c.meta) * 100)), completado: materiales >= c.meta }));
}

function misionesPublicas(d: ResumenGuardado): MisionPuntos[] {
  return MISIONES.map((m) => {
    const guardada = d.misiones[m.id];
    const requisitoListo = !m.requiere || d.misiones[m.requiere]?.estado === 'completada';
    const estado: MisionPuntos['estado'] = guardada ? guardada.estado : requisitoListo ? 'disponible' : 'bloqueada';
    const progreso = guardada ? Math.min(m.incremento, Math.max(0, d.acreditado[m.fuente] - guardada.base)) : 0;
    return {
      id: m.id, nombre: m.nombre, descripcion: m.descripcion, icono: m.icono, ruta: m.ruta, tramo: m.tramo,
      premio: m.premio, progreso, meta: m.incremento, porcentaje: Math.min(100, Math.round((progreso / m.incremento) * 100)),
      estado, puedeActivar: estado === 'disponible',
      motivo: estado === 'bloqueada' ? 'Completa el tramo anterior para desbloquearla.' : null,
      activadaEn: guardada?.activadaEn || null, completadaEn: guardada?.completadaEn || null,
    };
  });
}

function nivelesPublicos(experiencia: number): NivelPublico[] {
  const actual = nivelDe(experiencia).id;
  return NIVELES.map((nivel, i) => ({ ...nivel, siguiente: NIVELES[i + 1]?.desde ?? null, alcanzado: experiencia >= nivel.desde, actual: nivel.id === actual }));
}

const materialesDe = (beneficio: BeneficioCatalogo): string[] => beneficio.materialId
  ? [beneficio.materialId]
  : [...(beneficio.materialIds ?? [])];

const materialPorId = (materialId: string) => CATALOGO_BENEFICIOS.find((b) => b.categoria === 'material' && b.materialId === materialId);

const DESCUENTOS_ATELIER = [
  { cantidad: 2, porcentaje: 8 },
  { cantidad: 3, porcentaje: 12 },
  { cantidad: 4, porcentaje: 16 },
  { cantidad: 5, porcentaje: 20 },
] as const;

function idsAtelier(valor: unknown): string[] {
  if (!Array.isArray(valor)) throw new CodedError(400, 'atelier/seleccion-invalida', 'Selecciona entre 2 y 5 materiales.');
  const ids = valor.map(texto).map((id) => id.trim()).filter(Boolean);
  if (ids.length < 2 || ids.length > 5 || new Set(ids).size !== ids.length) {
    throw new CodedError(400, 'atelier/seleccion-invalida', 'Selecciona entre 2 y 5 materiales distintos.');
  }
  if (ids.some((id) => !materialPorId(id))) throw new CodedError(400, 'atelier/material-invalido', 'La selección contiene un material que no pertenece al Atelier.');
  return ids;
}

function cotizacionAtelier(materialIds: string[], saldo: number): CotizacionAtelier {
  const materiales = materialIds.map((materialId) => {
    const beneficio = materialPorId(materialId)!;
    return { materialId, beneficioId: beneficio.id, nombre: beneficio.nombre, icono: beneficio.icono, costo: beneficio.costo };
  });
  const costoOriginal = materiales.reduce((total, material) => total + material.costo, 0);
  const descuento = DESCUENTOS_ATELIER.find((regla) => regla.cantidad === materiales.length)!.porcentaje;
  const costo = Math.max(10, Math.round((costoOriginal * (1 - descuento / 100)) / 10) * 10);
  return {
    materialIds, materiales, cantidad: materiales.length, descuento, costoOriginal, costo,
    ahorro: Math.max(0, costoOriginal - costo), saldo, faltan: Math.max(0, costo - saldo), puedeCanjear: saldo >= costo,
  };
}

function inteligenciaPuntos(movimientos: MovimientoPuntos[], canjes: CanjePuntos[], materialesPermanentes: number, ahora: Date): InteligenciaPuntos {
  const desde30 = ahora.getTime() - 30 * 86_400_000;
  const recientes = movimientos.filter((m) => Number.isFinite(Date.parse(m.fecha)) && Date.parse(m.fecha) >= desde30);
  const ganados30 = recientes.filter((m) => m.puntos > 0).reduce((total, m) => total + m.puntos, 0);
  const gastados30 = Math.abs(recientes.filter((m) => m.puntos < 0).reduce((total, m) => total + m.puntos, 0));
  const meses: Array<{ mes: string; ganados: number; gastados: number }> = [];
  for (let i = 5; i >= 0; i -= 1) {
    const fecha = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - i, 1));
    meses.push({ mes: `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`, ganados: 0, gastados: 0 });
  }
  const porMes = new Map(meses.map((mes) => [mes.mes, mes]));
  for (const movimiento of movimientos) {
    const fecha = new Date(movimiento.fecha);
    if (!Number.isFinite(fecha.getTime())) continue;
    const mes = porMes.get(`${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`);
    if (!mes) continue;
    if (movimiento.puntos > 0) mes.ganados += movimiento.puntos;
    else mes.gastados += Math.abs(movimiento.puntos);
  }
  return {
    ultimos30Dias: { ganados: ganados30, gastados: gastados30, balance: ganados30 - gastados30 },
    valorCanjeado: canjes.reduce((total, canje) => total + entero(canje.costo), 0),
    ahorroAcumulado: canjes.reduce((total, canje) => total + entero(canje.ahorro), 0),
    materialesPermanentes,
    diasVipEntregados: canjes.reduce((total, canje) => total + entero(canje.diasVip), 0),
    promedioSemanalObservado: Math.round(ganados30 / (30 / 7)),
    historialMensual: meses,
    distribucionCanjes: {
      materiales: canjes.filter((c) => c.categoria === 'material').length,
      colecciones: canjes.filter((c) => c.categoria === 'paquete').length,
      vip: canjes.filter((c) => c.categoria === 'vip').length,
      premiosNivel: canjes.filter((c) => c.origen === 'nivel').length,
    },
  };
}

function precioBeneficio(beneficio: BeneficioCatalogo, materialesCanjeados: Set<string>): { costo: number; costoOriginal: number; ahorro: number; faltantes: string[]; incluye: string[] } {
  const ids = materialesDe(beneficio);
  const faltantes = ids.filter((id) => !materialesCanjeados.has(id));
  const incluye = ids.map((id) => materialPorId(id)?.nombre ?? id);
  if (beneficio.categoria !== 'paquete') return { costo: beneficio.costo, costoOriginal: beneficio.costo, ahorro: 0, faltantes, incluye };
  const costoOriginal = faltantes.reduce((total, id) => total + (materialPorId(id)?.costo ?? 0), 0);
  const totalOriginal = ids.reduce((total, id) => total + (materialPorId(id)?.costo ?? 0), 0);
  const proporcion = totalOriginal > 0 ? beneficio.costo / totalOriginal : 1 - (beneficio.descuento ?? 0);
  const costo = faltantes.length ? Math.max(10, Math.round((costoOriginal * proporcion) / 10) * 10) : 0;
  return { costo, costoOriginal, ahorro: Math.max(0, costoOriginal - costo), faltantes, incluye };
}

function premiosNivelPublicos(resumen: ResumenGuardado, boutique: BeneficioPublico[]): PremioNivelPublico[] {
  return PREMIOS_NIVEL.map((premio) => {
    const nivel = NIVELES.find((n) => n.id === premio.nivelId)!;
    const guardado = resumen.premiosNivel[premio.nivelId];
    const opciones = premio.opciones.map((id) => {
      const b = boutique.find((beneficio) => beneficio.id === id);
      const catalogo = CATALOGO_BENEFICIOS.find((beneficio) => beneficio.id === id)!;
      return b ? {
        id: b.id, nombre: b.nombre, descripcion: b.descripcion, categoria: b.categoria, icono: b.icono, diasVip: b.diasVip,
        faltanMateriales: b.faltanMateriales, disponible: b.disponible, canjeado: b.canjeado,
        motivo: b.canjeado ? 'Este beneficio ya forma parte de tu cuenta.' : b.motivo,
      } : {
        id: catalogo.id, nombre: catalogo.nombre, descripcion: catalogo.descripcion, categoria: catalogo.categoria, icono: catalogo.icono,
        diasVip: catalogo.diasVip, faltanMateriales: materialesDe(catalogo).length, disponible: false, canjeado: false,
        motivo: 'Este beneficio todavía no está disponible.',
      };
    });
    const desbloqueado = resumen.experiencia >= nivel.desde;
    return {
      nivelId: premio.nivelId, nivelNombre: nivel.nombre, desde: nivel.desde, descripcion: premio.descripcion,
      desbloqueado, canjeado: !!guardado, puedeCanjear: desbloqueado && !guardado && opciones.some((o) => o.disponible && !o.canjeado),
      canjeadoEn: guardado?.canjeadoEn ?? null, beneficioElegido: guardado?.beneficioId ?? null, opciones,
    };
  });
}

const rutaResumen = (uid: string) => `${COLECCION_PUNTOS}/${segmento(uid)}`;
const idMovimiento = (uid: string, tipo: string, desde: number, hasta: number) => segmento(`${uid}__${tipo}__${desde + 1}-${hasta}`);

export class PuntosService {
  constructor(private readonly db: FirestorePort, private readonly ahora: () => Date) {}

  /** Vista operativa para administración. No reconcilia cuentas ni acredita premios por el solo hecho de consultarla. */
  async adminResumen(): Promise<ResumenPuntosAdmin> {
    const [cuentasDocs, movimientosDocs, canjesDocs, beneficiosDocs] = await Promise.all([
      this.db.query(COLECCION_PUNTOS, { limit: 1000 }),
      this.db.query(COLECCION_MOVIMIENTOS, { limit: 1000 }),
      this.db.query(COLECCION_CANJES_PUNTOS, { limit: 1000 }),
      this.db.query(COLECCION_BENEFICIOS, { limit: 1000 }),
    ]);
    const cuentas = cuentasDocs.map((doc) => resumenDesdeDoc(doc.id, doc.data()));
    const movimientosRecientes = movimientosDocs
      .map((doc) => ({ id: doc.id, ...(doc.data() ?? {}) } as MovimientoPuntos & { uid: string }))
      .sort((a, b) => texto(b.fecha).localeCompare(texto(a.fecha)))
      .slice(0, 12);
    const canjesTodos = canjesDocs.map((doc) => ({ id: doc.id, ...(doc.data() ?? {}) } as CanjePuntos & { uid: string }));
    const canjesRecientes = [...canjesTodos].sort((a, b) => texto(b.fecha).localeCompare(texto(a.fecha))).slice(0, 12);
    return {
      moneda: { nombre: 'Diamantes Dermalysse', icono: 'gem' },
      cuentas: cuentas.length,
      saldoCirculante: cuentas.reduce((total, cuenta) => total + cuenta.saldo, 0),
      diamantesGanados: cuentas.reduce((total, cuenta) => total + cuenta.ganados, 0),
      diamantesGastados: cuentas.reduce((total, cuenta) => total + cuenta.gastados, 0),
      canjes: canjesTodos.length,
      materialesPermanentes: beneficiosDocs.length,
      diasVipEntregados: canjesTodos.reduce((total, canje) => total + entero(canje.diasVip), 0),
      cofresBienvenida: cuentas.filter((cuenta) => cuenta.bienvenidaAcreditada).length,
      catalogo: {
        total: CATALOGO_BENEFICIOS.length,
        materiales: CATALOGO_BENEFICIOS.filter((beneficio) => beneficio.categoria === 'material').length,
        colecciones: CATALOGO_BENEFICIOS.filter((beneficio) => beneficio.categoria === 'paquete').length,
        pasesVip: CATALOGO_BENEFICIOS.filter((beneficio) => beneficio.categoria === 'vip').length,
      },
      movimientosRecientes,
      canjesRecientes,
    };
  }

  /** Cuentas registradas en Firestore, incluidas las que todavía no han abierto su cofre de bienvenida. */
  async adminCuentas(): Promise<CuentaPuntosAdmin[]> {
    const [usuariosDocs, miembrosDocs, puntosDocs] = await Promise.all([
      this.db.query('users', { limit: 1000 }),
      this.db.query('members', { limit: 1000 }),
      this.db.query(COLECCION_PUNTOS, { limit: 1000 }),
    ]);
    const usuarios = new Map(usuariosDocs.map((doc) => [doc.id, doc.data()]));
    const miembros = new Map(miembrosDocs.map((doc) => [doc.id, doc.data()]));
    const puntos = new Map(puntosDocs.map((doc) => [doc.id, doc.data()]));
    const uids = new Set([...usuarios.keys(), ...miembros.keys(), ...puntos.keys()]);
    return [...uids]
      .map((uid) => cuentaAdmin(uid, puntos.get(uid), usuarios.get(uid), miembros.get(uid)))
      .sort((a, b) => b.actualizado.localeCompare(a.actualizado) || a.nombre.localeCompare(b.nombre, 'es'));
  }

  async adminCuenta(uidCrudo: string): Promise<DetallePuntosAdmin> {
    const uid = segmento(uidCrudo);
    const [usuario, miembro, puntos, movimientosDocs, canjesDocs, beneficios] = await Promise.all([
      this.db.get(`users/${uid}`),
      this.db.get(`members/${uid}`),
      this.db.get(rutaResumen(uid)),
      this.db.query(COLECCION_MOVIMIENTOS, { where: [{ campo: 'uid', op: '==', valor: uid }], limit: 200 }),
      this.db.query(COLECCION_CANJES_PUNTOS, { where: [{ campo: 'uid', op: '==', valor: uid }], limit: 200 }),
      this.db.query(COLECCION_BENEFICIOS, { where: [{ campo: 'uid', op: '==', valor: uid }], limit: 200 }),
    ]);
    if (!usuario.exists && !miembro.exists && !puntos.exists) throw new NotFoundError('Cuenta no encontrada.');
    const movimientos = movimientosDocs
      .map((doc) => ({ id: doc.id, ...(doc.data() ?? {}) } as MovimientoPuntos))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const canjes = canjesDocs
      .map((doc) => ({ id: doc.id, ...(doc.data() ?? {}) } as CanjePuntos))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    return {
      cuenta: cuentaAdmin(uid, puntos.data(), usuario.data(), miembro.data()),
      movimientos,
      canjes,
      materialesPermanentes: beneficios.length,
    };
  }

  /** Ajuste manual excepcional, con motivo, idempotencia y bitácora inmutable separada del libro mayor visible. */
  async adminAjustar(admin: Usuario, cuerpoDesconocido: unknown): Promise<{ ok: true; repetido: boolean; cuenta: CuentaPuntosAdmin; movimiento: MovimientoPuntos }> {
    const cuerpo = mapa(cuerpoDesconocido);
    const uid = texto(cuerpo.uid).trim();
    const diamantes = Number(cuerpo.diamantes);
    const motivo = texto(cuerpo.motivo).trim();
    const idempotencia = texto(cuerpo.idempotencia).trim();
    if (!uid) throw new CodedError(400, 'puntos/ajuste-invalido', 'Selecciona una cuenta.');
    try { segmento(uid); } catch { throw new NotFoundError('Cuenta no encontrada.'); }
    if (!Number.isInteger(diamantes) || diamantes === 0 || Math.abs(diamantes) > 10_000) {
      throw new CodedError(400, 'puntos/ajuste-invalido', 'El ajuste debe ser un entero distinto de cero, entre -10000 y 10000 diamantes.');
    }
    if (motivo.length < 10 || motivo.length > 240) {
      throw new CodedError(400, 'puntos/motivo-invalido', 'Escribe un motivo de 10 a 240 caracteres.');
    }
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(idempotencia)) {
      throw new CodedError(400, 'puntos/idempotencia-invalida', 'La referencia de idempotencia no es válida.');
    }
    const [usuario, miembro] = await Promise.all([this.db.get(`users/${segmento(uid)}`), this.db.get(`members/${segmento(uid)}`)]);
    if (!usuario.exists && !miembro.exists) throw new NotFoundError('Cuenta no encontrada.');

    // Conserva la conciliación normal (incluido el cofre de bienvenida) antes del ajuste extraordinario.
    await this.sincronizar(uid);
    const fecha = this.ahora().toISOString();
    const movimientoId = segmento(`${uid}__admin__${idempotencia}`);
    const resultado = await this.db.runTransaction(async (tx) => {
      const resumenRuta = rutaResumen(uid);
      const movimientoRuta = `${COLECCION_MOVIMIENTOS}/${movimientoId}`;
      const bitacoraRuta = `${COLECCION_BITACORA_ADMIN_PUNTOS}/${movimientoId}`;
      const [resumenDoc, movimientoDoc] = await Promise.all([tx.get(resumenRuta), tx.get(movimientoRuta)]);
      const resumen = resumenDesdeDoc(uid, resumenDoc.data());
      if (movimientoDoc.exists) {
        const previo = movimientoDoc.data() ?? {};
        if (Number(previo.puntos) !== diamantes || texto(previo.detalle) !== motivo) {
          throw new CodedError(409, 'puntos/idempotencia-reutilizada', 'Esa referencia ya fue utilizada con un ajuste diferente.');
        }
        return { repetido: true, movimiento: { id: movimientoId, ...previo } as MovimientoPuntos };
      }
      if (resumen.saldo + diamantes < 0) {
        throw new CodedError(409, 'puntos/saldo-negativo', `La cuenta solo tiene ${resumen.saldo} diamantes disponibles.`, { saldo: resumen.saldo });
      }
      const movimiento: MovimientoPuntos = {
        id: movimientoId,
        tipo: diamantes > 0 ? 'ganado' : 'canje',
        puntos: diamantes,
        concepto: diamantes > 0 ? 'Ajuste administrativo · crédito' : 'Ajuste administrativo · débito',
        detalle: motivo,
        fecha,
      };
      tx.set(resumenRuta, {
        ...resumen,
        saldo: resumen.saldo + diamantes,
        ganados: resumen.ganados + Math.max(0, diamantes),
        gastados: resumen.gastados + Math.max(0, -diamantes),
        actualizado: fecha,
      });
      tx.set(movimientoRuta, { uid, ...movimiento, referencia: `admin:${idempotencia}` });
      tx.set(bitacoraRuta, {
        tipo: 'ajuste_diamantes', uid, diamantes, motivo, idempotencia,
        actorUid: admin.uid, actorEmail: admin.email, fecha,
      });
      return { repetido: false, movimiento };
    });
    return { ok: true, repetido: resultado.repetido, cuenta: (await this.adminCuenta(uid)).cuenta, movimiento: resultado.movimiento };
  }

  /** Reconcilia actividad histórica y nueva. Los contadores acreditados hacen la operación idempotente. */
  async sincronizar(uid: string): Promise<ResumenGuardado> {
    const metricas = await leerMetricasVip(this.db, uid);
    const objetivos: Acreditado = {
      clases: metricas.clasesVistas,
      cursos: metricas.cursosCompletados,
      certificados: metricas.certificados,
      puntosRetos: Math.floor(metricas.xpRetos / XP_RETO_POR_PUNTO),
      rachaRetos: metricas.rachaRetos,
    };
    const fecha = this.ahora().toISOString();
    return this.db.runTransaction(async (tx) => {
      const ruta = rutaResumen(uid);
      const documento = await tx.get(ruta);
      const previo = resumenDesdeDoc(uid, documento.data());
      const fuentes = [
        { k: 'clases' as const, nombre: 'Clases acreditadas', detalle: `${PUNTOS_POR_CLASE} diamantes por clase`, factor: PUNTOS_POR_CLASE },
        { k: 'cursos' as const, nombre: 'Cursos completados', detalle: `${PUNTOS_POR_CURSO} diamantes por curso`, factor: PUNTOS_POR_CURSO },
        { k: 'certificados' as const, nombre: 'Certificados obtenidos', detalle: `${PUNTOS_POR_CERTIFICADO} diamantes por certificado válido`, factor: PUNTOS_POR_CERTIFICADO },
        { k: 'puntosRetos' as const, nombre: 'Práctica en Retos', detalle: `Conversión de XP verificado por servidor`, factor: 1 },
      ];
      let ganadosAhora = 0;
      let bonoBienvenida = 0;
      let bienvenidaAcreditada = previo.bienvenidaAcreditada;
      if (!bienvenidaAcreditada) {
        bonoBienvenida = DIAMANTES_BIENVENIDA;
        bienvenidaAcreditada = true;
        tx.set(`${COLECCION_MOVIMIENTOS}/${segmento(`${uid}__cofre-bienvenida`)}`, {
          uid, tipo: 'ganado', puntos: bonoBienvenida, concepto: 'Cofre de bienvenida',
          detalle: `${bonoBienvenida} Diamantes Dermalysse para elegir tu primer beneficio real`, fecha,
          referencia: 'bienvenida:cofre-inicial',
        });
      }
      const acreditado = { ...previo.acreditado };
      for (const f of fuentes) {
        const desde = acreditado[f.k];
        const hasta = Math.max(desde, objetivos[f.k]);
        const puntos = (hasta - desde) * f.factor;
        if (puntos > 0) {
          ganadosAhora += puntos;
          tx.set(`${COLECCION_MOVIMIENTOS}/${idMovimiento(uid, f.k, desde, hasta)}`, {
            uid, tipo: 'ganado', puntos, concepto: f.nombre, detalle: f.detalle, fecha,
            referencia: `${f.k}:${desde + 1}-${hasta}`,
          });
          acreditado[f.k] = hasta;
        }
      }
      const rachaAnterior = acreditado.rachaRetos;
      acreditado.rachaRetos = Math.max(acreditado.rachaRetos, objetivos.rachaRetos);
      const hitos = [...previo.hitos];
      for (const hito of HITOS) {
        if (hitos.includes(hito.id) || acreditado[hito.fuente] < hito.meta) continue;
        hitos.push(hito.id);
        ganadosAhora += hito.premio;
        tx.set(`${COLECCION_MOVIMIENTOS}/${segmento(`${uid}__hito__${hito.id}`)}`, {
          uid, tipo: 'ganado', puntos: hito.premio, concepto: `Bono de hito · ${hito.nombre}`,
          detalle: 'Premio vitalicio acreditado automáticamente', fecha, referencia: `hito:${hito.id}`,
        });
      }
      const misiones = { ...previo.misiones };
      for (const mision of MISIONES) {
        const guardada = misiones[mision.id];
        if (!guardada || guardada.estado !== 'activa' || acreditado[mision.fuente] < guardada.objetivo) continue;
        misiones[mision.id] = { ...guardada, estado: 'completada', completadaEn: fecha };
        ganadosAhora += mision.premio;
        tx.set(`${COLECCION_MOVIMIENTOS}/${segmento(`${uid}__mision__${mision.id}`)}`, {
          uid, tipo: 'ganado', puntos: mision.premio, concepto: `Misión completada · ${mision.nombre}`,
          detalle: 'Bono por avance posterior a la activación', fecha, referencia: `mision:${mision.id}`,
        });
      }
      const nuevo: ResumenGuardado = {
        ...previo, acreditado, hitos, misiones, bienvenidaAcreditada,
        saldo: previo.saldo + ganadosAhora + bonoBienvenida,
        experiencia: previo.experiencia + ganadosAhora,
        ganados: previo.ganados + ganadosAhora + bonoBienvenida,
        actualizado: fecha,
      };
      if (ganadosAhora === 0 && bonoBienvenida === 0 && rachaAnterior === acreditado.rachaRetos && documento.exists) return previo;
      tx.set(ruta, { ...nuevo });
      return nuevo;
    });
  }

  async activarMision(uid: string, misionId: string): Promise<{ ok: true; mision: MisionPuntos }> {
    const catalogo = MISIONES.find((m) => m.id === misionId);
    if (!catalogo) throw new NotFoundError('Esa misión no existe.');
    await this.sincronizar(uid);
    const fecha = this.ahora().toISOString();
    const resultado = await this.db.runTransaction(async (tx) => {
      const ruta = rutaResumen(uid);
      const resumen = resumenDesdeDoc(uid, (await tx.get(ruta)).data());
      const existente = resumen.misiones[catalogo.id];
      if (existente?.estado === 'activa') throw new CodedError(409, 'mision/activa', 'Esta misión ya está activa.');
      if (existente?.estado === 'completada') throw new CodedError(409, 'mision/completada', 'Esta misión ya fue completada.');
      if (catalogo.requiere && resumen.misiones[catalogo.requiere]?.estado !== 'completada') {
        throw new CodedError(409, 'mision/bloqueada', 'Completa el tramo anterior para activar esta misión.');
      }
      const base = resumen.acreditado[catalogo.fuente];
      const guardada: MisionGuardada = {
        estado: 'activa', base, objetivo: base + catalogo.incremento, activadaEn: fecha, completadaEn: null,
      };
      const nuevo: ResumenGuardado = { ...resumen, misiones: { ...resumen.misiones, [catalogo.id]: guardada }, actualizado: fecha };
      tx.set(ruta, { ...nuevo });
      return nuevo;
    });
    return { ok: true, mision: misionesPublicas(resultado).find((m) => m.id === catalogo.id)! };
  }

  async seleccionarObjetivo(uid: string, beneficioId: unknown): Promise<{ ok: true; beneficioId: string | null }> {
    const id = beneficioId === null ? null : texto(beneficioId).trim();
    if (beneficioId !== null && !id) throw new CodedError(400, 'objetivo/invalido', 'Selecciona un beneficio válido.');
    const beneficio = id ? CATALOGO_BENEFICIOS.find((b) => b.id === id) : null;
    if (id && !beneficio) throw new NotFoundError('Ese beneficio no existe.');
    await this.sincronizar(uid);
    await this.db.runTransaction(async (tx) => {
      const ruta = rutaResumen(uid);
      const actual = resumenDesdeDoc(uid, (await tx.get(ruta)).data());
      if (beneficio) {
        const materiales = materialesDe(beneficio);
        const estados = await Promise.all(materiales.map(async (materialId) => {
          const [derecho, material] = await Promise.all([
            tx.get(`${COLECCION_BENEFICIOS}/${segmento(`${uid}__${materialId}`)}`),
            tx.get(`pdfs/${segmento(materialId)}`),
          ]);
          return { derecho: derecho.exists, material: material.data() };
        }));
        if (materiales.length && estados.every((estado) => estado.derecho)) throw new CodedError(409, 'objetivo/ya-obtenido', 'Ese beneficio ya forma parte de tu cuenta.');
        if (estados.some((estado) => !estado.derecho && (!estado.material || estado.material.estado === 'oculto' || !texto(estado.material.drive).trim()))) {
          throw new CodedError(409, 'objetivo/no-disponible', 'Ese beneficio todavía no está disponible.');
        }
      }
      tx.set(ruta, { ...actual, objetivoElegido: id, actualizado: this.ahora().toISOString() });
    });
    return { ok: true, beneficioId: id };
  }

  async marcarFavorito(uid: string, beneficioId: string, activoDesconocido: unknown): Promise<{ ok: true; favoritos: string[] }> {
    const beneficio = CATALOGO_BENEFICIOS.find((b) => b.id === beneficioId);
    if (!beneficio) throw new NotFoundError('Ese beneficio no existe.');
    if (typeof activoDesconocido !== 'boolean') throw new CodedError(400, 'favorito/invalido', 'Indica si quieres guardar o quitar el beneficio.');
    await this.sincronizar(uid);
    const favoritos = await this.db.runTransaction(async (tx) => {
      const ruta = rutaResumen(uid);
      const resumen = resumenDesdeDoc(uid, (await tx.get(ruta)).data());
      if (activoDesconocido) {
        if (!resumen.favoritos.includes(beneficio.id) && resumen.favoritos.length >= 5) throw new CodedError(409, 'favorito/limite', 'Puedes guardar hasta 5 beneficios en tu ruta.');
        const materiales = materialesDe(beneficio);
        const estados = await Promise.all(materiales.map(async (materialId) => {
          const [derecho, material] = await Promise.all([
            tx.get(`${COLECCION_BENEFICIOS}/${segmento(`${uid}__${materialId}`)}`),
            tx.get(`pdfs/${segmento(materialId)}`),
          ]);
          return { derecho: derecho.exists, material: material.data() };
        }));
        if (materiales.length && estados.every((estado) => estado.derecho)) throw new CodedError(409, 'favorito/ya-obtenido', 'Ese beneficio ya forma parte de tu cuenta.');
        if (estados.some((estado) => !estado.derecho && (!estado.material || estado.material.estado === 'oculto' || !texto(estado.material.drive).trim()))) {
          throw new CodedError(409, 'favorito/no-disponible', 'Ese beneficio todavía no está disponible.');
        }
      }
      const siguientes = activoDesconocido
        ? [...new Set([...resumen.favoritos, beneficio.id])].slice(0, 5)
        : resumen.favoritos.filter((id) => id !== beneficio.id);
      tx.set(ruta, { ...resumen, favoritos: siguientes, actualizado: this.ahora().toISOString() });
      return siguientes;
    });
    return { ok: true, favoritos };
  }

  async cotizarAtelier(uid: string, materialIdsDesconocidos: unknown): Promise<{ ok: true; cotizacion: CotizacionAtelier }> {
    const materialIds = idsAtelier(materialIdsDesconocidos);
    const resumen = await this.sincronizar(uid);
    const estados = await Promise.all(materialIds.map(async (materialId) => {
      const [derecho, material] = await Promise.all([
        this.db.get(`${COLECCION_BENEFICIOS}/${segmento(`${uid}__${materialId}`)}`),
        this.db.get(`pdfs/${segmento(materialId)}`),
      ]);
      return { materialId, derecho: derecho.exists, material: material.data() };
    }));
    if (estados.some((estado) => estado.derecho)) throw new CodedError(409, 'atelier/material-obtenido', 'Quita de la selección los materiales que ya forman parte de tu biblioteca.');
    if (estados.some((estado) => !estado.material || estado.material.estado === 'oculto' || !texto(estado.material.drive).trim())) {
      throw new CodedError(409, 'atelier/material-no-disponible', 'Uno de los materiales seleccionados todavía no está disponible.');
    }
    return { ok: true, cotizacion: cotizacionAtelier(materialIds, resumen.saldo) };
  }

  async canjearAtelier(uid: string, materialIdsDesconocidos: unknown): Promise<{ ok: true; canje: CanjePuntos; puntos: ResumenPuntos }> {
    const materialIds = idsAtelier(materialIdsDesconocidos);
    await this.sincronizar(uid);
    const fecha = this.ahora().toISOString();
    const resultado = await this.db.runTransaction(async (tx) => {
      const resumenRuta = rutaResumen(uid);
      const resumen = resumenDesdeDoc(uid, (await tx.get(resumenRuta)).data());
      const estados = await Promise.all(materialIds.map(async (materialId) => {
        const derechoRuta = `${COLECCION_BENEFICIOS}/${segmento(`${uid}__${materialId}`)}`;
        const [derecho, material] = await Promise.all([tx.get(derechoRuta), tx.get(`pdfs/${segmento(materialId)}`)]);
        return { materialId, derechoRuta, derecho: derecho.exists, material: material.data() };
      }));
      if (estados.some((estado) => estado.derecho)) throw new CodedError(409, 'atelier/material-obtenido', 'La selección cambió porque uno de los materiales ya forma parte de tu biblioteca.');
      if (estados.some((estado) => !estado.material || estado.material.estado === 'oculto' || !texto(estado.material.drive).trim())) {
        throw new CodedError(409, 'atelier/material-no-disponible', 'Uno de los materiales seleccionados todavía no está disponible.');
      }
      const cotizacion = cotizacionAtelier(materialIds, resumen.saldo);
      if (!cotizacion.puedeCanjear) throw new CodedError(409, 'puntos/insuficientes', `Necesitas ${cotizacion.costo} diamantes para esta colección.`, { saldo: resumen.saldo, costo: cotizacion.costo });
      const secuencia = resumen.canjes + 1;
      const canjeId = segmento(`${uid}__${String(secuencia).padStart(5, '0')}`);
      const idsBeneficio = new Set(materialIds.map((id) => materialPorId(id)!.id));
      const nuevo: ResumenGuardado = {
        ...resumen,
        saldo: resumen.saldo - cotizacion.costo,
        gastados: resumen.gastados + cotizacion.costo,
        canjes: secuencia,
        objetivoElegido: resumen.objetivoElegido && idsBeneficio.has(resumen.objetivoElegido) ? null : resumen.objetivoElegido,
        favoritos: resumen.favoritos.filter((id) => !idsBeneficio.has(id)),
        actualizado: fecha,
      };
      const canje: CanjePuntos = {
        id: canjeId, beneficioId: `atelier-${materialIds.join('-')}`, nombre: `Colección a tu medida · ${materialIds.length} materiales`, categoria: 'paquete',
        costo: cotizacion.costo, costoOriginal: cotizacion.costoOriginal, ahorro: cotizacion.ahorro, fecha, materialId: null, materialIds,
        diasVip: null, vigenciaHasta: null, origen: 'puntos', origenId: 'atelier',
      };
      tx.set(resumenRuta, { ...nuevo });
      tx.set(`${COLECCION_CANJES_PUNTOS}/${canjeId}`, { uid, ...canje });
      tx.set(`${COLECCION_MOVIMIENTOS}/${segmento(`${canjeId}__canje`)}`, {
        uid, tipo: 'canje', puntos: -cotizacion.costo, concepto: canje.nombre,
        detalle: `${materialIds.length} materiales permanentes · ${cotizacion.descuento}% de ahorro Atelier`, fecha, referencia: canje.beneficioId,
      });
      for (const estado of estados) tx.set(estado.derechoRuta, { uid, materialId: estado.materialId, beneficioId: canje.beneficioId, fecha, permanente: true, origen: 'atelier' });
      return { canje, resumen: nuevo };
    });
    return { ok: true, canje: resultado.canje, puntos: resumenPublico(resultado.resumen) };
  }

  async tieneMaterial(uid: string, materialId: string): Promise<boolean> {
    const id = segmento(`${uid}__${materialId}`);
    return (await this.db.get(`${COLECCION_BENEFICIOS}/${id}`)).exists;
  }

  private async boutique(uid: string, saldo: number, vipDiasPorAnio: Record<string, number>, objetivoElegido: string | null, favoritos: string[]): Promise<BeneficioPublico[]> {
    const derechos = await this.db.query(COLECCION_BENEFICIOS, { where: [{ campo: 'uid', op: '==', valor: uid }], limit: 200 });
    const materialesCanjeados = new Set(derechos.map((d) => texto(d.data()?.materialId)).filter(Boolean));
    const materiales = [...new Set(CATALOGO_BENEFICIOS.flatMap(materialesDe))];
    const estados = new Map<string, boolean>();
    await Promise.all(materiales.map(async (materialId) => {
      const d = (await this.db.get(`pdfs/${segmento(materialId)}`)).data();
      estados.set(materialId, !!d && d.estado !== 'oculto' && !!texto(d.drive).trim());
    }));
    const restantesVip = Math.max(0, MAX_DIAS_VIP_ANIO - (vipDiasPorAnio[String(this.ahora().getUTCFullYear())] ?? 0));
    return CATALOGO_BENEFICIOS.map((b) => {
      const materialesBeneficio = materialesDe(b);
      const precio = precioBeneficio(b, materialesCanjeados);
      const disponible = b.categoria === 'vip' || (materialesBeneficio.length > 0 && materialesBeneficio.every((id) => estados.get(id) === true));
      const canjeado = materialesBeneficio.length > 0 && precio.faltantes.length === 0;
      const excedeCupoVip = !!b.diasVip && b.diasVip > restantesVip;
      const motivo = !disponible ? 'Este contenido todavía no está disponible en la biblioteca.'
        : canjeado ? 'Ya forma parte de tu biblioteca permanente.'
          : excedeCupoVip ? `Tu cupo anual permite hasta ${restantesVip} día${restantesVip === 1 ? '' : 's'} VIP más.`
          : saldo < precio.costo ? `Te faltan ${precio.costo - saldo} diamantes.` : null;
      return {
        ...b, costo: precio.costo, costoOriginal: precio.costoOriginal, ahorro: precio.ahorro,
        faltanMateriales: precio.faltantes.length, incluye: precio.incluye, esObjetivo: objetivoElegido === b.id, esFavorito: favoritos.includes(b.id),
        disponible, canjeado, puedeCanjear: disponible && !canjeado && !excedeCupoVip && saldo >= precio.costo, motivo,
      };
    }).filter((b) => b.disponible || b.canjeado);
  }

  async panel(uid: string): Promise<PanelPuntos> {
    const resumen = await this.sincronizar(uid);
    const [boutique, movimientosDocs, canjesDocs] = await Promise.all([
      this.boutique(uid, resumen.saldo, resumen.vipDiasPorAnio, resumen.objetivoElegido, resumen.favoritos),
      this.db.query(COLECCION_MOVIMIENTOS, { where: [{ campo: 'uid', op: '==', valor: uid }], limit: 200 }),
      this.db.query(COLECCION_CANJES_PUNTOS, { where: [{ campo: 'uid', op: '==', valor: uid }], limit: 200 }),
    ]);
    const movimientosTodos = movimientosDocs.map((d) => ({ id: d.id, ...(d.data() ?? {}) } as MovimientoPuntos))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const canjesTodos = canjesDocs.map((d) => ({ id: d.id, ...(d.data() ?? {}) } as CanjePuntos))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const movimientos = movimientosTodos.slice(0, 30);
    const canjes = canjesTodos.slice(0, 50);
    const materiales = boutique.filter((b) => b.categoria === 'material' && b.canjeado).length;
    const favoritos = resumen.favoritos
      .map((id) => boutique.find((beneficio) => beneficio.id === id))
      .filter((beneficio): beneficio is BeneficioPublico => !!beneficio && beneficio.disponible && !beneficio.canjeado);
    const materialesAtelier = boutique
      .filter((beneficio) => beneficio.categoria === 'material' && beneficio.disponible && !beneficio.canjeado)
      .map(({ id, materialId, nombre, descripcion, icono, costo }) => ({ id, materialId, nombre, descripcion, icono, costo }));
    const objetivoElegido = boutique.find((b) => b.id === resumen.objetivoElegido && !b.canjeado && b.disponible);
    const siguiente = objetivoElegido ?? boutique
      .filter((b) => !b.canjeado && b.disponible && !(b.diasVip && b.diasVip > MAX_DIAS_VIP_ANIO - ((resumen.vipDiasPorAnio[String(this.ahora().getUTCFullYear())] ?? 0))))
      .sort((a, b) => Math.max(0, a.costo - resumen.saldo) - Math.max(0, b.costo - resumen.saldo) || a.costo - b.costo)[0];
    const objetivo = siguiente ? {
      beneficioId: siguiente.id,
      nombre: siguiente.nombre,
      costo: siguiente.costo,
      faltan: Math.max(0, siguiente.costo - resumen.saldo),
      porcentaje: Math.min(100, Math.round((resumen.saldo / siguiente.costo) * 100)),
      clasesEquivalentes: Math.ceil(Math.max(0, siguiente.costo - resumen.saldo) / PUNTOS_POR_CLASE),
      cursosEquivalentes: Math.ceil(Math.max(0, siguiente.costo - resumen.saldo) / PUNTOS_POR_CURSO),
      personalizado: siguiente.id === objetivoElegido?.id,
    } : null;
    const anio = this.ahora().getUTCFullYear();
    const vipUsados = resumen.vipDiasPorAnio[String(anio)] ?? 0;
    return {
      puntos: resumenPublico(resumen), boutique, movimientos, canjes, favoritos,
      atelier: {
        minimo: 2,
        maximo: 5,
        descuentos: DESCUENTOS_ATELIER.map((nivel) => ({ ...nivel })),
        materiales: materialesAtelier,
      },
      inteligencia: inteligenciaPuntos(movimientosTodos, canjesTodos, materiales, this.ahora()),
      hitos: hitosPublicos(resumen),
      misiones: misionesPublicas(resumen),
      niveles: nivelesPublicos(resumen.experiencia),
      premiosNivel: premiosNivelPublicos(resumen, boutique),
      colecciones: coleccionesPublicas(materiales),
      objetivo,
      vipAnual: { anio, usados: vipUsados, disponibles: Math.max(0, MAX_DIAS_VIP_ANIO - vipUsados), limite: MAX_DIAS_VIP_ANIO },
      proximasFormasDeGanar: [
        { nombre: 'Modo Historia', estado: 'En validación segura', descripcion: 'Se activará cuando cada nivel se acredite completamente en el servidor.' },
        { nombre: 'Comunidad', estado: 'En moderación', descripcion: 'Premiará aportaciones aprobadas por su calidad, no la cantidad de publicaciones.' },
        { nombre: 'Eventos en vivo', estado: 'Próximamente', descripcion: 'Bonos por asistencia cuando el registro de presencia sea autoritativo.' },
      ],
    };
  }

  async canjear(uid: string, beneficioId: string): Promise<{ ok: true; canje: CanjePuntos; puntos: ResumenPuntos }> {
    const beneficio = CATALOGO_BENEFICIOS.find((b) => b.id === beneficioId);
    if (!beneficio) throw new NotFoundError('Ese beneficio no existe.');
    await this.sincronizar(uid);
    const ahora = this.ahora();
    const fecha = ahora.toISOString();
    const anio = String(ahora.getUTCFullYear());
    const resultado = await this.db.runTransaction(async (tx) => {
      const resumenRuta = rutaResumen(uid);
      const resumen = resumenDesdeDoc(uid, (await tx.get(resumenRuta)).data());
      const materiales = materialesDe(beneficio);
      const estadosMaterial = await Promise.all(materiales.map(async (materialId) => {
        const derechoRuta = `${COLECCION_BENEFICIOS}/${segmento(`${uid}__${materialId}`)}`;
        const [derecho, materialDoc] = await Promise.all([tx.get(derechoRuta), tx.get(`pdfs/${segmento(materialId)}`)]);
        return { materialId, derechoRuta, derecho: derecho.exists, material: materialDoc.data() };
      }));
      const materialesCanjeados = new Set(estadosMaterial.filter((m) => m.derecho).map((m) => m.materialId));
      const faltantes = estadosMaterial.filter((m) => !m.derecho);
      if (materiales.length && !faltantes.length) throw new CodedError(409, 'beneficio/ya-canjeado', 'Este beneficio ya forma parte de tu biblioteca permanente.');
      for (const item of faltantes) {
        if (!item.material || item.material.estado === 'oculto' || !texto(item.material.drive).trim()) throw new CodedError(409, 'beneficio/no-disponible', 'Uno de los materiales todavía no está disponible.');
      }
      const precio = precioBeneficio(beneficio, materialesCanjeados);

      if (resumen.saldo < precio.costo) throw new CodedError(409, 'puntos/insuficientes', `Necesitas ${precio.costo} diamantes para este beneficio.`, { saldo: resumen.saldo, costo: precio.costo });

      const usadosAnio = resumen.vipDiasPorAnio[anio] ?? 0;
      if (beneficio.diasVip && usadosAnio + beneficio.diasVip > MAX_DIAS_VIP_ANIO) {
        throw new CodedError(409, 'beneficio/limite-vip', `Puedes canjear hasta ${MAX_DIAS_VIP_ANIO} días VIP por año calendario.`, { diasUsados: usadosAnio, limite: MAX_DIAS_VIP_ANIO });
      }

      const secuencia = resumen.canjes + 1;
      const canjeId = segmento(`${uid}__${String(secuencia).padStart(5, '0')}`);
      let vigenciaHasta: string | null = null;
      if (beneficio.diasVip) {
        const vip = await otorgarDiasVipEnTx(tx, { uid, dias: beneficio.diasVip, fuente: 'puntos', referencia: beneficio.id }, ahora, `puntos_${canjeId}`);
        vigenciaHasta = vip.vigenciaHasta;
      }

      const idsObtenidos = new Set([beneficio.id, ...faltantes.map((item) => materialPorId(item.materialId)?.id).filter((id): id is string => !!id)]);
      const nuevo: ResumenGuardado = {
        ...resumen,
        saldo: resumen.saldo - precio.costo,
        gastados: resumen.gastados + precio.costo,
        canjes: secuencia,
        objetivoElegido: resumen.objetivoElegido && idsObtenidos.has(resumen.objetivoElegido) ? null : resumen.objetivoElegido,
        favoritos: resumen.favoritos.filter((id) => !idsObtenidos.has(id)),
        vipDiasPorAnio: beneficio.diasVip ? { ...resumen.vipDiasPorAnio, [anio]: usadosAnio + beneficio.diasVip } : resumen.vipDiasPorAnio,
        actualizado: fecha,
      };
      const canje: CanjePuntos = {
        id: canjeId, beneficioId: beneficio.id, nombre: beneficio.nombre, categoria: beneficio.categoria,
        costo: precio.costo, costoOriginal: precio.costoOriginal, ahorro: precio.ahorro, fecha, materialId: beneficio.materialId ?? null, materialIds: materiales,
        diasVip: beneficio.diasVip ?? null, vigenciaHasta, origen: 'puntos', origenId: null,
      };
      tx.set(resumenRuta, { ...nuevo });
      tx.set(`${COLECCION_CANJES_PUNTOS}/${canjeId}`, { uid, ...canje });
      tx.set(`${COLECCION_MOVIMIENTOS}/${segmento(`${canjeId}__canje`)}`, {
        uid, tipo: 'canje', puntos: -precio.costo, concepto: beneficio.nombre,
        detalle: beneficio.categoria === 'vip' ? `${beneficio.diasVip} días VIP` : beneficio.categoria === 'paquete' ? `${faltantes.length} materiales permanentes` : 'Acceso permanente a material', fecha, referencia: beneficio.id,
      });
      for (const item of faltantes) tx.set(item.derechoRuta, { uid, materialId: item.materialId, beneficioId: beneficio.id, fecha, permanente: true });
      return { canje, resumen: nuevo };
    });
    return { ok: true, canje: resultado.canje, puntos: resumenPublico(resultado.resumen) };
  }

  async canjearPremioNivel(uid: string, nivelId: string, beneficioIdDesconocido: unknown): Promise<{ ok: true; canje: CanjePuntos; premio: PremioNivelPublico }> {
    const premioCatalogo = PREMIOS_NIVEL.find((p) => p.nivelId === nivelId);
    if (!premioCatalogo) throw new NotFoundError('Ese premio de nivel no existe.');
    const beneficioId = texto(beneficioIdDesconocido).trim();
    if (!beneficioId || !premioCatalogo.opciones.some((id) => id === beneficioId)) {
      throw new CodedError(400, 'nivel/opcion-invalida', 'Elige uno de los beneficios disponibles para este nivel.');
    }
    const beneficio = CATALOGO_BENEFICIOS.find((b) => b.id === beneficioId)!;
    const nivel = NIVELES.find((n) => n.id === premioCatalogo.nivelId)!;
    await this.sincronizar(uid);
    const ahora = this.ahora();
    const fecha = ahora.toISOString();
    const anio = String(ahora.getUTCFullYear());
    const resultado = await this.db.runTransaction(async (tx) => {
      const resumenRuta = rutaResumen(uid);
      const resumen = resumenDesdeDoc(uid, (await tx.get(resumenRuta)).data());
      if (resumen.experiencia < nivel.desde) throw new CodedError(403, 'nivel/bloqueado', 'Alcanza este nivel antes de elegir su recompensa.');
      if (resumen.premiosNivel[premioCatalogo.nivelId]) throw new CodedError(409, 'nivel/canjeado', 'La recompensa de este nivel ya fue elegida.');

      const materiales = materialesDe(beneficio);
      const estadosMaterial = await Promise.all(materiales.map(async (materialId) => {
        const derechoRuta = `${COLECCION_BENEFICIOS}/${segmento(`${uid}__${materialId}`)}`;
        const [derecho, materialDoc] = await Promise.all([tx.get(derechoRuta), tx.get(`pdfs/${segmento(materialId)}`)]);
        return { materialId, derechoRuta, derecho: derecho.exists, material: materialDoc.data() };
      }));
      const faltantes = estadosMaterial.filter((m) => !m.derecho);
      if (materiales.length && !faltantes.length) throw new CodedError(409, 'nivel/beneficio-obtenido', 'Ese beneficio ya forma parte de tu cuenta; elige la otra opción.');
      for (const item of faltantes) {
        if (!item.material || item.material.estado === 'oculto' || !texto(item.material.drive).trim()) {
          throw new CodedError(409, 'nivel/beneficio-no-disponible', 'Ese beneficio todavía no está disponible; elige la otra opción.');
        }
      }

      const usadosAnio = resumen.vipDiasPorAnio[anio] ?? 0;
      if (beneficio.diasVip && usadosAnio + beneficio.diasVip > MAX_DIAS_VIP_ANIO) {
        throw new CodedError(409, 'beneficio/limite-vip', `Tu cupo permite hasta ${MAX_DIAS_VIP_ANIO} días VIP de recompensas por año.`, { diasUsados: usadosAnio, limite: MAX_DIAS_VIP_ANIO });
      }

      const secuencia = resumen.canjes + 1;
      const canjeId = segmento(`${uid}__${String(secuencia).padStart(5, '0')}`);
      let vigenciaHasta: string | null = null;
      if (beneficio.diasVip) {
        const vip = await otorgarDiasVipEnTx(tx, { uid, dias: beneficio.diasVip, fuente: 'nivel', referencia: premioCatalogo.nivelId }, ahora, `nivel_${canjeId}`);
        vigenciaHasta = vip.vigenciaHasta;
      }

      const premioGuardado: PremioNivelGuardado = { beneficioId, canjeadoEn: fecha };
      const idsObtenidos = new Set([beneficio.id, ...faltantes.map((item) => materialPorId(item.materialId)?.id).filter((id): id is string => !!id)]);
      const nuevo: ResumenGuardado = {
        ...resumen,
        canjes: secuencia,
        objetivoElegido: resumen.objetivoElegido && idsObtenidos.has(resumen.objetivoElegido) ? null : resumen.objetivoElegido,
        favoritos: resumen.favoritos.filter((id) => !idsObtenidos.has(id)),
        premiosNivel: { ...resumen.premiosNivel, [premioCatalogo.nivelId]: premioGuardado },
        vipDiasPorAnio: beneficio.diasVip ? { ...resumen.vipDiasPorAnio, [anio]: usadosAnio + beneficio.diasVip } : resumen.vipDiasPorAnio,
        actualizado: fecha,
      };
      const canje: CanjePuntos = {
        id: canjeId, beneficioId: beneficio.id, nombre: beneficio.nombre, categoria: beneficio.categoria,
        costo: 0, costoOriginal: 0, ahorro: 0, fecha, materialId: beneficio.materialId ?? null, materialIds: materiales,
        diasVip: beneficio.diasVip ?? null, vigenciaHasta, origen: 'nivel', origenId: premioCatalogo.nivelId,
      };
      tx.set(resumenRuta, { ...nuevo });
      tx.set(`${COLECCION_CANJES_PUNTOS}/${canjeId}`, { uid, ...canje });
      for (const item of faltantes) tx.set(item.derechoRuta, { uid, materialId: item.materialId, beneficioId: beneficio.id, fecha, permanente: true, origen: 'nivel', nivelId: premioCatalogo.nivelId });
      return { canje, resumen: nuevo };
    });
    const boutique = await this.boutique(uid, resultado.resumen.saldo, resultado.resumen.vipDiasPorAnio, resultado.resumen.objetivoElegido, resultado.resumen.favoritos);
    const premio = premiosNivelPublicos(resultado.resumen, boutique).find((p) => p.nivelId === premioCatalogo.nivelId)!;
    return { ok: true, canje: resultado.canje, premio };
  }
}
