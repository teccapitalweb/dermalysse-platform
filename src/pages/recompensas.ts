import { api } from '../core/auth';
import { Datos } from '../core/datos';
import { esc } from '../ui/partials';

interface Recompensa {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  progreso: number;
  meta: number;
  completado: boolean;
  canjeado: boolean;
  canjeadoEn: string | null;
  premio: { duracion: string; dias: number | null };
}

function etiquetaPremio(r: Recompensa): string {
  const d = r.premio.duracion;
  if (d === '1m') return '1 mes VIP';
  if (d === '3m') return '3 meses VIP';
  if (d === '1y') return '1 año VIP';
  if (d === '15d') return '15 días VIP';
  if (d === 'personalizada' && r.premio.dias) return `${r.premio.dias} días VIP`;
  return 'Acceso VIP';
}

function estado(r: Recompensa): string {
  if (r.canjeado) return 'is-claimed';
  if (r.completado) return 'is-ready';
  return 'is-locked';
}

function tarjeta(r: Recompensa): string {
  const pct = r.meta > 0 ? Math.round((r.progreso / r.meta) * 100) : 0;
  const cls = estado(r);
  return `
  <article class="rew-card ${cls}">
    <div class="rew-card__ribbon"><i data-lucide="crown" class="i"></i>${etiquetaPremio(r)}</div>
    <div class="rew-card__medal"><i data-lucide="${esc(r.icono)}" class="i"></i></div>
    <h3 class="rew-card__title">${esc(r.nombre)}</h3>
    <p class="rew-card__desc">${esc(r.descripcion)}</p>
    <div class="rew-card__progress">
      <div class="rew-card__track"><div class="rew-card__fill" style="width:${Math.min(pct, 100)}%"></div></div>
      <span class="rew-card__count">${r.progreso}<small>/${r.meta}</small></span>
    </div>
    <div class="rew-card__foot">
      ${r.canjeado
        ? `<span class="rew-card__badge rew-card__badge--done"><i data-lucide="circle-check-big" class="i"></i>Canjeado${r.canjeadoEn ? ` · ${new Date(r.canjeadoEn).toLocaleDateString('es-MX')}` : ''}</span>`
        : r.completado
          ? `<button class="btn btn--brand btn--sm" data-canjear="${esc(r.id)}"><i data-lucide="gift" class="i"></i>Canjear recompensa</button>`
          : `<span class="rew-card__badge rew-card__badge--lock"><i data-lucide="lock" class="i"></i>${pct}% completado</span>`}
    </div>
  </article>`;
}

const DEMO: Recompensa[] = [
  { id: 'primer-paso', nombre: 'Primer Paso', descripcion: 'Mira 5 clases de cualquier curso', icono: 'play', progreso: 2, meta: 5, completado: false, canjeado: false, canjeadoEn: null, premio: { duracion: 'personalizada', dias: 7 } },
  { id: 'curso-completo', nombre: 'Curso Completo', descripcion: 'Completa 1 curso', icono: 'book-check', progreso: 0, meta: 1, completado: false, canjeado: false, canjeadoEn: null, premio: { duracion: '15d', dias: null } },
  { id: 'doble-logro', nombre: 'Doble Logro', descripcion: 'Completa 2 cursos', icono: 'trophy', progreso: 0, meta: 2, completado: false, canjeado: false, canjeadoEn: null, premio: { duracion: '1m', dias: null } },
  { id: 'explorador', nombre: 'Explorador', descripcion: 'Completa 5 niveles de historia', icono: 'compass', progreso: 3, meta: 5, completado: false, canjeado: false, canjeadoEn: null, premio: { duracion: 'personalizada', dias: 7 } },
  { id: 'aventurero', nombre: 'Aventurero', descripcion: 'Completa 15 niveles de historia', icono: 'map', progreso: 3, meta: 15, completado: false, canjeado: false, canjeadoEn: null, premio: { duracion: '15d', dias: null } },
  { id: 'participativo', nombre: 'Participativo', descripcion: 'Publica 3 hilos en el foro', icono: 'message-square', progreso: 0, meta: 3, completado: false, canjeado: false, canjeadoEn: null, premio: { duracion: 'personalizada', dias: 7 } },
  { id: 'certificado', nombre: 'Certificado', descripcion: 'Obtén tu primer certificado', icono: 'award', progreso: 0, meta: 1, completado: false, canjeado: false, canjeadoEn: null, premio: { duracion: '15d', dias: null } },
  { id: 'maestro', nombre: 'Criterio Dermalysse', descripcion: 'Completa 5 cursos', icono: 'crown', progreso: 0, meta: 5, completado: false, canjeado: false, canjeadoEn: null, premio: { duracion: '1m', dias: null } },
];

export async function paginaRecompensas(): Promise<string> {
  let recompensas: Recompensa[];

  if (Datos.modo === 'api') {
    const res = await api<{ recompensas: Recompensa[] }>('/recompensas');
    recompensas = res.recompensas;
  } else {
    recompensas = DEMO;
  }
  const canjeadas = recompensas.filter((r) => r.canjeado).length;
  const listas = recompensas.filter((r) => r.completado && !r.canjeado).length;
  const enProgreso = recompensas.length - canjeadas - listas;

  return `
  <section class="stack" style="gap:24px" data-rew-page>
    <div class="rew-banner">
      <div class="rew-banner__content">
        <span class="rew-banner__chip"><i data-lucide="gift" class="i"></i>Recompensas</span>
        <h1 class="rew-banner__title">Gana VIP cumpliendo metas</h1>
        <p class="rew-banner__sub">Completa cursos, niveles de historia, participa en el foro y obtén certificados para desbloquear acceso VIP gratis.</p>
      </div>
      <div class="rew-banner__meters">
        <div class="rew-meter">
          <div class="rew-meter__ring" style="--pct:${recompensas.length > 0 ? Math.round((canjeadas / recompensas.length) * 100) : 0}">
            <span class="rew-meter__val">${canjeadas}<small>/${recompensas.length}</small></span>
          </div>
          <span class="rew-meter__label">Canjeadas</span>
        </div>
        <div class="rew-meter rew-meter--ready">
          <div class="rew-meter__ring" style="--pct:${recompensas.length > 0 ? Math.round((listas / recompensas.length) * 100) : 0}">
            <span class="rew-meter__val">${listas}</span>
          </div>
          <span class="rew-meter__label">Listas</span>
        </div>
        <div class="rew-meter rew-meter--progress">
          <div class="rew-meter__ring" style="--pct:${recompensas.length > 0 ? Math.round((enProgreso / recompensas.length) * 100) : 0}">
            <span class="rew-meter__val">${enProgreso}</span>
          </div>
          <span class="rew-meter__label">En progreso</span>
        </div>
      </div>
    </div>
    ${listas > 0 ? `<div class="rew-alert"><i data-lucide="sparkles" class="i"></i>Tienes ${listas} recompensa${listas > 1 ? 's' : ''} lista${listas > 1 ? 's' : ''} para canjear</div>` : ''}
    <div class="rew-grid">
      ${recompensas.map(tarjeta).join('')}
    </div>
  </section>`;
}
