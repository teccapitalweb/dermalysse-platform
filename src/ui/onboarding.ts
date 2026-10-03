// Spotlight tour para nuevos miembros.
// Señala elementos reales de la interfaz con un recorte luminoso.
// Se muestra una vez (localStorage) y se puede reabrir con el botón de ayuda.
import { createIcons, icons } from 'lucide';
import { Perfil } from '../core/perfil';
import { celebrar } from './celebracion';

export const ONBOARDING_KEY = 'dermalysse:onboarding-v2';

interface Paso {
  target?: string;
  titulo: string;
  texto: string;
  icon: string;
  color: string;
  pos?: 'right' | 'bottom';
}

const PASOS: Paso[] = [
  { titulo: '{{nombre}}', texto: 'Te damos un recorrido rápido para que conozcas todo lo que tienes disponible. Son solo 30 segundos.', icon: 'rocket', color: '#4a7fc1' },
  { target: '.nav [href="#/cursos"]', titulo: 'Cursos a tu ritmo', texto: 'Clases organizadas por módulos, seguimiento de progreso y espacios de repaso.', icon: 'graduation-cap', color: '#681c31', pos: 'right' },
  { target: '.nav [href="#/materiales"]', titulo: 'Biblioteca Dermalysse', texto: 'Guías, formatos, atlas y documentos educativos reunidos en un solo lugar.', icon: 'library', color: '#d9a09b', pos: 'right' },
  { target: '.nav [href="#/retos"]', titulo: 'Aprende jugando', texto: 'Quiz Relámpago, Detective Pecuario, Flashcards y más. Gana XP y sube de nivel con cada acierto.', icon: 'gamepad-2', color: '#7c5cbf', pos: 'right' },
  { target: '.user-card', titulo: 'Tu espacio', texto: 'Desde aquí gestionas tu perfil, tu plan y accedes a tus certificados verificables.', icon: 'circle-user-round', color: '#e0a341', pos: 'right' },
  { titulo: '¡Listo para empezar!', texto: 'Te dejamos una lista de primeros pasos en tu inicio. Si necesitas este tour de nuevo, usa el botón de ayuda en la barra superior.', icon: 'circle-check-big', color: '#22c55e' },
];

let idx = 0;
let root: HTMLElement | null = null;
let alCerrar: (() => void) | undefined;

export function yaVioOnboarding(): boolean {
  try { return localStorage.getItem(ONBOARDING_KEY) === '1'; } catch { return false; }
}

export function mostrarOnboarding(forzar = false, despues?: () => void): boolean {
  if (!forzar && yaVioOnboarding()) return false;
  if (document.querySelector('.spot')) return false;
  idx = 0;
  alCerrar = despues;
  root = document.createElement('div');
  root.className = 'spot';
  document.body.appendChild(root);
  root.addEventListener('click', e => { if (e.target === root) cerrar(); });
  render();
  return true;
}

function cerrar() {
  try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch {}
  if (!root) return;
  root.classList.add('spot--out');
  setTimeout(() => {
    root?.remove(); root = null;
    const siguiente = alCerrar; alCerrar = undefined; siguiente?.();
  }, 280);
}

function dots() {
  return PASOS.map((_, j) => `<span class="${j === idx ? 'on' : j < idx ? 'done' : ''}"></span>`).join('');
}

function render() {
  if (!root) return;
  const p = { ...PASOS[idx] };
  const nombre = Perfil.primerNombre();
  p.titulo = p.titulo.replace('{{nombre}}', nombre ? `¡Bienvenido/a, ${nombre}!` : '¡Bienvenido/a!');
  const first = idx === 0;
  const last = idx === PASOS.length - 1;

  if (!p.target) {
    renderCard(p, first, last);
  } else {
    const el = document.querySelector<HTMLElement>(p.target);
    if (el && el.getBoundingClientRect().width > 0) renderSpotlight(p, el, last);
    else renderCard(p, first, last);
  }
  createIcons({ icons, nameAttr: 'data-lucide' });
}

function renderCard(p: Paso, first: boolean, last: boolean) {
  root!.innerHTML = `
    <div class="spot__card">
      <button class="spot__x"><i data-lucide="x" class="i"></i></button>
      <div class="spot__card-head" style="--c:${p.color}">
        <span class="spot__card-ic"><i data-lucide="${p.icon}" class="i"></i></span>
      </div>
      <div class="spot__card-body">
        <h2>${p.titulo}</h2>
        <p>${p.texto}</p>
        <div class="spot__dots">${dots()}</div>
        <div class="spot__actions">
          ${first ? '<button class="btn btn--ghost spot__skip">Saltar tour</button>' : '<button class="btn btn--secondary spot__prev"><i data-lucide="arrow-left" class="i"></i> Atrás</button>'}
          <button class="btn btn--brand btn--lg spot__next">${last ? '¡Empezar!' : 'Siguiente'} <i data-lucide="${last ? 'sparkles' : 'arrow-right'}" class="i"></i></button>
        </div>
      </div>
    </div>`;
  bind();
}

function renderSpotlight(p: Paso, el: HTMLElement, last: boolean) {
  const r = el.getBoundingClientRect();
  const pad = 6;

  root!.innerHTML = `
    <div class="spot__hole" style="top:${r.top - pad}px;left:${r.left - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px"></div>
    <div class="spot__tip">
      <div class="spot__tip-head" style="--c:${p.color}">
        <span class="spot__tip-ic"><i data-lucide="${p.icon}" class="i"></i></span>
        <span class="spot__tip-num">${idx + 1}/${PASOS.length}</span>
      </div>
      <div class="spot__tip-body">
        <h3>${p.titulo}</h3>
        <p>${p.texto}</p>
        <div class="spot__dots">${dots()}</div>
        <div class="spot__actions">
          <button class="btn btn--ghost btn--sm spot__skip">Saltar</button>
          <div style="display:flex;gap:6px">
            ${idx > 0 ? '<button class="btn btn--secondary btn--sm btn--icon spot__prev"><i data-lucide="arrow-left" class="i"></i></button>' : ''}
            <button class="btn btn--brand btn--sm spot__next">${last ? '¡Listo!' : 'Sig.'} <i data-lucide="${last ? 'check' : 'arrow-right'}" class="i"></i></button>
          </div>
        </div>
      </div>
    </div>`;

  const tip = root!.querySelector<HTMLElement>('.spot__tip')!;
  const gap = 18;
  tip.style.top = `${Math.max(8, r.top - 12)}px`;
  tip.style.left = `${r.right + gap}px`;

  requestAnimationFrame(() => {
    const tr = tip.getBoundingClientRect();
    if (tr.right > window.innerWidth - 12) {
      tip.style.left = 'auto';
      tip.style.right = `${window.innerWidth - r.left + gap}px`;
    }
    if (tr.bottom > window.innerHeight - 12) {
      tip.style.top = `${Math.max(8, window.innerHeight - tr.height - 12)}px`;
    }
  });

  bind();
}

function bind() {
  root!.querySelector('.spot__x')?.addEventListener('click', cerrar);
  root!.querySelector('.spot__skip')?.addEventListener('click', cerrar);
  root!.querySelector('.spot__prev')?.addEventListener('click', () => { idx--; render(); });
  root!.querySelector('.spot__next')!.addEventListener('click', () => {
    if (idx === PASOS.length - 1) { celebrar('normal'); cerrar(); } else { idx++; render(); }
  });
}
