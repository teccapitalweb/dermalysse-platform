export type IntensidadCelebracion = 'sutil' | 'normal' | 'grande';

let ultimaCelebracion = 0;

/** Celebra un logro sin bloquear la interfaz ni depender de librerías externas. */
export function celebrar(intensidad: IntensidadCelebracion = 'normal') {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ahora = performance.now();
  if (ahora - ultimaCelebracion < 320) return;
  ultimaCelebracion = ahora;

  document.querySelector('.celebracion-confetti')?.remove();
  const cantidad = { sutil: 22, normal: 38, grande: 58 }[intensidad];
  const colores = ['#2f865f', '#62b88b', '#e0a719', '#f4cf68', '#20254b', '#77a9d9', '#ffffff'];
  const host = document.createElement('div');
  host.className = `celebracion-confetti is-${intensidad}`;
  host.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < cantidad; i++) {
    const pieza = document.createElement('span');
    pieza.style.setProperty('--x', `${Math.random() * 100}%`);
    pieza.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 230)}px`);
    pieza.style.setProperty('--rot', `${Math.round(Math.random() * 360)}deg`);
    pieza.style.setProperty('--delay', `${(Math.random() * 0.28).toFixed(2)}s`);
    pieza.style.setProperty('--dur', `${(1.25 + Math.random() * 0.75).toFixed(2)}s`);
    pieza.style.setProperty('--w', `${6 + Math.round(Math.random() * 6)}px`);
    pieza.style.setProperty('--h', `${9 + Math.round(Math.random() * 9)}px`);
    pieza.style.background = colores[i % colores.length];
    if (i % 4 === 0) pieza.classList.add('is-round');
    host.appendChild(pieza);
  }

  document.body.appendChild(host);
  window.setTimeout(() => host.remove(), 2400);
}
