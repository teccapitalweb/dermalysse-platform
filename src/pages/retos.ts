import { Datos } from '../core/datos';
import { cargarRetosRemotos, responderReto } from '../core/arcade-remoto';
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
type FiltroRetos = 'todas' | 'evaluacion' | 'aplicacion' | 'repaso';
let filtroRetos: FiltroRetos = 'todas';

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
  vista = 'hub'; parar(); retosListos = Datos.modo !== 'api';
  r.addEventListener('click', onClick);
  r.addEventListener('keydown', onKeydown);
  window.addEventListener('retos:cambio', () => { if (vista === 'hub' && retosListos) hub(); });
  if (Datos.modo === 'api') { pinta('<p role=status>Cargando tus retos…</p>'); cargarRetosRemotos().then(() => { if (root() === r) { retosListos = true; hub(); } }).catch(errorArcade); } else hub();
  Liga.cargar().then(() => { if (vista === 'hub' && retosListos && root()) hub(); });
}

function onKeydown(e: KeyboardEvent) {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a="flash-flip"]');
  if (!el || (e.key !== 'Enter' && e.key !== ' ')) return;
  e.preventDefault();
  flipFlash();
}

function onClick(e: Event) {
  if (guardando) return;
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
  if (!el) return;
  const a = el.dataset.a!;
  const acciones: Record<string, () => void> = {
    recargar: async () => { await cargarRetosRemotos(); retosListos = true; hub(); },
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
    'filtro-retos': () => filtrarRetos(el.dataset.filtro || 'todas'),
    'actualizar-liga': () => {
      Liga.limpiar();
      hub();
      Liga.cargar().then(() => { if (vista === 'hub' && retosListos && root()) hub(); });
    },
  };
  Promise.resolve(acciones[a]?.()).catch(errorArcade);
}

function filtrarRetos(valor: string) {
  const validos: FiltroRetos[] = ['todas', 'evaluacion', 'aplicacion', 'repaso'];
  if (!validos.includes(valor as FiltroRetos)) return;
  filtroRetos = valor as FiltroRetos;
  const contenedor = root();
  if (!contenedor) return;
  contenedor.querySelectorAll<HTMLButtonElement>('[data-a="filtro-retos"]').forEach((boton) => {
    const activo = boton.dataset.filtro === filtroRetos;
    boton.classList.toggle('is-active', activo);
    boton.setAttribute('aria-pressed', String(activo));
  });
  const tarjetas = [...contenedor.querySelectorAll<HTMLElement>('.retos-tile[data-category]')];
  let visibles = 0;
  tarjetas.forEach((tarjeta) => {
    tarjeta.hidden = filtroRetos !== 'todas' && tarjeta.dataset.category !== filtroRetos;
    if (!tarjeta.hidden) visibles += 1;
  });
  const etiquetas: Record<FiltroRetos, string> = {
    todas: 'Elige una modalidad según el tiempo y enfoque que buscas.',
    evaluacion: 'Pon a prueba tus conocimientos y supera tu mejor marca.',
    aplicacion: 'Practica el análisis y la toma de decisiones educativas.',
    repaso: 'Refuerza conceptos con sesiones breves y repetición.',
  };
  const cuenta = contenedor.querySelector<HTMLElement>('#retos-catalog-count');
  if (cuenta) cuenta.textContent = `${visibles} ${visibles === 1 ? 'modalidad' : 'modalidades'}`;
  const ayuda = contenedor.querySelector<HTMLElement>('#retos-catalog-hint');
  if (ayuda) ayuda.textContent = etiquetas[filtroRetos];
}

// ══════════════ HUB ══════════════
function hub() {
  if (!retosListos) { pinta('<p role=status>No se cargaron los retos. <button class=btn data-a=recargar>Reintentar</button></p>'); return; }
  vista = 'hub';
  const nv = nivel();
  const d = retoDiario();
  const em = estatsMazo();
  const totalCasos = casos().length;
  const banco = bancoPreguntas().length;
  const liga = Liga.resumen();
  const miRacha = racha();
  const mision = [d.hechoHoy, miRacha.activaEstaSemana, em.estudiadas > 0];
  const misionHechas = mision.filter(Boolean).length;
  const lider = liga.clasificacion[0]?.xp || 1;
  const casosOk = casosResueltos();
  const record = mejorQuiz();
  const porVencer = mazoDeHoy(99).length;
  const casosPend = totalCasos - casosOk;
  const yoFila = liga.yo || liga.clasificacion.find((f) => f.esYo);
  const top3 = liga.clasificacion.slice(0, 3);
  const resto = liga.clasificacion.slice(3, 10);
  const ligaCargando = Liga.cargando();
  const rankingBadge = ligaCargando ? '<span class="retos-chip retos-chip--muted">Cargando</span>'
    : liga.estado === 'error' ? '<span class="retos-chip retos-chip--muted">Sin conexión</span>'
      : liga.estado === 'sin-acceso' ? '<span class="retos-chip retos-chip--muted">Acceso requerido</span>'
        : liga.esDemo ? '<span class="retos-chip retos-chip--muted">Ejemplo</span>'
          : liga.clasificacion.length ? '<span class="retos-chip retos-chip--ok">Datos del club</span>'
            : '<span class="retos-chip retos-chip--muted">Sin actividad</span>';
  const rankingContenido = ligaCargando
    ? '<p class="retos-ranking__state" role="status" aria-live="polite">Consultando la clasificación del club…</p>'
    : liga.estado === 'error'
      ? '<div class="retos-ranking__state" role="alert"><span>No pudimos cargar la clasificación. Tus retos siguen disponibles.</span><button class="btn btn--secondary btn--sm" data-a="actualizar-liga">Reintentar</button></div>'
      : liga.estado === 'sin-acceso'
        ? '<div class="retos-ranking__state"><span>Inicia sesión para consultar la clasificación del club.</span><a class="btn btn--secondary btn--sm" href="#/login">Iniciar sesión</a></div>'
        : liga.clasificacion.length === 0
          ? '<p class="retos-ranking__state">Todavía no hay actividad en la clasificación.</p>'
          : `${liga.esDemo ? '<p class="retos-ranking__intro">Vista de ejemplo local; no representa actividad real del club.</p>' : '<p class="retos-ranking__intro">Avance del club registrado en la plataforma.</p>'}
            ${top3.length >= 3 ? renderPodio(top3) : ''}
            <ol class="retos-ranking__list">${resto.map((f) => filaLigaCompacta(f, lider)).join('')}</ol>
            ${yoFila && yoFila.puesto > 10 ? `<div class="retos-ranking__you"><span><i data-lucide="user" class="i"></i>Tu posición</span><ol>${filaLigaCompacta(yoFila, lider)}</ol></div>` : ''}
            <p class="retos-ranking__note"><i data-lucide="lock-keyhole" class="i"></i>Solo nombre y logros de aprendizaje. Nunca datos de contacto ni información clínica.</p>`;

  const modalidades = [
    { categoria: 'evaluacion' as const, etiqueta: 'Evaluación', html: tile({ index: '01', a: 'ir-quiz', ic: 'zap', img: '/media/retos/quiz-relampago.webp', tit: 'Quiz Relámpago', sub: 'Contrarreloj con combos y vidas', color: '#4a7fc1', kpiLabel: 'Récord', kpi: String(record), pendiente: banco === 0, meta: `${banco} preguntas · 6 áreas`, chip: record > 0 ? `${record} pts` : '15 s/pregunta', categoria: 'evaluacion', categoriaLabel: 'Evaluación' }) },
    { categoria: 'aplicacion' as const, etiqueta: 'Aplicación', html: tile({ index: '02', a: 'ir-caso', ic: 'briefcase-medical', img: '/media/retos/casos-dermalysse.webp', tit: 'Casos Dermalysse', sub: 'Observa, analiza y decide', color: '#4fa899', kpiLabel: 'Resueltos', kpi: `${casosOk}/${totalCasos}`, pct: totalCasos ? Math.round(casosOk / totalCasos * 100) : 0, pendiente: totalCasos === 0, meta: `${totalCasos} casos revisados`, chip: casosPend > 0 ? `${casosPend} pendientes` : '¡Al día!', categoria: 'aplicacion', categoriaLabel: 'Aplicación' }) },
    { categoria: 'repaso' as const, etiqueta: 'Repaso', html: tile({ index: '03', a: 'ir-flash', ic: 'brain', img: '/media/retos/flashcards.webp', tit: 'Flashcards', sub: 'Repetición espaciada diaria', color: '#c98a5b', kpiLabel: 'Dominadas', kpi: `${em.dominadas}/${em.total}`, pct: em.total ? Math.round(em.dominadas / em.total * 100) : 0, pendiente: em.total === 0, meta: `${em.total} tarjetas totales`, chip: porVencer > 0 ? `${porVencer} para hoy` : '0 vencidas', categoria: 'repaso', categoriaLabel: 'Repaso' }) },
    { categoria: 'aplicacion' as const, etiqueta: 'Aplicación', html: tile({ index: '04', a: 'historia', ic: 'route', img: '/media/retos/modo-historia.webp', tit: 'Modo historia', sub: 'Casos narrativos guiados', color: '#8e4466', kpiLabel: 'Mundos', kpi: '0/1', pct: 0, pendiente: false, href: '#/retos/historia', meta: 'Un mundo disponible', chip: 'Nuevo', categoria: 'aplicacion', categoriaLabel: 'Aplicación' }) },
  ];
  const filtros: { id: FiltroRetos; label: string; ayuda: string }[] = [
    { id: 'todas', label: 'Todas', ayuda: 'Elige una modalidad según el tiempo y enfoque que buscas.' },
    { id: 'evaluacion', label: 'Evaluación', ayuda: 'Pon a prueba tus conocimientos y supera tu mejor marca.' },
    { id: 'aplicacion', label: 'Aplicación', ayuda: 'Practica el análisis y la toma de decisiones educativas.' },
    { id: 'repaso', label: 'Repaso', ayuda: 'Refuerza conceptos con sesiones breves y repetición.' },
  ];
  const filtroActivo = filtros.find((f) => f.id === filtroRetos) || filtros[0];
  const cantidadVisible = modalidades.filter((m) => filtroRetos === 'todas' || m.categoria === filtroRetos).length;
  const filtrosHtml = filtros.map((f) => {
    const cantidad = f.id === 'todas' ? modalidades.length : modalidades.filter((m) => m.categoria === f.id).length;
    return `<button type="button" class="retos-filter ${filtroRetos === f.id ? 'is-active' : ''}" data-a="filtro-retos" data-filtro="${f.id}" aria-pressed="${filtroRetos === f.id}"><span>${f.label}</span><small>${cantidad}</small></button>`;
  }).join('');

  pinta(`
    <header class="retos-hero">
      <div class="retos-hero__left">
        <span class="retos-hero__kicker"><i data-lucide="target" class="i"></i>Tu práctica</span>
        <h1 class="retos-hero__title">Un reto a la vez.</h1>
        <p class="retos-hero__sub">La práctica de hoy toma menos de un minuto. Cuando termines, elige otra modalidad para seguir avanzando.</p>
        <button class="retos-hero__cta ${d.hechoHoy ? 'is-done' : ''}" data-a="ir-diaria" ${d.hechoHoy || !banco ? 'disabled' : ''}>
          <span class="retos-hero__cta-ic"><i data-lucide="${d.hechoHoy ? 'check' : 'calendar-days'}" class="i"></i></span>
          <span class="retos-hero__cta-body">
            <small>Reto de hoy · 30 segundos</small>
            <strong>${d.hechoHoy ? 'Completado por hoy' : banco ? 'Responder la pregunta diaria' : 'Disponible cuando exista un quiz revisado'}</strong>
          </span>
          <span class="retos-hero__cta-xp">${d.hechoHoy ? 'Listo' : '+30 XP'}</span>
          <i data-lucide="${d.hechoHoy ? 'check-check' : 'arrow-right'}" class="i retos-hero__cta-go"></i>
        </button>
      </div>
      <div class="retos-hero__right">
        <span class="retos-hero__art" aria-hidden="true">
          <img src="/media/retos/hero-progreso.webp" alt="" decoding="async">
        </span>
        <div class="retos-level">
          <div class="retos-level__head">
            <span><small>Nivel actual</small><strong>${esc(nv.nombre.split(' ')[0])}</strong></span>
            <b>${esc(String(nv.pct))}%</b>
          </div>
          <div class="retos-level__bar" aria-label="${esc(String(nv.pct))}% del nivel"><span style="width:${esc(String(nv.pct))}%"></span></div>
          <p>${nv.siguiente
            ? `Faltan <b>${esc(nv.faltan.toLocaleString('es-MX'))} XP</b> para ${esc(nv.siguiente.nombre.split(' ')[0])}`
            : 'Has alcanzado el nivel máximo'}</p>
        </div>
        <div class="retos-hero__stats">
          <span><b>${esc(nv.xp.toLocaleString('es-MX'))}</b><small>XP total</small></span>
          <span><b>${esc(liga.yo ? '#' + liga.yo.puesto : '—')}</b><small>Posición</small></span>
          <span><b>${esc(String(d.racha))}</b><small>Racha ${d.racha === 1 ? 'día' : 'días'}</small></span>
        </div>
      </div>
    </header>

    <section class="retos-route" aria-label="Ruta sugerida para hoy">
      <div class="retos-route__intro">
        <span class="retos-route__spark"><i data-lucide="sparkles" class="i"></i></span>
        <span><small>Ruta sugerida</small><strong>Tu sesión de hoy</strong></span>
      </div>
      <div class="retos-route__flow">
        <span class="retos-route__step ${d.hechoHoy ? 'is-done' : 'is-current'}">
          <b>01</b><span><strong>Reto diario</strong><small>${d.hechoHoy ? 'Completado' : '30 segundos'}</small></span>
        </span>
        <i data-lucide="arrow-right" class="i retos-route__arrow"></i>
        <span class="retos-route__step">
          <b>02</b><span><strong>Flashcards</strong><small>Repaso breve</small></span>
        </span>
        <i data-lucide="arrow-right" class="i retos-route__arrow"></i>
        <span class="retos-route__step">
          <b>03</b><span><strong>Un caso</strong><small>Cierre aplicado</small></span>
        </span>
      </div>
      <span class="retos-route__time"><i data-lucide="clock-3" class="i"></i>≈ 6 min</span>
    </section>

    <div class="retos-grid">
      <section class="retos-main">

        <section class="retos-arena">
          <div class="retos-catalog-head">
            <div class="retos-section-head">
              <div><span class="retos-section-kicker">Biblioteca de práctica</span><h2>Elige una modalidad</h2></div>
              <span class="retos-xp"><i data-lucide="clock-3" class="i"></i>Sesiones de 3–8 min</span>
            </div>
            <p class="retos-catalog-head__help">Organiza tu práctica por objetivo: evaluar, aplicar o repasar.</p>
          </div>

          <div class="retos-catalog-toolbar">
            <div class="retos-filters" role="group" aria-label="Filtrar modalidades por objetivo">
              ${filtrosHtml}
            </div>
            <span class="retos-catalog-count" id="retos-catalog-count" aria-live="polite">${cantidadVisible} ${cantidadVisible === 1 ? 'modalidad' : 'modalidades'}</span>
          </div>
          <p class="retos-catalog-hint" id="retos-catalog-hint">${filtroActivo.ayuda}</p>

          <div class="retos-tiles">
            ${modalidades.map((m) => m.html).join('')}
          </div>
        </section>

        <details class="retos-ranking">
          <summary>
            <span class="retos-ranking__summary-icon"><i data-lucide="trophy" class="i"></i></span>
            <span><strong>Clasificación del club</strong><small>Consulta el podio y tu posición semanal</small></span>
            ${rankingBadge}
            <i data-lucide="chevron-down" class="i retos-ranking__chevron"></i>
          </summary>
          <div class="retos-ranking__content">
            ${rankingContenido}
          </div>
        </details>
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
      </aside>
    </div>
  `);
  filtrarRetos(filtroRetos);
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

type TileOpts = { index: string; a: string; ic: string; img: string; tit: string; sub: string; color: string; kpiLabel: string; kpi: string; pct?: number; pendiente: boolean; href?: string; meta?: string; chip?: string; categoria: FiltroRetos; categoriaLabel: string };
function tile(o: TileOpts) {
  const tag = o.pendiente ? 'div' : o.href ? 'a' : 'button';
  const attrs = o.pendiente
    ? ` class="retos-tile is-pending" aria-disabled="true"`
    : o.href
      ? ` class="retos-tile" href="${esc(o.href)}"`
      : ` class="retos-tile" data-a="${esc(o.a)}"`;
  const chip = o.pendiente ? '<span class="retos-chip retos-chip--muted">En preparación</span>' : (o.chip ? `<span class="retos-tile__chip">${esc(o.chip)}</span>` : '');
  const barra = typeof o.pct === 'number' ? `<div class="retos-tile__bar" aria-hidden="true"><span style="width:${esc(String(o.pct))}%"></span></div>` : '';
  return `
  <${tag}${attrs} data-category="${esc(o.categoria)}" style="--c:${esc(o.color)}">
    <span class="retos-tile__index" aria-hidden="true">${esc(o.index)}</span>
    <div class="retos-tile__head">
      <span class="retos-tile__ic"><i data-lucide="${esc(o.ic)}" class="i"></i></span>
      <span class="retos-tile__kpi"><small>${esc(o.kpiLabel)}</small><b>${esc(o.kpi)}</b></span>
    </div>
    <span class="retos-tile__art" aria-hidden="true"><img src="${esc(o.img)}" alt="" loading="lazy" decoding="async"></span>
    <div class="retos-tile__body">
      <span class="retos-tile__category">${esc(o.categoriaLabel)}</span>
      <strong>${esc(o.tit)}</strong>
      <small>${esc(o.sub)}</small>
    </div>
    ${barra}
    <div class="retos-tile__foot">
      ${chip || `<span class="retos-tile__meta">${esc(o.meta || '')}</span>`}
      <span class="retos-tile__cta">${o.pendiente ? 'Pronto' : 'Abrir'}<i data-lucide="${o.pendiente ? 'clock' : 'arrow-right'}" class="i"></i></span>
    </div>
  </${tag}>`;
}

// ══════════════ Helpers compartidos ══════════════
const barraVolver = () => `<button class="game-back" data-a="hub" aria-label="Volver a Retos"><i data-lucide="arrow-left" class="i"></i><span>Volver a Retos</span></button>`;

function iconoArea(area: string): string {
  const m: Record<string, string> = {
    'Cosmiatría': 'wand-2', 'Cosmetología': 'flask-conical', 'Estética facial': 'sparkles',
    'Estética corporal': 'activity', 'Nutrición': 'apple', 'Regulación': 'scale', 'General': 'book-open',
  };
  return m[area] || 'brain-circuit';
}

const letraOpcion = (i: number) => String.fromCharCode(65 + i);

function heroBiblioteca(icono: string, kicker: string, titulo: string, texto: string, color: string, stats: string, imagen: string, indice: string) {
  return `<header class="challenge-hero" style="--game:${color}">
    <div class="challenge-hero__copy"><span class="challenge-kicker">${kicker}</span><h1 class="display">${titulo}</h1><p>${texto}</p><div class="challenge-hero__stats">${stats}</div></div>
    <div class="challenge-hero__visual" aria-hidden="true"><span class="challenge-hero__index">${indice}</span><span class="challenge-hero__ring"></span><img src="${imagen}" alt="" decoding="async"><i data-lucide="${icono}" class="i"></i></div>
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
    ${heroBiblioteca('zap', 'Arena de conocimiento', 'Quiz Relámpago', 'Elige cómo entrenar: contra reloj, en modo práctica o por área profesional.', '#4a7fc1', `<span><b>${preguntas.length}</b> preguntas</span><span><b>${areas.length}</b> áreas</span><span><b>${mejorQuiz()}</b> récord</span>`, '/media/retos/quiz-relampago.webp', '01')}
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
  partida = crypto.randomUUID(); xpSesion = 0;

  const pool = barajar(bancoPreguntas().filter((p) => area === 'Todas' || p.area === area));
  if (!pool.length) { pinta(`${barraVolver()}<div class="ar-empty" style="padding:40px;text-align:center;color:var(--text-2)">Aún no hay preguntas publicadas en esa área.</div>`); return; }
  const lim = modo === 'practica' ? 10 : 8;
  Q = { preguntas: pool.slice(0, lim), idx: 0, score: 0, vidas: 3, combo: 0, contestada: false, restante: TIEMPO, modo, area };
  pintaQuiz();
}

function pintaQuiz() {
  if (!Q) return;
  const p = Q.preguntas[Q.idx];
  const avance = Math.round((Q.idx + 1) / Q.preguntas.length * 100);
  parar();
  Q.contestada = false; Q.restante = TIEMPO;
  pinta(`
    <section class="game-session game-session--quiz">
      <header class="game-session__top">
        ${barraVolver()}
        <div class="game-session__identity"><span><i data-lucide="zap" class="i"></i></span><div><small>${Q.modo === 'relampago' ? 'Modo relámpago' : 'Entrenamiento libre'}</small><strong>${esc(Q.area === 'Todas' ? 'Quiz mixto' : Q.area)}</strong></div></div>
        <div class="game-session__metrics">
          <span class="game-metric game-metric--lives" aria-label="${Q.vidas} vidas"><i data-lucide="heart" class="i"></i><b>${Q.vidas}</b><small>vidas</small></span>
          <span class="game-metric ${Q.combo > 1 ? 'is-hot' : ''}"><i data-lucide="flame" class="i"></i><b>x${Q.combo || 1}</b><small>combo</small></span>
          <span class="game-metric"><i data-lucide="star" class="i"></i><b>${esc(String(Q.score))}</b><small>puntos</small></span>
        </div>
      </header>
      <div class="game-session__progress"><span style="width:${esc(String(avance))}%"></span><small>Pregunta ${Q.idx + 1} de ${Q.preguntas.length}</small></div>
      ${Q.modo === 'relampago' ? '<div class="game-timer"><span><i data-lucide="timer" class="i"></i>15 segundos</span><div><i id="ar-tbar" style="width:100%"></i></div><small>Responde antes de que termine la barra</small></div>' : '<div class="practice-banner"><i data-lucide="graduation-cap" class="i"></i><span><strong>Modo práctica</strong><small>Piensa con calma; cada respuesta incluye una explicación.</small></span></div>'}
      <article class="quiz-board">
        <div class="quiz-board__meta"><span>${esc(p.area)}</span><span>${esc(p.curso)}</span></div>
        <h1>${esc(p.q)}</h1>
        <div class="ar-opts quiz-options">
          ${p.opciones.map((o, i) => `<button class="ar-opt" data-a="quiz-resp" data-i="${i}"><b>${letraOpcion(i)}</b><span>${esc(o)}</span><i data-lucide="chevron-right" class="i"></i></button>`).join('')}
        </div>
        <div id="ar-fb" aria-live="polite"></div>
      </article>
      <footer class="game-session__tip"><i data-lucide="lightbulb" class="i"></i><span><strong>Consejo</strong> Descarta primero las opciones que contradicen el objetivo principal.</span></footer>
    </section>`);
  if (Q.modo !== 'relampago') return;
  const bar = document.getElementById('ar-tbar'); if (!bar) return;
  const t0 = Date.now();
  timer = window.setInterval(() => {
    if (!Q) return;
    const pasado = (Date.now() - t0) / 1000;
    Q.restante = Math.max(0, TIEMPO - pasado);
    bar.style.width = (Q.restante / TIEMPO * 100) + '%';
    if (Q.restante <= 0) { parar(); respQuiz(-1).catch(errorArcade); }
  }, 80);
}

async function respQuiz(i: number) {
  if (!Q || Q.contestada) return;
  Q.contestada = true; parar();
  const p = Q.preguntas[Q.idx];
  const guardado = await calificar(p, i, 'quiz');
  if (guardado === false) return;
  const ok = i === p.correcta;
  root()?.querySelectorAll<HTMLButtonElement>('.ar-opt').forEach((b, j) => {
    b.disabled = true;
    if (j === p.correcta) b.classList.add('ok');
    if (j === i && !ok) b.classList.add('bad');
  });
  if (ok) {
    const bonus = Q.modo === 'relampago' ? Math.round(Q.restante / TIEMPO * 100) : 40;
    const suma = Math.round((100 + bonus) * (1 + Q.combo * 0.1));
    Q.score = guardado ? guardado.puntaje : Q.score + suma; Q.combo++; celebrar('normal');
  } else { Q.vidas--; Q.combo = 0; }
  const fin = Q.vidas <= 0 || Q.idx >= Q.preguntas.length - 1;
  const fb = document.getElementById('ar-fb'); if (!fb) return;
  fb.innerHTML = `<div class="ar-exp game-feedback ${ok ? 'ok' : 'bad'}"><span class="game-feedback__icon"><i data-lucide="${ok ? 'badge-check' : 'search'}" class="i"></i></span><div><small>${ok ? 'Respuesta correcta' : 'Punto para revisar'}</small><strong>${ok ? 'Bien razonado.' : 'Hay una opción más adecuada.'}</strong><p>${esc(p.explicacion)}</p></div><button class="game-next" data-a="quiz-sig">${fin ? 'Ver resultado' : 'Siguiente'} <i data-lucide="arrow-right" class="i"></i></button></div>`;
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
  const xpGan = Datos.modo === 'api' ? xpSesion : Math.round(Q.score / 10);
  const esRecord = Q.score >= mejorQuiz();
  pinta(`${barraVolver()}
    <section class="game-result game-result--quiz">
      <div class="game-result__seal"><i data-lucide="${esRecord ? 'trophy' : 'zap'}" class="i"></i><span>${esRecord ? 'Nuevo récord' : 'Sesión completa'}</span></div>
      <span class="game-result__eyebrow">Resultado · Quiz Relámpago</span>
      <h1>${Q.score} <em>puntos</em></h1>
      <p>Sumaste <strong>${xpGan} XP</strong>${esRecord ? ' y superaste tu mejor marca.' : ' a tu progreso de práctica.'}</p>
      <div class="game-result__stats"><span><b>${esc(String(Q.preguntas.length))}</b><small>preguntas</small></span><span><b>${esc(String(Math.max(0, Q.vidas)))}</b><small>vidas restantes</small></span><span><b>${esc(String(Q.combo))}</b><small>combo final</small></span></div>
      <div class="game-result__actions">
        <button class="btn btn--brand btn--lg" data-a="ir-quiz"><i data-lucide="rotate-ccw" class="i"></i>Jugar de nuevo</button>
        <button class="btn btn--secondary btn--lg" data-a="hub">Volver</button>
      </div>
    </section>`);
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
    ${heroBiblioteca('calendar-days', 'Reto del día', 'Pregunta de hoy', 'Una pregunta rápida tomada del banco revisado. Si aciertas sumas 30 XP; si fallas, 10. Vuelve mañana para no perder la racha.', '#681c31', `<span><b>${esc(p.area)}</b></span><span><b>+30 XP</b> por acierto</span><span><b>Mantiene</b> tu racha</span>`, '/media/retos/quiz-relampago.webp', 'HOY')}
    <div class="ar-q" style="max-width:720px;margin:0 auto">
      <span class="chip chip--primary">${esc(p.area)}</span>
      <h2 class="display" style="font-size:var(--fs-xl)">${esc(p.q)}</h2>
      <div class="ar-opts">
        ${p.opciones.map((o, i) => `<button class="ar-opt" data-a="diaria-resp" data-i="${i}">${esc(o)}</button>`).join('')}
      </div>
      <div id="ar-fb"></div>
    </div>`);
}

async function respDiaria(i: number) {
  if (!D || !D.pregunta || D.contestada) return;
  D.contestada = true;
  const p = D.pregunta;
  const guardado = await calificar(p, i, 'diaria');
  if (guardado === false) return;
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
      <strong>${Datos.modo === 'api' ? `Respuesta guardada · +${guardado ? guardado.xpGanados : 0} XP` : ok ? '¡Correcto! +30 XP' : 'Casi… +10 XP por intentarlo'}</strong>
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
    ${heroBiblioteca('briefcase-medical', 'Casos de criterio', 'Casos Dermalysse', 'Observa, analiza y decide. Cada caso tiene dos pasos: identificar la situación y proponer un plan responsable.', '#4fa899', `<span><b>${todos.length}</b> casos</span><span><b>${areas.length}</b> áreas</span><span><b>${casosResueltos()}</b> resueltos</span>`, '/media/retos/casos-dermalysse.webp', '02')}
    <section class="challenge-section"><div class="challenge-section__head"><div><span class="eyebrow">Archivo</span><h2>Elige un caso</h2></div><span>${visibles.length} ${visibles.length === 1 ? 'caso disponible' : 'casos disponibles'}</span></div>
      <div class="filter-row">
        <button class="filter-chip ${filtroCaso === 'Todas' ? 'is-active' : ''}" data-a="caso-filtro" data-area="Todas">Todos <b>${todos.length}</b></button>
        ${areas.map((area) => `<button class="filter-chip ${filtroCaso === area ? 'is-active' : ''}" data-a="caso-filtro" data-area="${esc(area)}">${esc(area)} <b>${todos.filter((c) => c.area === area).length}</b></button>`).join('')}
      </div>
      <div class="case-grid">${visibles.map((c, i) => `
        <button class="case-card ${resueltos.has(c.id) ? 'is-solved' : ''}" data-a="caso-jugar" data-id="${esc(c.id)}">
          <span class="case-card__top"><b>${String(i + 1).padStart(2, '0')}</b><i data-lucide="${resueltos.has(c.id) ? 'badge-check' : 'arrow-up-right'}" class="i"></i></span>
          <span class="case-card__species"><i data-lucide="${iconoArea(c.area)}" class="i"></i>${esc(c.area)}</span>
          <strong>${esc(c.titulo)}</strong>
          <p>${esc(c.paciente)}</p>
          <span class="case-card__status">${resueltos.has(c.id) ? '✓ Revisar de nuevo' : 'Abrir caso →'}</span>
        </button>`).join('')}</div>
    </section>`);
  subir();
}

function iniciarCaso(id: string) {
  xpSesion = 0;

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
    <article class="case-workspace">
      <header class="case-workspace__top">
        <div><span class="case-workspace__tag"><i data-lucide="briefcase-medical" class="i"></i>Expediente educativo</span><small>Caso Dermalysse · ${esc(caso.area)}</small></div>
        <div class="case-workspace__steps" aria-label="Paso ${fase === 'diagnostico' ? '1' : '2'} de 2"><span class="is-done">01</span><i></i><span class="${fase !== 'diagnostico' ? 'is-done' : ''}">02</span></div>
      </header>
      <div class="case-workspace__grid">
        <aside class="case-dossier">
          <div class="case-dossier__cover"><span><i data-lucide="${iconoArea(caso.area)}" class="i"></i></span><small>Ficha de observación</small><strong>${esc(caso.titulo)}</strong><p>${esc(caso.paciente)}</p></div>
          <div class="case-dossier__body"><span class="eyebrow">Presentación</span><p>${esc(caso.presentacion)}</p><span class="eyebrow">Hallazgos clave</span><ul class="case-findings">${caso.hallazgos.map((h) => `<li><i data-lucide="check" class="i"></i>${esc(h)}</li>`).join('')}</ul></div>
          <p class="case-dossier__note"><i data-lucide="shield-check" class="i"></i>Ejercicio educativo. No sustituye valoración ni diagnóstico.</p>
        </aside>
        ${bloque ? `
        <section class="case-decision">
          <span class="case-decision__step"><i data-lucide="${fase === 'diagnostico' ? 'scan-search' : 'route'}" class="i"></i>${fase === 'diagnostico' ? 'Paso 1 de 2 · Lee la situación' : 'Paso 2 de 2 · Define el enfoque'}</span>
          <div class="case-decision__heading"><small>${fase === 'diagnostico' ? 'Observación' : 'Decisión responsable'}</small><h1>${esc(bloque.pregunta)}</h1></div>
          <div class="ar-opts case-options">
            ${bloque.opciones.map((o, i) => `<button class="ar-opt" data-a="caso-resp" data-i="${i}"><b>${letraOpcion(i)}</b><span>${esc(o)}</span><i data-lucide="chevron-right" class="i"></i></button>`).join('')}
          </div>
          <div id="ar-fb" aria-live="polite"></div>
        </section>` : finCaso()}
      </div>
    </article>`);
}

async function respCaso(i: number) {
  if (!C || C.respuesta !== null) return;
  C.respuesta = i;
  const bloque = C.fase === 'diagnostico' ? C.caso.diagnostico : C.caso.plan;
  const guardado = await calificar(bloque, i, 'caso', C.caso.id, C.fase);
  if (guardado === false) return;
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
    <div class="ar-exp game-feedback ${ok ? 'ok' : 'bad'}">
      <span class="game-feedback__icon"><i data-lucide="${ok ? 'badge-check' : 'search'}" class="i"></i></span>
      <div><small>${ok ? 'Criterio alineado' : 'Lectura para revisar'}</small><strong>${ok ? 'Decisión correcta.' : 'Hay un enfoque más responsable.'}</strong><p>${esc(bloque.explicacion)}</p></div>
      <button class="game-next" data-a="caso-sig">${esUltima ? 'Ver resultado' : 'Siguiente paso'} <i data-lucide="arrow-right" class="i"></i></button>
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
    <section class="game-result game-result--case">
      <div class="game-result__seal"><i data-lucide="${perfecto ? 'badge-check' : 'target'}" class="i"></i><span>${perfecto ? 'Criterio sólido' : 'Práctica completada'}</span></div>
      <span class="game-result__eyebrow">Cierre del expediente</span>
      <h1>${C.aciertos}<em>/2 decisiones correctas</em></h1>
      <p>${Datos.modo === 'api' ? `Tu práctica quedó guardada · ${xpSesion} XP nuevos.` : perfecto ? 'Resolviste el caso completo y sumaste <strong>50 XP</strong>.' : 'Terminaste el recorrido. Puedes repetirlo para revisar el enfoque.'}</p>
      <div class="game-result__stats"><span><b>02</b><small>etapas</small></span><span><b>${esc(String(C.aciertos))}</b><small>aciertos</small></span><span><b>${Datos.modo === 'api' ? '+' + xpSesion : perfecto ? '+50' : '0'}</b><small>XP</small></span></div>
      <div class="game-result__actions">
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
    ${heroBiblioteca('brain', 'Memoria activa', 'Flashcards', 'Repite lo esencial de los cursos con repetición espaciada: la plataforma te vuelve a mostrar lo que todavía no dominas.', '#c98a5b', `<span><b>${todas.length}</b> tarjetas</span><span><b>${em.dominadas}</b> dominadas</span><span><b>${areas.length}</b> áreas</span>`, '/media/retos/flashcards.webp', '03')}
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
  const avance = Math.round((F.idx + 1) / F.mazo.length * 100);
  pinta(`<section class="game-session game-session--flash">
    <header class="game-session__top">
      ${barraVolver()}
      <div class="game-session__identity"><span><i data-lucide="brain" class="i"></i></span><div><small>Memoria activa</small><strong>${esc(F.area === 'Todas' ? 'Mazo del día' : F.area)}</strong></div></div>
      <div class="game-session__metrics"><span class="game-metric"><i data-lucide="layers-3" class="i"></i><b>${F.idx + 1}/${F.mazo.length}</b><small>tarjetas</small></span><span class="game-metric"><i data-lucide="badge-check" class="i"></i><b>${F.aciertos}</b><small>dominadas</small></span></div>
    </header>
    <div class="game-session__progress"><span style="width:${esc(String(avance))}%"></span><small>${esc(c.area)} · ${esc(c.curso)}</small></div>
    <div class="flash-workspace">
      <div class="flashcard-stage">
        <span class="flashcard-stack flashcard-stack--one" aria-hidden="true"></span><span class="flashcard-stack flashcard-stack--two" aria-hidden="true"></span>
        <div class="flashcard ${F.flipped ? 'is-flipped' : ''}" data-a="flash-flip" role="button" tabindex="0" aria-label="${F.flipped ? 'Ocultar respuesta' : 'Mostrar respuesta'}">
        <div class="flashcard__face flashcard__face--front">
          <div class="flashcard__top"><span>${esc(c.area)}</span><b>${String(F.idx + 1).padStart(2, '0')}</b></div>
          <div class="flashcard__content"><small>Pregunta</small><p>${esc(c.frente)}</p></div>
          <span class="flashcard__turn"><i data-lucide="refresh-cw" class="i"></i>Toca o presiona espacio para revelar</span>
        </div>
        <div class="flashcard__face flashcard__face--back">
          <div class="flashcard__top"><span>Respuesta</span><b><i data-lucide="sparkles" class="i"></i></b></div>
          <div class="flashcard__content flashcard__content--answer"><small>Concepto clave</small><div>${c.reverso}</div></div>
          <span class="flashcard__turn"><i data-lucide="book-open" class="i"></i>${esc(c.curso)}</span>
        </div>
        </div>
      </div>
      <aside class="flash-coach"><span class="flash-coach__icon"><i data-lucide="sparkles" class="i"></i></span><small>Autoevaluación</small><strong>${F.flipped ? '¿Qué tan clara fue tu respuesta?' : 'Responde antes de voltear'}</strong><p>${F.flipped ? 'Sé honesta con tu recuerdo: la repetición funciona mejor cuando marcas lo que todavía cuesta.' : 'Explica el concepto con tus propias palabras y después compara.'}</p>
        ${F.flipped ? `<div class="flashcard__actions"><button class="flash-rate flash-rate--again" data-a="flash-cal" data-b="0"><i data-lucide="rotate-ccw" class="i"></i><span><strong>Sigo repasando</strong><small>Mostrar pronto</small></span></button><button class="flash-rate flash-rate--master" data-a="flash-cal" data-b="1"><i data-lucide="check" class="i"></i><span><strong>Ya la domino</strong><small>Espaciar repaso</small></span></button></div>` : '<div class="flash-coach__hint"><i data-lucide="keyboard" class="i"></i>También puedes usar Enter o la barra espaciadora.</div>'}
      </aside>
    </div>
  </section>`);
}

function flipFlash() {
  if (!F) return;
  F.flipped = !F.flipped;
  pintaFlash();
}

async function calFlash(bien: boolean) {
  if (!F) return;
  const c = F.mazo[F.idx];
  const original = F, container = root(); guardando = true;
  try { await repasarCarta(c.id, bien); } finally { guardando = false; }
  if (original !== F || container !== root()) return;
  if (bien) F.aciertos++;
  F.idx++; F.flipped = false;
  pintaFlash();
}

function finFlash() {
  if (!F) return;
  const total = F.mazo.length;
  const pct = Math.round(F.aciertos / total * 100);
  pinta(`${barraVolver()}
    <section class="game-result game-result--flash">
      <div class="game-result__seal"><i data-lucide="brain" class="i"></i><span>Sesión guardada</span></div>
      <span class="game-result__eyebrow">Memoria activa</span>
      <h1>${F.aciertos}<em>/${total} dominadas</em></h1>
      <p>${pct}% de la sesión. ${pct >= 70 ? 'Gran repaso: el mazo se ajustó a tu avance.' : 'Buen comienzo: volver a verlas ayudará a fijar los conceptos.'}</p>
      <div class="game-result__stats"><span><b>${total}</b><small>revisadas</small></span><span><b>${F.aciertos}</b><small>dominadas</small></span><span><b>${total - F.aciertos}</b><small>por reforzar</small></span></div>
      <div class="game-result__actions">
        <button class="btn btn--brand btn--lg" data-a="ir-flash"><i data-lucide="rotate-ccw" class="i"></i>Otra sesión</button>
        <button class="btn btn--secondary btn--lg" data-a="hub">Volver a Retos</button>
      </div>
    </section>`);
  if (pct >= 70) celebrar('normal');
  F = null;
}

let guardando = false;
let retosListos = false;
let partida = '';
let xpSesion = 0;
function errorArcade(error: unknown) {
  parar(); guardando=false;
  pinta(`<section class="stack" role="alert"><h2>No pudimos confirmar tu práctica</h2><p>${esc(error instanceof Error ? error.message : 'Revisa la conexión e inténtalo de nuevo.')}</p><button class="btn btn--brand" data-a="hub">Volver a Retos</button><a class="btn btn--secondary" href="#/cursos">Ir a cursos</a></section>`);
}
async function calificar(p: any, respuesta: number, tipo: 'quiz'|'diaria'|'caso', id=p.id, fase?: string) {
  if (Datos.modo !== 'api') return null;
  const before = {q:Q,c:C,d:D,root:root()}; guardando=true;
  try {
    const result = await responderReto({tipo,id,respuesta:respuesta < 0 ? null : respuesta,...(fase ? {fase} : {}),...(tipo==='quiz'?{partida}:{})});
    if (before.root!==root() || before.q!==Q || before.c!==C || before.d!==D) return false;
    p.correcta=result.correcta; p.explicacion=result.explicacion; xpSesion+=result.xpGanados;
    return result;
  }finally{guardando=false;}
}
