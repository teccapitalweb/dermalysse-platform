import { api, mensajeError } from '../core/auth';
import { Datos } from '../core/datos';
import { esc } from '../ui/partials';
import { adminHead } from './shell';
import { AdminRemoto, cargarAdmin, invalidarAdmin, type CampanaAdmin } from './remoto';

const fecha = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const valorFecha = (iso: string) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const CAMPANA_DEMO: CampanaAdmin = {
  id: 'bienvenida-dermalysse-50', nombre: 'Bienvenida Dermalysse · Primera Edición', descripcion: 'Paquete digital de lanzamiento para las primeras 50 cuentas.', codigo: 'DEMO-BIENVENIDA-50', estado: 'activa',
  cupoTotal: 50, lugaresRestantes: 38, solicitudes: 12, emitidos: 12, activados: 12, pendientes: 0,
  inicio: '2026-10-28T06:00:00.000Z', fin: '2027-01-01T05:59:59.999Z', creadoEn: '2026-10-28T06:00:00.000Z', actualizadoEn: '2026-10-28T18:00:00.000Z',
  beneficios: { diamantes: 750, vipDias: 7, materiales: [{ id: 'p-1784228079707', nombre: 'Regulación cosmética' }, { id: 'p-1784228150217', nombre: 'Estudios de estabilidad cosmética' }], manuales: [] },
  grafica: [{ fecha: '2026-10-28', solicitudes: 7, emisiones: 7, activaciones: 7 }, { fecha: '2026-10-29', solicitudes: 5, emisiones: 5, activaciones: 5 }], entregasPendientes: [],
};

function beneficios(c: CampanaAdmin) {
  return `<div class="campaign-admin-benefits">
    ${c.beneficios.diamantes ? `<span><i data-lucide="gem" class="i"></i><strong>${c.beneficios.diamantes.toLocaleString('es-MX')}</strong><small>diamantes</small></span>` : ''}
    ${c.beneficios.vipDias ? `<span><i data-lucide="crown" class="i"></i><strong>${c.beneficios.vipDias}</strong><small>días VIP</small></span>` : ''}
    <span><i data-lucide="library" class="i"></i><strong>${c.beneficios.materiales.length}</strong><small>materiales</small></span>
  </div>`;
}

function grafica(c: CampanaAdmin) {
  const maximo = Math.max(1, ...c.grafica.flatMap((d) => [d.solicitudes, d.emisiones, d.activaciones]));
  return `<div class="campaign-chart" role="img" aria-label="Actividad diaria agregada de la campaña">
    ${c.grafica.length ? c.grafica.map((d) => `<div class="campaign-chart__day"><div class="campaign-chart__bars"><i style="height:${Math.max(4, d.solicitudes / maximo * 100)}%" title="${d.solicitudes} solicitudes"></i><i style="height:${Math.max(4, d.emisiones / maximo * 100)}%" title="${d.emisiones} emitidos"></i><i style="height:${Math.max(4, d.activaciones / maximo * 100)}%" title="${d.activaciones} activados"></i></div><small>${new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</small></div>`).join('') : '<p class="muted">La gráfica aparecerá cuando llegue el primer canje.</p>'}
  </div><div class="campaign-chart__legend"><span><i></i>Solicitudes</span><span><i></i>Emitidos</span><span><i></i>Activados</span></div>`;
}

function tarjeta(c: CampanaAdmin, demo: boolean) {
  const porcentaje = c.cupoTotal ? Math.min(100, Math.round(c.solicitudes / c.cupoTotal * 100)) : 0;
  return `<article class="campaign-admin-card" data-campaign-admin-card="${esc(c.id)}">
    <header class="campaign-admin-card__head">
      <div><span class="campaign-status is-${c.estado}"><i data-lucide="${c.estado === 'activa' ? 'radio' : c.estado === 'agotada' ? 'users-round' : c.estado === 'pausada' ? 'pause' : 'flag'}" class="i"></i>${esc(c.estado)}</span><h2>${esc(c.nombre)}</h2><p>${esc(c.descripcion)}</p></div>
      <div class="campaign-admin-code"><small>Código oficial</small><strong>${esc(c.codigo)}</strong><button type="button" data-copy-campaign="${esc(c.codigo)}" aria-label="Copiar código"><i data-lucide="copy" class="i"></i></button></div>
    </header>
    <div class="campaign-admin-progress"><div><span style="width:${porcentaje}%"></span></div><p><strong>${c.solicitudes} de ${c.cupoTotal}</strong> lugares utilizados <em>${c.lugaresRestantes} restantes</em></p></div>
    <div class="campaign-admin-kpis"><span><small>Solicitudes</small><strong>${c.solicitudes}</strong></span><span><small>Emitidos</small><strong>${c.emitidos}</strong></span><span><small>Activados</small><strong>${c.activados}</strong></span><span><small>Pendientes</small><strong>${c.pendientes}</strong></span></div>
    <div class="campaign-admin-grid">
      <section><div class="admin-card-title">Beneficio digital por cuenta</div>${beneficios(c)}<ul class="campaign-admin-materials">${c.beneficios.materiales.map((m) => `<li><i data-lucide="book-open-check" class="i"></i>${esc(m.nombre)} <span>permanente</span></li>`).join('')}</ul><p class="campaign-admin-note"><i data-lucide="shield-check" class="i"></i>Entrega interna automática. No depende de aliados ni beneficios físicos.</p></section>
      <section><div class="admin-card-title">Rendimiento diario</div>${grafica(c)}</section>
    </div>
    <footer class="campaign-admin-card__foot">
      <div><small>Vigencia</small><strong>${fecha(c.inicio)} — ${fecha(c.fin)}</strong><span>Actualizada ${fecha(c.actualizadoEn)}</span></div>
      <div class="row">
        <button type="button" class="btn btn--secondary btn--sm" data-toggle-campaign="${esc(c.id)}" data-next-state="${c.estado === 'pausada' ? 'activa' : 'pausada'}" ${demo || ['agotada', 'terminada'].includes(c.estado) ? 'disabled' : ''}><i data-lucide="${c.estado === 'pausada' ? 'play' : 'pause'}" class="i"></i>${c.estado === 'pausada' ? 'Reactivar' : 'Pausar'}</button>
        <button type="button" class="btn btn--ghost btn--sm" data-edit-campaign="${esc(c.id)}"><i data-lucide="sliders-horizontal" class="i"></i>Ajustar</button>
      </div>
    </footer>
    <form class="campaign-admin-edit" data-form-campaign-edit="${esc(c.id)}" hidden>
      <div class="field"><label>Cupo total</label><input class="input" type="number" name="cupoTotal" min="${c.solicitudes}" max="10000" value="${c.cupoTotal}" required></div>
      <div class="field"><label>Inicia</label><input class="input" type="datetime-local" name="inicio" value="${valorFecha(c.inicio)}" required></div>
      <div class="field"><label>Termina</label><input class="input" type="datetime-local" name="fin" value="${valorFecha(c.fin)}" required></div>
      <button class="btn btn--brand btn--sm" ${demo ? 'disabled' : ''}>Guardar ajustes</button>
    </form>
  </article>`;
}

function formularioNueva(demo: boolean) {
  const materiales = Datos.materiales().filter((m) => m.estado === 'disponible' && !!m.url);
  const inicio = valorFecha(new Date().toISOString());
  const fin = valorFecha(new Date(Date.now() + 30 * 86_400_000).toISOString());
  return `<details class="campaign-create card">
    <summary><span><i data-lucide="plus" class="i"></i></span><div><strong>Crear otra campaña digital</strong><small>Configura un código, cupo y beneficios internos verificables.</small></div><i data-lucide="chevron-down" class="i"></i></summary>
    <form data-form-campaign-create>
      <div class="form-grid"><div class="field"><label>Nombre</label><input class="input" name="nombre" maxlength="120" required placeholder="Ej. Semana de la comunidad"></div><div class="field"><label>Código</label><input class="input mono" name="codigo" maxlength="40" required placeholder="DERMALYSSE2026"></div></div>
      <div class="field"><label>Descripción</label><textarea class="input" name="descripcion" maxlength="500" rows="2" required></textarea></div>
      <div class="form-grid form-grid--3"><div class="field"><label>Cupo</label><input class="input" type="number" name="cupoTotal" min="1" max="10000" value="50" required></div><div class="field"><label>Inicia</label><input class="input" type="datetime-local" name="inicio" value="${inicio}" required></div><div class="field"><label>Termina</label><input class="input" type="datetime-local" name="fin" value="${fin}" required></div></div>
      <div class="form-grid"><div class="field"><label>Diamantes</label><input class="input" type="number" name="diamantes" min="0" max="10000" value="0"></div><div class="field"><label>Días VIP</label><input class="input" type="number" name="vipDias" min="0" max="30" value="0"></div></div>
      <fieldset class="campaign-material-picker"><legend>Materiales permanentes ya publicados</legend>${materiales.length ? materiales.map((m) => `<label><input type="checkbox" name="materialIds" value="${esc(m.id)}"><span><i data-lucide="book-open" class="i"></i>${esc(m.titulo)}</span></label>`).join('') : '<p class="muted">No hay materiales publicados disponibles.</p>'}</fieldset>
      <div class="admin-callout"><i data-lucide="shield-check" class="i"></i><div><strong>Solo beneficios que Dermalysse puede entregar</strong><p>No se crearán premios físicos, cupones externos ni contenido clínico sin aprobación humana.</p></div></div>
      <button class="btn btn--brand" type="submit" ${demo ? 'disabled' : ''}><i data-lucide="rocket" class="i"></i>Crear campaña</button>
    </form>
  </details>`;
}

export function adminCampanas() {
  const demo = Datos.modo === 'demo';
  const lista = demo ? [CAMPANA_DEMO] : AdminRemoto.campanas();
  const totales = lista.reduce((r, c) => ({ solicitudes: r.solicitudes + c.solicitudes, emitidos: r.emitidos + c.emitidos, activados: r.activados + c.activados, disponibles: r.disponibles + c.lugaresRestantes }), { solicitudes: 0, emitidos: 0, activados: 0, disponibles: 0 });
  return `${adminHead('Campañas y beneficios de bienvenida', 'Códigos con cupo real, entrega auditable y beneficios digitales que la plataforma puede cumplir.', '<button type="button" class="btn btn--secondary" data-export-campaigns><i data-lucide="download" class="i"></i>Exportar resumen</button><button type="button" class="btn btn--ghost btn--icon" data-refresh-campaigns aria-label="Actualizar"><i data-lucide="refresh-cw" class="i"></i></button>')}
    ${demo ? '<div class="admin-callout"><i data-lucide="flask-conical" class="i"></i><div><strong>Vista de demostración</strong><p>Los datos de esta pantalla son una muestra visual identificada y no se enviarán al servidor.</p></div></div>' : ''}
    <section class="campaign-admin-hero"><div><span class="eyebrow">Centro de campañas</span><h2>Cada promesa, medible.<br>Cada entrega, comprobable.</h2><p>Solicitudes, emisiones y activaciones se cuentan por separado. El cupo se reserva de forma atómica para evitar entregar más beneficios de los autorizados.</p></div><span class="campaign-admin-hero__gift"><i data-lucide="gift" class="i"></i><b>${lista.filter((c) => c.estado === 'activa').length}</b><small>activas</small></span></section>
    <div class="kpis campaign-overview"><div class="kpi"><span class="kpi__label">Solicitudes</span><strong class="kpi__val">${totales.solicitudes}</strong><span class="kpi__nota">códigos validados</span></div><div class="kpi"><span class="kpi__label">Beneficios emitidos</span><strong class="kpi__val">${totales.emitidos}</strong><span class="kpi__nota">entregas iniciadas</span></div><div class="kpi"><span class="kpi__label">Activaciones</span><strong class="kpi__val">${totales.activados}</strong><span class="kpi__nota">beneficio completo</span></div><div class="kpi"><span class="kpi__label">Lugares disponibles</span><strong class="kpi__val">${totales.disponibles}</strong><span class="kpi__nota">entre campañas vigentes</span></div></div>
    <div class="campaign-admin-list">${lista.length ? lista.map((c) => tarjeta(c, demo)).join('') : '<section class="card card--pad"><h2>No hay campañas</h2><p class="muted">Crea la primera campaña digital desde el formulario inferior.</p></section>'}</div>
    ${formularioNueva(demo)}`;
}

function descargarResumen(lista: CampanaAdmin[]) {
  const filas = [['campana', 'codigo', 'fecha', 'solicitudes', 'emitidos', 'activados']];
  for (const c of lista) {
    if (!c.grafica.length) filas.push([c.nombre, c.codigo, '', String(c.solicitudes), String(c.emitidos), String(c.activados)]);
    else c.grafica.forEach((d) => filas.push([c.nombre, c.codigo, d.fecha, String(d.solicitudes), String(d.emisiones), String(d.activaciones)]));
  }
  const csv = filas.map((fila) => fila.map((v) => `"${v.replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `campanas-dermalysse-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
}

export function montarAdminCampanas(toast: (mensaje: string, icono?: string) => void, rerender: () => void) {
  const root = document.querySelector<HTMLElement>('#outlet');
  if (!root || !root.querySelector('[data-refresh-campaigns]')) return;
  const refrescar = async () => {
    invalidarAdmin('campanas', 'materiales');
    await cargarAdmin('/admin/campanas', true);
    rerender();
  };
  root.querySelector<HTMLButtonElement>('[data-refresh-campaigns]')!.onclick = () => refrescar().catch((e) => toast(mensajeError(e), 'circle-alert'));
  root.querySelector<HTMLButtonElement>('[data-export-campaigns]')!.onclick = () => { descargarResumen(Datos.modo === 'demo' ? [CAMPANA_DEMO] : AdminRemoto.campanas()); toast('Resumen agregado exportado sin datos personales.', 'download'); };
  root.querySelectorAll<HTMLButtonElement>('[data-copy-campaign]').forEach((b) => { b.onclick = () => navigator.clipboard.writeText(b.dataset.copyCampaign || '').then(() => toast('Código copiado.', 'copy')).catch(() => toast('No se pudo copiar el código.', 'circle-alert')); });
  root.querySelectorAll<HTMLButtonElement>('[data-edit-campaign]').forEach((b) => { b.onclick = () => { const f = root.querySelector<HTMLFormElement>(`[data-form-campaign-edit="${CSS.escape(b.dataset.editCampaign || '')}"]`); if (f) f.hidden = !f.hidden; }; });
  root.querySelectorAll<HTMLButtonElement>('[data-toggle-campaign]').forEach((b) => { b.onclick = async () => { b.disabled = true; try { await api(`/admin/campanas/${encodeURIComponent(b.dataset.toggleCampaign || '')}`, { method: 'PATCH', json: { estado: b.dataset.nextState } }); await refrescar(); toast(b.dataset.nextState === 'activa' ? 'Campaña reactivada.' : 'Campaña pausada.', 'shield-check'); } catch (e) { b.disabled = false; toast(mensajeError(e), 'circle-alert'); } }; });
  root.querySelectorAll<HTMLFormElement>('[data-form-campaign-edit]').forEach((form) => { form.onsubmit = async (e) => { e.preventDefault(); const data = new FormData(form); const button = form.querySelector<HTMLButtonElement>('button')!; button.disabled = true; try { await api(`/admin/campanas/${encodeURIComponent(form.dataset.formCampaignEdit || '')}`, { method: 'PATCH', json: { cupoTotal: Number(data.get('cupoTotal')), inicio: new Date(String(data.get('inicio'))).toISOString(), fin: new Date(String(data.get('fin'))).toISOString() } }); await refrescar(); toast('Campaña actualizada.', 'shield-check'); } catch (err) { button.disabled = false; toast(mensajeError(err), 'circle-alert'); } }; });
  const crear = root.querySelector<HTMLFormElement>('[data-form-campaign-create]');
  if (crear) crear.onsubmit = async (e) => { e.preventDefault(); const data = new FormData(crear); const button = crear.querySelector<HTMLButtonElement>('button[type="submit"]')!; button.disabled = true; try { await api('/admin/campanas', { method: 'POST', json: { nombre: data.get('nombre'), codigo: data.get('codigo'), descripcion: data.get('descripcion'), cupoTotal: Number(data.get('cupoTotal')), inicio: new Date(String(data.get('inicio'))).toISOString(), fin: new Date(String(data.get('fin'))).toISOString(), diamantes: Number(data.get('diamantes') || 0), vipDias: Number(data.get('vipDias') || 0), materialIds: data.getAll('materialIds') } }); await refrescar(); toast('Campaña creada y lista para operar.', 'gift'); } catch (err) { button.disabled = false; toast(mensajeError(err), 'circle-alert'); } };
}
