import { Datos } from '../core/datos';
import { cursos } from '../core/catalogo';
import { esc } from '../ui/partials';

export function login(_: Record<string, string>, query: URLSearchParams) {
  const modo = query.get('modo') === 'registro' ? 'registro' : query.get('modo') === 'recuperar' ? 'recuperar' : 'entrar';
  const vistaPrevia = query.get('vista') === '1';
  const demo = Datos.modo === 'demo';

  const google = `<button type="button" class="login__google" ${demo ? 'data-login-demo' : 'data-login-google'}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 11.1H12v2.9h5.4c-.25 1.4-1 2.6-2.1 3.4v2.8h3.4c2-1.85 3.15-4.55 3.15-7.75 0-.65-.05-1.1-.5-1.35z"/><path fill="#34A853" d="M12 22c2.85 0 5.25-.95 7-2.55l-3.4-2.8c-.95.65-2.15 1.05-3.6 1.05-2.75 0-5.1-1.85-5.95-4.4H2.55v2.9C4.3 19.6 7.85 22 12 22z"/><path fill="#FBBC05" d="M6.05 13.3c-.2-.65-.35-1.3-.35-2s.15-1.35.35-2V6.4H2.55A9.9 9.9 0 0 0 2 11.3c0 1.6.4 3.1 1.05 4.5l3-2.5z"/><path fill="#EA4335" d="M12 5.9c1.55 0 2.95.55 4.05 1.6l3-3C17.25 2.85 14.85 2 12 2 7.85 2 4.3 4.4 2.55 7.9l3.5 2.9C6.9 8.25 9.25 5.9 12 5.9z"/></svg>${demo ? 'Explorar acceso con Google' : 'Continuar con Google'}</button>`;

  const campo = (icono: string, etiqueta: string, input: string) => `<label class="login-field"><span>${esc(etiqueta)}</span><div><i data-lucide="${esc(icono)}" class="i"></i>${input}</div></label>`;

  const formEntrar = `
    <div class="login__modo" data-modo="entrar">
      <div class="login__intro"><span>Bienvenida de nuevo</span><h1>Continúa donde <em>lo dejaste.</em></h1><p>Tu avance, materiales y comunidad te esperan.</p></div>
      ${google}
      <div class="login__or">o continúa con tu correo</div>
      <form class="login__fields" data-login-form="entrar">
        ${campo('mail', 'Correo electrónico', '<input name="email" type="email" placeholder="nombre@correo.com" required autocomplete="email">')}
        ${campo('lock-keyhole', 'Contraseña', '<input name="pass" type="password" placeholder="Mínimo 6 caracteres" required minlength="6" autocomplete="current-password">')}
        <a class="login__forgot" href="#/login?modo=recuperar${vistaPrevia ? '&vista=1' : ''}" data-login-modo="recuperar">¿Olvidaste tu contraseña?</a>
        <p class="login__error" data-login-error hidden></p>
        <button class="login__submit" ${demo ? 'type="button" data-login-demo' : 'type="submit"'}><span>${demo ? 'Entrar al club demo' : 'Entrar al club'}</span><i data-lucide="arrow-right" class="i"></i></button>
      </form>
      <p class="login__alt">¿Aún no tienes cuenta? <a href="#/login?modo=registro${vistaPrevia ? '&vista=1' : ''}" data-login-modo="registro">Crear cuenta</a></p>
    </div>`;

  const formRegistro = `
    <div class="login__modo" data-modo="registro">
      <div class="login__intro"><span>Tu espacio profesional</span><h1>Comienza a formar <em>tu criterio.</em></h1><p>Crea tu acceso y descubre la experiencia educativa Dermalysse.</p></div>
      ${google}
      <div class="login__or">o regístrate con tu correo</div>
      <form class="login__fields" data-login-form="registro">
        ${campo('user-round', 'Nombre completo', '<input name="nombre" placeholder="Como aparecerá en tus certificados" required autocomplete="name">')}
        ${campo('mail', 'Correo electrónico', '<input name="email" type="email" placeholder="nombre@correo.com" required autocomplete="email">')}
        ${campo('lock-keyhole', 'Crea una contraseña', '<input name="pass" type="password" placeholder="Mínimo 6 caracteres" required minlength="6" autocomplete="new-password">')}
        <p class="login__error" data-login-error hidden></p>
        <button class="login__submit" ${demo ? 'type="button" data-login-demo' : 'type="submit"'}><span>${demo ? 'Explorar registro demo' : 'Crear mi cuenta'}</span><i data-lucide="arrow-right" class="i"></i></button>
      </form>
      <p class="login__legal">Al continuar, aceptas los términos y el aviso de privacidad aplicables.</p>
      <p class="login__alt">¿Ya tienes cuenta? <a href="#/login${vistaPrevia ? '?vista=1' : ''}" data-login-modo="entrar">Iniciar sesión</a></p>
    </div>`;

  const formRecuperar = `
    <div class="login__modo" data-modo="recuperar">
      <div class="login__recovery-icon"><i data-lucide="key-round" class="i"></i></div>
      <div class="login__intro"><span>Recuperar acceso</span><h1>Volvamos a <em>tu cuenta.</em></h1><p>Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</p></div>
      <form class="login__fields" data-login-form="recuperar">
        ${campo('mail', 'Correo electrónico', '<input name="email" type="email" placeholder="nombre@correo.com" required autocomplete="email">')}
        <p class="login__error" data-login-error hidden></p>
        <button class="login__submit" ${demo ? 'type="button" data-login-demo' : 'type="submit"'}><span>${demo ? 'Volver al acceso demo' : 'Enviar enlace'}</span><i data-lucide="send" class="i"></i></button>
      </form>
      <p class="login__alt"><a href="#/login${vistaPrevia ? '?vista=1' : ''}" data-login-modo="entrar"><i data-lucide="arrow-left" class="i"></i>Volver a iniciar sesión</a></p>
    </div>`;

  const demoBlock = demo ? `<div class="login__demo-note"><i data-lucide="flask-conical" class="i"></i><p><strong>Vista local de demostración</strong><span>Los botones abren el demo; no crean cuentas ni envían correos reales.</span></p></div>` : '';

  return `
  <div class="login-page">
    <div class="login">
      <section class="login__access">
        <div class="login__brandbar"><img data-logo src="/brand/dermalysse-horizontal.svg" alt="Dermalysse"><a href="${vistaPrevia ? '#/' : '/'}"><i data-lucide="arrow-left" class="i"></i>${vistaPrevia ? 'Volver al club' : 'Volver al inicio'}</a></div>
        <div class="login__form" data-login-panel data-modo-activo="${esc(modo)}" data-login-preview="${vistaPrevia}">
          <nav class="login__switch" aria-label="Opciones de acceso">
            <a class="${modo === 'entrar' ? 'is-active' : ''}" href="#/login${vistaPrevia ? '?vista=1' : ''}" data-login-modo="entrar">Iniciar sesión</a>
            <a class="${modo === 'registro' ? 'is-active' : ''}" href="#/login?modo=registro${vistaPrevia ? '&vista=1' : ''}" data-login-modo="registro">Crear cuenta</a>
          </nav>
          ${demoBlock}${formEntrar}${formRegistro}${formRecuperar}
        </div>
        <footer class="login__access-foot"><span><i data-lucide="shield-check" class="i"></i>Acceso protegido</span><span>© ${new Date().getFullYear()} Dermalysse</span></footer>
      </section>
      <section class="login__visual">
        <img class="login__visual-bg" src="/media/dermalysse-guia-lia-v1.png" alt="">
        <div class="login__visual-content">
          <span class="login__visual-kicker"><i data-lucide="sparkles" class="i"></i>Membresía Dermalysse</span>
          <h2 class="login__visual-title">Más que cursos:<br><em>un sistema para avanzar.</em></h2>
          <p class="login__visual-lead">Formación, práctica y seguimiento reunidos en una experiencia pensada para profesionales.</p>
          <ul class="login__benefits">
            <li>
              <span class="login__benefit-ic"><i data-lucide="circle-play" class="i"></i></span>
              <div><strong>Formación a tu ritmo</strong><span>${cursos.length} cursos organizados por áreas y clases breves.</span></div>
            </li>
            <li>
              <span class="login__benefit-ic"><i data-lucide="award" class="i"></i></span>
              <div><strong>Credenciales digitales</strong><span>Certificados con folio y verificación cuando corresponda.</span></div>
            </li>
            <li>
              <span class="login__benefit-ic"><i data-lucide="trophy" class="i"></i></span>
              <div><strong>Retos y progreso visible</strong><span>Practica, gana experiencia y sigue tu constancia.</span></div>
            </li>
            <li>
              <span class="login__benefit-ic"><i data-lucide="library" class="i"></i></span>
              <div><strong>Biblioteca de apoyo</strong><span>Materiales para acompañar tu aprendizaje profesional.</span></div>
            </li>
          </ul>
          <div class="login__visual-proof"><div><span class="login__proof-icons"><i data-lucide="book-open" class="i"></i><i data-lucide="message-circle" class="i"></i><i data-lucide="badge-check" class="i"></i></span><p><strong>Todo en un mismo lugar</strong><span>Catálogo, comunidad, biblioteca y logros.</span></p></div><span>Aprende · practica · avanza</span></div>
        </div>
      </section>
    </div>
  </div>`;
}
