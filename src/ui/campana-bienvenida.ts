import { mensajeError } from '../core/auth';
import {
  canjearCampanaBienvenida,
  cargarCampanaBienvenida,
  posponerCampanaBienvenida,
  type CampanaMiembro,
} from '../core/campanas';
import { invalidarPanelPuntos, actualizarPuntosShell } from '../core/puntos';
import { esc } from './partials';

type Opciones = {
  autoMostrar: boolean;
  toast: (mensaje: string, icono?: string) => void;
  celebrar: () => void;
  iconos: () => void;
};

let aperturaAutomatica = false;

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

function beneficios(c: CampanaMiembro): string {
  const b = c.beneficios;
  return `<div class="welcome-campaign__benefits">
    ${b.diamantes ? `<article><span><i data-lucide="gem" class="i"></i></span><div><strong>${b.diamantes.toLocaleString('es-MX')} Diamantes</strong><small>Saldo real en tu monedero</small></div></article>` : ''}
    ${b.vipDias ? `<article><span><i data-lucide="crown" class="i"></i></span><div><strong>${b.vipDias} días VIP</strong><small>${c.canje ? 'Activados en esta cuenta' : 'Se activan al confirmar'}</small></div></article>` : ''}
    ${b.materiales.map((m) => `<article><span><i data-lucide="book-open-check" class="i"></i></span><div><strong>${esc(m.nombre)}</strong><small>Acceso permanente</small></div></article>`).join('')}
  </div>`;
}

function estadoCampana(c: CampanaMiembro): string {
  if (c.canje) return 'entregado';
  return c.estado;
}

export function tarjetaCampanaRecompensas(c: CampanaMiembro | null, error = ''): string {
  if (!c) return `<section class="welcome-reward-card is-error"><span><i data-lucide="cloud-off" class="i"></i></span><div><small>Regalo de bienvenida</small><h2>No pudimos consultar tu campaña</h2><p>${esc(error || 'Vuelve a intentarlo en unos momentos.')}</p></div><button type="button" class="btn btn--secondary" data-reintentar-campana>Reintentar</button></section>`;
  const estado = estadoCampana(c);
  const etiqueta = ({ entregado: 'Entregado y activado', activa: `${c.lugaresRestantes} lugares disponibles`, pausada: 'Campaña pausada', agotada: 'Cupo agotado', terminada: 'Campaña finalizada' } as Record<string, string>)[estado];
  return `<section class="welcome-reward-card is-${estado}" aria-labelledby="welcome-reward-title">
    <div class="welcome-reward-card__jewel"><i data-lucide="gift" class="i"></i><span><i data-lucide="gem" class="i"></i></span></div>
    <div class="welcome-reward-card__copy"><span class="welcome-reward-card__status"><i data-lucide="${c.canje ? 'badge-check' : c.estado === 'activa' ? 'sparkles' : 'info'}" class="i"></i>${esc(etiqueta)}</span><h2 id="welcome-reward-title">${esc(c.nombre)}</h2><p>${c.canje ? `Recibiste tu paquete digital el ${fecha(c.canje.solicitadoEn)}. Los materiales permanecen en tu biblioteca y el movimiento de diamantes quedó registrado.` : esc(c.descripcion)}</p></div>
    <div class="welcome-reward-card__summary">
      <span><i data-lucide="gem" class="i"></i><strong>${c.beneficios.diamantes.toLocaleString('es-MX')}</strong><small>diamantes</small></span>
      <span><i data-lucide="crown" class="i"></i><strong>${c.beneficios.vipDias}</strong><small>días VIP</small></span>
      <span><i data-lucide="library" class="i"></i><strong>${c.beneficios.materiales.length}</strong><small>materiales</small></span>
    </div>
    ${!c.canje && c.estado === 'activa' ? '<button type="button" class="btn welcome-reward-card__cta" data-abrir-campana><i data-lucide="key-round" class="i"></i>Ingresar mi código</button>' : c.canje ? '<button type="button" class="btn welcome-reward-card__cta" data-open-points-tab="actividad"><i data-lucide="receipt-text" class="i"></i>Ver mi registro</button>' : ''}
  </section>`;
}

function modalHTML(c: CampanaMiembro): string {
  const finalizada = !c.canje && c.estado !== 'activa';
  return `<dialog class="welcome-campaign" data-welcome-campaign aria-labelledby="welcome-campaign-title">
    <div class="welcome-campaign__glow" aria-hidden="true"></div>
    <button type="button" class="welcome-campaign__close" ${c.canje || finalizada ? 'data-cerrar-campana aria-label="Cerrar"' : 'data-posponer-campana aria-label="Cerrar y recordarme en siete días"'}><i data-lucide="x" class="i"></i></button>
    <div class="welcome-campaign__visual" aria-hidden="true"><span class="welcome-campaign__gift"><i data-lucide="gift" class="i"></i></span><span class="welcome-campaign__gem is-one"><i data-lucide="gem" class="i"></i></span><span class="welcome-campaign__gem is-two"><i data-lucide="gem" class="i"></i></span><strong>${c.canje ? '¡Es tuyo!' : c.estado === 'activa' ? c.lugaresRestantes : '50'}</strong><small>${c.canje ? 'beneficios activados' : c.estado === 'activa' ? 'lugares disponibles' : 'lugares de lanzamiento'}</small></div>
    <div class="welcome-campaign__body" data-campaign-body>
      ${c.canje ? exitoHTML(c) : finalizada ? `<span class="eyebrow">Primera edición</span><h2 id="welcome-campaign-title">${c.estado === 'agotada' ? 'El cupo ya se agotó' : c.estado === 'terminada' ? 'Esta edición terminó' : 'La campaña está pausada'}</h2><p>No sustituiremos el paquete por beneficios que no existen. Encontrarás otras opciones reales dentro de Recompensas.</p><a class="btn btn--brand" href="#/recompensas" data-cerrar-campana>Explorar recompensas</a>` : formularioHTML(c)}
    </div>
  </dialog>`;
}

function formularioHTML(c: CampanaMiembro): string {
  return `<span class="welcome-campaign__edition"><i data-lucide="sparkles" class="i"></i>Primera edición · solo 50 cuentas</span>
    <span class="eyebrow">Regalo de bienvenida</span>
    <h2 id="welcome-campaign-title">Tu código abre algo <em>especial.</em></h2>
    <p>${esc(c.descripcion)}</p>
    ${beneficios(c)}
    <form class="welcome-campaign__form" data-canjear-campana>
      <label for="welcome-code">Código oficial</label>
      <div><i data-lucide="key-round" class="i"></i><input id="welcome-code" class="input" name="codigo" autocomplete="off" autocapitalize="characters" maxlength="40" required placeholder="Escribe el código que recibiste"><button class="btn btn--brand" type="submit">Activar</button></div>
      <p class="welcome-campaign__error" data-campana-error role="alert" hidden></p>
    </form>
    <button type="button" class="welcome-campaign__later" data-posponer-campana>No tengo un código ahora <i data-lucide="arrow-right" class="i"></i></button>
    <small class="welcome-campaign__legal"><i data-lucide="shield-check" class="i"></i>Validación segura en el servidor · un canje por cuenta · hasta el ${fecha(c.fin)}</small>`;
}

function exitoHTML(c: CampanaMiembro): string {
  return `<span class="welcome-campaign__edition is-success"><i data-lucide="badge-check" class="i"></i>Entrega confirmada</span>
    <span class="eyebrow">Bienvenida Dermalysse</span>
    <h2 id="welcome-campaign-title">¡Tu regalo ya está <em>activo!</em></h2>
    <p>Todo quedó acreditado en esta cuenta y registrado en tu historial.</p>
    ${beneficios(c)}
    <a class="btn btn--brand welcome-campaign__success" href="#/recompensas" data-cerrar-campana><i data-lucide="gem" class="i"></i>Ver mis beneficios</a>`;
}

function actualizarBoton(c: CampanaMiembro | null) {
  document.querySelectorAll<HTMLButtonElement>('[data-campana-shell]').forEach((boton) => {
    if (!c) { boton.hidden = true; return; }
    boton.hidden = false;
    boton.classList.remove('is-loading', 'is-claimed', 'is-exhausted');
    const texto = boton.querySelector<HTMLElement>('[data-campana-shell-text]');
    const badge = boton.querySelector<HTMLElement>('[data-campana-shell-badge]');
    if (c.canje) {
      boton.classList.add('is-claimed');
      if (texto) texto.textContent = 'Mi regalo';
      if (badge) { badge.textContent = '✓'; badge.hidden = false; }
    } else if (c.estado === 'activa') {
      if (texto) texto.textContent = 'Regalo de bienvenida';
      if (badge) { badge.textContent = String(c.lugaresRestantes); badge.hidden = false; }
    } else {
      boton.classList.add('is-exhausted');
      if (texto) texto.textContent = c.estado === 'agotada' ? 'Cupo agotado' : 'Primera edición';
      if (badge) badge.hidden = true;
    }
  });
}

export function abrirCampanaBienvenida() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-welcome-campaign]');
  if (dialog && !dialog.open) dialog.showModal();
}

function conectar(c: CampanaMiembro, opciones: Opciones) {
  let dialog = document.querySelector<HTMLDialogElement>('[data-welcome-campaign]');
  dialog?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHTML(c));
  dialog = document.querySelector<HTMLDialogElement>('[data-welcome-campaign]')!;
  dialog.addEventListener('cancel', (evento) => evento.preventDefault());
  dialog.addEventListener('click', async (evento) => {
    const target = evento.target as HTMLElement;
    if (target.closest('[data-cerrar-campana]')) { dialog?.close(); return; }
    if (!target.closest('[data-posponer-campana]')) return;
    const botones = [...dialog!.querySelectorAll<HTMLButtonElement>('[data-posponer-campana]')];
    botones.forEach((b) => { b.disabled = true; });
    try {
      await posponerCampanaBienvenida(c.id);
      dialog?.close();
      opciones.toast('Te recordaremos este regalo en siete días.', 'calendar-clock');
    } catch (error) {
      botones.forEach((b) => { b.disabled = false; });
      opciones.toast(`No pudimos guardar el recordatorio: ${mensajeError(error)}`, 'circle-alert');
    }
  });
  dialog.querySelector<HTMLFormElement>('[data-canjear-campana]')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const form = evento.currentTarget as HTMLFormElement;
    const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const error = form.querySelector<HTMLElement>('[data-campana-error]')!;
    const codigo = String(new FormData(form).get('codigo') ?? '').trim();
    boton.disabled = true;
    boton.textContent = 'Validando…';
    error.hidden = true;
    try {
      const actualizada = await canjearCampanaBienvenida(codigo);
      invalidarPanelPuntos();
      await actualizarPuntosShell();
      actualizarBoton(actualizada);
      const body = dialog!.querySelector<HTMLElement>('[data-campaign-body]')!;
      body.innerHTML = exitoHTML(actualizada);
      const cerrar = dialog!.querySelector<HTMLButtonElement>('.welcome-campaign__close')!;
      delete cerrar.dataset.posponerCampana;
      cerrar.dataset.cerrarCampana = '';
      cerrar.setAttribute('aria-label', 'Cerrar');
      opciones.iconos();
      opciones.celebrar();
      opciones.toast('Tu regalo Dermalysse quedó activado.', 'gift');
      window.dispatchEvent(new CustomEvent('campana:canjeada', { detail: actualizada }));
    } catch (e) {
      error.textContent = mensajeError(e);
      error.hidden = false;
      boton.disabled = false;
      boton.textContent = 'Activar';
    }
  });
  document.querySelectorAll<HTMLButtonElement>('[data-campana-shell], [data-abrir-campana]').forEach((boton) => {
    boton.onclick = () => abrirCampanaBienvenida();
  });
  if (opciones.autoMostrar && c.debeMostrar && !aperturaAutomatica) {
    aperturaAutomatica = true;
    window.setTimeout(() => abrirCampanaBienvenida(), 380);
  }
}

export async function montarCampanaBienvenida(opciones: Opciones): Promise<void> {
  try {
    const campana = await cargarCampanaBienvenida();
    actualizarBoton(campana);
    conectar(campana, opciones);
  } catch {
    actualizarBoton(null);
  }
}
