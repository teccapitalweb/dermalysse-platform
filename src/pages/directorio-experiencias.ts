import { esc } from '../ui/partials';
import { DirectorioExperiencias, type CategoriaExperiencia } from '../core/directorio-experiencias';
import { hace } from '../core/comunidad';
import { api, mensajeError } from '../core/auth';

type ExperienciaRemota = ReturnType<typeof DirectorioExperiencias.listar>[number] & { estado?: 'pendiente' | 'aprobada' | 'rechazada'; revisadaEn?: string };

const temas: { id: CategoriaExperiencia; nombre: string; detalle: string; icono: string }[] = [
  { id: 'aprendizaje', nombre: 'Aprendizaje', detalle: 'Ideas que te llevas de una clase o lectura.', icono: 'book-open-check' },
  { id: 'organizacion', nombre: 'Organización', detalle: 'Métodos, formatos y flujo de trabajo.', icono: 'layers-3' },
  { id: 'comunicacion', nombre: 'Comunicación', detalle: 'Cómo compartir expectativas con claridad.', icono: 'messages-square' },
  { id: 'trayectoria', nombre: 'Trayectoria', detalle: 'Reflexiones sobre crecer en la profesión.', icono: 'sparkles' },
];

export async function directorioExperiencias(_: Record<string, string>, query: URLSearchParams) {
  const local = DirectorioExperiencias.local();
  let experiencias: ExperienciaRemota[] = DirectorioExperiencias.listar();
  let propias: ExperienciaRemota[] = [];
  let errorCarga = '';
  if (!local) {
    try {
      [experiencias, propias] = await Promise.all([
        api<ExperienciaRemota[]>('/experiencias'),
        api<ExperienciaRemota[]>('/experiencias/mias'),
      ]);
    } catch (error) {
      // No sustituir un fallo del servidor con contenido demo o una lista vacía engañosa.
      errorCarga = mensajeError(error);
      experiencias = [];
      propias = [];
    }
  }
  const categoriaQuery = query.get('categoria') || 'todas';
  const categoria: CategoriaExperiencia | 'todas' = temas.some((t) => t.id === categoriaQuery) ? categoriaQuery as CategoriaExperiencia : 'todas';
  const busqueda = (query.get('q') || '').trim();
  const filtradas = experiencias.filter((experiencia) => {
    const coincideCategoria = categoria === 'todas' || experiencia.categoria === categoria;
    const coincideTexto = !busqueda || `${experiencia.titulo} ${experiencia.texto} ${experiencia.autor}`.toLocaleLowerCase('es-MX').includes(busqueda.toLocaleLowerCase('es-MX'));
    return coincideCategoria && coincideTexto;
  });
  const categoriaNombre = (id: CategoriaExperiencia) => temas.find((tema) => tema.id === id)?.nombre || 'Experiencia';
  const hrefFiltro = (id: CategoriaExperiencia | 'todas') => {
    const params = new URLSearchParams();
    if (id !== 'todas') params.set('categoria', id);
    if (busqueda) params.set('q', busqueda);
    const qs = params.toString();
    return `#/comunidad/experiencias${qs ? `?${qs}` : ''}`;
  };
  const menuTemas = [
    `<a class="community-exp-filter ${categoria === 'todas' ? 'is-active' : ''}" href="${esc(hrefFiltro('todas'))}"><span>Todas</span><b>${experiencias.length}</b></a>`,
    ...temas.map((tema) => `<a class="community-exp-filter ${categoria === tema.id ? 'is-active' : ''}" href="${esc(hrefFiltro(tema.id))}"><span>${esc(tema.nombre)}</span><b>${experiencias.filter((item) => item.categoria === tema.id).length}</b></a>`),
  ].join('');
  const lista = filtradas.length
    ? `<div class="community-exp-list">${filtradas.map((item) => `
        <article class="community-exp-card">
          <header><span class="community-exp-card__topic"><i data-lucide="${esc(temas.find((tema) => tema.id === item.categoria)?.icono || 'book-open')}" class="i"></i>${esc(categoriaNombre(item.categoria))}</span><time datetime="${esc(item.fecha)}">${esc(hace(item.fecha))}</time></header>
          <h3>${esc(item.titulo)}</h3><p>${esc(item.texto)}</p>
          <footer><span class="community-exp-card__avatar">${item.anonima ? '<i data-lucide="user-round" class="i"></i>' : esc(item.autor.trim().split(/\s+/).slice(0, 2).map((n) => n[0] || '').join('').toUpperCase())}</span><span>Aporte de <strong>${esc(item.autor)}</strong></span><span class="community-exp-card__privacy"><i data-lucide="${local ? 'hard-drive' : 'shield-check'}" class="i"></i>${local ? 'Solo en este navegador' : 'Aprobada por moderación'}</span></footer>
        </article>`).join('')}</div>`
    : `<div class="community-exp-empty"><span><i data-lucide="notebook-pen" class="i"></i></span><h3>${errorCarga ? 'No se pudo cargar el directorio' : experiencias.length ? 'No encontramos coincidencias' : 'Aquí empieza el directorio'}</h3><p>${errorCarga ? esc(errorCarga) : experiencias.length ? 'Prueba con otro tema o término de búsqueda.' : local ? 'Comparte un aprendizaje, una idea de organización o una reflexión profesional. Esta demo se guarda solo en este navegador.' : 'Aún no hay aportes aprobados. Los nuevos envíos pasan por revisión antes de aparecer aquí.'}</p>${errorCarga ? '<button class="btn btn--secondary" type="button" data-exp-reintentar>Volver a intentar</button>' : experiencias.length ? '' : '<button class="btn btn--brand" type="button" data-exp-open>Compartir la primera experiencia</button>'}</div>`;

  const revisionesPropias = propias.filter((item) => item.estado === 'pendiente' || item.estado === 'rechazada');
  const estadoPropio = (estado?: string) => estado === 'rechazada' ? 'No aprobada' : 'En revisión';
  const bloquePropias = !local && revisionesPropias.length ? `<section class="community-exp-own" aria-label="Estado de tus aportes"><div class="community-exp-directory__head"><div><span class="eyebrow">Seguimiento</span><h2>Tus aportes</h2></div><span class="community-exp-result-count">${revisionesPropias.length} con seguimiento</span></div>${revisionesPropias.map((item) => `<article class="community-exp-own__item"><span class="community-exp-own__status ${item.estado === 'rechazada' ? 'is-rejected' : ''}"><i data-lucide="${item.estado === 'rechazada' ? 'circle-alert' : 'clock-3'}" class="i"></i>${estadoPropio(item.estado)}</span><strong>${esc(item.titulo)}</strong><small>${item.estado === 'rechazada' ? 'Este aporte no se publicó. Puedes enviar una nueva versión corregida, sin datos identificables.' : 'Solo tú puedes ver este envío mientras el equipo de Comunidad lo revisa.'}</small></article>`).join('')}</section>` : '';

  return `
    <section class="community-exp-page">
      <header class="community-exp-hero">
        <div class="community-exp-hero__copy">
          <a class="community-exp-back" href="#/comunidad"><i data-lucide="arrow-left" class="i"></i>Comunidad</a>
          <span class="community-exp-kicker"><i data-lucide="book-open-check" class="i"></i>Directorio de la comunidad</span>
          <h1>Experiencias que <em>nos hacen crecer.</em></h1>
          <p>Un lugar para ordenar aprendizajes y compartir ideas de la práctica profesional, con respeto y sin exponer a nadie.</p>
          <button class="community-exp-cta" type="button" data-exp-open ${errorCarga ? 'disabled aria-disabled="true"' : ''}><i data-lucide="plus" class="i"></i>Compartir experiencia</button>
        </div>
        <div class="community-exp-hero__stats" aria-label="Resumen del directorio">
          <span><strong>${experiencias.length}</strong><small>${experiencias.length === 1 ? 'experiencia' : 'experiencias'}</small></span>
          <span><strong>${temas.length}</strong><small>temas</small></span>
          <span><strong>${local ? 'Demo' : errorCarga ? 'Error' : 'Seguro'}</strong><small>${local ? 'solo local' : errorCarga ? 'sin conexión' : 'con revisión'}</small></span>
        </div>
      </header>

      <nav class="community-section-tabs" aria-label="Secciones de Comunidad">
        <a href="#/comunidad"><i data-lucide="messages-square" class="i"></i>Conversaciones</a>
        <a class="is-active" href="#/comunidad/experiencias" aria-current="page"><i data-lucide="notebook-tabs" class="i"></i>Experiencias <span>Nuevo</span></a>
      </nav>

      <div class="community-exp-notice" role="note">
        <i data-lucide="shield-check" class="i"></i>
        <p><strong>Un espacio cuidadoso.</strong> No incluyas nombres, fotos ni datos que identifiquen a pacientes; tampoco uses este directorio para diagnosticar, prescribir o prometer resultados.</p>
        <small>${local ? 'Demostración local: tus aportes no se publican ni se comparten con otros miembros. En un dispositivo compartido, evita guardar información personal.' : 'Los aportes aprobados son visibles para miembros del club. Los nuevos envíos permanecen privados hasta que el equipo de Comunidad los revise.'}</small>
      </div>

      <form class="community-exp-compose" data-form-exp hidden>
        <div class="community-exp-compose__head"><span><i data-lucide="pen-line" class="i"></i></span><div><h2>Comparte una experiencia</h2><p>Cuenta qué aprendiste, sin convertirlo en una recomendación universal.</p></div></div>
        <label><span>Tema</span><select class="input" name="categoria" required>${temas.map((tema) => `<option value="${tema.id}" ${categoria === tema.id ? 'selected' : ''}>${esc(tema.nombre)} · ${esc(tema.detalle)}</option>`).join('')}</select></label>
        <label><span>Título breve</span><input class="input" name="titulo" minlength="4" maxlength="100" required placeholder="Ej. Una forma sencilla de ordenar mis notas de clase"></label>
        <label><span>Tu experiencia</span><textarea class="input" name="texto" rows="5" minlength="20" maxlength="900" required placeholder="¿Qué probaste o aprendiste? ¿Qué te gustaría compartir con colegas? Evita datos de pacientes."></textarea><small class="community-exp-compose__hint">De 20 a 900 caracteres. Sé específica sin incluir información personal o clínica identificable.</small></label>
        <label class="community-exp-anon"><input type="checkbox" name="anonima"><span><strong>Usar “Miembro del club” como nombre</strong><small>${local ? 'En esta demo local, oculta el nombre mostrado; no vuelve privado el contenido.' : 'Tu identidad se mantiene en el sistema para moderación, pero no se muestra en el aporte.'}</small></span></label>
        <label class="community-exp-consent"><input type="checkbox" name="confirmoPrivacidad" required><span>Confirmo que no incluí datos personales ni información que identifique a pacientes.</span></label>
        <div class="community-exp-compose__actions"><button type="button" class="btn btn--secondary" data-exp-close>Cancelar</button><button type="submit" class="btn btn--brand" ${errorCarga ? 'disabled' : ''}><i data-lucide="send" class="i"></i>${local ? 'Guardar en este dispositivo' : 'Enviar a revisión'}</button></div>
      </form>

      ${bloquePropias}

      <section class="community-exp-directory" aria-label="Explorar experiencias">
        <div class="community-exp-directory__head"><div><span class="eyebrow">Explora por tema</span><h2>Directorio de experiencias</h2></div><span class="community-exp-result-count">${filtradas.length} ${filtradas.length === 1 ? 'aporte' : 'aportes'}</span></div>
        <form class="community-exp-search" data-form-exp-search>
          <i data-lucide="search" class="i"></i><input name="q" type="search" value="${esc(busqueda)}" placeholder="Buscar un aprendizaje o tema…" aria-label="Buscar experiencias">
          ${categoria !== 'todas' ? `<input type="hidden" name="categoria" value="${esc(categoria)}">` : ''}
          <button class="btn btn--secondary btn--sm" type="submit">Buscar</button>
        </form>
        <nav class="community-exp-filters" aria-label="Categorías de experiencias">${menuTemas}</nav>
        ${lista}
      </section>
    </section>`;
}
