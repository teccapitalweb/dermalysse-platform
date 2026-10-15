// Módulo «experiencia»: bienvenida (entrevista) y primera encuesta, con su beneficio de días VIP.
// Rutas (contrato de src/core/experiencia.ts y src/admin/experiencia.ts):
//   GET   /me/experiencia                       → ExperienciaDTO
//   POST  /me/experiencia/iniciar               { privacidadAceptada: true } → DTO
//   POST  /me/experiencia/sesion                {} → DTO (anota un día de uso, máximo 3)
//   PATCH /me/entrevista | /me/encuesta         { revision, paso, respuestas } → DTO
//   POST  /me/{flujo}/posponer                  { revision } → DTO
//   POST  /me/{flujo}/completar                 { revision, privacidadAceptada: true } → DTO (entrega el premio si corresponde)
//   GET   /admin/experiencia/config · PATCH     campaña de beneficios
//   GET   /admin/experiencia/resumen            totales agregados
//
// Firestore (solo vía FirestorePort; todo nuevo en v2_*):
//   v2_experiencia/{uid}                         estado por cuenta (sin nombre, correo ni teléfono)
//   v2_config/experiencia                        campaña { revision, campanaId, aprobado, habilitada, fechaInicio, fechaFin, cupo, premios? }
//   v2_experiencia_campanas/{campanaId}          contador { campanaId, reservadas }
//   v2_experiencia_reservas/{campanaId}__{uid}   plaza reservada
//   v2_experiencia_beneficios/{uid}__{tipo}      premio entregado (su existencia impide repetirlo)
//   v2_experiencia_cambios/config_{revision}     bitácora de cambios de campaña
// Lee (sin escribir): users/{uid} (vigencia y suscripción), members/{uid}.joined (cohorte), courses
// (catálogo publicado), v2_academia_intentos (examen calificado). Los días VIP se escriben SOLO con
// services/vip.ts (otorgarDiasVipEnTx, fuente 'bienvenida'), en la misma transacción que el estado.
import type { Request } from 'express';
import type { FirestorePort, Transaccion, Documento } from '../adapters/firestore/port.js';
import { aMillis } from '../adapters/firestore/port.js';
import { segmento } from '../adapters/firestore/v2.js';
import { cargarCatalogoEditorial, cursosPublicados, type CursoEditorial } from '../adapters/firestore/club.js';
import { FixtureContentStore } from '../adapters/dev/fixtureContent.js';
import { COLECCIONES_V2 } from '../adapters/firestore/v2.js';
import { texto } from '../adapters/firestore/port.js';
import { asyncHandler } from '../routes/util.js';
import { CodedError } from '../services/errors.js';
import { otorgarDiasVipEnTx } from '../services/vip.js';
import {
  BENEFICIO_DE, MAX_SESIONES, PASO_MAX, POSPONER_MS, PRIVACIDAD_VERSION,
  cambiosConfig, cohorteDe, completa, configPublica, cuerpo, disponibilidadEncuesta, dto, entero, exigirConsentimiento,
  hash, idCampanaValido, intentarReserva, normalizarBeneficio, normalizarConfig, normalizarEstado, normalizarReserva,
  premioAOtorgar, resumen, revisar, validarHabilitada, validarRespuestas, areasDe,
  type BeneficioOtorgado, type ConfigExperiencia, type Contexto, type CursoExperiencia, type TipoBeneficio,
} from '../services/experiencia.js';
import type { ModuloApi } from './tipos.js';

export const COLECCIONES_EXPERIENCIA = {
  cuentas: 'v2_experiencia',
  config: 'v2_config/experiencia',
  campanas: 'v2_experiencia_campanas',
  reservas: 'v2_experiencia_reservas',
  beneficios: 'v2_experiencia_beneficios',
  cambios: 'v2_experiencia_cambios',
} as const;
const C = COLECCIONES_EXPERIENCIA;

const rutaEstado = (uid: string) => `${C.cuentas}/${segmento(uid)}`;
const rutaBeneficio = (uid: string, tipo: TipoBeneficio) => `${C.beneficios}/${segmento(uid)}__${tipo}`;
const rutaContador = (campanaId: string) => `${C.campanas}/${segmento(campanaId)}`;
const rutaReserva = (campanaId: string, uid: string) => `${C.reservas}/${segmento(campanaId)}__${segmento(uid)}`;
const reservadasDe = (d: Documento | null) => {
  const n = d?.data()?.reservadas;
  return Number.isInteger(n) && (n as number) >= 0 ? n as number : 0;
};

interface Opciones {
  db: FirestorePort;
  ahora: () => Date;
  produccion: boolean;
}

/** Catálogo publicado: producción = `courses` publicados del catálogo editorial; desarrollo = fixture. */
function crearCatalogo(ctx: Opciones): () => Promise<CursoExperiencia[]> {
  if (!ctx.produccion) {
    const fixture = new FixtureContentStore();
    return async () => (await fixture.catalogo()).cursos
      .filter((c) => c.publicado !== false)
      .map((c) => ({ id: c.id, titulo: c.titulo, area: c.area, nivel: c.nivel, portada: c.portada, orden: c.orden }));
  }
  let editorial: CursoEditorial[] | null = null;
  return async () => {
    editorial ??= cargarCatalogoEditorial();
    return (await cursosPublicados(ctx.db, editorial)).map(({ editorial: e, datos }) => ({
      id: e.id,
      titulo: texto(datos.name).trim() || e.titulo,
      area: e.area || texto(datos.cat),
      nivel: e.nivel || texto(datos.level),
      portada: e.portada,
      orden: e.orden,
    }));
  };
}

export function moduloExperiencia(ctx: Opciones): ModuloApi {
  const { db } = ctx;
  const catalogo = crearCatalogo(ctx);

  /** Exámenes calificados por la API (Academia) de esta cuenta: evidencia de uso para la encuesta. */
  async function evaluaciones(uid: string): Promise<number[]> {
    const docs = await db.query(COLECCIONES_V2.academiaIntentos, { where: [{ campo: 'uid', op: '==', valor: uid }] });
    return docs
      .map((d) => d.data()?.ultimo as { fecha?: unknown } | undefined)
      .map((u) => (u && typeof u === 'object' ? aMillis(u.fecha) : NaN))
      .filter(Number.isFinite);
  }

  /**
   * Lee todo lo que una decisión necesita. `leer` es db.get o tx.get; las consultas (catálogo,
   * exámenes) van fuera de la transacción porque el puerto no las admite dentro.
   */
  async function contexto(req: Request, leer: (ruta: string) => Promise<Documento>, externos: { cursos: CursoExperiencia[]; evaluaciones: number[] }): Promise<Contexto & { existe: boolean }> {
    const u = req.usuario!;
    const ahora = ctx.ahora().getTime();
    const [estadoDoc, configDoc, usuarioDoc, miembroDoc, bienvenidaDoc, experienciaDoc] = await Promise.all([
      leer(rutaEstado(u.uid)), leer(C.config), leer(`users/${segmento(u.uid)}`), leer(`members/${segmento(u.uid)}`),
      leer(rutaBeneficio(u.uid, 'bienvenida')), leer(rutaBeneficio(u.uid, 'experiencia')),
    ]);
    const config = normalizarConfig(configDoc.data());
    let reservadas = 0;
    let reservaActual = null;
    if (idCampanaValido(config.campanaId)) {
      const [contador, reserva] = await Promise.all([leer(rutaContador(config.campanaId)), leer(rutaReserva(config.campanaId, u.uid))]);
      reservadas = reservadasDe(contador);
      reservaActual = normalizarReserva(reserva.data());
    }
    // Sin members/{uid} no hay evidencia de alta reciente: en producción se trata como cuenta existente.
    const cohorte = cohorteDe(miembroDoc.data(), ahora, ctx.produccion ? 'existente' : 'nueva');
    return {
      existe: estadoDoc.exists,
      ahora,
      estado: normalizarEstado(estadoDoc.data(), u.uid, cohorte),
      config,
      reservadas,
      reservaActual,
      usuario: usuarioDoc.data() ?? {},
      beneficios: { bienvenida: normalizarBeneficio(bienvenidaDoc.data(), 'bienvenida'), experiencia: normalizarBeneficio(experienciaDoc.data(), 'experiencia') },
      esAdmin: u.esAdmin,
      // Producción: claim email_verified del ID token. Desarrollo (sin claim): se considera verificado.
      emailVerificado: u.emailVerificado === true || (!ctx.produccion && u.emailVerificado === undefined),
      cursos: externos.cursos,
      evaluaciones: externos.evaluaciones,
    };
  }

  const externos = async (uid: string) => {
    const [cursos, ev] = await Promise.all([catalogo(), evaluaciones(uid)]);
    return { cursos, evaluaciones: ev };
  };

  /** Escribe la reserva (si la hubo) y el contador de la campaña. */
  function escribirReserva(tx: Transaccion, x: Contexto, r: ReturnType<typeof intentarReserva>) {
    if (!r) return;
    if (r.nuevaPlaza) {
      tx.set(rutaReserva(r.reserva.campanaId, r.reserva.uid), { ...r.reserva });
      tx.set(rutaContador(r.reserva.campanaId), { campanaId: r.reserva.campanaId, reservadas: x.reservadas, actualizado: new Date(x.ahora).toISOString() }, { merge: true });
    }
  }

  /** El documento de estado se reemplaza completo (lo leímos en esta transacción): así un borrador quita claves. */
  function escribirEstado(tx: Transaccion, x: Contexto) {
    tx.set(rutaEstado(x.estado.uid), { ...x.estado, actualizado: new Date(x.ahora).toISOString() });
  }

  return ({ app, requireUser, requireAdmin }) => {
    app.get('/me/experiencia', requireUser, asyncHandler(async (req, res) => {
      const x = await contexto(req, (r) => db.get(r), await externos(req.usuario!.uid));
      res.set('Cache-Control', 'no-store');
      res.json(dto(x));
    }));

    app.post('/me/experiencia/iniciar', requireUser, asyncHandler(async (req, res) => {
      exigirConsentimiento(cuerpo(req.body, ['privacidadAceptada']));
      const ext = await externos(req.usuario!.uid);
      const resultado = await db.runTransaction(async (tx) => {
        const x = await contexto(req, (r) => tx.get(r), ext);
        const nueva = !x.estado.primerAccesoEn;
        if (nueva) {
          const ahoraIso = new Date(x.ahora).toISOString();
          x.estado.primerAccesoEn = ahoraIso;
          x.estado.privacidad = { version: PRIVACIDAD_VERSION, aceptadaEn: ahoraIso, usoAceptado: true };
          if (x.estado.entrevista.estado === 'pendiente') {
            x.estado.entrevista.estado = 'en-curso';
            x.estado.entrevista.revision += 1;
          }
        }
        const reserva = intentarReserva(x);
        if (nueva || reserva) {
          escribirReserva(tx, x, reserva);
          escribirEstado(tx, x);
        }
        return dto(x);
      });
      res.json(resultado);
    }));

    app.post('/me/experiencia/sesion', requireUser, asyncHandler(async (req, res) => {
      cuerpo(req.body ?? {}, []);
      const ext = await externos(req.usuario!.uid);
      const resultado = await db.runTransaction(async (tx) => {
        const x = await contexto(req, (r) => tx.get(r), ext);
        if (!x.existe || !x.estado.privacidad?.usoAceptado || !x.estado.primerAccesoEn) {
          throw new CodedError(409, 'experiencia_no_iniciada', 'Inicia la bienvenida y acepta el aviso antes de registrar uso.');
        }
        const dia = new Date(x.ahora).toISOString().slice(0, 10);
        if (!x.estado.sesiones.includes(dia) && x.estado.sesiones.length < MAX_SESIONES && x.estado.encuesta.estado !== 'completada') {
          x.estado.sesiones.push(dia);
          escribirEstado(tx, x);
        }
        return dto(x);
      });
      res.json(resultado);
    }));

    for (const flujo of ['entrevista', 'encuesta'] as const) {
      for (const accion of ['guardar', 'posponer', 'completar'] as const) {
        const ruta = `/me/${flujo}${accion === 'guardar' ? '' : `/${accion}`}`;
        const claves = accion === 'guardar' ? ['revision', 'paso', 'respuestas'] : accion === 'completar' ? ['revision', 'privacidadAceptada'] : ['revision'];
        const manejador = asyncHandler(async (req, res) => {
          const b = cuerpo(req.body, claves);
          const revision = entero(b.revision, 'revision', 0, 1_000_000);
          if (accion === 'completar') exigirConsentimiento(b);
          const paso = accion === 'guardar' ? entero(b.paso, 'paso', 0, PASO_MAX[flujo]) : null;
          const ext = await externos(req.usuario!.uid);
          const areas = areasDe(ext.cursos);
          // Validar antes de abrir la transacción: un cuerpo inválido no toca Firestore.
          const respuestas = accion === 'guardar' ? validarRespuestas(b.respuestas, flujo, areas) : null;
          const firma = hash(JSON.stringify({ accion, paso, respuestas }));
          const resultado = await db.runTransaction(async (tx) => {
            const x = await contexto(req, (r) => tx.get(r), ext);
            if (!x.existe || !x.estado.privacidad || !x.estado.primerAccesoEn) {
              throw new CodedError(409, 'experiencia_no_iniciada', 'Primero inicia la bienvenida.');
            }
            const form = x.estado[flujo];
            // Reintentar el cierre no incrementa revisiones ni entrega el premio otra vez.
            if (form.estado === 'completada' && accion === 'completar') return dto(x);
            if (form.estado === 'completada') throw new CodedError(409, 'formulario_completado', 'Este formulario ya está completado.');
            if (revisar(form, revision, firma)) return dto(x);
            if (flujo === 'encuesta' && !disponibilidadEncuesta(x).lista) {
              throw new CodedError(409, 'encuesta_no_disponible', 'La encuesta se habilita tras 7 días, 3 días de uso y un examen calificado.');
            }
            const ahoraIso = new Date(x.ahora).toISOString();
            if (accion === 'guardar') {
              form.respuestas = respuestas!;
              form.paso = paso!;
              form.estado = 'en-curso';
              form.pospuestaHasta = null;
            } else if (accion === 'posponer') {
              form.estado = 'pospuesta';
              form.pospuestaHasta = new Date(x.ahora + POSPONER_MS).toISOString();
            } else {
              form.respuestas = validarRespuestas(form.respuestas, flujo, areas, true);
              if (!completa(form.respuestas, flujo)) throw new CodedError(400, 'respuestas_incompletas', 'Responde todas las preguntas obligatorias antes de terminar.');
              form.estado = 'completada';
              form.completadaEn = ahoraIso;
              form.pospuestaHasta = null;
            }
            form.revision += 1;
            form.ultimaOperacion = firma;

            let reserva: ReturnType<typeof intentarReserva> = null;
            let otorgado: BeneficioOtorgado | null = null;
            if (accion === 'completar') {
              reserva = intentarReserva(x);
              const tipo = BENEFICIO_DE[flujo];
              const dias = premioAOtorgar(x, tipo);
              if (dias !== null) {
                // otorgarDiasVipEnTx lee users/{uid}: va ANTES de cualquier escritura de esta transacción.
                const vip = await otorgarDiasVipEnTx(tx, {
                  uid: x.estado.uid, dias, fuente: 'bienvenida', referencia: `experiencia:${tipo}:${x.estado.reserva!.campanaId}`,
                }, new Date(x.ahora), `bienvenida_${segmento(x.estado.uid)}_${tipo}`);
                otorgado = {
                  uid: x.estado.uid, tipo, campanaId: x.estado.reserva!.campanaId, dias,
                  otorgadoEn: ahoraIso, hasta: vip.vigenciaHasta, venceOferta: x.estado.reserva!.venceOferta,
                };
                x.estado.programa = { dias: x.estado.programa.dias + dias, hasta: vip.vigenciaHasta };
                x.beneficios[tipo] = otorgado;
              }
            }
            escribirReserva(tx, x, reserva);
            if (otorgado) tx.set(rutaBeneficio(otorgado.uid, otorgado.tipo), { ...otorgado, version: 1 });
            escribirEstado(tx, x);
            return dto(x);
          });
          res.json(resultado);
        });
        if (accion === 'guardar') app.patch(ruta, requireUser, manejador);
        else app.post(ruta, requireUser, manejador);
      }
    }

    // ── Administración ──

    async function leerConfig(leer: (ruta: string) => Promise<Documento>): Promise<{ config: ConfigExperiencia; reservadas: number }> {
      const config = normalizarConfig((await leer(C.config)).data());
      const reservadas = idCampanaValido(config.campanaId) ? reservadasDe(await leer(rutaContador(config.campanaId))) : 0;
      return { config, reservadas };
    }

    app.get('/admin/experiencia/config', requireAdmin, asyncHandler(async (_req, res) => {
      const { config, reservadas } = await leerConfig((r) => db.get(r));
      res.set('Cache-Control', 'no-store');
      res.json(configPublica(config, reservadas));
    }));

    app.patch('/admin/experiencia/config', requireAdmin, asyncHandler(async (req, res) => {
      const { revision, campos } = cambiosConfig(req.body);
      const ahora = ctx.ahora().getTime();
      const resultado = await db.runTransaction(async (tx) => {
        const anterior = await leerConfig((r) => tx.get(r));
        if (anterior.config.revision !== revision) {
          throw new CodedError(409, 'revision_desactualizada', 'La configuración cambió; recárgala antes de guardar.', { revisionActual: anterior.config.revision });
        }
        const config: ConfigExperiencia = { ...anterior.config, ...campos, version: 1, revision: revision + 1 };
        const reservadasNueva = config.campanaId === anterior.config.campanaId
          ? anterior.reservadas
          : idCampanaValido(config.campanaId) ? reservadasDe(await tx.get(rutaContador(config.campanaId))) : 0;
        if (anterior.reservadas > 0 && (['campanaId', 'fechaInicio', 'fechaFin'] as const).some((k) => anterior.config[k] !== config[k])) {
          throw new CodedError(409, 'campana_con_reservas', 'La campaña ya tiene reservas: conserva su identificador y sus fechas.');
        }
        if (config.cupo < reservadasNueva) throw new CodedError(409, 'cupo_inferior_reservas', 'El cupo no puede ser menor que las plazas ya reservadas.');
        validarHabilitada(config, ahora);
        const ahoraIso = new Date(ahora).toISOString();
        // Los premios no se escriben aquí: se conservan los del documento (o los valores por defecto).
        const { premios: _p, ...guardar } = config;
        tx.set(C.config, { ...guardar, actualizado: ahoraIso, actualizadoPor: req.usuario!.uid }, { merge: true });
        tx.set(`${C.cambios}/config_${config.revision}`, { tipo: 'config', actorUid: req.usuario!.uid, revision: config.revision, fecha: ahoraIso, campos: Object.keys(campos) });
        return configPublica(config, reservadasNueva);
      });
      res.json(resultado);
    }));

    app.get('/admin/experiencia/resumen', requireAdmin, asyncHandler(async (_req, res) => {
      const [cuentas, beneficios, { config, reservadas }] = await Promise.all([
        db.query(C.cuentas), db.query(C.beneficios), leerConfig((r) => db.get(r)),
      ]);
      res.set('Cache-Control', 'no-store');
      res.json(resumen(
        cuentas.map((d) => ({ ...(d.data() ?? {}), uid: d.id })),
        beneficios.map((d) => d.data() ?? {}),
        config, reservadas,
      ));
    }));
  };
}
