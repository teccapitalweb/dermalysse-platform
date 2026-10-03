import type { LandingContent } from '../core/types';

const qs = <T extends Element>(selector: string, root: ParentNode = document): T | null => root.querySelector<T>(selector);
const qsa = <T extends Element>(selector: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll<T>(selector));

export const mountClubInteractions = (content: LandingContent): void => {
  const sidebar = qs<HTMLElement>('[data-sidebar]');
  const sidebarToggle = qs<HTMLButtonElement>('[data-sidebar-toggle]');
  const dialog = qs<HTMLDialogElement>('[data-lesson-dialog]');
  const video = dialog ? qs<HTMLVideoElement>('video', dialog) : null;
  const toast = qs<HTMLElement>('[data-club-toast]');

  const closeSidebar = (): void => {
    sidebar?.classList.remove('is-open');
    sidebarToggle?.setAttribute('aria-expanded', 'false');
  };

  sidebarToggle?.addEventListener('click', () => {
    const open = !sidebar?.classList.contains('is-open');
    sidebar?.classList.toggle('is-open', open);
    sidebarToggle.setAttribute('aria-expanded', String(open));
  });

  qsa<HTMLAnchorElement>('[data-club-nav]').forEach((link) => link.addEventListener('click', () => {
    qsa<HTMLAnchorElement>('[data-club-nav]').forEach((candidate) => candidate.classList.toggle('is-active', candidate === link));
    closeSidebar();
  }));

  const showToast = (message: string): void => {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.setTimeout(() => { toast.hidden = true; }, 3600);
  };

  qsa<HTMLButtonElement>('[data-coming-soon]').forEach((button) => button.addEventListener('click', () => {
    showToast('La estructura ya está lista; el contenido real se conectará en una etapa posterior.');
  }));

  const lessonTitle = qs<HTMLElement>('[data-lesson-title]');
  const lessonTags = qs<HTMLElement>('[data-lesson-tags]');
  const lessonImage = qs<HTMLImageElement>('[data-lesson-image]');

  qsa<HTMLButtonElement>('[data-course-open]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.courseOpen ?? '0');
    const course = content.courses[index];
    if (!course || !dialog) return;
    if (lessonTitle) lessonTitle.textContent = course.title;
    if (lessonTags) lessonTags.textContent = course.tags.join(' · ');
    if (lessonImage) {
      lessonImage.src = course.image;
      lessonImage.alt = course.alt;
    }
    dialog.showModal();
  }));

  qs<HTMLButtonElement>('[data-lesson-close]')?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog?.addEventListener('close', () => video?.pause());
};
