// Recompensas: metas que otorgan días VIP. Las reglas (meta y premio) viven SOLO aquí; el cliente
// nunca envía metas, progreso ni premios. El progreso sale de métricas confiables (metricasVip.ts).
// Canjes en v2_recompensas/{uid} { uid, canjes: { [id]: { fecha, dias, vigenciaHasta } }, actualizado }.
// El canje marca la recompensa y otorga los días en UNA transacción (otorgarDiasVipEnTx).
import type { FirestorePort } from '../adapters/firestore/port.js';
import { texto } from '../adapters/firestore/port.js';
import { segmento } from '../adapters/firestore/v2.js';
import { leerMetricasVip, type MetricaVip, type MetricasVip } from '../adapters/firestore/metricasVip.js';
import { diasDeDuracion, type DuracionVip } from './duracionVip.js';
import { otorgarDiasVipEnTx } from './vip.js';
import { CodedError, NotFoundError } from './errors.js';

export const COLECCION_RECOMPENSAS = 'v2_recompensas';

export interface ReglaRecompensa {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  metrica: MetricaVip;
  meta: number;
  premio: { duracion: DuracionVip; dias: number | null };
}

/** Reglas aprobadas por el propietario (las mismas que muestra el club en demo). */
export const REGLAS_RECOMPENSAS: readonly ReglaRecompensa[] = [
  { id: 'primer-paso', nombre: 'Primer Paso', descripcion: 'Mira 5 clases de cualquier curso', icono: 'play', metrica: 'clasesVistas', meta: 5, premio: { duracion: 'personalizada', dias: 7 } },
  { id: 'curso-completo', nombre: 'Curso Completo', descripcion: 'Completa 1 curso', icono: 'book-check', metrica: 'cursosCompletados', meta: 1, premio: { duracion: '15d', dias: null } },
  { id: 'doble-logro', nombre: 'Doble Logro', descripcion: 'Completa 2 cursos', icono: 'trophy', metrica: 'cursosCompletados', meta: 2, premio: { duracion: '1m', dias: null } },
  { id: 'explorador', nombre: 'Explorador', descripcion: 'Completa 5 niveles de historia', icono: 'compass', metrica: 'nivelesHistoria', meta: 5, premio: { duracion: 'personalizada', dias: 7 } },
  { id: 'aventurero', nombre: 'Aventurero', descripcion: 'Completa los 10 niveles de historia', icono: 'map', metrica: 'nivelesHistoria', meta: 10, premio: { duracion: '15d', dias: null } },
  { id: 'participativo', nombre: 'Participativo', descripcion: 'Publica 3 hilos en el foro', icono: 'message-square', metrica: 'hilosForo', meta: 3, premio: { duracion: 'personalizada', dias: 7 } },
  { id: 'certificado', nombre: 'Certificado', descripcion: 'Obtén tu primer certificado', icono: 'award', metrica: 'certificados', meta: 1, premio: { duracion: '15d', dias: null } },
  { id: 'maestro', nombre: 'Criterio Dermalysse', descripcion: 'Completa 5 cursos', icono: 'crown', metrica: 'cursosCompletados', meta: 5, premio: { duracion: '1m', dias: null } },
];

/** Forma exacta que consume src/pages/recompensas.ts. */
export interface Recompensa {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  progreso: number;
  meta: number;
  completado: boolean;
  canjeado: boolean;
  canjeadoEn: string | null;
  premio: { duracion: string; dias: number | null };
}

export interface CanjeRecompensa { fecha: string; dias: number; vigenciaHasta: string }

export interface ResultadoCanjeRecompensa {
  ok: true;
  /** Nueva vigencia VIP (ISO). El cliente la muestra en el aviso. */
  hasta: string;
  regaloDesde: string;
  dias: number;
  recompensa: Recompensa;
}

/** Días que otorga una regla (falla en arranque de pruebas si alguna regla está mal escrita). */
export function diasDeRegla(regla: ReglaRecompensa): number {
  const dias = diasDeDuracion(regla.premio.duracion, regla.premio.dias);
  if (dias === null) throw new Error(`Premio inválido en la recompensa ${regla.id}`);
  return dias;
}

/** Lee defensivamente los canjes guardados. */
export function canjesDesdeDoc(d: Record<string, unknown> | undefined): Record<string, CanjeRecompensa> {
  const salida: Record<string, CanjeRecompensa> = {};
  const canjes = d?.canjes;
  if (typeof canjes !== 'object' || canjes === null || Array.isArray(canjes)) return salida;
  for (const [id, v] of Object.entries(canjes as Record<string, unknown>)) {
    if (typeof v !== 'object' || v === null) continue;
    const c = v as Record<string, unknown>;
    salida[id] = { fecha: texto(c.fecha), dias: Number(c.dias) || 0, vigenciaHasta: texto(c.vigenciaHasta) };
  }
  return salida;
}

export function recompensaDesdeRegla(regla: ReglaRecompensa, metricas: MetricasVip, canjes: Record<string, CanjeRecompensa>): Recompensa {
  const valor = Math.max(0, metricas[regla.metrica] || 0);
  const canje = canjes[regla.id];
  return {
    id: regla.id,
    nombre: regla.nombre,
    descripcion: regla.descripcion,
    icono: regla.icono,
    progreso: Math.min(valor, regla.meta),
    meta: regla.meta,
    completado: valor >= regla.meta,
    canjeado: !!canje,
    canjeadoEn: canje ? canje.fecha || null : null,
    premio: { ...regla.premio },
  };
}

export function listaRecompensas(metricas: MetricasVip, canjes: Record<string, CanjeRecompensa>): Recompensa[] {
  return REGLAS_RECOMPENSAS.map((r) => recompensaDesdeRegla(r, metricas, canjes));
}

export class RecompensasService {
  constructor(private readonly db: FirestorePort, private readonly ahora: () => Date) {}

  private ruta(uid: string) { return `${COLECCION_RECOMPENSAS}/${segmento(uid)}`; }

  async listar(uid: string): Promise<Recompensa[]> {
    const [metricas, doc] = await Promise.all([leerMetricasVip(this.db, uid), this.db.get(this.ruta(uid))]);
    return listaRecompensas(metricas, canjesDesdeDoc(doc.data()));
  }

  async canjear(uid: string, id: string): Promise<ResultadoCanjeRecompensa> {
    const regla = REGLAS_RECOMPENSAS.find((r) => r.id === id);
    if (!regla) throw new NotFoundError('Esa recompensa no existe.');
    const dias = diasDeRegla(regla);

    // El progreso solo crece (avance, historia, foro y certificados no se pierden): se valida antes de la transacción.
    const metricas = await leerMetricasVip(this.db, uid);
    const valor = metricas[regla.metrica] || 0;
    if (valor < regla.meta) {
      throw new CodedError(403, 'recompensa/incompleta', `Aún no completas «${regla.nombre}» (${Math.min(valor, regla.meta)}/${regla.meta}).`, { progreso: Math.min(valor, regla.meta), meta: regla.meta });
    }

    const ahora = this.ahora();
    const ruta = this.ruta(uid);
    const { vip, canjes } = await this.db.runTransaction(async (tx) => {
      // Lecturas primero (regla de Firestore): canjes del usuario y, dentro de otorgarDiasVipEnTx, users/{uid}.
      const previos = canjesDesdeDoc((await tx.get(ruta)).data());
      if (previos[regla.id]) throw new CodedError(409, 'recompensa/canjeada', `Ya canjeaste «${regla.nombre}».`);
      const vip = await otorgarDiasVipEnTx(tx, { uid, dias, fuente: 'recompensa', referencia: regla.id }, ahora, `recompensa_${segmento(uid)}_${regla.id}`);
      const canje: CanjeRecompensa = { fecha: ahora.toISOString(), dias, vigenciaHasta: vip.vigenciaHasta };
      tx.set(ruta, { uid, canjes: { [regla.id]: canje }, actualizado: ahora.toISOString() }, { merge: true });
      return { vip, canjes: { ...previos, [regla.id]: canje } };
    });

    return { ok: true, hasta: vip.vigenciaHasta, regaloDesde: vip.regaloDesde, dias, recompensa: recompensaDesdeRegla(regla, metricas, canjes) };
  }
}
