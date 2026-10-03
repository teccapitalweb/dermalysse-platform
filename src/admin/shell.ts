// Cascarón del panel de administración.
import { Datos } from '../core/datos';

export const ADMIN_NAV = [
  { href: '#/admin', icon: 'layout-dashboard', label: 'Resumen', match: /^\/admin\/?$/ },
  { group: 'Contenido' },
  { href: '#/admin/cursos', icon: 'graduation-cap', label: 'Cursos', match: /^\/admin\/cursos/ },
  { href: '#/admin/materiales', icon: 'library', label: 'Materiales', match: /^\/admin\/materiales/ },
  { href: '#/admin/en-vivo', icon: 'radio', label: 'En vivo', match: /^\/admin\/en-vivo/ },
  { href: '#/admin/quizzes', icon: 'brain', label: 'Quizzes', match: /^\/admin\/quizzes/ },
  { group: 'Personas' },
  { href: '#/admin/miembros', icon: 'users', label: 'Miembros', match: /^\/admin\/miembros/ },
  { href: '#/admin/cupones', icon: 'ticket-percent', label: 'Cupones', match: /^\/admin\/cupones/ },
  { href: '#/admin/experiencia', icon: 'message-square-heart', label: 'Entrevistas y encuestas', match: /^\/admin\/experiencia/ },
  { href: '#/admin/comunidad', icon: 'messages-square', label: 'Comunidad', match: /^\/admin\/comunidad/ },
  { href: '#/admin/avisos', icon: 'megaphone', label: 'Avisos', match: /^\/admin\/avisos/ },
  { group: 'Sistema' },
  { href: '#/admin/ajustes', icon: 'sliders-horizontal', label: 'Ajustes', match: /^\/admin\/ajustes/ },
] as const;

export function adminShellHTML() {
  const items = ADMIN_NAV.map((n) => 'group' in n
    ? `<div class="nav__label eyebrow">${n.group}</div>`
    : `<a class="nav__item" href="${n.href}" data-nav><i data-lucide="${n.icon}" class="i"></i>${n.label}</a>`).join('');
  return `
  <div class="app app--admin">
    <aside class="sidebar sidebar--admin">
      <a class="sidebar__logo" href="#/admin"><img data-logo src="/brand/dermalysse-horizontal-light.svg" alt="Dermalysse" /><span class="admin-tag">Admin</span></a>
      <nav class="nav">${items}</nav>
      <div class="sidebar__foot">
        ${Datos.modo === 'demo' ? `<div class="admin-demo"><i data-lucide="flask-conical" class="i"></i><div><strong>Modo demo</strong><br>Los cambios se guardan en este navegador.</div></div>` : ''}
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
  <nav class="bottom-nav bottom-nav--admin">
    <a href="#/admin" data-nav><i data-lucide="layout-dashboard" class="i"></i>Resumen</a>
    <a href="#/admin/cursos" data-nav><i data-lucide="graduation-cap" class="i"></i>Cursos</a>
    <a href="#/admin/miembros" data-nav><i data-lucide="users" class="i"></i>Miembros</a>
    <a href="#/admin/materiales" data-nav><i data-lucide="library" class="i"></i>Material</a>
    <a href="#/admin/ajustes" data-nav><i data-lucide="menu" class="i"></i>Más</a>
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
