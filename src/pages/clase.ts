import { curso as getCurso, LIBRARY_ID, fmtMin } from '../core/catalogo';
import { Progreso } from '../core/progreso';
import { esc, placeholder } from '../ui/partials';
import { Datos, type Clase } from '../core/datos';
import { Acceso } from '../core/acceso';
import { resumenQuiz } from '../core/quiz-clase';

const vacioTab = (icon: string, titulo: string, texto: string, color = 'primary') => `<div class="stack" style="gap:10px;text-align:center;padding:20px 0"><span class="circle-btn" style="width:48px;height:48px;background:var(--${color}-soft);color:var(--${color});margin:0 auto"><i data-lucide="${icon}" class="i"></i></span><strong>${titulo}</strong><p class="muted" style="font-size:var(--fs-sm)">${texto}</p></div>`;

const APUNTES_KEY = 'dermalysse:apuntes:v1';
const DOMINIO_KEY = 'dermalysse:dominio:v1';

function leerApuntes(cursoId: string, n: number): string {
  try { return (JSON.parse(localStorage.getItem(APUNTES_KEY) || '{}') as Record<string, string>)[`${cursoId}:${n}`] || ''; } catch { return ''; }
}
function leerDominio(cursoId: string, n: number, idx: number): number {
  try { return (JSON.parse(localStorage.getItem(DOMINIO_KEY) || '{}') as Record<string, number>)[`${cursoId}:${n}:${idx}`] ?? -1; } catch { return -1; }
}

function notasHTML(k: Clase, cursoId: string, n: number) {
  if (!k.notas) return vacioTab('captions', 'Notas de la clase', 'Resumen y conceptos clave con marca de tiempo. Se generan de la transcripción del video y las revisa Dermalysse.');
  const apuntes = leerApuntes(cursoId, n);
  return `<div class="notas" data-notas-curso="${cursoId}" data-notas-n="${n}">
    <div class="notas__resumen">
      <span class="notas__ic"><i data-lucide="sparkles" class="i"></i></span>
      <div style="flex:1"><span class="eyebrow">Resumen</span><p>${esc(k.notas.resumen)}</p></div>
      <button class="notas__audio" data-notas-audio title="Escuchar resumen"><i data-lucide="volume-2" class="i"></i></button>
    </div>
    ${k.notas.conceptos.length ? `<div class="notas__seccion">
      <div class="notas__seccion-head"><span class="notas__seccion-ic"><i data-lucide="list-checks" class="i"></i></span><span class="eyebrow">Conceptos clave · ${k.notas.conceptos.length} puntos</span></div>
      <ul class="notas__list">
        ${k.notas.conceptos.map((x, i) => { const d = leerDominio(cursoId, n, i); return `<li><span class="notas__num">${i + 1}</span><div class="notas__contenido"><span class="notas__texto">${esc(x.texto)}</span><button class="notas__t" data-seek-time="${x.t}" title="Ir a ${x.t} en el video"><i data-lucide="play" class="i"></i>${esc(x.t)}</button></div><div class="notas__dominio"><button class="dom dom--no${d === 0 ? ' is-active' : ''}" data-dom-set="${cursoId}:${n}:${i}:0" title="No lo sé"><i data-lucide="circle-x" class="i"></i></button><button class="dom dom--rep${d === 1 ? ' is-active' : ''}" data-dom-set="${cursoId}:${n}:${i}:1" title="Repasando"><i data-lucide="rotate-ccw" class="i"></i></button><button class="dom dom--ok${d === 2 ? ' is-active' : ''}" data-dom-set="${cursoId}:${n}:${i}:2" title="Dominado"><i data-lucide="circle-check" class="i"></i></button></div></li>`; }).join('')}
      </ul>
    </div>` : `<div class="notas__seccion notas__seccion--pending">
      <div class="notas__seccion-head"><span class="notas__seccion-ic"><i data-lucide="list-checks" class="i"></i></span><span class="eyebrow">Conceptos clave</span></div>
      <p class="muted" style="font-size:var(--fs-sm);line-height:1.5;padding:4px 0 2px"><i data-lucide="shield-check" class="i" style="width:14px;height:14px;vertical-align:-2px;margin-right:6px;color:var(--primary)"></i>Los conceptos con marca de tiempo se publican cuando el equipo académico de Dermalysse revisa la transcripción del video. Mientras tanto, usa tus apuntes abajo.</p>
    </div>`}
    <div class="notas__seccion">
      <div class="notas__seccion-head"><span class="notas__seccion-ic" style="background:var(--surface-3);color:var(--text-3)"><i data-lucide="pen-line" class="i"></i></span><span class="eyebrow">Mis apuntes</span><span class="notas__guardado" data-apuntes-status></span></div>
      <textarea class="notas__textarea" data-apuntes="${cursoId}:${n}" placeholder="Escribe aquí tus notas personales de esta clase…">${esc(apuntes)}</textarea>
    </div>
    <div class="notas__seccion">
      <div class="notas__seccion-head"><span class="notas__seccion-ic" style="background:var(--primary-soft);color:var(--primary)"><i data-lucide="search" class="i"></i></span><span class="eyebrow">Pregúntale al curso</span></div>
      <div class="notas__chat"><input class="notas__chat-input" type="text" data-pregunta-input placeholder="¿Qué duda tienes de esta clase?"><button class="notas__chat-btn" data-pregunta-enviar title="Buscar"><i data-lucide="search" class="i"></i></button></div>
      <div class="notas__chat-resultado" data-pregunta-resultado hidden></div>
    </div>
    <div class="notas__pie"><i data-lucide="badge-check" class="i"></i>Material revisado por Dermalysse</div>
  </div>`;
}

function quizHTML(cursoId: string, n: number, clase: Clase) {
  const q = Datos.quiz(cursoId, n);
  if (!q || q.estado !== 'aprobado') {
    const conceptos = clase.notas?.conceptos?.slice(0, 3) || [];
    return `<section class="quiz-pending">
      <div class="quiz-pending__art"><span><i data-lucide="brain-circuit" class="i"></i></span><i data-lucide="sparkles" class="i quiz-pending__spark"></i></div>
      <span class="quiz-kicker"><i data-lucide="shield-check" class="i"></i>Contenido en revisión</span>
      <h2>Tu reto está en preparación</h2>
      <p>El equipo de Dermalysse está validando las preguntas de esta clase para que cada respuesta sea confiable.</p>
      ${conceptos.length ? `<div class="quiz-pending__review"><strong>Mientras tanto, repasa estas claves</strong>${conceptos.map((x) => `<span><i data-lucide="check" class="i"></i>${esc(x.texto)}</span>`).join('')}</div>` : ''}
      <a class="btn btn--secondary quiz-pending__cta" href="#/retos"><i data-lucide="layers-3" class="i"></i>Practicar con flashcards</a>
    </section>`;
  }
  const historial = resumenQuiz(cursoId, n);
  const minutos = Math.max(1, Math.ceil(q.preguntas.length * .65));
  return `<section class="lesson-quiz" data-quiz-shell data-quiz-mode="intro">
    <div class="lesson-quiz__intro" data-quiz-intro>
      <div class="lesson-quiz__visual"><span class="lesson-quiz__brain"><i data-lucide="brain-circuit" class="i"></i></span><span class="lesson-quiz__orbit lesson-quiz__orbit--one"><i data-lucide="check" class="i"></i></span><span class="lesson-quiz__orbit lesson-quiz__orbit--two"><i data-lucide="zap" class="i"></i></span></div>
      <span class="quiz-kicker"><i data-lucide="badge-check" class="i"></i>Reto de la clase</span>
      <h2>Pon a prueba lo que aprendiste</h2>
      <p>Responde con calma. Después de cada pregunta recibirás una explicación para reforzar el concepto.</p>
      <div class="lesson-quiz__facts">
        <span><b>${q.preguntas.length}</b><small>preguntas</small></span>
        <span><b>${minutos} min</b><small>aproximadamente</small></span>
        <span><b>70%</b><small>para aprobar</small></span>
      </div>
      ${historial.intentos ? `<div class="lesson-quiz__record"><span class="lesson-quiz__record-icon"><i data-lucide="${historial.aprobado ? 'trophy' : 'chart-no-axes-column-increasing'}" class="i"></i></span><span><small>Tu mejor resultado</small><strong>${historial.mejor}% · ${historial.intentos} ${historial.intentos === 1 ? 'intento' : 'intentos'}</strong></span></div>` : `<div class="lesson-quiz__reward"><i data-lucide="sparkles" class="i"></i><span><strong>+25 XP</strong> al aprobar por primera vez</span></div>`}
      <button type="button" class="btn btn--brand btn--lg btn--pill-arrow lesson-quiz__start" data-quiz-start>Comenzar reto <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span></button>
    </div>
    <form class="quiz-run" data-quiz-miembro="${cursoId}:${n}" data-total="${q.preguntas.length}" hidden>
      <header class="quiz-run__head">
        <div><span class="eyebrow" data-quiz-counter>Pregunta 1 de ${q.preguntas.length}</span><strong>Reto de la clase</strong></div>
        <button type="button" class="btn btn--ghost btn--sm" data-quiz-exit><i data-lucide="x" class="i"></i>Salir</button>
      </header>
      <div class="quiz-run__progress" role="progressbar" aria-label="Progreso del quiz" aria-valuemin="1" aria-valuemax="${q.preguntas.length}" aria-valuenow="1"><span data-quiz-progress style="width:${100 / q.preguntas.length}%"></span></div>
      <div class="quiz-run__body">
        ${q.preguntas.map((p, i) => `<fieldset class="quiz-q" data-pregunta="${i}" ${i ? 'hidden' : ''}>
          <legend class="sr-only">Pregunta ${i + 1}</legend>
          <span class="quiz-q__number">${String(i + 1).padStart(2, '0')}</span>
          <p class="quiz__q">${esc(p.q)}</p>
          <div class="quiz__options">${p.opciones.map((o, j) => `<label class="quiz__opt"><input class="quiz-radio" type="radio" name="r${i}" value="${j}"><span class="k">${'ABCD'[j]}</span><span>${esc(o)}</span><i data-lucide="circle" class="i quiz__opt-status"></i></label>`).join('')}</div>
          <div class="quiz__feedback" role="status" aria-live="polite" hidden><span class="quiz__feedback-icon"><i data-lucide="lightbulb" class="i"></i></span><div><strong data-quiz-feedback-title></strong><p data-quiz-explanation>${esc(p.explicacion)}</p></div></div>
        </fieldset>`).join('')}
      </div>
      <footer class="quiz-run__actions">
        <span class="quiz-run__hint"><i data-lucide="mouse-pointer-click" class="i"></i>Elige una respuesta</span>
        <button type="button" class="btn btn--brand btn--pill-arrow" data-quiz-check>Comprobar <span class="arrow"><i data-lucide="check" class="i"></i></span></button>
        <button type="button" class="btn btn--brand btn--pill-arrow" data-quiz-next hidden>Siguiente <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span></button>
      </footer>
    </form>
    <div class="quiz-result" data-quiz-result aria-live="polite" hidden></div>
  </section>`;
}

export function clase(params: Record<string, string>) {
  const c = getCurso(params.id);
  const n = Number(params.n);
  const k = c?.clases.find((x) => x.n === n);
  if (!c || !k) return placeholder('Clase no encontrada', 'Revisa el temario del curso.', 'search-x');
  if (!Progreso.desbloqueada(c, n)) {
    return placeholder('Esta clase todavía está bloqueada', `Termina la clase ${n - 1} para desbloquearla. Así avanzas a tu ritmo y sin saltarte nada.`, 'lock')
      .replace('href="#/cursos">Ir a cursos', `href="#/curso/${c.id}/clase/${n - 1}">Ir a la clase ${n - 1}`);
  }
  if (!Acceso.claseAccesible(c, n)) {
    return `<section class="stack" style="gap:20px">
      <a class="section-head__cta" href="#/curso/${c.id}" style="align-self:flex-start"><span class="circle-btn circle-btn--glass" style="width:34px;height:34px"><i data-lucide="arrow-left" class="i" style="width:15px;height:15px"></i></span>${esc(c.titulo)}</a>
      <div class="locked-hero">
        <img src="${c.portada}" alt="">
        <div class="locked-hero__body">
          <span class="circle-btn" style="width:64px;height:64px;background:rgba(255,255,255,.15);color:#fff"><i data-lucide="crown" class="i" style="width:30px;height:30px"></i></span>
          <span class="eyebrow" style="color:rgba(255,255,255,.75)">Clase ${n} de ${c.clases.length}</span>
          <h1 class="display" style="font-size:var(--fs-2xl)">${esc(k.titulo)}</h1>
          <p style="max-width:46ch;color:rgba(255,255,255,.9)">Esta clase es para miembros VIP. Hazte VIP y desbloquea todos los cursos, la biblioteca y los retos.</p>
          <button class="btn btn--brand btn--lg" data-paywall="Esta clase es para miembros VIP.">Hazte VIP <i data-lucide="arrow-right" class="i"></i></button>
        </div>
      </div>
    </section>`;
  }
  Progreso.abrirClase(c.id, n);
  const vista = Progreso.de(c.id).vistas.includes(n);
  const prev = c.clases.find((x) => x.n === n - 1);
  const next = c.clases.find((x) => x.n === n + 1);

  // Provisional: embed directo. En Fase 2 el backend firma la URL (token + expires).
  const embed = `https://iframe.mediadelivery.net/embed/${LIBRARY_ID}/${k.videoId}?autoplay=false&preload=true&responsive=true`;
  const videoDisponible = Boolean(LIBRARY_ID && k.videoId);
  const reproductor = videoDisponible
    ? `<iframe ${Datos.modo === 'demo' ? `src="${embed}"` : ''} data-video="${c.id}:${n}" loading="lazy" style="border:0;position:absolute;inset:0;width:100%;height:100%" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen" allowfullscreen></iframe>`
    : `<div class="player__pending" style="position:absolute;inset:0;background:#0a0d18 center/cover no-repeat;background-image:url('${c.portada}')">
        <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(10,13,24,.35) 0%, rgba(10,13,24,.86) 70%)"></div>
        <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;text-align:center;padding:24px;color:#fff">
          <span class="circle-btn" style="width:64px;height:64px;background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.24);backdrop-filter:blur(6px)"><i data-lucide="clapperboard" class="i" style="width:28px;height:28px"></i></span>
          <span class="eyebrow" style="color:rgba(255,255,255,.78)">Vista previa · ${esc(c.titulo)}</span>
          <h3 style="font-family:var(--font-display);font-size:clamp(1.25rem, 2vw, 1.6rem);max-width:28ch;margin:0">Video en preparación</h3>
          <p style="color:rgba(255,255,255,.85);font-size:var(--fs-sm);max-width:40ch;margin:0;line-height:1.5">El video final de esta clase se publica cuando el equipo académico de Dermalysse revisa el contenido. Mientras tanto, consulta el temario, tus notas y el quiz.</p>
        </div>
      </div>`;

  const temario = c.clases.map((x) => {
    const v = Progreso.de(c.id).vistas.includes(x.n);
    const abierta = Progreso.desbloqueada(c, x.n);
    const actual = x.n === n;
    const style = actual ? 'color:var(--primary);font-weight:600' : v ? '' : abierta ? '' : 'opacity:.5';
    const inner = `<span class="mono faint" style="width:22px">${v ? '✓' : x.n}</span>${esc(x.titulo)}`;
    return abierta ? `<a href="#/curso/${c.id}/clase/${x.n}" class="row" style="gap:10px;${style};color:inherit;flex-wrap:nowrap">${inner}</a>`
                   : `<div class="row" style="gap:10px;${style};flex-wrap:nowrap"><i data-lucide="lock" class="i" style="width:14px;height:14px"></i>${esc(x.titulo)}</div>`;
  }).join('');

  return `
  <section class="stack" style="gap:20px">
    <a class="section-head__cta" href="#/curso/${c.id}" style="align-self:flex-start"><span class="circle-btn circle-btn--glass" style="width:34px;height:34px"><i data-lucide="arrow-left" class="i" style="width:15px;height:15px"></i></span>${esc(c.titulo)}</a>
    <div class="grid lesson-layout" style="grid-template-columns:1.7fr 1fr;align-items:start;gap:24px">
      <div class="stack" style="gap:16px">
        <div class="player" style="aspect-ratio:16/9;background:#0a0d18">
          ${reproductor}
        </div>
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div><span class="eyebrow">Clase ${n} de ${c.clases.length}${k.duracion ? ' · ' + fmtMin(k.duracion) : ''}</span><h1 class="display" style="font-size:var(--fs-xl);margin-top:4px">${esc(k.titulo)}</h1>
            <div class="lesson-progress" style="margin-top:8px"><div class="progress progress--thin"><span style="width:${Progreso.porcentaje(c)}%"></span></div>${Progreso.de(c.id).vistas.length} de ${c.clases.length} vistas · ${Progreso.porcentaje(c)}%</div></div>
          <div class="row" style="flex-wrap:nowrap">
            ${prev ? `<a class="btn btn--secondary" href="#/curso/${c.id}/clase/${prev.n}"><i data-lucide="chevron-left" class="i"></i>Anterior</a>` : ''}
            ${vista
              ? (next ? `<a class="btn btn--brand btn--pill-arrow" href="#/curso/${c.id}/clase/${next.n}">Siguiente clase <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span></a>`
                      : `<a class="btn btn--gradient btn--pill-arrow" href="#/curso/${c.id}">Curso completado <span class="arrow"><i data-lucide="award" class="i"></i></span></a>`)
              : `<button class="btn btn--brand btn--pill-arrow" data-marcar-vista="${c.id}:${n}">Marcar vista y seguir <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span></button>`}
          </div>
        </div>
        ${next ? `
        <div class="upnext">
          <div class="upnext__thumb"><img src="${c.portada}" alt=""><i data-lucide="${Progreso.desbloqueada(c, next.n) || vista ? 'play' : 'lock'}" class="i"></i></div>
          <div><span class="eyebrow">A continuación · clase ${next.n}</span><div class="upnext__title">${esc(next.titulo)}</div><p class="faint" style="font-size:var(--fs-xs);margin-top:4px">${vista ? 'Ya puedes verla.' : 'Se desbloquea al marcar esta clase como vista.'}</p></div>
          ${vista ? `<a class="circle-btn" href="#/curso/${c.id}/clase/${next.n}" aria-label="Ir a la siguiente"><i data-lucide="arrow-right" class="i"></i></a>` : `<span class="circle-btn" style="background:var(--surface-3);color:var(--text-3)"><i data-lucide="lock" class="i"></i></span>`}
        </div>` : `
        <div class="upnext" style="background:var(--accent-soft);border-color:transparent">
          <span class="circle-btn" style="background:var(--accent);width:56px;height:56px"><i data-lucide="graduation-cap" class="i" style="width:24px;height:24px"></i></span>
          <div><span class="eyebrow">Última clase</span><div class="upnext__title">Al marcarla como vista, accedes a la evaluación final para obtener tu certificado.</div></div>
        </div>`}
      </div>
      <div class="card card--pad stack" data-tabs style="gap:16px">
        <div class="tabs"><button data-for="temario" class="is-active">Temario</button><button data-for="notas">Notas</button><button data-for="quiz">Quiz</button></div>
        <div data-tab="temario" class="stack" style="gap:10px;font-size:var(--fs-sm)">${temario}</div>
        <div data-tab="notas" hidden class="stack" style="gap:10px">${notasHTML(k, c.id, n)}</div>
        <div data-tab="quiz" hidden class="stack" style="gap:12px">${quizHTML(c.id, n, k)}</div>
      </div>
    </div>
  </section>`;
}
