import { curso as getCurso, cursos, fmtMin } from '../core/catalogo';
import { Progreso } from '../core/progreso';
import { Acceso } from '../core/acceso';
import { examenAprobado } from '../core/examen-final';
import { esc, tarjetaCurso, placeholder } from '../ui/partials';

export function curso(params: Record<string, string>) {
  const c = getCurso(params.id);
  if (!c) return placeholder('Curso no encontrado', 'Puede que el enlace sea viejo. Revisa el catálogo.', 'search-x');
  const p = Progreso.porcentaje(c);
  const vistas = Progreso.de(c.id).vistas;
  const sig = Progreso.siguiente(c);
  const done = Progreso.completado(c);
  const iniciales = c.instructor.split(' ').filter((w) => /^[A-ZÁÉÍÓÚ]/.test(w)).slice(-2).map((w) => w[0]).join('');

  const temario = c.clases.map((k) => {
    const vista = vistas.includes(k.n);
    const secuenciaOk = Progreso.desbloqueada(c, k.n);
    const accesoOk = Acceso.claseAccesible(c, k.n);
    const abierta = secuenciaOk && accesoOk;
    const necesitaVip = !accesoOk;
    const actual = !vista && abierta && k.n === sig;
    const cls = vista ? 'is-done' : actual ? 'is-current' : abierta ? '' : 'is-locked';
    const num = vista ? `<i data-lucide="check" class="i" style="width:14px;height:14px"></i>` : k.n;
    const ico = vista ? 'rotate-ccw' : necesitaVip ? 'crown' : abierta ? 'play' : 'lock';
    const badge = Acceso.claseLibre(c, k.n) ? ' <span class="chip chip--accent" style="height:20px;margin-left:6px">Gratis</span>' : necesitaVip ? ' <span class="chip" style="height:20px;margin-left:6px;background:var(--brand-navy);color:#fff"><i data-lucide="crown" class="i" style="width:12px;height:12px"></i> VIP</span>' : '';
    const inner = `
      <div class="lesson__num">${num}</div>
      <div class="lesson__thumb"><img src="${c.portada}" alt=""><i data-lucide="${ico}" class="i"></i></div>
      <div><div class="lesson__title">${esc(k.titulo)}${badge}</div>
        <div class="lesson__dur">${k.duracion ? fmtMin(k.duracion) : 'Clase ' + k.n}</div></div>`;
    return abierta
      ? `<a class="lesson ${cls}" href="#/curso/${c.id}/clase/${k.n}" style="color:inherit">${inner}</a>`
      : necesitaVip
        ? `<div class="lesson ${cls}" data-paywall="Esta clase es para miembros VIP." style="cursor:pointer">${inner}</div>`
        : `<div class="lesson ${cls}" title="Termina la clase anterior para desbloquearla">${inner}</div>`;
  }).join('');

  const cta = done
    ? examenAprobado(c.id)
      ? `<a class="btn btn--white btn--lg btn--pill-arrow" href="#/certificados">Ver mi certificado <span class="arrow" style="background:var(--brand-navy);color:#fff"><i data-lucide="award" class="i"></i></span></a>`
      : `<a class="btn btn--white btn--lg btn--pill-arrow" href="#/curso/${c.id}/examen">Tomar evaluación final <span class="arrow" style="background:var(--brand-navy);color:#fff"><i data-lucide="graduation-cap" class="i"></i></span></a>`
    : `<a class="btn btn--white btn--lg btn--pill-arrow" href="#/curso/${c.id}/clase/${sig}">${p ? `Continuar con la clase ${sig}` : 'Empezar el curso'} <span class="arrow" style="background:var(--brand-navy);color:#fff"><i data-lucide="play" class="i"></i></span></a>`;

  const relacionados = cursos.filter((x) => x.id !== c.id && x.area === c.area).slice(0, 3);
  const otros = relacionados.length ? relacionados : cursos.filter((x) => x.id !== c.id).slice(0, 3);

  return `
  <section class="stack" style="gap:24px">
    <a class="section-head__cta" href="#/cursos" style="align-self:flex-start"><span class="circle-btn circle-btn--glass" style="width:34px;height:34px"><i data-lucide="arrow-left" class="i" style="width:15px;height:15px"></i></span>Catálogo</a>
    <div class="course-hero">
      <img src="${c.portada}" alt="">
      <div class="course-hero__body">
        <div class="row"><span class="chip">${c.area}</span><span class="chip"><i data-lucide="signal" class="i"></i>${c.nivel}</span><span class="chip"><i data-lucide="play-circle" class="i"></i>${c.clases.length} clases</span>${done ? '<span class="chip chip--accent"><i data-lucide="check" class="i"></i>Completado</span>' : ''}</div>
        <h1 class="display display--black course-hero__title">${esc(c.titulo)}</h1>
        <div class="row" style="gap:14px">
          <div class="avatar" style="border:2px solid rgba(255,255,255,.5)">${iniciales || 'OT'}</div>
          <div style="font-size:var(--fs-sm)"><strong>${esc(c.instructor)}</strong><br><span style="opacity:.75">Curso grabado · membresía Dermalysse</span></div>
          <div class="row" style="margin-left:auto">${cta}<button class="circle-btn circle-btn--glass" aria-label="Guardar"><i data-lucide="bookmark" class="i"></i></button></div>
        </div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns:1.6fr 1fr;align-items:start;gap:28px">
      <div class="stack" style="gap:18px">
        <p class="muted" style="font-size:var(--fs-md)">${esc(c.descripcion)}</p>
        <h3 style="font-size:var(--fs-md);margin-top:8px">Temario</h3>
        <div class="syllabus">${temario}</div>
      </div>
      <div class="stack" style="position:sticky;top:88px">
        <div class="card card--pad stack" style="gap:16px">
          <div class="row" style="justify-content:space-between"><div><span class="eyebrow">Tu avance</span><div style="font-family:var(--font-display);font-size:var(--fs-xl);font-weight:700;margin-top:4px">${vistas.length} de ${c.clases.length} clases</div></div><div class="ring" style="--p:${p};--size:64px" data-label="${p}%"></div></div>
          <div class="progress"><span style="width:${p}%"></span></div>
          <div class="stack" style="gap:10px;font-size:var(--fs-sm)">
            <div class="row" style="gap:10px"><span class="circle-btn" style="width:30px;height:30px;background:var(--accent-soft);color:var(--accent)"><i data-lucide="award" class="i" style="width:14px;height:14px"></i></span>Certificado con folio verificable</div>
            <div class="row" style="gap:10px"><span class="circle-btn" style="width:30px;height:30px;background:var(--accent-soft);color:var(--accent)"><i data-lucide="brain" class="i" style="width:14px;height:14px"></i></span>Quiz al final de cada clase</div>
            <div class="row" style="gap:10px"><span class="circle-btn" style="width:30px;height:30px;background:var(--accent-soft);color:var(--accent)"><i data-lucide="unlock" class="i" style="width:14px;height:14px"></i></span>Desbloqueo por avance, a tu ritmo</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="stack" style="gap:20px">
    <div class="section-head"><div><span class="chip chip--primary">Relacionados</span><h2 class="display">Más de <em>${esc(c.area.toLowerCase())}</em></h2></div></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">${otros.map(tarjetaCurso).join('')}</div>
  </section>`;
}
