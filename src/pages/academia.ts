// Academia Dermalysse: catálogo de programas, portada del programa con su ruta de módulos, mapa del
// módulo, lector de temas, minijuego y examen. Diseño propio del club (tokens.css + academia.css).
// Honestidad: el certificado de programa todavía no existe; se dice que se habilitará pronto.
import { createIcons, icons } from 'lucide';
import { Datos } from '../core/datos';
import {
  programa as getPrograma, cargarCatalogo, cargarModulo, avanceModulo, moduloAprobado, moduloDesbloqueado,
  temasLeidos, resumenPrograma, marcarTemaLeido, marcarJuego, juegoCompletado, emitirExamen, calificarExamen,
  esAdminAcademia, puedeVip, modoRevisorDemo, moduloProgramado, infoModulo, fechaLanzamiento, cuentaLanzamiento, textoLanzamiento,
  type ModuloCatalogo, type Modulo, type Programa, type PreguntaA, type ResultadoExamen,
} from '../core/academia';
import { bloques, esc, figura, hash, minijuegoHTML, montarInteraccion, verificacion } from '../ui/academia-bloques';
import { celebrar } from '../ui/celebracion';

const ic = (n: string) => `<i data-lucide="${n}" class="i" aria-hidden="true"></i>`;
// Cada área usa un tono de la paleta Dermalysse (definidos en academia.css, claro y oscuro, con contraste AA).
const AREAS: Record<string, { tono: string; icono: string }> = {
  'Ciencia de la piel': { tono: 'ciencia', icono: 'microscope' },
  'Cosmetología': { tono: 'cosmetologia', icono: 'flask-conical' },
  'Estética facial': { tono: 'estetica', icono: 'sparkles' },
  'Práctica profesional': { tono: 'practica', icono: 'shield-check' },
};
const area = (a: string) => AREAS[a] ?? { tono: 'ciencia', icono: 'graduation-cap' };
const num2 = (n: number) => String(n).padStart(2, '0');
const horas = (min: number) => (min >= 90 ? `${Math.round((min / 60) * 2) / 2} h`.replace('.5', ' ½') : `${min} min`);
const ruta = (...p: (string | number)[]) => `#/academia/${p.map((x) => encodeURIComponent(String(x))).join('/')}`;
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const CERT_PRONTO = 'El certificado del programa se habilitará pronto; tu avance queda guardado.';

// ── Calendario de lanzamiento ──
/** Disponible para quien lo ve: publicado (o vista previa) y sin fecha pendiente. */
const abierto = (m: ModuloCatalogo) => !!m.disponible && !moduloProgramado(m);
/** Primer módulo cuya fecha todavía no llega (informativo también para el revisor). */
const proximo = (p: Programa) => p.modulos.find((m) => m.programado && m.disponibleDesde);
const ritmo = (p: Programa) => {
  const d = p.lanzamiento?.cadaDias ?? 7;
  return d === 7 ? 'cada semana' : d === 1 ? 'cada día' : d % 7 === 0 ? `cada ${d / 7} semanas` : `cada ${d} días`;
};
/** Línea compacta «Módulo 1 · Disponible el jueves 22 de octubre · faltan 7 días». */
const lineaLanzamiento = (m: ModuloCatalogo, clase = 'ac-lanz') =>
  `<span class="${clase}">${ic('calendar-clock')}<span><b>Módulo ${m.n}</b> · ${esc(textoLanzamiento(m.disponibleDesde!))}</span></span>`;

function portadaPrograma(p: Programa, grande = false) {
  const a = area(p.area);
  return `<div class="ac-portada ${grande ? 'ac-portada--grande' : ''}">${figura(p.portada?.id || '', '16:9', `Portada del programa ${p.titulo}`, '', undefined, 'ac-fig--portada')}<span class="ac-portada__sello"><b>${num2(p.numero)}</b><small>Programa</small></span><span class="ac-portada__ic">${ic(a.icono)}</span></div>`;
}

function migas(items: [string, string?][]) {
  return `<nav class="ac-migas" aria-label="Ruta de navegación">${items.map(([t, h], i) => (h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`) + (i < items.length - 1 ? ic('chevron-right') : '')).join('')}</nav>`;
}

/** Estados de error por código (los mismos de la API y del demo). */
function errorHTML(e: unknown, p?: Programa, n?: number) {
  const err = e as { codigo?: string; message?: string };
  const codigo = err?.codigo || '';
  const aviso = (icono: string, titulo: string, texto: string, accion = '', extra = '') =>
    `<div class="ac-aviso ${extra}" role="${/vip|programado/.test(extra) ? 'region' : 'alert'}" aria-label="${esc(titulo)}">${ic(icono)}<div><strong>${esc(titulo)}</strong><p>${texto}</p>${accion}</div></div>`;
  if (codigo === 'modulo_programado') {
    // Aviso amable, no un error: el módulo existe y tiene fecha. Nunca se muestra su contenido.
    const desde = (e as { disponibleDesde?: string })?.disponibleDesde;
    const fecha = desde
      ? `<span class="ac-aviso__fecha">Disponible el <b>${esc(fechaLanzamiento(desde))}</b> · ${esc(cuentaLanzamiento(desde))}</span>`
      : '<span class="ac-aviso__fecha">Se abrirá muy pronto.</span>';
    return aviso('calendar-clock', n ? `El módulo ${n} se abre pronto` : 'Este módulo se abre pronto',
      `${fecha}Los módulos de este programa se abren uno por uno, a las 00:00 (hora del centro de México).`,
      p ? `<div class="ac-aviso__acciones"><a class="btn btn--brand" href="${ruta(p.id)}">${ic('route')}Mientras tanto, explora el programa</a></div>` : '', 'ac-aviso--programado');
  }
  if (codigo === 'requiere_vip' || codigo === '402') {
    return aviso('crown', 'Este módulo es para miembros VIP', `El módulo 1 de cada programa es gratis. Con la membresía VIP sigues con ${p ? `los ${p.modulos.length - 1} módulos restantes` : 'el resto del programa'} y presentas sus exámenes.`,
      `<div class="ac-aviso__acciones"><button type="button" class="btn btn--gradient" data-paywall="Desbloquea todos los módulos de la Academia Dermalysse y sus exámenes.">${ic('crown')}Hazte VIP</button>${p ? `<a class="btn btn--secondary" href="${ruta(p.id, 1)}">Ir al módulo 1 gratis</a>` : ''}</div>`, 'ac-aviso--vip');
  }
  if (codigo === 'modulo_bloqueado') {
    return aviso('lock', 'Módulo bloqueado', `Aprueba el examen del módulo ${n ? n - 1 : 'anterior'} con 70 % o más para desbloquear este.`,
      p && n ? `<a class="btn btn--brand" href="${ruta(p.id, n - 1)}">${ic('arrow-left')}Ir al módulo ${n - 1}</a>` : '');
  }
  if (codigo === 'modulo_en_preparacion') {
    return aviso('pen-line', 'Módulo en preparación', 'Nuestro equipo lo está escribiendo y una profesional lo revisa antes de publicarlo. Aparecerá aquí cuando esté aprobado.',
      p ? `<a class="btn btn--secondary" href="${ruta(p.id)}">${ic('arrow-left')}Volver al programa</a>` : '');
  }
  if (codigo === 'temas_pendientes') {
    return aviso('book-open', 'Primero termina la lectura', esc(err?.message || 'Lee todos los temas del módulo para presentar el examen.'),
      p && n ? `<a class="btn btn--brand" href="${ruta(p.id, n)}">Ver los temas ${ic('arrow-right')}</a>` : '');
  }
  if (codigo === 'espera_examen') return aviso('timer', 'Un respiro antes de reintentar', esc(err?.message || 'Repasa los temas y vuelve a intentarlo en unos minutos.'));
  if (codigo === 'examen_no_emitido' || codigo === 'examen_desactualizado') return aviso('rotate-ccw', 'Inicia el examen de nuevo', esc(err?.message || 'Pide un examen nuevo para continuar.'));
  if (codigo === 'no-encontrado' || codigo === '404') {
    return aviso('search', 'No encontramos este contenido', 'Revisa el enlace o vuelve al catálogo de la Academia.', `<a class="btn btn--secondary" href="#/academia">${ic('arrow-left')}Ir a la Academia</a>`);
  }
  return aviso('circle-alert', 'No pudimos cargar el contenido', esc(err?.message || 'Intenta de nuevo en un momento.'));
}
const envolver = (html: string, extra = '', tono = '') => `<section class="ac ${extra}"${tono ? ` data-tono="${tono}"` : ''}>${html}</section>`;

// ═════════ Catálogo ═════════
export async function academia() {
  let lista: Programa[];
  try { lista = await cargarCatalogo(); } catch (e) { return envolver(errorHTML(e)); }
  if (!lista.length) return envolver(`<div class="ac-aviso">${ic('pen-line')}<div><strong>La Academia está en preparación</strong><p>Pronto encontrarás aquí programas de lectura guiada con actividades y exámenes.</p></div></div>`);
  const totalModulos = lista.reduce((a, p) => a + p.modulos.length, 0);
  const listos = lista.reduce((a, p) => a + p.modulos.filter(abierto).length, 0);
  const enCurso = lista.filter((p) => { const r = resumenPrograma(p); return r.iniciado && !r.completo; });
  const areas = [...new Set(lista.map((p) => p.area))];
  const tarjeta = (p: Programa) => {
    const r = resumenPrograma(p);
    const disp = p.modulos.filter(abierto).length;
    const a = area(p.area);
    const prox = proximo(p);
    const estado = r.iniciado
      ? `<div class="progress progress--thin" role="progressbar" aria-label="Avance del programa" aria-valuenow="${r.pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${r.pct}%"></span></div><small class="ac-card__avance">${r.aprobados} de ${r.total} módulos aprobados</small>`
      : disp === 0 ? (prox ? '' : `<span class="ac-etiqueta">${ic('pen-line')}En preparación</span>`)
        : disp < p.modulos.length ? `<small class="ac-card__avance">${disp} de ${p.modulos.length} módulos disponibles</small>` : '';
    // Calendario: el siguiente módulo con fecha y el ritmo de apertura.
    const lanz = prox ? `${lineaLanzamiento(prox)}<small class="ac-card__avance">Un módulo nuevo ${ritmo(p)}</small>` : '';
    return `<a class="ac-card" href="${ruta(p.id)}" data-tono="${a.tono}" data-area="${esc(p.area)}" data-buscar="${esc(`${p.titulo} ${p.area} ${p.descripcion} ${p.modulos.map((m) => m.titulo).join(' ')}`.toLowerCase())}">
      ${portadaPrograma(p)}
      <div class="ac-card__body">
        <span class="ac-card__area">${ic(a.icono)}${esc(p.area)}</span>
        <h3>${esc(p.titulo)}</h3>
        <p>${esc(p.descripcion)}</p>
        <div class="ac-card__meta"><span>${ic('layers')}${p.modulos.length} módulos</span><span>${ic('signal')}${esc(p.nivel)}</span></div>
        ${estado}${lanz}
      </div></a>`;
  };
  return `<section class="ac ac-catalogo">
    <header class="ac-hero">
      <div class="ac-hero__txt">
        <span class="ac-hero__eyebrow">${ic('book-open-text')} Academia Dermalysse</span>
        <h1>Estudia la piel <em>módulo a módulo</em></h1>
        <p>Programas de lectura guiada con figuras, casos en cabina, actividades y un examen por módulo. Avanzas a tu ritmo: al aprobar un módulo con 70 % se abre el siguiente. El módulo 1 de cada programa es gratis.</p>
        <dl class="ac-hero__datos"><div><dt>Programas</dt><dd>${lista.length}</dd></div><div><dt>Módulos</dt><dd>${totalModulos}</dd></div><div><dt>Disponibles</dt><dd>${listos}</dd></div></dl>
      </div>
      <ol class="ac-hero__ruta" aria-label="Cómo funciona">
        <li>${ic('book-open')}<span><b>Lee</b>temas breves con figuras y glosario</span></li>
        <li>${ic('puzzle')}<span><b>Practica</b>casos, actividades y un minijuego</span></li>
        <li>${ic('clipboard-check')}<span><b>Aprueba</b>el examen de cada módulo</span></li>
        <li>${ic('award')}<span><b>Completa el programa</b>el certificado se habilitará pronto</span></li>
      </ol>
    </header>
    ${Datos.modo === 'demo' ? `<p class="ac-nota">${ic('flask-conical')}Vista demo: tu avance se guarda solo en este navegador y los módulos en borrador se muestran como vista previa.</p>` : ''}
    ${enCurso.length ? `<section class="ac-seguir"><h2 class="ac-h2">${ic('play')} Continúa donde te quedaste</h2><div class="ac-seguir__lista">${enCurso.map((p) => { const r = resumenPrograma(p); return `<a class="ac-seguir__item" href="${ruta(p.id, r.siguiente)}" data-tono="${area(p.area).tono}"><span class="ac-seguir__num">${num2(p.numero)}</span><span><strong>${esc(p.titulo)}</strong><small>Módulo ${r.siguiente} · ${esc(p.modulos.find((m) => m.n === r.siguiente)?.titulo || '')}</small>${(() => { const sig = p.modulos.find((m) => m.n === r.siguiente); return moduloProgramado(sig) ? `<small class="ac-seguir__fecha">${ic('calendar-clock')}${esc(textoLanzamiento(sig!.disponibleDesde!))}</small>` : ''; })()}<span class="progress progress--thin"><span style="width:${r.pct}%"></span></span></span>${ic('arrow-right')}</a>`; }).join('')}</div></section>` : ''}
    <div class="ac-filtros" role="search">
      <label class="ac-buscar">${ic('search')}<span class="sr-only">Buscar programa</span><input type="search" placeholder="Buscar programa o tema…" data-ac-buscar></label>
      <div class="ac-chips" role="group" aria-label="Filtrar por área"><button type="button" class="ac-chip is-on" data-ac-area="" aria-pressed="true">Todas</button>${areas.map((a) => `<button type="button" class="ac-chip" data-ac-area="${esc(a)}" aria-pressed="false">${ic(area(a).icono)}${esc(a)}</button>`).join('')}</div>
    </div>
    <div class="ac-grid" data-ac-grid>${lista.map(tarjeta).join('')}</div>
    <p class="ac-vacio" data-ac-vacio role="status" hidden>No encontramos programas con esa búsqueda.</p>
    <p class="ac-legal">${ic('info')}Contenido educativo para profesionales y estudiantes de la estética. No sustituye la valoración de un dermatólogo ni indica tratamientos.</p>
  </section>`;
}

// ═════════ Portada del programa ═════════
export async function academiaPrograma(params: Record<string, string>) {
  const p0 = getPrograma(params.programa);
  if (!p0) return envolver(`${migas([['Academia', '#/academia'], ['No encontrado']])}${errorHTML({ codigo: 'no-encontrado' })}`);
  let p: Programa = p0;
  let aviso = '';
  try { p = (await cargarCatalogo()).find((x) => x.id === p0.id) || p0; }
  catch (e) { aviso = errorHTML(e); }
  const r = resumenPrograma(p);
  const totalMin = p.modulos.reduce((a, m) => a + (m.duracionMin || 0), 0);
  const a = area(p.area);
  const vip = puedeVip();
  const disponibles = p.modulos.filter(abierto).length;
  const sendero = p.modulos.map((m) => {
    const ok = moduloAprobado(p.id, m.n), abierto = moduloDesbloqueado(p.id, m.n), actual = m.n === r.siguiente && !r.completo;
    const av = avanceModulo(p.id, m.n);
    // Con fecha pendiente manda el calendario (igual que la API): ni borrador ni candado, solo su fecha.
    const programado = !ok && moduloProgramado(m);
    const preparacion = !programado && m.disponible === false;
    const clase = ok ? 'is-ok' : programado ? 'is-cerrado is-programado' : preparacion ? 'is-cerrado' : actual ? 'is-actual' : abierto ? 'is-abierto' : 'is-cerrado';
    const sello = ok ? ic('check') : programado ? ic('calendar-clock') : preparacion ? ic('pen-line') : !abierto ? ic('lock') : m.n > 1 && !vip ? ic('crown') : `<b>${m.n}</b>`;
    const etiqueta = [`Módulo ${m.n}`, m.n === 1 ? 'gratis' : '', programado ? 'programado' : '', preparacion ? 'en preparación' : '', m.estado && m.estado !== 'aprobado' && !preparacion && !programado ? `vista previa (${m.estado})` : ''].filter(Boolean).join(' · ');
    const detalle = ok ? `<em class="is-ok">Aprobado · mejor ${av.mejor ?? ''} %</em>`
      : programado ? `<em class="ac-paso__fecha">Disponible el ${esc(fechaLanzamiento(m.disponibleDesde!))} · <b>${esc(cuentaLanzamiento(m.disponibleDesde!))}</b></em>`
        : av.temas && !preparacion ? `<em>${Object.keys(av.temas).length} temas leídos</em>` : m.temas ? `<em>${m.temas} temas${m.duracionMin ? ` · ${horas(m.duracionMin)}` : ''}</em>` : '';
    // El revisor salta la fecha, pero ve cuándo se abre para los miembros.
    const revisor = !programado && m.programado && m.disponibleDesde ? `<em class="ac-paso__fecha">${ic('calendar-clock')}Para miembros: ${esc(textoLanzamiento(m.disponibleDesde))}</em>` : '';
    return `<li class="ac-paso ${clase}"><a href="${ruta(p.id, m.n)}"${actual ? ' aria-current="step"' : ''}><span class="ac-paso__sello" aria-hidden="true">${sello}</span><span class="ac-paso__txt"><small>${etiqueta}</small><strong>${esc(m.titulo)}</strong>${detalle}${revisor}</span>${ic('chevron-right')}</a></li>`;
  }).join('');
  const destino = p.modulos.find((m) => m.n === r.siguiente);
  const cta = !r.completo && moduloProgramado(destino)
    // El módulo que tocaría todavía no se abre: CTA deshabilitado con su fecha, en lugar de «Empezar».
    ? `<button type="button" class="btn btn--lg ac-cta-fecha" disabled>${ic('calendar-clock')}<span>Disponible el ${esc(fechaLanzamiento(destino!.disponibleDesde!))}<small>${r.iniciado ? `Módulo ${destino!.n}` : 'Módulo 1'} · ${esc(cuentaLanzamiento(destino!.disponibleDesde!))}</small></span></button>`
    : disponibles === 0
      ? `<span class="ac-etiqueta">${ic('pen-line')}Programa en preparación</span>`
      : `<a class="btn btn--brand btn--lg" href="${ruta(p.id, r.siguiente)}">${r.completo ? 'Repasar el programa' : r.iniciado ? `Continuar en el módulo ${r.siguiente}` : 'Empezar el módulo 1'} ${ic('arrow-right')}</a>`;
  // Aviso de calendario: siguiente apertura y ritmo.
  const prox = proximo(p);
  const calendario = prox ? `<div class="ac-calendario" role="note" aria-label="Calendario de lanzamiento">
      <span class="ac-calendario__ic">${ic('calendar-clock')}</span>
      <div><strong>Próximo módulo: ${prox.n} · ${esc(prox.titulo)}</strong>
      <p>${esc(textoLanzamiento(prox.disponibleDesde!))}. Se abre un módulo nuevo ${ritmo(p)}, a las 00:00 (hora del centro de México).${esAdminAcademia() ? ' Como revisor puedes abrirlo antes de su fecha.' : ''}</p></div>
    </div>` : '';
  return `<section class="ac ac-programa" data-tono="${a.tono}">
    ${migas([['Academia', '#/academia'], [p.titulo]])}
    ${aviso}
    <header class="ac-prog">
      ${portadaPrograma(p, true)}
      <div class="ac-prog__txt">
        <span class="ac-card__area">${ic(a.icono)}${esc(p.area)} · ${esc(p.nivel)}</span>
        <h1>${esc(p.titulo)}</h1>
        <p>${esc(p.descripcion)}</p>
        <div class="ac-datos"><span>${ic('layers')}<b>${p.modulos.length}</b> módulos</span>${totalMin ? `<span>${ic('clock')}<b>${horas(totalMin)}</b> aprox.</span>` : ''}<span>${ic('clipboard-check')}<b>70 %</b> para aprobar cada módulo</span></div>
        <div class="ac-prog__publico" aria-label="Para quién es">${(p.publico || []).map((x) => `<span class="ac-pub">${esc(mayuscula(x))}</span>`).join('')}</div>
        <div class="ac-prog__cta">${cta}${r.iniciado ? `<div class="ac-prog__avance"><div class="progress" role="progressbar" aria-label="Avance del programa" aria-valuenow="${r.pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${r.pct}%"></span></div><small>${r.aprobados} de ${r.total} módulos aprobados</small></div>` : ''}</div>
      </div>
    </header>
    ${calendario}
    ${r.completo ? `<div class="ac-aviso ac-aviso--ok">${ic('badge-check')}<div><strong>Completaste el programa</strong><p>Aprobaste los ${p.modulos.length} módulos. ${CERT_PRONTO}</p></div></div>` : ''}
    <div class="ac-cuerpo2">
      <section><h2 class="ac-h2">${ic('route')} Ruta del programa <small>${disponibles} de ${p.modulos.length} disponibles</small></h2><ol class="ac-sendero">${sendero}</ol></section>
      <aside class="ac-lado">
        <div class="ac-como card"><h3>Cómo avanzas</h3><ol><li>Lee los temas del módulo; cada uno cierra con 3 preguntas de repaso.</li><li>Practica con las actividades y el minijuego.</li><li>Presenta el examen: 10 preguntas al azar; apruebas con 70 %.</li><li>Al aprobar se abre el siguiente módulo. Si no apruebas, repasa y reintenta después de 3 minutos.</li></ol>${vip ? '' : `<p class="ac-como__vip">${ic('crown')}El módulo 1 es gratis; el resto es para miembros VIP.</p>`}</div>
        <div class="ac-cert"><span class="ac-cert__sello">${ic('award')}</span><strong>Certificado del programa</strong><p>Todavía no está disponible: se habilitará pronto. Tu avance queda guardado para cuando se active.</p></div>
        <p class="ac-legal">${ic('info')}Contenido educativo. No sustituye la valoración de un dermatólogo.</p>
      </aside>
    </div>
  </section>`;
}

// ═════════ Preparación común de las páginas de módulo ═════════
interface Preparado { html?: string; p?: Programa; n?: number; m?: Modulo }
type Listo = Required<Omit<Preparado, 'html'>>;
const migasMod = (p: Programa, n: number, extra?: string) => migas([['Academia', '#/academia'], [p.titulo, ruta(p.id)], ...(extra ? [[`Módulo ${n}`, ruta(p.id, n)], [extra]] as [string, string?][] : [[`Módulo ${n}`]] as [string, string?][])]);

async function prepararModulo(params: Record<string, string>, extra?: string): Promise<Preparado> {
  const p = getPrograma(params.programa);
  const n = Number(params.n);
  if (!p || !p.modulos.some((m) => m.n === n)) return { html: envolver(`${migas([['Academia', '#/academia'], ['No encontrado']])}${errorHTML({ codigo: 'no-encontrado' }, p)}`) };
  // El avance (temas leídos, aprobaciones) llega con el catálogo en modo API.
  if (Datos.modo === 'api') await cargarCatalogo().catch(() => null);
  try { return { p, n, m: await cargarModulo(p.id, n) }; }
  catch (e) { return { html: envolver(`${migasMod(p, n, extra)}${errorHTML(e, p, n)}`, '', area(p.area).tono) }; }
}

const avisoBorrador = (m: Modulo) => (m.estado && m.estado !== 'aprobado'
  ? `<div class="ac-borrador" role="note">${ic('eye')}<span>Vista previa: este módulo está en <b>${m.estado === 'revision' ? 'revisión' : 'borrador'}</b> y aún no lo ven los miembros.${Datos.modo === 'demo' && !modoRevisorDemo() ? ' En el demo se muestra para revisar el diseño.' : ''}</span></div>`
  : '');

const JUEGOS: Record<string, [string, string]> = { sopa: ['grid-3x3', 'Sopa de letras'], crucigrama: ['type', 'Crucigrama'], memorama: ['copy', 'Memorama'] };

// ═════════ Mapa del módulo ═════════
export async function academiaModulo(params: Record<string, string>) {
  const r = await prepararModulo(params);
  if (!r.m) return r.html!;
  const { p, n, m } = r as Listo;
  const av = avanceModulo(p.id, n);
  const leidos = temasLeidos(p.id, m);
  const todos = leidos === m.temas.length;
  const actividades = m.temas.reduce((a, t) => a + (t.bloques || []).filter((b) => b.tipo === 'actividad').length, 0);
  const juego = JUEGOS[m.minijuego?.tipo ?? ''] ?? ['puzzle', 'Minijuego'];
  const lista = m.temas.map((t, i) => {
    const leido = !!av.temas?.[t.n];
    const figs = (t.bloques || []).filter((b) => b.tipo === 'figura').length;
    const acts = (t.bloques || []).filter((b) => b.tipo === 'actividad').length;
    return `<li class="ac-tema ${leido ? 'is-ok' : ''}"><a href="${ruta(p.id, n, i + 1)}"><span class="ac-tema__n">${esc(t.n)}</span><span class="ac-tema__txt"><strong>${esc(t.titulo)}</strong><small>${ic('clock')}${t.minutos} min · ${figs} figura${figs === 1 ? '' : 's'} · ${acts} actividad${acts === 1 ? '' : 'es'}</small></span><span class="ac-tema__estado">${leido ? `${ic('check')}Leído` : `Leer ${ic('arrow-right')}`}</span></a></li>`;
  }).join('');
  const siguienteTema = m.temas.findIndex((t) => !av.temas?.[t.n]);
  const examenListo = todos || esAdminAcademia();
  return `<section class="ac ac-modulo" data-tono="${area(p.area).tono}">
    ${migasMod(p, n)}
    ${avisoBorrador(m)}
    <header class="ac-mod">
      <div class="ac-mod__txt">
        <span class="ac-pub ac-pub--fuerte">${ic('layers')} Módulo ${n} de ${p.modulos.length}${n === 1 ? ' · gratis' : ''}</span>
        <h1>${esc(m.titulo)}</h1>
        <p class="ac-lead">${esc(m.resumen)}</p>
        <div class="ac-datos"><span>${ic('book-open')}<b>${m.temas.length}</b> temas</span><span>${ic('puzzle')}<b>${actividades}</b> actividades</span>${m.duracionMin ? `<span>${ic('clock')}<b>${horas(m.duracionMin)}</b></span>` : ''}${av.mejor != null ? `<span>${ic('trophy')}Mejor examen <b>${av.mejor} %</b></span>` : ''}</div>
        <a class="btn btn--brand btn--lg" href="${siguienteTema >= 0 ? ruta(p.id, n, siguienteTema + 1) : ruta(p.id, n, 'examen')}">${siguienteTema < 0 ? (av.aprobado ? 'Repetir el examen' : 'Presentar el examen') : leidos ? `Seguir con el tema ${esc(m.temas[siguienteTema].n)}` : 'Empezar a leer'} ${ic('arrow-right')}</a>
      </div>
      ${m.portada ? figura(m.portada.id, '16:9', m.portada.alt, '', undefined, 'ac-mod__portada') : ''}
    </header>
    <div class="ac-cuerpo2">
      <section>
        <h2 class="ac-h2">${ic('target')} Al terminar podrás</h2>
        <ul class="ac-objetivos">${(m.objetivos || []).map((o) => `<li>${ic('check')}<span>${esc(o)}</span></li>`).join('')}</ul>
        <h2 class="ac-h2">${ic('list-ordered')} Temas <small>${leidos} de ${m.temas.length} leídos</small></h2>
        <ol class="ac-temas">${lista}</ol>
      </section>
      <aside class="ac-lado">
        ${m.minijuego ? `<a class="ac-paso-final ${juegoCompletado(p.id, n) ? 'is-ok' : ''}" href="${ruta(p.id, n, 'juego')}"><span class="ac-paso-final__ic">${ic(juego[0])}</span><span><small>Minijuego del módulo</small><strong>${juego[1]}</strong><em>${juegoCompletado(p.id, n) ? 'Completado' : 'Repasa el vocabulario jugando'}</em></span>${ic('arrow-right')}</a>` : ''}
        <a class="ac-paso-final ac-paso-final--examen ${av.aprobado ? 'is-ok' : ''} ${examenListo ? '' : 'is-pendiente'}" href="${ruta(p.id, n, 'examen')}"><span class="ac-paso-final__ic">${ic(av.aprobado ? 'badge-check' : 'clipboard-check')}</span><span><small>Examen del módulo</small><strong>${av.aprobado ? `Aprobado · ${av.mejor} %` : `${m.examen.mostrar} preguntas · ${m.examen.aprobar} % para aprobar`}</strong><em>${examenListo ? (av.aprobado ? (n < p.modulos.length ? (moduloProgramado(infoModulo(p.id, n + 1)) ? `Módulo ${n + 1}: ${esc(textoLanzamiento(infoModulo(p.id, n + 1)!.disponibleDesde!))}` : `Módulo ${n + 1} desbloqueado`) : 'Último módulo del programa') : 'Listo para presentarlo') : `Lee los ${m.temas.length} temas para habilitarlo`}</em></span>${ic(examenListo ? 'arrow-right' : 'lock')}</a>
      </aside>
    </div>
  </section>`;
}

// ═════════ Lector de temas ═════════
export async function academiaTema(params: Record<string, string>) {
  const t = Number(params.t);
  const r = await prepararModulo(params, `Tema ${params.t}`);
  if (!r.m) return r.html!;
  const { p, n, m } = r as Listo;
  const tema = Number.isInteger(t) ? m.temas[t - 1] : undefined;
  if (!tema) return envolver(`${migasMod(p, n, 'Tema')}${errorHTML({ codigo: 'no-encontrado' }, p, n)}`, '', area(p.area).tono);
  const av = avanceModulo(p.id, n);
  const anterior = t > 1 ? ruta(p.id, n, t - 1) : ruta(p.id, n);
  const ultimo = t === m.temas.length;
  const siguiente = ultimo ? (m.minijuego ? ruta(p.id, n, 'juego') : ruta(p.id, n, 'examen')) : ruta(p.id, n, t + 1);
  const subtitulos = (tema.bloques || []).filter((b) => b.tipo === 'subtitulo') as { tipo: 'subtitulo'; texto: string }[];
  const habla = 'speechSynthesis' in window;
  return `<section class="ac ac-lector" data-tono="${area(p.area).tono}" data-ac-lector="${esc(p.id)}|${n}|${esc(tema.n)}">
    <div class="ac-lector__progreso" aria-hidden="true"><span data-ac-progreso></span></div>
    <details class="ac-indice" data-ac-indice>
      <summary>${ic('list')} <span>Índice del módulo · tema ${esc(tema.n)} de ${m.temas.length}</span>${ic('chevron-down')}</summary>
      <a class="ac-indice__mod" href="${ruta(p.id, n)}">${ic('arrow-left')}<span><small>Módulo ${n}</small>${esc(m.titulo)}</span></a>
      <ol>${m.temas.map((x, i) => `<li class="${i + 1 === t ? 'is-actual' : ''} ${av.temas?.[x.n] ? 'is-ok' : ''}"><a href="${ruta(p.id, n, i + 1)}"${i + 1 === t ? ' aria-current="page"' : ''}><span>${av.temas?.[x.n] ? `${ic('check')}<span class="sr-only">Leído:</span>` : esc(x.n)}</span>${esc(x.titulo)}</a>${i + 1 === t && subtitulos.length ? `<ul>${subtitulos.map((s) => `<li><a href="#" data-ac-ir="s-${hash(s.texto)}">${esc(s.texto)}</a></li>`).join('')}</ul>` : ''}</li>`).join('')}
        ${m.minijuego ? `<li class="ac-indice__extra"><a href="${ruta(p.id, n, 'juego')}"><span>${ic('puzzle')}</span>Minijuego</a></li>` : ''}
        <li class="ac-indice__extra"><a href="${ruta(p.id, n, 'examen')}"><span>${ic('clipboard-check')}</span>Examen</a></li>
      </ol>
    </details>
    <article class="ac-articulo" data-ac-articulo>
      ${migas([['Academia', '#/academia'], [p.titulo, ruta(p.id)], [`Módulo ${n}`, ruta(p.id, n)], [`Tema ${tema.n}`]])}
      ${avisoBorrador(m)}
      <header class="ac-art__head">
        <span class="ac-pub ac-pub--fuerte">${ic('book-open')} Tema ${esc(tema.n)} · ${tema.minutos} min de lectura</span>
        <h1>${esc(tema.titulo)}</h1>
        <div class="ac-herr" role="toolbar" aria-label="Herramientas de lectura">
          <button type="button" class="ac-herr__b" data-ac-letra="-1" aria-label="Letra más pequeña">A−</button>
          <button type="button" class="ac-herr__b" data-ac-letra="1" aria-label="Letra más grande">A+</button>
          ${habla ? `<button type="button" class="ac-herr__b" data-ac-escuchar aria-pressed="false">${ic('volume-2')}<span>Escuchar</span></button>` : ''}
        </div>
      </header>
      ${tema.enPocasPalabras ? `<aside class="ac-pocas"><span>${ic('sparkles')} En pocas palabras</span><p>${esc(tema.enPocasPalabras)}</p></aside>` : ''}
      <div class="ac-cuerpo" data-ac-cuerpo>${bloques(tema)}</div>
      ${tema.verificacion?.length ? verificacion(tema) : ''}
      <p class="ac-leido" data-ac-leido role="status" aria-live="polite">${av.temas?.[tema.n] ? `${ic('check')}Tema registrado como leído` : ''}</p>
      <footer class="ac-art__pie">
        <a class="btn btn--secondary" href="${anterior}">${ic('arrow-left')} ${t > 1 ? `Tema ${esc(m.temas[t - 2].n)}` : 'Módulo'}</a>
        <a class="btn btn--brand" href="${siguiente}" data-ac-terminar>${ultimo ? (m.minijuego ? 'Terminar y jugar el minijuego' : 'Terminar e ir al examen') : `Siguiente: tema ${esc(m.temas[t].n)}`} ${ic('arrow-right')}</a>
      </footer>
    </article>
  </section>`;
}

// ═════════ Minijuego ═════════
export async function academiaJuego(params: Record<string, string>) {
  const r = await prepararModulo(params, 'Minijuego');
  if (!r.m) return r.html!;
  const { p, n, m } = r as Listo;
  const semilla = hash(`${p.id}${n}${Date.now() >> 16}`);
  const tablero = m.minijuego
    ? minijuegoHTML(m.minijuego, semilla)
    : '<p class="ac-juego__ayuda">Este módulo todavía no tiene minijuego.</p>';
  return `<section class="ac ac-juego" data-tono="${area(p.area).tono}" data-ac-juego="${esc(p.id)}|${n}">
    ${migasMod(p, n, 'Minijuego')}
    <header class="ac-juego__head"><span class="ac-pub ac-pub--fuerte">${ic('puzzle')} Minijuego del módulo ${n} · ${JUEGOS[m.minijuego?.tipo ?? '']?.[1] ?? 'Práctica'}</span><h1>${esc(m.minijuego?.titulo || 'Minijuego')}</h1><p class="ac-lead">Repasa el vocabulario del módulo antes del examen. Es práctica: no cuenta para tu calificación.</p></header>
    <div class="ac-juego__tablero">${tablero}</div>
    <div class="ac-juego__fin" data-ac-juego-fin role="status" hidden><span class="ac-juego__sello">${ic('trophy')}</span><div><strong>¡Completado!</strong><p>Ya repasaste el vocabulario del módulo. Ahora sí, al examen.</p></div><a class="btn btn--secondary" href="${ruta(p.id, n, 'examen')}">Ir al examen ${ic('arrow-right')}</a></div>
    <footer class="ac-art__pie"><a class="btn btn--secondary" href="${ruta(p.id, n)}">${ic('arrow-left')} Volver al módulo</a><a class="btn btn--secondary" href="${ruta(p.id, n, 'examen')}">Ir al examen ${ic('arrow-right')}</a></footer>
  </section>`;
}

// ═════════ Examen ═════════
let examenActual: { p: string; n: number; aprobar: number; preguntas: PreguntaA[]; resp: Record<string, number | null>; i: number } | null = null;

function introExamen(p: Programa, n: number, m: Modulo) {
  const leidos = temasLeidos(p.id, m);
  const todos = leidos === m.temas.length || esAdminAcademia();
  const av = avanceModulo(p.id, n);
  return `<div class="ac-ex__intro">
    <span class="ac-ex__sello">${ic('clipboard-check')}</span>
    <span class="ac-ex__eyebrow">Examen del módulo ${n}</span>
    <h1>${esc(m.titulo)}</h1>
    <ul class="ac-ex__reglas">
      <li>${ic('list-ordered')}<span><b>${m.examen.mostrar}</b> preguntas al azar de un banco de ${m.examen.total ?? m.examen.preguntas?.length ?? m.examen.mostrar}</span></li>
      <li>${ic('target')}<span><b>${m.examen.aprobar} %</b> para aprobar${n < p.modulos.length ? ` y desbloquear el módulo ${n + 1}` : ' el último módulo del programa'}</span></li>
      <li>${ic('eye-off')}<span>Las respuestas correctas y sus explicaciones se muestran al aprobar</span></li>
      <li>${ic('rotate-ccw')}<span>Si no apruebas, repasa y reintenta después de 3 minutos; cuenta tu mejor resultado</span></li>
      <li>${ic('keyboard')}<span>Teclado: 1 a 4 para elegir, flechas para moverte</span></li>
    </ul>
    ${av.intentos ? `<p class="ac-ex__previo">${ic('history')} ${av.intentos} intento${av.intentos === 1 ? '' : 's'} · mejor resultado <b>${av.mejor} %</b>${av.aprobado ? ' · aprobado' : ''}</p>` : ''}
    ${todos ? `<button type="button" class="btn btn--brand btn--lg" data-ac-ex-iniciar>${av.intentos ? 'Presentar de nuevo' : 'Comenzar examen'} ${ic('arrow-right')}</button>` : errorHTML({ codigo: 'temas_pendientes', message: `Has leído ${leidos} de ${m.temas.length} temas. El examen se habilita al leerlos todos.` }, p, n)}
    <div data-ac-ex-error></div>
  </div>`;
}

export async function academiaExamen(params: Record<string, string>) {
  const r = await prepararModulo(params, 'Examen');
  if (!r.m) return r.html!;
  const { p, n, m } = r as Listo;
  examenActual = null;
  return `<section class="ac ac-examen" data-tono="${area(p.area).tono}" data-ac-examen="${esc(p.id)}|${n}">
    ${migasMod(p, n, 'Examen')}
    ${avisoBorrador(m)}
    <div class="ac-ex" data-ac-ex>${introExamen(p, n, m)}</div>
  </section>`;
}

function pintarPregunta(root: HTMLElement, enfocar = true) {
  const ex = examenActual!; const q = ex.preguntas[ex.i];
  const total = ex.preguntas.length, elegida = ex.resp[q.id];
  const respondidas = Object.values(ex.resp).filter((v) => v != null).length;
  root.innerHTML = `<div class="ac-ex__run">
    <header class="ac-ex__barra"><span><b>${ex.i + 1}</b> de ${total}</span><div class="progress" role="progressbar" aria-label="Avance del examen" aria-valuenow="${ex.i + 1}" aria-valuemin="1" aria-valuemax="${total}"><span style="width:${((ex.i + 1) / total) * 100}%"></span></div></header>
    <fieldset class="ac-ex__q"><legend tabindex="-1" data-ac-ex-legend>${esc(q.q)}</legend><div class="ac-q__ops">${q.opciones.map((o, j) => `<button type="button" class="ac-op ${elegida === j ? 'is-sel' : ''}" data-ac-ex-op="${j}" aria-pressed="${elegida === j}"><span class="ac-op__l" aria-hidden="true">${'ABCDEFGH'[j]}</span><span>${esc(o)}</span></button>`).join('')}</div></fieldset>
    <footer class="ac-ex__nav"><button type="button" class="btn btn--secondary" data-ac-ex-prev ${ex.i === 0 ? 'disabled' : ''}>${ic('arrow-left')} Anterior</button><span class="ac-ex__puntos" aria-label="${respondidas} de ${total} respondidas">${ex.preguntas.map((x, k) => `<i class="${ex.resp[x.id] != null ? 'is-r' : ''} ${k === ex.i ? 'is-a' : ''}"></i>`).join('')}</span>${ex.i < total - 1 ? `<button type="button" class="btn btn--brand" data-ac-ex-next ${elegida == null ? 'disabled' : ''}>Siguiente ${ic('arrow-right')}</button>` : `<button type="button" class="btn btn--gradient" data-ac-ex-enviar ${respondidas < total ? 'disabled' : ''}>Entregar examen ${ic('send')}</button>`}</footer>
    <div data-ac-ex-error></div>
  </div>`;
  createIcons({ icons, root });
  if (enfocar) root.querySelector<HTMLElement>('[data-ac-ex-legend]')?.focus({ preventScroll: true });
}

function pintarResultado(root: HTMLElement, r: ResultadoExamen) {
  const ex = examenActual!;
  const q = new Map(ex.preguntas.map((x) => [x.id, x]));
  const circ = 326.7;
  const fin = r.aprobado && r.programaCompleto;
  // Si el siguiente módulo todavía tiene fecha pendiente, se dice cuándo se abre en lugar de «ya está abierto».
  const sig = r.siguiente ? infoModulo(ex.p, r.siguiente) : undefined;
  const sigProgramado = moduloProgramado(sig) ? sig!.disponibleDesde! : null;
  root.innerHTML = `<div class="ac-ex__res ${r.aprobado ? 'is-ok' : 'is-no'}" tabindex="-1" data-ac-ex-res>
    <div class="ac-ex__nota"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="ac-ex__aro"/><circle cx="60" cy="60" r="52" class="ac-ex__aro-v" style="stroke-dasharray:${(r.porcentaje / 100) * circ} ${circ}"/></svg><b>${r.porcentaje}<small>%</small></b></div>
    <span class="ac-estado ${r.aprobado ? 'is-ok' : 'is-no'}">${r.aprobado ? `${ic('badge-check')} Módulo aprobado` : `${ic('rotate-ccw')} Aún no apruebas`}</span>
    <h2>${r.aprobado ? (fin ? '¡Completaste el programa!' : '¡Aprobaste el módulo!') : 'Te faltó poco'}</h2>
    <p>${r.correctas} de ${r.total} correctas · mejor resultado ${r.mejor} %. ${r.aprobado ? (fin ? `Aprobaste todos los módulos. ${CERT_PRONTO}` : r.siguiente ? (sigProgramado ? `El módulo ${r.siguiente} se abre el ${esc(fechaLanzamiento(sigProgramado))} (${esc(cuentaLanzamiento(sigProgramado))}).` : `El módulo ${r.siguiente} ya está abierto.`) : '') : `Necesitas ${ex.aprobar} % para aprobar. Repasa los temas y vuelve a intentarlo en 3 minutos.`}</p>
    ${r.revelado ? '' : `<p class="ac-ex__oculto">${ic('eye-off')}<span>Las respuestas correctas y sus explicaciones se muestran cuando apruebas el módulo. Abajo ves en qué preguntas acertaste.</span></p>`}
    <div class="ac-ex__acciones">${r.aprobado && r.siguiente ? (sigProgramado ? `<a class="btn btn--brand btn--lg" href="${ruta(ex.p)}">${ic('calendar-clock')}Ver el calendario del programa</a>` : `<a class="btn btn--brand btn--lg" href="${ruta(ex.p, r.siguiente)}">Ir al módulo ${r.siguiente} ${ic('arrow-right')}</a>`) : ''}${!r.aprobado ? `<a class="btn btn--brand btn--lg" href="${ruta(ex.p, ex.n)}">${ic('book-open')} Repasar los temas</a>` : ''}<a class="btn btn--secondary" href="${fin ? ruta(ex.p) : ruta(ex.p, ex.n)}">${fin ? 'Ver el programa' : 'Volver al módulo'}</a></div>
    <h3 class="ac-h2">${ic('list-checks')} Revisión de respuestas</h3>
    <ol class="ac-ex__rev">${r.detalle.map((d) => {
      const x = q.get(d.id); if (!x) return '';
      const elegida = ex.resp[d.id];
      const buena = r.revelado && typeof d.correcta === 'number' && !d.acertada ? `<p class="ac-ex__buena">${ic('check')} Correcta: ${esc(x.opciones[d.correcta] ?? '')}</p>` : '';
      return `<li class="${d.acertada ? 'is-ok' : 'is-no'}"><p><b>${esc(x.q)}</b></p><p class="ac-ex__tu">${ic(d.acertada ? 'circle-check' : 'circle-x')}<span><span class="sr-only">${d.acertada ? 'Acertaste.' : 'No acertaste.'}</span> Tu respuesta: ${elegida != null ? esc(x.opciones[elegida]) : 'sin responder'}</span></p>${buena}${r.revelado && d.explicacion ? `<p class="ac-ex__exp">${esc(d.explicacion)}</p>` : ''}</li>`;
    }).join('')}</ol>
  </div>`;
  createIcons({ icons, root });
  if (r.aprobado) celebrar(fin ? 'grande' : 'normal');
  const res = root.querySelector<HTMLElement>('[data-ac-ex-res]');
  res?.focus({ preventScroll: true });
  root.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

// ═════════ Montaje ═════════
let desmontar: (() => void) | null = null;
const LETRA = 'dermalysse:academia:letra';

/** Se llama tras cada render: limpia lo anterior y conecta los eventos si la página es de la Academia. */
export function montarAcademia() {
  desmontar?.(); desmontar = null;
  const root = document.querySelector<HTMLElement>('#outlet .ac:not(.ac-admin)');
  if (!root) return;
  const ab = new AbortController();
  const sig = { signal: ab.signal };
  const suave: ScrollBehavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

  // Tamaño de letra del lector (preferencia por persona).
  const aplicarLetra = (v: number) => root.style.setProperty('--ac-letra', String(v));
  let letra = 1; try { letra = Number(localStorage.getItem(LETRA)) || 1; } catch { /* sin almacenamiento */ }
  aplicarLetra(letra);

  // Catálogo: búsqueda y filtro por área.
  const grid = root.querySelector<HTMLElement>('[data-ac-grid]');
  let areaSel = '';
  const filtrar = () => {
    const q = (root.querySelector<HTMLInputElement>('[data-ac-buscar]')?.value || '').trim().toLowerCase();
    let visibles = 0;
    grid?.querySelectorAll<HTMLElement>('.ac-card').forEach((c) => { const ok = (!areaSel || c.dataset.area === areaSel) && (!q || c.dataset.buscar!.includes(q)); c.hidden = !ok; if (ok) visibles++; });
    const v = root.querySelector<HTMLElement>('[data-ac-vacio]'); if (v) v.hidden = visibles > 0;
  };
  root.querySelector('[data-ac-buscar]')?.addEventListener('input', filtrar, sig);

  // Lector: índice abierto en escritorio, barra de progreso y tema leído al llegar al final.
  if (root.matches('[data-ac-lector]')) {
    const indice = root.querySelector<HTMLDetailsElement>('[data-ac-indice]');
    const escritorio = matchMedia('(min-width: 1100px)');
    const ajustarIndice = () => { if (indice) indice.open = escritorio.matches; };
    ajustarIndice();
    escritorio.addEventListener('change', ajustarIndice, sig);
    const [pid, n, tema] = root.dataset.acLector!.split('|');
    const barra = root.querySelector<HTMLElement>('[data-ac-progreso]');
    const art = root.querySelector<HTMLElement>('[data-ac-articulo]')!;
    const estadoLeido = root.querySelector<HTMLElement>('[data-ac-leido]');
    let marcado = !!avanceModulo(pid, Number(n)).temas?.[tema];
    const marcar = async () => {
      if (marcado) return;
      marcado = true;
      const ok = await marcarTemaLeido(pid, Number(n), tema);
      if (!estadoLeido || !root.isConnected) return;
      estadoLeido.innerHTML = ok ? `${ic('check')}Tema registrado como leído` : `${ic('circle-alert')}No pudimos registrar la lectura. Se volverá a intentar al llegar al final.`;
      estadoLeido.classList.toggle('is-no', !ok);
      createIcons({ icons, root: estadoLeido });
      if (!ok) marcado = false;
    };
    const onScroll = () => {
      if (!art.isConnected) return;
      const r = art.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (innerHeight - r.top) / Math.max(1, r.height)));
      if (barra) barra.style.width = `${pct * 100}%`;
      if (pct > 0.92) void marcar();
    };
    addEventListener('scroll', onScroll, { passive: true, signal: ab.signal });
    onScroll();
    root.querySelector('[data-ac-terminar]')?.addEventListener('click', () => { void marcar(); }, sig);
  }

  montarInteraccion(root, {
    signal: ab.signal,
    alCompletarJuego: () => {
      if (!root.matches('[data-ac-juego]')) return;
      const [pid, n] = root.dataset.acJuego!.split('|');
      marcarJuego(pid, Number(n));
      const fin = root.querySelector<HTMLElement>('[data-ac-juego-fin]');
      if (fin) { fin.hidden = false; fin.scrollIntoView({ behavior: suave, block: 'center' }); }
      celebrar('normal');
    },
  });

  const mostrarError = (exRoot: HTMLElement, err: unknown, pid: string, n: number) => {
    const caja = exRoot.querySelector<HTMLElement>('[data-ac-ex-error]');
    if (!caja) return;
    caja.innerHTML = errorHTML(err, getPrograma(pid), n);
    createIcons({ icons, root: caja });
  };

  root.addEventListener('click', async (e) => {
    const el = e.target as HTMLElement;
    const chip = el.closest<HTMLElement>('[data-ac-area]');
    if (chip) {
      areaSel = chip.dataset.acArea || '';
      root.querySelectorAll<HTMLElement>('[data-ac-area]').forEach((c) => { c.classList.toggle('is-on', c === chip); c.setAttribute('aria-pressed', String(c === chip)); });
      filtrar(); return;
    }
    const ir = el.closest<HTMLElement>('[data-ac-ir]');
    if (ir) {
      e.preventDefault();
      const destino = document.getElementById(ir.dataset.acIr!);
      destino?.scrollIntoView({ behavior: suave, block: 'start' });
      if (destino) { destino.tabIndex = -1; destino.focus({ preventScroll: true }); }
      if (!matchMedia('(min-width: 1100px)').matches) root.querySelector<HTMLDetailsElement>('[data-ac-indice]')?.removeAttribute('open');
      return;
    }
    const l = el.closest<HTMLElement>('[data-ac-letra]');
    if (l) { letra = Math.min(1.3, Math.max(0.9, Math.round((letra + Number(l.dataset.acLetra) * 0.1) * 10) / 10)); aplicarLetra(letra); try { localStorage.setItem(LETRA, String(letra)); } catch { /* sin almacenamiento */ } return; }
    const escuchar = el.closest<HTMLButtonElement>('[data-ac-escuchar]');
    if (escuchar && 'speechSynthesis' in window) {
      if (speechSynthesis.speaking) { speechSynthesis.cancel(); escuchar.setAttribute('aria-pressed', 'false'); return; }
      const texto = [...root.querySelectorAll<HTMLElement>('.ac-art__head h1, .ac-pocas p, .ac-cuerpo .ac-sub, .ac-cuerpo .ac-txt, .ac-cuerpo .ac-pasos, .ac-cuerpo .ac-lista, .ac-cuerpo .ac-rec')].map((x) => x.innerText).join('. ');
      const u = new SpeechSynthesisUtterance(texto); u.lang = 'es-MX'; u.rate = 1;
      const voz = speechSynthesis.getVoices().find((v) => v.lang === 'es-MX') ?? speechSynthesis.getVoices().find((v) => v.lang.startsWith('es'));
      if (voz) u.voice = voz;
      u.onend = () => escuchar.setAttribute('aria-pressed', 'false');
      speechSynthesis.speak(u); escuchar.setAttribute('aria-pressed', 'true');
      return;
    }
    // Examen
    const exRoot = root.querySelector<HTMLElement>('[data-ac-ex]');
    const exAttr = root.matches('[data-ac-examen]') ? root.dataset.acExamen : undefined;
    if (!exRoot || !exAttr) return;
    const [pid, nn] = exAttr.split('|'); const n = Number(nn);
    const iniciar = el.closest<HTMLButtonElement>('[data-ac-ex-iniciar]');
    if (iniciar) {
      iniciar.disabled = true;
      try {
        const ex = await emitirExamen(pid, n);
        if (!ex.preguntas.length) throw new Error('Este módulo todavía no tiene examen.');
        examenActual = { p: pid, n, aprobar: ex.aprobar, preguntas: ex.preguntas, resp: {}, i: 0 };
        pintarPregunta(exRoot); exRoot.scrollIntoView({ behavior: suave, block: 'start' });
      } catch (err) { iniciar.disabled = false; mostrarError(exRoot, err, pid, n); }
      return;
    }
    if (!examenActual) return;
    const op = el.closest<HTMLElement>('[data-ac-ex-op]');
    if (op) { examenActual.resp[examenActual.preguntas[examenActual.i].id] = Number(op.dataset.acExOp); pintarPregunta(exRoot, false); exRoot.querySelector<HTMLElement>(`[data-ac-ex-op="${op.dataset.acExOp}"]`)?.focus(); return; }
    if (el.closest('[data-ac-ex-next]')) { examenActual.i++; pintarPregunta(exRoot); return; }
    if (el.closest('[data-ac-ex-prev]')) { examenActual.i--; pintarPregunta(exRoot); return; }
    const enviar = el.closest<HTMLButtonElement>('[data-ac-ex-enviar]');
    if (enviar) {
      enviar.disabled = true; enviar.textContent = 'Calificando…';
      try { pintarResultado(exRoot, await calificarExamen(pid, n, examenActual.resp)); }
      catch (err) { enviar.disabled = false; enviar.textContent = 'Entregar examen'; mostrarError(exRoot, err, pid, n); }
    }
  }, sig);

  // Teclado en el examen: 1-4 eligen opción, flechas navegan.
  document.addEventListener('keydown', (e) => {
    const exRoot = root.querySelector<HTMLElement>('[data-ac-ex]');
    if (!examenActual || !exRoot?.querySelector('.ac-ex__run') || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as HTMLElement)?.matches?.('input, textarea, select')) return;
    if (/^[1-8]$/.test(e.key)) exRoot.querySelector<HTMLElement>(`[data-ac-ex-op="${Number(e.key) - 1}"]`)?.click();
    if (e.key === 'ArrowRight') exRoot.querySelector<HTMLButtonElement>('[data-ac-ex-next]:not(:disabled)')?.click();
    if (e.key === 'ArrowLeft') exRoot.querySelector<HTMLButtonElement>('[data-ac-ex-prev]:not(:disabled)')?.click();
  }, sig);

  // Cerrar definiciones del glosario con Escape.
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') root.querySelectorAll('.ac-glos.is-open').forEach((g) => g.classList.remove('is-open')); }, sig);

  desmontar = () => { ab.abort(); examenActual = null; if ('speechSynthesis' in window && speechSynthesis.speaking) speechSynthesis.cancel(); };
}
