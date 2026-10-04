import type { LandingContent } from './types';

const qs = <T extends Element>(selector: string, root: ParentNode = document): T | null => root.querySelector<T>(selector);
const qsa = <T extends Element>(selector: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll<T>(selector));
const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

export const mountInteractions = (content: LandingContent): void => {
  const header = qs<HTMLElement>('[data-header]');
  const navigation = qs<HTMLElement>('[data-navigation]');
  const menuButton = qs<HTMLButtonElement>('[data-menu]');
  const dialog = qs<HTMLDialogElement>('[data-preview]');
  const video = dialog ? qs<HTMLVideoElement>('video', dialog) : null;
  const progressNumber = qs<HTMLElement>('[data-progress-number]');
  const progressLabel = qs<HTMLElement>('[data-progress-label]');
  const progressBar = qs<HTMLElement>('[data-progress-bar]');
  const chapters = qsa<HTMLElement>('[data-chapter]');
  const motionSections = qsa<HTMLElement>('[data-motion-section]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.documentElement.classList.add('motion-enabled');
  requestAnimationFrame(() => document.body.classList.add('site-ready'));

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

  let dialogCloseTimer: number | undefined;
  const openPreview = (): void => {
    if (!dialog || dialog.open) return;
    window.clearTimeout(dialogCloseTimer);
    dialog.classList.remove('is-closing');
    dialog.showModal();
    requestAnimationFrame(() => dialog.classList.add('is-active'));
  };
  const closePreview = (): void => {
    if (!dialog?.open) return;
    if (reduceMotion.matches) {
      dialog.close();
      return;
    }
    dialog.classList.remove('is-active');
    dialog.classList.add('is-closing');
    dialogCloseTimer = window.setTimeout(() => dialog.close(), 260);
  };

  qsa<HTMLButtonElement>('[data-preview-open]').forEach((button) => button.addEventListener('click', openPreview));
  qs<HTMLButtonElement>('[data-preview-close]')?.addEventListener('click', closePreview);
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) closePreview();
  });
  dialog?.addEventListener('close', () => {
    window.clearTimeout(dialogCloseTimer);
    dialog.classList.remove('is-active', 'is-closing');
    video?.pause();
  });

  const number = qs<HTMLElement>('[data-club-number]');
  const title = qs<HTMLElement>('[data-club-title]');
  const summary = qs<HTMLElement>('[data-club-summary]');
  const focus = qs<HTMLElement>('[data-club-focus]');
  let clubTimer: number | undefined;

  qsa<HTMLButtonElement>('[data-club-index]').forEach((button) => button.addEventListener('click', () => {
    const item = content.club.find((candidate) => candidate.index === button.dataset.clubIndex);
    if (!item || button.classList.contains('is-active')) return;
    qsa<HTMLButtonElement>('[data-club-index]').forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle('is-active', active);
      candidate.setAttribute('aria-pressed', String(active));
    });
    window.clearTimeout(clubTimer);
    focus?.classList.add('is-changing');
    clubTimer = window.setTimeout(() => {
      if (number) number.textContent = item.index;
      if (title) title.textContent = item.title;
      if (summary) summary.textContent = item.summary;
      focus?.classList.remove('is-changing');
    }, reduceMotion.matches ? 0 : 170);
  }));

  const skinSection = qs<HTMLElement>('[data-skin]');
  const skinSteps = qsa<HTMLButtonElement>('[data-skin-step]');
  let activeSkinStep = -1;
  const activateSkinStep = (index: number): void => {
    if (!skinSteps[index] || index === activeSkinStep) return;
    activeSkinStep = index;
    skinSection?.setAttribute('data-skin-active', String(index));
    skinSteps.forEach((step, stepIndex) => {
      const active = stepIndex === index;
      step.classList.toggle('is-active', active);
      step.setAttribute('aria-pressed', String(active));
    });
  };
  activateSkinStep(0);
  skinSteps.forEach((step, index) => step.addEventListener('click', () => activateSkinStep(index)));

  const revealTargets = qsa<HTMLElement>('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
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

  const heroVisual = qs<HTMLElement>('[data-hero-visual]');
  if (heroVisual && window.matchMedia('(pointer: fine)').matches && !reduceMotion.matches) {
    heroVisual.addEventListener('pointermove', (event) => {
      const bounds = heroVisual.getBoundingClientRect();
      heroVisual.style.setProperty('--pointer-x', ((event.clientX - bounds.left) / bounds.width - .5).toFixed(3));
      heroVisual.style.setProperty('--pointer-y', ((event.clientY - bounds.top) / bounds.height - .5).toFixed(3));
    });
    heroVisual.addEventListener('pointerleave', () => {
      heroVisual.style.setProperty('--pointer-x', '0');
      heroVisual.style.setProperty('--pointer-y', '0');
    });
  }

  let ticking = false;
  const updateMotion = (): void => {
    ticking = false;
    const viewportHeight = window.innerHeight;
    const documentHeight = Math.max(document.documentElement.scrollHeight - viewportHeight, 1);
    const pageProgress = clamp(window.scrollY / documentHeight);
    header?.classList.toggle('is-scrolled', window.scrollY > 18);
    progressBar?.style.setProperty('--page-progress', pageProgress.toFixed(4));

    let activeChapter = chapters[0];
    chapters.forEach((chapter) => {
      const rect = chapter.getBoundingClientRect();
      if (rect.top <= viewportHeight * .48) activeChapter = chapter;
    });
    if (activeChapter) {
      if (progressNumber) progressNumber.textContent = activeChapter.dataset.chapter ?? '00';
      if (progressLabel) progressLabel.textContent = activeChapter.dataset.chapterTitle ?? '';
    }

    motionSections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      const progress = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height));
      section.style.setProperty('--scene-progress', progress.toFixed(4));
    });

    if (skinSection) {
      const rect = skinSection.getBoundingClientRect();
      const travel = Math.max(rect.height - viewportHeight, 1);
      const progress = clamp(-rect.top / travel);
      skinSection.style.setProperty('--skin-progress', progress.toFixed(4));
      if (rect.top < viewportHeight * .7 && rect.bottom > viewportHeight * .3) {
        activateSkinStep(Math.min(skinSteps.length - 1, Math.floor(progress * skinSteps.length)));
      }
    }
  };
  const requestMotionUpdate = (): void => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateMotion);
  };
  updateMotion();
  window.addEventListener('scroll', requestMotionUpdate, { passive: true });
  window.addEventListener('resize', requestMotionUpdate);
};
