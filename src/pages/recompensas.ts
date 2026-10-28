import { cargarPanelPuntos, type BeneficioPuntos, type ColeccionPuntos, type HitoPuntos, type MisionPuntos, type MovimientoPuntos, type NivelPublico, type PremioNivelPuntos, type RecompensaServidor } from '../core/puntos';
import { cargarCampanaBienvenida, type CampanaMiembro } from '../core/campanas';
import { esc } from '../ui/partials';
import { tarjetaCampanaRecompensas } from '../ui/campana-bienvenida';

const fecha = (iso: string) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

function etiquetaPremio(r: RecompensaServidor): string {
  const d = r.premio.duracion;
  if (d === '1m') return '1 mes VIP';
  if (d === '3m') return '3 meses VIP';
  if (d === '1y') return '1 año VIP';
  if (d === '15d') return '15 días VIP';
  if (d === 'personalizada' && r.premio.dias) return `${r.premio.dias} días VIP`;
  return 'Acceso VIP';
}

function tarjetaMeta(r: RecompensaServidor): string {
  const pct = r.meta > 0 ? Math.min(100, Math.round((r.progreso / r.meta) * 100)) : 0;
  const estado = r.canjeado ? 'is-claimed' : !r.disponible ? 'is-paused' : r.completado ? 'is-ready' : 'is-locked';
  return `<article class="rew-card ${estado}">
    <div class="rew-card__ribbon"><i data-lucide="crown" class="i"></i>${etiquetaPremio(r)}</div>
    <div class="rew-card__medal"><i data-lucide="${esc(r.icono)}" class="i"></i></div>
    <h3 class="rew-card__title">${esc(r.nombre)}</h3>
    <p class="rew-card__desc">${esc(r.descripcion)}</p>
    <div class="rew-card__progress"><div class="rew-card__track"><div class="rew-card__fill" style="width:${pct}%"></div></div><span class="rew-card__count">${r.progreso}<small>/${r.meta}</small></span></div>
    <div class="rew-card__foot">
      ${r.canjeado
        ? `<span class="rew-card__badge rew-card__badge--done"><i data-lucide="circle-check-big" class="i"></i>Canjeado${r.canjeadoEn ? ` · ${fecha(r.canjeadoEn)}` : ''}</span>`
        : !r.disponible
          ? `<span class="rew-card__badge rew-card__badge--pause" title="${esc(r.motivoPausa ?? '')}"><i data-lucide="shield-check" class="i"></i>En validación segura</span>`
          : r.completado
            ? `<button class="btn btn--brand btn--sm" data-canjear="${esc(r.id)}"><i data-lucide="gift" class="i"></i>Canjear VIP</button>`
            : `<span class="rew-card__badge rew-card__badge--lock"><i data-lucide="lock" class="i"></i>${pct}% completado</span>`}
    </div>
    ${!r.disponible && r.motivoPausa ? `<p class="rew-card__security">${esc(r.motivoPausa)}</p>` : ''}
  </article>`;
}

function tarjetaBeneficio(b: BeneficioPuntos, saldo: number): string {
  const diferencia = Math.max(0, b.costo - saldo);
  const estado = b.canjeado ? 'is-owned' : b.puedeCanjear ? 'is-ready' : 'is-locked';
  const etiqueta = b.categoria === 'vip' ? 'Acceso VIP' : b.categoria === 'paquete' ? 'Colección curada' : 'Biblioteca permanente';
  const ahorro = (b.ahorro ?? 0) > 0 ? `<span class="points-benefit__saving"><i data-lucide="badge-percent" class="i"></i>Ahorras ${(b.ahorro ?? 0).toLocaleString('es-MX')} diamantes</span>` : '';
  const incluye = b.categoria === 'paquete' && b.incluye?.length ? `<div class="points-benefit__includes"><strong><i data-lucide="layers-3" class="i"></i>Incluye ${b.incluye.length} materiales</strong><ul>${b.incluye.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${(b.faltanMateriales ?? 0) < b.incluye.length && !b.canjeado ? `<small>Precio ajustado: solo pagas por los ${b.faltanMateriales} que te faltan.</small>` : ''}</div>` : '';
  return `<article class="points-benefit ${estado}${b.destacado ? ' is-featured' : ''}${b.categoria === 'paquete' ? ' is-bundle' : ''}" data-benefit-card data-benefit-kind="${b.categoria}" data-benefit-state="${b.canjeado ? 'owned' : b.puedeCanjear ? 'ready' : 'locked'}">
    ${b.destacado ? '<span class="points-benefit__featured"><i data-lucide="sparkles" class="i"></i>Selección Dermalysse</span>' : ''}
    ${b.esObjetivo ? '<span class="points-benefit__goal"><i data-lucide="target" class="i"></i>Tu meta</span>' : ''}
    ${!b.canjeado ? `<button class="points-benefit__favorite${b.esFavorito ? ' is-active' : ''}" data-toggle-favorito="${esc(b.id)}" data-favorito-activo="${String(!b.esFavorito)}" aria-pressed="${String(!!b.esFavorito)}" aria-label="${b.esFavorito ? 'Quitar de mi ruta' : 'Guardar en mi ruta'}"><i data-lucide="heart" class="i"></i></button>` : ''}
    <div class="points-benefit__head">
      <span class="points-benefit__icon"><i data-lucide="${esc(b.icono)}" class="i"></i></span>
      <span class="points-benefit__kind">${etiqueta}</span>
    </div>
    <h3>${esc(b.nombre)}</h3>
    <p>${esc(b.descripcion)}</p>
    ${incluye}
    <div class="points-benefit__price">${ahorro}<div class="points-benefit__cost"><span class="points-diamond"><i data-lucide="gem" class="i"></i></span><strong>${b.costo.toLocaleString('es-MX')}</strong><span>diamantes</span></div>${(b.costoOriginal ?? b.costo) > b.costo ? `<del>${(b.costoOriginal ?? 0).toLocaleString('es-MX')} diamantes por separado</del>` : ''}</div>
    <div class="points-benefit__action">
      ${b.canjeado
        ? `<a class="btn btn--secondary btn--sm" href="#/materiales"><i data-lucide="library" class="i"></i>Ya es tuyo · Abrir biblioteca</a>`
        : b.puedeCanjear
          ? `<button class="btn btn--brand btn--sm" data-canjear-beneficio="${esc(b.id)}"><i data-lucide="shopping-bag" class="i"></i>Canjear ahora</button>`
          : `<button class="btn btn--ghost btn--sm" disabled><i data-lucide="lock" class="i"></i>${diferencia ? `Faltan ${diferencia.toLocaleString('es-MX')} diamantes` : esc(b.motivo ?? 'No disponible')}</button>`}
      ${!b.canjeado ? (b.esObjetivo ? '<span class="points-benefit__goal-note"><i data-lucide="target" class="i"></i>Ahorrando para esta meta</span>' : `<button class="points-benefit__goal-action" data-seleccionar-objetivo="${esc(b.id)}"><i data-lucide="target" class="i"></i>Elegir como meta</button>`) : ''}
    </div>
  </article>`;
}

function rutaFavoritos(favoritos: BeneficioPuntos[], saldo: number): string {
  if (!favoritos.length) return `<section class="points-wishlist is-empty"><div><span><i data-lucide="heart" class="i"></i></span><div><small>Ruta de deseos</small><h2>Guarda hasta cinco beneficios</h2><p>Usa el corazón de la boutique para comparar metas sin perderlas de vista.</p></div></div><a href="#boutique" class="btn btn--secondary btn--sm">Explorar boutique</a></section>`;
  return `<section class="points-wishlist"><header><div><span class="eyebrow">Ruta de deseos · ${favoritos.length}/5</span><h2>Tus próximas recompensas, siempre visibles</h2></div><p>Guarda varias opciones y elige una como meta principal cuando quieras.</p></header><div class="points-wishlist__rail">${favoritos.map((b) => {
    const faltan = Math.max(0, b.costo - saldo);
    const progreso = Math.min(100, Math.round((saldo / Math.max(1, b.costo)) * 100));
    return `<article><span class="points-wishlist__icon"><i data-lucide="${esc(b.icono)}" class="i"></i></span><div><small>${b.categoria === 'vip' ? 'Acceso VIP' : b.categoria === 'paquete' ? 'Colección' : 'Material permanente'}</small><h3>${esc(b.nombre)}</h3><div class="points-wishlist__meter"><span><i style="width:${progreso}%"></i></span><strong>${progreso}%</strong></div><p>${faltan ? `Faltan ${faltan.toLocaleString('es-MX')} diamantes` : 'Saldo listo para canjear'}</p></div><div class="points-wishlist__actions">${b.esObjetivo ? '<em><i data-lucide="target" class="i"></i>Meta activa</em>' : `<button data-seleccionar-objetivo="${esc(b.id)}"><i data-lucide="target" class="i"></i>Hacer meta</button>`}<button data-toggle-favorito="${esc(b.id)}" data-favorito-activo="false"><i data-lucide="x" class="i"></i>Quitar</button></div></article>`;
  }).join('')}</div></section>`;
}

function tallerAtelier(panel: Awaited<ReturnType<typeof cargarPanelPuntos>>): string {
  const escalones = panel.atelier.descuentos.map((d) => `<span><strong>${d.cantidad}</strong> materiales <em>-${d.porcentaje}%</em></span>`).join('');
  return `<section class="points-atelier" data-atelier data-atelier-min="${panel.atelier.minimo}" data-atelier-max="${panel.atelier.maximo}" data-atelier-saldo="${panel.puntos.saldo}">
    <div class="points-atelier__intro"><span class="points-atelier__monogram"><i data-lucide="wand-sparkles" class="i"></i></span><div><span class="eyebrow">Atelier Dermalysse</span><h2>Diseña tu propia colección</h2><p>Combina de 2 a 5 materiales disponibles. El servidor calcula el precio final y entrega cada acceso de forma permanente.</p></div><div class="points-atelier__tiers">${escalones}</div></div>
    <div class="points-atelier__workspace">
      <div class="points-atelier__catalog"><small>Selecciona tus piezas</small><div>${panel.atelier.materiales.map((m) => `<button data-atelier-material="${esc(m.materialId ?? '')}" data-atelier-cost="${m.costo}" aria-pressed="false"><span><i data-lucide="${esc(m.icono)}" class="i"></i></span><div><strong>${esc(m.nombre)}</strong><small><i data-lucide="gem" class="i"></i>${m.costo.toLocaleString('es-MX')} diamantes</small></div><i data-lucide="plus" class="i"></i></button>`).join('')}</div></div>
      <aside class="points-atelier__quote" aria-live="polite">
        <small>Tu colección a medida</small><strong><span data-atelier-count>0</span> materiales</strong>
        <dl><div><dt>Precio por separado</dt><dd data-atelier-original>0 diamantes</dd></div><div><dt>Descuento Atelier</dt><dd data-atelier-discount>0%</dd></div><div><dt>Ahorro</dt><dd data-atelier-saving>0 diamantes</dd></div></dl>
        <div class="points-atelier__total"><span>Total protegido</span><strong data-atelier-total>—</strong></div>
        <p data-atelier-message>Elige al menos ${panel.atelier.minimo} materiales para recibir tu cotización.</p>
        <button class="btn btn--brand" data-canjear-atelier disabled><i data-lucide="shopping-bag" class="i"></i>Canjear colección</button>
        <button class="points-atelier__clear" data-limpiar-atelier disabled>Limpiar selección</button>
      </aside>
    </div>
  </section>`;
}

function inteligencia(panel: Awaited<ReturnType<typeof cargarPanelPuntos>>): string {
  const i = panel.inteligencia;
  const maximo = Math.max(1, ...i.historialMensual.flatMap((m) => [m.ganados, m.gastados]));
  const barras = i.historialMensual.map((m) => {
    const etiqueta = new Date(`${m.mes}-02T00:00:00Z`).toLocaleDateString('es-MX', { month: 'short', timeZone: 'UTC' });
    return `<div class="points-insight-chart__month"><div><i class="is-earned" style="height:${Math.max(m.ganados ? 4 : 0, Math.round((m.ganados / maximo) * 100))}%" title="${m.ganados} ganados"></i><i class="is-spent" style="height:${Math.max(m.gastados ? 4 : 0, Math.round((m.gastados / maximo) * 100))}%" title="${m.gastados} gastados"></i></div><span>${esc(etiqueta)}</span></div>`;
  }).join('');
  const dist = i.distribucionCanjes;
  return `<div class="points-insight-hero"><div><span><i data-lucide="chart-no-axes-combined" class="i"></i></span><div><small>Lectura personal de valor</small><h2>Entiende lo que tu constancia ya construyó</h2><p>Datos calculados con movimientos y canjes registrados por la API; no son proyecciones ni promesas.</p></div></div><em>Actualizado con tu actividad real</em></div>
    <div class="points-insight-kpis"><article><span><i data-lucide="gem" class="i"></i></span><small>Diamantes · 30 días</small><strong>+${i.ultimos30Dias.ganados.toLocaleString('es-MX')}</strong><p>Balance: ${i.ultimos30Dias.balance > 0 ? '+' : ''}${i.ultimos30Dias.balance.toLocaleString('es-MX')} diamantes</p></article><article><span><i data-lucide="badge-percent" class="i"></i></span><small>Ahorro acumulado</small><strong>${i.ahorroAcumulado.toLocaleString('es-MX')}</strong><p>diamantes conservados por colecciones</p></article><article><span><i data-lucide="library" class="i"></i></span><small>Biblioteca permanente</small><strong>${i.materialesPermanentes}</strong><p>materiales ligados a tu cuenta</p></article><article><span><i data-lucide="crown" class="i"></i></span><small>VIP entregado</small><strong>${i.diasVipEntregados}</strong><p>días obtenidos con beneficios</p></article></div>
    <div class="points-insight-grid"><article class="points-insight-chart"><header><div><small>Últimos seis meses</small><h3>Flujo de diamantes verificado</h3></div><div><span><i></i>Ganados</span><span><i></i>Gastados</span></div></header><div class="points-insight-chart__plot">${barras}</div></article><article class="points-insight-value"><small>Valor convertido</small><strong><i data-lucide="gem" class="i"></i>${i.valorCanjeado.toLocaleString('es-MX')} <em>diamantes</em></strong><p>Es el total histórico usado en beneficios reales dentro del club.</p><div><span>Ritmo semanal observado</span><strong>${i.promedioSemanalObservado.toLocaleString('es-MX')} diamantes</strong></div><small>Se calcula con tus últimos 30 días; puede subir o bajar según tu actividad.</small></article></div>
    <section class="points-insight-distribution"><header><span class="eyebrow">Huella de canjes</span><h3>Así has transformado tus diamantes</h3></header><div><article><i data-lucide="book-open" class="i"></i><strong>${dist.materiales}</strong><span>materiales</span></article><article><i data-lucide="layers-3" class="i"></i><strong>${dist.colecciones}</strong><span>colecciones</span></article><article><i data-lucide="crown" class="i"></i><strong>${dist.vip}</strong><span>pases VIP</span></article><article><i data-lucide="key-round" class="i"></i><strong>${dist.premiosNivel}</strong><span>premios de nivel</span></article></div></section>`;
}

function movimiento(m: MovimientoPuntos): string {
  return `<li class="points-ledger__item">
    <span class="points-ledger__icon ${m.tipo === 'canje' ? 'is-spend' : 'is-earn'}"><i data-lucide="${m.tipo === 'canje' ? 'shopping-bag' : 'sparkles'}" class="i"></i></span>
    <span class="points-ledger__copy"><strong>${esc(m.concepto)}</strong><small>${esc(m.detalle)} · ${fecha(m.fecha)}</small></span>
    <strong class="points-ledger__amount ${m.puntos < 0 ? 'is-spend' : 'is-earn'}"><i data-lucide="gem" class="i"></i>${m.puntos > 0 ? '+' : ''}${m.puntos.toLocaleString('es-MX')}</strong>
  </li>`;
}

function tarjetaHito(h: HitoPuntos): string {
  return `<article class="points-milestone ${h.completado ? 'is-complete' : ''} is-${h.rareza}">
    <div class="points-milestone__top"><span class="points-milestone__seal"><i data-lucide="${esc(h.icono)}" class="i"></i></span><span class="points-milestone__rarity">${h.rareza === 'elite' ? 'Élite' : h.rareza === 'distinguido' ? 'Distinguido' : 'Esencial'}</span></div>
    <h3>${esc(h.nombre)}</h3><p>${esc(h.descripcion)}</p>
    <div class="points-milestone__progress"><span><i style="width:${h.porcentaje}%"></i></span><strong>${h.progreso}/${h.meta}</strong></div>
    <footer><span><i data-lucide="gem" class="i"></i>+${h.premio.toLocaleString('es-MX')} diamantes</span>${h.completado ? '<strong><i data-lucide="circle-check-big" class="i"></i>Conseguido</strong>' : `<small>${h.porcentaje}%</small>`}</footer>
  </article>`;
}

function selloColeccion(c: ColeccionPuntos): string {
  return `<article class="points-collection ${c.completado ? 'is-complete' : ''}">
    <div class="points-collection__ring" style="--progress:${c.porcentaje * 3.6}deg"><span><i data-lucide="${esc(c.icono)}" class="i"></i></span></div>
    <div><small>${c.completado ? 'Colección completada' : `${c.progreso} de ${c.meta} piezas`}</small><h3>${esc(c.nombre)}</h3><p>${esc(c.descripcion)}</p></div>
  </article>`;
}

function tarjetaMision(m: MisionPuntos): string {
  const estado = m.estado === 'completada' ? 'Completada' : m.estado === 'activa' ? 'En marcha' : m.estado === 'disponible' ? 'Lista para activar' : 'Bloqueada';
  return `<article class="points-mission is-${m.estado}">
    <header><span class="points-mission__icon"><i data-lucide="${esc(m.icono)}" class="i"></i></span><div><small>${m.ruta} · tramo ${m.tramo}</small><strong>${estado}</strong></div></header>
    <h3>${esc(m.nombre)}</h3><p>${esc(m.descripcion)}</p>
    <div class="points-mission__reward"><i data-lucide="gem" class="i"></i><strong>+${m.premio.toLocaleString('es-MX')}</strong><span>diamantes al completar</span></div>
    <div class="points-mission__progress"><div><span style="width:${m.porcentaje}%"></span></div><small>${m.progreso}/${m.meta}</small></div>
    <footer>${m.puedeActivar
      ? `<button class="btn btn--brand btn--sm" data-activar-mision="${esc(m.id)}"><i data-lucide="rocket" class="i"></i>Activar misión</button>`
      : m.estado === 'activa' ? '<span><i data-lucide="radio" class="i"></i>Seguimiento automático</span>'
        : m.estado === 'completada' ? `<span class="is-done"><i data-lucide="circle-check-big" class="i"></i>Premio acreditado${m.completadaEn ? ` · ${fecha(m.completadaEn)}` : ''}</span>`
          : `<span><i data-lucide="lock" class="i"></i>${esc(m.motivo ?? 'Completa el tramo anterior')}</span>`}</footer>
  </article>`;
}

function tarjetaNivel(n: NivelPublico, experiencia: number): string {
  return `<article class="points-level ${n.actual ? 'is-current' : ''} ${n.alcanzado ? 'is-reached' : ''}">
    <span class="points-level__mark"><i data-lucide="${n.actual ? 'sparkles' : n.alcanzado ? 'check' : 'lock'}" class="i"></i></span>
    <div><small>${n.actual ? 'Nivel actual' : n.alcanzado ? 'Alcanzado' : `${Math.max(0, n.desde - experiencia).toLocaleString('es-MX')} XP restantes`}</small><h3>${esc(n.nombre)}</h3><p>${esc(n.descripcion)}</p></div>
    <strong>${n.desde.toLocaleString('es-MX')}</strong>
  </article>`;
}

function tarjetaPremioNivel(p: PremioNivelPuntos): string {
  const estado = p.canjeado ? 'is-claimed' : p.desbloqueado ? 'is-unlocked' : 'is-locked';
  const elegido = p.opciones.find((o) => o.id === p.beneficioElegido);
  return `<article class="points-vault-card ${estado}">
    <header><span><i data-lucide="${p.canjeado ? 'badge-check' : p.desbloqueado ? 'key-round' : 'lock-keyhole'}" class="i"></i></span><div><small>${p.desde.toLocaleString('es-MX')} XP de experiencia</small><h3>${esc(p.nivelNombre)}</h3></div>${p.canjeado ? '<em>Elegido</em>' : p.desbloqueado ? '<em>Desbloqueado</em>' : '<em>Bloqueado</em>'}</header>
    <p>${esc(p.descripcion)}</p>
    ${p.canjeado && elegido ? `<div class="points-vault-card__claimed"><i data-lucide="gift" class="i"></i><span><small>Tu recompensa</small><strong>${esc(elegido.nombre)}</strong>${p.canjeadoEn ? `<em>${fecha(p.canjeadoEn)}</em>` : ''}</span></div>` : `<div class="points-vault-card__choice"><small>Elige una recompensa al alcanzar el nivel</small>${p.opciones.map((o) => {
      const noDisponible = !p.desbloqueado || !o.disponible || o.canjeado;
      return `<button ${noDisponible ? 'disabled' : ''} data-canjear-premio-nivel="${esc(p.nivelId)}" data-beneficio-id="${esc(o.id)}"><span><i data-lucide="${esc(o.icono)}" class="i"></i></span><div><strong>${esc(o.nombre)}</strong><small>${o.canjeado ? 'Ya está en tu cuenta' : o.categoria === 'vip' ? `${o.diasVip ?? 0} días de acceso` : o.categoria === 'paquete' ? `${o.faltanMateriales ?? 0} materiales permanentes` : 'Acceso permanente'}</small></div><i data-lucide="${noDisponible ? 'lock' : 'arrow-right'}" class="i"></i></button>`;
    }).join('')}</div>`}
  </article>`;
}

export async function paginaRecompensas(): Promise<string> {
  const [panel, resultadoCampana] = await Promise.all([
    cargarPanelPuntos(),
    cargarCampanaBienvenida().then((campana) => ({ campana, error: '' })).catch((error: unknown) => ({ campana: null as CampanaMiembro | null, error: error instanceof Error ? error.message : 'Vuelve a intentarlo en unos momentos.' })),
  ]);
  const p = panel.puntos;
  const listas = panel.recompensas.filter((r) => r.disponible && r.completado && !r.canjeado).length;
  const materiales = panel.boutique.filter((b) => b.categoria === 'material');
  const paquetes = panel.boutique.filter((b) => b.categoria === 'paquete');
  const vip = panel.boutique.filter((b) => b.categoria === 'vip');
  const canjesMaterial = materiales.filter((b) => b.canjeado).length;
  const hitosCompletados = panel.hitos.filter((h) => h.completado).length;
  const misionesActivas = panel.misiones.filter((m) => m.estado === 'activa').length;
  const misionesDisponibles = panel.misiones.filter((m) => m.estado === 'disponible').length;
  const misionesCompletadas = panel.misiones.filter((m) => m.estado === 'completada').length;
  const mayorBonoHito = Math.max(...panel.hitos.map((h) => h.premio), 0);
  const premiosDisponibles = panel.premiosNivel.filter((x) => x.puedeCanjear).length;
  const o = panel.objetivo;

  return `<section class="points-page" data-rew-page>
    <header class="points-hero">
      <div class="points-hero__content">
        <span class="points-hero__eyebrow"><i data-lucide="gem" class="i"></i>Diamantes Dermalysse</span>
        <h1>Tu aprendizaje ahora <em>vale más.</em></h1>
        <p>Aprende, practica y completa rutas verificadas. Tus diamantes se convierten en materiales permanentes y días VIP reales.</p>
        <div class="points-hero__trust"><span><i data-lucide="shield-check" class="i"></i>Validado por servidor</span><span><i data-lucide="infinity" class="i"></i>Materiales permanentes</span><span><i data-lucide="history" class="i"></i>Movimientos transparentes</span></div>
      </div>
      <div class="points-wallet">
        <span class="points-wallet__jewel"><i data-lucide="gem" class="i"></i><i></i><i></i></span>
        <span class="points-wallet__label">Saldo disponible</span>
        <strong>${p.saldo.toLocaleString('es-MX')}</strong>
        <span class="points-wallet__unit"><i data-lucide="gem" class="i"></i>Diamantes Dermalysse</span>
        <a href="#boutique" class="btn points-wallet__cta"><i data-lucide="shopping-bag" class="i"></i>Explorar beneficios</a>
      </div>
    </header>

    ${tarjetaCampanaRecompensas(resultadoCampana.campana, resultadoCampana.error)}

    <section class="points-status" aria-label="Tu nivel Dermalysse">
      <div class="points-status__level"><span class="points-status__seal"><i data-lucide="badge-check" class="i"></i></span><div><small>Tu nivel</small><h2>${esc(p.nivel.nombre)}</h2><p>${esc(p.nivel.descripcion)}</p></div></div>
      <div class="points-status__progress"><div><span>Progreso de nivel</span><strong>${p.puntosSiguienteNivel === null ? 'Nivel máximo' : `${p.puntosSiguienteNivel.toLocaleString('es-MX')} XP para subir`}</strong></div><div class="points-status__track"><span style="width:${p.progresoNivel}%"></span></div><small>Tu nivel reconoce constancia dentro del club; no sustituye una acreditación profesional.</small></div>
      <div class="points-status__stats"><div><strong>${p.experiencia.toLocaleString('es-MX')}</strong><span>experiencia total</span></div><div><strong>${panel.canjes.length}</strong><span>canjes realizados</span></div><div><strong>${canjesMaterial}</strong><span>materiales tuyos</span></div></div>
    </section>

    <section class="points-metrics" aria-label="Tu pasaporte de actividad">
      <div><span><i data-lucide="play-circle" class="i"></i></span><strong>${p.metricas.clases}</strong><small>clases acreditadas</small></div>
      <div><span><i data-lucide="book-check" class="i"></i></span><strong>${p.metricas.cursos}</strong><small>cursos completos</small></div>
      <div><span><i data-lucide="award" class="i"></i></span><strong>${p.metricas.certificados}</strong><small>certificados válidos</small></div>
      <div><span><i data-lucide="brain-circuit" class="i"></i></span><strong>${p.metricas.xpRetos.toLocaleString('es-MX')}</strong><small>XP verificados</small></div>
      <div><span><i data-lucide="flame" class="i"></i></span><strong>${p.metricas.rachaRetos}</strong><small>días de racha en Retos</small></div>
    </section>

    <section class="points-welcome" aria-label="Recompensa garantizada para todas las cuentas">
      <div class="points-welcome__diamond"><i data-lucide="gem" class="i"></i><span></span></div>
      <div class="points-welcome__copy"><span><i data-lucide="circle-check-big" class="i"></i>Recompensa garantizada · ya acreditada</span><h2>${esc(p.recompensaInicial.nombre)}</h2><p>Todas las cuentas reciben una sola vez <strong>${p.recompensaInicial.diamantes.toLocaleString('es-MX')} Diamantes Dermalysse</strong>. Alcanzan desde el primer día para elegir un material permanente o un pase VIP de 24 horas.</p></div>
      <div class="points-welcome__value"><small>Tu regalo inicial</small><strong><i data-lucide="gem" class="i"></i>${p.recompensaInicial.diamantes.toLocaleString('es-MX')}</strong><span>diamantes reales</span><a href="#boutique">Elegir mi beneficio <i data-lucide="arrow-right" class="i"></i></a></div>
    </section>

    ${o ? `<section class="points-next ${o.faltan === 0 ? 'is-ready' : ''}">
      <div class="points-next__icon"><i data-lucide="target" class="i"></i></div>
      <div class="points-next__copy"><span>${o.personalizado ? 'Tu meta de ahorro elegida' : 'Próximo objetivo recomendado'}</span><h2>${esc(o.nombre)}</h2><p>${o.faltan === 0 ? 'Ya tienes los diamantes necesarios. Tu beneficio está listo para canjear.' : `Te faltan ${o.faltan.toLocaleString('es-MX')} diamantes: equivale a ${o.clasesEquivalentes} clases o aproximadamente ${o.cursosEquivalentes} cursos completos.`}</p></div>
      <div class="points-next__meter"><div><span style="width:${o.porcentaje}%"></span></div><strong>${o.porcentaje}%</strong><a href="#boutique">${o.faltan === 0 ? 'Canjear ahora' : o.personalizado ? 'Cambiar meta' : 'Ver boutique'} <i data-lucide="arrow-right" class="i"></i></a></div>
    </section>` : ''}

    ${rutaFavoritos(panel.favoritos, p.saldo)}

    ${listas ? `<div class="rew-alert"><i data-lucide="party-popper" class="i"></i><strong>Tienes ${listas} recompensa${listas > 1 ? 's' : ''} VIP lista${listas > 1 ? 's' : ''}.</strong> Puedes canjear${listas > 1 ? 'las' : 'la'} en la sección Metas VIP.</div>` : ''}

    ${(misionesActivas || misionesDisponibles) ? `<div class="points-mission-alert"><span><i data-lucide="route" class="i"></i></span><div><strong>${misionesActivas ? `${misionesActivas} misión${misionesActivas > 1 ? 'es' : ''} en marcha` : 'Tu siguiente misión está lista'}</strong><p>${misionesActivas ? 'Tu avance se actualiza automáticamente con actividad futura verificada.' : `Tienes ${misionesDisponibles} ruta${misionesDisponibles > 1 ? 's' : ''} disponible${misionesDisponibles > 1 ? 's' : ''} para activar.`}</p></div><button class="btn btn--secondary btn--sm" data-open-points-tab="misiones">Ir a misiones <i data-lucide="arrow-right" class="i"></i></button></div>` : ''}
    ${premiosDisponibles ? `<div class="points-vault-alert"><span><i data-lucide="key-round" class="i"></i></span><div><strong>${premiosDisponibles} recompensa${premiosDisponibles > 1 ? 's' : ''} de nivel disponible${premiosDisponibles > 1 ? 's' : ''}</strong><p>Elige entre acceso VIP o contenido permanente. Cada nivel permite una sola elección.</p></div><button class="btn btn--secondary btn--sm" data-open-points-tab="boveda">Abrir bóveda <i data-lucide="arrow-right" class="i"></i></button></div>` : ''}

    <section class="points-earn">
      <div class="points-section-heading"><div><span class="eyebrow">Cómo crece tu saldo</span><h2>Gana diamantes haciendo lo que ya te ayuda a avanzar</h2></div><p>La API acredita cada hito una sola vez. Repetir una acción no duplica diamantes.</p></div>
      <div class="points-earn__grid">
        <article><span><i data-lucide="play-circle" class="i"></i></span><strong>+${p.reglas.clases}</strong><h3>Clase acreditada</h3><p>Al alcanzar el avance real requerido por el reproductor.</p></article>
        <article><span><i data-lucide="graduation-cap" class="i"></i></span><strong>+${p.reglas.cursos}</strong><h3>Curso completado</h3><p>Un bono adicional al cerrar todas sus clases.</p></article>
        <article><span><i data-lucide="award" class="i"></i></span><strong>+${p.reglas.certificados}</strong><h3>Certificado válido</h3><p>Solo cuando el servidor confirma su emisión.</p></article>
        <article><span><i data-lucide="gamepad-2" class="i"></i></span><strong>XP → diamantes</strong><h3>Retos verificados</h3><p>${esc(p.reglas.retos)} en actividades calificadas por la API.</p></article>
        <article class="points-earn__bonus"><span><i data-lucide="medal" class="i"></i></span><strong>+25 a +${mayorBonoHito.toLocaleString('es-MX')}</strong><h3>Bonos de Pasaporte</h3><p>${panel.hitos.length} hitos vitalicios entregan premios extra una sola vez.</p></article>
      </div>
    </section>

    <div data-tabs>
      <div class="points-tabs tabs">
      <button class="is-active" data-for="boutique"><i data-lucide="shopping-bag" class="i"></i>Boutique</button>
      <button data-for="misiones"><i data-lucide="route" class="i"></i>Misiones${(misionesActivas || misionesDisponibles) ? `<span>${misionesActivas || misionesDisponibles}</span>` : ''}</button>
      <button data-for="pasaporte"><i data-lucide="stamp" class="i"></i>Pasaporte<span>${hitosCompletados}</span></button>
      <button data-for="boveda"><i data-lucide="key-round" class="i"></i>Bóveda${premiosDisponibles ? `<span>${premiosDisponibles}</span>` : ''}</button>
      <button data-for="metas"><i data-lucide="trophy" class="i"></i>Metas VIP${listas ? `<span>${listas}</span>` : ''}</button>
      <button data-for="inteligencia"><i data-lucide="chart-no-axes-combined" class="i"></i>Inteligencia</button>
      <button data-for="actividad"><i data-lucide="history" class="i"></i>Mi actividad</button>
      </div>
      <section data-tab="boutique" id="boutique" class="points-tab-panel">
        <div class="points-section-heading"><div><span class="eyebrow">Boutique de Beneficios</span><h2>Elige en qué convertir tus diamantes</h2></div><p>Los accesos a materiales son permanentes. Los días VIP tienen un límite responsable de 30 por año calendario.</p></div>
        ${tallerAtelier(panel)}
        <div class="points-benefit-filters" role="group" aria-label="Filtrar beneficios"><button class="is-active" data-benefit-filter="all" aria-pressed="true">Todos <span>${panel.boutique.length}</span></button><button data-benefit-filter="ready" aria-pressed="false">Listos para canjear</button><button data-benefit-filter="paquete" aria-pressed="false">Colecciones</button><button data-benefit-filter="material" aria-pressed="false">Materiales</button><button data-benefit-filter="vip" aria-pressed="false">Días VIP</button><button data-benefit-filter="owned" aria-pressed="false">Ya son míos</button></div>
        <div class="points-shelf points-shelf--bundles" data-benefit-shelf><div class="points-shelf__title"><i data-lucide="sparkles" class="i"></i><div><h3>Colecciones curadas</h3><p>Rutas editoriales con ahorro. Si ya tienes una pieza, el servidor descuenta únicamente lo que falta.</p></div></div><div class="points-benefits points-benefits--bundles">${paquetes.map((b) => tarjetaBeneficio(b, p.saldo)).join('')}</div></div>
        <div class="points-shelf" data-benefit-shelf><div class="points-shelf__title"><i data-lucide="library" class="i"></i><div><h3>Biblioteca permanente</h3><p>Canjea una vez y el material queda ligado a tu cuenta.</p></div></div><div class="points-benefits">${materiales.map((b) => tarjetaBeneficio(b, p.saldo)).join('')}</div></div>
        <div class="points-shelf points-shelf--vip" data-benefit-shelf>
          <div class="points-vip-quota"><span><i data-lucide="calendar-heart" class="i"></i></span><div><small>Cupo responsable ${panel.vipAnual.anio}</small><strong>${panel.vipAnual.disponibles} días VIP disponibles</strong><div><i style="width:${Math.round((panel.vipAnual.usados / panel.vipAnual.limite) * 100)}%"></i></div></div><em>${panel.vipAnual.usados}/${panel.vipAnual.limite} usados</em></div>
          <div class="points-shelf__title"><i data-lucide="crown" class="i"></i><div><h3>Días VIP</h3><p>Desde un pase de 24 horas hasta un mes; sin modificar ni cobrar tu suscripción.</p></div></div><div class="points-benefits points-benefits--vip">${vip.map((b) => tarjetaBeneficio(b, p.saldo)).join('')}</div></div>
      </section>
      <section data-tab="boveda" class="points-tab-panel" hidden>
        <div class="points-section-heading"><div><span class="eyebrow">Bóveda de nivel</span><h2>Cada gran etapa abre una elección extraordinaria</h2></div><p>Al alcanzar un nivel eliges una sola recompensa: días VIP reales o acceso permanente a contenido. No consume tu saldo de diamantes.</p></div>
        <div class="points-vault-hero"><span><i data-lucide="shield-check" class="i"></i></span><div><strong>Una elección real, protegida por la API</strong><p>La experiencia desbloquea la bóveda; el beneficio se entrega y registra en la misma operación. Ningún botón es decorativo.</p></div><em>${panel.premiosNivel.filter((x) => x.canjeado).length}/${panel.premiosNivel.length} elegidos</em></div>
        <div class="points-vault-grid">${panel.premiosNivel.map(tarjetaPremioNivel).join('')}</div>
        <p class="points-vault-note"><i data-lucide="info" class="i"></i>Los niveles reconocen participación dentro del Club Dermalysse y no equivalen a títulos, licencias ni acreditaciones profesionales.</p>
      </section>
      <section data-tab="misiones" class="points-tab-panel" hidden>
        <div class="points-section-heading"><div><span class="eyebrow">Misiones progresivas</span><h2>Elige una ruta y convierte constancia en beneficios</h2></div><p>Las misiones solo cuentan actividad nueva después de activarlas. El servidor guarda el punto de partida y acredita cada premio una sola vez.</p></div>
        <div class="points-missions-summary">
          <article><span><i data-lucide="radio" class="i"></i></span><strong>${misionesActivas}</strong><small>en marcha</small></article>
          <article><span><i data-lucide="rocket" class="i"></i></span><strong>${misionesDisponibles}</strong><small>listas para activar</small></article>
          <article><span><i data-lucide="circle-check-big" class="i"></i></span><strong>${misionesCompletadas}</strong><small>completadas</small></article>
          <div><i data-lucide="shield-check" class="i"></i><p><strong>Progreso confiable.</strong> No se premia actividad anterior ni se duplican diamantes al recargar.</p></div>
        </div>
        <div class="points-mission-grid">${panel.misiones.map(tarjetaMision).join('')}</div>
      </section>
      <section data-tab="pasaporte" class="points-tab-panel" hidden>
        <div class="points-section-heading"><div><span class="eyebrow">Pasaporte Dermalysse</span><h2>Una trayectoria que se ve, se celebra y suma</h2></div><p>Cada sello nace de una métrica verificada. Los bonos se acreditan automáticamente una sola vez.</p></div>
        <div class="points-passport-summary"><div><i data-lucide="stamp" class="i"></i><span><strong>${hitosCompletados}/${panel.hitos.length}</strong><small>hitos conseguidos</small></span></div><p>Completa rutas de estudio, certifica tu avance y practica en Retos para construir un pasaporte único dentro del club.</p></div>
        <div class="points-milestones">${panel.hitos.map(tarjetaHito).join('')}</div>
        <div class="points-levels"><div class="points-levels__intro"><span class="eyebrow">Salón de niveles</span><h2>Ocho etapas para una trayectoria extraordinaria</h2><p>La experiencia total nunca se gasta. Cada nivel refleja constancia verificada dentro del club y no equivale a una acreditación profesional.</p></div><div class="points-levels__grid">${panel.niveles.map((n) => tarjetaNivel(n, p.experiencia)).join('')}</div></div>
        <div class="points-collections"><div class="points-collections__intro"><span class="eyebrow">Colecciones</span><h2>Tu biblioteca también cuenta una historia</h2><p>Cada material permanente llena tu archivo personal y desbloquea nuevos sellos de colección.</p></div><div class="points-collections__grid">${panel.colecciones.map(selloColeccion).join('')}</div></div>
      </section>
      <section data-tab="metas" class="points-tab-panel" hidden>
        <div class="points-section-heading"><div><span class="eyebrow">Logros con beneficio</span><h2>Metas VIP verificables</h2></div><p>Las metas pausadas conservan tu avance, pero no entregan valor hasta contar con validación segura.</p></div>
        <div class="rew-grid">${panel.recompensas.map(tarjetaMeta).join('')}</div>
        <div class="points-upcoming"><div class="points-upcoming__head"><span><i data-lucide="shield-check" class="i"></i></span><div><h3>Más formas de ganar, con reglas responsables</h3><p>Estamos preparando estas fuentes sin convertirlas en atajos manipulables.</p></div></div><div class="points-upcoming__grid">${panel.proximasFormasDeGanar.map((x) => `<article><span>${esc(x.estado)}</span><h4>${esc(x.nombre)}</h4><p>${esc(x.descripcion)}</p></article>`).join('')}</div></div>
      </section>
      <section data-tab="inteligencia" class="points-tab-panel" hidden>
        ${inteligencia(panel)}
      </section>
      <section data-tab="actividad" class="points-tab-panel" hidden>
        <div class="points-section-heading"><div><span class="eyebrow">Transparencia total</span><h2>Tu historial de diamantes y canjes</h2></div><p>La experiencia nunca disminuye; únicamente el saldo de diamantes cambia cuando eliges un beneficio.</p></div>
        <div class="points-activity-grid">
          <article class="points-ledger"><header><h3>Movimientos recientes</h3><span>${panel.movimientos.length}</span></header>${panel.movimientos.length ? `<ul>${panel.movimientos.map(movimiento).join('')}</ul>` : '<div class="points-empty"><i data-lucide="sparkles" class="i"></i><p>Completa tu primera actividad para comenzar.</p></div>'}</article>
          <article class="points-redemptions"><header><h3>Mis beneficios</h3><span>${panel.canjes.length}</span></header>${panel.canjes.length ? `<ul>${panel.canjes.map((c) => `<li><span><i data-lucide="${c.categoria === 'vip' ? 'crown' : c.categoria === 'paquete' ? 'layers-3' : 'book-open'}" class="i"></i></span><div><strong>${esc(c.nombre)}</strong><small>${fecha(c.fecha)} · ${c.origen === 'nivel' ? 'Premio de nivel' : `${c.costo.toLocaleString('es-MX')} diamantes`}${c.vigenciaHasta ? ` · VIP hasta ${fecha(c.vigenciaHasta)}` : ' · Acceso permanente'}</small></div></li>`).join('')}</ul>` : '<div class="points-empty"><i data-lucide="shopping-bag" class="i"></i><p>Tus canjes aparecerán aquí.</p></div>'}</article>
        </div>
      </section>
    </div>
  </section>`;
}
