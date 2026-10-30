import { Auth } from '../core/auth';
import { marcaRompecabezas, registrarRompecabezasCompletado, type RompecabezasClase } from '../core/rompecabezas-clase';
import { esc } from './partials';

const PIEZAS = 9;

function formatoTiempo(segundos: number) {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${min}:${String(seg).padStart(2, '0')}`;
}

export function rompecabezasClaseHTML(juego: RompecabezasClase) {
  const uid = Auth.usuario?.uid ?? 'anonimo';
  const marca = marcaRompecabezas(uid, juego.id);
  return `<section class="lesson-puzzle" data-lesson-puzzle data-puzzle-id="${esc(juego.id)}" data-puzzle-image="${esc(juego.imagen)}">
    <header class="lesson-puzzle__head">
      <div>
        <span class="puzzle-kicker"><i data-lucide="shapes" class="i"></i>Práctica visual opcional</span>
        <h2>${esc(juego.titulo)}</h2>
        <p>${esc(juego.descripcion)}</p>
      </div>
      <span class="puzzle-level"><b>3 × 3</b><small>9 piezas</small></span>
    </header>
    <div class="lesson-puzzle__body">
      <div class="puzzle-play">
        <div class="puzzle-stats" aria-label="Estadísticas del rompecabezas">
          <span><small>Movimientos</small><b data-puzzle-moves>0</b></span>
          <span><small>Tiempo</small><b data-puzzle-time>0:00</b></span>
          <span><small>Récord</small><b data-puzzle-record>${marca ? `${marca.mejorMovimientos} mov.` : '—'}</b></span>
        </div>
        <p class="puzzle-instruction" data-puzzle-instruction><i data-lucide="mouse-pointer-click" class="i"></i><span data-puzzle-instruction-copy>Elige dos piezas para intercambiarlas.</span></p>
        <div class="puzzle-board" data-puzzle-board role="group" aria-label="Rompecabezas de ${esc(juego.titulo)}"></div>
        <div class="puzzle-actions">
          <button type="button" class="btn btn--secondary" data-puzzle-shuffle><i data-lucide="shuffle" class="i"></i>Mezclar de nuevo</button>
          <button type="button" class="btn btn--ghost" data-puzzle-toggle-preview aria-expanded="false"><i data-lucide="eye" class="i"></i><span data-puzzle-preview-label>Ver referencia</span></button>
        </div>
      </div>
      <aside class="puzzle-reference" data-puzzle-reference hidden>
        <span class="eyebrow">Imagen de referencia</span>
        <figure><img src="${esc(juego.imagen)}" alt="${esc(juego.alt)}"><figcaption>${esc(juego.cierre)}</figcaption></figure>
      </aside>
    </div>
    <div class="puzzle-success" data-puzzle-success role="status" aria-live="polite" hidden>
      <span class="puzzle-success__icon"><i data-lucide="sparkles" class="i"></i></span>
      <div><span class="eyebrow">Composición completada</span><strong>¡Excelente observación!</strong><p data-puzzle-success-copy></p></div>
      <button type="button" class="btn btn--secondary" data-puzzle-replay>Jugar otra vez</button>
    </div>
    <p class="puzzle-honesty"><i data-lucide="shield-check" class="i"></i>Se guarda en este dispositivo para tu cuenta. No cambia el avance del curso ni acredita Diamantes.</p>
  </section>`;
}

function enteroAleatorio(maximo: number) {
  if (globalThis.crypto?.getRandomValues) {
    const valor = new Uint32Array(1);
    globalThis.crypto.getRandomValues(valor);
    return valor[0] % maximo;
  }
  return Math.floor(Math.random() * maximo);
}

function mezclar() {
  const piezas = Array.from({ length: PIEZAS }, (_, i) => i);
  for (let i = piezas.length - 1; i > 0; i -= 1) {
    const j = enteroAleatorio(i + 1);
    [piezas[i], piezas[j]] = [piezas[j], piezas[i]];
  }
  if (piezas.every((pieza, posicion) => pieza === posicion)) [piezas[0], piezas[1]] = [piezas[1], piezas[0]];
  return piezas;
}

export function montarRompecabezasClase(alCompletar?: () => void) {
  const root = document.querySelector<HTMLElement>('[data-lesson-puzzle]');
  const tablero = root?.querySelector<HTMLElement>('[data-puzzle-board]');
  if (!root || !tablero) return;
  const id = root.dataset.puzzleId ?? '';
  const imagen = root.dataset.puzzleImage ?? '';
  const uid = Auth.usuario?.uid ?? 'anonimo';
  let orden = mezclar();
  let seleccion: number | null = null;
  let movimientos = 0;
  let inicio = Date.now();
  let terminado = false;

  const tiempo = () => Math.max(0, Math.round((Date.now() - inicio) / 1000));
  const actualizarMetricas = () => {
    const mov = root.querySelector<HTMLElement>('[data-puzzle-moves]');
    const reloj = root.querySelector<HTMLElement>('[data-puzzle-time]');
    if (mov) mov.textContent = String(movimientos);
    if (reloj) reloj.textContent = formatoTiempo(tiempo());
  };
  const pintar = (enfocar?: number) => {
    tablero.innerHTML = orden.map((pieza, posicion) => {
      const x = (pieza % 3) * 50;
      const y = Math.floor(pieza / 3) * 50;
      return `<button type="button" class="puzzle-piece${seleccion === posicion ? ' is-selected' : ''}" data-puzzle-position="${posicion}" style="background-image:url('${esc(imagen)}');background-position:${x}% ${y}%" aria-label="Pieza ${pieza + 1}, posición ${posicion + 1}" aria-pressed="${seleccion === posicion}"><span>${posicion + 1}</span></button>`;
    }).join('');
    if (enfocar !== undefined) tablero.querySelector<HTMLButtonElement>(`[data-puzzle-position="${enfocar}"]`)?.focus();
  };
  const reiniciar = () => {
    orden = mezclar();
    seleccion = null;
    movimientos = 0;
    inicio = Date.now();
    terminado = false;
    root.classList.remove('is-complete');
    const exito = root.querySelector<HTMLElement>('[data-puzzle-success]');
    if (exito) exito.hidden = true;
    const instruccion = root.querySelector<HTMLElement>('[data-puzzle-instruction-copy]');
    if (instruccion) instruccion.textContent = 'Elige dos piezas para intercambiarlas.';
    actualizarMetricas();
    pintar(0);
  };
  const completar = () => {
    terminado = true;
    const segundos = tiempo();
    const marca = registrarRompecabezasCompletado(uid, id, movimientos, segundos);
    root.classList.add('is-complete');
    const exito = root.querySelector<HTMLElement>('[data-puzzle-success]');
    const texto = root.querySelector<HTMLElement>('[data-puzzle-success-copy]');
    const record = root.querySelector<HTMLElement>('[data-puzzle-record]');
    if (exito) exito.hidden = false;
    if (texto) texto.textContent = `Lo resolviste en ${movimientos} movimientos y ${formatoTiempo(segundos)}.`;
    if (record) record.textContent = `${marca.mejorMovimientos} mov.`;
    root.querySelector<HTMLElement>('[data-puzzle-success]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    alCompletar?.();
  };

  tablero.addEventListener('click', (evento) => {
    if (terminado) return;
    const boton = (evento.target as HTMLElement).closest<HTMLButtonElement>('[data-puzzle-position]');
    if (!boton) return;
    const posicion = Number(boton.dataset.puzzlePosition);
    if (seleccion === null) {
      seleccion = posicion;
      const instruccion = root.querySelector<HTMLElement>('[data-puzzle-instruction-copy]');
      if (instruccion) instruccion.textContent = 'Ahora elige la pieza con la que quieres intercambiarla.';
      pintar(posicion);
      return;
    }
    if (seleccion === posicion) {
      seleccion = null;
      const instruccion = root.querySelector<HTMLElement>('[data-puzzle-instruction-copy]');
      if (instruccion) instruccion.textContent = 'Elige dos piezas para intercambiarlas.';
      pintar(posicion);
      return;
    }
    [orden[seleccion], orden[posicion]] = [orden[posicion], orden[seleccion]];
    seleccion = null;
    movimientos += 1;
    const instruccion = root.querySelector<HTMLElement>('[data-puzzle-instruction-copy]');
    if (instruccion) instruccion.textContent = 'Elige dos piezas para intercambiarlas.';
    actualizarMetricas();
    pintar(posicion);
    if (orden.every((pieza, indice) => pieza === indice)) completar();
  });
  root.querySelector<HTMLButtonElement>('[data-puzzle-shuffle]')?.addEventListener('click', reiniciar);
  root.querySelector<HTMLButtonElement>('[data-puzzle-replay]')?.addEventListener('click', reiniciar);
  root.querySelector<HTMLButtonElement>('[data-puzzle-toggle-preview]')?.addEventListener('click', (evento) => {
    const boton = evento.currentTarget as HTMLButtonElement;
    const referencia = root.querySelector<HTMLElement>('[data-puzzle-reference]');
    if (!referencia) return;
    referencia.hidden = !referencia.hidden;
    boton.setAttribute('aria-expanded', String(!referencia.hidden));
    const etiqueta = boton.querySelector<HTMLElement>('[data-puzzle-preview-label]');
    if (etiqueta) etiqueta.textContent = referencia.hidden ? 'Ver referencia' : 'Ocultar referencia';
  });
  pintar();
}
