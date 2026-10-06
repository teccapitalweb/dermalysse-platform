// Retos · hub editorial Dermalysse basado en los patrones de Élite Pecuario.
// Muestra Liga, XP, racha, misión semanal, clasificación y la zona de juegos.
// Quiz Relámpago está totalmente jugable con las preguntas aprobadas del
// catálogo; Casos y Flashcards se activan cuando se publique su contenido.
import { createIcons, icons } from 'lucide';
import { esc, iniciales } from '../ui/partials';
import {
  nivel, NIVELES, retoDiario, bancoPreguntas, estatsMazo, casos, casosResueltos, mejorQuiz,
  barajar, registrarQuiz, type Pregunta,
} from '../core/juegos';
import { Liga, type FilaLiga } from '../core/liga';
import { Progreso } from '../core/progreso';
import { racha } from '../core/logros';
import { celebrar } from '../ui/celebracion';

type Vista = 'hub' | 'quiz';
let vista: Vista = 'hub';
let timer: number | null = null;
const parar = () => { if (timer) { clearInterval(timer); timer = null; } };

// Estado del Quiz Relámpago en curso.
let Q: {
  preguntas: Pregunta[];
  idx: number;
  score: number;
  vidas: number;
  combo: number;
  contestada: boolean;
  restante: number;
  modo: 'relampago' | 'practica';
  area: string;
} | null = null;

const TIEMPO = 15; // segundos por pregunta en modo relámpago

const root = () => document.getElementById('arcade');
function pinta(html: string) { const r = root(); if (!r) return; r.innerHTML = html; createIcons({ icons }); }
const iconos = () => createIcons({ icons });
const subirArcade = () => requestAnimationFrame(() => root()?.scrollIntoView({ behavior: 'auto', block: 'start' }));

export function retos() {
  return `<section class="arcade-page"><div id="arcade" class="stack" style="gap:24px"></div></section>`;
}

export function montarArcade() {
  const r = root();
  if (!r || r.dataset.mounted) return;
  r.dataset.mounted = '1';
  vista = 'hub'; parar();
  r.addEventListener('click', onClick);
  window.addEventListener('retos:cambio', () => { if (vista === 'hub') hub(); });
  hub();
  Liga.cargar().then(() => { if (vista === 'hub' && root()) hub(); });
}

function onClick(e: Event) {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
  if (!el) return;
  const a = el.dataset.a!;
  const acciones: Record<string, () => void> = {
    hub: () => { parar(); vista = 'hub'; hub(); },
    'ir-quiz': bibliotecaQuiz,
    'quiz-jugar': () => iniciarQuiz(el.dataset.area || 'Todas', (el.dataset.modo || 'relampago') as 'relampago' | 'practica'),
    'quiz-resp': () => respQuiz(+el.dataset.i!),
    'quiz-sig': sigQuiz,
  };
  acciones[a]?.();
}

// ══════════════ HUB ══════════════
function hub() {
  vista = 'hub';
  const nv = nivel();
  const d = retoDiario();
  const em = estatsMazo();
  const totalCasos = casos().length;
  const banco = bancoPreguntas().length;
  const liga = Liga.resumen();
  const miRacha = racha();
  const vistas = Progreso.totalVistas();
  const cursosCompletos = Progreso.completados().length;
  const mision = [d.hechoHoy, miRacha.activaEstaSemana, em.estudiadas > 0];
  const misionHechas = mision.filter(Boolean).length;
  const misionPct = Math.round(misionHechas / mision.length * 100);
  const lider = liga.clasificacion[0]?.xp || 1;
  const casosOk = casosResueltos();
  const record = mejorQuiz();
  const pctCasos = totalCasos ? Math.round(casosOk / totalCasos * 100) : 0;
  const pctFlash = em.total ? Math.round(em.dominadas / em.total * 100) : 0;
  const pctQuiz = Math.min(100, Math.round(record / 10));
  const dias = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  pinta(`
    <header class="league-hero">
      <div class="league-hero__glow"></div>
      <div class="league-hero__copy">
        <span class="league-kicker"><i data-lucide="sparkles" class="i"></i>Liga Dermalysse</span>
        <h1 class="display">Aprende. Practica. <em>Afina tu criterio.</em></h1>
        <p>Cada clase vista, concepto dominado y caso resuelto suma a tu avance como profesional.</p>
        <div class="league-level" style="--c:${nv.color}">
          <div class="league-ring">
            <svg class="league-ring__svg" viewBox="0 0 120 120"><circle class="league-ring__bg" cx="60" cy="60" r="52"/><circle class="league-ring__fg" cx="60" cy="60" r="52" style="stroke-dashoffset:${(326.7 * (1 - nv.pct / 100)).toFixed(1)}"/></svg>
            <i data-lucide="${nv.icon}" class="i"></i>
          </div>
          <div class="league-level__info">
            <span>Nivel ${nv.indice + 1} · ${nv.xp.toLocaleString('es-MX')} XP</span>
            <strong>${nv.nombre}</strong>
            <div class="ar-xp__bar"><span style="width:${nv.pct}%"></span></div>
            <small>${nv.siguiente ? `Faltan <b>${nv.faltan.toLocaleString('es-MX')} XP</b> para ${nv.siguiente.nombre.split(' ')[0]}` : 'Nivel máximo alcanzado'}</small>
          </div>
        </div>
        <ol class="league-track">${NIVELES.map((n, i) => `<li class="${i < nv.indice ? 'is-done' : i === nv.indice ? 'is-current' : ''}" style="--c:${n.color}"><i data-lucide="${n.icon}" class="i"></i><span>${n.nombre.split(' ')[0]}</span></li>`).join('')}</ol>
      </div>
      <div class="league-rank-card">
        <span class="league-rank-card__label"><i data-lucide="medal" class="i"></i>Tu posición</span>
        <strong>${liga.yo ? `#${liga.yo.puesto}` : '—'}</strong>
        <span>de ${liga.participantes} en la liga</span>
        <div class="league-rank-card__mini"><span><b>${cursosCompletos}</b> cursos</span><span><b>${vistas}</b> clases</span><span><b>${d.racha}</b> racha</span></div>
        ${d.racha > 0 ? `<span class="league-rank-card__streak"><i data-lucide="flame" class="i"></i>${d.racha} ${d.racha === 1 ? 'día' : 'días'} seguidos</span>` : '<span class="league-rank-card__streak is-off"><i data-lucide="flame" class="i"></i>Enciende tu racha hoy</span>'}
      </div>
    </header>

    <div class="league-dashboard">
      <section class="league-main">
        <div class="league-section-head"><div><span class="eyebrow">Entrena tu criterio</span><h2>Zona de retos</h2></div><span><i data-lucide="sparkles" class="i"></i>${nv.xp.toLocaleString('es-MX')} XP acumulados</span></div>

        <section class="story-entry">
          <div class="story-entry__copy">
            <span>Ruta interactiva · Casos Dermalysse</span>
            <h2 class="display">Aprender también es <em>conectar.</em></h2>
            <p>Escenarios editoriales para practicar observación, análisis y comunicación responsable con tus pacientes.</p>
            <a class="btn btn--light" href="#/retos/historia">Ver avance <i data-lucide="arrow-right" class="i"></i></a>
          </div>
          <div class="story-entry__visual">
            <div class="story-character story-character--mateo"><span style="background:linear-gradient(135deg,#f0b5be,#681c31);display:grid;place-items:center;color:#fff;font-weight:700;font-size:28px">D</span><b>Dermalysse</b></div>
            <div class="story-character story-character--pico"><span style="background:linear-gradient(135deg,#8ad7b5,#4fa899);display:grid;place-items:center;color:#fff"><i data-lucide="sparkles" class="i" style="width:28px;height:28px"></i></span><b>Guía</b></div>
          </div>
        </section>

        <div class="ar-daily is-pending" aria-disabled="true" title="El reto diario se activa cuando haya al menos un quiz publicado.">
          <span class="ar-daily__ic"><i data-lucide="calendar-days" class="i"></i></span>
          <span class="ar-daily__tx"><strong>Reto diario</strong><span class="faint">${banco ? 'Una pregunta rápida · responde y suma XP' : 'Se activa cuando se publique al menos un quiz revisado.'}</span></span>
          <span class="ar-daily__meta">
            ${banco ? '<span class="ar-daily__xp">+30 XP</span><span class="ar-daily__go"><i data-lucide="arrow-right" class="i"></i></span>' : '<span class="chip" style="background:rgba(104,28,49,.08);color:var(--primary);border:1px solid color-mix(in srgb,var(--primary) 20%,transparent)">En preparación</span>'}
          </span>
        </div>

        <div class="ar-grid league-games">
          ${tileJugable('ir-quiz', 'zap', 'Quiz Relámpago', `Preguntas rápidas de cursos · ${banco} ${banco === 1 ? 'pregunta' : 'preguntas'}`, '#4a7fc1', 'Récord', String(record), pctQuiz, banco === 0)}
          ${tileEstatico('briefcase-medical', 'Casos Dermalysse', 'Diagnóstico educativo y comunicación responsable', '#4fa899', 'Resueltos', `${casosOk}/${totalCasos}`, pctCasos, totalCasos === 0)}
          ${tileEstatico('brain', 'Flashcards', 'Memoria activa por área y curso', '#c98a5b', 'Dominadas', `${em.dominadas}/${em.total}`, pctFlash, em.total === 0)}
        </div>

        <section class="league-ranking">
          <div class="league-section-head"><div><span class="eyebrow">Avance verificado</span><h2>Clasificación del club</h2></div>${liga.esDemo ? '<span class="chip" style="background:rgba(104,28,49,.08);color:var(--primary);border:1px solid color-mix(in srgb,var(--primary) 20%,transparent)"><i data-lucide="flask-conical" class="i"></i>Ejemplo</span>' : '<span class="league-live"><i data-lucide="shield-check" class="i"></i>Datos del club</span>'}</div>
          <p class="league-ranking__intro">${liga.esDemo ? 'Vista previa de cómo lucirá la clasificación cuando más colegas estén avanzando con cursos y retos reales.' : 'Aquí se reconoce a quienes convierten la constancia en resultados. Las clases y cursos terminados valen más que una visita.'}</p>
          ${podio(liga.clasificacion.slice(0, 3))}
          <div class="league-table">${liga.clasificacion.slice(3, 10).map((f) => filaLiga(f, lider)).join('') || '<p class="league-ranking__empty">Las siguientes posiciones aparecerán conforme más colegas avancen.</p>'}</div>
          ${liga.yo && liga.yo.puesto > 10 ? `<div class="league-you"><span>Tu posición actual</span>${filaLiga(liga.yo, lider)}</div>` : ''}
          <p class="league-privacy"><i data-lucide="lock-keyhole" class="i"></i>La clasificación solo muestra nombre y logros de aprendizaje. Nunca datos de contacto ni información clínica.</p>
        </section>
      </section>

      <aside class="league-side">
        <section class="weekly-mission">
          <div class="weekly-mission__head">
            <div class="weekly-mission__ring"><svg viewBox="0 0 80 80"><circle class="bg" cx="40" cy="40" r="34"/><circle class="fg" cx="40" cy="40" r="34" style="stroke-dashoffset:${(213.6 * (1 - misionPct / 100)).toFixed(1)}"/></svg><b>${misionHechas}<i>/3</i></b></div>
            <div><small>Misión semanal</small><strong>${misionPct === 100 ? 'Semana dominada' : `${misionPct}% completada`}</strong></div>
          </div>
          <div class="weekly-mission__days">${dias.map((l, i) => `<span class="${miRacha.dias[i] ? 'is-on' : ''}${i === (new Date().getDay() + 6) % 7 ? ' is-today' : ''}">${l}</span>`).join('')}</div>
          <ul>
            ${misionItem('Reto diario', 'Suma XP hoy', mision[0])}
            ${misionItem('Constancia', 'Mira una clase esta semana', mision[1])}
            ${misionItem('Memoria activa', 'Repasa tus flashcards', mision[2])}
          </ul>
          <span class="weekly-mission__reward"><i data-lucide="gift" class="i"></i>Completa las 3 para dominar la semana</span>
        </section>

        <section class="league-path">
          <div><span class="eyebrow">Camino a Maestro</span><h3>Seis niveles de dominio</h3></div>
          <ol>${NIVELES.map((n, i) => `<li class="${i < nv.indice ? 'is-done' : i === nv.indice ? 'is-current' : ''}" style="--c:${n.color}"><span>${i < nv.indice ? '<i data-lucide="check" class="i"></i>' : `<i data-lucide="${n.icon}" class="i"></i>`}</span><div><strong>${n.nombre.split(' ')[0]}</strong><small>${n.min.toLocaleString('es-MX')} XP</small></div>${i === nv.indice ? '<em>Estás aquí</em>' : ''}</li>`).join('')}</ol>
        </section>

        <section class="league-achievements"><span class="eyebrow">Tu tablero</span><div><span style="--c:#4a7fc1"><i data-lucide="zap" class="i"></i><b>${record}</b><small>récord quiz</small></span><span style="--c:#4fa899"><i data-lucide="briefcase-medical" class="i"></i><b>${casosOk}</b><small>casos</small></span><span style="--c:#c98a5b"><i data-lucide="brain" class="i"></i><b>${em.dominadas}</b><small>dominadas</small></span></div></section>
      </aside>
    </div>
  `);
}

function podio(filas: FilaLiga[]) {
  if (!filas.length) return '<div class="league-ranking__empty">La liga se arma con la primera clase terminada.</div>';
  const orden = filas.length >= 3 ? [filas[1], filas[0], filas[2]] : filas;
  return `<div class="league-podium">${orden.map((f) => `<div class="league-podium__place place-${f.puesto} ${f.esYo ? 'is-you' : ''}">
    <span class="league-podium__medal">${f.puesto === 1 ? '<i data-lucide="crown" class="i"></i>' : `#${f.puesto}`}</span>
    <span class="league-podium__ring">${avatarLiga(f)}</span>
    <strong>${esc(f.nombre)}${f.esYo ? ' <em>Tú</em>' : ''}</strong>
    <small>${f.cursos} cursos · ${f.clases} clases</small>
    <b>${f.xp.toLocaleString('es-MX')} XP</b>
    <span class="league-podium__step"></span>
  </div>`).join('')}</div>`;
}

function filaLiga(f: FilaLiga, lider: number) {
  const w = Math.max(4, Math.round(f.xp / lider * 100));
  return `<div class="league-row ${f.esYo ? 'is-you' : ''}" style="--w:${w}%"><span class="league-row__rank">${f.puesto}</span>${avatarLiga(f)}<div class="league-row__name"><strong>${esc(f.nombre)}${f.esYo ? ' <em>Tú</em>' : ''}</strong><span>${f.nivel} · ${f.cursos} cursos completados</span></div><span class="league-row__classes">${f.clases}<small>clases</small></span><b>${f.xp.toLocaleString('es-MX')} XP</b></div>`;
}

const avatarLiga = (f: FilaLiga) => `<div class="avatar">${f.foto ? `<img src="${esc(f.foto)}" alt="Foto de ${esc(f.nombre)}" referrerpolicy="no-referrer" loading="lazy">` : iniciales(f.nombre)}</div>`;

const misionItem = (titulo: string, sub: string, ok: boolean) => `<li class="${ok ? 'is-done' : ''}"><span><i data-lucide="${ok ? 'check' : 'circle'}" class="i"></i></span><div><strong>${titulo}</strong><small>${sub}</small></div></li>`;

function tileJugable(a: string, icono: string, tit: string, sub: string, color: string, kpiLabel: string, kpi: string, pct: number, pendiente: boolean) {
  if (pendiente) return tileEstatico(icono, tit, sub, color, kpiLabel, kpi, pct, true);
  return `
  <button class="ar-tile" data-a="${a}" style="--c:${color}">
    <span class="ar-tile__mascot" style="background:color-mix(in srgb,${color} 18%,transparent);display:grid;place-items:center;color:${color}"><i data-lucide="${icono}" class="i" style="width:34px;height:34px"></i></span>
    <span class="ar-tile__body"><strong>${tit}</strong><span class="faint">${sub}</span></span>
    <span class="ar-tile__kpi"><span><small>${kpiLabel}</small><b>${kpi}</b></span><i style="--p:${pct}%"></i></span>
    <span class="ar-tile__go"><i data-lucide="arrow-up-right" class="i"></i></span>
  </button>`;
}

function tileEstatico(icono: string, tit: string, sub: string, color: string, kpiLabel: string, kpi: string, pct: number, pendiente: boolean) {
  const estado = pendiente
    ? '<span class="chip" style="background:rgba(104,28,49,.08);color:var(--primary);border:1px solid color-mix(in srgb,var(--primary) 20%,transparent);font-size:10px;margin-top:4px">En preparación</span>'
    : '';
  return `
  <div class="ar-tile ${pendiente ? 'is-pending' : ''}" style="--c:${color}" aria-disabled="${pendiente}" ${pendiente ? 'title="Se activa cuando se publique el contenido revisado."' : ''}>
    <span class="ar-tile__mascot" style="background:color-mix(in srgb,${color} 18%,transparent);display:grid;place-items:center;color:${color}"><i data-lucide="${icono}" class="i" style="width:34px;height:34px"></i></span>
    <span class="ar-tile__body"><strong>${tit}</strong><span class="faint">${sub}</span>${estado}</span>
    <span class="ar-tile__kpi"><span><small>${kpiLabel}</small><b>${kpi}</b></span><i style="--p:${pct}%"></i></span>
    <span class="ar-tile__go"><i data-lucide="${pendiente ? 'clock' : 'arrow-up-right'}" class="i"></i></span>
  </div>`;
}

// ══════════════ QUIZ RELÁMPAGO ══════════════
const barraVolver = () => `<button class="btn btn--ghost btn--sm" data-a="hub"><i data-lucide="arrow-left" class="i"></i>Retos</button>`;

function iconoArea(area: string): string {
  const m: Record<string, string> = {
    'Cosmiatría': 'wand-2',
    'Cosmetología': 'flask-conical',
    'Estética facial': 'sparkles',
    'Estética corporal': 'activity',
    'Nutrición': 'apple',
    'Regulación': 'scale',
    'General': 'book-open',
  };
  return m[area] || 'brain-circuit';
}

function heroBiblioteca(kicker: string, titulo: string, texto: string, color: string, stats: string) {
  return `<header class="challenge-hero" style="--game:${color}">
    <div class="challenge-hero__copy"><span class="challenge-kicker">${kicker}</span><h1 class="display">${titulo}</h1><p>${texto}</p><div class="challenge-hero__stats">${stats}</div></div>
    <div class="challenge-hero__mascot" style="display:grid;place-items:center;background:rgba(255,255,255,.08);border-radius:50%;width:160px;height:160px;border:1px solid rgba(255,255,255,.14)"><i data-lucide="zap" class="i" style="width:72px;height:72px;color:#fff"></i></div>
  </header>`;
}

const modoCard = (modo: string, area: string, icon: string, titulo: string, texto: string, meta: string, color: string) =>
  `<button class="mode-card" data-a="quiz-jugar" data-modo="${modo}" data-area="${esc(area)}" style="--mode:${color}"><span><i data-lucide="${icon}" class="i"></i></span><strong>${titulo}</strong><p>${texto}</p><small>${meta}<i data-lucide="arrow-right" class="i"></i></small></button>`;

function bibliotecaQuiz() {
  vista = 'quiz'; parar();
  const preguntas = bancoPreguntas();
  const areas = [...new Set(preguntas.map((p) => p.area))].sort();
  pinta(`${barraVolver()}
    ${heroBiblioteca('Arena de conocimiento', 'Quiz Relámpago', 'Elige cómo entrenar: contra reloj, en modo práctica o por área profesional.', '#4a7fc1', `<span><b>${preguntas.length}</b> preguntas</span><span><b>${areas.length}</b> áreas</span><span><b>${mejorQuiz()}</b> récord</span>`)}
    <section class="challenge-section"><div class="challenge-section__head"><div><span class="eyebrow">Modos de juego</span><h2>¿Cómo quieres practicar?</h2></div></div>
      <div class="mode-grid">
        ${modoCard('relampago', 'Todas', 'timer', 'Relámpago mixto', '15 segundos por pregunta · vidas y combos', '8 preguntas', '#4a7fc1')}
        ${modoCard('practica', 'Todas', 'graduation-cap', 'Entrenamiento libre', 'Sin reloj · aprende con cada explicación', '10 preguntas', '#4fa899')}
        ${modoCard('relampago', areas[0] || 'Todas', 'trophy', 'Reto por área', 'Entra directo a una especialidad y supera tu marca', 'Por área', '#d39a19')}
      </div>
    </section>
    <section class="challenge-section"><div class="challenge-section__head"><div><span class="eyebrow">Biblioteca temática</span><h2>Quiz por área profesional</h2></div><span>${preguntas.length} reactivos revisados</span></div>
      <div class="deck-grid">${areas.map((area) => {
        const n = preguntas.filter((p) => p.area === area).length;
        return `<button class="deck-card" data-a="quiz-jugar" data-area="${esc(area)}" data-modo="relampago" style="--deck:#4a7fc1"><span class="deck-card__icon"><i data-lucide="${iconoArea(area)}" class="i"></i></span><span class="deck-card__body"><strong>${esc(area)}</strong><small>${n} ${n === 1 ? 'pregunta' : 'preguntas'} · contra reloj</small></span><i data-lucide="arrow-up-right" class="i deck-card__go"></i></button>`;
      }).join('')}</div>
    </section>`);
  subirArcade();
}

function iniciarQuiz(area = 'Todas', modo: 'relampago' | 'practica' = 'relampago') {
  const pool = barajar(bancoPreguntas().filter((p) => area === 'Todas' || p.area === area));
  if (!pool.length) {
    pinta(`${barraVolver()}<div class="ar-empty" style="padding:40px;text-align:center;color:var(--text-2)">Aún no hay preguntas publicadas en esa área.</div>`);
    return;
  }
  const lim = modo === 'practica' ? 10 : 8;
  Q = { preguntas: pool.slice(0, lim), idx: 0, score: 0, vidas: 3, combo: 0, contestada: false, restante: TIEMPO, modo, area };
  pintaQuiz();
}

function pintaQuiz() {
  if (!Q) return;
  const p = Q.preguntas[Q.idx];
  parar();
  Q.contestada = false; Q.restante = TIEMPO;
  pinta(`
    <div class="ar-top">${barraVolver()}
      <div class="ar-hud">
        <span class="ar-vidas">${'❤'.repeat(Q.vidas)}${'<span class=off>♡</span>'.repeat(3 - Q.vidas)}</span>
        <span class="ar-combo ${Q.combo > 1 ? 'on' : ''}">${Q.combo > 1 ? '🔥 x' + Q.combo : ''}</span>
        <span class="ar-score"><i data-lucide="star" class="i"></i>${Q.score}</span>
      </div>
    </div>
    ${Q.modo === 'relampago' ? '<div class="ar-timer"><span id="ar-tbar" style="width:100%"></span></div>' : '<div class="practice-banner"><i data-lucide="graduation-cap" class="i"></i>Modo práctica · piensa con calma y aprende de la explicación</div>'}
    <div class="ar-q">
      <span class="chip chip--primary">${esc(p.area)} · ${Q.idx + 1}/${Q.preguntas.length}</span>
      <h2 class="display" style="font-size:var(--fs-xl)">${esc(p.q)}</h2>
      <div class="ar-opts">
        ${p.opciones.map((o, i) => `<button class="ar-opt" data-a="quiz-resp" data-i="${i}">${esc(o)}</button>`).join('')}
      </div>
      <div id="ar-fb"></div>
    </div>`);
  if (Q.modo !== 'relampago') return;
  const bar = document.getElementById('ar-tbar');
  if (!bar) return;
  const t0 = Date.now();
  timer = window.setInterval(() => {
    if (!Q) return;
    const pasado = (Date.now() - t0) / 1000;
    Q.restante = Math.max(0, TIEMPO - pasado);
    bar.style.width = (Q.restante / TIEMPO * 100) + '%';
    if (Q.restante <= 0) { parar(); respQuiz(-1); }
  }, 80);
}

function respQuiz(i: number) {
  if (!Q || Q.contestada) return;
  Q.contestada = true;
  parar();
  const p = Q.preguntas[Q.idx];
  const ok = i === p.correcta;
  root()?.querySelectorAll<HTMLButtonElement>('.ar-opt').forEach((b, j) => {
    b.disabled = true;
    if (j === p.correcta) b.classList.add('ok');
    if (j === i && !ok) b.classList.add('bad');
  });
  if (ok) {
    const bonus = Q.modo === 'relampago' ? Math.round(Q.restante / TIEMPO * 100) : 40;
    const suma = Math.round((100 + bonus) * (1 + Q.combo * 0.1));
    Q.score += suma; Q.combo++;
    celebrar('normal');
  } else {
    Q.vidas--;
    Q.combo = 0;
  }
  const fin = Q.vidas <= 0 || Q.idx >= Q.preguntas.length - 1;
  const fb = document.getElementById('ar-fb');
  if (!fb) return;
  fb.innerHTML = `
    <div class="ar-exp ${ok ? 'ok' : 'bad'}">
      <strong>${ok ? '¡Correcto! ⚡' : 'Casi…'}</strong>
      <p>${esc(p.explicacion)}</p>
      <button class="btn btn--brand" data-a="quiz-sig">${fin ? 'Ver resultado' : 'Siguiente'} <i data-lucide="arrow-right" class="i"></i></button>
    </div>`;
  iconos();
  requestAnimationFrame(() => root()?.querySelector('.ar-exp')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

function sigQuiz() {
  if (!Q) return;
  if (Q.vidas <= 0 || Q.idx >= Q.preguntas.length - 1) { finQuiz(); return; }
  Q.idx++;
  pintaQuiz();
}

function finQuiz() {
  if (!Q) return;
  parar();
  registrarQuiz(Q.score);
  const xpGan = Math.round(Q.score / 10);
  const esRecord = Q.score >= mejorQuiz();
  pinta(`${barraVolver()}
    <div class="ar-result" style="text-align:center;padding:48px 24px;display:grid;gap:14px;place-items:center">
      <div class="ar-result__ic" style="width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,#4a7fc1,#681c31);color:#fff;display:grid;place-items:center"><i data-lucide="zap" class="i" style="width:40px;height:40px"></i></div>
      <h2 class="display" style="font-size:var(--fs-2xl);margin:0">${Q.score} puntos</h2>
      <p class="muted">Ganaste <strong>${xpGan} XP</strong>${esRecord ? ' · ¡nuevo récord! 🏆' : ''}</p>
      <div class="row" style="gap:10px;justify-content:center">
        <button class="btn btn--brand btn--lg" data-a="ir-quiz"><i data-lucide="rotate-ccw" class="i"></i>Jugar de nuevo</button>
        <button class="btn btn--secondary btn--lg" data-a="hub">Volver</button>
      </div>
    </div>`);
  celebrar('grande');
  Q = null;
}
