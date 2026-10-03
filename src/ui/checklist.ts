import { Perfil } from '../core/perfil';
import { Progreso } from '../core/progreso';

const DISMISS_KEY = 'dermalysse:checklist-oculto';

interface Item {
  titulo: string;
  icon: string;
  ruta: string;
  check: () => boolean;
}

const ITEMS: Item[] = [
  { titulo: 'Completa tu perfil', icon: 'user-pen', ruta: '#/perfil',
    check: () => { const p = Perfil.get(); return !!(p.especialidad && p.ciudad); } },
  { titulo: 'Ve tu primera clase', icon: 'play', ruta: '#/cursos',
    check: () => Progreso.reciente() !== null },
  { titulo: 'Explora la biblioteca', icon: 'library', ruta: '#/materiales',
    check: () => { try { return localStorage.getItem('ep:v:materiales') === '1'; } catch { return false; } } },
  { titulo: 'Responde un quiz', icon: 'gamepad-2', ruta: '#/retos',
    check: () => { try { return localStorage.getItem('ep:v:retos') === '1'; } catch { return false; } } },
  { titulo: 'Únete a la comunidad', icon: 'messages-square', ruta: '#/comunidad',
    check: () => { try { return localStorage.getItem('ep:v:comunidad') === '1'; } catch { return false; } } },
];

export function checklistOculto(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

export function ocultarChecklist(): void {
  try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
}

export const VISIT_KEYS: Record<string, string> = {
  '/materiales': 'ep:v:materiales',
  '/retos': 'ep:v:retos',
  '/comunidad': 'ep:v:comunidad',
};

export function checklistHTML(): string {
  if (checklistOculto()) return '';
  const done = ITEMS.filter(i => i.check()).length;
  if (done === ITEMS.length) { ocultarChecklist(); return ''; }
  const pct = Math.round((done / ITEMS.length) * 100);

  return `
  <section class="ckl">
    <div class="ckl__head">
      <div class="ckl__left">
        <span class="ckl__icon"><i data-lucide="list-checks" class="i"></i></span>
        <div>
          <h3 class="ckl__title">Primeros pasos</h3>
          <span class="ckl__sub">${done} de ${ITEMS.length} completados</span>
        </div>
      </div>
      <button class="btn btn--ghost btn--icon ckl__x" data-ckl-dismiss aria-label="Ocultar"><i data-lucide="x" class="i"></i></button>
    </div>
    <div class="ckl__bar"><div class="ckl__fill" style="width:${pct}%"></div></div>
    <ul class="ckl__list">
      ${ITEMS.map(i => {
        const ok = i.check();
        return `<li class="${ok ? 'is-done' : ''}">
          <span class="ckl__chk">${ok ? '<i data-lucide="circle-check-big" class="i"></i>' : '<span class="ckl__ring"></span>'}</span>
          <a href="${i.ruta}"><i data-lucide="${i.icon}" class="i ckl__item-ic"></i>${i.titulo}</a>
          ${ok ? '' : '<i data-lucide="chevron-right" class="i ckl__go"></i>'}
        </li>`;
      }).join('')}
    </ul>
    <button class="ckl__skip" data-ckl-dismiss>Ya conozco la plataforma</button>
  </section>`;
}
