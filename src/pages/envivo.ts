import { Datos, type Evento } from '../core/datos';
import { cursos } from '../core/catalogo';
import { BRAND } from '../core/brand';
import { esc, tarjetaCurso } from '../ui/partials';

const eventosPublicados = (): Evento[] => Datos.eventos().filter((e) => e.publicado !== false);
const KEY = 'dermalysse:reservas:v1';
const reservas = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
export const toggleReserva = (id: string) => {
  const r = reservas();
  const i = r.indexOf(id);
  const reservada = i < 0;
  if (reservada) r.push(id); else r.splice(i, 1);
  localStorage.setItem(KEY, JSON.stringify(r));
  return reservada;
};

const fmt = (iso: string) => new Date(iso).toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function proximoEvento() { return eventosPublicados().filter((e) => new Date(e.fecha).getTime() > Date.now()).sort((a, b) => a.fecha.localeCompare(b.fecha))[0]; }

export function envivo() {
  const ahora = Date.now();
  const proximos = eventosPublicados().filter((e) => new Date(e.fecha).getTime() > ahora).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const pasados = eventosPublicados().filter((e) => new Date(e.fecha).getTime() <= ahora);
  const r = reservas();
  const prox = proximos[0];
  const canal = BRAND.canalWhatsApp;

  const heroProx = prox ? `
    <div class="hero" style="min-height:300px;grid-template-columns:1fr">
      <div class="hero__body">
        <span class="hero__kicker"><span class="chip chip--live" style="height:22px">Próxima</span>${fmt(prox.fecha)}</span>
        <h1 class="display display--black hero__title">${esc(prox.titulo)}</h1>
        <p class="hero__lead">Con ${esc(prox.ponente)} · ${prox.duracionMin} min · transmisión en vivo con preguntas al final.</p>
        <div class="hero__actions">
          <button class="btn btn--white btn--lg btn--pill-arrow" data-reservar="${prox.id}" data-reservar-formato="hero">${r.includes(prox.id) ? 'Reservado · te avisamos' : 'Reservar mi lugar'} <span class="arrow" style="background:var(--brand-navy);color:#fff"><i data-lucide="${r.includes(prox.id) ? 'check' : 'bell'}" class="i"></i></span></button>
          ${prox.enlace ? `<a class="btn btn--lg" style="background:rgba(255,255,255,.12);color:#fff" href="${prox.enlace}" target="_blank" rel="noopener">Entrar a la transmisión</a>` : ''}
        </div>
      </div>
    </div>` : `
    <div class="card" style="text-align:center;padding:56px 24px;display:grid;gap:12px;justify-items:center;background:var(--hero-gradient);color:#fff;border:0">
      <span class="circle-btn" style="width:64px;height:64px;background:rgba(255,255,255,.14)"><i data-lucide="radio" class="i" style="width:26px;height:26px"></i></span>
      <h1 class="display display--black" style="font-size:var(--fs-2xl)">Sin clases programadas</h1>
      <p style="opacity:.85;max-width:46ch">${canal ? 'Te avisamos en cuanto haya una nueva transmisión en vivo. Los anuncios también se publican en el canal de WhatsApp.' : 'Te avisamos dentro del club en cuanto haya una nueva transmisión en vivo.'}</p>
      ${canal ? `<a class="btn btn--white btn--pill-arrow" href="${canal}" target="_blank" rel="noopener">Seguir el canal de WhatsApp <span class="arrow" style="background:var(--brand-navy);color:#fff"><i data-lucide="arrow-up-right" class="i"></i></span></a>` : '<span class="chip chip--glass">Agenda en preparación</span>'}
    </div>`;

  return `
  <section class="stack" style="gap:20px">
    <div class="section-head"><div><span class="chip chip--primary">En vivo</span><h1 class="display" style="font-size:var(--fs-2xl)">Clases <em>en vivo</em> y grabaciones</h1></div>
      ${canal ? `<a class="section-head__cta" href="${canal}" target="_blank" rel="noopener">Canal de avisos <span class="circle-btn"><i data-lucide="arrow-up-right" class="i"></i></span></a>` : ''}</div>
    ${heroProx}
    ${proximos.length > 1 ? `<div class="stack" style="gap:10px">${proximos.slice(1).map((e) => `
      <div class="upnext"><div class="upnext__thumb" style="background:var(--hero-gradient);display:grid;place-items:center;color:#fff"><i data-lucide="radio" class="i" style="position:static;filter:none"></i></div>
        <div><span class="eyebrow">${fmt(e.fecha)}</span><div class="upnext__title">${esc(e.titulo)}</div><p class="faint" style="font-size:var(--fs-xs)">${esc(e.ponente)} · ${e.duracionMin} min</p></div>
        <button class="btn btn--sm ${r.includes(e.id) ? 'btn--secondary' : 'btn--brand'}" data-reservar="${e.id}" data-reservar-formato="lista">${r.includes(e.id) ? 'Reservado' : 'Reservar'}</button></div>`).join('')}</div>` : ''}
  </section>
  <section class="stack" style="gap:20px">
    <div class="section-head"><div><span class="chip chip--primary">Grabaciones</span><h2 class="display">Lo que ya se dio en vivo, <em>grabado</em></h2></div></div>
    <p class="muted">Cada curso del catálogo nació como un curso en vivo. Las grabaciones se suben aquí unas semanas después.</p>
    ${pasados.length ? `<div class="stack">${pasados.map((e) => `<div class="upnext"><div><span class="eyebrow">${fmt(e.fecha)}</span><div class="upnext__title">${esc(e.titulo)}</div></div>${e.cursoId ? `<a class="btn btn--brand btn--sm" href="#/curso/${e.cursoId}">Ver grabación</a>` : '<span class="chip">Pendiente de subir</span>'}</div>`).join('')}</div>` : ''}
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">${cursos.slice(0, 4).map(tarjetaCurso).join('')}</div>
  </section>`;
}
