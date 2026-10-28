import { Datos } from '../core/datos';
import { esc, iniciales } from '../ui/partials';
import { adminHead } from './shell';
import { vacio } from './contenido';
import { AdminRemoto, type CuentaPuntosAdmin, type DetallePuntosAdmin, type MovimientoPuntosAdmin, type ResumenPuntosAdmin } from './remoto';

const numero = (n: number) => new Intl.NumberFormat('es-MX').format(n);
const fecha = (iso?: string | null) => iso
  ? new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'Sin actividad';
const diamantes = (n: number) => `${n > 0 ? '+' : ''}${numero(n)}`;

const CUENTAS_DEMO: CuentaPuntosAdmin[] = [
  { uid: 'demo-jorge', nombre: 'Jorge', email: 'jorge@ejemplo.mx', saldo: 1240, experiencia: 1820, ganados: 2140, gastados: 900, canjes: 3, bienvenidaAcreditada: true, nivel: { id: 'circulo', nombre: 'Círculo Dermalysse', desde: 1800, siguiente: 3500 }, actualizado: '2026-10-26T16:20:00.000Z' },
  { uid: 'demo-mariana', nombre: 'Mariana Torres', email: 'mariana@ejemplo.mx', saldo: 680, experiencia: 940, ganados: 1030, gastados: 350, canjes: 1, bienvenidaAcreditada: true, nivel: { id: 'criterio', nombre: 'Criterio', desde: 900, siguiente: 1800 }, actualizado: '2026-10-25T20:05:00.000Z' },
  { uid: 'demo-ana', nombre: 'Ana López', email: 'ana@ejemplo.mx', saldo: 350, experiencia: 0, ganados: 350, gastados: 0, canjes: 0, bienvenidaAcreditada: true, nivel: { id: 'descubrimiento', nombre: 'Descubrimiento', desde: 0, siguiente: 300 }, actualizado: '2026-10-24T15:30:00.000Z' },
];
const MOVIMIENTOS_DEMO: MovimientoPuntosAdmin[] = [
  { id: 'demo-m1', uid: 'demo-jorge', tipo: 'ganado', puntos: 125, concepto: 'Bono de hito · Ruta completa', detalle: 'Premio vitalicio acreditado automáticamente', fecha: '2026-10-26T16:20:00.000Z' },
  { id: 'demo-m2', uid: 'demo-mariana', tipo: 'canje', puntos: -350, concepto: 'Pase VIP de 24 horas', detalle: '1 día VIP', fecha: '2026-10-25T20:05:00.000Z' },
  { id: 'demo-m3', uid: 'demo-ana', tipo: 'ganado', puntos: 350, concepto: 'Cofre de bienvenida', detalle: 'Saldo inicial para elegir un beneficio real', fecha: '2026-10-24T15:30:00.000Z' },
];
const RESUMEN_DEMO: ResumenPuntosAdmin = {
  moneda: { nombre: 'Diamantes Dermalysse', icono: 'gem' }, cuentas: 3, saldoCirculante: 2270, diamantesGanados: 3520, diamantesGastados: 1250,
  canjes: 4, materialesPermanentes: 3, diasVipEntregados: 4, cofresBienvenida: 3,
  catalogo: { total: 21, materiales: 9, colecciones: 4, pasesVip: 8 }, movimientosRecientes: MOVIMIENTOS_DEMO, canjesRecientes: [],
};
const DETALLE_DEMO: DetallePuntosAdmin = {
  cuenta: CUENTAS_DEMO[0], movimientos: MOVIMIENTOS_DEMO.filter((m) => m.uid === 'demo-jorge'), materialesPermanentes: 2,
  canjes: [
    { id: 'demo-c1', beneficioId: 'vip-3-dias', nombre: '3 días VIP', categoria: 'vip', costo: 900, fecha: '2026-10-18T16:20:00.000Z', diasVip: 3, origen: 'puntos' },
    { id: 'demo-c2', beneficioId: 'material-regulacion-cosmetica', nombre: 'Guía de regulación cosmética', categoria: 'material', costo: 0, fecha: '2026-10-10T16:20:00.000Z', diasVip: null, origen: 'nivel' },
  ],
};

function identidad(cuenta: CuentaPuntosAdmin) {
  return `<span class="avatar" style="width:36px;height:36px;font-size:12px">${iniciales(cuenta.nombre)}</span><span><strong>${esc(cuenta.nombre)}</strong><br><span class="faint">${esc(cuenta.email || cuenta.uid)}</span></span>`;
}

function movimientoFila(m: MovimientoPuntosAdmin) {
  return `<div class="reward-admin-event">
    <span class="reward-admin-event__icon ${m.puntos < 0 ? 'is-debit' : ''}"><i data-lucide="${m.puntos < 0 ? 'arrow-down-right' : 'gem'}" class="i"></i></span>
    <span><strong>${esc(m.concepto)}</strong><small>${esc(m.detalle)} · ${fecha(m.fecha)}</small></span>
    <b class="mono ${m.puntos < 0 ? 'is-debit' : ''}">${diamantes(m.puntos)}</b>
  </div>`;
}

function detalleCuenta(uid: string, demo?: DetallePuntosAdmin) {
  const detalle = demo ?? AdminRemoto.detallePuntos(uid);
  if (!detalle) return vacio('Cuenta no encontrada', 'No se pudo cargar el monedero de esta cuenta.', '<a class="btn btn--brand" href="#/admin/recompensas">Volver</a>');
  const c = detalle.cuenta;
  const soloMuestra = Datos.modo === 'demo';
  return `
  <a class="section-head__cta" href="#/admin/recompensas" style="align-self:flex-start"><span class="circle-btn circle-btn--glass" style="width:34px;height:34px"><i data-lucide="arrow-left" class="i" style="width:15px;height:15px"></i></span>Diamantes</a>
  <section class="reward-admin-account card card--pad">
    <div class="reward-admin-account__identity"><span class="avatar avatar--lg">${iniciales(c.nombre)}</span><div><span class="eyebrow">Monedero verificado</span><h1 class="display">${esc(c.nombre)}</h1><p>${esc(c.email || c.uid)}</p></div></div>
    <div class="reward-admin-balance"><span class="reward-admin-gem"><i data-lucide="gem" class="i"></i></span><div><small>Saldo disponible</small><strong>${numero(c.saldo)}</strong><span>Diamantes Dermalysse</span></div></div>
  </section>
  <div class="kpis reward-admin-kpis">
    <div class="kpi"><span class="kpi__label">Experiencia</span><strong class="kpi__val">${numero(c.experiencia)}</strong><span class="kpi__nota">Nivel ${esc(c.nivel.nombre)}</span></div>
    <div class="kpi"><span class="kpi__label">Ganados</span><strong class="kpi__val">${numero(c.ganados)}</strong><span class="kpi__nota">histórico acreditado</span></div>
    <div class="kpi"><span class="kpi__label">Gastados</span><strong class="kpi__val">${numero(c.gastados)}</strong><span class="kpi__nota">${c.canjes} canjes registrados</span></div>
    <div class="kpi"><span class="kpi__label">Biblioteca permanente</span><strong class="kpi__val">${detalle.materialesPermanentes}</strong><span class="kpi__nota">derechos entregados</span></div>
  </div>
  <div class="admin-grid admin-grid--even reward-admin-detail">
    <form class="card card--pad stack reward-admin-adjust" data-form="ajuste-diamantes" data-uid="${esc(c.uid)}" style="gap:14px">
      <div><span class="eyebrow">Operación excepcional</span><h2 class="admin-card-title">Ajustar Diamantes</h2></div>
      <div class="admin-callout admin-callout--warn"><i data-lucide="shield-alert" class="i"></i><div><strong>El ajuste queda en una bitácora permanente</strong><p>Usa valores positivos para acreditar y negativos para retirar. Nunca modifica la experiencia ni el nivel educativo.</p></div></div>
      ${soloMuestra ? '<p class="faint">En modo demo el formulario se muestra para revisión visual, pero no altera ningún saldo.</p>' : ''}
      <div class="field"><label>Cantidad de Diamantes</label><input class="input mono" type="number" name="diamantes" min="-10000" max="10000" step="1" required placeholder="Ej. 250 o -100" ${soloMuestra ? 'disabled' : ''}></div>
      <div class="field"><label>Motivo verificable</label><textarea class="input" name="motivo" rows="3" minlength="10" maxlength="240" required placeholder="Compensación autorizada, corrección de saldo…" ${soloMuestra ? 'disabled' : ''}></textarea></div>
      <label class="row reward-admin-confirm"><input type="checkbox" name="confirmado" required ${soloMuestra ? 'disabled' : ''}><span>Confirmo que revisé la cuenta, la cantidad y el motivo.</span></label>
      <button class="btn btn--brand btn--pill-arrow" type="submit" ${soloMuestra ? 'disabled' : ''}>Registrar ajuste <span class="arrow"><i data-lucide="shield-check" class="i"></i></span></button>
    </form>
    <section class="card card--pad stack" style="gap:12px">
      <div><span class="eyebrow">Libro mayor</span><h2 class="admin-card-title">Movimientos recientes</h2></div>
      <div class="reward-admin-events">${detalle.movimientos.length ? detalle.movimientos.slice(0, 20).map(movimientoFila).join('') : '<p class="muted">Esta cuenta todavía no tiene movimientos.</p>'}</div>
    </section>
  </div>
  <section class="card card--pad stack" style="gap:12px">
    <div><span class="eyebrow">Beneficios entregados</span><h2 class="admin-card-title">Canjes de la cuenta</h2></div>
    ${detalle.canjes.length ? `<div class="dtable-wrap"><table class="dtable"><thead><tr><th>Beneficio</th><th>Categoría</th><th>Costo</th><th>Días VIP</th><th>Fecha</th></tr></thead><tbody>${detalle.canjes.map((canje) => `<tr><td><strong>${esc(canje.nombre)}</strong></td><td>${esc(canje.categoria)}</td><td class="mono">${numero(canje.costo)}</td><td>${canje.diasVip || '—'}</td><td>${fecha(canje.fecha)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Todavía no hay canjes registrados.</p>'}
  </section>`;
}

export function adminRecompensas(params: Record<string, string>, query: URLSearchParams) {
  const demo = Datos.modo === 'demo';
  if (params.uid) {
    const cuentaDemo = demo ? CUENTAS_DEMO.find((cuenta) => cuenta.uid === params.uid) : undefined;
    return detalleCuenta(params.uid, cuentaDemo ? { ...DETALLE_DEMO, cuenta: cuentaDemo, movimientos: MOVIMIENTOS_DEMO.filter((m) => m.uid === cuentaDemo.uid), canjes: cuentaDemo.uid === DETALLE_DEMO.cuenta.uid ? DETALLE_DEMO.canjes : [], materialesPermanentes: cuentaDemo.uid === DETALLE_DEMO.cuenta.uid ? 2 : 0 } : undefined);
  }
  const resumen = demo ? RESUMEN_DEMO : AdminRemoto.recompensasResumen();
  if (!resumen) return vacio('No se pudieron cargar los Diamantes', 'Comprueba la conexión con el backend y vuelve a intentarlo.');
  const q = (query.get('q') || '').trim().toLocaleLowerCase('es-MX');
  const cuentas = demo ? CUENTAS_DEMO : AdminRemoto.recompensasCuentas();
  const filtradas = q ? cuentas.filter((c) => `${c.nombre} ${c.email} ${c.uid}`.toLocaleLowerCase('es-MX').includes(q)) : cuentas;
  const porUid = new Map(cuentas.map((c) => [c.uid, c]));
  const kpi = (icono: string, etiqueta: string, valor: string, nota: string) => `<div class="kpi"><span class="kpi__ic"><i data-lucide="${icono}" class="i"></i></span><span class="kpi__label">${etiqueta}</span><strong class="kpi__val">${valor}</strong><span class="kpi__nota">${nota}</span></div>`;
  return `
  ${adminHead('Diamantes y recompensas', demo ? 'Vista de demostración del centro de fidelización.' : 'Control real de saldos, canjes y beneficios del programa de fidelización.', demo ? '<span class="chip chip--warn"><i data-lucide="flask-conical" class="i"></i>Datos demo</span>' : '<button class="btn btn--secondary" type="button" data-refrescar-recompensas><i data-lucide="refresh-cw" class="i"></i>Actualizar</button>')}
  <section class="reward-admin-hero">
    <div><span class="eyebrow">Economía Dermalysse</span><h2>Una moneda visible, beneficios reales.</h2><p>Cada movimiento se acredita en el servidor. Los canjes entregan acceso VIP o materiales permanentes; no hay premios decorativos ni saldos de muestra.</p></div>
    <span class="reward-admin-hero__gem"><i data-lucide="gem" class="i"></i><b>${numero(resumen.saldoCirculante)}</b><small>en circulación</small></span>
  </section>
  <div class="kpis reward-admin-kpis">
    ${kpi('wallet-cards', 'Cuentas con monedero', numero(resumen.cuentas), `${resumen.cofresBienvenida} cofres acreditados`)}
    ${kpi('gem', 'Diamantes ganados', numero(resumen.diamantesGanados), `${numero(resumen.diamantesGastados)} gastados`)}
    ${kpi('gift', 'Canjes reales', numero(resumen.canjes), `${resumen.materialesPermanentes} materiales permanentes`)}
    ${kpi('crown', 'Acceso VIP entregado', `${numero(resumen.diasVipEntregados)} días`, 'por Diamantes o premios de nivel')}
  </div>
  <div class="admin-grid admin-grid--even">
    <section class="card card--pad stack" style="gap:12px">
      <div><span class="eyebrow">Boutique activa</span><h3 class="admin-card-title">${resumen.catalogo.total} beneficios cumplibles</h3></div>
      <div class="reward-admin-catalog">
        <span><i data-lucide="book-open" class="i"></i><b>${resumen.catalogo.materiales}</b><small>materiales</small></span>
        <span><i data-lucide="library-big" class="i"></i><b>${resumen.catalogo.colecciones}</b><small>colecciones</small></span>
        <span><i data-lucide="crown" class="i"></i><b>${resumen.catalogo.pasesVip}</b><small>pases VIP</small></span>
      </div>
      <p class="faint">El catálogo y sus precios viven en la API. El navegador nunca decide el costo ni entrega un beneficio por sí solo.</p>
    </section>
    <section class="card card--pad stack" style="gap:12px">
      <div><span class="eyebrow">Actividad reciente</span><h3 class="admin-card-title">Últimos movimientos</h3></div>
      <div class="reward-admin-events">${resumen.movimientosRecientes.length ? resumen.movimientosRecientes.slice(0, 6).map((m) => movimientoFila({ ...m, concepto: `${porUid.get(m.uid || '')?.nombre || 'Cuenta'} · ${m.concepto}` })).join('') : '<p class="muted">Todavía no hay movimientos.</p>'}</div>
    </section>
  </div>
  <section class="stack" style="gap:12px">
    <div class="row" style="justify-content:space-between;align-items:end"><div><span class="eyebrow">Monederos</span><h2 class="admin-card-title">Cuentas y saldos</h2></div><form class="search" data-form="buscar-recompensas"><i data-lucide="search" class="i"></i><input class="input" name="q" value="${esc(q)}" placeholder="Buscar nombre, correo o UID"></form></div>
    ${filtradas.length ? `<div class="card dtable-wrap"><table class="dtable"><thead><tr><th>Cuenta</th><th>Saldo</th><th>Experiencia</th><th>Nivel</th><th>Canjes</th><th>Último movimiento</th><th></th></tr></thead><tbody>${filtradas.map((c) => `<tr>
      <td><a class="dtable__main" href="#/admin/recompensas/${encodeURIComponent(c.uid)}">${identidad(c)}</a></td>
      <td><span class="reward-admin-amount"><i data-lucide="gem" class="i"></i><b class="mono">${numero(c.saldo)}</b></span></td><td class="mono">${numero(c.experiencia)}</td><td><span class="chip chip--primary">${esc(c.nivel.nombre)}</span></td><td class="mono">${c.canjes}</td><td>${fecha(c.actualizado)}</td>
      <td><a class="btn btn--ghost btn--icon btn--xs" href="#/admin/recompensas/${encodeURIComponent(c.uid)}" aria-label="Abrir monedero"><i data-lucide="chevron-right" class="i"></i></a></td></tr>`).join('')}</tbody></table></div>` : vacio('Sin resultados', 'Prueba con otro nombre, correo o UID.')}
  </section>`;
}
