// Cascarón del panel de administración.
// En producción (modo API) solo «Academia» tiene servidor: el resto de secciones se oculta y se
// enlaza al panel admin actual (VITE_ADMIN_LEGADO_URL). Interruptor: 'adminGestion' en src/core/funciones.ts.
import { Datos } from '../core/datos';
import { adminLegadoUrl, disponible } from '../core/plataforma';
import { esc } from '../ui/partials';

export const ADMIN_NAV = [
  { href: '#/admin', icon: 'layout-dashboard', label: 'Resumen', match: /^\/admin\/?$/ },
  { group: 'Contenido' },
  { href: '#/admin/cursos', icon: 'graduation-cap', label: 'Cursos', match: /^\/admin\/cursos/ },
  { href: '#/admin/materiales', icon: 'library', label: 'Materiales', match: /^\/admin\/materiales/ },
  { href: '#/admin/en-vivo', icon: 'radio', label: 'En vivo', match: /^\/admin\/en-vivo/ },
  { href: '#/admin/quizzes', icon: 'brain', label: 'Quizzes', match: /^\/admin\/quizzes/ },
  { href: '#/admin/academia', icon: 'book-open-text', label: 'Academia', match: /^\/admin\/academia/ },
  { group: 'Personas' },
  { href: '#/admin/miembros', icon: 'users', label: 'Miembros', match: /^\/admin\/miembros/ },
  { href: '#/admin/cupones', icon: 'ticket-percent', label: 'Cupones', match: /^\/admin\/cupones/ },
  { href: '#/admin/experiencia', icon: 'message-square-heart', label: 'Entrevistas y encuestas', match: /^\/admin\/experiencia/ },
  { href: '#/admin/comunidad', icon: 'messages-square', label: 'Comunidad', match: /^\/admin\/comunidad/ },
  { href: '#/admin/avisos', icon: 'megaphone', label: 'Avisos', match: /^\/admin\/avisos/ },
  { group: 'Sistema' },
  { href: '#/admin/ajustes', icon: 'sliders-horizontal', label: 'Ajustes', match: /^\/admin\/ajustes/ },
] as const;

/** Rutas del admin con servidor en producción (aunque 'adminGestion' esté apagado). */
const SIEMPRE_DISPONIBLES = new Set<string>(['#/admin', '#/admin/academia']);

/** Menú visible: completo en demo (o con 'adminGestion' activo); en producción, Inicio y Academia. */
type EntradaNav = { group: string } | { href: string; icon: string; label: string };

function navVisible(): EntradaNav[] {
  if (disponible('adminGestion')) return [...ADMIN_NAV];
  const enlaces = ADMIN_NAV.flatMap((n) => ('href' in n && SIEMPRE_DISPONIBLES.has(n.href)
    ? [n.href === '#/admin' ? { ...n, icon: 'house', label: 'Inicio' } : n]
    : []));
  return [enlaces[0], { group: 'Contenido' }, ...enlaces.slice(1)];
}

/**
 * Tarjeta que lleva al panel admin actual para todo lo que el admin nuevo aún no cubre en producción.
 * Solo aparece con VITE_ADMIN_LEGADO_URL (https) y cuando 'adminGestion' está apagado.
 */
export function tarjetaAdminLegado(variante: 'lateral' | 'pagina'): string {
  const url = adminLegadoUrl();
  if (!url || disponible('adminGestion')) return '';
  const enlace = `<a class="btn ${variante === 'lateral' ? 'btn--white btn--sm' : 'btn--brand'}" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><i data-lucide="external-link" class="i"></i>Abrir panel admin actual</a>`;
  if (variante === 'lateral') {
    return `<div class="admin-legado admin-legado--lateral"><i data-lucide="panel-top-open" class="i"></i><div><strong>Panel admin actual</strong><p>Miembros, cursos, cupones, comunidad, avisos y ajustes siguen ahí.</p>${enlace}</div></div>`;
  }
  return `<section class="card card--pad admin-legado" aria-labelledby="admin-legado-titulo">
    <span class="admin-legado__ic" aria-hidden="true"><i data-lucide="panel-top-open" class="i"></i></span>
    <div class="admin-legado__cuerpo">
      <h2 id="admin-legado-titulo">Todo lo demás, en el panel admin actual</h2>
      <p class="muted">Miembros y membresías, cursos y clases, cupones, comunidad, avisos y ajustes se gestionan por ahora en el panel de administración actual del club. Se abre en una pestaña nueva con tu misma cuenta de administrador.</p>
      ${enlace}
    </div>
  </section>`;
}

export function adminShellHTML() {
  const completo = disponible('adminGestion');
  const items = navVisible().map((n) => 'group' in n
    ? `<div class="nav__label eyebrow">${n.group}</div>`
    : `<a class="nav__item" href="${n.href}" data-nav><i data-lucide="${n.icon}" class="i"></i>${n.label}</a>`).join('');
  return `
  <div class="app app--admin">
    <aside class="sidebar sidebar--admin">
      <a class="sidebar__logo" href="#/admin"><img data-logo src="/brand/dermalysse-horizontal-light.svg" alt="Dermalysse" /><span class="admin-tag">Admin</span></a>
      <nav class="nav">${items}</nav>
      <div class="sidebar__foot">
        ${Datos.modo === 'demo' ? `<div class="admin-demo"><i data-lucide="flask-conical" class="i"></i><div><strong>Modo demo</strong><br>Los cambios se guardan en este navegador.</div></div>` : ''}
        ${tarjetaAdminLegado('lateral')}
        <a class="nav__item" href="#/"><i data-lucide="arrow-left" class="i"></i>Volver al club</a>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="admin-crumb" data-crumb>Panel de administración</div>
        <div class="topbar__right">
          <button class="btn btn--ghost btn--icon" data-theme-toggle aria-label="Cambiar tema"><i data-lucide="moon" class="i"></i></button>
          <span class="chip chip--primary"><i data-lucide="shield-check" class="i"></i>Dermalysse</span>
        </div>
      </header>
      <main class="content" id="outlet" style="display:grid;gap:32px;align-content:start"></main>
    </div>
  </div>
  <nav class="bottom-nav bottom-nav--admin">${completo ? `
    <a href="#/admin" data-nav><i data-lucide="layout-dashboard" class="i"></i>Resumen</a>
    <a href="#/admin/cursos" data-nav><i data-lucide="graduation-cap" class="i"></i>Cursos</a>
    <a href="#/admin/miembros" data-nav><i data-lucide="users" class="i"></i>Miembros</a>
    <a href="#/admin/materiales" data-nav><i data-lucide="library" class="i"></i>Material</a>
    <a href="#/admin/ajustes" data-nav><i data-lucide="menu" class="i"></i>Más</a>` : `
    <a href="#/admin" data-nav><i data-lucide="house" class="i"></i>Inicio</a>
    <a href="#/admin/academia" data-nav><i data-lucide="book-open-text" class="i"></i>Academia</a>
    <a href="#/"><i data-lucide="arrow-left" class="i"></i>Club</a>`}
  </nav>`;
}

export function marcarAdminActivo(path: string) {
  document.querySelectorAll<HTMLAnchorElement>('.app--admin [data-nav], .bottom-nav--admin [data-nav]').forEach((a) => {
    const item = ADMIN_NAV.find((n) => 'href' in n && n.href === a.getAttribute('href')) as any;
    a.classList.toggle('is-active', item ? item.match.test(path) : false);
  });
}

export const adminHead = (titulo: string, sub: string, acciones = '') => `
  <div class="section-head" style="align-items:center">
    <div><span class="eyebrow">Administración</span><h1 class="display" style="font-size:var(--fs-2xl);margin-top:4px">${titulo}</h1><p class="muted" style="margin-top:4px">${sub}</p></div>
    <div class="row">${acciones}</div>
  </div>`;
