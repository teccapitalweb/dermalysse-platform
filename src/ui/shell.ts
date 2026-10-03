// Cascarón de la app: barra lateral, barra superior, barra inferior móvil, salida del router.
import { Perfil } from '../core/perfil';
import { Auth } from '../core/auth';
import { Acceso } from '../core/acceso';
import { esc } from './partials';
export const NAV = [
  { href: '#/', icon: 'home', label: 'Inicio', match: /^\/$/ },
  { href: '#/cursos', icon: 'graduation-cap', label: 'Cursos', match: /^\/curso/ },
  { href: '#/materiales', icon: 'library', label: 'Materiales', match: /^\/materiales/ },
  { href: '#/comunidad', icon: 'messages-square', label: 'Comunidad', match: /^\/(comunidad|en-vivo)/ },
  { href: '#/retos', icon: 'gamepad-2', label: 'Retos', match: /^\/retos/ },
  { href: '#/herramientas', icon: 'wrench', label: 'Herramientas', match: /^\/herramientas/ },
  { group: 'Tu progreso' },
  { href: '#/logros', icon: 'flame', label: 'Logros', match: /^\/logros/ },
  { href: '#/certificados', icon: 'award', label: 'Certificados', match: /^\/certificados/ },
  { href: '#/recompensas', icon: 'gift', label: 'Recompensas', match: /^\/recompensas/ },
] as const;

export function shellHTML() {
  const avatar = Auth.usuario?.foto ? `<img src="${esc(Auth.usuario.foto)}" alt="" referrerpolicy="no-referrer">` : Perfil.iniciales();
  const items = NAV.map((n) =>
    'group' in n
      ? `<div class="nav__label eyebrow">${n.group}</div>`
      : `<a class="nav__item" href="${n.href}" data-nav><i data-lucide="${n.icon}" class="i"></i>${n.label}</a>`
  ).join('');
  const bottom = NAV.filter((n) => 'href' in n && ['#/', '#/cursos', '#/materiales', '#/retos'].includes(n.href)).map((n: any) =>
    `<a href="${n.href}" data-nav><i data-lucide="${n.icon}" class="i"></i>${n.label}</a>`).join('') +
    `<a href="#/mas" data-nav><i data-lucide="menu" class="i"></i>Más</a>`;
  return `
  <div class="app">
    <aside class="sidebar">
      <a class="sidebar__logo" href="#/"><img data-logo src="/brand/dermalysse-horizontal.svg" alt="Dermalysse" /></a>
      <nav class="nav">${items}${Auth.usuario?.esAdmin ? `<div class="nav__label eyebrow">Dermalysse</div><a class="nav__item nav__item--admin" href="#/admin"><i data-lucide="shield-check" class="i"></i>Panel admin</a>` : ''}</nav>
      <div class="sidebar__foot">
        ${!Acceso.vip() ? `<button class="btn btn--brand" style="width:100%" data-paywall="Hazte VIP y desbloquea todos los cursos, la biblioteca y los retos."><i data-lucide="crown" class="i"></i>Hazte VIP</button>` : `<div class="install-card" data-install>
          <h4>Lleva Dermalysse en tu bolsillo</h4>
          <p>Instálalo como app: abre más rápido y a pantalla completa.</p>
          <button class="btn btn--sm" data-install-btn><i data-lucide="download" class="i"></i>Instalar app</button>
        </div>`}
        <a class="user-card" href="#/perfil">
          <div class="avatar">${avatar}</div>
          <div><div class="user-card__name">${Perfil.get().nombre}</div><div class="user-card__plan">${Acceso.vip() ? `<i data-lucide="crown" class="i"></i>VIP ${Perfil.get().plan}` : `<i data-lucide="user" class="i"></i>Plan gratis`}</div></div>
          <span class="btn btn--ghost btn--icon" aria-label="Configuración"><i data-lucide="settings" class="i"></i></span>
        </a>
        <button type="button" class="btn btn--ghost sidebar__logout" data-salir><i data-lucide="log-out" class="i"></i>Cerrar sesión</button>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <form class="search" data-search><i data-lucide="search" class="i"></i><input class="input" name="q" placeholder="Buscar cursos, clases o materiales…" autocomplete="off" /></form>
        <div class="topbar__right">
          <button class="btn btn--ghost btn--icon" data-guia aria-label="Guía de la plataforma"><i data-lucide="help-circle" class="i"></i></button>
          <button class="btn btn--ghost btn--icon" data-theme-toggle aria-label="Cambiar tema"><i data-lucide="moon" class="i"></i></button>
          <div class="notifs"><button class="btn btn--ghost btn--icon" aria-label="Notificaciones" data-notifs><i data-lucide="bell" class="i"></i><span class="badge notifs__badge" data-notifs-badge hidden></span></button><div class="notifs__panel" data-notifs-panel hidden></div></div>
          <a class="avatar" href="#/perfil" aria-label="Mi perfil">${avatar}</a>
          <button type="button" class="btn btn--ghost btn--icon topbar__logout" data-salir aria-label="Cerrar sesión" title="Cerrar sesión"><i data-lucide="log-out" class="i"></i></button>
        </div>
      </header>
      <main class="content" id="outlet" style="display:grid;gap:56px;align-content:start"></main>
    </div>
  </div>
  <nav class="bottom-nav">${bottom}</nav>`;
}

export function marcarNavActivo(path: string) {
  document.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach((a) => {
    const item = NAV.find((n) => 'href' in n && n.href === a.getAttribute('href')) as any;
    a.classList.toggle('is-active', item ? item.match.test(path) : false);
  });
}
