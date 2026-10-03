// Regla de oro (freemium). Un solo lugar decide qué es gratis y qué pide VIP.
// Demo: gratis por defecto; "Activar VIP (demo)" simula la membresía para explorar.
// API: usa el esVip real del backend (que además lo valida del lado servidor).
import { createIcons, icons } from 'lucide';
import { Auth } from './auth';
import { Datos, type Material } from './datos';
import { type Curso } from './catalogo';

export const VIP_SIM = 'dermalysse:vip-sim';

export const Acceso = {
  vip(): boolean { return !!Auth.usuario?.esVip; },
  demo(): boolean { return Datos.modo === 'demo'; },
  activarVipDemo() { try { localStorage.setItem(VIP_SIM, '1'); } catch {} },
  quitarVipDemo() { try { localStorage.removeItem(VIP_SIM); } catch {} },

  // Clases: el catálogo oficial de Dermalysse es la fuente de verdad para el acceso.
  claseLibre(curso: Curso, n: number): boolean {
    return curso.clases.find((clase) => clase.n === n)?.gratis === true;
  },
  claseAccesible(curso: Curso, n: number) { return this.vip() || this.claseLibre(curso, n); },

  // Materiales: la gratuidad es explícita para que el orden visual no cambie la regla.
  materialLibre(m: Material): boolean { return m.gratis === true; },
  materialAccesible(m: Material) { return this.vip() || this.materialLibre(m); },

  // Comunidad: ver es gratis, interactuar es VIP
  puedeComunidad(): boolean { return this.vip(); },
};

// ── Modal de paywall reutilizable ──
export function mostrarPaywall(texto = 'Esta clase es para miembros VIP.') {
  if (document.querySelector('.paywall')) return;
  const demo = Acceso.demo();
  const el = document.createElement('div');
  el.className = 'paywall';
  el.innerHTML = `
    <div class="paywall__box">
      <button class="paywall__x" aria-label="Cerrar"><i data-lucide="x" class="i"></i></button>
      <span class="paywall__ic"><i data-lucide="crown" class="i"></i></span>
      <h3>Desbloquea todo el club</h3>
      <p>${texto}</p>
      <ul class="paywall__perks">
        <li><i data-lucide="play-circle" class="i"></i>Todos los cursos y clases</li>
        <li><i data-lucide="book-open" class="i"></i>Materiales y biblioteca completa</li>
        <li><i data-lucide="percent" class="i"></i>20% de descuento en cursos en vivo</li>
      </ul>
      <button class="btn btn--gradient btn--lg paywall__btn" data-vip>${demo ? 'Activar VIP (demo)' : 'Hazte VIP'}</button>
      ${demo ? '<p class="paywall__nota">En el demo, "Activar VIP" desbloquea todo para que explores.</p>' : '<p class="paywall__nota">Desde $200 MXN/mes · cancela cuando quieras</p>'}
    </div>`;
  document.body.appendChild(el);
  createIcons({ icons });
  const cerrar = () => el.remove();
  el.querySelector('.paywall__x')!.addEventListener('click', cerrar);
  el.addEventListener('click', (e) => { if (e.target === el) cerrar(); });
  el.querySelector('[data-vip]')!.addEventListener('click', () => {
    if (demo) { Acceso.activarVipDemo(); location.reload(); }
    else { location.hash = '#/suscripcion'; cerrar(); }
  });
}
