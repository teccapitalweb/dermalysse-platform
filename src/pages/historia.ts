import type { Params } from '../core/router';

export function historia(_params: Params) {
  return `<section class="story-page"><div id="historia-app"><div class="story-map story-map--preview">
    <a class="story-map__back game-back" href="#/retos" aria-label="Volver a Retos"><i data-lucide="arrow-left" class="i"></i><span>Volver a Retos</span></a>
    <header class="story-map-hero story-map-hero--premium">
      <div class="story-map-hero__copy">
        <span class="story-kicker story-kicker--light"><i data-lucide="route" class="i"></i>Modo Historia · Próximamente</span>
        <h1 class="display">Cada decisión abre <em>un nuevo capítulo.</em></h1>
        <p>Una experiencia narrativa para conectar observación, criterio y comunicación responsable. Los casos se habilitarán únicamente después de su revisión académica.</p>
        <div class="story-map-hero__meta"><span><i data-lucide="book-open" class="i"></i>Capítulos breves</span><span><i data-lucide="git-branch" class="i"></i>Decisiones guiadas</span><span><i data-lucide="shield-check" class="i"></i>Contenido revisado</span></div>
        <div class="story-map-hero__actions"><a class="btn btn--light btn--lg" href="#/cursos">Prepararme con los cursos <i data-lucide="arrow-right" class="i"></i></a><span>Sin diagnósticos ni casos de pacientes reales.</span></div>
      </div>
      <div class="story-map-hero__visual" aria-hidden="true"><span class="story-map-hero__number">04</span><span class="story-map-hero__orbit"></span><img src="/media/retos/modo-historia.webp" alt="" decoding="async"><div><small>PRIMER MUNDO</small><strong>En revisión editorial</strong></div></div>
    </header>

    <section class="story-preview-grid">
      <article class="story-preview-map">
        <header><div><span class="eyebrow">Mapa de aprendizaje</span><h2>El viaje que estamos preparando</h2></div><span class="story-status"><i></i>Contenido en revisión</span></header>
        <div class="story-preview-route" aria-label="Ruta futura de tres capítulos">
          <article class="story-preview-node is-current"><span class="story-preview-node__orb"><i data-lucide="scan-search" class="i"></i><b>01</b></span><div><small>Capítulo 01</small><strong>Observa el contexto</strong><p>Reconocer información relevante antes de decidir.</p><em>En revisión</em></div></article>
          <span class="story-preview-line"><i></i></span>
          <article class="story-preview-node"><span class="story-preview-node__orb"><i data-lucide="messages-square" class="i"></i><b>02</b></span><div><small>Capítulo 02</small><strong>Formula preguntas</strong><p>Convertir dudas en una conversación ordenada.</p><em>Próximamente</em></div></article>
          <span class="story-preview-line"><i></i></span>
          <article class="story-preview-node"><span class="story-preview-node__orb"><i data-lucide="route" class="i"></i><b>03</b></span><div><small>Capítulo 03</small><strong>Elige con criterio</strong><p>Comparar alternativas y justificar la decisión.</p><em>Próximamente</em></div></article>
        </div>
      </article>

      <aside class="story-preview-side">
        <section class="story-preview-card story-preview-card--dark"><span class="story-preview-card__icon"><i data-lucide="sparkles" class="i"></i></span><small>Así se sentirá</small><h2>Una historia que responde a tus elecciones.</h2><p>Cada escena presentará contexto, opciones y una explicación educativa al cerrar la decisión.</p><div class="story-preview-card__steps"><span><b>1</b>Observa</span><i></i><span><b>2</b>Decide</span><i></i><span><b>3</b>Reflexiona</span></div></section>
        <section class="story-preview-card"><div class="story-preview-card__row"><span><i data-lucide="shield-check" class="i"></i></span><div><small>Compromiso Dermalysse</small><strong>Primero la revisión académica</strong></div></div><p>No mostraremos recomendaciones clínicas, diagnósticos ni promesas de resultados como parte de una dinámica de juego.</p></section>
      </aside>
    </section>
  </div></div></section>`;
}

export function montarHistoria() {}
