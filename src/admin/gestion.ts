// Admin · resumen, miembros, comunidad, avisos y ajustes.
import { Datos, type MiembroDemo } from '../core/datos';
import { Comunidad, hace } from '../core/comunidad';
import { Progreso } from '../core/progreso';
import { esc, iniciales } from '../ui/partials';
import { adminHead } from './shell';
import { vacio, callout } from './contenido';
import { AdminRemoto } from './remoto';

const DIA = 864e5;
export function estadoMiembro(m: MiembroDemo, ahora = Date.now()) {
  if (m.cortesiaHasta && new Date(m.cortesiaHasta).getTime() > ahora) return { vip: true, etiqueta: 'Cortesía', chip: 'chip--primary' };
  if (m.plan === 'cupon' && m.cuponHasta && new Date(m.cuponHasta).getTime() > ahora) return { vip: true, etiqueta: 'Cupón VIP', chip: 'chip--primary' };
  if ((m.plan === 'mensual' || m.plan === 'anual') && m.vence && new Date(m.vence).getTime() > ahora) return { vip: true, etiqueta: m.plan === 'anual' ? 'VIP anual' : 'VIP mensual', chip: 'chip--accent' };
  if (m.esAdmin) return { vip: true, etiqueta: 'Administrador', chip: 'chip--primary' };
  if (m.esVip) return { vip: true, etiqueta: 'VIP', chip: 'chip--accent' };
  return { vip: false, etiqueta: 'Sin membresía', chip: '' };
}
const fecha = (iso?: string | null) => iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ═══ RESUMEN ═══
export function adminResumen() {
  if (Datos.modo === 'api') {
    const r = AdminRemoto.resumen();
    if (!r) return vacio('No se pudo cargar el resumen', 'Comprueba la conexión con el backend y vuelve a intentarlo.');
    const max = Math.max(1, ...r.cursosTop.map((c) => c.vistas));
    const kpi = (icon: string, label: string, valor: string, nota: string) => `<div class="kpi"><span class="kpi__ic"><i data-lucide="${icon}" class="i"></i></span><span class="kpi__label">${label}</span><strong class="kpi__val">${valor}</strong><span class="kpi__nota">${nota}</span></div>`;
    return `
    ${adminHead('Resumen', 'Información real de Firebase y actividad del club')}
    <div class="kpis">
      ${kpi('users', 'Miembros con acceso', String(r.miembrosActivos), 'membresía, Stripe, cortesía o cupón')}
      ${kpi('user-plus', 'Altas en 30 días', String(r.altas30d), `${r.bajas30d} bajas registradas`)}
      ${kpi('play-circle', 'Clases vistas en 30 días', String(r.clasesVistas30d), 'actividad verificable')}
      ${kpi('award', 'Certificados en 30 días', String(r.certificados30d), `${r.temasForo30d} temas en comunidad`)}
    </div>
    <div class="card card--pad stack" style="gap:14px">
      <h3 class="admin-card-title">Cursos más vistos en los últimos 30 días</h3>
      ${r.cursosTop.length ? r.cursosTop.map((t) => `<div class="hbar"><span class="hbar__lbl">${esc(t.titulo)}</span><div class="progress"><span style="width:${(t.vistas / max) * 100}%"></span></div><span class="mono faint">${t.vistas}</span></div>`).join('') : '<p class="muted">Todavía no hay actividad reciente.</p>'}
    </div>`;
  }
  const cfg = Datos.config();
  const ms = Datos.miembros();
  const ahora = Date.now();
  const activos = ms.filter((m) => estadoMiembro(m).vip);
  const mensual = activos.filter((m) => m.plan === 'mensual' && !m.cortesiaHasta).length;
  const anual = activos.filter((m) => m.plan === 'anual').length;
  const mrr = mensual * cfg.precioMensual + Math.round((anual * cfg.precioAnual) / 12);
  const altas30 = ms.filter((m) => ahora - new Date(m.alta).getTime() < 30 * DIA).length;
  const porVencer = ms.filter((m) => m.vence && new Date(m.vence).getTime() > ahora && new Date(m.vence).getTime() - ahora < 7 * DIA);
  const inactivos = activos.filter((m) => ahora - new Date(m.ultimaActividad).getTime() > 14 * DIA);
  const cursos = Datos.cursos();
  const genericos = cursos.reduce((a, c) => a + c.clases.filter((k) => /^Clase \d+$/.test(k.titulo)).length, 0);
  const qz = Datos.quizzes();
  const meses = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return d; });
  const altasMes = meses.map((d) => ms.filter((m) => { const a = new Date(m.alta); return a.getMonth() === d.getMonth() && a.getFullYear() === d.getFullYear(); }).length);
  const maxAlta = Math.max(1, ...altasMes);
  const topCursos = cursos.map((c) => ({ c, v: Progreso.de(c.id).vistas.length })).sort((a, b) => b.v - a.v).slice(0, 5);
  const maxV = Math.max(1, ...topCursos.map((t) => t.v));
  const kpi = (icon: string, label: string, valor: string, nota: string) => `<div class="kpi"><span class="kpi__ic"><i data-lucide="${icon}" class="i"></i></span><span class="kpi__label">${label}</span><strong class="kpi__val">${valor}</strong><span class="kpi__nota">${nota}</span></div>`;
  return `
  ${adminHead('Resumen', new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}
  ${Datos.modo === 'demo' ? callout('Datos de demostración', 'Los miembros de esta pantalla son ficticios. Con el backend conectado, estos números salen de Firebase y Stripe en tiempo real.') : ''}
  <div class="kpis">
    ${kpi('users', 'Miembros activos', String(activos.length), `${mensual} mensual · ${anual} anual · ${activos.length - mensual - anual} cortesía`)}
    ${kpi('trending-up', 'Ingreso mensual estimado', `$${mrr.toLocaleString('es-MX')}`, 'MXN · anual prorrateado')}
    ${kpi('user-plus', 'Altas en 30 días', String(altas30), `${porVencer.length} vencen esta semana`)}
    ${kpi('alert-triangle', 'Sin actividad 14+ días', String(inactivos.length), 'miembros activos en riesgo de baja')}
  </div>
  <div class="admin-grid admin-grid--even">
    <div class="card card--pad stack" style="gap:14px">
      <h3 class="admin-card-title">Altas por mes</h3>
      <div class="bars">${meses.map((d, i) => `<div class="bars__col"><span class="bars__val mono">${altasMes[i]}</span><div class="bars__bar" style="height:${(altasMes[i] / maxAlta) * 100}%"></div><span class="bars__lbl">${d.toLocaleDateString('es-MX', { month: 'short' })}</span></div>`).join('')}</div>
    </div>
    <div class="card card--pad stack" style="gap:12px">
      <h3 class="admin-card-title">Cursos más vistos</h3>
      ${topCursos.some((t) => t.v) ? topCursos.map((t) => `<div class="hbar"><span class="hbar__lbl">${esc(t.c.titulo)}</span><div class="progress"><span style="width:${(t.v / maxV) * 100}%"></span></div><span class="mono faint">${t.v}</span></div>`).join('')
        : '<p class="muted" style="font-size:var(--fs-sm)">Aún no hay clases vistas registradas en este navegador.</p>'}
    </div>
  </div>
  <div class="admin-grid admin-grid--even">
    <div class="card card--pad stack" style="gap:10px">
      <h3 class="admin-card-title">Pendientes de contenido</h3>
      <a class="todo" href="#/admin/cursos"><i data-lucide="type" class="i"></i><span><strong>${genericos} clases</strong> con título genérico "Clase N"</span><i data-lucide="chevron-right" class="i"></i></a>
      <a class="todo" href="#/admin/quizzes"><i data-lucide="brain" class="i"></i><span><strong>${qz.filter((q) => q.estado === 'borrador').length} quizzes</strong> esperando revisión</span><i data-lucide="chevron-right" class="i"></i></a>
      <a class="todo" href="#/admin/materiales"><i data-lucide="library" class="i"></i><span><strong>${Datos.materiales().filter((m) => m.estado !== 'disponible').length} materiales</strong> sin publicar</span><i data-lucide="chevron-right" class="i"></i></a>
      <a class="todo" href="#/admin/en-vivo"><i data-lucide="radio" class="i"></i><span><strong>${Datos.eventos().filter((e) => new Date(e.fecha).getTime() > ahora).length} clases en vivo</strong> programadas</span><i data-lucide="chevron-right" class="i"></i></a>
    </div>
    <div class="card card--pad stack" style="gap:10px">
      <h3 class="admin-card-title">Vencen en 7 días</h3>
      ${porVencer.length ? porVencer.map((m) => `<a class="todo" href="#/admin/miembros/${m.uid}"><div class="avatar" style="width:30px;height:30px;font-size:11px">${iniciales(m.nombre)}</div><span><strong>${esc(m.nombre)}</strong><br><span class="faint">${m.plan} · vence ${fecha(m.vence)}</span></span><i data-lucide="chevron-right" class="i"></i></a>`).join('')
        : '<p class="muted" style="font-size:var(--fs-sm)">Nadie vence esta semana.</p>'}
    </div>
  </div>`;
}

// ═══ MIEMBROS ═══
export function adminMiembros(_: Record<string, string>, query: URLSearchParams) {
  const q = (query.get('q') || '').toLowerCase();
  const f = query.get('estado') || '';
  let l = Datos.miembros();
  if (q) l = l.filter((m) => (m.nombre + m.email).toLowerCase().includes(q));
  if (f === 'vip') l = l.filter((m) => estadoMiembro(m).vip && !m.cortesiaHasta);
  if (f === 'cortesia') l = l.filter((m) => m.cortesiaHasta && new Date(m.cortesiaHasta).getTime() > Date.now());
  if (f === 'sin') l = l.filter((m) => !estadoMiembro(m).vip);
  const chip = (k: string, t: string) => `<a class="chip ${f === k ? 'chip--primary' : 'chip--outline'}" href="#/admin/miembros?${new URLSearchParams({ q, estado: k })}">${t}</a>`;
  return `
  ${adminHead('Miembros', `${Datos.miembros().length} cuentas · ${Datos.miembros().filter((m) => estadoMiembro(m).vip).length} con acceso`, '<a class="btn btn--secondary" href="#/admin/cupones"><i data-lucide="ticket-percent" class="i"></i>Cupones</a>')}
  <div class="row" style="justify-content:space-between">
    <form class="search" style="flex:1;max-width:420px" data-form="buscar-miembro"><i data-lucide="search" class="i"></i><input class="input" name="q" value="${esc(q)}" placeholder="Buscar por nombre o correo"></form>
    <div class="row" style="gap:6px">${chip('', 'Todos')}${chip('vip', 'VIP')}${chip('cortesia', 'Cortesía')}${chip('sin', 'Sin membresía')}</div>
  </div>
  ${l.length ? `<div class="card dtable-wrap"><table class="dtable"><thead><tr><th>Miembro</th><th>Estado</th><th>Vence</th><th>Clases vistas</th><th>Última actividad</th><th></th></tr></thead><tbody>
    ${l.map((m) => { const e = estadoMiembro(m); return `<tr>
      <td><a class="dtable__main" href="#/admin/miembros/${m.uid}"><span class="avatar" style="width:34px;height:34px;font-size:12px">${iniciales(m.nombre)}</span><span><strong>${esc(m.nombre)}</strong><br><span class="faint">${esc(m.email)}</span></span></a></td>
      <td><span class="chip ${e.chip}">${e.etiqueta}</span></td><td>${fecha(m.cortesiaHasta || m.vence)}</td><td class="mono">${m.clasesVistas}</td><td>${hace(m.ultimaActividad)}</td>
      <td><a class="btn btn--ghost btn--icon btn--xs" href="#/admin/miembros/${m.uid}"><i data-lucide="chevron-right" class="i"></i></a></td></tr>`; }).join('')}
  </tbody></table></div>` : vacio('Sin resultados', 'Prueba con otro nombre o filtro.')}`;
}

export function adminMiembro(params: Record<string, string>) {
  if (Datos.modo === 'api') {
    const d = AdminRemoto.detalleMiembro(params.uid);
    if (!d) return vacio('Miembro no encontrado', 'No se pudo cargar esta cuenta.', '<a class="btn btn--brand" href="#/admin/miembros">Volver</a>');
    const cortesiaVigente = !!(d.cortesiaHasta && new Date(d.cortesiaHasta).getTime() > Date.now());
    const etiqueta = d.esAdmin ? 'Administrador' : cortesiaVigente ? 'Cortesía' : d.plan === 'cupon' ? 'Cupón VIP' : d.esVip ? 'VIP activo' : 'Sin membresía';
    const chipEstado = d.esVip ? 'chip--accent' : '';
    const plan = d.esAdmin ? 'Administrador' : d.plan === 'anual' ? 'Anual' : d.plan === 'mensual' ? 'Mensual' : d.plan === 'cortesia' ? 'Cortesía' : d.plan === 'cupon' ? 'Cupón' : 'Sin plan';
    const progreso = d.progreso || [];
    const certificados = d.certificados || [];
    return `
    <a class="section-head__cta" href="#/admin/miembros" style="align-self:flex-start"><span class="circle-btn circle-btn--glass" style="width:34px;height:34px"><i data-lucide="arrow-left" class="i" style="width:15px;height:15px"></i></span>Miembros</a>
    <div class="card card--pad row" style="gap:18px;align-items:center">
      <div class="avatar avatar--lg">${iniciales(d.nombre)}</div>
      <div style="flex:1"><h1 class="display" style="font-size:var(--fs-xl)">${esc(d.nombre)}</h1><p class="muted">${esc(d.email || 'Correo no disponible')}</p></div>
      <span class="chip ${chipEstado}" style="height:32px;font-size:var(--fs-sm)">${etiqueta}</span>
    </div>
    <div class="kpis">
      <div class="kpi"><span class="kpi__label">Plan</span><strong class="kpi__val" style="font-size:var(--fs-lg)">${plan}</strong><span class="kpi__nota">vence ${fecha(d.vence)}</span></div>
      <div class="kpi"><span class="kpi__label">Clases vistas</span><strong class="kpi__val">${progreso.reduce((n, p) => n + p.vistas.length, 0)}</strong><span class="kpi__nota">en ${progreso.length} cursos</span></div>
      <div class="kpi"><span class="kpi__label">Certificados</span><strong class="kpi__val">${certificados.length}</strong><span class="kpi__nota">emitidos por el sistema</span></div>
    </div>
    ${d.accesoCupon ? `<div class="card card--pad"><strong>Acceso por cupón</strong><p class="muted" style="font-size:var(--fs-sm)">Último código: <code>${esc(d.accesoCupon.ultimoCodigo || '—')}</code> · vigencia hasta ${fecha(d.cuponHasta || d.accesoCupon.hasta)}</p></div>` : ''}
    <div class="admin-grid admin-grid--even">
      <form class="card card--pad stack" style="gap:12px" data-form="cortesia" data-uid="${d.uid}">
        <h3 class="admin-card-title">Acceso de cortesía</h3>
        ${cortesiaVigente ? `<p style="font-size:var(--fs-sm)">Vigente hasta <strong>${fecha(d.cortesiaHasta)}</strong>${d.cortesia?.motivo ? ` · ${esc(d.cortesia.motivo)}` : ''}</p>` : '<p class="muted" style="font-size:var(--fs-sm)">Da acceso VIP sin cobro por un periodo.</p>'}
        <div class="form-grid"><div class="field"><label>Días</label><div class="row" style="gap:6px">${[7, 15, 30, 90].map((n) => `<button type="button" class="chip chip--outline" data-dias="${n}">${n}</button>`).join('')}</div><input class="input" type="number" min="1" max="3650" name="dias" value="30" required></div>
        <div class="field"><label>Motivo</label><input class="input" name="motivo" required placeholder="Ponente, alianza, compensación…"></div></div>
        <div class="row"><button class="btn btn--brand"><i data-lucide="gift" class="i"></i>${cortesiaVigente ? 'Extender cortesía' : 'Dar cortesía'}</button>${cortesiaVigente ? `<button type="button" class="btn btn--danger" data-revocar-cortesia="${d.uid}">Revocar</button>` : ''}</div>
      </form>
      <div class="card card--pad stack" style="gap:10px">
        <h3 class="admin-card-title">Suscripción</h3>
        ${d.suscripcion ? `<div class="row" style="justify-content:space-between"><span>Estado</span><strong>${esc(d.suscripcion.estado || '—')}</strong></div><div class="row" style="justify-content:space-between"><span>Plan</span><strong>${esc(d.suscripcion.plan || '—')}</strong></div><div class="row" style="justify-content:space-between"><span>Fin del periodo</span><strong>${fecha(d.suscripcion.periodoFin)}</strong></div>` : d.miembro ? `<p class="muted" style="font-size:var(--fs-sm)">Membresía heredada del sistema anterior · plan ${esc(d.miembro.plan || 'sin especificar')}.</p>` : '<p class="muted" style="font-size:var(--fs-sm)">No existe una suscripción de pago asociada.</p>'}
        <p class="faint" style="font-size:var(--fs-xs)">Los cobros, cancelaciones y reembolsos se administran directamente en Stripe.</p>
      </div>
    </div>
    <div class="card card--pad stack" style="gap:10px"><h3 class="admin-card-title">Progreso por curso</h3>
      ${progreso.length ? progreso.map((p) => `<div class="row" style="justify-content:space-between"><span><strong>${esc(p.titulo)}</strong><br><span class="faint">${p.vistas.length} de ${p.total} clases</span></span><span class="chip ${p.certificado ? 'chip--accent' : ''}">${p.certificado ? 'Certificado' : `${p.total ? Math.round(p.vistas.length / p.total * 100) : 0}%`}</span></div>`).join('') : '<p class="muted">Aún no ha iniciado cursos.</p>'}
    </div>`;
  }
  const m = Datos.miembros().find((x) => x.uid === params.uid);
  if (!m) return vacio('Miembro no encontrado', '', '<a class="btn btn--brand" href="#/admin/miembros">Volver</a>');
  const e = estadoMiembro(m);
  const cortesiaVigente = m.cortesiaHasta && new Date(m.cortesiaHasta).getTime() > Date.now();
  return `
  <a class="section-head__cta" href="#/admin/miembros" style="align-self:flex-start"><span class="circle-btn circle-btn--glass" style="width:34px;height:34px"><i data-lucide="arrow-left" class="i" style="width:15px;height:15px"></i></span>Miembros</a>
  <div class="card card--pad row" style="gap:18px;align-items:center">
    <div class="avatar avatar--lg">${iniciales(m.nombre)}</div>
    <div style="flex:1"><h1 class="display" style="font-size:var(--fs-xl)">${esc(m.nombre)}</h1><p class="muted">${esc(m.email)} · alta ${fecha(m.alta)}</p></div>
    <span class="chip ${e.chip}" style="height:32px;font-size:var(--fs-sm)">${e.etiqueta}</span>
  </div>
  <div class="kpis">
    <div class="kpi"><span class="kpi__label">Plan</span><strong class="kpi__val" style="font-size:var(--fs-lg)">${({ mensual: 'Mensual', anual: 'Anual', cortesia: 'Cortesía', cupon: 'Cupón', ninguno: 'Sin plan' } as Record<string, string>)[m.plan]}</strong><span class="kpi__nota">vence ${fecha(m.vence)}</span></div>
    <div class="kpi"><span class="kpi__label">Clases vistas</span><strong class="kpi__val">${m.clasesVistas}</strong><span class="kpi__nota">de ${Datos.cursos().reduce((a, c) => a + c.clases.length, 0)}</span></div>
    <div class="kpi"><span class="kpi__label">Última actividad</span><strong class="kpi__val" style="font-size:var(--fs-lg)">${hace(m.ultimaActividad)}</strong><span class="kpi__nota">${fecha(m.ultimaActividad)}</span></div>
  </div>
  <div class="admin-grid admin-grid--even">
    <form class="card card--pad stack" style="gap:12px" data-form="cortesia" data-uid="${m.uid}">
      <h3 class="admin-card-title">Acceso de cortesía</h3>
      ${cortesiaVigente ? `<p style="font-size:var(--fs-sm)">Vigente hasta <strong>${fecha(m.cortesiaHasta)}</strong>${m.cortesiaMotivo ? ` · ${esc(m.cortesiaMotivo)}` : ''}</p>` : '<p class="muted" style="font-size:var(--fs-sm)">Da acceso VIP sin cobro por un periodo: ponentes, alianzas, compensaciones.</p>'}
      <div class="form-grid"><div class="field"><label>Días</label><div class="row" style="gap:6px">${[7, 15, 30, 90].map((d) => `<button type="button" class="chip chip--outline" data-dias="${d}">${d}</button>`).join('')}</div><input class="input" type="number" min="1" max="730" name="dias" value="30" required></div>
      <div class="field"><label>Motivo (queda registrado)</label><input class="input" name="motivo" required placeholder="Ponente invitada, compensación…"></div></div>
      <div class="row"><button class="btn btn--brand"><i data-lucide="gift" class="i"></i>${cortesiaVigente ? 'Extender cortesía' : 'Dar cortesía'}</button>${cortesiaVigente ? `<button type="button" class="btn btn--danger" data-revocar-cortesia="${m.uid}">Revocar</button>` : ''}</div>
    </form>
    <div class="card card--pad stack" style="gap:10px">
      <h3 class="admin-card-title">Suscripción en Stripe</h3>
      <p class="muted" style="font-size:var(--fs-sm)">Cancelar, reembolsar o cambiar de plan se hace desde Stripe para que los cobros y la membresía nunca se desincronicen. Con el backend conectado, aquí aparece el historial de pagos y el enlace directo al cliente en Stripe.</p>
      <div class="row"><button class="btn btn--secondary" disabled><i data-lucide="credit-card" class="i"></i>Ver en Stripe</button><button class="btn btn--secondary" disabled><i data-lucide="x-circle" class="i"></i>Cancelar al final del periodo</button></div>
    </div>
  </div>`;
}

// ═══ COMUNIDAD ═══
export function adminComunidad() {
  const l = Datos.modo === 'api' ? AdminRemoto.foro().map((h) => ({ ...h, respuestasTotal: Array.isArray(h.respuestas) ? h.respuestas.length : Number(h.respuestas) || 0, util: Number(h.util) || 0 })) : Comunidad.todos();
  return `
  ${adminHead('Comunidad', `${l.length} temas · ${l.filter((h) => h.oculto).length} ocultos`)}
  ${l.length ? `<div class="stack" style="gap:10px">${l.map((h) => `
    <div class="card card--pad" style="display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:start;${h.oculto ? 'opacity:.6' : ''}">
      <div class="avatar">${iniciales(h.autor)}</div>
      <div><div class="row" style="gap:8px"><strong style="font-size:var(--fs-sm)">${esc(h.autor)}</strong><span class="faint" style="font-size:var(--fs-xs)">${hace(h.fecha)} · ${h.respuestasTotal} respuestas · ${h.util} útil</span>${h.oculto ? '<span class="chip">Oculto</span>' : ''}</div>
        <a href="#/comunidad/${h.id}" target="_blank" style="font-family:var(--font-display);font-weight:700;color:var(--text)">${esc(h.titulo)}</a>
        <p class="muted" style="font-size:var(--fs-sm)">${esc(h.texto.slice(0, 220))}${h.texto.length > 220 ? '…' : ''}</p></div>
      <button class="btn btn--sm ${h.oculto ? 'btn--secondary' : 'btn--danger'}" data-ocultar-hilo="${h.id}">${h.oculto ? 'Mostrar' : 'Ocultar'}</button>
    </div>`).join('')}</div>` : vacio('Sin temas', 'Cuando los miembros abran temas aparecerán aquí para moderarlos.')}`;
}

// ═══ AVISOS ═══
export function adminAvisos() {
  const l = Datos.avisos();
  return `
  ${adminHead('Avisos', 'Mensajes que aparecen en la campana de notificaciones de todos los miembros.')}
  <form class="card card--pad stack" style="gap:12px;max-width:820px" data-form="aviso">
    <div class="field"><label>Título</label><input class="input" name="titulo" required maxlength="80" placeholder="Título del curso Dermalysse"></div>
    <div class="field"><label>Mensaje</label><textarea class="input" name="texto" rows="3" required maxlength="400" placeholder="Ya está disponible completo en tu catálogo…"></textarea></div>
    <div class="field"><label>Enlace (opcional)</label><input class="input" name="enlace" placeholder="#/cursos o https://…"></div>
    <div class="row" style="justify-content:flex-end"><button class="btn btn--brand btn--pill-arrow">Publicar aviso <span class="arrow"><i data-lucide="send" class="i"></i></span></button></div>
  </form>
  <div class="stack" style="gap:10px;max-width:820px">${l.map((a) => `
    <div class="card card--pad row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap">
      <div><strong>${esc(a.titulo)}</strong><p class="muted" style="font-size:var(--fs-sm)">${esc(a.texto)}</p><span class="faint" style="font-size:var(--fs-xs)">${hace(a.fecha)}${a.enlace ? ` · ${esc(a.enlace)}` : ''}</span></div>
      <button class="btn btn--ghost btn--icon btn--xs" data-borrar-aviso="${a.id}" aria-label="Borrar"><i data-lucide="trash-2" class="i"></i></button>
    </div>`).join('') || vacio('Sin avisos publicados', 'El primero aparecerá en la campana de todos los miembros.')}</div>`;
}

// ═══ AJUSTES ═══
export function adminAjustes() {
  const c = Datos.config();
  return `
  ${adminHead('Ajustes', 'Precios, contacto y administración del club.')}
  <form class="card card--pad stack" style="gap:14px;max-width:820px" data-form="config">
    <h3 class="admin-card-title">Membresía</h3>
    <div class="form-grid form-grid--3">
      <div class="field"><label>Precio mensual (MXN)</label><input class="input" type="number" min="0" name="precioMensual" value="${c.precioMensual}"></div>
      <div class="field"><label>Precio anual (MXN)</label><input class="input" type="number" min="0" name="precioAnual" value="${c.precioAnual}"></div>
      <div class="field"><label>Descuento VIP en vivo (%)</label><input class="input" type="number" min="0" max="100" name="descuentoVIP" value="${c.descuentoVIP}"></div>
    </div>
    <p class="faint" style="font-size:var(--fs-xs)">Los precios que se cobran los define Stripe. Cambiarlos aquí actualiza lo que se muestra; con el backend conectado se valida que coincidan con los precios de Stripe.</p>
    <h3 class="admin-card-title" style="margin-top:8px">Contacto</h3>
    <div class="form-grid">
      <div class="field"><label>WhatsApp de soporte (con lada, solo números)</label><input class="input mono" name="whatsappSoporte" value="${esc(c.whatsappSoporte)}" pattern="[0-9]{10,15}"></div>
      <div class="field"><label>Canal o grupo de WhatsApp</label><input class="input" type="url" name="canalWhatsApp" value="${esc(c.canalWhatsApp)}"></div>
    </div>
    <div class="row" style="justify-content:flex-end"><button class="btn btn--brand btn--pill-arrow">Guardar ajustes <span class="arrow"><i data-lucide="check" class="i"></i></span></button></div>
  </form>
  <div class="card card--pad stack" style="gap:10px;max-width:820px">
    <h3 class="admin-card-title">Quién puede entrar al admin</h3>
    <p style="font-size:var(--fs-sm)">Solo cuentas autorizadas por Dermalysse con permiso de administrador en Firebase. El permiso no es una lista de correos en el código: se asigna desde el backend y se verifica en la app, en el servidor y en las reglas de la base de datos.</p>
    <pre class="code">cd api
node scripts/set-admin.mjs correo@dermalysse.mx</pre>
    <p class="faint" style="font-size:var(--fs-xs)">La persona debe cerrar sesión y volver a entrar para que el permiso aplique.</p>
  </div>
  <div class="card card--pad row" style="justify-content:space-between;max-width:820px">
    <div><strong>Modo de datos: ${Datos.modo === 'demo' ? 'demo' : 'conectado'}</strong><p class="faint" style="font-size:var(--fs-xs)">${Datos.modo === 'demo' ? 'Todo se guarda en este navegador. Restablecer borra tus cambios y vuelve a los datos iniciales.' : 'Conectado al backend.'}</p></div>
    ${Datos.modo === 'demo' ? '<button class="btn btn--danger" data-restablecer-demo><i data-lucide="rotate-ccw" class="i"></i>Restablecer demo</button>' : ''}
  </div>`;
}
