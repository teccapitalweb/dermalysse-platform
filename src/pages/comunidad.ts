import { Comunidad, hace, type Hilo } from '../core/comunidad';
import { cursos, curso as getCurso } from '../core/catalogo';
import { BRAND, wa } from '../core/brand';
import { Datos } from '../core/datos';
import { Perfil } from '../core/perfil';
import { iniciales, esc, placeholder } from '../ui/partials';

// Paleta por área para dar lectura visual rápida en chips, rings y acentos.
const COLOR_AREA: Record<string, string> = {
  'Cosmiatría': '#8e4466',
  'Estética facial': '#c76a7a',
  'Cosmetología': '#b58a63',
  'Estética corporal': '#4a7fc1',
  'Nutrición': '#4fa899',
  'Regulación': '#5c6b8a',
  'General': '#681c31',
};
// Wash pastel muy sutil por área (solo da un tinte apenas perceptible).
const WASH_AREA: Record<string, string> = {
  'Cosmiatría': '#fbf5f8',
  'Estética facial': '#fdf4f4',
  'Cosmetología': '#faf6ef',
  'Estética corporal': '#f3f6fc',
  'Nutrición': '#f1f8f6',
  'Regulación': '#f5f6fa',
  'General': '#faf5f6',
};
const colorArea = (area: string) => COLOR_AREA[area] || '#681c31';
const washArea = (area: string) => WASH_AREA[area] || '#faf5f6';

function tarjetaHilo(h: Hilo) {
  const c = h.cursoId ? getCurso(h.cursoId) : null;
  const area = c?.area || 'General';
  const color = colorArea(area);
  const wash = washArea(area);
  const reciente = (Date.now() - new Date(h.fecha).getTime()) < 1000 * 60 * 60 * 48;
  const respondedores = [...new Map(h.respuestas.map((r) => [r.autor, r])).values()];
  const primerRespondedor = respondedores[0];
  const imagen = c?.portada || null;

  return `
  <article class="post" style="--area:${color};--wash:${wash}">
    <header class="post__head">
      <a class="post__who" href="#/comunidad/${h.id}">
        <span class="avatar post__avatar">${iniciales(h.autor)}</span>
        <span class="post__meta">
          <strong>${esc(h.autor)}</strong>
          <small>${reciente ? '<span class="post__dot" aria-hidden="true"></span>' : ''}${hace(h.fecha)} · <span class="post__area">${esc(area)}</span></small>
        </span>
      </a>
      <button type="button" class="post__menu" aria-label="Más opciones" tabindex="-1"><i data-lucide="more-horizontal" class="i"></i></button>
    </header>

    ${imagen ? `
    <a class="post__media" href="#/comunidad/${h.id}" aria-label="Abrir ${esc(h.titulo)}">
      <img src="${esc(imagen)}" alt="" loading="lazy">
      ${c ? `<span class="post__media-tag">${esc(c.titulo)}</span>` : ''}
    </a>` : `
    <a class="post__media post__media--text" href="#/comunidad/${h.id}" aria-label="Abrir ${esc(h.titulo)}">
      <div class="post__media-glyph" aria-hidden="true">
        <svg viewBox="0 0 120 120"><circle cx="40" cy="60" r="22" fill="currentColor" opacity=".32"/><circle cx="78" cy="48" r="14" fill="currentColor" opacity=".52"/><circle cx="86" cy="78" r="18" fill="currentColor" opacity=".22"/></svg>
      </div>
      <span class="post__media-text">${esc(h.titulo)}</span>
    </a>`}

    <div class="post__actions">
      <button type="button" class="post__action post__action--like" data-util="${h.id}" aria-label="Me resultó útil">
        <i data-lucide="heart" class="i"></i>
      </button>
      <a class="post__action" href="#/comunidad/${h.id}" aria-label="Comentar">
        <i data-lucide="message-circle" class="i"></i>
      </a>
      <a class="post__action" href="#/comunidad/${h.id}" aria-label="Compartir">
        <i data-lucide="send" class="i"></i>
      </a>
      <button type="button" class="post__action post__action--save" aria-label="Guardar" tabindex="-1">
        <i data-lucide="bookmark" class="i"></i>
      </button>
    </div>

    <div class="post__likes">
      ${primerRespondedor ? `<span class="avatar post__likes-avatar">${iniciales(primerRespondedor.autor)}</span>` : ''}
      ${h.util > 0
        ? `<small><strong>${esc(primerRespondedor?.autor || 'Colegas del club')}</strong> y <strong>${h.util} colegas</strong> lo encontraron útil</small>`
        : `<small>Sé la primera persona en marcar útil</small>`}
    </div>

    <div class="post__caption">
      <a href="#/comunidad/${h.id}"><strong>${esc(h.titulo)}</strong></a>
      <p>${esc(h.texto)}</p>
    </div>

    <a class="post__comments" href="#/comunidad/${h.id}">
      ${h.respuestasTotal > 0
        ? `Ver las <strong>${h.respuestasTotal}</strong> ${h.respuestasTotal === 1 ? 'respuesta' : 'respuestas'}`
        : 'Sé la primera voz en responder'}
    </a>
  </article>`;
}

// Top voces de la última semana — ordenadas por aportes, cursos no cuentan aquí.
function vocesSemana(hilos: Hilo[]): { nombre: string; aportes: number; util: number; ultimo: string }[] {
  const map = new Map<string, { nombre: string; aportes: number; util: number; ultimo: string }>();
  const semana = Date.now() - 7 * 86400000;
  const sumar = (nombre: string, util: number, fecha: string) => {
    const t = new Date(fecha).getTime();
    if (!Number.isFinite(t) || t < semana) return;
    const prev = map.get(nombre) || { nombre, aportes: 0, util: 0, ultimo: fecha };
    prev.aportes += 1;
    prev.util += util;
    if (fecha > prev.ultimo) prev.ultimo = fecha;
    map.set(nombre, prev);
  };
  hilos.forEach((h) => {
    sumar(h.autor, h.util, h.fecha);
    h.respuestas.forEach((r) => sumar(r.autor, 0, r.fecha));
  });
  return [...map.values()].sort((a, b) => b.aportes - a.aportes || b.util - a.util).slice(0, 4);
}

function cargando() {
  return `<div class="community-loading"><span></span><span></span><span></span></div>`;
}

export function comunidad(_: Record<string, string>, query: URLSearchParams) {
  const filtro = query.get('curso');
  const todos = Comunidad.hilos();
  const hilos = filtro ? Comunidad.hilos(filtro) : todos;
  const opciones = cursos.map((c) => `<option value="${c.id}">${esc(c.titulo)}</option>`).join('');
  const autores = new Set(todos.map((h) => h.autor)).size;
  const respuestas = todos.reduce((n, h) => n + h.respuestasTotal, 0);
  const utiles = todos.reduce((n, h) => n + h.util, 0);
  const siguienteEnVivo = Datos.eventos()
    .filter((e) => e.publicado !== false && new Date(e.fecha).getTime() > Date.now())
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())[0];
  const fechaEnVivo = siguienteEnVivo
    ? new Date(siguienteEnVivo.fecha).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
    : '';
  const voces = vocesSemana(todos);
  const normas = [
    { icon: 'eye', titulo: 'Observa primero', texto: 'Describe lo que ves antes de pedir una conclusión.' },
    { icon: 'file-text', titulo: 'Documenta sin exponer', texto: 'Comparte contexto profesional sin datos personales.' },
    { icon: 'users', titulo: 'Respeta el criterio ajeno', texto: 'Hay más de un camino profesional válido.' },
    { icon: 'shield-check', titulo: 'Deriva cuando toca', texto: 'Si el caso rebasa tu alcance, señálalo.' },
  ];
  return `
  <section class="community-page community-page--social">
    <div class="community-topbar">
      <div class="community-topbar__brand">
        <span class="community-topbar__kicker">Comunidad</span>
        <h1>Dermalysse</h1>
      </div>
      <div class="community-topbar__meta">
        <span><b>${autores || '—'}</b> aportando</span>
        <span><b>${respuestas}</b> respuestas</span>
        <span><b>${utiles}</b> útiles</span>
      </div>
      <button class="community-topbar__cta" type="button" data-nuevo-hilo>
        <i data-lucide="plus" class="i"></i>Publicar
      </button>
    </div>

    <form class="community-compose" data-form-hilo hidden>
      <div class="community-compose__head"><span class="community-compose__icon"><i data-lucide="notebook-pen" class="i"></i></span><div><h2>Comparte lo que estás aprendiendo</h2><p>El contexto correcto atrae mejores respuestas.</p></div></div>
      <label><span>Título del caso o duda</span><input class="input" name="titulo" placeholder="Ej. Bajó la postura después del cambio de temperatura" required maxlength="120"></label>
      <label><span>Contexto y observaciones</span><textarea class="input" name="texto" rows="5" placeholder="Especie, edad o etapa productiva, signos, cambios recientes y qué ya revisaste. Sin datos sensibles." required></textarea></label>
      <div class="community-compose__actions"><select class="input" name="cursoId"><option value="">Tema general</option>${opciones}</select><div><button type="button" class="btn btn--ghost" data-cancelar-hilo>Cancelar</button><button class="btn btn--brand"><i data-lucide="send" class="i"></i>Publicar caso</button></div></div>
    </form>

    ${voces.length ? `
    <section class="community-stories" aria-label="Voces activas esta semana">
      <button type="button" class="community-story community-story--new" data-nuevo-hilo>
        <span class="community-story__ring community-story__ring--new"><i data-lucide="plus" class="i"></i></span>
        <small>Publicar</small>
      </button>
      ${voces.slice(0, 8).map((v) => `
        <div class="community-story">
          <span class="community-story__ring"><span class="community-story__avatar">${iniciales(v.nombre)}</span></span>
          <small>${esc(v.nombre.split(' ')[0])}</small>
        </div>`).join('')}
    </section>` : ''}

    <div class="community-layout">
      <main class="community-feed">
        <nav class="community-filters" aria-label="Filtrar casos">
          <a class="community-filter ${!filtro ? 'is-active' : ''}" href="#/comunidad">Todos</a>
          ${cursos.filter((c) => Comunidad.hilos(c.id).length).map((c) => `<a class="community-filter ${filtro === c.id ? 'is-active' : ''}" href="#/comunidad?curso=${c.id}">${esc(c.area)}</a>`).join('')}
        </nav>
        <div class="community-list">${Comunidad.cargando() ? cargando() : hilos.length ? hilos.map(tarjetaHilo).join('') : '<div class="community-empty"><i data-lucide="messages-square" class="i"></i><h3>Aún no hay casos en esta categoría</h3><p>Comparte el primero y abre la conversación.</p><button class="btn btn--brand" data-nuevo-hilo>Nuevo caso</button></div>'}</div>
        <button class="community-quick" data-nuevo-hilo type="button">
          <span class="community-quick__avatar">${iniciales(Perfil.get().nombre || 'Tú')}</span>
          <span class="community-quick__input">Comparte un caso o pregunta…</span>
          <span class="community-quick__tools">
            <span class="community-quick__tool" aria-hidden="true"><i data-lucide="paperclip" class="i"></i></span>
            <span class="community-quick__tool" aria-hidden="true"><i data-lucide="image" class="i"></i></span>
            <span class="community-quick__tool" aria-hidden="true"><i data-lucide="hash" class="i"></i></span>
          </span>
          <span class="community-quick__send"><i data-lucide="send" class="i"></i>Publicar</span>
        </button>
      </main>

      <aside class="community-aside">
        <div class="community-side-card community-side-card--me">
          <div class="community-me__avatar">${iniciales(Perfil.get().nombre || 'Tú')}</div>
          <div class="community-me__info">
            <strong>${esc(Perfil.get().nombre || 'Modo demo')}</strong>
            <small>Miembro Dermalysse</small>
          </div>
          <a class="community-me__switch" href="#/perfil">Perfil</a>
        </div>

        ${siguienteEnVivo ? `
        <a class="community-side-card community-side-card--live" href="#/en-vivo">
          <div class="community-live-mini">
            <span class="community-live-mini__dot" aria-hidden="true"></span>
            <span class="community-live-mini__label">En vivo próximamente</span>
          </div>
          <h3>${esc(siguienteEnVivo.titulo)}</h3>
          <small>${esc(fechaEnVivo)}${siguienteEnVivo.ponente ? ` · ${esc(siguienteEnVivo.ponente)}` : ''}</small>
        </a>` : `
        <a class="community-side-card community-side-card--live" href="#/en-vivo">
          <div class="community-live-mini">
            <span class="community-live-mini__dot community-live-mini__dot--off" aria-hidden="true"></span>
            <span class="community-live-mini__label">Agenda de En vivo</span>
          </div>
          <h3>Próximas transmisiones</h3>
          <small>Reserva lugar cuando se publiquen los eventos.</small>
        </a>`}

        ${BRAND.canalWhatsApp ? `
        <a class="community-side-card community-side-card--wa" href="${BRAND.canalWhatsApp}" target="_blank" rel="noopener">
          <span class="community-side-card__icon"><i data-lucide="message-circle" class="i"></i></span>
          <div><strong>Dermalysse en WhatsApp</strong><small>Avisos sin ruido</small></div>
          <i data-lucide="arrow-up-right" class="i community-side-card__arrow"></i>
        </a>` : ''}

        <div class="community-side-card community-side-card--guide">
          <span class="eyebrow">Cómo participamos</span>
          <ul>
            ${normas.map((n) => `<li><span class="community-norma__icon"><i data-lucide="${n.icon}" class="i"></i></span><div><strong>${n.titulo}</strong><small>${n.texto}</small></div></li>`).join('')}
          </ul>
        </div>
        ${voces.length ? `
        <div class="community-side-card community-side-card--voices">
          <div class="community-side-head"><span class="eyebrow">Voces de la semana</span><span class="community-side-head__count">${voces.reduce((a, v) => a + v.aportes, 0)} aportes</span></div>
          <ul class="community-voices-list">
            ${voces.map((v) => `
              <li>
                <div class="avatar community-voices__avatar">${iniciales(v.nombre)}</div>
                <div class="community-voices__meta">
                  <strong>${esc(v.nombre)}</strong>
                  <small>${v.aportes} ${v.aportes === 1 ? 'aporte' : 'aportes'}${v.util ? ` · ${v.util} útiles` : ''}</small>
                </div>
                <button type="button" class="community-follow">Saludar</button>
              </li>`).join('')}
          </ul>
        </div>` : ''}

        <div class="community-side-card community-side-card--explore">
          <span class="eyebrow">Explora por tema</span>
          <div class="community-explore">
            ${cursos.length ? [...new Set(cursos.map((c) => c.area))].slice(0, 6).map((area) => {
              const n = Comunidad.hilos().filter((h) => {
                const c = h.cursoId ? getCurso(h.cursoId) : null;
                return c?.area === area;
              }).length;
              return `<a class="community-explore__item" href="#/comunidad${cursos.find((c) => c.area === area) ? `?curso=${cursos.find((c) => c.area === area)!.id}` : ''}" style="--wash:${washArea(area)};--c:${colorArea(area)}">
                <span class="community-explore__ic"></span>
                <strong>${esc(area)}</strong>
                <small>${n} ${n === 1 ? 'tema' : 'temas'}</small>
              </a>`;
            }).join('') : ''}
          </div>
        </div>
        <div class="community-side-card community-side-card--vip"><i data-lucide="badge-percent" class="i"></i><div><strong>${BRAND.descuentoVIP}% VIP</strong><span>en cursos en vivo</span></div><a href="${wa(`Hola Dermalysse, soy miembro VIP del club y quiero aplicar mi ${BRAND.descuentoVIP}% de descuento en un curso en vivo.`)}" target="_blank" rel="noopener">Solicitar</a></div>
      </aside>
    </div>
  </section>`;
}

export function hilo(params: Record<string, string>) {
  const h = Comunidad.hilo(params.id);
  if (!h && Comunidad.necesitaDetalle(params.id)) return `<section class="community-detail">${cargando()}</section>`;
  if (!h) return placeholder('Tema no encontrado', 'Puede que se haya borrado.', 'search-x');
  const c = h.cursoId ? getCurso(h.cursoId) : null;
  return `
  <section class="community-detail">
    <a class="community-back" href="#/comunidad"><span><i data-lucide="arrow-left" class="i"></i></span>Volver a Comunidad</a>
    <article class="community-question">
      <div class="community-question__meta"><div class="avatar">${iniciales(h.autor)}</div><div><strong>${esc(h.autor)}</strong><span>${hace(h.fecha)} · ${c ? `<a href="#/curso/${c.id}">${esc(c.titulo)}</a>` : 'Tema general'}</span></div><span class="community-status ${h.respuestasTotal ? 'is-solved' : ''}"><i data-lucide="${h.respuestasTotal ? 'badge-check' : 'message-circle'}" class="i"></i>${h.respuestasTotal ? 'Conversación activa' : 'Esperando respuestas'}</span></div>
      <h1 class="display">${esc(h.titulo)}</h1><p>${esc(h.texto)}</p>
      <div class="community-question__actions"><button class="btn btn--secondary btn--sm ${h.marcadoUtil ? 'is-marked' : ''}" data-util="${h.id}" ${h.marcadoUtil ? 'disabled' : ''}><i data-lucide="thumbs-up" class="i"></i>${h.marcadoUtil ? 'Marcado útil' : 'Me resultó útil'} · ${h.util}</button><span>${h.respuestasTotal} respuestas de colegas</span></div>
    </article>
    <div class="community-replies">
      <div class="community-replies__head"><div><span class="eyebrow">Conversación</span><h2>Respuestas</h2></div><span>${h.respuestasTotal}</span></div>
      ${h.respuestas.length ? h.respuestas.map((r, i) => `<article class="community-reply ${i === 0 && h.respuestas.length > 1 ? 'is-featured' : ''}"><div class="avatar">${iniciales(r.autor)}</div><div><div class="community-reply__meta"><strong>${esc(r.autor)}</strong><span>${hace(r.fecha)}</span>${i === 0 && h.respuestas.length > 1 ? '<em><i data-lucide="sparkles" class="i"></i>Aporte destacado</em>' : ''}</div><p>${esc(r.texto)}</p></div></article>`).join('') : '<div class="community-empty community-empty--small"><h3>Sé la primera persona en aportar</h3><p>Una observación concreta puede ayudar mucho.</p></div>'}
    </div>
    <form class="community-answer" data-form-respuesta="${h.id}"><div><span class="community-compose__icon"><i data-lucide="message-square-reply" class="i"></i></span><div><h3>Suma tu experiencia</h3><p>Responde con claridad y respeto.</p></div></div><textarea class="input" name="texto" rows="4" placeholder="Comparte qué revisarías, por qué y qué resultado esperarías…" required></textarea><button class="btn btn--brand btn--pill-arrow">Publicar respuesta <span class="arrow"><i data-lucide="send" class="i"></i></span></button></form>
  </section>`;
}
