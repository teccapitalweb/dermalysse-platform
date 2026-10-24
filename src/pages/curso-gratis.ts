// Módulo «Escoge tu curso gratis»: página dedicada en #/curso-gratis (antes era un overlay flotante
// posponible, por el que los miembros se lo saltaban). El miembro gratuito elige UN curso; la elección
// es PERMANENTE (confirma antes de guardar). Al gratuito sin elegir se le lleva aquí (ver src/main.ts).
import { createIcons, icons } from 'lucide';
import { cursos } from '../core/catalogo';
import { esc } from '../ui/partials';
import { debeElegir, cursoGratisElegido, elegirCurso } from '../core/curso-gratis';

const ic = (n: string) => `<i data-lucide="${n}" class="i" aria-hidden="true"></i>`;

function tarjeta(c: (typeof cursos)[number]) {
  return `<button type="button" class="acg-card" data-cg-elegir="${esc(c.id)}">
    <span class="acg-card__img"><img src="${esc(c.portada)}" alt="" loading="lazy"></span>
    <span class="acg-card__body">
      <span class="acg-card__area">${ic('sparkles')}${esc(c.area)}</span>
      <strong class="acg-card__titulo">${esc(c.titulo)}</strong>
      <span class="acg-card__meta">${ic('play-circle')}${c.clases.length} clases${c.nivel ? ` · ${esc(c.nivel)}` : ''}</span>
    </span>
    <span class="acg-card__pick">${ic('arrow-right')}<span>Elegir este</span></span>
  </button>`;
}

export function paginaCursoGratis(): string {
  // Ya eligió (o VIP/admin): no se le obliga; se confirma su elección o se le invita a los cursos.
  if (!debeElegir()) {
    const elegido = cursoGratisElegido();
    const c = elegido ? cursos.find((x) => x.id === elegido) : null;
    return `<section class="acg acg--pagina"><div class="acg__box acg__box--hecho">
      <span class="acg__badge">${ic('gift')} Tu curso de bienvenida</span>
      <h2 class="acg__title">${c ? `Elegiste <em>${esc(c.titulo)}</em>` : 'Ya tienes acceso a los cursos'}</h2>
      <p class="acg__sub">${c ? 'Tienes todas sus clases gratis excepto la última. Hazte VIP para abrir todos los cursos.' : 'Tu cuenta tiene acceso a todo el catálogo.'}</p>
      <a class="btn btn--brand" href="${c ? `#/curso/${esc(c.id)}` : '#/cursos'}">${ic('book-open')}${c ? 'Ir a mi curso' : 'Ver cursos'}</a>
    </div></section>`;
  }
  return `<section class="acg acg--pagina"><div class="acg__box">
    <header class="acg__head">
      <div class="acg__guide"><img src="/media/dermalysse-guia-lia-v1.png" alt=""><span><strong>Lía</strong><small>Tu guía Dermalysse</small></span></div>
      <span class="acg__badge">${ic('gift')} Un regalo de bienvenida</span>
      <h2 class="acg__title">Elige tu <em>curso de bienvenida</em></h2>
      <p class="acg__sub">Escoge un curso del catálogo para empezar tu ruta. Podrás estudiar sus clases disponibles para miembros gratuitos; la última clase requiere VIP. Tu elección es permanente y la confirmarás antes de guardarla.</p>
      <ol class="acg__pasos">
        <li>${ic('hand-pointer')}<span>Elige un curso</span></li>
        <li>${ic('book-open')}<span>Estúdialo casi completo</span></li>
        <li>${ic('crown')}<span>Hazte VIP para abrir todo</span></li>
      </ol>
    </header>
    <div class="acg__grid">${cursos.map(tarjeta).join('')}</div>
    <footer class="acg__foot">
      <span class="acg__nota">${ic('info')} Tómate tu tiempo: abre cualquier curso para conocerlo antes de decidir.</span>
    </footer>
  </div></section>`;
}

/**
 * Confirmación PERMANENTE antes de guardar la elección. Se dispara al tocar una tarjeta del módulo.
 * En éxito, guarda y lleva al curso elegido.
 */
export function confirmarCursoGratis(
  cursoId: string,
  toast: (mensaje: string, icono?: string) => void,
  navigate: (ruta: string) => void,
): void {
  const c = cursos.find((x) => x.id === cursoId);
  if (!c || !debeElegir()) return;
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
  document.body.appendChild(conf);
  document.body.style.overflow = 'hidden';
  createIcons({ icons });
  const quitar = () => { conf.remove(); document.body.style.overflow = ''; };
  conf.querySelector('[data-cancelar]')!.addEventListener('click', quitar);
  conf.addEventListener('click', (e) => { if (e.target === conf) quitar(); });
  const btn = conf.querySelector<HTMLButtonElement>('[data-confirmar]')!;
  const estado = conf.querySelector<HTMLElement>('[data-estado]')!;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    const r = await elegirCurso(c.id);
    if (r.ok) {
      quitar();
      toast('¡Listo! Este es tu curso de bienvenida.', 'gift');
      navigate(`/curso/${c.id}`);
    } else {
      estado.hidden = false;
      estado.textContent = r.mensaje || 'No se pudo guardar. Intenta de nuevo.';
      btn.disabled = false;
      btn.innerHTML = `${ic('check')} Sí, este es mío`;
      createIcons({ icons });
    }
  });
}
