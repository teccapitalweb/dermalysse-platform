import { createIcons, icons } from 'lucide';
import { Auth, api, mensajeError } from '../core/auth';
import { BRAND } from '../core/brand';
import { Datos } from '../core/datos';
import { Perfil, type PerfilRemoto } from '../core/perfil';
import { esc } from './partials';
import { celebrar } from './celebracion';

let omitidaEnSesion = false;

export function mostrarFichaInicial(alGuardar?: () => void) {
  if (Datos.modo !== 'api' || !Auth.usuario || Perfil.fichaCompleta() || omitidaEnSesion || document.querySelector('.ficha')) return;

  const p = Perfil.get();
  const root = document.createElement('div');
  root.className = 'ficha';
  root.innerHTML = `
    <section class="ficha__panel" role="dialog" aria-modal="true" aria-labelledby="ficha-titulo">
      <button class="ficha__cerrar btn btn--ghost btn--icon" type="button" aria-label="Completar después"><i data-lucide="x" class="i"></i></button>
      <div class="ficha__cabecera">
        <span class="ficha__icono"><i data-lucide="contact-round" class="i"></i></span>
        <div><span class="eyebrow">Un último paso</span><h2 id="ficha-titulo">Completa tu ficha</h2></div>
      </div>
      <p class="ficha__intro">Así podremos identificar tu cuenta y brindarte soporte personalizado dentro de Dermalysse.</p>
      <form class="ficha__form">
        <div class="field"><label>Nombre completo</label><input class="input" name="nombre" value="${esc(p.nombre || Auth.usuario.nombre)}" required maxlength="60" autocomplete="name"></div>
        <div class="field"><label>Correo de tu cuenta</label><input class="input" value="${esc(Auth.usuario.email)}" readonly disabled></div>
        <div class="field"><label>WhatsApp <span aria-hidden="true">*</span></label><input class="input" name="whatsapp" value="${esc(p.whatsapp)}" required maxlength="20" inputmode="tel" autocomplete="tel" pattern="\\+?[0-9 ()\\-.]{7,20}" placeholder="+52 236 123 4567"><small>Lo usaremos para identificar tu ficha y darte soporte.</small></div>
        <div class="ficha__dos">
          <div class="field"><label>Especialidad <span class="faint">(opcional)</span></label><input class="input" name="especialidad" value="${esc(p.especialidad)}" maxlength="80" placeholder="Cosmetología, estética o dermatología"></div>
          <div class="field"><label>Ciudad <span class="faint">(opcional)</span></label><input class="input" name="ciudad" value="${esc(p.ciudad)}" maxlength="80" autocomplete="address-level2" placeholder="Puebla, Pue."></div>
        </div>
        <p class="ficha__error" role="alert" hidden></p>
        <p class="ficha__legal">Al guardar aceptas nuestro <a href="${BRAND.sitio}/pages/privacidad.html" target="_blank" rel="noopener">aviso de privacidad</a>.</p>
        <div class="ficha__acciones"><button class="btn btn--ghost ficha__despues" type="button">Ahora no</button><button class="btn btn--brand btn--lg" type="submit">Guardar mi ficha <i data-lucide="arrow-right" class="i"></i></button></div>
      </form>
    </section>`;
  document.body.appendChild(root);
  createIcons({ icons });

  const cerrar = () => { omitidaEnSesion = true; root.remove(); };
  root.querySelector('.ficha__cerrar')?.addEventListener('click', cerrar);
  root.querySelector('.ficha__despues')?.addEventListener('click', cerrar);
  root.addEventListener('click', (e) => { if (e.target === root) cerrar(); });
  root.querySelector<HTMLInputElement>('[name="whatsapp"]')?.focus();

  root.querySelector<HTMLFormElement>('.ficha__form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const boton = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
    const error = form.querySelector<HTMLElement>('.ficha__error')!;
    const d = new FormData(form);
    boton.disabled = true; boton.textContent = 'Guardando…'; error.hidden = true;
    try {
      const guardado = await api<PerfilRemoto>('/me/perfil', { method: 'PATCH', json: {
        nombre: String(d.get('nombre') || '').trim(),
        whatsapp: String(d.get('whatsapp') || '').trim(),
        especialidad: String(d.get('especialidad') || '').trim(),
        ciudad: String(d.get('ciudad') || '').trim(),
      } });
      Perfil.set(guardado);
      celebrar('normal');
      root.classList.add('ficha--out');
      setTimeout(() => { root.remove(); alGuardar?.(); }, 220);
    } catch (err) {
      error.textContent = mensajeError(err); error.hidden = false;
      boton.disabled = false; boton.innerHTML = 'Guardar mi ficha <i data-lucide="arrow-right" class="i"></i>'; createIcons({ icons });
    }
  });
}
