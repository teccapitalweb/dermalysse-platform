import { api, Auth } from '../core/auth';
import { Datos } from '../core/datos';
import { esc } from '../ui/partials';
import { etiquetaExperiencia } from '../ui/experiencia';
import { adminHead } from './shell';
import '../styles/admin-experiencia.css';

type Conteo = Record<string, number>;
interface EscalaResultado { respuestas: number; sinEvaluar: number; promedio: number | null }
interface ResultadosExperiencia {
  entrevista: { total: number; roles: Conteo; objetivo: Conteo; areas: Conteo; experiencia: Conteo; formato: Conteo; tiempo: Conteo; origen: Conteo };
  encuesta: { total: number; facilidad: EscalaResultado; utilidad: EscalaResultado; dificultad: Conteo };
}

interface ConfigExperiencia {
  version: 1;
  revision: number;
  campanaId: string | null;
  aprobado: boolean;
  habilitada: boolean;
  fechaInicio: string | null;
  fechaFin: string | null;
  cupo: number;
  reservadas: number;
  premios: { bienvenida: 7; experiencia: 15 };
}

interface ResumenExperiencia {
  version: 1;
  cuentas: number;
  entrevistas: { pendientes: number; enCurso: number; pospuestas: number; completadas: number };
  encuestas: { enCurso: number; pospuestas: number; completadas: number };
  sesionesRegistradas: number;
  beneficios: { bienvenida: { otorgados: number; dias: number }; experiencia: { otorgados: number; dias: number } };
  campana: { campanaId: string | null; reservadas: number; cupo: number };
  /** Conteos por opción de formularios terminados. Una API anterior puede no enviarlo. */
  resultados?: ResultadosExperiencia;
}

type PoliticaExperiencia = Omit<ConfigExperiencia, 'version' | 'reservadas' | 'premios'>;

const configuracionInicial = (): ConfigExperiencia => ({
  version: 1, revision: 0, campanaId: null, aprobado: false, habilitada: false,
  fechaInicio: null, fechaFin: null, cupo: 0, reservadas: 0,
  premios: { bienvenida: 7, experiencia: 15 },
});

// Solo la demostración usa estado en memoria: no se crea una campaña externa.
let configuracionDemo = configuracionInicial();
/** En demo el único participante posible es la cuenta de demostración de este navegador. */
function resumenDemo(): ResumenExperiencia {
  type Formulario = { estado?: string; respuestas?: Record<string, unknown> };
  let local: { entrevista?: Formulario; encuesta?: Formulario } | null = null;
  try { local = JSON.parse(localStorage.getItem(`dermalysse:experiencia:v1:${Auth.usuario?.uid || 'demo'}`) || 'null'); } catch { /* sin participación local */ }
  const terminada = (f?: Formulario) => f?.estado === 'completada' ? f.respuestas || {} : null;
  const entrevista = terminada(local?.entrevista), encuesta = terminada(local?.encuesta);
  const conteo = (r: Record<string, unknown> | null, clave: string): Conteo => {
    const v = r?.[clave];
    return Object.fromEntries((Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === 'string' && !!x).map((x) => [x, 1]));
  };
  const escala = (clave: string): EscalaResultado => {
    const v = encuesta?.[clave];
    return typeof v === 'number' && v > 0 ? { respuestas: 1, sinEvaluar: 0, promedio: v } : { respuestas: 0, sinEvaluar: v === 0 ? 1 : 0, promedio: null };
  };
  const estado = local?.entrevista?.estado;
  return {
    version: 1, cuentas: estado && estado !== 'pendiente' ? 1 : 0,
    entrevistas: { pendientes: 0, enCurso: estado === 'en-curso' ? 1 : 0, pospuestas: estado === 'pospuesta' ? 1 : 0, completadas: entrevista ? 1 : 0 },
    encuestas: { enCurso: local?.encuesta?.estado === 'en-curso' ? 1 : 0, pospuestas: 0, completadas: encuesta ? 1 : 0 },
    sesionesRegistradas: 0,
    beneficios: { bienvenida: { otorgados: 0, dias: 0 }, experiencia: { otorgados: 0, dias: 0 } },
    campana: { campanaId: configuracionDemo.campanaId, reservadas: 0, cupo: configuracionDemo.cupo },
    resultados: {
      entrevista: { total: entrevista ? 1 : 0, roles: conteo(entrevista, 'roles'), objetivo: conteo(entrevista, 'objetivo'), areas: conteo(entrevista, 'areas'), experiencia: conteo(entrevista, 'experiencia'), formato: conteo(entrevista, 'formato'), tiempo: conteo(entrevista, 'tiempo'), origen: conteo(entrevista, 'origen') },
      encuesta: { total: encuesta ? 1 : 0, facilidad: escala('facilidad'), utilidad: escala('utilidad'), dificultad: conteo(encuesta, 'dificultad') },
    },
  };
}

const entero = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;
const fechaValida = (f: unknown) => f === null || typeof f === 'string' && Number.isFinite(Date.parse(f));
function validarConfig(c: ConfigExperiencia) {
  if (!c || c.version !== 1 || !entero(c.revision) || !entero(c.cupo) || !entero(c.reservadas)
    || typeof c.aprobado !== 'boolean' || typeof c.habilitada !== 'boolean'
    || !(c.campanaId === null || typeof c.campanaId === 'string')
    || !fechaValida(c.fechaInicio) || !fechaValida(c.fechaFin)
    || c.premios?.bienvenida !== 7 || c.premios?.experiencia !== 15) {
    throw new Error('La configuración recibida no es válida. No se habilitaron premios.');
  }
  return c;
}

function validarResumen(r: ResumenExperiencia) {
  const valores = [r?.cuentas, r?.sesionesRegistradas,
    ...Object.values(r?.entrevistas || {}), ...Object.values(r?.encuestas || {}),
    r?.beneficios?.bienvenida?.otorgados, r?.beneficios?.bienvenida?.dias,
    r?.beneficios?.experiencia?.otorgados, r?.beneficios?.experiencia?.dias,
    r?.campana?.reservadas, r?.campana?.cupo];
  if (!r || r.version !== 1 || !valores.every(entero)
    || !['pendientes', 'enCurso', 'pospuestas', 'completadas'].every((k) => entero(r.entrevistas?.[k as keyof ResumenExperiencia['entrevistas']]))
    || !['enCurso', 'pospuestas', 'completadas'].every((k) => entero(r.encuestas?.[k as keyof ResumenExperiencia['encuestas']]))) {
    throw new Error('No pudimos verificar el resumen. Intenta actualizarlo.');
  }
  return r;
}

const numero = (n: number) => n.toLocaleString('es-MX');
const fecha = (f: string | null) => f ? new Date(f).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin definir';
function localFecha(f: string | null) {
  if (!f) return '';
  const d = new Date(f);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export function paginaAdminExperiencia() {
  return `<section class="aexp" data-admin-experiencia>
    ${adminHead('Bienvenida y encuestas', 'Conoce la participación del club y prepara beneficios responsables.')}
    ${Datos.modo === 'demo' ? '<div class="aexp-notice aexp-notice--demo"><strong>Demostración local.</strong> Los cambios se simulan durante esta sesión. No envían datos, no modifican Firebase y no conceden acceso VIP real.</div>' : '<div class="aexp-notice"><strong>Administración autenticada.</strong> La API verifica el permiso admin. Guardar una política modifica una promoción del entorno conectado.</div>'}
    <div class="aexp-state" data-aexp-estado role="status" aria-live="polite">Cargando configuración y resumen…</div>
    <div data-aexp-contenido aria-busy="true"></div>
    <dialog class="aexp-dialog" data-aexp-confirmar aria-labelledby="aexp-confirmar-titulo" aria-describedby="aexp-confirmar-aviso">
      <div class="aexp-dialog__body">
        <span class="eyebrow">Revisión antes de guardar</span>
        <h2 id="aexp-confirmar-titulo">Confirmar cambio de campaña</h2>
        <div data-aexp-confirmar-resumen></div>
        <p id="aexp-confirmar-aviso" class="aexp-notice"><strong>Este cambio sí modifica la API conectada.</strong> Habilitar la campaña permite beneficios VIP para cuentas elegibles dentro del cupo y la vigencia. No retrasa ni cancela cobros de Stripe.</p>
        <p data-aexp-confirmar-error role="alert"></p>
        <div class="aexp-actions"><button type="button" class="btn btn--secondary" data-aexp-cancelar>Volver a revisar</button><button type="button" class="btn btn--brand" data-aexp-guardar>Guardar en API</button></div>
      </div>
    </dialog>
  </section>`;
}

function barras(titulo: string, conteo: Conteo | undefined, total: number) {
  const filas = Object.entries(conteo || {}).filter(([, n]) => Number.isSafeInteger(n) && n > 0).sort((a, b) => b[1] - a[1]);
  if (!filas.length || total <= 0) return '';
  const max = filas[0][1];
  return `<div class="aexp-chart"><h3>${titulo}</h3>${filas.map(([clave, n]) => `<div class="aexp-bar"><span class="aexp-bar__label">${esc(etiquetaExperiencia(clave))}</span><span class="aexp-bar__track"><i style="width:${Math.round(n / max * 100)}%"></i></span><b>${numero(n)}</b><small>${Math.round(n / total * 100)}%</small></div>`).join('')}</div>`;
}
function promedio(titulo: string, e: EscalaResultado | undefined) {
  if (!e) return '';
  return `<div class="aexp-score"><span>${titulo}</span><strong>${e.promedio === null ? '—' : e.promedio.toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<small> / 5</small></strong><em>${numero(e.respuestas)} ${e.respuestas === 1 ? 'respuesta' : 'respuestas'}${e.sinEvaluar ? ` · ${numero(e.sinEvaluar)} sin evaluar` : ''}</em></div>`;
}
function resultadosHTML(r: ResumenExperiencia) {
  const x = r.resultados;
  if (!x || (!x.entrevista?.total && !x.encuesta?.total)) return '';
  const e = x.entrevista, s = x.encuesta;
  return `<section class="card card--pad aexp-results" aria-labelledby="aexp-resultados-titulo">
    <div class="aexp-results__head"><div><span class="eyebrow">Resultados agrupados</span><h2 id="aexp-resultados-titulo">Lo que respondieron</h2></div><span class="chip">${numero(e.total)} ${e.total === 1 ? 'bienvenida' : 'bienvenidas'} · ${numero(s.total)} ${s.total === 1 ? 'encuesta' : 'encuestas'}</span></div>
    ${e.total ? `<div class="aexp-results__grid">${barras('¿A qué se dedican?', e.roles, e.total)}${barras('¿Qué buscan?', e.objetivo, e.total)}${barras('Áreas que les interesan', e.areas, e.total)}${barras('Experiencia', e.experiencia, e.total)}${barras('Cómo prefieren aprender', e.formato, e.total)}${barras('Cuándo aprenden', e.tiempo, e.total)}${barras('Cómo conocieron el club', e.origen, e.total)}</div>` : ''}
    ${s.total ? `<div class="aexp-results__scores">${promedio('Facilidad de uso', s.facilidad)}${promedio('Utilidad del contenido', s.utilidad)}</div><div class="aexp-results__grid">${barras('Dificultad principal', s.dificultad, s.total)}</div>` : ''}
    <p class="aexp-hint">Conteos de formularios terminados; no se muestran respuestas por persona ni textos libres. En rol y áreas cada quien puede elegir hasta tres opciones, por eso los porcentajes pueden sumar más de 100.</p>
  </section>`;
}

function contenido(c: ConfigExperiencia, r: ResumenExperiencia) {
  const tieneReservas = c.reservadas > 0;
  const beneficios = r.beneficios.bienvenida.otorgados + r.beneficios.experiencia.otorgados;
  return `<div class="aexp-heading"><div><span class="chip ${c.habilitada ? 'chip--primary' : ''}">${c.habilitada ? 'Campaña habilitada' : 'Campaña desactivada'}</span><p class="muted">${c.habilitada ? 'Los beneficios siguen sujetos a aprobación, fechas, cupo y elegibilidad del servidor.' : 'La entrevista sigue disponible sin prometer ni otorgar premios.'}</p></div><button class="btn btn--secondary" type="button" data-aexp-actualizar>Actualizar resumen</button></div>
    <div class="aexp-kpis" aria-label="Participación agregada">
      ${[['Cuentas participantes', r.cuentas, 'Sin nombres ni correos'], ['Entrevistas completadas', r.entrevistas.completadas, 'Una entrevista por cuenta'], ['Encuestas completadas', r.encuestas.completadas, 'Primera experiencia'], ['Beneficios entregados', beneficios, 'Confirmados por el servidor']].map(([titulo, valor, nota]) => `<div class="kpi"><span class="kpi__label">${titulo}</span><strong class="kpi__val">${numero(valor as number)}</strong><span class="kpi__nota">${nota}</span></div>`).join('')}
    </div>
    ${r.cuentas === 0 ? '<p class="aexp-empty">Todavía no hay participación registrada. Aquí aparecerán los resultados agrupados por pregunta, nunca respuestas por persona.</p>' : ''}
    ${resultadosHTML(r)}
    <div class="aexp-grid">
      <form class="card card--pad aexp-form" data-aexp-form>
        <fieldset data-aexp-campos>
          <legend>Política de beneficios</legend>
          <p class="muted">Premios fijos: <strong>7 días VIP</strong> por la bienvenida y <strong>15 días VIP</strong> por la primera encuesta. No son XP ni una ruleta aleatoria.</p>
          <div class="field"><label for="aexp-id">Identificador de campaña</label><input class="input" id="aexp-id" name="campanaId" value="${esc(c.campanaId || '')}" maxlength="80" pattern="[A-Za-z0-9_-]+" placeholder="Ej. bienvenida-2026" autocomplete="off" ${tieneReservas ? 'readonly' : ''}><p class="aexp-hint">Hasta 80 letras, números, guiones o guion bajo. Sin nombres ni datos de personas.</p></div>
          <div class="aexp-dates">
            <div class="field"><label for="aexp-inicio">Inicio de la promoción</label><input class="input" id="aexp-inicio" name="fechaInicio" type="datetime-local" value="${esc(localFecha(c.fechaInicio))}" ${tieneReservas ? 'readonly' : ''}></div>
            <div class="field"><label for="aexp-fin">Fin de la promoción</label><input class="input" id="aexp-fin" name="fechaFin" type="datetime-local" value="${esc(localFecha(c.fechaFin))}" ${tieneReservas ? 'readonly' : ''}></div>
          </div>
          <p class="aexp-hint">Horario local de este dispositivo; la API guarda fechas UTC. ${tieneReservas ? 'Hay reservas: no se puede cambiar el identificador ni las fechas.' : 'La fecha final debe ser posterior al inicio.'}</p>
          <div class="field"><label for="aexp-cupo">Cupo de participaciones con beneficio</label><input class="input" id="aexp-cupo" name="cupo" type="number" min="${c.reservadas}" max="100000" step="1" value="${c.cupo}" required><p class="aexp-hint">${numero(c.reservadas)} ya reservadas. El servidor controla el cupo; no puede reducirse por debajo de las reservas.</p></div>
          <label class="aexp-check" for="aexp-aprobado"><input id="aexp-aprobado" name="aprobado" type="checkbox" ${c.aprobado ? 'checked' : ''}><span><strong>Privacidad y beneficio VIP revisados</strong><small>Confirmo la finalidad de los datos, las condiciones de la promoción y el tratamiento de miembros con suscripción de pago.</small></span></label>
          <label class="aexp-check" for="aexp-habilitada"><input id="aexp-habilitada" name="habilitada" type="checkbox" ${c.habilitada ? 'checked' : ''}><span><strong>Habilitar campaña de beneficios</strong><small>Desmarcado: se puede participar sin una promesa de premio. No revoca beneficios ya entregados.</small></span></label>
          <div class="aexp-notice aexp-notice--review">Antes de activar: revisión del aviso de privacidad y prueba de canje con una cuenta autorizada. El acceso VIP no representa una pausa, reembolso ni extensión de los cobros de Stripe.</div>
          <p class="aexp-error" data-aexp-form-error role="alert"></p>
          <button class="btn btn--brand" type="submit">${Datos.modo === 'demo' ? 'Simular guardado' : 'Revisar y guardar política'}</button>
        </fieldset>
      </form>
      <div class="aexp-side">
        <section class="card card--pad aexp-preview" aria-labelledby="aexp-preview-titulo"><img src="/media/hero-model.png" alt="" width="1086" height="1448"><div><span class="eyebrow">La guía Dermalysse</span><h2 id="aexp-preview-titulo">Escuchar también es acompañar.</h2><p class="muted">Una pregunta a la vez. Se puede posponer, retomar y opinar con libertad: una crítica no reduce el beneficio.</p></div></section>
        <section class="card card--pad"><h2 class="admin-card-title">Estado de los recorridos</h2><dl class="aexp-summary">
          <div><dt>Entrevistas pendientes</dt><dd>${numero(r.entrevistas.pendientes)}</dd></div><div><dt>Entrevistas en curso</dt><dd>${numero(r.entrevistas.enCurso)}</dd></div><div><dt>Entrevistas pospuestas</dt><dd>${numero(r.entrevistas.pospuestas)}</dd></div>
          <div><dt>Encuestas en curso</dt><dd>${numero(r.encuestas.enCurso)}</dd></div><div><dt>Encuestas pospuestas</dt><dd>${numero(r.encuestas.pospuestas)}</dd></div><div><dt>Sesiones registradas</dt><dd>${numero(r.sesionesRegistradas)}</dd></div>
        </dl></section>
        <section class="card card--pad"><h2 class="admin-card-title">Beneficios confirmados</h2><dl class="aexp-summary"><div><dt>Bienvenida</dt><dd>${numero(r.beneficios.bienvenida.otorgados)} · ${numero(r.beneficios.bienvenida.dias)} días</dd></div><div><dt>Primera encuesta</dt><dd>${numero(r.beneficios.experiencia.otorgados)} · ${numero(r.beneficios.experiencia.dias)} días</dd></div><div><dt>Reservas de campaña</dt><dd>${numero(r.campana.reservadas)} / ${numero(r.campana.cupo)}</dd></div></dl><p class="aexp-hint">Totales agregados. No muestra datos personales ni transcripciones.</p></section>
      </div>
    </div>`;
}

function politica(form: HTMLFormElement, actual: ConfigExperiencia): PoliticaExperiencia {
  const f = new FormData(form);
  const fechaISO = (nombre: string) => {
    const v = String(f.get(nombre) || '');
    if (!v) return null;
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) throw new Error('Revisa las fechas de la promoción.');
    return d.toISOString();
  };
  const cupo = Number(f.get('cupo'));
  const p: PoliticaExperiencia = {
    revision: actual.revision, campanaId: String(f.get('campanaId') || '').trim() || null,
    aprobado: f.get('aprobado') === 'on', habilitada: f.get('habilitada') === 'on',
    fechaInicio: fechaISO('fechaInicio'), fechaFin: fechaISO('fechaFin'), cupo,
  };
  // No transformar fechas con segundos reservadas al convertir datetime-local.
  if (actual.reservadas > 0) {
    p.campanaId = actual.campanaId;
    p.fechaInicio = actual.fechaInicio;
    p.fechaFin = actual.fechaFin;
  }
  if (!entero(cupo) || cupo > 100000 || cupo < actual.reservadas) throw new Error('El cupo debe ser entero entre las reservas actuales y 100,000.');
  if (p.campanaId && !/^[A-Za-z0-9_-]{1,80}$/.test(p.campanaId)) throw new Error('Usa hasta 80 letras, números, guiones o guion bajo para el identificador.');
  if (p.fechaInicio && p.fechaFin && Date.parse(p.fechaFin) <= Date.parse(p.fechaInicio)) throw new Error('El fin de la promoción debe ser posterior al inicio.');
  if (p.habilitada && (!p.aprobado || !p.campanaId || !p.fechaInicio || !p.fechaFin || cupo <= 0)) throw new Error('Para habilitar, revisa y aprueba la política, define identificador, fechas y un cupo mayor que cero.');
  if (p.habilitada && p.fechaFin && Date.parse(p.fechaFin) <= Date.now()) throw new Error('No se puede habilitar una promoción vencida. Define un fin futuro.');
  return p;
}

function mensaje(error: unknown) {
  const e = error as { status?: number; message?: string };
  if (e?.status === 401 || e?.status === 403) return 'La API no confirmó tu permiso de administración. Inicia sesión con una cuenta autorizada.';
  if (e?.status === 409) return 'La política cambió o ya tiene reservas. No se guardó este cambio; recarga la página para revisar la versión actual.';
  return e?.message || 'No pudimos conectar con el módulo. Intenta de nuevo.';
}

/** Montar tras pintar la ruta. El cleanup cancela solicitudes y cierra el diálogo. */
export function montarAdminExperiencia() {
  const root = document.querySelector<HTMLElement>('[data-admin-experiencia]');
  if (!root) return () => {};
  const body = root.querySelector<HTMLElement>('[data-aexp-contenido]')!;
  const estado = root.querySelector<HTMLElement>('[data-aexp-estado]')!;
  const dialog = root.querySelector<HTMLDialogElement>('[data-aexp-confirmar]')!;
  const modalError = root.querySelector<HTMLElement>('[data-aexp-confirmar-error]')!;
  const controller = new AbortController();
  let actual: ConfigExperiencia | null = null;
  let agregado: ResumenExperiencia | null = null;
  let propuesta: PoliticaExperiencia | null = null;
  let ocupado = false;
  let terminado = false;

  const permiso = () => Datos.modo === 'demo' || Auth.usuario?.esAdmin === true;
  const pintar = () => {
    if (terminado || !actual || !agregado) return;
    body.innerHTML = contenido(actual, agregado);
    body.setAttribute('aria-busy', 'false');
  };
  const busy = (b: boolean) => {
    ocupado = b;
    root.querySelectorAll<HTMLButtonElement>('[data-aexp-guardar], [data-aexp-cancelar], [data-aexp-actualizar]').forEach((e) => { e.disabled = b; });
    const fields = root.querySelector<HTMLFieldSetElement>('[data-aexp-campos]');
    if (fields) fields.disabled = b;
  };

  const cargar = async (soloResumen = false) => {
    if (ocupado || terminado) return;
    if (!permiso()) { estado.textContent = 'Se requiere una cuenta administradora. No se cargó información del módulo.'; return; }
    busy(true);
    estado.textContent = soloResumen ? 'Actualizando el resumen…' : 'Cargando configuración y resumen…';
    try {
      if (Datos.modo === 'demo') {
        if (!soloResumen) actual = structuredClone(configuracionDemo);
        agregado = resumenDemo();
      } else {
        const peticiones = [api<ResumenExperiencia>('/admin/experiencia/resumen', { signal: controller.signal }).then(validarResumen)];
        if (soloResumen) agregado = await peticiones[0];
        else {
          const [r, c] = await Promise.all([peticiones[0], api<ConfigExperiencia>('/admin/experiencia/config', { signal: controller.signal }).then(validarConfig)]);
          agregado = r; actual = c;
        }
      }
      if (terminado) return;
      // Un refresco del resumen no descarta una política que se está editando.
      if (soloResumen) {
        const form = root.querySelector<HTMLFormElement>('[data-aexp-form]');
        const formularioHTML = form?.outerHTML;
        const valores = form ? Array.from(form.elements).filter((e): e is HTMLInputElement => e instanceof HTMLInputElement).map((e) => ({ nombre: e.name, valor: e.value, marcado: e.checked })) : [];
        pintar();
        if (formularioHTML) {
          const nuevoForm = root.querySelector<HTMLFormElement>('[data-aexp-form]')!;
          nuevoForm.outerHTML = formularioHTML;
          valores.forEach((v) => { const input = root.querySelector<HTMLInputElement>(`[data-aexp-form] input[name="${v.nombre}"]`); if (input) { input.value = v.valor; input.checked = v.marcado; } });
        }
      } else pintar();
      estado.textContent = Datos.modo === 'demo' ? 'Vista de demostración: sin datos ni beneficios reales.' : 'Datos confirmados por la API. El formulario no guarda automáticamente.';
    } catch (e) {
      if (terminado) return;
      estado.textContent = mensaje(e);
      if (!actual) body.innerHTML = '<button class="btn btn--secondary" type="button" data-aexp-reintentar>Reintentar carga</button>';
      body.setAttribute('aria-busy', 'false');
    } finally { if (!terminado) busy(false); }
  };

  const guardar = async () => {
    if (!propuesta || !actual || ocupado || !permiso()) return;
    busy(true);
    modalError.textContent = '';
    estado.textContent = Datos.modo === 'demo' ? 'Simulando guardado local…' : 'Guardando política en la API…';
    try {
      if (Datos.modo === 'demo') {
        configuracionDemo = { ...actual, ...propuesta, revision: actual.revision + 1 };
        actual = structuredClone(configuracionDemo);
        agregado = resumenDemo();
      } else actual = validarConfig(await api<ConfigExperiencia>('/admin/experiencia/config', { method: 'PATCH', json: propuesta, signal: controller.signal }));
      if (terminado) return;
      propuesta = null;
      dialog.close();
      pintar();
      estado.textContent = Datos.modo === 'demo' ? 'Guardado simulado. No hay cambios externos ni acceso VIP real.' : 'Política guardada por la API. Los beneficios siguen sujetos a las condiciones del servidor.';
      root.querySelector<HTMLButtonElement>('[data-aexp-form] button[type="submit"]')?.focus({ preventScroll: true });
    } catch (e) {
      if (terminado) return;
      modalError.textContent = mensaje(e);
      estado.textContent = mensaje(e);
      root.querySelector<HTMLElement>('[data-aexp-form-error]')!.textContent = mensaje(e);
    } finally { if (!terminado) busy(false); }
  };

  const onSubmit = (e: Event) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.matches('[data-aexp-form]')) return;
    e.preventDefault();
    if (!actual || ocupado) return;
    const error = root.querySelector<HTMLElement>('[data-aexp-form-error]')!;
    error.textContent = '';
    try {
      propuesta = politica(form, actual);
      if (Datos.modo === 'demo') { void guardar(); return; }
      root.querySelector<HTMLElement>('[data-aexp-confirmar-resumen]')!.innerHTML = `<dl class="aexp-summary"><div><dt>Estado solicitado</dt><dd>${propuesta.habilitada ? 'Habilitada' : 'Desactivada'}</dd></div><div><dt>Campaña</dt><dd>${esc(propuesta.campanaId || 'Sin definir')}</dd></div><div><dt>Inicio</dt><dd>${esc(fecha(propuesta.fechaInicio))}</dd></div><div><dt>Fin</dt><dd>${esc(fecha(propuesta.fechaFin))}</dd></div><div><dt>Cupo</dt><dd>${numero(propuesta.cupo)}</dd></div><div><dt>Beneficios fijos</dt><dd>7 + 15 días VIP</dd></div></dl>`;
      modalError.textContent = '';
      dialog.showModal();
      root.querySelector<HTMLButtonElement>('[data-aexp-cancelar]')!.focus();
    } catch (e) {
      propuesta = null;
      error.textContent = mensaje(e);
    }
  };
  const onClick = (e: Event) => {
    const target = e.target instanceof Element ? e.target.closest<HTMLButtonElement>('button') : null;
    if (!target || ocupado) return;
    if (target.matches('[data-aexp-actualizar]')) void cargar(true);
    if (target.matches('[data-aexp-reintentar]')) void cargar();
    if (target.matches('[data-aexp-cancelar]')) { propuesta = null; dialog.close(); }
    if (target.matches('[data-aexp-guardar]')) void guardar();
  };
  const onCancel = (e: Event) => { if (ocupado) e.preventDefault(); else propuesta = null; };
  root.addEventListener('submit', onSubmit);
  root.addEventListener('click', onClick);
  dialog.addEventListener('cancel', onCancel);
  void cargar();
  return () => {
    terminado = true;
    controller.abort();
    root.removeEventListener('submit', onSubmit);
    root.removeEventListener('click', onClick);
    dialog.removeEventListener('cancel', onCancel);
    if (dialog.open) dialog.close();
    propuesta = null; actual = null; agregado = null;
  };
}
