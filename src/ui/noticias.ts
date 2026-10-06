import { api } from '../core/auth';
import { Datos } from '../core/datos';
import { esc } from './partials';

interface Noticia {
  titulo: string;
  link: string;
  fecha: string;
  descripcion?: string;
  fuente: string;
  imagen?: string;
}

// Agenda editorial de muestra para el modo demo. Son novedades del propio club
// con enlaces internos: nada afirma diagnóstico, resultado clínico ni fuente
// externa. Al conectar la API real, estas tarjetas se reemplazan por el feed
// curado desde el panel de administración.
const NOTICIAS_DEMO: Noticia[] = [
  {
    titulo: 'Nueva ruta interactiva: Observación de la piel',
    link: '#/retos/historia',
    fecha: '2026-10-02',
    descripcion: 'Un recorrido guiado para entrenar la mirada antes de proponer protocolos. Primer mundo en preparación con contenido académico revisado.',
    fuente: 'Agenda Dermalysse',
    imagen: '/media/dermalysse-learning-rose.jpg',
  },
  {
    titulo: 'Catálogo 2026: 12 cursos confirmados',
    link: '#/cursos',
    fecha: '2026-09-30',
    descripcion: 'Cosmiatría, estética facial, estética corporal, nutrición y regulación. Explora el catálogo completo y organiza tu ruta de aprendizaje.',
    fuente: 'Agenda Dermalysse',
    imagen: '/media/cosmetica-natural.png',
  },
  {
    titulo: 'Biblioteca de materiales en preparación',
    link: '#/materiales',
    fecha: '2026-09-28',
    descripcion: 'Guías, atlas y formatos de acompañamiento se publicarán aquí a medida que el equipo editorial los revise.',
    fuente: 'Agenda Dermalysse',
    imagen: '/media/dermalysse-paper-rose.jpg',
  },
  {
    titulo: 'Comunidad Dermalysse abierta para colegas',
    link: '#/comunidad',
    fecha: '2026-09-26',
    descripcion: 'Comparte casos educativos, resuelve dudas de criterio y aprende con otros profesionales de dermatología y estética.',
    fuente: 'Agenda Dermalysse',
    imagen: '/media/hidrafacial.png',
  },
  {
    titulo: 'Próximas clases en vivo',
    link: '#/en-vivo',
    fecha: '2026-09-24',
    descripcion: 'Revisa el calendario de encuentros con el equipo académico y reserva tu lugar cuando se publique la próxima transmisión.',
    fuente: 'Agenda Dermalysse',
    imagen: '/media/manchas.png',
  },
];

function tiempoRelativo(iso: string): string {
  if (!iso) return '';
  try {
    const ahora = Date.now();
    const fecha = new Date(iso).getTime();
    const diffH = Math.floor((ahora - fecha) / 3600000);
    if (diffH < 1) return 'Hace un momento';
    if (diffH < 24) return `Hace ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'Ayer';
    if (diffD < 7) return `Hace ${diffD} días`;
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

export async function widgetNoticias(): Promise<string> {
  let noticias: Noticia[];
  let esMuestra = false;

  if (Datos.modo === 'api') {
    try {
      const r = await api<{ noticias: Noticia[] }>('/noticias');
      noticias = Array.isArray(r.noticias) ? r.noticias.filter(n => {
        if (!n || typeof n.titulo !== 'string' || typeof n.fuente !== 'string' || typeof n.link !== 'string') return false;
        // Enlaces internos (#/...) o https externos válidos; nada más.
        if (n.link.startsWith('#/')) return true;
        try { const u = new URL(n.link); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
      }) : [];
    } catch {
      noticias = [];
    }
  } else {
    noticias = NOTICIAS_DEMO;
    esMuestra = true;
  }

  const items = noticias.slice(0, 5);
  if (!items.length) return '';

  const [feat, ...rest] = items;
  const esInterno = (link: string) => link.startsWith('#/');
  const atributos = (link: string) => esInterno(link) ? ` href="${esc(link)}"` : ` href="${esc(link)}" target="_blank" rel="noopener"`;
  const chipMuestra = esMuestra ? '<span class="nfeed__badge nfeed__badge--demo"><i data-lucide="flask-conical" class="i"></i>Ejemplo</span>' : '';

  const featHTML = `
    <a class="nfeed__card nfeed__card--feat"${atributos(feat.link)}>
      ${feat.imagen
        ? `<img class="nfeed__card-bg" src="${esc(feat.imagen)}" alt="" loading="lazy">`
        : ''}
      <div class="nfeed__card-over${feat.imagen ? '' : ' nfeed__card-over--ph'}">
        <span class="nfeed__badge"><i data-lucide="sparkles" class="i"></i>${esc(feat.fuente)}<span class="nfeed__sep">·</span>${tiempoRelativo(feat.fecha)}</span>
        <h3 class="nfeed__card-ttl">${esc(feat.titulo)}</h3>
        ${feat.descripcion ? `<p class="nfeed__card-desc">${esc(feat.descripcion)}</p>` : ''}
        ${chipMuestra}
      </div>
    </a>`;

  const rowsHTML = rest.map(n => `
    <a class="nfeed__card nfeed__card--row"${atributos(n.link)}>
      ${n.imagen
        ? `<div class="nfeed__card-thumb" style="background-image:url(${esc(n.imagen)})"></div>`
        : `<div class="nfeed__card-thumb nfeed__card-thumb--ph"><i data-lucide="newspaper" class="i"></i></div>`}
      <div class="nfeed__card-body">
        <h4 class="nfeed__card-row-ttl">${esc(n.titulo)}</h4>
        <span class="nfeed__badge">${esc(n.fuente)}<span class="nfeed__sep">·</span>${tiempoRelativo(n.fecha)}</span>
      </div>
    </a>`).join('');

  return `
    <div class="nfeed">
      <div class="nfeed__header">
        <div>
          <span class="chip chip--primary"><i data-lucide="newspaper" class="i"></i>Novedades</span>
          <h2 style="font-family:var(--font-display);font-size:var(--fs-xl);font-weight:800">Agenda editorial de Dermalysse</h2>
        </div>
      </div>
      <div class="nfeed__bento">
        ${featHTML}
        ${rowsHTML}
      </div>
    </div>`;
}

export function montarTicker() {}
