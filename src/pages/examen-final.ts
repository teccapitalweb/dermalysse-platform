import { curso as getCurso } from '../core/catalogo';
import { Progreso } from '../core/progreso';
import { esc, placeholder } from '../ui/partials';
import { generarExamen, resultadoExamen } from '../core/examen-final';

export function examenFinal(params: Record<string, string>) {
  const c = getCurso(params.id);
  if (!c) return placeholder('Curso no encontrado', 'Revisa el catálogo de cursos.', 'search-x');

  if (!Progreso.completado(c)) {
    return `<section class="examen-page stack" style="max-width:640px;margin:0 auto;padding:40px 20px">
      <a class="section-head__cta" href="#/curso/${c.id}" style="align-self:flex-start"><span class="circle-btn circle-btn--glass" style="width:34px;height:34px"><i data-lucide="arrow-left" class="i" style="width:15px;height:15px"></i></span>${esc(c.titulo)}</a>
      <div class="card card--pad stack" style="gap:16px;text-align:center;padding:40px 24px">
        <span class="circle-btn" style="width:64px;height:64px;background:var(--surface-3);margin:0 auto"><i data-lucide="lock" class="i" style="width:28px;height:28px"></i></span>
        <h1 class="display" style="font-size:var(--fs-xl)">Completa el curso primero</h1>
        <p class="muted">Necesitas haber visto todas las clases para tomar la evaluación final.</p>
        <div style="max-width:300px;margin:0 auto"><div class="progress progress--thin"><span style="width:${Progreso.porcentaje(c)}%"></span></div><span class="faint" style="font-size:var(--fs-xs)">${Progreso.de(c.id).vistas.length} de ${c.clases.length} clases</span></div>
        <a class="btn btn--brand" href="#/curso/${c.id}">Continuar el curso <i data-lucide="arrow-right" class="i"></i></a>
      </div>
    </section>`;
  }

  const preguntas = generarExamen(c.id);
  if (!preguntas.length) {
    return `<section class="examen-page stack" style="max-width:640px;margin:0 auto;padding:40px 20px">
      <a class="section-head__cta" href="#/curso/${c.id}" style="align-self:flex-start"><span class="circle-btn circle-btn--glass" style="width:34px;height:34px"><i data-lucide="arrow-left" class="i" style="width:15px;height:15px"></i></span>${esc(c.titulo)}</a>
      <div class="card card--pad stack" style="gap:16px;text-align:center;padding:40px 24px">
        <span class="circle-btn" style="width:64px;height:64px;background:var(--accent-soft);color:var(--accent);margin:0 auto"><i data-lucide="clock" class="i" style="width:28px;height:28px"></i></span>
        <h1 class="display" style="font-size:var(--fs-xl)">Evaluación en preparación</h1>
        <p class="muted">Estamos validando las preguntas. Tu evaluación estará lista pronto.</p>
        <a class="btn btn--brand" href="#/curso/${c.id}">Volver al curso</a>
      </div>
    </section>`;
  }

  const historial = resultadoExamen(c.id);
  const minutos = Math.max(1, Math.ceil(preguntas.length * 0.8));

  return `<section class="examen-page" style="max-width:680px;margin:0 auto;padding:40px 20px">
    <a class="section-head__cta" href="#/curso/${c.id}" style="align-self:flex-start;margin-bottom:20px;display:inline-flex;align-items:center;gap:8px;color:inherit"><span class="circle-btn circle-btn--glass" style="width:34px;height:34px"><i data-lucide="arrow-left" class="i" style="width:15px;height:15px"></i></span>${esc(c.titulo)}</a>
    <div class="card card--pad" data-examen-shell data-examen-curso="${c.id}">
      <div class="lesson-quiz__intro" data-examen-intro style="padding:20px 8px">
        <div class="lesson-quiz__visual"><span class="lesson-quiz__brain" style="background:linear-gradient(145deg, var(--accent), var(--gold-600))"><i data-lucide="graduation-cap" class="i"></i></span><span class="lesson-quiz__orbit lesson-quiz__orbit--one"><i data-lucide="check" class="i"></i></span><span class="lesson-quiz__orbit lesson-quiz__orbit--two"><i data-lucide="award" class="i"></i></span></div>
        <span class="quiz-kicker"><i data-lucide="shield-check" class="i"></i>Evaluación final</span>
        <h2>Demuestra lo que aprendiste</h2>
        <p>Responde las preguntas de todo el curso. Al aprobar obtienes tu certificado verificable con folio único.</p>
        <div class="lesson-quiz__facts">
          <span><b>${preguntas.length}</b><small>preguntas</small></span>
          <span><b>${minutos} min</b><small>aprox.</small></span>
          <span><b>70%</b><small>para aprobar</small></span>
        </div>
        ${historial.intentos
          ? `<div class="lesson-quiz__record"><span class="lesson-quiz__record-icon"><i data-lucide="${historial.aprobado ? 'trophy' : 'chart-no-axes-column-increasing'}" class="i"></i></span><span><small>Tu mejor resultado</small><strong>${historial.mejor}% · ${historial.intentos} ${historial.intentos === 1 ? 'intento' : 'intentos'}</strong></span></div>`
          : `<div class="lesson-quiz__reward"><i data-lucide="sparkles" class="i"></i><span><strong>+50 XP</strong> al aprobar por primera vez</span></div>`}
        <button type="button" class="btn btn--brand btn--lg btn--pill-arrow lesson-quiz__start" data-examen-start>Comenzar evaluación <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span></button>
      </div>
      <form class="quiz-run" data-examen-form data-total="${preguntas.length}" hidden>
        <header class="quiz-run__head">
          <div><span class="eyebrow" data-examen-counter>Pregunta 1 de ${preguntas.length}</span><strong>Evaluación final</strong></div>
          <button type="button" class="btn btn--ghost btn--sm" data-examen-exit><i data-lucide="x" class="i"></i>Salir</button>
        </header>
        <div class="quiz-run__progress" role="progressbar"><span data-examen-progress style="width:${100 / preguntas.length}%"></span></div>
        <div class="quiz-run__body">
          ${preguntas.map((p, i) => `<fieldset class="quiz-q" data-pregunta="${i}" ${i ? 'hidden' : ''}>
            <legend class="sr-only">Pregunta ${i + 1}</legend>
            <span class="quiz-q__number">${String(i + 1).padStart(2, '0')}</span>
            <p class="quiz__q">${esc(p.q)}</p>
            <div class="quiz__options">${p.opciones.map((o, j) => `<label class="quiz__opt"><input class="quiz-radio" type="radio" name="ex${i}" value="${j}"><span class="k">${'ABCD'[j]}</span><span>${esc(o)}</span><i data-lucide="circle" class="i quiz__opt-status"></i></label>`).join('')}</div>
            <div class="quiz__feedback" role="status" aria-live="polite" hidden><span class="quiz__feedback-icon"><i data-lucide="lightbulb" class="i"></i></span><div><strong data-examen-feedback-title></strong><p>${esc(p.explicacion)}</p></div></div>
          </fieldset>`).join('')}
        </div>
        <footer class="quiz-run__actions">
          <span class="quiz-run__hint"><i data-lucide="mouse-pointer-click" class="i"></i>Elige una respuesta</span>
          <button type="button" class="btn btn--brand btn--pill-arrow" data-examen-check>Comprobar <span class="arrow"><i data-lucide="check" class="i"></i></span></button>
          <button type="button" class="btn btn--brand btn--pill-arrow" data-examen-next hidden>Siguiente <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span></button>
        </footer>
      </form>
      <div class="quiz-result" data-examen-result aria-live="polite" hidden></div>
    </div>
  </section>`;
}
