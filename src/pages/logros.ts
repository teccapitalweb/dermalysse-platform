import { logros, racha, puntos, type Logro } from '../core/logros';
import { Progreso } from '../core/progreso';
import { cursos } from '../core/catalogo';
import { esc } from '../ui/partials';
import { sonidoLogrosActivo } from '../ui/logro-desbloqueado';

const porcentajeLogro = (logro: Logro) => Math.min(100, Math.round((logro.actual / Math.max(1, logro.meta)) * 100));

function nivelDe(puntosActuales: number) {
  if (puntosActuales < 100) return { nombre: 'Aprendiz', desde: 0, hasta: 100, icono: 'sprout' };
  if (puntosActuales < 400) return { nombre: 'Practicante', desde: 100, hasta: 400, icono: 'shield' };
  if (puntosActuales < 1000) return { nombre: 'Especialista', desde: 400, hasta: 1000, icono: 'gem' };
  return { nombre: 'Maestro', desde: 1000, hasta: null, icono: 'crown' };
}

function tarjetaLogro(logro: Logro) {
  const pct = porcentajeLogro(logro);
  return `<article class="achievement-card ${logro.ok ? 'is-unlocked' : 'is-locked'}" data-achievement="${esc(logro.id)}">
    <div class="achievement-card__top">
      <div class="achievement-medallion achievement-medallion--${esc(logro.rareza.toLowerCase())}">
        <i data-lucide="${esc(logro.icon)}" class="i"></i>
        ${logro.ok ? '<span><i data-lucide="check" class="i"></i></span>' : '<span><i data-lucide="lock-keyhole" class="i"></i></span>'}
      </div>
      <span class="achievement-card__rarity">${esc(logro.rareza)}</span>
    </div>
    <div class="achievement-card__copy">
      <span>${esc(logro.cat)}</span>
      <h3>${esc(logro.titulo)}</h3>
      <p>${esc(logro.desc)}</p>
    </div>
    <div class="achievement-card__progress" aria-label="Progreso ${esc(logro.progreso)}">
      <div><span style="width:${pct}%"></span></div>
      <strong>${logro.ok ? 'Desbloqueado' : esc(logro.progreso)}</strong>
    </div>
  </article>`;
}

export function paginaLogros() {
  const coleccion = logros();
  const r = racha();
  const p = puntos();
  const desbloqueados = coleccion.filter((logro) => logro.ok);
  const pendientes = coleccion.filter((logro) => !logro.ok).sort((a, b) => porcentajeLogro(b) - porcentajeLogro(a));
  const siguiente = pendientes[0];
  const ultimo = [...desbloqueados].reverse()[0];
  const cats = [...new Set(coleccion.map((logro) => logro.cat))];
  const nivel = nivelDe(p);
  const progresoNivel = nivel.hasta === null ? 100 : Math.min(100, Math.round(((p - nivel.desde) / (nivel.hasta - nivel.desde)) * 100));
  const faltanNivel = nivel.hasta === null ? 0 : Math.max(0, nivel.hasta - p);
  const progresoColeccion = Math.round((desbloqueados.length / Math.max(1, coleccion.length)) * 100);
  const sonido = sonidoLogrosActivo();

  return `<section class="achievements-page">
    <header class="achievements-head">
      <div>
        <span class="achievements-kicker"><i data-lucide="sparkles" class="i"></i>Sala de logros</span>
        <h1>Tu constancia deja <em>huella.</em></h1>
        <p>Cada insignia nace de tu avance real en clases, cursos y comunidad.</p>
      </div>
      <button class="achievement-sound" type="button" data-logros-sonido aria-pressed="${sonido}" title="${sonido ? 'Silenciar anuncios de logros' : 'Activar anuncios de logros'}">
        <span><i data-lucide="${sonido ? 'volume-2' : 'volume-x'}" class="i"></i></span>
        <small>Sonido de logros</small>
        <strong>${sonido ? 'Activado' : 'Silenciado'}</strong>
      </button>
    </header>

    <section class="achievements-hero">
      <div class="achievements-hero__ambient"></div>
      <div class="achievements-hero__main">
        <span class="achievements-hero__eyebrow"><i data-lucide="${esc(nivel.icono)}" class="i"></i>Nivel actual · ${esc(nivel.nombre)}</span>
        <div class="achievements-hero__score"><strong>${p.toLocaleString('es-MX')}</strong><span>puntos de trayectoria</span></div>
        <div class="achievements-level">
          <div class="achievements-level__labels"><span>${esc(nivel.nombre)}</span><strong>${nivel.hasta === null ? 'Nivel máximo' : `${faltanNivel} pts para avanzar`}</strong></div>
          <div class="achievements-level__track"><span style="width:${progresoNivel}%"></span></div>
        </div>
        <p class="achievements-hero__rule">10 puntos por clase · 50 por curso · 5 por tema publicado</p>
      </div>
      <div class="achievements-hero__seal" style="--achievement-progress:${progresoColeccion}"><div><i data-lucide="trophy" class="i"></i><strong>${desbloqueados.length}<span>/${coleccion.length}</span></strong><small>insignias</small></div></div>
      <div class="achievements-next">
        ${siguiente ? `<span class="achievements-next__label">Siguiente desbloqueo</span>
          <div class="achievements-next__title"><span><i data-lucide="${esc(siguiente.icon)}" class="i"></i></span><div><small>${esc(siguiente.cat)}</small><strong>${esc(siguiente.titulo)}</strong></div></div>
          <p>${esc(siguiente.desc)}</p><div class="achievements-next__progress"><div><span style="width:${porcentajeLogro(siguiente)}%"></span></div><b>${esc(siguiente.progreso)}</b></div>`
          : `<span class="achievements-next__label">Colección completa</span><div class="achievements-next__title"><span><i data-lucide="crown" class="i"></i></span><div><small>Maestría</small><strong>Todos los logros desbloqueados</strong></div></div><p>Tu recorrido actual está completo. Las nuevas metas aparecerán aquí.</p>`}
      </div>
    </section>

    <section class="achievements-stats" aria-label="Resumen de trayectoria">
      <div><span><i data-lucide="flame" class="i"></i></span><p><strong>${r.semanas}</strong><small>semanas de racha</small></p></div>
      <div><span><i data-lucide="circle-play" class="i"></i></span><p><strong>${Progreso.totalVistas()}</strong><small>clases vistas</small></p></div>
      <div><span><i data-lucide="graduation-cap" class="i"></i></span><p><strong>${Progreso.completados().length}<em>/${cursos.length}</em></strong><small>cursos completados</small></p></div>
      <div class="achievements-week"><p><strong>Esta semana</strong><small>${r.activaEstaSemana ? 'Racha activa' : 'Aún puedes comenzar'}</small></p><div>${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((dia, i) => `<span class="${r.dias[i] ? 'is-on' : ''}">${dia}</span>`).join('')}</div></div>
    </section>

    ${ultimo ? `<section class="achievement-spotlight"><div class="achievement-spotlight__icon"><i data-lucide="${esc(ultimo.icon)}" class="i"></i></div><div><span>En tu vitrina</span><h2>${esc(ultimo.titulo)}</h2><p>${esc(ultimo.desc)}</p></div><span class="achievement-spotlight__status"><i data-lucide="badge-check" class="i"></i>Conseguido</span></section>` : ''}

    <section class="achievements-collection">
      <div class="achievements-collection__head"><div><span>Tu colección</span><h2>Insignias de trayectoria</h2><p>Las bloqueadas muestran exactamente cuánto te falta; no hay avances simulados.</p></div><strong>${progresoColeccion}% completado</strong></div>
      ${cats.map((cat) => `<section class="achievement-category"><header><h3>${esc(cat)}</h3><span>${coleccion.filter((logro) => logro.cat === cat && logro.ok).length}/${coleccion.filter((logro) => logro.cat === cat).length}</span></header><div class="achievements-grid">${coleccion.filter((logro) => logro.cat === cat).map(tarjetaLogro).join('')}</div></section>`).join('')}
    </section>
  </section>`;
}
