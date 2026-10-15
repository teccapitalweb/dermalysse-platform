import { Progreso } from '../core/progreso';
import { type Curso, duracionCurso } from '../core/catalogo';
import { esMiCursoGratis, cursoAbierto, aplicaMetodologia, debeElegir } from '../core/curso-gratis';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const iniciales = (nombre: string) =>
  nombre.replace(/^(Dra?\.|Ing\.|Lic\.|Equipo)\s*/i, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'OT';

export function tarjetaCurso(c: Curso) {
  const p = Progreso.porcentaje(c);
  const done = Progreso.completado(c);
  // Metodología «escoge tu curso gratis»: para el gratuito, su curso elegido se abre; los demás se cierran.
  const miGratis = esMiCursoGratis(c.id);
  const bloqueado = aplicaMetodologia() && !cursoAbierto(c.id);
  const porElegir = debeElegir();
  const chip = miGratis
    ? `<span class="chip chip--accent"><i data-lucide="unlock" class="i"></i>Tu curso gratis</span>`
    : bloqueado
      ? `<span class="chip chip--outline"><i data-lucide="crown" class="i"></i>VIP</span>`
      : done
        ? `<span class="chip chip--accent"><i data-lucide="check" class="i"></i>Completado</span>`
        : p > 0 ? `<span class="chip chip--primary">${p}%</span>`
        : porElegir ? `<span class="chip chip--primary"><i data-lucide="gift" class="i"></i>Elígelo gratis</span>`
        : `<span class="chip chip--outline">${c.area}</span>`;
  const btnLabel = bloqueado ? 'Solo VIP' : porElegir ? 'Elegir gratis' : done ? 'Repasar' : p > 0 ? 'Continuar' : 'Ver curso';
  return `
  <a class="pcard ${bloqueado ? 'pcard--bloqueado' : ''} ${porElegir ? 'pcard--elegible' : ''}" href="#/curso/${c.id}">
    <div class="pcard__img-wrap">
      <img class="pcard__img" src="${c.portada}" alt="" loading="lazy">
      <div class="pcard__badge">${chip}</div>
      ${bloqueado ? `<span class="pcard__lock" aria-hidden="true"><i data-lucide="lock" class="i"></i></span>` : ''}
    </div>
    <div class="pcard__body">
      <div class="pcard__top-row">
        <span class="pcard__level"><i data-lucide="bar-chart-2" class="i"></i>${c.nivel}</span>
        <span class="pcard__dur"><i data-lucide="clock" class="i"></i>${meta(c)}</span>
      </div>
      <h3 class="pcard__title">${esc(c.titulo)}</h3>
      ${p > 0 && !done ? `<div class="progress progress--thin"><span style="width:${p}%"></span></div>` : ''}
      <div class="pcard__foot">
        <span class="pcard__who">${c.instructor.startsWith('Equipo') ? `<img class="avatar" src="/brand/dermalysse-isotipo.svg" alt="">` : `<span class="avatar">${iniciales(c.instructor)}</span>`}${esc(c.instructor)}</span>
        <span class="pcard__action">${btnLabel} <i data-lucide="arrow-right" class="i"></i></span>
      </div>
    </div>
  </a>`;
}

export function encabezado(chip: string, titulo: string, cta = '') {
  return `<div class="section-head"><div><span class="chip chip--primary">${chip}</span><h2 class="display">${titulo}</h2></div>${cta}</div>`;
}

export function placeholder(titulo: string, texto: string, icon = 'construction') {
  return `<section class="card card--pad" style="text-align:center;padding:64px 24px;display:grid;gap:12px;justify-items:center">
    <span class="circle-btn" style="width:56px;height:56px;background:var(--primary-soft);color:var(--primary)"><i data-lucide="${icon}" class="i" style="width:24px;height:24px"></i></span>
    <h1 class="display" style="font-size:var(--fs-xl)">${titulo}</h1>
    <p class="muted" style="max-width:48ch">${texto}</p>
    <a class="btn btn--brand" href="#/cursos">Ir a cursos</a>
  </section>`;
}

export const meta = (c: Curso) => `${c.clases.length} clases · ${duracionCurso(c)}`;
