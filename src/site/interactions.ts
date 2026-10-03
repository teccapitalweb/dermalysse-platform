import type { LandingContent } from './types';

const qs = <T extends Element>(selector: string, root: ParentNode = document): T | null => root.querySelector<T>(selector);
const qsa = <T extends Element>(selector: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll<T>(selector));

export const mountInteractions = (content: LandingContent): void => {
  const header = qs<HTMLElement>('[data-header]');
  const navigation = qs<HTMLElement>('[data-navigation]');
  const menuButton = qs<HTMLButtonElement>('[data-menu]');
  const dialog = qs<HTMLDialogElement>('[data-preview]');
  const video = dialog ? qs<HTMLVideoElement>('video', dialog) : null;

  const closeMenu = (): void => {
    navigation?.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  };

  menuButton?.addEventListener('click', () => {
    const open = !navigation?.classList.contains('is-open');
    navigation?.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
  });

  qsa<HTMLAnchorElement>('.site-nav a').forEach((link) => link.addEventListener('click', closeMenu));

  const updateHeader = (): void => {
    header?.classList.toggle('is-scrolled', window.scrollY > 18);
  };
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  qsa<HTMLButtonElement>('[data-preview-open]').forEach((button) => button.addEventListener('click', () => dialog?.showModal()));
  qs<HTMLButtonElement>('[data-preview-close]')?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog?.addEventListener('close', () => video?.pause());

  const number = qs<HTMLElement>('[data-club-number]');
  const title = qs<HTMLElement>('[data-club-title]');
  const summary = qs<HTMLElement>('[data-club-summary]');
  qsa<HTMLButtonElement>('[data-club-index]').forEach((button) => button.addEventListener('click', () => {
    const item = content.club.find((candidate) => candidate.index === button.dataset.clubIndex);
    if (!item) return;
    qsa<HTMLButtonElement>('[data-club-index]').forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle('is-active', active);
      candidate.setAttribute('aria-pressed', String(active));
    });
    if (number) number.textContent = item.index;
    if (title) title.textContent = item.title;
    if (summary) summary.textContent = item.summary;
  }));

  const revealTargets = qsa<HTMLElement>('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealTargets.forEach((target) => observer.observe(target));
  } else {
    revealTargets.forEach((target) => target.classList.add('is-visible'));
  }
};
