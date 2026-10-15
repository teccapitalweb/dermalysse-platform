// Reproductor de clase en modo API: video firmado de Bunny Stream + avance real.
// 1. POST /video/token {cursoId, n} → {embedUrl, preview, playbackSessionId}; 403 → {motivo, desbloqueo}.
// 2. El iframe de Bunny habla player.js por postMessage; aquí hay un receptor mínimo sin dependencias
//    (solo acepta mensajes del iframe y del origen exacto del embedUrl).
// 3. timeupdate (cada ~15 s), pause y ended → POST /progreso/:cursoId/evento. El servidor acredita.
import { createIcons, icons } from 'lucide';
import { api, mensajeError } from '../core/auth';
import { Progreso } from '../core/progreso';
import { esc } from './partials';
import {
  clasificarBloqueo, crearReportadorProgreso, leerMensajePlayerJs, mensajePlayerJs,
  type BloqueoVideo, type EventoVideo, type PosicionVideo,
} from '../core/video-progreso';

interface TokenVideo { embedUrl?: string; expires?: number | string; preview?: boolean; playbackSessionId?: string | null }
export interface RespuestaEvento { completada: boolean; ratio?: number; vistas?: number[]; porcentaje?: number }

export interface Reproductor {
  desmontar(): void;
  /** Salta a un segundo del video con player.js. false si el reproductor aún no responde. */
  buscar(segundos: number): boolean;
}

interface Opciones {
  toast: (mensaje: string, icono?: string) => void;
  /** La clase `n` quedó acreditada por el servidor (primera vez en esta sesión). */
  alAcreditar: (cursoId: string, n: number, respuesta: RespuestaEvento, evento: EventoVideo) => void;
}

const EVENTOS: EventoVideo[] = ['timeupdate', 'pause', 'ended'];
const LISTENER = (ev: string) => `drm-${ev}`;
const ESPERA_READY_MS = 2500;

function estadoHTML(icono: string, titulo: string, texto: string, accion = '') {
  return `<div class="player-estado" role="status"><span class="player-estado__ic"><i data-lucide="${esc(icono)}" class="i"></i></span><strong>${esc(titulo)}</strong><p>${esc(texto)}</p>${accion}</div>`;
}

const fechaLarga = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

function bloqueoHTML(b: BloqueoVideo, cursoId: string) {
  switch (b.tipo) {
    case 'membresia':
      return estadoHTML('crown', 'Clase para miembros VIP', 'Esta clase requiere una membresía activa. La primera clase de cada curso es abierta.',
        `<button type="button" class="btn btn--brand" data-paywall="Esta clase es para miembros VIP.">Ver planes</button>`);
    case 'clase_anterior':
      return estadoHTML('lock', 'Completa la clase anterior', b.clase ? `Termina la clase ${b.clase} para desbloquear esta. El avance se acredita al reproducir la clase.` : 'Termina la clase anterior para desbloquear esta.',
        b.clase ? `<a class="btn btn--brand" href="#/curso/${esc(encodeURIComponent(cursoId))}/clase/${b.clase}">Ir a la clase ${b.clase}</a>` : '');
    case 'no_liberado':
      return estadoHTML('calendar-clock', 'Este curso aún no se libera',
        b.fecha ? `Se abre el ${fechaLarga(b.fecha)}.` : b.dias ? `Se abre en ${b.dias} ${b.dias === 1 ? 'día' : 'días'}.` : b.mensaje || 'Estará disponible pronto. Te avisaremos cuando se abra.');
    case 'sesion':
      return estadoHTML('log-in', 'Tu sesión expiró', 'Vuelve a iniciar sesión para ver la clase.', `<button type="button" class="btn btn--brand" data-salir>Iniciar sesión de nuevo</button>`);
    case 'sin_video':
      return estadoHTML('clapperboard', 'Video en preparación', 'El video de esta clase se publica cuando el equipo académico de Dermalysse termina de revisarlo.');
    default:
      return estadoHTML('circle-alert', 'No se pudo cargar el video', b.mensaje || 'Revisa tu conexión e intenta de nuevo.', `<button type="button" class="btn btn--brand" data-video-reintentar>Reintentar</button>`);
  }
}

export function montarReproductorApi(contenedor: HTMLElement, op: Opciones): Reproductor {
  const [cursoId, nTexto] = (contenedor.dataset.videoApi || '').split(':');
  const n = Number(nTexto);
  const estado = document.querySelector<HTMLElement>('[data-video-estado]');
  let activo = true;
  let iframe: HTMLIFrameElement | null = null;
  let origen = '';
  let listoPlayer = false;
  let esperaReady: ReturnType<typeof setTimeout> | undefined;
  let acreditada = Progreso.de(cursoId).vistas.includes(n);
  let reportador: ReturnType<typeof crearReportadorProgreso<RespuestaEvento>> | null = null;

  const ponerEstado = (texto: string, tono: 'info' | 'ok' | 'aviso' = 'info') => {
    if (!estado || !activo) return;
    estado.textContent = texto;
    estado.dataset.tono = tono;
    estado.hidden = !texto;
  };
  const pintar = (html: string) => { if (!activo) return; contenedor.innerHTML = html; createIcons({ icons }); };

  const enviarPlayer = (method: string, value?: unknown, listener?: string) => {
    if (!iframe?.contentWindow || !origen) return;
    iframe.contentWindow.postMessage(mensajePlayerJs(method, value, listener), origen);
  };
  const suscribir = () => {
    for (const ev of EVENTOS) {
      enviarPlayer('removeEventListener', ev, LISTENER(ev));
      enviarPlayer('addEventListener', ev, LISTENER(ev));
    }
  };

  const alMensaje = (e: MessageEvent) => {
    if (!activo || !iframe || e.source !== iframe.contentWindow || e.origin !== origen) return;
    const m = leerMensajePlayerJs(e.data);
    if (!m) return;
    if (m.event === 'ready') { listoPlayer = true; clearTimeout(esperaReady); suscribir(); return; }
    if (m.event === 'error') { ponerEstado('El reproductor reportó un error. Si el video no avanza, recarga la página.', 'aviso'); return; }
    if (reportador && (m.event === 'timeupdate' || m.event === 'pause' || m.event === 'ended')) reportador.evento(m.event, m.value);
  };

  const alResultado = (r: RespuestaEvento, evento: EventoVideo) => {
    if (Array.isArray(r.vistas)) Progreso.sincronizarCurso(cursoId, r.vistas);
    if (!activo) return;
    if (r.completada) {
      ponerEstado('Clase acreditada. Tu avance quedó guardado.', 'ok');
      if (!acreditada) { acreditada = true; op.alAcreditar(cursoId, n, r, evento); }
      return;
    }
    const pct = Math.max(0, Math.min(100, Math.round((Number(r.ratio) || 0) * 100)));
    ponerEstado(`${pct} % visto · la clase se acredita al llegar al 85 %.`);
    if (evento === 'ended') op.toast('Reproduce al menos el 85 % de la clase para acreditarla.', 'circle-alert');
  };

  const alError = (err: any) => {
    if (!activo) return;
    if (err?.status === 403 || err?.status === 402) {
      const b = clasificarBloqueo(err.status, err.datos, n);
      ponerEstado(b.tipo === 'membresia' ? 'Tu avance se registra cuando tienes una membresía activa.' : b.mensaje || 'El servidor no permitió registrar el avance de esta clase.', 'aviso');
      return;
    }
    ponerEstado(`No se pudo guardar tu avance (${mensajeError(err)}). Lo intentaremos de nuevo mientras reproduces.`, 'aviso');
  };

  async function cargar() {
    pintar(estadoHTML('loader-circle', 'Preparando reproducción segura…', 'Verificamos tu acceso a esta clase.'));
    ponerEstado('');
    let token: TokenVideo;
    try { token = await api<TokenVideo>('/video/token', { method: 'POST', json: { cursoId, n } }); }
    catch (err: any) {
      if (!activo) return;
      const b = err?.status ? clasificarBloqueo(err.status, err.datos, n) : { tipo: 'otro' as const, mensaje: mensajeError(err) };
      pintar(bloqueoHTML(b, cursoId));
      return;
    }
    if (!activo) return;
    let url: URL | null = null;
    try { url = token.embedUrl ? new URL(token.embedUrl) : null; } catch { url = null; }
    if (!url || url.protocol !== 'https:') { pintar(bloqueoHTML({ tipo: 'sin_video' }, cursoId)); return; }

    origen = url.origin;
    window.addEventListener('message', alMensaje);
    iframe = document.createElement('iframe');
    iframe.dataset.video = `${cursoId}:${n}`;
    iframe.title = 'Video de la clase';
    iframe.setAttribute('allow', 'accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen');
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.className = 'player-api__iframe';
    // Si el reproductor anunció «ready» antes de que llegara este receptor, se suscribe igual tras la carga.
    iframe.addEventListener('load', () => {
      listoPlayer = false;
      clearTimeout(esperaReady);
      esperaReady = setTimeout(() => { if (activo && !listoPlayer) suscribir(); }, ESPERA_READY_MS);
    });
    contenedor.innerHTML = '';
    contenedor.appendChild(iframe);
    iframe.src = url.toString();

    if (!token.playbackSessionId) {
      ponerEstado(token.preview
        ? 'Clase abierta: puedes verla completa. El avance y el certificado se registran con una membresía activa.'
        : 'Esta reproducción no registra avance. Si eres miembro y ves este mensaje, recarga la página.', 'aviso');
      return;
    }
    const sesion = token.playbackSessionId;
    reportador = crearReportadorProgreso<RespuestaEvento>({
      enviar: (evento: EventoVideo, posicion: PosicionVideo) => api<RespuestaEvento>(`/progreso/${encodeURIComponent(cursoId)}/evento`, {
        method: 'POST',
        keepalive: true,
        json: { n, playbackSessionId: sesion, positionSeconds: Math.round(posicion.seconds * 10) / 10, durationSeconds: Math.round(posicion.duration * 10) / 10, event: evento },
      }),
      alResultado,
      alError,
    });
    ponerEstado(acreditada ? 'Ya acreditaste esta clase. Puedes repasarla cuando quieras.' : 'Reproduce al menos el 85 % de la clase para acreditarla.', acreditada ? 'ok' : 'info');
  }

  const alClic = (e: Event) => {
    if ((e.target as HTMLElement).closest('[data-video-reintentar]')) { e.preventDefault(); void cargar(); }
  };
  // Al cerrar o cambiar de pestaña: reporta la última posición sin detener el seguimiento (bfcache).
  const alSalir = () => { reportador?.evento('pause'); };
  contenedor.addEventListener('click', alClic);
  window.addEventListener('pagehide', alSalir);
  void cargar();

  return {
    desmontar() {
      if (!activo) return;
      reportador?.detener();
      activo = false;
      clearTimeout(esperaReady);
      window.removeEventListener('message', alMensaje);
      window.removeEventListener('pagehide', alSalir);
      contenedor.removeEventListener('click', alClic);
    },
    buscar(segundos: number) {
      if (!activo || !iframe || !listoPlayer) return false;
      enviarPlayer('setCurrentTime', Math.max(0, segundos));
      enviarPlayer('play');
      iframe.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    },
  };
}
