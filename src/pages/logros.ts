import { logros, racha, puntos } from '../core/logros';
import { Progreso } from '../core/progreso';
import { cursos } from '../core/catalogo';

export function paginaLogros() {
  const L = logros(); const r = racha(); const p = puntos();
  const ok = L.filter((l) => l.ok).length;
  const cats = [...new Set(L.map((l) => l.cat))];
  const nivel = p < 100 ? 'Aprendiz' : p < 400 ? 'Practicante' : p < 1000 ? 'Especialista' : 'Maestro';
  const sigNivel = p < 100 ? 100 : p < 400 ? 400 : p < 1000 ? 1000 : 2000;
  return `
  <section class="stack" style="gap:20px">
    <div class="section-head"><div><span class="chip chip--primary">Logros</span><h1 class="display" style="font-size:var(--fs-2xl)">Tu camino en <em>Dermalysse</em></h1></div></div>
    <div class="hero" style="min-height:0;grid-template-columns:1fr">
      <div class="hero__body" style="padding:32px 40px;gap:14px">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div><span class="hero__kicker"><i data-lucide="crown" class="i" style="width:14px;height:14px"></i>Nivel ${nivel}</span><h2 class="display display--black" style="font-size:var(--fs-2xl);margin-top:12px">${p.toLocaleString('es-MX')} puntos</h2><p style="opacity:.8">${sigNivel - p} puntos para el siguiente nivel · 10 por clase, 50 por curso, 5 por tema en comunidad</p></div>
          <div class="ring" style="--p:${Math.round((ok / L.length) * 100)};--size:84px;--accent:#7bd0c0" data-label="${ok}/${L.length}"></div>
        </div>
        <div class="progress" style="background:rgba(255,255,255,.18)"><span style="width:${Math.min(100, Math.round((p / sigNivel) * 100))}%"></span></div>
        <div class="hero__stats">
          <div><strong>${r.semanas}</strong><span>semanas de racha</span></div>
          <div><strong>${Progreso.totalVistas()}</strong><span>clases vistas</span></div>
          <div><strong>${Progreso.completados().length}</strong><span>de ${cursos.length} cursos</span></div>
          <div class="streak__days" style="align-self:center">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => `<span class="${r.dias[i] ? 'is-on' : ''}" style="${r.dias[i] ? '' : 'background:rgba(255,255,255,.14);color:rgba(255,255,255,.6)'}">${d}</span>`).join('')}</div>
        </div>
      </div>
    </div>
    ${cats.map((cat) => `
    <div class="stack" style="gap:12px">
      <h3 style="font-size:var(--fs-md)">${cat}</h3>
      <div class="grid grid--4">${L.filter((l) => l.cat === cat).map((l) => `
        <div class="medal ${l.ok ? '' : 'is-locked'}"><div class="medal__icon"><i data-lucide="${l.icon}" class="i"></i></div><h4>${l.titulo}</h4><p>${l.desc}</p>${l.ok ? '<span class="chip chip--accent" style="height:22px"><i data-lucide="check" class="i"></i>Logrado</span>' : `<span class="chip" style="height:22px">${l.progreso}</span>`}</div>`).join('')}</div>
    </div>`).join('')}
  </section>`;
}
