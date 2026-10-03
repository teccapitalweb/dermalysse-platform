import { cursos } from '../core/catalogo';
import { Progreso } from '../core/progreso';
import { tarjetaCurso, encabezado, esc } from '../ui/partials';
import { Perfil } from '../core/perfil';
import { BRAND } from '../core/brand';
import { proximoEvento } from './envivo';
import { racha, puntos } from '../core/logros';
import { checklistHTML } from '../ui/checklist';
import { widgetNoticias } from '../ui/noticias';
import { tarjetaExperienciaHTML } from '../ui/experiencia';

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export async function inicio() {
  const reciente = Progreso.reciente();
  const enMarcha = Progreso.enMarcha();
  const completados = Progreso.completados();
  const vistas = Progreso.totalVistas();
  const r = racha();
  const pts = puntos();
  const ev = proximoEvento();
  const noticias = await widgetNoticias();
  const ckl = checklistHTML();

  let ctaCard: string;
  if (reciente) {
    const n = Progreso.siguiente(reciente);
    const clase = reciente.clases.find(k => k.n === n)!;
    const pct = Progreso.porcentaje(reciente);
    ctaCard = `
      <div class="dash-cta">
        <img class="dash-cta__bg" src="${reciente.portada}" alt="" loading="lazy">
        <div class="dash-cta__body">
          <span class="dash-cta__eyebrow"><i data-lucide="play" class="i"></i>Continúa donde te quedaste</span>
          <h2 class="dash-cta__title">${esc(reciente.titulo)}</h2>
          <p class="dash-cta__meta">Clase ${n} de ${reciente.clases.length} · ${esc(clase.titulo)}</p>
          <div class="dash-cta__bar"><div class="progress"><span style="width:${pct}%"></span></div><span class="mono">${pct}%</span></div>
          <div class="dash-cta__actions">
            <a class="btn btn--white btn--sm btn--pill-arrow" href="#/curso/${reciente.id}/clase/${n}">Continuar clase <span class="arrow"><i data-lucide="play" class="i"></i></span></a>
            <a class="dash-cta__link" href="#/cursos">Ver todos los cursos <i data-lucide="arrow-right" class="i"></i></a>
          </div>
        </div>
      </div>`;
  } else {
    const primero = cursos[0];
    ctaCard = `
      <div class="dash-cta dash-cta--welcome">
        <img class="dash-cta__bg" src="${primero.portada}" alt="" loading="lazy">
        <div class="dash-cta__body">
          <span class="dash-cta__eyebrow"><i data-lucide="sparkles" class="i"></i>Tu primera clase te espera</span>
          <h2 class="dash-cta__title">${esc(primero.titulo)}</h2>
          <p class="dash-cta__meta">${cursos.length} cursos para fortalecer conocimientos y criterio</p>
          <div class="dash-cta__actions">
            <a class="btn btn--white btn--sm btn--pill-arrow" href="#/curso/${primero.id}/clase/1">Ver la primera clase <span class="arrow"><i data-lucide="play" class="i"></i></span></a>
            <a class="dash-cta__link" href="#/cursos">Explorar el catálogo <i data-lucide="arrow-right" class="i"></i></a>
          </div>
        </div>
      </div>`;
  }

  const diasLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const diasHTML = r.dias.map((activo, i) =>
    `<span class="dash-dia${activo ? ' is-active' : ''}">${diasLabels[i]}</span>`
  ).join('');

  const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

  const recomendados = cursos.filter(c => !Progreso.completado(c) && Progreso.porcentaje(c) === 0)
    .sort((a, b) => (reciente && a.area === reciente.area ? -1 : 0) - (reciente && b.area === reciente.area ? -1 : 0)).slice(0, 4);

  return `
  <section class="dash">
    <div class="dash-greeting">
      <div>
        <h1 class="dash-greeting__hello">${saludo()}, <strong>${esc(Perfil.tratamiento())}</strong></h1>
      </div>
      <div class="dash-greeting__pills">
        ${r.semanas > 0 ? `<a class="dash-pill dash-pill--streak" href="#/logros"><i data-lucide="flame" class="i"></i>${r.semanas} sem</a>` : ''}
        <a class="dash-pill" href="#/logros"><i data-lucide="zap" class="i"></i>${pts} pts</a>
      </div>
    </div>

    ${tarjetaExperienciaHTML()}

    ${ctaCard}

    <div class="dash-stats">
      <div class="dash-stat">
        <i data-lucide="graduation-cap" class="i dash-stat__icon"></i>
        <span class="dash-stat__val">${completados.length}<small>/${cursos.length}</small></span>
        <span class="dash-stat__label">Cursos completados</span>
      </div>
      <div class="dash-stat">
        <i data-lucide="play-circle" class="i dash-stat__icon"></i>
        <span class="dash-stat__val">${vistas}</span>
        <span class="dash-stat__label">Clases vistas</span>
      </div>
      <div class="dash-stat dash-stat--streak">
        <i data-lucide="flame" class="i dash-stat__icon dash-stat__icon--streak"></i>
        <span class="dash-stat__val">${r.semanas}</span>
        <span class="dash-stat__label">Racha (semanas)</span>
        <div class="dash-dias">${diasHTML}</div>
      </div>
      <div class="dash-stat">
        <i data-lucide="trophy" class="i dash-stat__icon dash-stat__icon--gold"></i>
        <span class="dash-stat__val">${pts}</span>
        <span class="dash-stat__label">Puntos</span>
      </div>
    </div>

    <div class="dash-quick">
      <a class="dash-qlink" href="#/en-vivo">
        <span class="dash-qlink__icon dash-qlink__icon--live"><i data-lucide="radio" class="i"></i></span>
        <span>En vivo</span>
        ${ev ? `<span class="dash-qlink__tag">${fmtFecha(ev.fecha)}</span>` : ''}
      </a>
      <a class="dash-qlink" href="${BRAND.canalWhatsApp || '#/comunidad'}"${BRAND.canalWhatsApp ? ' target="_blank" rel="noopener"' : ''}>
        <span class="dash-qlink__icon dash-qlink__icon--wa"><i data-lucide="message-circle" class="i"></i></span>
        <span>Comunidad</span>
      </a>
      <a class="dash-qlink" href="#/materiales">
        <span class="dash-qlink__icon"><i data-lucide="book-open" class="i"></i></span>
        <span>Biblioteca</span>
      </a>
      <a class="dash-qlink" href="#/logros">
        <span class="dash-qlink__icon dash-qlink__icon--gold"><i data-lucide="trophy" class="i"></i></span>
        <span>Logros</span>
      </a>
      <a class="dash-qlink" href="#/recompensas">
        <span class="dash-qlink__icon dash-qlink__icon--gift"><i data-lucide="gift" class="i"></i></span>
        <span>Recompensas</span>
      </a>
    </div>
  </section>

  ${ckl}

  ${enMarcha.length ? `
  <section class="stack" style="gap:20px">
    ${encabezado('En marcha', 'Tus cursos <em>en progreso</em>', `<a class="section-head__cta" href="#/cursos?tab=marcha">Ver todos <span class="circle-btn"><i data-lucide="arrow-up-right" class="i"></i></span></a>`)}
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">${enMarcha.slice(0, 4).map(tarjetaCurso).join('')}</div>
  </section>` : ''}

  <section class="stack" style="gap:20px">
    ${noticias}
  </section>

  <section class="stack" style="gap:20px">
    ${encabezado('Recomendado para ti', reciente ? `Sigue con <em>${esc(reciente.area.toLowerCase())}</em> y más` : 'Empieza por <em>aquí</em>', `<a class="section-head__cta" href="#/cursos">Ver los ${cursos.length} cursos <span class="circle-btn"><i data-lucide="arrow-up-right" class="i"></i></span></a>`)}
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">${recomendados.map(tarjetaCurso).join('')}</div>
  </section>`;
}
