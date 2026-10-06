// Retos · hub editorial Dermalysse basado en los patrones de Élite Pecuario.
// Muestra Liga, XP, racha, misión semanal, clasificación y una zona de juegos.
// Los juegos (quiz relámpago, casos, flashcards) requieren contenido revisado;
// mientras tanto se muestran con estado honesto "En preparación" en lugar de
// inventar bancos o puntuaciones.
import { createIcons, icons } from 'lucide';
import { esc, iniciales } from '../ui/partials';
import { nivel, NIVELES, retoDiario, bancoPreguntas, estatsMazo, casos, casosResueltos, mejorQuiz } from '../core/juegos';
import { Liga, type FilaLiga } from '../core/liga';
import { Progreso } from '../core/progreso';
import { racha } from '../core/logros';

const root = () => document.getElementById('arcade');
function pinta(html: string) { const r = root(); if (!r) return; r.innerHTML = html; createIcons({ icons }); }

export function retos() {
  return `<section class="arcade-page"><div id="arcade" class="stack" style="gap:24px"></div></section>`;
}

export function montarArcade() {
  const r = root();
  if (!r || r.dataset.mounted) return;
  r.dataset.mounted = '1';
  hub();
  window.addEventListener('retos:cambio', hub);
  Liga.cargar().then(() => { if (root()) hub(); });
}

function hub() {
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

        <div class="ar-daily is-pending" aria-disabled="true" title="El reto diario se activa cuando se publiquen los quizzes de clase.">
          <span class="ar-daily__ic"><i data-lucide="calendar-days" class="i"></i></span>
          <span class="ar-daily__tx"><strong>Reto diario</strong><span class="faint">${banco ? 'Una pregunta rápida · responde y suma XP' : 'Se activa cuando el equipo académico publique los quizzes de clase.'}</span></span>
          <span class="ar-daily__meta">
            ${banco ? '<span class="ar-daily__xp">+30 XP</span><span class="ar-daily__go"><i data-lucide="arrow-right" class="i"></i></span>' : '<span class="chip" style="background:rgba(104,28,49,.08);color:var(--primary);border:1px solid color-mix(in srgb,var(--primary) 20%,transparent)">En preparación</span>'}
          </span>
        </div>

        <div class="ar-grid league-games">
          ${tile('zap', 'Quiz Relámpago', `Preguntas rápidas por área · ${banco} ${banco === 1 ? 'pregunta' : 'preguntas'}`, '#4a7fc1', 'Récord', String(record), pctQuiz, banco === 0)}
          ${tile('briefcase-medical', 'Casos Dermalysse', 'Diagnóstico educativo y comunicación responsable', '#4fa899', 'Resueltos', `${casosOk}/${totalCasos}`, pctCasos, totalCasos === 0)}
          ${tile('brain', 'Flashcards', 'Memoria activa por área y curso', '#c98a5b', 'Dominadas', `${em.dominadas}/${em.total}`, pctFlash, em.total === 0)}
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

function tile(icono: string, tit: string, sub: string, color: string, kpiLabel: string, kpi: string, pct: number, pendiente: boolean) {
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
