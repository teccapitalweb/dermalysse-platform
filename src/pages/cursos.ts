import { cursos, areas, buscar } from '../core/catalogo';
import { Progreso } from '../core/progreso';
import { tarjetaCurso, esc } from '../ui/partials';

export function catalogo(_: Record<string, string>, query: URLSearchParams) {
  const q = query.get('q') || '';
  const area = query.get('area') || '';
  const tab = query.get('tab') || 'todos';

  let lista = buscar(q);
  if (area) lista = lista.filter((c) => c.area === area);
  if (tab === 'marcha') lista = lista.filter((c) => Progreso.porcentaje(c) > 0 && !Progreso.completado(c));
  if (tab === 'completados') lista = lista.filter((c) => Progreso.completado(c));

  const link = (params: Record<string, string>) => {
    const p = new URLSearchParams({ q, area, tab, ...params });
    [...p.keys()].forEach((k) => { if (!p.get(k) || (k === 'tab' && p.get(k) === 'todos')) p.delete(k); });
    const s = p.toString();
    return '#/cursos' + (s ? '?' + s : '');
  };
  const tabs = [['todos', 'Todos'], ['marcha', 'En progreso'], ['completados', 'Completados']]
    .map(([k, l]) => `<a class="chip ${tab === k ? 'chip--primary' : ''}" href="${esc(link({ tab: k }))}">${esc(l)}</a>`).join('');
  const chips = [`<a class="chip ${!area ? 'chip--primary' : 'chip--outline'}" href="${esc(link({ area: '' }))}">Todas las áreas</a>`]
    .concat(areas.map((a) => `<a class="chip ${area === a ? 'chip--primary' : 'chip--outline'}" href="${esc(link({ area: a }))}">${esc(a)}</a>`)).join('');

  const enMarcha = Progreso.enMarcha().length;
  const completados = Progreso.completados().length;
  const totalClases = cursos.reduce((a, c) => a + c.clases.length, 0);
  return `
  <section class="stack" style="gap:22px">
    <div class="catalog-band">
      <div class="catalog-band__copy">
        <span class="catalog-band__kicker"><i data-lucide="graduation-cap" class="i"></i>Biblioteca de formación <b>01</b></span>
        <h1 class="display display--black">Aprende a tu ritmo.<br><em>Avanza con intención.</em></h1>
        <p>Clases grabadas y organizadas para que siempre sepas qué estudiar después.</p>
        <div class="catalog-band__features" aria-label="Características del catálogo">
          <span><i data-lucide="play-circle" class="i"></i>Acceso a tu ritmo</span>
          <span><i data-lucide="route" class="i"></i>Progreso visible</span>
        </div>
      </div>
      <div class="catalog-band__panel">
        <span class="catalog-band__art" aria-hidden="true"><img src="/media/cursos/icono-formacion-3d.png" alt="" decoding="async"></span>
        <div class="catalog-band__panel-head">
          <span><small>Tu mapa de aprendizaje</small><strong>Elige dónde continuar</strong></span>
        </div>
        <div class="catalog-band__stats">
          <div><span class="catalog-band__stat-icon"><i data-lucide="library-big" class="i"></i></span><span><strong>${esc(String(cursos.length))}</strong><small>Cursos</small></span></div>
          <div><span class="catalog-band__stat-icon"><i data-lucide="play" class="i"></i></span><span><strong>${esc(String(totalClases))}</strong><small>Clases</small></span></div>
          <div><span class="catalog-band__stat-icon"><i data-lucide="loader-circle" class="i"></i></span><span><strong>${esc(String(enMarcha))}</strong><small>En progreso</small></span></div>
          <div><span class="catalog-band__stat-icon"><i data-lucide="badge-check" class="i"></i></span><span><strong>${esc(String(completados))}</strong><small>Completados</small></span></div>
        </div>
        <div class="catalog-band__nav">
          <span>Mostrar</span>
          <div class="tabs">${tabs}</div>
        </div>
      </div>
    </div>
    <div class="row" style="gap:8px">${chips}</div>
    ${q ? `<p class="muted">Resultados para <strong>"${esc(q)}"</strong> · <a href="${link({ q: '' })}">limpiar</a></p>` : ''}
    ${lista.length
      ? `<div class="catalog-grid">${lista.map(tarjetaCurso).join('')}</div>`
      : `<div class="card card--pad" style="text-align:center;padding:56px"><h3>Nada por aquí todavía</h3><p class="muted">Prueba con otra área o vuelve a "Todos".</p></div>`}
  </section>`;
}
