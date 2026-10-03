const tarjetas = [
  ['scan-face', 'Atlas educativo de la piel', 'Explora conceptos, capas, alteraciones frecuentes y criterios de observación con un enfoque formativo.'],
  ['flask-conical', 'Compatibilidad de activos', 'Organiza ingredientes cosméticos, objetivos y precauciones para estudiar formulaciones con mayor claridad.'],
  ['clipboard-list', 'Constructor de protocolos', 'Estructura pasos, tiempos y notas de seguimiento para tus prácticas y casos educativos.'],
  ['notebook-tabs', 'Ficha de seguimiento', 'Mantén observaciones, acuerdos y evolución ordenados en un solo lugar, sin datos clínicos reales.'],
];

export function herramientas() {
  return `<section class="tools-page stack" style="gap:24px">
    <header class="tools-hero"><div><span class="tools-hero__eyebrow"><i data-lucide="sparkles" class="i"></i>Laboratorio Dermalysse</span><h1 class="display display--black">Aprende, organiza y <em>lleva tus ideas a la práctica.</em></h1><p>Utilidades educativas pensadas para acompañar los cursos de dermatología, cosmetología, estética y bienestar.</p></div><div class="tools-hero__facts" aria-label="Resumen de herramientas"><div><strong>4</strong><span>herramientas</span></div><div><strong>1</strong><span>espacio</span></div><div><strong>100%</strong><span>educativo</span></div></div></header>
    <div class="tools-grid">${tarjetas.map(([icono, titulo, texto], indice) => `<article class="tool-card"><div class="tool-card__top"><span class="circle-btn" style="width:54px;height:54px;background:var(--primary-soft);color:var(--primary)"><i data-lucide="${icono}" class="i"></i></span><span class="tool-card__tag">${indice ? 'En preparación' : 'Vista previa'}</span></div><div class="tool-card__copy"><span class="eyebrow">Recurso Dermalysse</span><h2 class="display">${titulo}</h2><p>${texto}</p></div><div class="tool-card__actions"><a class="btn btn--secondary" href="#/cursos"><i data-lucide="book-open" class="i"></i>Explorar cursos</a></div></article>`).join('')}</div>
    <div class="tools-footnote"><i data-lucide="shield-check" class="i"></i><div><strong>Uso educativo</strong><span>Estas herramientas no sustituyen valoración, diagnóstico ni indicaciones de un profesional de la salud.</span></div></div>
  </section>`;
}
