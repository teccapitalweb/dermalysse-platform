// Almacén del módulo Experiencia en MEMORIA (modo dev). No persiste en disco.
// Las reglas de negocio (desbloqueo de la encuesta, cupos, revisión optimista,
// reserva de beneficios) viven aquí porque el servidor es la autoridad.
import type { ExperienciaModuloStore } from '../interfaces.js';
import type {
  BeneficioExperiencia, ConfigExperiencia, EncuestaExperiencia, ExperienciaUsuario,
  ProgresoExperiencia, ResumenExperiencia,
} from '../../domain/types.js';
import { ConflictError, ValidationError } from '../../services/errors.js';

const DIA_MS = 86_400_000;
const DIAS_PARA_ENCUESTA = 7;
const SESIONES_PARA_ENCUESTA = 3;

function beneficio(estado: BeneficioExperiencia['estado'], dias: number | null, motivo: string): BeneficioExperiencia {
  return { estado, dias, hasta: null, motivo, venceOferta: null };
}

function progresoInicial(): ProgresoExperiencia {
  return { estado: 'pendiente', revision: 0, paso: 0, respuestas: {}, completadaEn: null, pospuestaHasta: null };
}

function encuestaInicial(): EncuestaExperiencia {
  return {
    id: 'experiencia-inicial-v1',
    estado: 'bloqueada',
    revision: 0, paso: 0, respuestas: {}, completadaEn: null, pospuestaHasta: null,
    motivo: 'La encuesta se habilita después de completar la bienvenida y usar el club varios días.',
    disponibleEn: null,
  };
}

function nuevoUsuario(uid: string): ExperienciaUsuario {
  return {
    version: 1, uid, primerAccesoEn: null, cohorte: 'nueva', privacidadAceptada: false,
    sesiones: [], entrevista: progresoInicial(), encuesta: encuestaInicial(),
    beneficios: {
      bienvenida: beneficio('no-disponible', null, 'Disponible al completar la entrevista.'),
      experiencia: beneficio('no-disponible', null, 'Disponible al completar la primera encuesta.'),
    },
  };
}

function configInicial(): ConfigExperiencia {
  return {
    version: 1, revision: 0, campanaId: null, aprobado: false, habilitada: false,
    fechaInicio: null, fechaFin: null, cupo: 0, reservadas: 0,
    premios: { bienvenida: 7, experiencia: 15 },
  };
}

// Reglas aplicadas tras cualquier cambio de estado.
function evaluarEncuesta(u: ExperienciaUsuario): void {
  if (u.encuesta.estado === 'completada' || u.encuesta.estado === 'en-curso' || u.encuesta.estado === 'pospuesta') return;
  if (u.entrevista.estado !== 'completada' || !u.primerAccesoEn) {
    u.encuesta.estado = 'bloqueada';
    u.encuesta.motivo = u.entrevista.estado === 'completada'
      ? 'Falta registrar varios días de uso antes de abrir la encuesta.'
      : 'La encuesta se habilita después de completar la bienvenida.';
    u.encuesta.disponibleEn = null;
    return;
  }
  const inicio = Date.parse(u.primerAccesoEn);
  const porTiempo = Date.now() - inicio >= DIAS_PARA_ENCUESTA * DIA_MS;
  const porUso = u.sesiones.length >= SESIONES_PARA_ENCUESTA;
  if (porTiempo && porUso) {
    u.encuesta.estado = 'disponible';
    u.encuesta.motivo = 'Puedes compartir tu primera impresión del club.';
    u.encuesta.disponibleEn = null;
  } else {
    const disponibleEn = porTiempo ? null : new Date(inicio + DIAS_PARA_ENCUESTA * DIA_MS).toISOString();
    u.encuesta.estado = 'bloqueada';
    u.encuesta.motivo = porUso
      ? 'Faltan unos días más desde tu bienvenida para abrir la encuesta.'
      : `Faltan ${SESIONES_PARA_ENCUESTA - u.sesiones.length} día(s) de uso para abrir la encuesta.`;
    u.encuesta.disponibleEn = disponibleEn;
  }
}

function validarEstadoParaAvanzar(flujo: 'entrevista' | 'encuesta', estado: string) {
  if (estado === 'completada') throw new ConflictError('Esta actividad ya está completada.');
  if (flujo === 'encuesta' && estado === 'bloqueada') throw new ConflictError('La encuesta todavía no está disponible.');
}

function sanearRespuestas(obj: unknown): Record<string, unknown> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new ValidationError('Las respuestas deben ser un objeto.');
  }
  const entradas = Object.entries(obj as Record<string, unknown>);
  if (entradas.length > 40) throw new ValidationError('Demasiadas respuestas en una sola petición.');
  const salida: Record<string, unknown> = {};
  for (const [k, v] of entradas) {
    if (typeof k !== 'string' || k.length === 0 || k.length > 60) {
      throw new ValidationError('Clave de respuesta inválida.');
    }
    if (v === null) { salida[k] = null; continue; }
    if (typeof v === 'string') { if (v.length > 2000) throw new ValidationError('Respuesta demasiado larga.'); salida[k] = v; continue; }
    if (typeof v === 'number' && Number.isFinite(v)) { salida[k] = v; continue; }
    if (typeof v === 'boolean') { salida[k] = v; continue; }
    if (Array.isArray(v)) {
      if (v.length > 20) throw new ValidationError('Lista de respuestas demasiado larga.');
      const copia: unknown[] = [];
      for (const item of v) {
        if (typeof item === 'string' && item.length <= 200) copia.push(item);
        else if (typeof item === 'number' && Number.isFinite(item)) copia.push(item);
        else throw new ValidationError('Elemento de respuesta inválido.');
      }
      salida[k] = copia;
      continue;
    }
    throw new ValidationError('Valor de respuesta no soportado.');
  }
  return salida;
}

export class MemoryExperienciaModuloStore implements ExperienciaModuloStore {
  private readonly usuarios = new Map<string, ExperienciaUsuario>();
  private configActual: ConfigExperiencia = configInicial();

  private cargar(uid: string): ExperienciaUsuario {
    let u = this.usuarios.get(uid);
    if (!u) { u = nuevoUsuario(uid); this.usuarios.set(uid, u); }
    return u;
  }

  async obtener(uid: string): Promise<ExperienciaUsuario> {
    const u = this.cargar(uid);
    evaluarEncuesta(u);
    return u;
  }

  async iniciar(uid: string): Promise<ExperienciaUsuario> {
    const u = this.cargar(uid);
    if (!u.primerAccesoEn) {
      u.primerAccesoEn = new Date().toISOString();
      u.privacidadAceptada = true;
    }
    if (u.entrevista.estado === 'pendiente') {
      u.entrevista.estado = 'en-curso';
      u.entrevista.revision++;
    }
    evaluarEncuesta(u);
    return u;
  }

  async guardarPaso(uid: string, flujo: 'entrevista' | 'encuesta', revision: number, paso: number, respuestas: Record<string, unknown>): Promise<ExperienciaUsuario> {
    const u = this.cargar(uid);
    if (!u.primerAccesoEn) throw new ConflictError('Debes aceptar la bienvenida antes de guardar respuestas.');
    if (!Number.isInteger(paso) || paso < 0 || paso > 7) throw new ValidationError('Paso fuera de rango.');
    const p = u[flujo];
    validarEstadoParaAvanzar(flujo, p.estado);
    if (p.revision !== revision) {
      const err = new ConflictError('La revisión está desactualizada; vuelve a cargar la pantalla.');
      (err as Error & { codigo?: string }).codigo = 'revision_desactualizada';
      throw err;
    }
    p.respuestas = { ...p.respuestas, ...sanearRespuestas(respuestas) };
    p.paso = paso;
    p.estado = 'en-curso';
    p.pospuestaHasta = null;
    p.revision++;
    evaluarEncuesta(u);
    return u;
  }

  async posponer(uid: string, flujo: 'entrevista' | 'encuesta', revision: number): Promise<ExperienciaUsuario> {
    const u = this.cargar(uid);
    const p = u[flujo];
    if (p.estado === 'completada') throw new ConflictError('Esta actividad ya está completada.');
    if (p.revision !== revision) {
      const err = new ConflictError('La revisión está desactualizada; vuelve a cargar la pantalla.');
      (err as Error & { codigo?: string }).codigo = 'revision_desactualizada';
      throw err;
    }
    p.estado = 'pospuesta';
    p.pospuestaHasta = new Date(Date.now() + DIA_MS).toISOString();
    p.revision++;
    evaluarEncuesta(u);
    return u;
  }

  async completar(uid: string, flujo: 'entrevista' | 'encuesta', revision: number, respuestasFinales?: Record<string, unknown>): Promise<ExperienciaUsuario> {
    const u = this.cargar(uid);
    const p = u[flujo];
    if (p.estado === 'completada') return u;
    if (flujo === 'encuesta' && p.estado === 'bloqueada') throw new ConflictError('La encuesta todavía no está disponible.');
    if (p.revision !== revision) {
      const err = new ConflictError('La revisión está desactualizada; vuelve a cargar la pantalla.');
      (err as Error & { codigo?: string }).codigo = 'revision_desactualizada';
      throw err;
    }
    if (respuestasFinales && Object.keys(respuestasFinales).length > 0) {
      p.respuestas = { ...p.respuestas, ...sanearRespuestas(respuestasFinales) };
    }
    p.estado = 'completada';
    p.completadaEn = new Date().toISOString();
    p.pospuestaHasta = null;
    p.revision++;

    // Reservar beneficio bajo la política vigente. Nunca se "otorga" aquí: ese
    // paso lo decide la integración de membresía (fuera de este slice).
    const clave = flujo === 'entrevista' ? 'bienvenida' : 'experiencia';
    const dias = this.configActual.premios[clave];
    const campanaViva = this.esCampanaViva();
    if (campanaViva && this.configActual.reservadas < this.configActual.cupo) {
      u.beneficios[clave] = {
        estado: 'reservado', dias, hasta: null,
        motivo: `Beneficio reservado: ${dias} días VIP tras validación de membresía.`,
        venceOferta: this.configActual.fechaFin,
      };
      this.configActual = { ...this.configActual, reservadas: this.configActual.reservadas + 1 };
    } else {
      u.beneficios[clave] = beneficio('no-disponible', dias, campanaViva
        ? 'La campaña alcanzó su cupo; agradecemos tu participación.'
        : 'La campaña no está activa; tu respuesta queda registrada sin premio asociado.');
    }
    evaluarEncuesta(u);
    return u;
  }

  async registrarSesion(uid: string): Promise<ExperienciaUsuario> {
    const u = this.cargar(uid);
    if (!u.primerAccesoEn) return u; // Idempotente: sin bienvenida no cuenta.
    const hoy = new Date().toISOString().slice(0, 10);
    if (!u.sesiones.includes(hoy)) u.sesiones.push(hoy);
    evaluarEncuesta(u);
    return u;
  }

  async config(): Promise<ConfigExperiencia> {
    return { ...this.configActual };
  }

  async guardarConfig(cambios: Omit<ConfigExperiencia, 'version' | 'reservadas' | 'premios'>): Promise<ConfigExperiencia> {
    if (cambios.revision !== this.configActual.revision) {
      throw new ConflictError('La política cambió desde que la cargaste. Recarga para ver la versión vigente.');
    }
    const cupo = Number(cambios.cupo);
    if (!Number.isSafeInteger(cupo) || cupo < this.configActual.reservadas || cupo > 100000) {
      throw new ValidationError('El cupo debe estar entre las reservas actuales y 100 000.');
    }
    const campanaId = cambios.campanaId ? String(cambios.campanaId).trim() : null;
    if (campanaId && !/^[A-Za-z0-9_-]{1,80}$/.test(campanaId)) {
      throw new ValidationError('Identificador de campaña inválido.');
    }
    if (cambios.fechaInicio && cambios.fechaFin && Date.parse(cambios.fechaFin) <= Date.parse(cambios.fechaInicio)) {
      throw new ValidationError('El fin de la promoción debe ser posterior al inicio.');
    }
    if (cambios.habilitada) {
      if (!cambios.aprobado || !campanaId || !cambios.fechaInicio || !cambios.fechaFin || cupo <= 0) {
        throw new ValidationError('Para habilitar, aprueba la política, define identificador, fechas y un cupo mayor que cero.');
      }
      if (Date.parse(cambios.fechaFin) <= Date.now()) {
        throw new ValidationError('No se puede habilitar una promoción vencida.');
      }
    }
    // Si hay reservas, el identificador y las fechas quedan congelados.
    if (this.configActual.reservadas > 0) {
      this.configActual = {
        ...this.configActual,
        aprobado: Boolean(cambios.aprobado),
        habilitada: Boolean(cambios.habilitada),
        cupo,
        revision: this.configActual.revision + 1,
      };
    } else {
      this.configActual = {
        ...this.configActual,
        campanaId, aprobado: Boolean(cambios.aprobado), habilitada: Boolean(cambios.habilitada),
        fechaInicio: cambios.fechaInicio, fechaFin: cambios.fechaFin, cupo,
        revision: this.configActual.revision + 1,
      };
    }
    return { ...this.configActual };
  }

  async resumen(): Promise<ResumenExperiencia> {
    const r: ResumenExperiencia = {
      version: 1, cuentas: 0,
      entrevistas: { pendientes: 0, enCurso: 0, pospuestas: 0, completadas: 0 },
      encuestas: { enCurso: 0, pospuestas: 0, completadas: 0 },
      sesionesRegistradas: 0,
      beneficios: { bienvenida: { otorgados: 0, dias: 0 }, experiencia: { otorgados: 0, dias: 0 } },
      campana: { campanaId: this.configActual.campanaId, reservadas: this.configActual.reservadas, cupo: this.configActual.cupo },
      resultados: {
        entrevista: { total: 0, roles: {}, objetivo: {}, areas: {}, experiencia: {}, formato: {}, tiempo: {}, origen: {} },
        encuesta: { total: 0, facilidad: { respuestas: 0, sinEvaluar: 0, promedio: null }, utilidad: { respuestas: 0, sinEvaluar: 0, promedio: null }, dificultad: {} },
      },
    };
    const facilidadSuma = { suma: 0, respuestas: 0, sinEvaluar: 0 };
    const utilidadSuma = { suma: 0, respuestas: 0, sinEvaluar: 0 };
    for (const u of this.usuarios.values()) {
      if (u.entrevista.estado !== 'pendiente') r.cuentas++;
      r.sesionesRegistradas += u.sesiones.length;
      switch (u.entrevista.estado) {
        case 'pendiente': r.entrevistas.pendientes++; break;
        case 'en-curso': r.entrevistas.enCurso++; break;
        case 'pospuesta': r.entrevistas.pospuestas++; break;
        case 'completada': r.entrevistas.completadas++; break;
      }
      switch (u.encuesta.estado) {
        case 'en-curso': r.encuestas.enCurso++; break;
        case 'pospuesta': r.encuestas.pospuestas++; break;
        case 'completada': r.encuestas.completadas++; break;
      }
      for (const clave of ['bienvenida', 'experiencia'] as const) {
        const b = u.beneficios[clave];
        if (b.estado === 'otorgado' || b.estado === 'reservado') {
          r.beneficios[clave].otorgados++;
          if (typeof b.dias === 'number') r.beneficios[clave].dias += b.dias;
        }
      }
      // Resultados agregados (solo formularios completados; nunca por persona).
      if (u.entrevista.estado === 'completada' && r.resultados) {
        r.resultados.entrevista.total++;
        this.agregarConteo(r.resultados.entrevista.roles, u.entrevista.respuestas['roles']);
        this.agregarConteo(r.resultados.entrevista.objetivo, u.entrevista.respuestas['objetivo']);
        this.agregarConteo(r.resultados.entrevista.areas, u.entrevista.respuestas['areas']);
        this.agregarConteo(r.resultados.entrevista.experiencia, u.entrevista.respuestas['experiencia']);
        this.agregarConteo(r.resultados.entrevista.formato, u.entrevista.respuestas['formato']);
        this.agregarConteo(r.resultados.entrevista.tiempo, u.entrevista.respuestas['tiempo']);
        this.agregarConteo(r.resultados.entrevista.origen, u.entrevista.respuestas['origen']);
      }
      if (u.encuesta.estado === 'completada' && r.resultados) {
        r.resultados.encuesta.total++;
        this.agregarConteo(r.resultados.encuesta.dificultad, u.encuesta.respuestas['dificultad']);
        this.acumularEscala(facilidadSuma, u.encuesta.respuestas['facilidad']);
        this.acumularEscala(utilidadSuma, u.encuesta.respuestas['utilidad']);
      }
    }
    if (r.resultados) {
      r.resultados.encuesta.facilidad = {
        respuestas: facilidadSuma.respuestas, sinEvaluar: facilidadSuma.sinEvaluar,
        promedio: facilidadSuma.respuestas > 0 ? Number((facilidadSuma.suma / facilidadSuma.respuestas).toFixed(2)) : null,
      };
      r.resultados.encuesta.utilidad = {
        respuestas: utilidadSuma.respuestas, sinEvaluar: utilidadSuma.sinEvaluar,
        promedio: utilidadSuma.respuestas > 0 ? Number((utilidadSuma.suma / utilidadSuma.respuestas).toFixed(2)) : null,
      };
    }
    return r;
  }

  private agregarConteo(destino: Record<string, number>, valor: unknown): void {
    const items = Array.isArray(valor) ? valor : [valor];
    for (const item of items) {
      if (typeof item === 'string' && item.length > 0) {
        destino[item] = (destino[item] || 0) + 1;
      }
    }
  }

  private acumularEscala(acc: { suma: number; respuestas: number; sinEvaluar: number }, valor: unknown) {
    if (typeof valor === 'number' && Number.isFinite(valor) && valor >= 1 && valor <= 5) {
      acc.suma += valor; acc.respuestas++;
    } else if (valor === 0 || valor === null || valor === undefined) {
      acc.sinEvaluar++;
    }
  }

  private esCampanaViva(): boolean {
    const c = this.configActual;
    if (!c.habilitada || !c.aprobado) return false;
    const ahora = Date.now();
    if (c.fechaInicio && Date.parse(c.fechaInicio) > ahora) return false;
    if (c.fechaFin && Date.parse(c.fechaFin) <= ahora) return false;
    return true;
  }
}
