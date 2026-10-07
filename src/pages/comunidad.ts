import { Comunidad, hace, type Hilo } from '../core/comunidad';
import { cursos, curso as getCurso } from '../core/catalogo';
import { BRAND, wa } from '../core/brand';
import { Datos } from '../core/datos';
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
const colorArea = (area: string) => COLOR_AREA[area] || '#681c31';

function tarjetaHilo(h: Hilo) {
  const c = h.cursoId ? getCurso(h.cursoId) : null;
  const area = c?.area || 'General';
  const color = colorArea(area);
  const activo = h.respuestasTotal > 0;
  const reciente = (Date.now() - new Date(h.fecha).getTime()) < 1000 * 60 * 60 * 48;
  // Respuesta destacada: la primera (coincide con el detalle del hilo).
  const destacada = h.respuestas[0];
  // Avatar stack: hasta 4 respondedores únicos.
  const respondedores = [...new Map(h.respuestas.map((r) => [r.autor, r])).values()].slice(0, 4);
  const extras = h.respuestas.length > respondedores.length ? h.respuestas.length - respondedores.length : 0;

  return `
  <a class="community-thread" href="#/comunidad/${h.id}" style="--area:${color}">
    <span class="community-thread__accent" aria-hidden="true"></span>
    <div class="community-thread__top">
      <div class="community-thread__who">
        <div class="avatar community-thread__avatar">${iniciales(h.autor)}</div>
        <div class="community-thread__author">
          <strong>${esc(h.autor)}</strong>
          <span>${reciente ? '<i data-lucide="dot" class="i community-thread__dot" aria-hidden="true"></i>' : ''}${hace(h.fecha)}</span>
        </div>
      </div>
      <span class="community-thread__topic"><span class="community-thread__topic-dot" aria-hidden="true"></span>${esc(area)}</span>
      <span class="community-status ${activo ? 'is-solved' : 'is-fresh'}">
        <i data-lucide="${activo ? 'messages-square' : 'sparkle'}" class="i"></i>
        ${activo ? `${h.respuestasTotal} ${h.respuestasTotal === 1 ? 'respuesta' : 'respuestas'}` : 'Nuevo caso'}
      </span>
    </div>
    <div class="community-thread__body">
      <h3>${esc(h.titulo)}</h3>
      <p>${esc(h.texto)}</p>
    </div>
    ${destacada ? `
    <div class="community-thread__preview">
      <div class="avatar community-thread__preview-avatar" style="--area:${color}">${iniciales(destacada.autor)}</div>
      <div class="community-thread__preview-body">
        <span><strong>${esc(destacada.autor)}</strong> · ${hace(destacada.fecha)}</span>
        <p>${esc(destacada.texto)}</p>
      </div>
    </div>` : ''}
    <div class="community-thread__foot">
      ${respondedores.length ? `
      <div class="community-thread__stack" aria-label="Colegas que respondieron">
        ${respondedores.map((r) => `<span class="avatar community-thread__stack-item" title="${esc(r.autor)}">${iniciales(r.autor)}</span>`).join('')}
        ${extras ? `<span class="community-thread__stack-more">+${extras}</span>` : ''}
      </div>` : '<span class="community-thread__hint"><i data-lucide="hand" class="i"></i>Sé la primera voz</span>'}
      <span class="community-thread__kudos"><i data-lucide="thumbs-up" class="i"></i><strong>${h.util}</strong> útiles</span>
      <span class="community-thread__open">Ver conversación <i data-lucide="arrow-up-right" class="i"></i></span>
    </div>
  </a>`;
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
  const areasActivas = new Set(todos.map((h) => (h.cursoId ? getCurso(h.cursoId)?.area : null)).filter(Boolean));
  const normas = [
    { icon: 'eye', titulo: 'Observa primero', texto: 'Describe lo que ves antes de pedir una conclusión.' },
    { icon: 'file-text', titulo: 'Documenta sin exponer', texto: 'Comparte contexto profesional sin datos personales.' },
    { icon: 'users', titulo: 'Respeta el criterio ajeno', texto: 'Hay más de un camino profesional válido.' },
    { icon: 'shield-check', titulo: 'Deriva cuando toca', texto: 'Si el caso rebasa tu alcance, señálalo.' },
  ];
  return `
  <section class="community-page">
    <header class="community-hero">
      <div class="community-hero__copy">
        <span class="community-kicker"><i data-lucide="sparkles" class="i"></i>Comunidad Dermalysse</span>
        <h1 class="display">Aprender se vuelve mejor cuando es <em>compartido.</em></h1>
        <p>Publica un caso, compara criterios con otros profesionales y convierte cada respuesta en conocimiento práctico.</p>
        <div class="community-hero__actions">
          <button class="btn btn--brand btn--pill-arrow" data-nuevo-hilo>Compartir un caso <span class="arrow"><i data-lucide="plus" class="i"></i></span></button>
          <a class="community-hero__link" href="#/retos"><i data-lucide="trophy" class="i"></i>Ver práctica Dermalysse</a>
        </div>
        ${voces.length ? `
        <div class="community-hero__voices" aria-label="Voces activas esta semana">
          <div class="community-hero__voices-stack">
            ${voces.slice(0, 4).map((v) => `<span class="avatar community-hero__voice" title="${esc(v.nombre)}">${iniciales(v.nombre)}</span>`).join('')}
          </div>
          <div class="community-hero__voices-copy">
            <span>Voces activas esta semana</span>
            <strong>${voces.map((v) => esc(v.nombre.split(' ')[0])).slice(0, 3).join(', ')}${voces.length > 3 ? ' y más' : ''}</strong>
          </div>
        </div>` : ''}
      </div>
      <div class="community-hero__pulse" aria-label="Actividad de la comunidad">
        <div class="community-pulse__ring"><span class="community-pulse__wave" aria-hidden="true"></span><i data-lucide="activity" class="i"></i></div>
        <div><span>Comunidad activa</span><strong>${autores || '—'} ${autores === 1 ? 'colega aportando' : 'colegas aportando'}</strong></div>
        <div class="community-pulse__stats">
          <span><strong>${respuestas}</strong>respuestas</span>
          <span><strong>${utiles}</strong>votos útiles</span>
          <span><strong>${areasActivas.size || '—'}</strong>áreas activas</span>
        </div>
      </div>
    </header>

    <section class="community-live" aria-label="Clases en vivo">
      <div class="community-live__signal"><span></span><i data-lucide="radio" class="i"></i></div>
      <div class="community-live__copy">
        <span class="eyebrow">Dentro de Comunidad · En vivo</span>
        ${siguienteEnVivo
          ? `<h2>${esc(siguienteEnVivo.titulo)}</h2><p>${esc(fechaEnVivo)}${siguienteEnVivo.ponente ? ` · ${esc(siguienteEnVivo.ponente)}` : ''}</p>`
          : `<h2>Aprende y conversa en tiempo real</h2><p>Aquí encontrarás las próximas clases, transmisiones y grabaciones de la comunidad.</p>`}
      </div>
      <div class="community-live__actions">
        ${siguienteEnVivo ? `<span class="community-live__date"><i data-lucide="calendar-days" class="i"></i>${esc(fechaEnVivo)}</span>` : ''}
        <a class="btn btn--white btn--pill-arrow" href="#/en-vivo">${siguienteEnVivo ? 'Reservar lugar' : 'Ir a En vivo'} <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span></a>
      </div>
    </section>

    <form class="community-compose" data-form-hilo hidden>
      <div class="community-compose__head"><span class="community-compose__icon"><i data-lucide="notebook-pen" class="i"></i></span><div><h2>Comparte lo que estás aprendiendo</h2><p>El contexto correcto atrae mejores respuestas.</p></div></div>
      <label><span>Título del caso o duda</span><input class="input" name="titulo" placeholder="Ej. Bajó la postura después del cambio de temperatura" required maxlength="120"></label>
      <label><span>Contexto y observaciones</span><textarea class="input" name="texto" rows="5" placeholder="Especie, edad o etapa productiva, signos, cambios recientes y qué ya revisaste. Sin datos sensibles." required></textarea></label>
      <div class="community-compose__actions"><select class="input" name="cursoId"><option value="">Tema general</option>${opciones}</select><div><button type="button" class="btn btn--ghost" data-cancelar-hilo>Cancelar</button><button class="btn btn--brand"><i data-lucide="send" class="i"></i>Publicar caso</button></div></div>
    </form>

    <div class="community-layout">
      <main class="community-feed">
        <div class="community-feed__head">
          <div><span class="eyebrow">Conversaciones recientes</span><h2>Casos de la comunidad</h2></div>
          <span class="community-feed__count">${hilos.length} temas</span>
        </div>
        <nav class="community-filters" aria-label="Filtrar casos"><a class="chip ${!filtro ? 'chip--primary' : 'chip--outline'}" href="#/comunidad">Todos</a>${cursos.filter((c) => Comunidad.hilos(c.id).length).map((c) => `<a class="chip ${filtro === c.id ? 'chip--primary' : 'chip--outline'}" href="#/comunidad?curso=${c.id}">${esc(c.area)}</a>`).join('')}</nav>
        <div class="community-list">${Comunidad.cargando() ? cargando() : hilos.length ? hilos.map(tarjetaHilo).join('') : '<div class="community-empty"><i data-lucide="messages-square" class="i"></i><h3>Aún no hay casos en esta categoría</h3><p>Comparte el primero y abre la conversación.</p><button class="btn btn--brand" data-nuevo-hilo>Nuevo caso</button></div>'}</div>
      </main>

      <aside class="community-aside">
        <div class="community-side-card community-side-card--wa">
          <span class="community-side-card__icon"><i data-lucide="message-circle" class="i"></i></span>
          <span class="eyebrow">Canal oficial</span><h3>Dermalysse en WhatsApp</h3><p>Avisos de clases, novedades y contenido educativo sin ruido.</p>
          ${BRAND.canalWhatsApp ? `<a class="btn" href="${BRAND.canalWhatsApp}" target="_blank" rel="noopener">Abrir canal <i data-lucide="external-link" class="i"></i></a>` : '<span class="chip chip--outline">Canal por conectar</span>'}
        </div>
        <a class="community-side-card community-side-card--league" href="#/retos">
          <div class="community-league-orbit"><i data-lucide="trophy" class="i"></i></div>
          <span class="eyebrow">Comunidad activa</span><h3>Tu aporte también cuenta</h3><p>Aprende, participa y fortalece tu ruta con actividad verificada.</p><span class="community-side-link">Ver práctica <i data-lucide="arrow-right" class="i"></i></span>
        </a>
        <div class="community-side-card community-side-card--guide">
          <span class="eyebrow">Cómo participamos</span>
          <ul>
            ${normas.map((n) => `<li><span class="community-norma__icon"><i data-lucide="${n.icon}" class="i"></i></span><div><strong>${n.titulo}</strong><small>${n.texto}</small></div></li>`).join('')}
          </ul>
        </div>
        ${voces.length ? `
        <div class="community-side-card community-side-card--voices">
          <div class="community-side-head"><span class="eyebrow">Voces de la semana</span><span class="chip chip--primary" style="padding:3px 9px;font-size:10px">${voces.reduce((a, v) => a + v.aportes, 0)} aportes</span></div>
          <ul class="community-voices-list">
            ${voces.map((v, i) => `
              <li>
                <span class="community-voices__rank">#${i + 1}</span>
                <div class="avatar community-voices__avatar">${iniciales(v.nombre)}</div>
                <div class="community-voices__meta">
                  <strong>${esc(v.nombre)}</strong>
                  <small>${v.aportes} ${v.aportes === 1 ? 'aporte' : 'aportes'}${v.util ? ` · ${v.util} útiles` : ''}</small>
                </div>
              </li>`).join('')}
          </ul>
        </div>` : ''}
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
