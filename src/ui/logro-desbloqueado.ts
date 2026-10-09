import { createIcons, icons } from 'lucide';
import { logros, type Logro } from '../core/logros';
import { celebrar } from './celebracion';
import { esc } from './partials';

const SONIDO_KEY = 'dermalysse:logros-sonido:v1';
const VISTOS_KEY = 'dermalysse:logros-vistos:v2';
let usuario = '';
let instalado = false;
let mostrando = false;
const cola: Logro[] = [];

const llaveVistos = () => `${VISTOS_KEY}:${usuario || 'anonimo'}`;

function leerVistos(): string[] | null {
  try {
    const valor = localStorage.getItem(llaveVistos());
    if (valor === null) return null;
    const ids = JSON.parse(valor);
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch { return []; }
}

function guardarVistos(ids: string[]) {
  try { localStorage.setItem(llaveVistos(), JSON.stringify([...new Set(ids)])); } catch { /* El aviso sigue funcionando durante la sesión. */ }
}

export function sonidoLogrosActivo() {
  try { return localStorage.getItem(SONIDO_KEY) !== 'off'; } catch { return true; }
}

function actualizarBotonesSonido() {
  const activo = sonidoLogrosActivo();
  document.querySelectorAll<HTMLButtonElement>('[data-logros-sonido]').forEach((boton) => {
    boton.setAttribute('aria-pressed', String(activo));
    boton.title = activo ? 'Silenciar anuncios de logros' : 'Activar anuncios de logros';
    const icono = boton.querySelector<HTMLElement>('[data-lucide], svg');
    if (icono) icono.setAttribute('data-lucide', activo ? 'volume-2' : 'volume-x');
    const estado = boton.querySelector('strong');
    if (estado) estado.textContent = activo ? 'Activado' : 'Silenciado';
  });
  createIcons({ icons });
}

function alternarSonido() {
  const nuevo = !sonidoLogrosActivo();
  try { localStorage.setItem(SONIDO_KEY, nuevo ? 'on' : 'off'); } catch { /* Preferencia no persistente. */ }
  actualizarBotonesSonido();
  if (nuevo) tocarFirmaSonora();
}

function tocarFirmaSonora() {
  if (!sonidoLogrosActivo()) return;
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const contexto = new AudioCtx();
    const inicio = contexto.currentTime + .02;
    const master = contexto.createGain();
    master.gain.setValueAtTime(.0001, inicio);
    master.gain.exponentialRampToValueAtTime(.12, inicio + .025);
    master.gain.exponentialRampToValueAtTime(.0001, inicio + .72);
    master.connect(contexto.destination);

    [[392, 0], [523.25, .13], [659.25, .28]].forEach(([frecuencia, demora], indice) => {
      const oscilador = contexto.createOscillator();
      const ganancia = contexto.createGain();
      oscilador.type = indice === 2 ? 'sine' : 'triangle';
      oscilador.frequency.setValueAtTime(frecuencia, inicio + demora);
      ganancia.gain.setValueAtTime(.0001, inicio + demora);
      ganancia.gain.exponentialRampToValueAtTime(indice === 2 ? .7 : .42, inicio + demora + .02);
      ganancia.gain.exponentialRampToValueAtTime(.0001, inicio + demora + .38);
      oscilador.connect(ganancia); ganancia.connect(master);
      oscilador.start(inicio + demora); oscilador.stop(inicio + demora + .42);
    });
    window.setTimeout(() => void contexto.close(), 1200);
  } catch { /* Algunos navegadores bloquean audio hasta otra interacción. */ }
}

function mostrarSiguiente() {
  if (mostrando || !cola.length) return;
  mostrando = true;
  const logro = cola.shift()!;
  document.querySelector('.achievement-unlock')?.remove();
  const aviso = document.createElement('aside');
  aviso.className = 'achievement-unlock';
  aviso.setAttribute('role', 'status');
  aviso.setAttribute('aria-live', 'polite');
  aviso.innerHTML = `<div class="achievement-unlock__shine"></div>
    <div class="achievement-unlock__emblem"><i data-lucide="${esc(logro.icon)}" class="i"></i><span><i data-lucide="check" class="i"></i></span></div>
    <div class="achievement-unlock__copy"><span>Logro desbloqueado</span><strong>${esc(logro.titulo)}</strong><p>${esc(logro.desc)}</p></div>
    <a href="#/logros" class="achievement-unlock__action" aria-label="Ver logro ${esc(logro.titulo)}"><i data-lucide="arrow-up-right" class="i"></i></a>`;
  document.body.appendChild(aviso);
  createIcons({ icons });
  tocarFirmaSonora();
  celebrar(logro.rareza === 'Distintivo' ? 'grande' : 'normal');
  requestAnimationFrame(() => aviso.classList.add('is-visible'));
  window.setTimeout(() => {
    aviso.classList.remove('is-visible');
    window.setTimeout(() => { aviso.remove(); mostrando = false; mostrarSiguiente(); }, 420);
  }, 5400);
}

export function revisarLogros() {
  if (!usuario) return;
  const actuales = logros().filter((logro) => logro.ok);
  const vistos = leerVistos();
  if (vistos === null) {
    guardarVistos(actuales.map((logro) => logro.id));
    return;
  }
  const nuevos = actuales.filter((logro) => !vistos.includes(logro.id));
  if (!nuevos.length) return;
  guardarVistos([...vistos, ...nuevos.map((logro) => logro.id)]);
  cola.push(...nuevos);
  mostrarSiguiente();
}

export function instalarAvisosLogros(uid: string) {
  usuario = uid || 'anonimo';
  revisarLogros();
  if (instalado) return;
  instalado = true;
  window.addEventListener('progreso:cambio', revisarLogros);
  window.addEventListener('comunidad:cambio', revisarLogros);
  document.addEventListener('click', (evento) => {
    const boton = (evento.target as HTMLElement).closest('[data-logros-sonido]');
    if (boton) alternarSonido();
  });
}
