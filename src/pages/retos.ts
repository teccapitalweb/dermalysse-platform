// Retos · hub editorial Dermalysse basado en los patrones de Élite Pecuario.
// Hub + 4 juegos funcionales: Quiz Relámpago, Reto Diario, Casos Dermalysse y
// Flashcards. Todo el contenido viene de los cursos (quizzes aprobados y
// notas) y del banco revisado de casos clínicos educativos.
import { createIcons, icons } from 'lucide';
import { esc, iniciales } from '../ui/partials';
import {
  nivel, NIVELES, retoDiario, completarDiaria, bancoPreguntas, barajar, type Pregunta,
  mazoFiltrado, mazoCompleto, mazoDeHoy, repasarCarta, estatsMazo, estatsMazoFiltrado, type Flashcard, type TipoCarta,
  casos, resolverCaso, casosResueltos, idsCasosResueltos, registrarQuiz, mejorQuiz, type Caso,
} from '../core/juegos';
import { Liga, type FilaLiga } from '../core/liga';
import { Progreso } from '../core/progreso';
import { racha } from '../core/logros';
import { celebrar } from '../ui/celebracion';

type Vista = 'hub' | 'quiz' | 'diaria' | 'caso' | 'flash';
let vista: Vista = 'hub';
let timer: number | null = null;
const parar = () => { if (timer) { clearInterval(timer); timer = null; } };

// Estado de los juegos en curso.
let Q: { preguntas: Pregunta[]; idx: number; score: number; vidas: number; combo: number; contestada: boolean; restante: number; modo: 'relampago' | 'practica'; area: string } | null = null;
let D: { pregunta: Pregunta | null; contestada: boolean } | null = null;
let C: { caso: Caso; fase: 'diagnostico' | 'plan' | 'resultado'; aciertos: number; respuesta: number | null } | null = null;
let F: { mazo: Flashcard[]; idx: number; flipped: boolean; aciertos: number; area: string; tipo: TipoCarta } | null = null;
let filtroCaso = 'Todas';

const TIEMPO = 15;

const root = () => document.getElementById('arcade');
function pinta(html: string) { const r = root(); if (!r) return; r.innerHTML = html; createIcons({ icons }); }
const iconos = () => createIcons({ icons });
const subir = () => requestAnimationFrame(() => root()?.scrollIntoView({ behavior: 'auto', block: 'start' }));

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
    'ir-diaria': iniciarDiaria,
    'diaria-resp': () => respDiaria(+el.dataset.i!),
    'ir-caso': () => elegirCaso(),
    'caso-filtro': () => { filtroCaso = el.dataset.area || 'Todas'; elegirCaso(); },
    'caso-jugar': () => iniciarCaso(el.dataset.id!),
    'caso-resp': () => respCaso(+el.dataset.i!),
    'caso-sig': sigCaso,
    'ir-flash': bibliotecaFlash,
    'flash-jugar': () => iniciarFlash(el.dataset.area || 'Todas', (el.dataset.tipo || 'todas') as TipoCarta),
    'flash-flip': flipFlash,
    'flash-cal': () => calFlash(el.dataset.b === '1'),
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
  const lider = liga.clasificacion[0]?.xp || 1;
  const casosOk = casosResueltos();
  const record = mejorQuiz();
  const dias = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const porVencer = mazoDeHoy(99).length;
  const casosPend = totalCasos - casosOk;
  const focos = focusItems({ d, banco, porVencer, casosPend, casosTotal: totalCasos, record });
  const anillo = ringXP(nv.pct, nv.color);
  const yoFila = liga.yo || liga.clasificacion.find((f) => f.esYo);
  const top3 = liga.clasificacion.slice(0, 3);
  const resto = liga.clasificacion.slice(3, 10);
  const horasHastaManana = (() => {
    const ahora = new Date();
    const manana = new Date(ahora); manana.setHours(24, 0, 0, 0);
    const ms = manana.getTime() - ahora.getTime();
    const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
    return h >= 1 ? `${h} h` : `${m} min`;
  })();

  pinta(`
    <header class="retos-hero">
      <div class="retos-hero__left">
        <span class="retos-hero__kicker"><i data-lucide="shield" class="i"></i>Liga Dermalysse</span>
        <h1 class="retos-hero__title">Retos</h1>
        <p class="retos-hero__sub">Practica criterio profesional con el contenido real del club. Suma XP, mantén tu racha y escala en el ranking.</p>
        ${focos[0] ? `<button class="retos-hero__cta" data-a="${focos[0].action}" ${focos[0].href ? `data-href="${focos[0].href}"` : ''}>
          <span class="retos-hero__cta-ic"><i data-lucide="${focos[0].icon}" class="i"></i></span>
          <span class="retos-hero__cta-body">
            <small>Siguiente acción · ${focos[0].time}</small>
            <strong>${focos[0].title}</strong>
          </span>
          <span class="retos-hero__cta-xp">${focos[0].reward}</span>
          <i data-lucide="arrow-right" class="i retos-hero__cta-go"></i>
        </button>` : ''}
      </div>
      <div class="retos-hero__right">
        <div class="retos-hero__ring" style="--ring:${nv.color}">
          ${anillo}
          <div class="retos-hero__ring-center">
            <small>Nivel</small>
            <strong>${esc(nv.nombre.split(' ')[0])}</strong>
            <em>${nv.xp.toLocaleString('es-MX')} XP</em>
          </div>
        </div>
        <div class="retos-hero__next">
          ${nv.siguiente
            ? `<span><i data-lucide="chevrons-up" class="i"></i>Faltan <b>${nv.faltan.toLocaleString('es-MX')} XP</b> para ${esc(nv.siguiente.nombre.split(' ')[0])}</span>`
            : '<span><i data-lucide="crown" class="i"></i>Has alcanzado el nivel máximo</span>'}
        </div>
        <div class="retos-hero__stats">
          <span><b>${liga.yo ? '#' + liga.yo.puesto : '—'}</b><small>Posición</small></span>
          <span><b>${d.racha}</b><small>Racha ${d.racha === 1 ? 'día' : 'días'}</small></span>
          <span><b>${cursosCompletos}</b><small>Cursos</small></span>
          <span><b>${vistas}</b><small>Clases</small></span>
        </div>
      </div>
    </header>

    <div class="retos-grid">
      <section class="retos-main">

        <section class="retos-focus">
          <div class="retos-focus__head">
            <div>
              <span class="eyebrow"><i data-lucide="target" class="i"></i>Enfócate hoy</span>
              <h2>Tres pasos cortos para seguir avanzando</h2>
            </div>
            <span class="retos-focus__time"><i data-lucide="clock" class="i"></i>${focos.reduce((a, f) => a + f.minutes, 0)} min en total</span>
          </div>
          <div class="retos-focus__grid">
            ${focos.map((f, i) => focusCard(f, i)).join('')}
          </div>
        </section>

        <section class="retos-arena">
          <div class="retos-section-head">
            <h2>Zona de retos</h2>
            <span class="retos-xp"><i data-lucide="sparkles" class="i"></i>${nv.xp.toLocaleString('es-MX')} XP acumulado</span>
          </div>

          <button class="retos-daily ${d.hechoHoy ? 'is-done' : ''}" data-a="ir-diaria" ${d.hechoHoy || !banco ? 'disabled' : ''}>
            <span class="retos-daily__ic"><i data-lucide="${d.hechoHoy ? 'check-check' : 'calendar-days'}" class="i"></i></span>
            <div class="retos-daily__body">
              <div class="retos-daily__row">
                <strong>Reto diario</strong>
                ${d.racha > 0 ? `<span class="retos-flame"><i data-lucide="flame" class="i"></i>${d.racha} ${d.racha === 1 ? 'día' : 'días'}</span>` : ''}
              </div>
              <small>${d.hechoHoy ? `Listo por hoy · renueva en ${horasHastaManana}` : banco ? 'Una pregunta tomada del banco revisado · 30 segundos' : 'En preparación · se activa cuando se publique un quiz revisado'}</small>
              <div class="retos-week retos-daily__week" aria-hidden="true">${dias.map((l, i) => `<span class="${miRacha.dias[i] ? 'is-on' : ''}${i === (new Date().getDay() + 6) % 7 ? ' is-today' : ''}" title="${l}">${l}</span>`).join('')}</div>
            </div>
            <div class="retos-daily__right">
              ${d.hechoHoy ? '<span class="retos-chip retos-chip--ok"><i data-lucide="check" class="i"></i>Completado</span>' : banco ? '<span class="retos-chip retos-chip--xp">+30 XP</span>' : '<span class="retos-chip retos-chip--muted">En preparación</span>'}
              ${d.hechoHoy ? '' : '<span class="retos-daily__arrow"><i data-lucide="arrow-right" class="i"></i></span>'}
            </div>
          </button>

          <div class="retos-tiles">
            ${tile({ a: 'ir-quiz', ic: 'zap', tit: 'Quiz Relámpago', sub: 'Contrarreloj con combos y vidas', color: '#4a7fc1', kpiLabel: 'Récord', kpi: String(record), pendiente: banco === 0, meta: `${banco} preguntas · 6 áreas`, chip: record > 0 ? `${record} pts` : '15 s/pregunta' })}
            ${tile({ a: 'ir-caso', ic: 'briefcase-medical', tit: 'Casos Dermalysse', sub: 'Observa, analiza y decide', color: '#4fa899', kpiLabel: 'Resueltos', kpi: `${casosOk}/${totalCasos}`, pct: totalCasos ? Math.round(casosOk / totalCasos * 100) : 0, pendiente: totalCasos === 0, meta: `${totalCasos} casos revisados`, chip: casosPend > 0 ? `${casosPend} pendientes` : '¡Al día!' })}
            ${tile({ a: 'ir-flash', ic: 'brain', tit: 'Flashcards', sub: 'Repetición espaciada diaria', color: '#c98a5b', kpiLabel: 'Dominadas', kpi: `${em.dominadas}/${em.total}`, pct: em.total ? Math.round(em.dominadas / em.total * 100) : 0, pendiente: em.total === 0, meta: `${em.total} tarjetas totales`, chip: porVencer > 0 ? `${porVencer} para hoy` : '0 vencidas' })}
            ${tile({ a: 'historia', ic: 'route', tit: 'Modo historia', sub: 'Casos narrativos guiados', color: '#8e4466', kpiLabel: 'Mundos', kpi: '0/1', pct: 0, pendiente: false, href: '#/retos/historia', meta: 'Un mundo disponible', chip: 'Nuevo' })}
          </div>
        </section>

        <section class="retos-ranking">
          <div class="retos-section-head">
            <h2><i data-lucide="trophy" class="i" style="color:#d4a017"></i>Clasificación del club</h2>
            ${liga.esDemo ? '<span class="retos-chip retos-chip--muted"><i data-lucide="flask-conical" class="i"></i>Ejemplo</span>' : '<span class="retos-chip retos-chip--ok"><i data-lucide="shield-check" class="i"></i>Datos del club</span>'}
          </div>
          <p class="retos-ranking__intro">${liga.esDemo ? 'Vista previa; se llena con el avance real cuando el club entre en operación.' : 'Avance verificado por cursos terminados y aportes útiles.'}</p>
          ${top3.length >= 3 ? renderPodio(top3) : ''}
          <ol class="retos-ranking__list">${resto.map((f) => filaLigaCompacta(f, lider)).join('')}</ol>
          ${yoFila && yoFila.puesto > 10 ? `<div class="retos-ranking__you"><span><i data-lucide="user" class="i"></i>Tu posición</span><ol>${filaLigaCompacta(yoFila, lider)}</ol></div>` : ''}
          <p class="retos-ranking__note"><i data-lucide="lock-keyhole" class="i"></i>Solo nombre y logros de aprendizaje. Nunca datos de contacto ni información clínica.</p>
        </section>
      </section>

      <aside class="retos-side">
        <section class="retos-card retos-card--path">
          <header>
            <h3>Camino a Maestro</h3>
            <span class="retos-chip retos-chip--primary">${nv.pct}%</span>
          </header>
          <ol class="retos-path">
            ${NIVELES.map((n, i) => {
              const estado = i < nv.indice ? 'is-done' : i === nv.indice ? 'is-current' : '';
              const fill = i < nv.indice ? 100 : i === nv.indice ? nv.pct : 0;
              const corto = n.nombre.split(' ')[0];
              return `<li class="retos-path__step ${estado}" style="--step:${n.color}">
                <span class="retos-path__dot"><i data-lucide="${i < nv.indice ? 'check' : n.icon}" class="i"></i></span>
                <div class="retos-path__body">
                  <strong>${esc(corto)}</strong>
                  <small>${n.min.toLocaleString('es-MX')} XP</small>
                </div>
                ${i < NIVELES.length - 1 ? `<span class="retos-path__rail"><span style="height:${fill}%"></span></span>` : ''}
                ${i === nv.indice ? '<em class="retos-path__here">Aquí</em>' : ''}
              </li>`;
            }).join('')}
          </ol>
        </section>

        <section class="retos-card">
          <header>
            <h3>Misión semanal</h3>
            <span class="retos-chip retos-chip--primary">${misionHechas}/3</span>
          </header>
          <div class="retos-mweek">
            <div class="retos-mweek__bar"><span style="width:${(misionHechas / 3) * 100}%"></span></div>
            <small>${misionHechas === 3 ? '¡Semana completa! Vuelve el lunes para la siguiente.' : `Faltan ${3 - misionHechas} misiones esta semana.`}</small>
          </div>
          <ul class="retos-list">
            ${misionItem('Reto diario', 'Suma XP hoy', mision[0], 'calendar-days')}
            ${misionItem('Constancia', 'Mira una clase esta semana', mision[1], 'book-open')}
            ${misionItem('Memoria activa', 'Repasa tus flashcards', mision[2], 'brain')}
          </ul>
        </section>

        <section class="retos-card">
          <header><h3>Tu tablero</h3></header>
          <div class="retos-board">
            <span style="--k:#4a7fc1"><i data-lucide="zap" class="i"></i><b>${record}</b><small>Récord quiz</small></span>
            <span style="--k:#4fa899"><i data-lucide="briefcase-medical" class="i"></i><b>${casosOk}</b><small>Casos resueltos</small></span>
            <span style="--k:#c98a5b"><i data-lucide="brain" class="i"></i><b>${em.dominadas}</b><small>Dominadas</small></span>
            <span style="--k:#d39a19"><i data-lucide="flame" class="i"></i><b>${d.racha}</b><small>Racha</small></span>
          </div>
        </section>
      </aside>
    </div>
  `);

  // Wire del CTA del hero cuando lleva href externo (Modo historia).
  const cta = root()?.querySelector<HTMLButtonElement>('.retos-hero__cta');
  if (cta && cta.dataset.href) cta.addEventListener('click', (e) => { e.preventDefault(); location.hash = cta.dataset.href!; });
}

type Foco = { title: string; action: string; icon: string; time: string; minutes: number; reward: string; note: string; color: string; href?: string };
function focusItems(ctx: { d: ReturnType<typeof retoDiario>; banco: number; porVencer: number; casosPend: number; casosTotal: number; record: number }): Foco[] {
  const out: Foco[] = [];
  if (!ctx.d.hechoHoy && ctx.banco > 0) {
    out.push({ title: 'Reto diario de hoy', action: 'ir-diaria', icon: 'calendar-days', time: '~1 min', minutes: 1, reward: '+30 XP', note: ctx.d.racha > 0 ? `Mantén tu racha de ${ctx.d.racha} ${ctx.d.racha === 1 ? 'día' : 'días'}` : 'Empieza una nueva racha', color: '#681c31' });
  }
  if (ctx.porVencer > 0) {
    out.push({ title: `${ctx.porVencer} ${ctx.porVencer === 1 ? 'tarjeta' : 'tarjetas'} para repasar`, action: 'ir-flash', icon: 'brain', time: '~5 min', minutes: 5, reward: '+3 XP ×', note: 'Repetición espaciada · fija lo esencial', color: '#c98a5b' });
  }
  if (ctx.casosPend > 0) {
    out.push({ title: `${ctx.casosPend} ${ctx.casosPend === 1 ? 'caso' : 'casos'} esperando criterio`, action: 'ir-caso', icon: 'briefcase-medical', time: '~5 min', minutes: 5, reward: '+50 XP', note: 'Dos pasos: observa y decide', color: '#4fa899' });
  }
  if (out.length < 3) {
    out.push({ title: 'Quiz Relámpago en modo libre', action: 'ir-quiz', icon: 'zap', time: '~3 min', minutes: 3, reward: ctx.record ? `Rompe tu récord de ${ctx.record}` : '+XP por acierto', note: 'Elige el área que quieras entrenar', color: '#4a7fc1' });
  }
  if (out.length < 3) {
    out.push({ title: 'Explora el Modo historia', action: 'historia', icon: 'route', time: '~8 min', minutes: 8, reward: 'Narrativa guiada', note: 'Un mundo nuevo cada entrega', color: '#8e4466', href: '#/retos/historia' });
  }
  return out.slice(0, 3);
}

function focusCard(f: Foco, i: number) {
  const tag = f.href ? 'a' : 'button';
  const attrs = f.href ? `href="${f.href}"` : `data-a="${f.action}"`;
  return `<${tag} class="retos-focus__card ${i === 0 ? 'is-primary' : ''}" ${attrs} style="--f:${f.color}">
    <span class="retos-focus__num">${i + 1}</span>
    <span class="retos-focus__ic"><i data-lucide="${f.icon}" class="i"></i></span>
    <div class="retos-focus__body">
      <strong>${esc(f.title)}</strong>
      <small>${esc(f.note)}</small>
      <div class="retos-focus__meta"><span><i data-lucide="clock" class="i"></i>${f.time}</span><span class="retos-focus__xp">${f.reward}</span></div>
    </div>
    <i data-lucide="arrow-right" class="i retos-focus__go"></i>
  </${tag}>`;
}

// Anillo SVG de progreso del nivel actual (CSP-safe: inline SVG, sin scripts).
function ringXP(pct: number, color: string): string {
  const r = 54; const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return `<svg class="retos-hero__ring-svg" viewBox="0 0 128 128" aria-hidden="true">
    <circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--line)" stroke-width="8"/>
    <circle cx="64" cy="64" r="${r}" fill="none" stroke="${esc(color)}" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"
      transform="rotate(-90 64 64)"/>
  </svg>`;
}

function renderPodio(top: FilaLiga[]) {
  // Orden visual: 2 · 1 · 3 (como un podio).
  const orden = [top[1], top[0], top[2]];
  const altura = [78, 110, 62];
  const medalla = ['silver', 'gold', 'bronze'];
  return `<div class="retos-podium">
    ${orden.map((f, i) => `<div class="retos-podium__slot retos-podium__slot--${medalla[i]}">
      <div class="avatar retos-podium__avatar">${f.foto ? `<img src="${esc(f.foto)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : iniciales(f.nombre)}</div>
      <strong class="retos-podium__name">${esc(f.nombre)}${f.esYo ? ' <em>Tú</em>' : ''}</strong>
      <small class="retos-podium__xp">${f.xp.toLocaleString('es-MX')} XP</small>
      <div class="retos-podium__block" style="height:${altura[i]}px">
        <span class="retos-podium__pos">${f.puesto}</span>
        <i data-lucide="${i === 1 ? 'crown' : 'medal'}" class="i"></i>
      </div>
    </div>`).join('')}
  </div>`;
}

function filaLigaCompacta(f: FilaLiga, lider: number) {
  const w = Math.max(5, Math.round(f.xp / lider * 100));
  return `<li class="retos-row ${f.esYo ? 'is-you' : ''}" style="--w:${w}%">
    <span class="retos-row__rank">${f.puesto}</span>
    <div class="avatar retos-row__avatar">${f.foto ? `<img src="${esc(f.foto)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : iniciales(f.nombre)}</div>
    <div class="retos-row__name"><strong>${esc(f.nombre)}${f.esYo ? ' <em>Tú</em>' : ''}</strong><small>${esc(f.nivel)} · ${f.cursos} cursos · ${f.clases} clases</small></div>
    <b class="retos-row__xp">${f.xp.toLocaleString('es-MX')} XP</b>
  </li>`;
}

const misionItem = (titulo: string, sub: string, ok: boolean, icon = 'circle') => `<li class="${ok ? 'is-done' : ''}"><span class="retos-check"><i data-lucide="${ok ? 'check' : icon}" class="i"></i></span><div><strong>${titulo}</strong><small>${sub}</small></div></li>`;

type TileOpts = { a: string; ic: string; tit: string; sub: string; color: string; kpiLabel: string; kpi: string; pct?: number; pendiente: boolean; href?: string; meta?: string; chip?: string };
function tile(o: TileOpts) {
  const tag = o.pendiente ? 'div' : o.href ? 'a' : 'button';
  const attrs = o.pendiente
    ? ` class="retos-tile is-pending" aria-disabled="true"`
    : o.href
      ? ` class="retos-tile" href="${o.href}"`
      : ` class="retos-tile" data-a="${o.a}"`;
  const chip = o.pendiente ? '<span class="retos-chip retos-chip--muted">En preparación</span>' : (o.chip ? `<span class="retos-tile__chip">${esc(o.chip)}</span>` : '');
  const barra = typeof o.pct === 'number' ? `<div class="retos-tile__bar" aria-hidden="true"><span style="width:${o.pct}%"></span></div>` : '';
  return `
  <${tag}${attrs} style="--c:${o.color}">
    <div class="retos-tile__head">
      <span class="retos-tile__ic"><i data-lucide="${o.ic}" class="i"></i></span>
      <span class="retos-tile__kpi"><small>${o.kpiLabel}</small><b>${o.kpi}</b></span>
    </div>
    <div class="retos-tile__body">
      <strong>${o.tit}</strong>
      <small>${o.sub}</small>
    </div>
    ${barra}
    <div class="retos-tile__foot">
      ${chip || `<span class="retos-tile__meta">${esc(o.meta || '')}</span>`}
      <span class="retos-tile__cta">${o.pendiente ? 'Pronto' : 'Abrir'}<i data-lucide="${o.pendiente ? 'clock' : 'arrow-right'}" class="i"></i></span>
    </div>
  </${tag}>`;
}

// ══════════════ Helpers compartidos ══════════════
const barraVolver = () => `<button class="btn btn--ghost btn--sm" data-a="hub"><i data-lucide="arrow-left" class="i"></i>Retos</button>`;

function iconoArea(area: string): string {
  const m: Record<string, string> = {
    'Cosmiatría': 'wand-2', 'Cosmetología': 'flask-conical', 'Estética facial': 'sparkles',
    'Estética corporal': 'activity', 'Nutrición': 'apple', 'Regulación': 'scale', 'General': 'book-open',
  };
  return m[area] || 'brain-circuit';
}

function heroBiblioteca(icono: string, kicker: string, titulo: string, texto: string, color: string, stats: string) {
  return `<header class="challenge-hero" style="--game:${color}">
    <div class="challenge-hero__copy"><span class="challenge-kicker">${kicker}</span><h1 class="display">${titulo}</h1><p>${texto}</p><div class="challenge-hero__stats">${stats}</div></div>
    <div class="challenge-hero__mascot" style="display:grid;place-items:center;background:rgba(255,255,255,.08);border-radius:50%;width:160px;height:160px;border:1px solid rgba(255,255,255,.14)"><i data-lucide="${icono}" class="i" style="width:72px;height:72px;color:#fff"></i></div>
  </header>`;
}

// ══════════════ QUIZ RELÁMPAGO ══════════════
const modoCard = (modo: string, area: string, icon: string, titulo: string, texto: string, meta: string, color: string) =>
  `<button class="mode-card" data-a="quiz-jugar" data-modo="${modo}" data-area="${esc(area)}" style="--mode:${color}"><span><i data-lucide="${icon}" class="i"></i></span><strong>${titulo}</strong><p>${texto}</p><small>${meta}<i data-lucide="arrow-right" class="i"></i></small></button>`;

function bibliotecaQuiz() {
  vista = 'quiz'; parar();
  const preguntas = bancoPreguntas();
  const areas = [...new Set(preguntas.map((p) => p.area))].sort();
  pinta(`${barraVolver()}
    ${heroBiblioteca('zap', 'Arena de conocimiento', 'Quiz Relámpago', 'Elige cómo entrenar: contra reloj, en modo práctica o por área profesional.', '#4a7fc1', `<span><b>${preguntas.length}</b> preguntas</span><span><b>${areas.length}</b> áreas</span><span><b>${mejorQuiz()}</b> récord</span>`)}
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
  subir();
}

function iniciarQuiz(area = 'Todas', modo: 'relampago' | 'practica' = 'relampago') {
  const pool = barajar(bancoPreguntas().filter((p) => area === 'Todas' || p.area === area));
  if (!pool.length) { pinta(`${barraVolver()}<div class="ar-empty" style="padding:40px;text-align:center;color:var(--text-2)">Aún no hay preguntas publicadas en esa área.</div>`); return; }
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
  const bar = document.getElementById('ar-tbar'); if (!bar) return;
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
  Q.contestada = true; parar();
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
    Q.score += suma; Q.combo++; celebrar('normal');
  } else { Q.vidas--; Q.combo = 0; }
  const fin = Q.vidas <= 0 || Q.idx >= Q.preguntas.length - 1;
  const fb = document.getElementById('ar-fb'); if (!fb) return;
  fb.innerHTML = `<div class="ar-exp ${ok ? 'ok' : 'bad'}"><strong>${ok ? '¡Correcto! ⚡' : 'Casi…'}</strong><p>${esc(p.explicacion)}</p><button class="btn btn--brand" data-a="quiz-sig">${fin ? 'Ver resultado' : 'Siguiente'} <i data-lucide="arrow-right" class="i"></i></button></div>`;
  iconos();
  requestAnimationFrame(() => root()?.querySelector('.ar-exp')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

function sigQuiz() {
  if (!Q) return;
  if (Q.vidas <= 0 || Q.idx >= Q.preguntas.length - 1) { finQuiz(); return; }
  Q.idx++; pintaQuiz();
}

function finQuiz() {
  if (!Q) return;
  parar(); registrarQuiz(Q.score);
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
  celebrar('grande'); Q = null;
}

// ══════════════ RETO DIARIO ══════════════
function iniciarDiaria() {
  vista = 'diaria'; parar();
  const d = retoDiario();
  if (d.hechoHoy || !d.pregunta) { hub(); return; }
  D = { pregunta: d.pregunta, contestada: false };
  pintaDiaria();
  subir();
}

function pintaDiaria() {
  if (!D || !D.pregunta) return;
  const p = D.pregunta;
  pinta(`${barraVolver()}
    ${heroBiblioteca('calendar-days', 'Reto del día', 'Pregunta de hoy', 'Una pregunta rápida tomada del banco revisado. Si aciertas sumas 30 XP; si fallas, 10. Vuelve mañana para no perder la racha.', '#681c31', `<span><b>${esc(p.area)}</b></span><span><b>+30 XP</b> por acierto</span><span><b>Mantiene</b> tu racha</span>`)}
    <div class="ar-q" style="max-width:720px;margin:0 auto">
      <span class="chip chip--primary">${esc(p.area)}</span>
      <h2 class="display" style="font-size:var(--fs-xl)">${esc(p.q)}</h2>
      <div class="ar-opts">
        ${p.opciones.map((o, i) => `<button class="ar-opt" data-a="diaria-resp" data-i="${i}">${esc(o)}</button>`).join('')}
      </div>
      <div id="ar-fb"></div>
    </div>`);
}

function respDiaria(i: number) {
  if (!D || !D.pregunta || D.contestada) return;
  D.contestada = true;
  const p = D.pregunta;
  const ok = i === p.correcta;
  root()?.querySelectorAll<HTMLButtonElement>('.ar-opt').forEach((b, j) => {
    b.disabled = true;
    if (j === p.correcta) b.classList.add('ok');
    if (j === i && !ok) b.classList.add('bad');
  });
  const registro = completarDiaria(ok);
  if (ok) celebrar('normal');
  const fb = document.getElementById('ar-fb'); if (!fb) return;
  fb.innerHTML = `
    <div class="ar-exp ${ok ? 'ok' : 'bad'}">
      <strong>${ok ? '¡Correcto! +30 XP' : 'Casi… +10 XP por intentarlo'}</strong>
      <p>${esc(p.explicacion)}</p>
      <p class="faint" style="margin-top:6px"><i data-lucide="flame" class="i" style="width:14px;height:14px;color:#d39a19;vertical-align:-2px"></i> Racha actualizada a <strong>${registro.racha} ${registro.racha === 1 ? 'día' : 'días'}</strong>. Vuelve mañana para mantenerla.</p>
      <button class="btn btn--brand" data-a="hub">Volver a Retos <i data-lucide="arrow-right" class="i"></i></button>
    </div>`;
  iconos(); D = null;
}

// ══════════════ CASOS DERMALYSSE ══════════════
function elegirCaso() {
  vista = 'caso'; parar();
  const todos = casos();
  const areas = [...new Set(todos.map((c) => c.area))].sort();
  const visibles = filtroCaso === 'Todas' ? todos : todos.filter((c) => c.area === filtroCaso);
  const resueltos = idsCasosResueltos();
  pinta(`${barraVolver()}
    ${heroBiblioteca('briefcase-medical', 'Casos de criterio', 'Casos Dermalysse', 'Observa, analiza y decide. Cada caso tiene dos pasos: identificar la situación y proponer un plan responsable.', '#4fa899', `<span><b>${todos.length}</b> casos</span><span><b>${areas.length}</b> áreas</span><span><b>${casosResueltos()}</b> resueltos</span>`)}
    <section class="challenge-section"><div class="challenge-section__head"><div><span class="eyebrow">Archivo</span><h2>Elige un caso</h2></div><span>${visibles.length} ${visibles.length === 1 ? 'caso disponible' : 'casos disponibles'}</span></div>
      <div class="filter-row">
        <button class="filter-chip ${filtroCaso === 'Todas' ? 'is-active' : ''}" data-a="caso-filtro" data-area="Todas">Todos <b>${todos.length}</b></button>
        ${areas.map((area) => `<button class="filter-chip ${filtroCaso === area ? 'is-active' : ''}" data-a="caso-filtro" data-area="${esc(area)}">${esc(area)} <b>${todos.filter((c) => c.area === area).length}</b></button>`).join('')}
      </div>
      <div class="case-grid">${visibles.map((c) => `
        <button class="case-card ${resueltos.has(c.id) ? 'is-solved' : ''}" data-a="caso-jugar" data-id="${esc(c.id)}">
          <span class="case-card__species"><i data-lucide="${iconoArea(c.area)}" class="i"></i>${esc(c.area)}</span>
          <strong>${esc(c.titulo)}</strong>
          <p>${esc(c.paciente)}</p>
          <span class="case-card__status">${resueltos.has(c.id) ? '✓ Revisar de nuevo' : 'Abrir caso →'}</span>
        </button>`).join('')}</div>
    </section>`);
  subir();
}

function iniciarCaso(id: string) {
  const caso = casos().find((c) => c.id === id);
  if (!caso) return;
  C = { caso, fase: 'diagnostico', aciertos: 0, respuesta: null };
  pintaCaso();
  subir();
}

function pintaCaso() {
  if (!C) return;
  const { caso, fase } = C;
  const bloque = fase === 'diagnostico' ? caso.diagnostico : fase === 'plan' ? caso.plan : null;
  pinta(`${barraVolver()}
    <article class="case-detail" style="display:grid;gap:18px;max-width:860px;margin:0 auto">
      <header class="case-detail__head">
        <span class="chip chip--primary"><i data-lucide="${iconoArea(caso.area)}" class="i"></i>${esc(caso.area)}</span>
        <h1 class="display" style="font-size:var(--fs-2xl);margin-top:8px">${esc(caso.titulo)}</h1>
        <p class="muted" style="font-size:var(--fs-sm);margin-top:4px">${esc(caso.paciente)}</p>
      </header>
      <section class="card card--pad stack" style="gap:12px">
        <span class="eyebrow"><i data-lucide="clipboard" class="i"></i>Presentación</span>
        <p>${esc(caso.presentacion)}</p>
        <ul class="case-findings">
          ${caso.hallazgos.map((h) => `<li><i data-lucide="dot" class="i"></i>${esc(h)}</li>`).join('')}
        </ul>
      </section>
      ${bloque ? `
      <section class="card card--pad stack" style="gap:14px">
        <span class="eyebrow" style="color:#4fa899"><i data-lucide="${fase === 'diagnostico' ? 'microscope' : 'route'}" class="i"></i>${fase === 'diagnostico' ? 'Paso 1 · Observación' : 'Paso 2 · Decisión profesional'}</span>
        <h2 class="display" style="font-size:var(--fs-xl)">${esc(bloque.pregunta)}</h2>
        <div class="ar-opts">
          ${bloque.opciones.map((o, i) => `<button class="ar-opt" data-a="caso-resp" data-i="${i}">${esc(o)}</button>`).join('')}
        </div>
        <div id="ar-fb"></div>
      </section>` : finCaso()}
    </article>`);
}

function respCaso(i: number) {
  if (!C || C.respuesta !== null) return;
  C.respuesta = i;
  const bloque = C.fase === 'diagnostico' ? C.caso.diagnostico : C.caso.plan;
  const ok = i === bloque.correcta;
  if (ok) C.aciertos++;
  root()?.querySelectorAll<HTMLButtonElement>('.ar-opt').forEach((b, j) => {
    b.disabled = true;
    if (j === bloque.correcta) b.classList.add('ok');
    if (j === i && !ok) b.classList.add('bad');
  });
  const esUltima = C.fase === 'plan';
  const fb = document.getElementById('ar-fb'); if (!fb) return;
  fb.innerHTML = `
    <div class="ar-exp ${ok ? 'ok' : 'bad'}">
      <strong>${ok ? '¡Decisión correcta!' : 'Hay otra lectura más responsable'}</strong>
      <p>${esc(bloque.explicacion)}</p>
      <button class="btn btn--brand" data-a="caso-sig">${esUltima ? 'Ver resultado' : 'Siguiente paso'} <i data-lucide="arrow-right" class="i"></i></button>
    </div>`;
  iconos();
  requestAnimationFrame(() => root()?.querySelector('.ar-exp')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

function sigCaso() {
  if (!C) return;
  if (C.fase === 'diagnostico') { C.fase = 'plan'; C.respuesta = null; pintaCaso(); return; }
  C.fase = 'resultado'; pintaCaso();
}

function finCaso(): string {
  if (!C) return '';
  const perfecto = C.aciertos === 2;
  resolverCaso(C.caso.id, perfecto);
  if (perfecto) celebrar('grande');
  const html = `
    <section class="ar-result" style="text-align:center;padding:40px 24px;display:grid;gap:14px;place-items:center">
      <div class="ar-result__ic" style="width:84px;height:84px;border-radius:50%;background:linear-gradient(135deg,#4fa899,#0b2435);color:#fff;display:grid;place-items:center"><i data-lucide="${perfecto ? 'badge-check' : 'target'}" class="i" style="width:38px;height:38px"></i></div>
      <h2 class="display" style="font-size:var(--fs-2xl);margin:0">${perfecto ? 'Caso resuelto con criterio' : 'Caso cerrado · revisa el enfoque'}</h2>
      <p class="muted">${C.aciertos}/2 decisiones correctas${perfecto ? ' · <strong>+50 XP</strong>' : ' · intenta de nuevo cuando quieras'}</p>
      <div class="row" style="gap:10px;justify-content:center">
        <button class="btn btn--brand btn--lg" data-a="ir-caso"><i data-lucide="briefcase-medical" class="i"></i>Ver más casos</button>
        <button class="btn btn--secondary btn--lg" data-a="hub">Volver a Retos</button>
      </div>
    </section>`;
  C = null;
  return html;
}

// ══════════════ FLASHCARDS ══════════════
function bibliotecaFlash() {
  vista = 'flash'; parar();
  const todas = mazoCompleto();
  const areas = [...new Set(todas.map((c) => c.area))].sort();
  const em = estatsMazo();
  pinta(`${barraVolver()}
    ${heroBiblioteca('brain', 'Memoria activa', 'Flashcards', 'Repite lo esencial de los cursos con repetición espaciada: la plataforma te vuelve a mostrar lo que todavía no dominas.', '#c98a5b', `<span><b>${todas.length}</b> tarjetas</span><span><b>${em.dominadas}</b> dominadas</span><span><b>${areas.length}</b> áreas</span>`)}
    <section class="challenge-section"><div class="challenge-section__head"><div><span class="eyebrow">Modos</span><h2>¿Qué repasar hoy?</h2></div></div>
      <div class="mode-grid">
        <button class="mode-card" data-a="flash-jugar" data-area="Todas" data-tipo="todas" style="--mode:#c98a5b"><span><i data-lucide="layers-3" class="i"></i></span><strong>Mazo del día</strong><p>Hasta 15 tarjetas priorizando las que ya tocan repasar</p><small>Mixto<i data-lucide="arrow-right" class="i"></i></small></button>
        <button class="mode-card" data-a="flash-jugar" data-area="Todas" data-tipo="quiz" style="--mode:#4a7fc1"><span><i data-lucide="help-circle" class="i"></i></span><strong>Solo preguntas</strong><p>Tarjetas creadas desde los quizzes aprobados</p><small>${todas.filter((c) => c.id.startsWith('q:')).length} tarjetas<i data-lucide="arrow-right" class="i"></i></small></button>
        <button class="mode-card" data-a="flash-jugar" data-area="Todas" data-tipo="concepto" style="--mode:#4fa899"><span><i data-lucide="list-checks" class="i"></i></span><strong>Solo conceptos</strong><p>Las claves con marca de tiempo de las notas de clase</p><small>${todas.filter((c) => c.id.startsWith('n:')).length} tarjetas<i data-lucide="arrow-right" class="i"></i></small></button>
      </div>
    </section>
    ${areas.length ? `<section class="challenge-section"><div class="challenge-section__head"><div><span class="eyebrow">Por área</span><h2>Elige una especialidad</h2></div></div>
      <div class="deck-grid">${areas.map((area) => {
        const n = todas.filter((c) => c.area === area).length;
        const dom = estatsMazoFiltrado(area).dominadas;
        return `<button class="deck-card" data-a="flash-jugar" data-area="${esc(area)}" data-tipo="todas" style="--deck:#c98a5b"><span class="deck-card__icon"><i data-lucide="${iconoArea(area)}" class="i"></i></span><span class="deck-card__body"><strong>${esc(area)}</strong><small>${dom}/${n} dominadas</small></span><i data-lucide="arrow-up-right" class="i deck-card__go"></i></button>`;
      }).join('')}</div>
    </section>` : ''}`);
  subir();
}

function iniciarFlash(area = 'Todas', tipo: TipoCarta = 'todas') {
  const mazo = mazoFiltrado(area, tipo, 15);
  if (!mazo.length) { pinta(`${barraVolver()}<div class="ar-empty" style="padding:40px;text-align:center;color:var(--text-2)">Aún no hay tarjetas en esta selección.</div>`); return; }
  F = { mazo, idx: 0, flipped: false, aciertos: 0, area, tipo };
  pintaFlash();
  subir();
}

function pintaFlash() {
  if (!F) return;
  if (F.idx >= F.mazo.length) { finFlash(); return; }
  const c = F.mazo[F.idx];
  pinta(`${barraVolver()}
    <div class="ar-top" style="justify-content:flex-end">
      <div class="ar-hud"><span class="ar-score"><i data-lucide="brain" class="i"></i>${F.idx + 1}/${F.mazo.length}</span></div>
    </div>
    <div class="flashcard-stage" style="max-width:720px;margin:0 auto;display:grid;gap:18px">
      <div class="flashcard ${F.flipped ? 'is-flipped' : ''}" data-a="flash-flip" role="button" tabindex="0">
        <div class="flashcard__face flashcard__face--front">
          <span class="chip chip--primary">${esc(c.area)}</span>
          <div class="flashcard__content"><p style="margin:0">${esc(c.frente)}</p></div>
          <small class="faint"><i data-lucide="refresh-cw" class="i"></i>Toca para ver la respuesta</small>
        </div>
        <div class="flashcard__face flashcard__face--back">
          <span class="chip" style="background:rgba(201,138,91,.14);color:#c98a5b">Respuesta</span>
          <div class="flashcard__content" style="font-size:clamp(1rem, 1.6vw, 1.25rem);line-height:1.4">${c.reverso}</div>
          <small class="faint">${esc(c.curso)}</small>
        </div>
      </div>
      ${F.flipped ? `
      <div class="flashcard__actions">
        <button class="btn btn--secondary btn--lg" data-a="flash-cal" data-b="0"><i data-lucide="rotate-ccw" class="i"></i>Sigo repasando</button>
        <button class="btn btn--brand btn--lg" data-a="flash-cal" data-b="1"><i data-lucide="check" class="i"></i>Ya la domino</button>
      </div>` : '<p class="muted" style="text-align:center;font-size:var(--fs-sm)">Lee el frente con calma, haz tu respuesta mentalmente y luego voltea la tarjeta.</p>'}
    </div>`);
}

function flipFlash() {
  if (!F) return;
  F.flipped = !F.flipped;
  pintaFlash();
}

function calFlash(bien: boolean) {
  if (!F) return;
  const c = F.mazo[F.idx];
  repasarCarta(c.id, bien);
  if (bien) F.aciertos++;
  F.idx++; F.flipped = false;
  pintaFlash();
}

function finFlash() {
  if (!F) return;
  const total = F.mazo.length;
  const pct = Math.round(F.aciertos / total * 100);
  pinta(`${barraVolver()}
    <div class="ar-result" style="text-align:center;padding:48px 24px;display:grid;gap:14px;place-items:center">
      <div class="ar-result__ic" style="width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,#c98a5b,#681c31);color:#fff;display:grid;place-items:center"><i data-lucide="brain" class="i" style="width:40px;height:40px"></i></div>
      <h2 class="display" style="font-size:var(--fs-2xl);margin:0">${F.aciertos}/${total} dominadas</h2>
      <p class="muted">${pct}% de la sesión. ${pct >= 70 ? 'Gran repaso.' : 'Buen comienzo — vuelve mañana para fijar los conceptos.'}</p>
      <div class="row" style="gap:10px;justify-content:center">
        <button class="btn btn--brand btn--lg" data-a="ir-flash"><i data-lucide="rotate-ccw" class="i"></i>Otra sesión</button>
        <button class="btn btn--secondary btn--lg" data-a="hub">Volver a Retos</button>
      </div>
    </div>`);
  if (pct >= 70) celebrar('normal');
  F = null;
}
