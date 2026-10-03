import type { LandingContent } from '../core/types';
import { icon } from '../ui/icons';

const navigation = [
  ['inicio-club', 'Inicio'],
  ['mis-cursos', 'Mis cursos'],
  ['biblioteca', 'Biblioteca'],
  ['encuentros', 'Encuentros'],
] as const;

const courseCard = (course: LandingContent['courses'][number], position: number): string => `
  <article class="member-course member-course--${course.tone}">
    <div class="member-course__image">
      <img src="${course.image}" alt="${course.alt}" width="1024" height="1536" loading="lazy" />
      <span>${course.index}</span>
    </div>
    <div class="member-course__body">
      <p>${course.tags.join(' · ')}</p>
      <h3>${course.title}</h3>
      <div class="member-course__meta"><span>${position === 0 ? 'Clase inicial disponible' : 'Recorrido disponible'}</span><i></i></div>
      <button type="button" data-course-open="${position}">${position === 0 ? 'Abrir clase inicial' : 'Ver recorrido'} ${icon('arrow')}</button>
    </div>
  </article>`;

export const renderClub = (content: LandingContent): string => `
  <div class="club-shell">
    <aside class="club-sidebar" data-sidebar>
      <a class="club-brand" href="/" aria-label="Dermalysse, volver a la portada">
        <span>${icon('drop')}</span><strong>Dermalysse</strong>
      </a>
      <p class="club-sidebar__label">The Beauty Knowledge Club</p>
      <nav aria-label="Navegación del club">
        ${navigation.map(([id, label], index) => `<a href="#${id}"${index === 0 ? ' class="is-active"' : ''} data-club-nav><span>0${index + 1}</span>${label}</a>`).join('')}
      </nav>
      <div class="club-sidebar__footer">
        <span class="status-dot"></span>
        <div><strong>Vista local</strong><small>Sin servicios conectados</small></div>
      </div>
    </aside>

    <main class="club-main" id="club-content">
      <header class="club-topbar">
        <button class="club-menu" type="button" aria-label="Abrir menú del club" aria-expanded="false" data-sidebar-toggle>${icon('menu')}</button>
        <p>Mi espacio de aprendizaje</p>
        <div class="club-profile"><span>Sesión local</span><i>DL</i></div>
      </header>

      <section class="member-hero" id="inicio-club">
        <div class="member-hero__copy">
          <p class="club-kicker">Bienvenida a tu espacio</p>
          <h1>Aprender también<br /><em>es una forma de cuidar.</em></h1>
          <p>Tu recorrido Dermalysse reúne conocimiento, práctica y materiales en una experiencia pensada para avanzar con intención.</p>
          <a class="club-primary" href="#mis-cursos">Continuar mi recorrido ${icon('arrow')}</a>
        </div>
        <div class="member-hero__feature">
          <img src="/media/hero-model.png" alt="Retrato editorial Dermalysse" width="1024" height="1536" />
          <div class="feature-card">
            <span>Ahora disponible</span>
            <strong>Primera clase abierta</strong>
            <button type="button" data-course-open="0" aria-label="Abrir primera clase">${icon('play')}</button>
          </div>
        </div>
      </section>

      <section class="member-section" id="mis-cursos">
        <header class="member-heading">
          <div><p class="club-kicker">Tu formación</p><h2>Continúa donde <em>tu curiosidad</em> te lleve.</h2></div>
          <p>En esta vista local puedes recorrer la estructura del club. El avance real se activará cuando integremos las cuentas.</p>
        </header>
        <div class="member-course-grid">${content.courses.map(courseCard).join('')}</div>
      </section>

      <section class="library" id="biblioteca">
        <div class="library__intro">
          <p class="club-kicker">Biblioteca clínica</p>
          <h2>Tu mesa de consulta,<br /><em>siempre ordenada.</em></h2>
          <p>La estructura está lista para reunir materiales educativos sin mezclar contenido clínico no validado.</p>
        </div>
        <div class="library__grid">
          <button type="button" data-coming-soon><span>01</span><strong>Protocolos educativos</strong><small>Próximamente al conectar contenido</small>${icon('arrow')}</button>
          <button type="button" data-coming-soon><span>02</span><strong>Guías de consulta</strong><small>Próximamente al conectar contenido</small>${icon('arrow')}</button>
          <button type="button" data-coming-soon><span>03</span><strong>Material descargable</strong><small>Próximamente al conectar contenido</small>${icon('arrow')}</button>
        </div>
      </section>

      <section class="encounters" id="encuentros">
        <div><p class="club-kicker">Encuentros</p><h2>Aprender<br /><em>en compañía.</em></h2></div>
        <div class="encounters__card">
          <span>Calendario local</span>
          <p>Los eventos reales aparecerán aquí al conectar la agenda confirmada de Dermalysse.</p>
          <button type="button" data-coming-soon>Ver estructura del calendario ${icon('arrow')}</button>
        </div>
      </section>

      <footer class="club-footer"><span>Dermalysse · Club local 2026</span><a href="/">Volver a la portada</a></footer>
    </main>

    <div class="club-toast" role="status" aria-live="polite" data-club-toast hidden></div>

    <dialog class="lesson-dialog" data-lesson-dialog aria-labelledby="lesson-title">
      <button class="lesson-dialog__close" type="button" aria-label="Cerrar clase" data-lesson-close>${icon('close')}</button>
      <div class="lesson-dialog__media"><img data-lesson-image src="/media/piel-sin-cicatrices.png" alt="" width="1024" height="1536" /></div>
      <div class="lesson-dialog__content">
        <p class="club-kicker" data-lesson-tags>Dermapen · Acné · Reparación</p>
        <h2 id="lesson-title" data-lesson-title>Piel sin cicatrices</h2>
        <p>Esta es la experiencia interna de muestra. La clase inicial usa medios locales y no registra progreso real todavía.</p>
        <video controls playsinline preload="metadata" poster="/media/preview-poster.jpg">
          <source src="/media/preview.mp4" type="video/mp4" />
          <track kind="captions" src="/media/preview-captions.vtt" srclang="es" label="Español" default />
        </video>
        <div class="lesson-dialog__notice"><span class="status-dot"></span> Modo local · progreso no sincronizado</div>
      </div>
    </dialog>
  </div>`;
