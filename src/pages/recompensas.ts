import { cargarPanelPuntos, type BeneficioPuntos, type ColeccionPuntos, type HitoPuntos, type MovimientoPuntos, type RecompensaServidor } from '../core/puntos';
import { esc } from '../ui/partials';

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
  return `<article class="points-benefit ${estado}${b.destacado ? ' is-featured' : ''}">
    ${b.destacado ? '<span class="points-benefit__featured"><i data-lucide="sparkles" class="i"></i>Selección Dermalysse</span>' : ''}
    <div class="points-benefit__head">
      <span class="points-benefit__icon"><i data-lucide="${esc(b.icono)}" class="i"></i></span>
      <span class="points-benefit__kind">${b.categoria === 'vip' ? 'Acceso VIP' : 'Biblioteca permanente'}</span>
    </div>
    <h3>${esc(b.nombre)}</h3>
    <p>${esc(b.descripcion)}</p>
    <div class="points-benefit__cost"><i data-lucide="gem" class="i"></i><strong>${b.costo.toLocaleString('es-MX')}</strong><span>puntos</span></div>
    <div class="points-benefit__action">
      ${b.canjeado
        ? `<a class="btn btn--secondary btn--sm" href="#/materiales"><i data-lucide="library" class="i"></i>Ya es tuyo · Abrir biblioteca</a>`
        : b.puedeCanjear
          ? `<button class="btn btn--brand btn--sm" data-canjear-beneficio="${esc(b.id)}"><i data-lucide="shopping-bag" class="i"></i>Canjear ahora</button>`
          : `<button class="btn btn--ghost btn--sm" disabled><i data-lucide="lock" class="i"></i>${diferencia ? `Faltan ${diferencia.toLocaleString('es-MX')} puntos` : esc(b.motivo ?? 'No disponible')}</button>`}
    </div>
  </article>`;
}

function movimiento(m: MovimientoPuntos): string {
  return `<li class="points-ledger__item">
    <span class="points-ledger__icon ${m.tipo === 'canje' ? 'is-spend' : 'is-earn'}"><i data-lucide="${m.tipo === 'canje' ? 'shopping-bag' : 'sparkles'}" class="i"></i></span>
    <span class="points-ledger__copy"><strong>${esc(m.concepto)}</strong><small>${esc(m.detalle)} · ${fecha(m.fecha)}</small></span>
    <strong class="points-ledger__amount ${m.puntos < 0 ? 'is-spend' : 'is-earn'}">${m.puntos > 0 ? '+' : ''}${m.puntos.toLocaleString('es-MX')}</strong>
  </li>`;
}

function tarjetaHito(h: HitoPuntos): string {
  return `<article class="points-milestone ${h.completado ? 'is-complete' : ''} is-${h.rareza}">
    <div class="points-milestone__top"><span class="points-milestone__seal"><i data-lucide="${esc(h.icono)}" class="i"></i></span><span class="points-milestone__rarity">${h.rareza === 'elite' ? 'Élite' : h.rareza === 'distinguido' ? 'Distinguido' : 'Esencial'}</span></div>
    <h3>${esc(h.nombre)}</h3><p>${esc(h.descripcion)}</p>
    <div class="points-milestone__progress"><span><i style="width:${h.porcentaje}%"></i></span><strong>${h.progreso}/${h.meta}</strong></div>
    <footer><span><i data-lucide="gem" class="i"></i>+${h.premio.toLocaleString('es-MX')} puntos</span>${h.completado ? '<strong><i data-lucide="circle-check-big" class="i"></i>Conseguido</strong>' : `<small>${h.porcentaje}%</small>`}</footer>
  </article>`;
}

function selloColeccion(c: ColeccionPuntos): string {
  return `<article class="points-collection ${c.completado ? 'is-complete' : ''}">
    <div class="points-collection__ring" style="--progress:${c.porcentaje * 3.6}deg"><span><i data-lucide="${esc(c.icono)}" class="i"></i></span></div>
    <div><small>${c.completado ? 'Colección completada' : `${c.progreso} de ${c.meta} piezas`}</small><h3>${esc(c.nombre)}</h3><p>${esc(c.descripcion)}</p></div>
  </article>`;
}

export async function paginaRecompensas(): Promise<string> {
  const panel = await cargarPanelPuntos();
  const p = panel.puntos;
  const listas = panel.recompensas.filter((r) => r.disponible && r.completado && !r.canjeado).length;
  const materiales = panel.boutique.filter((b) => b.categoria === 'material');
  const vip = panel.boutique.filter((b) => b.categoria === 'vip');
  const canjesMaterial = panel.canjes.filter((c) => c.categoria === 'material').length;
  const hitosCompletados = panel.hitos.filter((h) => h.completado).length;
  const o = panel.objetivo;

  return `<section class="points-page" data-rew-page>
    <header class="points-hero">
      <div class="points-hero__content">
        <span class="points-hero__eyebrow"><i data-lucide="gem" class="i"></i>Puntos Dermalysse</span>
        <h1>Tu aprendizaje ahora <em>vale más.</em></h1>
        <p>Aprende, practica y completa rutas verificadas. Tus puntos se convierten en materiales permanentes y días VIP reales.</p>
        <div class="points-hero__trust"><span><i data-lucide="shield-check" class="i"></i>Validado por servidor</span><span><i data-lucide="infinity" class="i"></i>Materiales permanentes</span><span><i data-lucide="history" class="i"></i>Movimientos transparentes</span></div>
      </div>
      <div class="points-wallet">
        <span class="points-wallet__label">Saldo disponible</span>
        <strong>${p.saldo.toLocaleString('es-MX')}</strong>
        <span class="points-wallet__unit">Puntos Dermalysse</span>
        <a href="#boutique" class="btn points-wallet__cta"><i data-lucide="shopping-bag" class="i"></i>Explorar beneficios</a>
      </div>
    </header>

    <section class="points-status" aria-label="Tu nivel Dermalysse">
      <div class="points-status__level"><span class="points-status__seal"><i data-lucide="badge-check" class="i"></i></span><div><small>Tu nivel</small><h2>${esc(p.nivel.nombre)}</h2><p>${esc(p.nivel.descripcion)}</p></div></div>
      <div class="points-status__progress"><div><span>Progreso de nivel</span><strong>${p.puntosSiguienteNivel === null ? 'Nivel máximo' : `${p.puntosSiguienteNivel.toLocaleString('es-MX')} pts para subir`}</strong></div><div class="points-status__track"><span style="width:${p.progresoNivel}%"></span></div><small>Tu nivel reconoce constancia dentro del club; no sustituye una acreditación profesional.</small></div>
      <div class="points-status__stats"><div><strong>${p.experiencia.toLocaleString('es-MX')}</strong><span>experiencia total</span></div><div><strong>${panel.canjes.length}</strong><span>canjes realizados</span></div><div><strong>${canjesMaterial}</strong><span>materiales tuyos</span></div></div>
    </section>

    <section class="points-metrics" aria-label="Tu pasaporte de actividad">
      <div><span><i data-lucide="play-circle" class="i"></i></span><strong>${p.metricas.clases}</strong><small>clases acreditadas</small></div>
      <div><span><i data-lucide="book-check" class="i"></i></span><strong>${p.metricas.cursos}</strong><small>cursos completos</small></div>
      <div><span><i data-lucide="award" class="i"></i></span><strong>${p.metricas.certificados}</strong><small>certificados válidos</small></div>
      <div><span><i data-lucide="brain-circuit" class="i"></i></span><strong>${p.metricas.xpRetos.toLocaleString('es-MX')}</strong><small>XP verificados</small></div>
    </section>

    ${o ? `<section class="points-next ${o.faltan === 0 ? 'is-ready' : ''}">
      <div class="points-next__icon"><i data-lucide="target" class="i"></i></div>
      <div class="points-next__copy"><span>Próximo objetivo recomendado</span><h2>${esc(o.nombre)}</h2><p>${o.faltan === 0 ? 'Ya tienes el saldo necesario. Tu beneficio está listo para canjear.' : `Te faltan ${o.faltan.toLocaleString('es-MX')} puntos: equivale a ${o.clasesEquivalentes} clases o aproximadamente ${o.cursosEquivalentes} cursos completos.`}</p></div>
      <div class="points-next__meter"><div><span style="width:${o.porcentaje}%"></span></div><strong>${o.porcentaje}%</strong><a href="#boutique">${o.faltan === 0 ? 'Canjear ahora' : 'Ver boutique'} <i data-lucide="arrow-right" class="i"></i></a></div>
    </section>` : ''}

    ${listas ? `<div class="rew-alert"><i data-lucide="party-popper" class="i"></i><strong>Tienes ${listas} recompensa${listas > 1 ? 's' : ''} VIP lista${listas > 1 ? 's' : ''}.</strong> Puedes canjear${listas > 1 ? 'las' : 'la'} en la sección Metas VIP.</div>` : ''}

    <section class="points-earn">
      <div class="points-section-heading"><div><span class="eyebrow">Cómo crece tu saldo</span><h2>Gana puntos haciendo lo que ya te ayuda a avanzar</h2></div><p>La API acredita cada hito una sola vez. Repetir una acción no duplica puntos.</p></div>
      <div class="points-earn__grid">
        <article><span><i data-lucide="play-circle" class="i"></i></span><strong>+${p.reglas.clases}</strong><h3>Clase acreditada</h3><p>Al alcanzar el avance real requerido por el reproductor.</p></article>
        <article><span><i data-lucide="graduation-cap" class="i"></i></span><strong>+${p.reglas.cursos}</strong><h3>Curso completado</h3><p>Un bono adicional al cerrar todas sus clases.</p></article>
        <article><span><i data-lucide="award" class="i"></i></span><strong>+${p.reglas.certificados}</strong><h3>Certificado válido</h3><p>Solo cuando el servidor confirma su emisión.</p></article>
        <article><span><i data-lucide="gamepad-2" class="i"></i></span><strong>XP → puntos</strong><h3>Retos verificados</h3><p>${esc(p.reglas.retos)} en actividades calificadas por la API.</p></article>
        <article class="points-earn__bonus"><span><i data-lucide="medal" class="i"></i></span><strong>+25 a +500</strong><h3>Bonos de Pasaporte</h3><p>Once hitos vitalicios entregan premios extra una sola vez.</p></article>
      </div>
    </section>

    <div data-tabs>
      <div class="points-tabs tabs">
      <button class="is-active" data-for="boutique"><i data-lucide="shopping-bag" class="i"></i>Boutique</button>
      <button data-for="pasaporte"><i data-lucide="stamp" class="i"></i>Pasaporte<span>${hitosCompletados}</span></button>
      <button data-for="metas"><i data-lucide="trophy" class="i"></i>Metas VIP${listas ? `<span>${listas}</span>` : ''}</button>
      <button data-for="actividad"><i data-lucide="history" class="i"></i>Mi actividad</button>
      </div>
      <section data-tab="boutique" id="boutique" class="points-tab-panel">
        <div class="points-section-heading"><div><span class="eyebrow">Boutique de Beneficios</span><h2>Elige en qué convertir tus puntos</h2></div><p>Los accesos a materiales son permanentes. Los días VIP tienen un límite responsable de 30 por año calendario.</p></div>
        <div class="points-shelf"><div class="points-shelf__title"><i data-lucide="library" class="i"></i><div><h3>Biblioteca permanente</h3><p>Canjea una vez y el material queda ligado a tu cuenta.</p></div></div><div class="points-benefits">${materiales.map((b) => tarjetaBeneficio(b, p.saldo)).join('')}</div></div>
        <div class="points-shelf points-shelf--vip">
          <div class="points-vip-quota"><span><i data-lucide="calendar-heart" class="i"></i></span><div><small>Cupo responsable ${panel.vipAnual.anio}</small><strong>${panel.vipAnual.disponibles} días VIP disponibles</strong><div><i style="width:${Math.round((panel.vipAnual.usados / panel.vipAnual.limite) * 100)}%"></i></div></div><em>${panel.vipAnual.usados}/${panel.vipAnual.limite} usados</em></div>
          <div class="points-shelf__title"><i data-lucide="crown" class="i"></i><div><h3>Días VIP</h3><p>Desde un pase de 24 horas hasta un mes; sin modificar ni cobrar tu suscripción.</p></div></div><div class="points-benefits points-benefits--vip">${vip.map((b) => tarjetaBeneficio(b, p.saldo)).join('')}</div></div>
      </section>
      <section data-tab="pasaporte" class="points-tab-panel" hidden>
        <div class="points-section-heading"><div><span class="eyebrow">Pasaporte Dermalysse</span><h2>Una trayectoria que se ve, se celebra y suma</h2></div><p>Cada sello nace de una métrica verificada. Los bonos se acreditan automáticamente una sola vez.</p></div>
        <div class="points-passport-summary"><div><i data-lucide="stamp" class="i"></i><span><strong>${hitosCompletados}/${panel.hitos.length}</strong><small>hitos conseguidos</small></span></div><p>Completa rutas de estudio, certifica tu avance y practica en Retos para construir un pasaporte único dentro del club.</p></div>
        <div class="points-milestones">${panel.hitos.map(tarjetaHito).join('')}</div>
        <div class="points-collections"><div class="points-collections__intro"><span class="eyebrow">Colecciones</span><h2>Tu biblioteca también cuenta una historia</h2><p>Cada material permanente llena tu archivo personal y desbloquea nuevos sellos de colección.</p></div><div class="points-collections__grid">${panel.colecciones.map(selloColeccion).join('')}</div></div>
      </section>
      <section data-tab="metas" class="points-tab-panel" hidden>
        <div class="points-section-heading"><div><span class="eyebrow">Logros con beneficio</span><h2>Metas VIP verificables</h2></div><p>Las metas pausadas conservan tu avance, pero no entregan valor hasta contar con validación segura.</p></div>
        <div class="rew-grid">${panel.recompensas.map(tarjetaMeta).join('')}</div>
        <div class="points-upcoming"><div class="points-upcoming__head"><span><i data-lucide="shield-check" class="i"></i></span><div><h3>Más formas de ganar, con reglas responsables</h3><p>Estamos preparando estas fuentes sin convertirlas en atajos manipulables.</p></div></div><div class="points-upcoming__grid">${panel.proximasFormasDeGanar.map((x) => `<article><span>${esc(x.estado)}</span><h4>${esc(x.nombre)}</h4><p>${esc(x.descripcion)}</p></article>`).join('')}</div></div>
      </section>
      <section data-tab="actividad" class="points-tab-panel" hidden>
        <div class="points-section-heading"><div><span class="eyebrow">Transparencia total</span><h2>Tu historial de puntos y canjes</h2></div><p>La experiencia nunca disminuye; únicamente el saldo cambia cuando eliges un beneficio.</p></div>
        <div class="points-activity-grid">
          <article class="points-ledger"><header><h3>Movimientos recientes</h3><span>${panel.movimientos.length}</span></header>${panel.movimientos.length ? `<ul>${panel.movimientos.map(movimiento).join('')}</ul>` : '<div class="points-empty"><i data-lucide="sparkles" class="i"></i><p>Completa tu primera actividad para comenzar.</p></div>'}</article>
          <article class="points-redemptions"><header><h3>Mis beneficios</h3><span>${panel.canjes.length}</span></header>${panel.canjes.length ? `<ul>${panel.canjes.map((c) => `<li><span><i data-lucide="${c.categoria === 'material' ? 'book-open' : 'crown'}" class="i"></i></span><div><strong>${esc(c.nombre)}</strong><small>${fecha(c.fecha)} · ${c.costo.toLocaleString('es-MX')} puntos${c.vigenciaHasta ? ` · VIP hasta ${fecha(c.vigenciaHasta)}` : ' · Acceso permanente'}</small></div></li>`).join('')}</ul>` : '<div class="points-empty"><i data-lucide="shopping-bag" class="i"></i><p>Tus canjes aparecerán aquí.</p></div>'}</article>
        </div>
      </section>
    </div>
  </section>`;
}
