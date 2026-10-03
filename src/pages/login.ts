import { Datos } from '../core/datos';

export function login(_: Record<string, string>, query: URLSearchParams) {
  const modo = query.get('modo') === 'registro' ? 'registro' : query.get('modo') === 'recuperar' ? 'recuperar' : 'entrar';

  const google = `<button type="button" class="login__google" data-login-google><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.35 11.1H12v2.9h5.4c-.25 1.4-1 2.6-2.1 3.4v2.8h3.4c2-1.85 3.15-4.55 3.15-7.75 0-.65-.05-1.1-.5-1.35z"/><path fill="#34A853" d="M12 22c2.85 0 5.25-.95 7-2.55l-3.4-2.8c-.95.65-2.15 1.05-3.6 1.05-2.75 0-5.1-1.85-5.95-4.4H2.55v2.9C4.3 19.6 7.85 22 12 22z"/><path fill="#FBBC05" d="M6.05 13.3c-.2-.65-.35-1.3-.35-2s.15-1.35.35-2V6.4H2.55A9.9 9.9 0 0 0 2 11.3c0 1.6.4 3.1 1.05 4.5l3-2.5z"/><path fill="#EA4335" d="M12 5.9c1.55 0 2.95.55 4.05 1.6l3-3C17.25 2.85 14.85 2 12 2 7.85 2 4.3 4.4 2.55 7.9l3.5 2.9C6.9 8.25 9.25 5.9 12 5.9z"/></svg>Continuar con Google</button>`;

  const formEntrar = `
    <div class="login__modo" data-modo="entrar">
      <div><h1 class="display display--black">Qué bueno <em>verte</em></h1><p class="muted" style="margin-top:8px">Entra para continuar donde te quedaste.</p></div>
      ${google}
      <div class="login__or">o con tu correo</div>
      <form class="stack" style="gap:12px" data-login-form="entrar">
        <input class="input" name="email" type="email" placeholder="Correo electrónico" required autocomplete="email">
        <input class="input" name="pass" type="password" placeholder="Contraseña" required minlength="6" autocomplete="current-password">
        <p class="login__error" data-login-error hidden></p>
        <button class="btn btn--brand btn--lg btn--pill-arrow" style="justify-content:space-between">Entrar <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span></button>
      </form>
      <p class="faint login__alt"><a href="#/login?modo=recuperar" data-login-modo="recuperar">¿Olvidaste tu contraseña?</a> · ¿No tienes cuenta? <a href="#/login?modo=registro" data-login-modo="registro">Regístrate</a></p>
    </div>`;

  const formRegistro = `
    <div class="login__modo" data-modo="registro">
      <div><h1 class="display display--black">Empieza tu <em>formación</em></h1><p class="muted" style="margin-top:8px">Crea tu cuenta y explora las clases iniciales disponibles del catálogo Dermalysse.</p></div>
      ${google}
      <div class="login__or">o con tu correo</div>
      <form class="stack" style="gap:12px" data-login-form="registro">
        <input class="input" name="nombre" placeholder="Nombre completo (así saldrá en tus certificados)" required autocomplete="name">
        <input class="input" name="email" type="email" placeholder="Correo electrónico" required autocomplete="email">
        <input class="input" name="pass" type="password" placeholder="Contraseña" required minlength="6" autocomplete="new-password">
        <p class="login__error" data-login-error hidden></p>
        <button class="btn btn--brand btn--lg btn--pill-arrow" style="justify-content:space-between">Crear mi cuenta <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span></button>
      </form>
      <p class="faint login__alt">¿Ya tienes cuenta? <a href="#/login" data-login-modo="entrar">Inicia sesión</a></p>
    </div>`;

  const formRecuperar = `
    <div class="login__modo" data-modo="recuperar">
      <div><h1 class="display display--black">Recupera tu <em>acceso</em></h1><p class="muted" style="margin-top:8px">Te enviamos un enlace para crear una contraseña nueva.</p></div>
      <form class="stack" style="gap:12px" data-login-form="recuperar">
        <input class="input" name="email" type="email" placeholder="Correo electrónico" required autocomplete="email">
        <p class="login__error" data-login-error hidden></p>
        <button class="btn btn--brand btn--lg btn--pill-arrow" style="justify-content:space-between">Enviar enlace <span class="arrow"><i data-lucide="send" class="i"></i></span></button>
      </form>
      <p class="faint login__alt"><a href="#/login" data-login-modo="entrar">Volver a iniciar sesión</a></p>
    </div>`;

  const demoBlock = `
    <div class="login__demo"><i data-lucide="flask-conical" class="i"></i><div><strong>Versión de demostración</strong><br>El inicio de sesión real se activa al conectar el backend. Entra al demo para recorrer el club y el admin.</div></div>
    <button class="btn btn--gradient btn--lg btn--pill-arrow" style="justify-content:space-between" data-login-demo>Entrar al demo <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span></button>`;

  return `
  <div class="login-page">
    <div class="login">
      <div class="login__visual">
        <img class="login__visual-bg" src="/media/hero-model.png" alt="">
        <div class="login__visual-content">
          <h2 class="login__visual-title">Tu formación Dermalysse<br>empieza <em>aquí</em></h2>
          <ul class="login__benefits">
            <li>
              <span class="login__benefit-ic"><i data-lucide="play-circle" class="i"></i></span>
              <div><strong>Cursos y clases grabadas</strong><span>Aprende a tu ritmo con contenido especializado</span></div>
            </li>
            <li>
              <span class="login__benefit-ic"><i data-lucide="award" class="i"></i></span>
              <div><strong>Certificados verificables</strong><span>Acredita tu formación con folio único</span></div>
            </li>
            <li>
              <span class="login__benefit-ic"><i data-lucide="radio" class="i"></i></span>
              <div><strong>Comunidad Dermalysse</strong><span>Comparte aprendizajes y dudas con la comunidad</span></div>
            </li>
            <li>
              <span class="login__benefit-ic"><i data-lucide="library" class="i"></i></span>
              <div><strong>Biblioteca de estudio</strong><span>Guías y formatos para acompañar tu formación</span></div>
            </li>
          </ul>
          <p class="login__visual-badge">Formación, comunidad y progreso en un mismo espacio</p>
        </div>
      </div>
      <div class="login__form" data-login-panel data-modo-activo="${modo}">
        <img data-logo src="/brand/dermalysse-horizontal.svg" alt="Dermalysse" style="height:38px;width:auto;align-self:flex-start">
        ${Datos.modo === 'demo' ? demoBlock : `${formEntrar}${formRegistro}${formRecuperar}`}
      </div>
    </div>
  </div>`;
}
