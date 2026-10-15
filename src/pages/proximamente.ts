// Página amable para las funciones que aún no están activas en producción (ver src/core/funciones.ts).
// Nunca muestra un error ni datos de ejemplo: explica que la sección llegará y ofrece seguir aprendiendo.
import type { Funcion } from '../core/funciones';
import { esc } from '../ui/partials';

const TEXTOS: Partial<Record<Funcion, { icono: string; titulo: string; texto: string }>> = {
  recompensas: {
    icono: 'gift',
    titulo: 'Recompensas',
    texto: 'Estamos preparando esta sección del club. Mientras tanto, tu avance en cursos, certificados y logros se guarda como siempre.',
  },
  experiencia: {
    icono: 'sparkles',
    titulo: 'Bienvenida y encuestas',
    texto: 'Muy pronto podrás contarnos tus intereses para recomendarte por dónde empezar y darnos tu opinión sobre el club.',
  },
};

export function paginaProximamente(funcion: Funcion): string {
  const t = TEXTOS[funcion] ?? { icono: 'sparkles', titulo: 'Nueva sección', texto: 'Estamos preparando esta sección del club.' };
  return `
  <section class="proximo">
    <div class="proximo__card">
      <span class="proximo__ic" aria-hidden="true"><i data-lucide="${esc(t.icono)}" class="i"></i></span>
      <span class="proximo__chip"><i data-lucide="clock-3" class="i" aria-hidden="true"></i>Próximamente en el club</span>
      <h1 class="proximo__titulo">${esc(t.titulo)}</h1>
      <p class="proximo__texto">${esc(t.texto)}</p>
      <div class="proximo__acciones">
        <a class="btn btn--brand btn--pill-arrow" href="#/">Volver a Inicio <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span></a>
        <a class="btn btn--secondary" href="#/cursos"><i data-lucide="graduation-cap" class="i"></i>Explorar cursos</a>
      </div>
    </div>
  </section>`;
}
