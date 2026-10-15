// Anuncio de primera vez para el miembro gratuito: «Escoge tu curso gratis». Elegante, a pantalla
// completa, con el catálogo para elegir. La elección es PERMANENTE (confirma antes de guardar) y abre ese
// curso completo salvo la última clase; los demás quedan para VIP. Se puede posponer (explorar primero).
import { createIcons, icons } from 'lucide';
import { cursos } from '../core/catalogo';
import { esc } from './partials';
import { debeElegir, mostrarAnuncio, posponerAnuncio, elegirCurso } from '../core/curso-gratis';

let abierto = false;

const ic = (n: string) => `<i data-lucide="${n}" class="i" aria-hidden="true"></i>`;

function tarjeta(c: (typeof cursos)[number]) {
  return `<button type="button" class="acg-card" data-curso="${esc(c.id)}">
    <span class="acg-card__img"><img src="${esc(c.portada)}" alt="" loading="lazy"></span>
    <span class="acg-card__body">
      <span class="acg-card__area">${ic('sparkles')}${esc(c.area)}</span>
      <strong class="acg-card__titulo">${esc(c.titulo)}</strong>
      <span class="acg-card__meta">${ic('play-circle')}${c.clases.length} clases${c.nivel ? ` · ${esc(c.nivel)}` : ''}</span>
    </span>
    <span class="acg-card__pick">${ic('arrow-right')}<span>Elegir este</span></span>
  </button>`;
}

/** Abre el anuncio si corresponde (gratuito sin elegir y sin haberlo pospuesto). `forzar` lo abre siempre. */
export function abrirAnuncioCursoGratis(forzar = false): void {
  if (abierto) return;
  if (!forzar && !mostrarAnuncio()) return;
  if (!debeElegir()) return;
  abierto = true;

  const el = document.createElement('div');
  el.className = 'acg';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Escoge tu curso gratis');
  el.innerHTML = `
    <div class="acg__box">
      <button class="acg__x" aria-label="Explorar primero">${ic('x')}</button>
      <header class="acg__head">
        <span class="acg__badge">${ic('gift')} Un regalo de bienvenida</span>
        <h2 class="acg__title">Escoge tu <em>curso gratis</em></h2>
        <p class="acg__sub">Elige el curso que quieras y estúdialo <strong>completo, gratis</strong>. Solo la última clase es para miembros VIP. Tu elección queda fija, así que escoge el que más te interese.</p>
        <ol class="acg__pasos">
          <li>${ic('hand-pointer')}<span>Elige un curso</span></li>
          <li>${ic('book-open')}<span>Estúdialo casi completo</span></li>
          <li>${ic('crown')}<span>Hazte VIP para abrir todo</span></li>
        </ol>
      </header>
      <div class="acg__grid">${cursos.map(tarjeta).join('')}</div>
      <footer class="acg__foot">
        <button type="button" class="acg__despues">Explorar primero</button>
        <span class="acg__nota">${ic('info')} Podrás elegir después abriendo cualquier curso.</span>
      </footer>
    </div>`;
  document.body.appendChild(el);
  document.body.style.overflow = 'hidden';
  createIcons({ icons });

  const cerrar = (posponer: boolean) => {
    if (posponer) posponerAnuncio();
    abierto = false;
    document.body.style.overflow = '';
    el.remove();
  };
  el.querySelector('.acg__x')!.addEventListener('click', () => cerrar(true));
  el.querySelector('.acg__despues')!.addEventListener('click', () => cerrar(true));
  el.addEventListener('click', (e) => { if (e.target === el) cerrar(true); });
  document.addEventListener('keydown', function esc(ev) { if (ev.key === 'Escape') { cerrar(true); document.removeEventListener('keydown', esc); } });

  el.querySelectorAll<HTMLButtonElement>('[data-curso]').forEach((boton) => boton.addEventListener('click', async () => {
    const id = boton.dataset.curso!;
    const c = cursos.find((x) => x.id === id);
    if (!c) return;
    confirmarEleccion(el, c, () => cerrar(false));
  }));
}

/** Pide confirmar la elección de un curso gratis desde cualquier lugar (p. ej. la página del curso). */
export function pedirElegirCursoGratis(cursoId: string): void {
  const c = cursos.find((x) => x.id === cursoId);
  if (!c || !debeElegir()) return;
  const capa = document.createElement('div');
  capa.className = 'acg';
  capa.setAttribute('role', 'dialog');
  capa.setAttribute('aria-modal', 'true');
  document.body.appendChild(capa);
  document.body.style.overflow = 'hidden';
  const cerrar = () => { capa.remove(); document.body.style.overflow = ''; };
  capa.addEventListener('click', (e) => { if (e.target === capa) cerrar(); });
  confirmarEleccion(capa, c, cerrar);
}

function confirmarEleccion(raiz: HTMLElement, c: (typeof cursos)[number], alElegir: () => void): void {
  const conf = document.createElement('div');
  conf.className = 'acg-confirm';
  conf.innerHTML = `
    <div class="acg-confirm__box">
      <span class="acg-confirm__ic">${ic('gift')}</span>
      <h3>¿Elegir <em>${esc(c.titulo)}</em> como tu curso gratis?</h3>
      <p>Tendrás todas sus clases gratis excepto la última. Esta elección <strong>no se puede cambiar</strong>: los demás cursos quedarán solo para miembros VIP.</p>
      <div class="acg-confirm__acciones">
        <button type="button" class="btn btn--secondary" data-cancelar>Ver otros</button>
        <button type="button" class="btn btn--gradient" data-confirmar>${ic('check')} Sí, este es mío</button>
      </div>
      <p class="acg-confirm__estado" data-estado hidden></p>
    </div>`;
  raiz.appendChild(conf);
  createIcons({ icons });
  const quitar = () => conf.remove();
  conf.querySelector('[data-cancelar]')!.addEventListener('click', quitar);
  conf.addEventListener('click', (e) => { if (e.target === conf) quitar(); });
  const btn = conf.querySelector<HTMLButtonElement>('[data-confirmar]')!;
  const estado = conf.querySelector<HTMLElement>('[data-estado]')!;
  btn.addEventListener('click', async () => {
    btn.disabled = true; btn.textContent = 'Guardando…';
    const r = await elegirCurso(c.id);
    if (r.ok) {
      alElegir();
      location.hash = `#/curso/${c.id}`;
      location.reload();
    } else {
      estado.hidden = false;
      estado.textContent = r.mensaje || 'No se pudo guardar. Intenta de nuevo.';
      btn.disabled = false; btn.innerHTML = `${ic('check')} Sí, este es mío`;
      createIcons({ icons });
    }
  });
}
