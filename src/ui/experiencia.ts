import { createIcons, icons } from 'lucide';
import { Auth, mensajeError } from '../core/auth';
import {
  cargarExperiencia, completarExperiencia, getErrorExperiencia, getExperiencia, guardarRespuestasExperiencia,
  iniciarExperiencia, posponerExperiencia, puedePrevisualizarEncuestaDemo, previsualizarEncuestaDemo,
  type BeneficioExperiencia, type ExperienciaDTO, type FlujoExperiencia,
} from '../core/experiencia';
import { aplicarPose, dibujoGuia, poseGuia, type GestoGuia, type PosturaGuia } from '../landing/guia-capas';
import { celebrar } from './celebracion';
import { iconoDuotono, logoMarca } from './iconos-experiencia';
import '../styles/experiencia.css';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const ic = (nombre: string) => `<i data-lucide="${nombre}" class="i" aria-hidden="true"></i>`;
const IMAGENES_GUIA: Record<PosturaGuia, string> = {
  saludo: '/media/dermalysse-guia-lia-v1.png',
  orientar: '/media/dermalysse-guia-lia-v1.png',
  celebrar: '/media/dermalysse-guia-lia-v1.png',
};
let numeroGuia = 0;
/** Texto visible de una opción; un área del catálogo se muestra con su propio nombre. */
export const etiquetaExperiencia = (valor: string) => etiquetas[valor] || valor;
const etiquetas: Record<string, string> = {
  estudiante: 'Estudiante', veterinario: 'Profesional de la salud', tecnico: 'Cosmetólogo/a', productor: 'Profesional de estética', docente: 'Docente', otro: 'Otro', 'prefiero-no-decir': 'Prefiero no decirlo',
  aprender: 'Aprender desde cero', produccion: 'Mejorar mi producción', actualizar: 'Actualizar mis conocimientos', estudios: 'Apoyar mis estudios', certificacion: 'Formarme y obtener certificados',
  inicio: 'Estoy empezando', basico: 'Tengo conocimientos básicos', practica: 'Ya tengo experiencia práctica', avanzado: 'Tengo experiencia avanzada',
  grabados: 'Grabados, a mi ritmo', envivo: 'En vivo, con horarios', ambos: 'Me interesan ambos', 'no-se': 'Todavía no lo sé',
  cortos: 'Ratitos cortos', semana: 'Entre semana', fines: 'Fines de semana',
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', redes: 'Otra red social', google: 'Google', whatsapp: 'WhatsApp', recomendacion: 'Me lo recomendaron', 'escuela-evento': 'Escuela o evento',
  iniciando: 'Estoy iniciando', intermedia: 'Etapa intermedia', final: 'Etapa final', egresado: 'Ya egresé',
  ninguna: 'Ninguna dificultad', encontrar: 'Encontrar contenido', video: 'Reproducir videos', movil: 'Usarlo en mi teléfono', acceso: 'Acceso a mi cuenta o VIP', otra: 'Otra dificultad',
};
// Nombres de Phosphor (duotono). Las redes de «origen» usan su logotipo oficial, no este mapa.
const iconosOpcion: Record<string, string> = {
  estudiante: 'student', veterinario: 'stethoscope', tecnico: 'sparkles', productor: 'heart-handshake', docente: 'chalkboard-teacher', otro: 'circle-user', 'prefiero-no-decir': 'eye-slash',
  aprender: 'plant', produccion: 'chart-line-up', actualizar: 'arrows-clockwise', estudios: 'book-open-text', certificacion: 'certificate',
  inicio: 'plant', basico: 'leaf', practica: 'tree', avanzado: 'mountains',
  grabados: 'play-circle', envivo: 'broadcast', ambos: 'stack', 'no-se': 'question',
  cortos: 'timer', semana: 'calendar-dots', fines: 'sun-horizon',
  redes: 'share-network', recomendacion: 'handshake', 'escuela-evento': 'graduation-cap',
  ninguna: 'smiley', encontrar: 'magnifying-glass', video: 'video', movil: 'device-mobile', acceso: 'key', otra: 'question',
};
// Opciones de «origen» sin logotipo propio: colores de la marca Dermalysse.
const FONDOS_ORIGEN: Record<string, string> = { recomendacion: '#681c31', 'escuela-evento': '#d9a09b', redes: '#315a76', otro: '#0b2435' };
const iconosArea: Record<string, string> = {
  Dermatología: 'scan-face', Cosmetología: 'flask-conical', Cosmiatría: 'sparkles', Estética: 'wand-sparkles', Bienestar: 'heart-pulse', Nutrición: 'apple',
  'Ovinos y Caprinos': 'paw-print', Apicultura: 'hexagon', Cunicultura: 'rabbit', General: 'sparkle',
  'Pequeñas Especies': 'rabbit', Agroindustria: 'factory', 'Fauna Silvestre': 'paw-print',
};
// La API responde con códigos; en demo el motivo ya es una frase y se muestra tal cual.
const MOTIVOS: Record<string, string> = {
  'campana-inactiva': '', 'sin-reserva': '', 'completada-sin-beneficio': '', 'beneficio-otorgado': '', 'uso-verificado': '',
  'otra-fuente-vip': 'Ya tienes acceso VIP por otra vía, así que este beneficio no aplica a tu cuenta.',
  'correo-no-verificado': 'Verifica tu correo para poder recibir el beneficio.',
  'cupo-agotado': 'Las plazas de esta promoción ya se agotaron.',
  'oferta-vencida': 'El plazo de esta promoción ya terminó.',
  'cuenta-existente': 'El beneficio de bienvenida es para cuentas nuevas.',
  'plaza-reservada': 'Tu lugar en la promoción está reservado.',
  'inicia-entrevista': 'Primero completa tu bienvenida; después podrás contarnos cómo te fue.',
  'espera-7-dias': 'Estará disponible cuando lleves una semana en el club.',
  'faltan-3-dias-de-uso': 'Estará disponible cuando hayas entrado al club en tres días distintos.',
  'falta-quiz-calificado': 'Estará disponible cuando respondas la evaluación de alguna clase.',
};
const textoMotivo = (motivo: string) => Object.hasOwn(MOTIVOS, motivo) ? MOTIVOS[motivo] : motivo;

interface PreguntaExperiencia { clave: string; titulo: string; ayuda: string; voz: string; opciones?: string[]; multiple?: boolean; texto?: number; escala?: boolean; opcional?: boolean }
const ENTREVISTA: PreguntaExperiencia[] = [
  { clave: 'roles', voz: 'Empecemos por ti. ¿A qué te dedicas?', titulo: '¿Cómo te relacionas con la dermatología, cosmetología o estética?', ayuda: 'Puedes elegir hasta tres opciones. Esto solo nos ayuda a orientarte.', multiple: true, opciones: ['estudiante', 'veterinario', 'tecnico', 'productor', 'docente', 'otro', 'prefiero-no-decir'] },
  { clave: 'objetivo', voz: '¡Qué bien! Ahora dime qué te trajo hasta aquí.', titulo: '¿Qué te gustaría conseguir aquí?', ayuda: 'Elige el objetivo más importante para ti en este momento.', opciones: ['aprender', 'produccion', 'actualizar', 'estudios', 'certificacion', 'otro'] },
  { clave: 'areas', voz: 'Así sabré qué cursos enseñarte primero.', titulo: '¿Qué áreas o especies te interesan?', ayuda: 'Elige hasta tres áreas del catálogo disponible. Puedes conocer otras después.', multiple: true },
  { clave: 'experiencia', voz: 'Sin presión, no es un examen. Solo busco tu punto de partida.', titulo: '¿Desde dónde empezamos?', ayuda: 'Buscamos un punto de partida cómodo para ti.', opciones: ['inicio', 'basico', 'practica', 'avanzado'] },
  { clave: 'formato', voz: 'Cada quien aprende distinto. ¿Cómo te acomoda más?', titulo: '¿Cómo prefieres aprender?', ayuda: 'Los grabados van a tu ritmo; los cursos en vivo tienen fechas e inscripción propias.', opciones: ['grabados', 'envivo', 'ambos', 'no-se'] },
  { clave: 'tiempo', voz: 'Ya casi terminamos. ¿Cuándo tienes un rato para aprender?', titulo: '¿Cuándo te viene mejor aprender?', ayuda: 'Te ayudaremos a construir una rutina que sí puedas sostener.', opciones: ['cortos', 'semana', 'fines'] },
  { clave: 'origen', voz: 'Última pregunta, ¡lo prometo!', titulo: '¿Cómo conociste Dermalysse?', ayuda: 'Nos ayuda a saber cómo llegan los colegas al club.', opciones: ['facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp', 'google', 'recomendacion', 'escuela-evento', 'otro'] },
];
const ENCUESTA: PreguntaExperiencia[] = [
  { clave: 'facilidad', voz: 'Ya llevas un tiempo aquí. Cuéntame con confianza.', titulo: '¿Qué tan fácil te ha resultado usar el club?', ayuda: 'De 1 (muy difícil) a 5 (muy fácil). Si todavía no puedes evaluarlo, también está bien.', escala: true },
  { clave: 'utilidad', voz: 'Tu opinión honesta es la que más nos sirve.', titulo: '¿Qué tan útil te ha resultado el contenido?', ayuda: 'De 1 (poco útil) a 5 (muy útil).', escala: true },
  { clave: 'dificultad', voz: 'Si algo te costó trabajo, quiero saberlo.', titulo: '¿Qué te ha costado más trabajo?', ayuda: 'Elige la dificultad principal. Si todo estuvo bien, puedes indicarlo.', opciones: ['ninguna', 'encontrar', 'video', 'movil', 'acceso', 'otra'] },
  { clave: 'tema', voz: '¿Qué te gustaría aprender después?', titulo: '¿Qué tema te gustaría aprender después?', ayuda: 'Puedes sugerir un tema, un área o una necesidad de tu práctica.', texto: 160, opcional: true },
  { clave: 'comentario', voz: 'Y para cerrar, lo que quieras contarme.', titulo: '¿Hay algo más que quieras contarnos?', ayuda: 'Una idea, una dificultad o lo que te haya gustado. No incluyas contraseñas ni información sensible.', texto: 500, opcional: true },
];
function demoHTML(e: ExperienciaDTO) { return e.fuente === 'demo' ? `<p class="experience-demo">${ic('flask-conical')}<span><strong>Demostración · datos de este navegador.</strong> Los beneficios de 7 y 15 días son ejemplos: esta pantalla no otorga acceso VIP ni cambia tu membresía.</span></p>` : ''; }
function beneficioVisible(b: BeneficioExperiencia) {
  return (b.dias === 7 || b.dias === 15) && ['reservado', 'otorgado', 'demo'].includes(b.estado) && (b.estado === 'otorgado' || !b.venceOferta || Date.parse(b.venceOferta) > Date.now());
}
// Polvo dorado: posición horizontal (%), tamaño (px), duración (s) y desfase (s) de cada mota.
const POLVO = [[5, 5, 14, 0], [13, 3, 18, 5], [22, 4, 15, 9], [30, 6, 20, 2], [38, 3, 16, 11], [47, 5, 22, 6], [56, 4, 17, 1], [65, 3, 19, 10], [73, 6, 23, 4], [82, 4, 15, 13], [90, 5, 21, 3], [96, 3, 17, 8]];
function guiaHTML() {
  // El texto fantasma reserva el alto final del globo: escribirlo letra por letra no mueve a la guía.
  return `<aside class="experience-guide" aria-label="Tu guía virtual">
    <div class="experience-guide__say" data-experience-say><span class="experience-guide__name">Tu guía Dermalysse</span><p><span class="experience-guide__ghost" data-experience-say-ghost aria-hidden="true"></span><span class="experience-guide__typed" data-experience-say-typed aria-hidden="true"></span><span class="experience-sr" data-experience-say-full></span></p></div>
    <div class="experience-guide__floor" aria-hidden="true"><i class="experience-guide__sweep"></i><i class="experience-guide__ripple"></i><i class="experience-guide__ripple"></i></div>
    <div class="experience-guide__figure" data-experience-guide aria-hidden="true"><img src="${IMAGENES_GUIA.saludo}" alt=""></div>
    <div class="experience-guide__sparks" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  </aside>`;
}
export function paginaExperienciaHTML(flujo: FlujoExperiencia) {
  const e = getExperiencia();
  const error = getErrorExperiencia();
  return `<section class="experience-page" data-experience-flow="${flujo}">
    <h1 class="experience-sr">${flujo === 'entrevista' ? 'Conozcámonos un poco' : 'Ayúdanos a mejorar'}</h1>
    <div class="experience-stage">
      <div class="experience-stage__fx" aria-hidden="true"><i class="experience-aurora experience-aurora--gold"></i><i class="experience-aurora experience-aurora--emerald"></i><i class="experience-aurora experience-aurora--violet"></i>${POLVO.map(([x, s, d, r]) => `<i class="experience-dust" style="--x:${x}%;--s:${s}px;--d:${d}s;--t:-${r}s"></i>`).join('')}</div>
      <div class="experience-stage__bar"><a class="experience-stage__logo" href="#/" aria-label="Dermalysse, ir a Inicio"><img src="/brand/dermalysse-horizontal.svg" alt=""></a><span class="experience-guide__badge">${ic('sparkles')} ${flujo === 'entrevista' ? 'Tu bienvenida' : 'Tu opinión cuenta'}</span><button class="experience-guide__pause" type="button" data-experience-pause aria-pressed="false" aria-label="Pausar animación de la guía">${ic('pause')}<span>Pausar</span></button><a class="experience-page__exit" href="#/" aria-label="Salir y volver a Inicio">${ic('x')}<span>Salir</span></a></div>
      ${guiaHTML()}
      <div class="experience-panel" data-experience-content>${e ? '' : `<div class="experience-empty"><h2>No pudimos cargar tu experiencia</h2><p>${esc(error?.message || 'Intenta de nuevo para recuperar el estado de tu cuenta. No mostraremos datos de ejemplo en modo conectado.')}</p><button class="experience-button experience-button--main" data-experience-retry type="button">${ic('refresh-cw')} Volver a intentar</button><div class="experience-error" data-experience-error role="alert" hidden></div></div>`}</div>
      ${e ? demoHTML(e) : ''}
    </div>
  </section>`;
}
export function tarjetaExperienciaHTML(e = getExperiencia()): string {
  if (!e) return '';
  const entrevistaPendiente = e.entrevista.estado !== 'completada';
  const encuestaDisponible = ['disponible', 'en-curso', 'pospuesta'].includes(e.encuesta.estado) && (!e.encuesta.pospuestaHasta || Date.parse(e.encuesta.pospuestaHasta) <= Date.now());
  const encuestaCompletada = e.encuesta.estado === 'completada';
  const premio = entrevistaPendiente ? e.beneficios.bienvenida : e.beneficios.experiencia;
  const conPremio = (entrevistaPendiente || encuestaDisponible) && beneficioVisible(premio) && premio.estado !== 'otorgado';
  const titulo = entrevistaPendiente ? e.entrevista.estado === 'pendiente' ? 'Tu guía quiere conocerte' : 'Tu guía te está esperando' : encuestaDisponible ? '¿Nos cuentas cómo te ha ido?' : 'Tu ruta de aprendizaje';
  const texto = entrevistaPendiente ? 'Siete preguntas breves para recomendarte por dónde empezar. Puedes continuar después.' : encuestaDisponible ? 'Cinco preguntas sobre tu experiencia. Una opinión positiva o negativa recibe el mismo trato.' : 'Consulta tus recomendaciones y el estado de tus encuestas.';
  return `<section class="experience-card${entrevistaPendiente || encuestaDisponible ? ' experience-card--invite' : ''}"><span class="experience-card__figure" aria-hidden="true"><img src="${IMAGENES_GUIA.saludo}" alt="" loading="lazy"></span><div class="experience-card__body">${conPremio ? `<span class="experience-card__chip">${ic('gift')} ${premio.dias} días VIP${premio.estado === 'demo' ? ' · ejemplo' : ''}</span>` : ''}<h3>${titulo}</h3><p>${texto}${e.fuente === 'demo' ? ' Demostración, sin VIP real.' : ''}</p></div><div class="experience-card__actions"><a class="experience-button" href="${entrevistaPendiente ? '#/bienvenida' : encuestaDisponible ? '#/encuestas' : '#/bienvenida'}">${entrevistaPendiente ? e.entrevista.estado === 'pendiente' ? 'Comenzar' : 'Continuar' : encuestaDisponible ? 'Responder encuesta' : 'Ver mi ruta'} ${ic('arrow-right')}</a>${!entrevistaPendiente ? `<a class="experience-button experience-button--quiet" href="${encuestaDisponible ? '#/bienvenida' : '#/encuestas'}">${encuestaDisponible ? 'Ver mi ruta' : encuestaCompletada ? 'Ver mi encuesta' : 'Estado de encuesta'}</a>` : ''}</div></section>`;
}
export function resumenExperienciaHTML(e = getExperiencia()): string {
  if (!e) return '';
  const r = e.entrevista.respuestas;
  const mostrar = (v: unknown) => Array.isArray(v) ? v.map(x => etiquetas[String(x)] || String(x)).join(', ') : typeof v === 'string' ? etiquetas[v] || v : 'Aún no indicado';
  return `<section class="experience-summary"><div class="experience-summary__head"><h3>Tu ruta de aprendizaje</h3><span>${e.entrevista.estado === 'completada' ? 'Completada' : 'En preparación'}</span></div><dl>${[['Perfil', r.roles], ['Objetivo', r.objetivo], ['Áreas', r.areas], ['Experiencia', r.experiencia], ['Formato', r.formato], ['Tiempo', r.tiempo]].map(([k,v]) => `<dt>${k}</dt><dd>${esc(mostrar(v))}</dd>`).join('')}</dl><div class="experience-footer"><a class="experience-button experience-button--secondary" href="#/bienvenida">${e.entrevista.estado === 'completada' ? 'Ver recomendaciones' : 'Continuar entrevista'}</a><a class="experience-button experience-button--quiet" href="#/encuestas">${e.encuesta.estado === 'completada' ? 'Ver encuesta' : 'Mis encuestas'}</a></div></section>`;
}
function premioHTML(b: BeneficioExperiencia, revelado = false) {
  const motivo = textoMotivo(b.motivo);
  if (!beneficioVisible(b)) return motivo ? `<p class="experience-privacy">${esc(motivo)}</p>` : '';
  const demo = b.estado === 'demo';
  const hasta = b.hasta ? new Date(b.hasta).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  // Boleto: talón a la izquierda (regalo cerrado o los días ya revelados) y cuerpo a la derecha.
  return `<section class="experience-prize${revelado ? ' experience-prize--revealed' : ''}" aria-label="${demo ? 'Beneficio de demostración' : 'Beneficio confirmado por el servidor'}"><div class="experience-prize__stub" aria-hidden="true"><i class="experience-prize__star"></i><i class="experience-prize__star"></i><i class="experience-prize__star"></i>${revelado ? `<b>${b.dias}</b><span>días VIP</span>` : `<span class="experience-prize__seal">${iconoDuotono('gift')}</span>`}</div><div class="experience-prize__body"><span class="experience-prize__tag">${demo ? 'Solo demostración' : b.estado === 'otorgado' ? 'Beneficio otorgado' : 'Beneficio reservado para ti'}</span><h3 class="experience-prize__title">${revelado ? `${b.dias} días VIP${demo ? ' de ejemplo' : ''}` : 'Tienes un regalo por participar'}</h3><p class="experience-prize__note">${revelado ? demo ? 'No se activa VIP. Es una muestra de cómo se vería la entrega.' : hasta ? `Tu acceso VIP está activo hasta el ${esc(hasta)}.` : 'Tu beneficio quedó confirmado. Consulta tu suscripción para revisar el acceso.' : 'Es un premio fijo por responder, no un sorteo. Ábrelo cuando quieras.'}</p>${!revelado ? `<button class="experience-button experience-button--gold" type="button" data-experience-reveal>${ic('gift')} Abrir mi regalo</button>` : ''}${motivo || (b.venceOferta && b.estado === 'reservado') ? `<p class="experience-prize__disclosure">${esc(motivo)}${b.venceOferta && b.estado === 'reservado' ? ` Oferta vigente hasta el ${esc(new Date(b.venceOferta).toLocaleDateString('es-MX'))}.` : ''}</p>` : ''}</div></section>`;
}
function chipPremioHTML(b: BeneficioExperiencia) {
  if (!beneficioVisible(b) || b.estado === 'otorgado') return '';
  return `<span class="experience-chip">${ic('gift')} Al terminar: ${b.dias} días VIP${b.estado === 'demo' ? ' (ejemplo)' : ''}</span>`;
}
function verificacionHTML(final = false) {
  return `<div class="experience-verify" data-experience-verify><span class="experience-verify__icon">${ic('mail-check')}</span><div><strong>Verifica tu correo para recibir tu beneficio</strong><p>Te enviamos un enlace a ${esc(Auth.usuario?.email || 'tu correo')}. Ábrelo y vuelve aquí. ${final ? 'Si terminas sin verificarlo, tu ruta se guarda pero el beneficio no se entrega.' : 'Puedes hacerlo ahora o antes de terminar.'}</p><div class="experience-verify__actions"><button class="experience-button experience-button--secondary" type="button" data-experience-verify-send>${ic('send')} Enviar enlace</button><button class="experience-button experience-button--secondary" type="button" data-experience-verify-check>${ic('refresh-cw')} Ya lo verifiqué</button>${final ? '<button class="experience-button experience-button--quiet" type="button" data-experience-verify-skip>Terminar sin beneficio</button>' : ''}</div><p class="experience-verify__status" data-experience-verify-status role="status" aria-live="polite"></p></div></div>`;
}

/** Mini motor privado: una figura, un reloj, sin historial ni listeners del chat público. */
function montarGuia(root: HTMLElement) {
  const figura = root.querySelector<HTMLElement>('[data-experience-guide]')!;
  const boton = root.querySelector<HTMLButtonElement>('[data-experience-pause]')!;
  const globo = root.querySelector<HTMLElement>('[data-experience-say]')!;
  const fantasma = globo.querySelector<HTMLElement>('[data-experience-say-ghost]')!;
  const escrito = globo.querySelector<HTMLElement>('[data-experience-say-typed]')!;
  const leido = globo.querySelector<HTMLElement>('[data-experience-say-full]')!;
  let escritura: ReturnType<typeof setInterval> | undefined, dicho = '';
  const reducido = matchMedia('(prefers-reduced-motion: reduce)');
  const abortar = new AbortController();
  const id = `experience-guia-${++numeroGuia}`;
  const cargadas = new Set<PosturaGuia>();
  let destruido = false, pausada = false, svg: SVGElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined, frame = 0;
  let gesto: GestoGuia = 'saludo';
  let deseada: PosturaGuia = 'saludo', dibujada: PosturaGuia | null = null;
  try { pausada = sessionStorage.getItem('dermalysse:experiencia:guia-pausada:v1') === '1'; } catch {}
  function detener() { clearTimeout(timer); timer = undefined; }
  function controles() {
    boton.disabled = reducido.matches || !svg;
    boton.setAttribute('aria-pressed', String(pausada));
    boton.setAttribute('aria-label', reducido.matches ? 'Movimiento desactivado por tu preferencia de accesibilidad' : pausada ? 'Reanudar animación de la guía' : 'Pausar animación de la guía');
    boton.innerHTML = `${ic(pausada ? 'play' : 'pause')}<span>${reducido.matches ? 'Sin movimiento' : pausada ? 'Reanudar' : 'Pausar'}</span>`;
    createIcons({ icons });
  }
  function tick() {
    detener();
    if (destruido || !svg) return;
    if (pausada || reducido.matches || document.hidden) { aplicarPose(svg, poseGuia(0, 'reposo', dibujada || 'saludo')); return; }
    aplicarPose(svg, poseGuia(frame / 24, gesto, dibujada || 'saludo')); frame++;
    if (frame >= 72) { frame = 0; gesto = 'reposo'; timer = setTimeout(() => { gesto = 'respuesta'; tick(); }, 14000); }
    else timer = setTimeout(tick, 1000 / 24);
  }
  /** Dibuja la postura deseada si su imagen ya cargó; si no, conserva la actual. */
  function dibujar() {
    if (destruido || dibujada === deseada || !cargadas.has(deseada)) return;
    figura.innerHTML = dibujoGuia(IMAGENES_GUIA[deseada], id, deseada);
    svg = figura.querySelector('svg'); dibujada = deseada; frame = 0; gesto = 'saludo';
    // Pies siempre apoyados en la plataforma, sea cual sea el alto disponible.
    svg?.setAttribute('preserveAspectRatio', 'xMidYMax meet');
    controles(); tick();
  }
  function cargar(postura: PosturaGuia) {
    if (cargadas.has(postura)) { dibujar(); return; }
    const imagen = new Image();
    imagen.onload = () => { if (destruido) return; cargadas.add(postura); dibujar(); };
    imagen.src = IMAGENES_GUIA[postura];
  }
  function postura(p: PosturaGuia) { deseada = p; cargar(p); }
  function decir(texto: string) {
    if (destruido || dicho === texto) return;
    dicho = texto; clearInterval(escritura); globo.classList.remove('is-typing');
    fantasma.textContent = texto; leido.textContent = texto;
    globo.classList.remove('is-fresh'); void globo.offsetWidth; globo.classList.add('is-fresh');
    if (reducido.matches) { escrito.textContent = texto; return; }
    let letras = 0; escrito.textContent = ''; globo.classList.add('is-typing');
    escritura = setInterval(() => {
      letras += 2; escrito.textContent = texto.slice(0, letras);
      if (letras >= texto.length) { clearInterval(escritura); globo.classList.remove('is-typing'); }
    }, 24);
  }
  function responder() {
    if (destruido || pausada || reducido.matches || document.hidden) return;
    // Un gesto a medias se deja terminar; reiniciarlo desde la pose neutra se ve como un salto.
    if (gesto !== 'reposo' && frame > 0 && frame < 72) return;
    frame = 0; gesto = 'respuesta'; tick();
  }
  boton.addEventListener('click', () => { if (reducido.matches) return; pausada = !pausada; try { sessionStorage.setItem('dermalysse:experiencia:guia-pausada:v1', String(pausada ? '1' : '0')); } catch {} frame = 0; gesto = 'reposo'; controles(); tick(); }, { signal: abortar.signal });
  const visibilidad = () => { frame = 0; gesto = 'reposo'; controles(); tick(); };
  document.addEventListener('visibilitychange', visibilidad, { signal: abortar.signal });
  reducido.addEventListener('change', visibilidad);
  cargar('saludo');
  controles();
  return { responder, decir, postura, destruir() { destruido = true; detener(); clearInterval(escritura); abortar.abort(); reducido.removeEventListener('change', visibilidad); } };
}

export function montarExperiencia(): () => void {
  const root = document.querySelector<HTMLElement>('.experience-page[data-experience-flow]');
  if (!root) return () => {};
  if (root.dataset.experienceMontada === '1') return () => {};
  root.dataset.experienceMontada = '1';
  const flujo = root.dataset.experienceFlow as FlujoExperiencia;
  const preguntas = flujo === 'entrevista' ? ENTREVISTA : ENCUESTA;
  const tipoBeneficio = flujo === 'entrevista' ? 'bienvenida' : 'experiencia';
  const contenido = root.querySelector<HTMLElement>('[data-experience-content]')!;
  const guia = montarGuia(root);
  const abortar = new AbortController();
  // El fondo del documento acompaña al escenario para que no asome el color claro del club.
  document.documentElement.classList.add('experience-full');
  let destruido = false, dto = getExperiencia();
  let paso = Math.min(preguntas.length - 1, dto?.[flujo].paso || 0);
  let borrador: Record<string, unknown> = structuredClone(dto?.[flujo].respuestas || {});
  let edicion = 0, guardada = 0, ocupado = false, revelado = false, sinBeneficio = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let guardando: Promise<void> | null = null;
  function estadoGuardado(texto: string, error = false) { const s = contenido.querySelector<HTMLElement>('[data-experience-save]'); if (s) { s.textContent = texto; s.classList.toggle('is-error', error); } }
  function error(texto: string) { const e = contenido.querySelector<HTMLElement>('[data-experience-error]'); if (e) { e.textContent = texto; e.hidden = false; } }
  function limpiarError() { const e = contenido.querySelector<HTMLElement>('[data-experience-error]'); if (e) e.hidden = true; }
  function enfocarPregunta() { contenido.querySelector<HTMLElement>('[data-experience-question] h2')?.focus({ preventScroll: true }); }
  function mensajeErrorLocal(e: unknown) { return (e as { status?: number })?.status === 409 ? 'Tu cuenta se actualizó en otro lugar. Conservamos lo que escribiste; vuelve a pulsar Continuar para guardarlo con la revisión actual.' : mensajeError(e); }
  /** El beneficio existe pero el servidor no lo entregará mientras el correo siga sin verificar. */
  function faltaVerificar() { return !!dto && dto.fuente === 'api' && dto.beneficios[tipoBeneficio].motivo === 'correo-no-verificado'; }
  async function guardar() {
    clearTimeout(timer);
    if (guardando) { await guardando; if (guardada !== edicion) await guardar(); return; }
    if (guardada === edicion) return;
    const version = edicion, respuestas = structuredClone(borrador), pasoGuardado = paso;
    estadoGuardado('Guardando tu avance…'); limpiarError();
    const tarea = (async () => {
      try {
        const nuevo = await guardarRespuestasExperiencia(flujo, pasoGuardado, respuestas);
        if (destruido) return;
        dto = nuevo; guardada = version; estadoGuardado('Tu avance está guardado.');
      } catch (e) {
        if (!destruido) { dto = getExperiencia() || dto; estadoGuardado('No se pudo guardar todavía.', true); error(mensajeErrorLocal(e)); }
        throw e;
      }
    })();
    guardando = tarea;
    try { await tarea; } finally { if (guardando === tarea) guardando = null; }
    if (!destruido && guardada !== edicion) await guardar();
  }
  function cambio() { edicion++; estadoGuardado('Cambio pendiente de guardar…'); clearTimeout(timer); timer = setTimeout(() => { void guardar().catch(() => {}); }, 550); }
  function opcion(v: string, p: PreguntaExperiencia, i: number) {
    const actual = borrador[p.clave]; const elegida = p.multiple ? Array.isArray(actual) && actual.includes(v) : actual === v;
    // En «origen» todas las fichas van como icono de app: fondo de color y glifo blanco.
    const logo = p.clave === 'origen' ? logoMarca(v) || { fondo: FONDOS_ORIGEN[v] || '#0b2435', svg: iconoDuotono(iconosOpcion[v] || 'sparkle') } : null;
    const icono = logo ? logo.svg : iconoDuotono(p.clave === 'areas' ? iconosArea[v] || 'leaf' : iconosOpcion[v] || 'sparkle');
    const estilo = logo ? ` style="--marca:${logo.fondo}"` : '';
    return `<button type="button" class="experience-option${p.multiple ? ' experience-option--multi' : ''}" style="--i:${i}" data-experience-option="${esc(v)}" aria-pressed="${elegida}"><span class="experience-option__icon${logo ? ` experience-option__icon--brand${logo.fondo === '#ffffff' ? ' is-light' : ''}` : ''}"${estilo} aria-hidden="true">${icono}</span><span class="experience-option__label">${esc(etiquetas[v] || v)}</span><span class="experience-option__mark" aria-hidden="true">${elegida ? ic('check') : i < 9 ? `<kbd>${i + 1}</kbd>` : ''}</span></button>`;
  }
  function ramas() {
    const roles = Array.isArray(borrador.roles) ? borrador.roles : [];
    let html = '';
    if (roles.includes('estudiante')) html += `<label class="experience-field">¿Qué estudias? <span>Opcional</span><input name="carrera" data-experience-field maxlength="80" value="${esc(borrador.carrera)}" placeholder="Por ejemplo, Cosmetología o Estética"></label><label class="experience-field">¿En qué etapa estás? <span>Opcional</span><select name="etapa" data-experience-field><option value="">Prefiero indicarlo después</option>${['iniciando','intermedia','final','egresado'].map(v => `<option value="${v}"${borrador.etapa === v ? ' selected' : ''}>${etiquetas[v]}</option>`).join('')}</select></label>`;
    if (roles.includes('productor')) html += `<label class="experience-field">¿Cuál es tu actividad principal? <span>Opcional; en la siguiente parte puedes elegir áreas y especies.</span><input name="actividad" data-experience-field maxlength="80" value="${esc(borrador.actividad)}" placeholder="Por ejemplo, producción de leche"></label>`;
    return html ? `<div class="experience-branch"><p class="experience-branch__title">Si quieres, cuéntame un poco más</p>${html}</div>` : '';
  }
  function pasosHTML() {
    return `<div class="experience-progress"><div class="experience-progress__meta"><span class="experience-progress__num"><b>${String(paso + 1).padStart(2, '0')}</b><i>/ ${String(preguntas.length).padStart(2, '0')}</i><span>Pregunta</span></span>${dto ? chipPremioHTML(dto.beneficios[tipoBeneficio]) : ''}</div><div class="experience-steps" role="progressbar" aria-label="Avance" aria-valuemin="0" aria-valuemax="${preguntas.length}" aria-valuenow="${paso}">${preguntas.map((_, i) => `<span class="${i < paso ? 'is-done' : i === paso ? 'is-current' : ''}"></span>`).join('')}</div></div>`;
  }
  /** `entrar` anima la llegada de una pregunta nueva; elegir una opción repinta sin parpadeo. */
  function pintarPregunta(entrar = false) {
    if (!dto) return;
    const p = preguntas[paso];
    const opciones = p.clave === 'areas' ? dto.areas : p.opciones || [];
    guia.postura('orientar'); guia.decir(p.voz);
    contenido.innerHTML = `${pasosHTML()}
      <div class="experience-question${entrar ? ' is-entering' : ''}" data-experience-question><p class="experience-kicker">${p.opcional ? 'Opcional · puedes saltarla' : p.multiple ? 'Elige hasta tres' : 'Elige una opción'}</p><h2 id="experience-question-title" tabindex="-1">${p.titulo}</h2><p class="experience-question__hint">${p.ayuda}</p>
      ${p.escala ? `<div class="experience-rating" role="group" aria-labelledby="experience-question-title">${[1,2,3,4,5].map(v => `<button class="experience-option" style="--i:${v - 1}" type="button" data-experience-rating="${v}" aria-pressed="${borrador[p.clave] === v}" aria-label="${v} de 5">${v}</button>`).join('')}</div><div class="experience-rating__legend"><span>${p.clave === 'facilidad' ? 'Muy difícil' : 'Poco útil'}</span><span>${p.clave === 'facilidad' ? 'Muy fácil' : 'Muy útil'}</span></div><button class="experience-button experience-button--quiet" type="button" data-experience-rating="0" aria-pressed="${borrador[p.clave] === 0}">Todavía no puedo evaluarlo ${borrador[p.clave] === 0 ? ic('check') : ''}</button>` : p.texto ? `<label class="experience-field">${p.clave === 'tema' ? 'El tema que te interesa' : 'Tu comentario'} <span>Opcional · máximo ${p.texto} caracteres</span><textarea name="${p.clave}" data-experience-field maxlength="${p.texto}" rows="4">${esc(borrador[p.clave])}</textarea></label>` : opciones.length ? `<div class="experience-options" role="group" aria-labelledby="experience-question-title">${opciones.map((v, i) => opcion(v, p, i)).join('')}</div>` : `<p class="experience-empty">No hay áreas verificadas disponibles. Puedes continuar cuando se recupere el catálogo.</p>`}
      <div data-experience-branch>${flujo === 'entrevista' && paso === 0 ? ramas() : ''}</div></div><div data-experience-verify-slot></div><div class="experience-error" role="alert" data-experience-error hidden></div>
      <footer class="experience-footer"><div class="experience-footer__secondary">${paso ? `<button class="experience-button experience-button--secondary" type="button" data-experience-back>${ic('arrow-left')} Atrás</button>` : ''}<button class="experience-button experience-button--quiet" type="button" data-experience-later>Ahora no</button></div><button class="experience-button experience-button--main" type="button" data-experience-next>${paso === preguntas.length - 1 ? 'Terminar' : p.opcional ? 'Continuar o saltar' : 'Continuar'} ${ic('arrow-right')}</button></footer><div class="experience-foot"><span class="experience-keys" aria-hidden="true">${p.texto ? '' : `<kbd>1</kbd>–<kbd>${p.escala ? 5 : Math.min(9, opciones.length)}</kbd> elegir · `}<kbd>Enter</kbd> continuar</span><div class="experience-save" role="status" aria-live="polite" data-experience-save>Tu avance se guarda en tu cuenta.</div></div>`;
    createIcons({ icons });
  }
  function introduccion() {
    if (!dto) return;
    const beneficio = dto.beneficios.bienvenida;
    const premio = beneficioVisible(beneficio);
    guia.postura('saludo');
    guia.decir(`¡Hola${Auth.usuario?.nombre && dto.fuente === 'api' ? `, ${Auth.usuario.nombre.split(' ')[0]}` : ''}! Soy tu guía Dermalysse. Quiero conocerte un poquito para recomendarte por dónde empezar.`);
    contenido.innerHTML = `<div class="experience-intro"><p class="experience-kicker">${ic('clock-3')} Bienvenida · 2 minutos</p><h2 class="experience-intro__title">Una ruta <em>pensada para ti</em></h2><p class="experience-lead">Siete preguntas breves, una a la vez. No tienes que volver a escribir tu nombre, correo ni WhatsApp, y puedes continuar después.</p>
      <ul class="experience-perks${premio ? '' : ' experience-perks--two'}"><li style="--i:0"><span class="experience-perks__big">7</span><strong>preguntas</strong><small>de opción rápida</small></li><li style="--i:1"><span class="experience-perks__big">${iconoDuotono('compass')}</span><strong>Cursos para ti</strong><small>según lo que te interesa</small></li>${premio ? `<li class="is-prize" style="--i:2"><span class="experience-perks__big">${beneficio.dias}</span><strong>días VIP${beneficio.estado === 'demo' ? ' · ejemplo' : ''}</strong><small>${beneficio.estado === 'demo' ? 'demostración, no activa acceso' : 'de regalo al terminar'}</small></li>` : ''}</ul>
      ${faltaVerificar() ? verificacionHTML() : !premio && textoMotivo(beneficio.motivo) ? `<p class="experience-privacy">${esc(textoMotivo(beneficio.motivo))}</p>` : ''}
      <label class="experience-consent"><input type="checkbox" data-experience-consent><span class="experience-consent__box" aria-hidden="true">${ic('check')}</span><span>Acepto guardar mis respuestas y registrar mis días de actividad para personalizar mi experiencia. Esto no me suscribe a mensajes de marketing.</span></label>
      <details class="experience-privacy-details"><summary>Cómo usamos tus respuestas</summary><p>Las guardamos en tu cuenta para orientar cursos, conocer cómo llegaste y mejorar el servicio. Después de tu aceptación registramos días de actividad para saber cuándo invitarte a la encuesta; no medimos el tiempo exacto que pasas mirando videos.</p><p>El administrador puede consultar un resumen de tu ruta y resultados agrupados de las encuestas, no opiniones individuales. Estas respuestas no se venden ni te suscriben a marketing.</p></details><div class="experience-error" role="alert" data-experience-error hidden></div><footer class="experience-footer"><a class="experience-button experience-button--quiet" href="#/">Ahora no</a><button class="experience-button experience-button--main" type="button" data-experience-start>Empezar ${ic('arrow-right')}</button></footer></div>`;
    createIcons({ icons });
  }
  function resultado() {
    if (!dto) return;
    const cursos = dto.recomendaciones;
    const beneficio = dto.beneficios[tipoBeneficio];
    guia.postura('celebrar');
    guia.decir(revelado && beneficioVisible(beneficio) ? '¡Disfrútalo! Te lo ganaste por participar.' : flujo === 'entrevista' ? '¡Listo! Ya sé por dónde puedes empezar.' : '¡Gracias! Tu opinión nos ayuda a mejorar.');
    contenido.innerHTML = `<div class="experience-result"><p class="experience-kicker experience-kicker--done">${ic('circle-check-big')} ${flujo === 'entrevista' ? 'Bienvenida completada' : 'Encuesta completada'}</p><h2 tabindex="-1">${flujo === 'entrevista' ? 'Tu punto de partida <em>está listo</em>' : 'Gracias por <em>contarnos</em>'}</h2><p class="experience-lead">${flujo === 'entrevista' ? 'Guardamos tus preferencias. Estas sugerencias vienen del catálogo disponible; verlas no cambia el acceso de tu plan.' : 'Tu opinión quedó registrada. Valoramos igual las respuestas positivas, las negativas y «todavía no puedo evaluarlo».'}</p>${premioHTML(beneficio, revelado)}${flujo === 'entrevista' ? cursos.length ? `<h3 class="experience-result__subtitle">Te recomiendo empezar por aquí</h3><div class="experience-recommendations">${cursos.slice(0,4).map(c => `<a class="experience-course" href="#/curso/${encodeURIComponent(c.id)}"><img src="${esc(c.portada)}" alt="" loading="lazy"><div class="experience-course__body"><span class="experience-course__area">${esc(c.area)} · ${esc(c.nivel)}</span><h3>${esc(c.titulo)}</h3><span class="experience-course__action">Conocer curso ${ic('arrow-right')}</span></div></a>`).join('')}</div>` : '<p class="experience-privacy">No encontramos una recomendación verificada para tus áreas por ahora. Puedes explorar el catálogo completo.</p>' : ''}<div class="experience-footer"><a class="experience-button experience-button--secondary" href="${flujo === 'entrevista' ? '#/encuestas' : '#/bienvenida'}">${flujo === 'entrevista' ? 'Mis encuestas' : 'Ver mi ruta'}</a><a class="experience-button experience-button--main" href="#/cursos">Explorar cursos ${ic('arrow-right')}</a></div></div>`;
    createIcons({ icons });
  }
  function bloqueada() {
    if (!dto) return;
    guia.postura('saludo'); guia.decir('Todavía es pronto. Primero disfruta el club y luego me cuentas cómo te fue.');
    contenido.innerHTML = `<div class="experience-empty"><p class="experience-kicker">${ic('hourglass')} Todavía no</p><h2>Primero <em>conoce el club</em></h2><p>${esc(textoMotivo(dto.encuesta.motivo) || 'La encuesta aparecerá cuando tengas experiencia suficiente para contarnos cómo te fue.')}</p><p>No tienes que evaluarlo antes de usarlo. Aquí podrás retomarla cuando esté disponible.</p><a class="experience-button experience-button--main" href="#/cursos">Explorar cursos ${ic('arrow-right')}</a>${puedePrevisualizarEncuestaDemo() ? '<button class="experience-button experience-button--secondary" type="button" data-experience-preview>Previsualizar encuesta · solo demostración</button><p>Control de desarrollo: no acredita uso real ni activa VIP.</p>' : ''}</div>`;
    createIcons({ icons });
  }
  /** Refleja la elección en las fichas sin repintar la pregunta: conserva el foco y no reanima lo ya elegido. */
  function actualizarSeleccion(p: PreguntaExperiencia) {
    const valor = borrador[p.clave];
    contenido.querySelectorAll<HTMLButtonElement>('[data-experience-option]').forEach((b, i) => {
      const v = b.dataset.experienceOption!;
      const elegida = p.multiple ? Array.isArray(valor) && valor.includes(v) : valor === v;
      if (b.getAttribute('aria-pressed') === String(elegida)) return;
      b.setAttribute('aria-pressed', String(elegida));
      b.querySelector('.experience-option__mark')!.innerHTML = elegida ? ic('check') : i < 9 ? `<kbd>${i + 1}</kbd>` : '';
    });
    contenido.querySelectorAll<HTMLButtonElement>('[data-experience-rating]').forEach(b => {
      const v = Number(b.dataset.experienceRating), elegida = valor === v;
      if (b.getAttribute('aria-pressed') === String(elegida)) return;
      b.setAttribute('aria-pressed', String(elegida));
      if (v === 0) b.innerHTML = `Todavía no puedo evaluarlo ${elegida ? ic('check') : ''}`;
    });
    const rama = contenido.querySelector<HTMLElement>('[data-experience-branch]');
    if (rama && flujo === 'entrevista' && paso === 0) {
      const roles = Array.isArray(borrador.roles) ? borrador.roles : [];
      const firma = `${roles.includes('estudiante')}:${roles.includes('productor')}`;
      if (rama.dataset.firma !== firma) { rama.dataset.firma = firma; rama.innerHTML = ramas(); }
    }
    limpiarError(); createIcons({ icons });
  }
  function pintar() { if (!dto) return; if (dto[flujo].estado === 'completada') resultado(); else if (flujo === 'entrevista' && dto.entrevista.estado === 'pendiente') introduccion(); else if (flujo === 'encuesta' && dto.encuesta.estado === 'bloqueada') bloqueada(); else pintarPregunta(true); }
  function validarPregunta() {
    const p = preguntas[paso], valor = borrador[p.clave];
    if (p.opcional) return true;
    if (p.escala) return Number.isInteger(valor) && Number(valor) >= 0 && Number(valor) <= 5;
    if (p.multiple) return Array.isArray(valor) && valor.length > 0 && valor.length <= 3;
    return typeof valor === 'string' && !!valor;
  }
  function estadoVerificacion(texto: string) { const s = contenido.querySelector<HTMLElement>('[data-experience-verify-status]'); if (s) s.textContent = texto; }
  async function accion(tarea: () => Promise<void>) {
    if (ocupado) return;
    ocupado = true;
    contenido.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('button[data-experience-start], button[data-experience-next], button[data-experience-back], button[data-experience-later], button[data-experience-preview], button[data-experience-retry], [data-experience-verify] button, [data-experience-field]').forEach(b => b.disabled = true);
    try { await tarea(); }
    catch (e) { if (!destruido) { error(mensajeErrorLocal(e)); estadoGuardado('No se pudo guardar todavía.', true); } }
    finally { ocupado = false; if (!destruido) contenido.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('button, [data-experience-field]').forEach(b => b.disabled = false); }
  }
  async function terminar() {
    await guardar(); if (destruido) return;
    dto = await completarExperiencia(flujo); if (destruido) return;
    resultado(); contenido.querySelector<HTMLElement>('h2')?.focus({ preventScroll:true });
    celebrar('normal'); guia.responder();
  }
  root.addEventListener('input', e => {
    const campo = (e.target as HTMLElement).closest<HTMLInputElement | HTMLTextAreaElement>('[data-experience-field]');
    if (!campo || ocupado) return;
    borrador[campo.name] = campo.value; cambio();
  }, { signal: abortar.signal });
  root.addEventListener('change', e => {
    const campo = (e.target as HTMLElement).closest<HTMLSelectElement>('select[data-experience-field]');
    if (!campo || ocupado) return;
    if (campo.value) borrador[campo.name] = campo.value; else delete borrador[campo.name]; cambio();
  }, { signal: abortar.signal });
  root.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-experience-retry]')) { void accion(async () => { dto = await cargarExperiencia(true); if (destruido) return; borrador = structuredClone(dto[flujo].respuestas); paso = Math.min(preguntas.length - 1,dto[flujo].paso); contenido.innerHTML = ''; pintar(); }); return; }
    if (!dto || ocupado) return;
    const seleccion = target.closest<HTMLButtonElement>('[data-experience-option], [data-experience-rating]');
    if (seleccion) {
      const p = preguntas[paso];
      if (p.escala) borrador[p.clave] = Number(seleccion.dataset.experienceRating);
      else if (p.multiple) {
        const v = seleccion.dataset.experienceOption!;
        let valores = Array.isArray(borrador[p.clave]) ? [...borrador[p.clave] as string[]] : [];
        if (valores.includes(v)) valores = valores.filter(x => x !== v);
        else if (v === 'prefiero-no-decir') valores = [v];
        else { valores = valores.filter(x => x !== 'prefiero-no-decir'); if (valores.length >= 3) { error('Puedes elegir hasta tres opciones. Quita una para seleccionar otra.'); return; } valores.push(v); }
        borrador[p.clave] = valores;
      } else borrador[p.clave] = seleccion.dataset.experienceOption;
      // Elegir no interrumpe a la guía: solo reacciona al avanzar o terminar.
      actualizarSeleccion(p); cambio(); return;
    }
    if (target.closest('[data-experience-verify-send]')) {
      void accion(async () => { const enviado = await Auth.enviarVerificacion(); if (!destruido) estadoVerificacion(enviado ? 'Enlace enviado. Revisa tu bandeja de entrada y la carpeta de correo no deseado.' : 'No pudimos enviar el enlace. Intenta de nuevo en un momento.'); }); return;
    }
    if (target.closest('[data-experience-verify-check]')) {
      void accion(async () => {
        const verificado = await Auth.correoVerificado(); if (destruido) return;
        if (!verificado) { estadoVerificacion('Tu correo aún aparece sin verificar. Abre el enlace que te enviamos y vuelve a intentarlo.'); return; }
        dto = await cargarExperiencia(true); if (destruido) return;
        pintar();
      }); return;
    }
    if (target.closest('[data-experience-verify-skip]')) { sinBeneficio = true; void accion(terminar); return; }
    if (target.closest('[data-experience-start]')) {
      if (!contenido.querySelector<HTMLInputElement>('[data-experience-consent]')?.checked) { error('Marca la casilla de aceptación para empezar a guardar tus respuestas.'); return; }
      void accion(async () => { dto = await iniciarExperiencia(); if (destruido) return; pintar(); enfocarPregunta(); guia.responder(); }); return;
    }
    if (target.closest('[data-experience-next]')) {
      if (!validarPregunta()) { error('Elige una respuesta para continuar. Puedes hacerlo después con «Ahora no».'); return; }
      if (paso === preguntas.length - 1 && faltaVerificar() && !sinBeneficio) {
        const hueco = contenido.querySelector<HTMLElement>('[data-experience-verify-slot]');
        if (hueco && !hueco.firstElementChild) { hueco.innerHTML = verificacionHTML(true); createIcons({ icons }); }
        hueco?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return;
      }
      void accion(async () => {
        if (paso === preguntas.length - 1) { await terminar(); return; }
        await guardar(); if (destruido) return;
        paso++; edicion++; await guardar(); if (destruido) return; pintarPregunta(true); enfocarPregunta();
        guia.responder();
      }); return;
    }
    if (target.closest('[data-experience-back]')) { void accion(async () => { await guardar(); if (destruido) return; paso = Math.max(0,paso-1); edicion++; await guardar(); if (destruido) return; pintarPregunta(true); enfocarPregunta(); }); return; }
    if (target.closest('[data-experience-later]')) { void accion(async () => { await guardar(); if (destruido) return; dto = await posponerExperiencia(flujo); if (!destruido) location.hash = '#/'; }); return; }
    if (target.closest('[data-experience-preview]')) { void accion(async () => { dto = await previsualizarEncuestaDemo(); if (destruido) return; pintar(); enfocarPregunta(); }); return; }
    if (target.closest('[data-experience-reveal]')) { revelado = true; resultado(); contenido.querySelector<HTMLElement>('.experience-prize')?.setAttribute('tabindex','-1'); contenido.querySelector<HTMLElement>('.experience-prize')?.focus({ preventScroll:true }); celebrar('grande'); guia.responder(); }
  }, { signal: abortar.signal });
  const escenario = root.querySelector<HTMLElement>('.experience-stage');
  if (escenario && matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let cuadro = 0;
    escenario.addEventListener('pointermove', e => {
      if (cuadro) return;
      cuadro = requestAnimationFrame(() => {
        cuadro = 0;
        const r = escenario.getBoundingClientRect();
        escenario.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`);
        escenario.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
      });
    }, { signal: abortar.signal, passive: true });
  }
  // Atajos: 1–9 eligen una opción y Enter continúa. Nunca interceptan lo que se escribe en un campo.
  document.addEventListener('keydown', e => {
    if (destruido || ocupado || !dto || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const origen = e.target as HTMLElement | null;
    if (origen?.closest?.('input, textarea, select, [contenteditable], dialog')) return;
    if (/^[1-9]$/.test(e.key)) {
      const boton = contenido.querySelectorAll<HTMLButtonElement>('[data-experience-option], [data-experience-rating]:not([data-experience-rating="0"])')[Number(e.key) - 1];
      if (!boton) return;
      e.preventDefault(); boton.click();
    } else if (e.key === 'Enter' && !origen?.closest?.('button, a, summary, label')) {
      const seguir = contenido.querySelector<HTMLButtonElement>('[data-experience-next], [data-experience-start]');
      if (seguir && !seguir.disabled) { e.preventDefault(); seguir.click(); }
    }
  }, { signal: abortar.signal });
  pintar();
  return () => {
    // Vaciar el último cambio también si la navegación ocurre antes del debounce.
    // Las respuestas tardías no vuelven a montar ni enfocan una pantalla retirada.
    clearTimeout(timer);
    if (guardada !== edicion) void guardar().catch(() => {});
    destruido = true; abortar.abort(); guia.destruir(); delete root.dataset.experienceMontada;
    document.documentElement.classList.remove('experience-full');
  };
}
