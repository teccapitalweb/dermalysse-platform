import type { LandingContent } from './types';
import { icon } from './icons';

const courseCard = (course: LandingContent['courses'][number]): string => `
  <article class="course-card course-card--${course.tone}" data-reveal>
    <div class="course-card__media" aria-hidden="true">
      <span class="course-card__index">${course.index}</span>
      <span class="course-card__mark">D</span>
      <span class="course-card__access">Clase inicial abierta</span>
    </div>
    <div class="course-card__body">
      <p>${course.tags.join(' · ')}</p>
      <h3>${course.title}</h3>
      <button class="text-link" type="button" data-preview-open>
        Ver introducción ${icon('arrow')}
      </button>
    </div>
  </article>`;

const clubItem = (item: LandingContent['club'][number], active: boolean): string => `
  <button class="club-list__item${active ? ' is-active' : ''}" type="button" data-club-index="${item.index}" aria-pressed="${active}">
    <span>${item.index}</span>
    <strong>${item.title}</strong>
    ${icon('arrow')}
  </button>`;

export const renderLanding = (content: LandingContent): string => `
  <div class="site-shell">
    <div class="edition-bar" aria-label="Edición actual">
      <span>DERMALYSSE / 2026</span>
      <span class="edition-bar__center">Formación para una práctica más consciente</span>
      <span>VOL. 01</span>
    </div>

    <header class="site-header" data-header>
      <a class="brand" href="#inicio" aria-label="Dermalysse, volver al inicio">
        <span class="brand__drop">${icon('drop')}</span><span class="brand__word">Dermalysse</span>
      </a>
      <nav class="site-nav" id="site-navigation" aria-label="Navegación principal" data-navigation>
        <a href="#mirada">Nuestra mirada</a>
        <a href="#formacion">Formación</a>
        <a href="#club">El club</a>
        <a class="button button--small" href="/club/" data-local-cta>Entrar al club ${icon('arrow')}</a>
      </nav>
      <button class="menu-button" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="site-navigation" data-menu>
        <span class="menu-button__open">${icon('menu')}</span>
        <span class="menu-button__close">${icon('close')}</span>
      </button>
    </header>

    <aside class="site-progress" aria-hidden="true" data-site-progress>
      <span data-progress-number>00</span>
      <i><b data-progress-bar></b></i>
      <em data-progress-label>Portada</em>
    </aside>

    <main id="contenido">
      <section class="hero" id="inicio" data-chapter="00" data-chapter-title="Portada" data-motion-section>
        <div class="hero__copy">
          <p class="eyebrow"><span>${icon('spark')}</span>${content.brand.eyebrow}</p>
          <p class="hero__quote">“Science becomes intuition.”</p>
          <h1>
            <span>${content.brand.headline[0]}</span>
            <em>${content.brand.headline[1]}</em>
            <span>${content.brand.headline[2]}</span>
          </h1>
          <div class="hero__intro">
            <p>${content.brand.intro}</p>
            <div class="hero__actions">
              <a class="button" href="#formacion">Descubrir la formación ${icon('arrow')}</a>
              <button class="button button--ghost" type="button" data-preview-open>${icon('play')} Ver clase abierta</button>
            </div>
          </div>
          <ul class="hero__proof" aria-label="Características confirmadas">
            <li>${icon('check')} Primera clase abierta</li>
            <li>${icon('check')} Aprende a tu ritmo</li>
            <li>${icon('check')} Experiencia educativa</li>
          </ul>
        </div>

        <div class="hero__visual" data-hero-visual>
          <img class="hero__campaign" src="/media/dermalysse-hero-rose.jpg" alt="Retrato editorial Dermalysse de una mujer con los ojos cerrados" width="2752" height="1536" />
          <div class="hero__note"><span>01</span><p>The skin edit<br />Dermalysse 2026</p></div>
        </div>

        <a class="hero__scroll" href="#mirada"><span>Desliza para explorar</span><i></i></a>
      </section>

      <section class="manifesto" id="mirada">
        <div class="manifesto__stage" data-chapter="01" data-chapter-title="Nuestra mirada" data-motion-section>
          <div class="section-label"><span>01</span><p>Nuestra mirada</p></div>
          <div class="manifesto__title" data-reveal>
            <p class="eyebrow">Beauty, but make it smart</p>
            <h2>No es solo <em>skincare.</em><br />Es criterio.</h2>
          </div>
          <div class="manifesto__copy" data-reveal>
            <p>${content.brand.manifesto}</p>
            <div class="manifesto__steps" aria-label="Enfoque Dermalysse">
              <span>Observar</span><i></i><span>Comprender</span><i></i><span>Aplicar</span>
            </div>
          </div>
          <div class="manifesto__letter" aria-hidden="true">D</div>
        </div>
      </section>

      <section class="skin-intelligence" id="metodo" data-skin data-chapter="02" data-chapter-title="Método" data-motion-section>
        <div class="skin-intelligence__stage">
          <img class="skin-intelligence__image" src="/media/dermalysse-learning-rose.jpg" alt="Mujer tocando suavemente su rostro" loading="lazy" width="1376" height="768" />
          <div class="skin-intelligence__veil" aria-hidden="true"></div>
          <div class="skin-intelligence__layer" aria-hidden="true">
            <span>02</span>
            <i></i>
            <small>Skin intelligence</small>
          </div>
          <div class="skin-intelligence__intro" data-reveal>
            <div class="section-label"><span>02</span><p>Skin intelligence</p></div>
            <p class="eyebrow">Learning in layers</p>
            <h2>Aprender a mirar<br /><em>cambia todo.</em></h2>
          </div>

          <div class="skin-intelligence__steps" role="group" aria-label="Método Dermalysse">
            <button class="skin-step is-active" type="button" aria-pressed="true" data-skin-step="0">
              <span>01</span><strong>Lectura de la piel</strong><small>Textura, contexto y señales visibles.</small>
            </button>
            <button class="skin-step" type="button" aria-pressed="false" data-skin-step="1">
              <span>02</span><strong>Activos con intención</strong><small>Comprende qué elegir y por qué.</small>
            </button>
            <button class="skin-step" type="button" aria-pressed="false" data-skin-step="2">
              <span>03</span><strong>Protocolos seguros</strong><small>Ordena cada paso con criterio.</small>
            </button>
            <button class="skin-step" type="button" aria-pressed="false" data-skin-step="3">
              <span>04</span><strong>Seguimiento real</strong><small>Evalúa cambios y ajusta decisiones.</small>
            </button>
          </div>
          <p class="skin-intelligence__caption">Una secuencia clara para convertir información en decisiones profesionales.</p>
        </div>
      </section>

      <section class="courses" id="formacion" data-chapter="03" data-chapter-title="Formación" data-motion-section>
        <div class="section-heading" data-reveal>
          <div class="section-label"><span>03</span><p>Formación</p></div>
          <div><p class="eyebrow">Curated for your practice</p><h2>The course <em>edit.</em></h2></div>
          <p>Recorre el enfoque de cada curso y abre su primera clase. El conocimiento empieza antes de la membresía.</p>
        </div>
        <div class="course-grid">${content.courses.map(courseCard).join('')}</div>
      </section>

      <section class="club" id="club" data-chapter="04" data-chapter-title="El club" data-motion-section>
        <div class="club__intro" data-reveal>
          <div class="section-label section-label--light"><span>04</span><p>El club</p></div>
          <p class="eyebrow">Your beauty intelligence era</p>
          <h2>Todo tu aprendizaje,<br /><em>en un mismo lugar.</em></h2>
          <p>Explora cursos, materiales y herramientas educativas desde una experiencia organizada para acompañar tu evolución profesional.</p>
          <a class="button button--light" href="/club/" data-local-cta>Conocer el club ${icon('arrow')}</a>
        </div>
        <div class="club__experience" data-reveal>
          <div class="club-list">${content.club.map((item, index) => clubItem(item, index === 0)).join('')}</div>
          <div class="club-focus" aria-live="polite" data-club-focus>
            <span data-club-number>${content.club[0].index}</span>
            <div><p>Dentro de Dermalysse</p><h3 data-club-title>${content.club[0].title}</h3><p data-club-summary>${content.club[0].summary}</p></div>
          </div>
        </div>
      </section>

      <section class="closing" data-chapter="05" data-chapter-title="Siguiente era" data-motion-section>
        <img class="closing__image" src="/media/dermalysse-paper-rose.jpg" alt="Primer plano editorial de piel visto a través de papel rasgado" loading="lazy" width="2752" height="1536" />
        <div class="closing__veil" aria-hidden="true"></div>
        <div class="closing__copy" data-reveal>
          <p class="eyebrow">From knowledge to practice</p>
          <h2>Del conocimiento<br /><em>a tu práctica.</em></h2>
          <p>Aprende a observar, comprender y decidir con mayor criterio profesional. Contenido educativo que no sustituye una valoración médica.</p>
          <a class="button" href="/club/" data-local-cta>Explorar Dermalysse ${icon('arrow')}</a>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <a class="brand brand--footer" href="#inicio" aria-label="Dermalysse, volver al inicio"><span class="brand__drop">${icon('drop')}</span><span class="brand__word">Dermalysse</span></a>
      <p>Consultoría en Dermatología &amp; Estética</p>
      <nav aria-label="Navegación de pie"><a href="#mirada">Nuestra mirada</a><a href="#formacion">Formación</a><a href="#club">El club</a></nav>
      <small>Dermalysse · 2026 · Prototipo local</small>
    </footer>

    <dialog class="preview" data-preview aria-labelledby="preview-title">
      <div class="preview__visual"><img src="/media/hidrafacial.png" alt="Tratamiento hidrafacial profesional" width="1024" height="1536" /></div>
      <div class="preview__content">
        <button class="preview__close" type="button" aria-label="Cerrar vista previa" data-preview-close>${icon('close')}</button>
        <p class="eyebrow">Complimentary class / 01</p>
        <h2 id="preview-title">Tu primera clase,<br /><em>on us.</em></h2>
        <p>Explora el enfoque Dermalysse. La integración con el club real se realizará en una etapa posterior.</p>
        <video controls playsinline preload="metadata" poster="/media/preview-poster.jpg">
          <source src="/media/preview.mp4" type="video/mp4" />
          <track kind="captions" src="/media/preview-captions.vtt" srclang="es" label="Español" default />
        </video>
      </div>
    </dialog>
  </div>`;
