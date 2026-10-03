import QRCode from 'qrcode';
import { Progreso } from '../core/progreso';
import { curso as getCurso, cursos, duracionCurso, type Curso } from '../core/catalogo';
import { Perfil } from '../core/perfil';
import { Datos } from '../core/datos';
import { api, mensajeError } from '../core/auth';
import { cargarCertificados, type CertificadoRemoto } from '../core/certificados-remotos';
import { esc, placeholder } from '../ui/partials';

// El backend sustituirá este folio provisional por el folio oficial emitido.
export function folio(c: Curso) {
  const fecha = Progreso.de(c.id).actualizado || new Date().toISOString();
  let h = 0; for (const ch of c.id + Perfil.get().nombre) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `DRM-${fecha.slice(0, 4)}-${String(h % 100000).padStart(5, '0')}`;
}

const fechaLarga = (iso: string) => new Date(iso || Date.now()).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

interface CertData {
  nombre: string;
  curso: string;
  area: string;
  nivel: string;
  duracion: string;
  clases: number;
  fecha: string;
  folio: string;
  muestra?: boolean;
}

function iconoArea(area: string) {
  const a = area.toLowerCase();
  if (a.includes('avic')) return 'bird';
  if (a.includes('acu')) return 'fish-symbol';
  if (a.includes('api')) return 'bug';
  if (a.includes('equin')) return 'rabbit';
  return 'paw-print';
}

function urlVerificacion(folio: string) {
  const base = `${location.origin}${location.pathname}`.replace(/\/$/, '');
  return `${base}/#/verificar/${encodeURIComponent(folio)}`;
}

async function plantillaCertificado(d: CertData) {
  const verificar = urlVerificacion(d.folio);
  const qr = await QRCode.toDataURL(verificar, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#123f2a', light: '#ffffff' },
  });
  const areaIcon = iconoArea(d.area);
  const anio = /(?:ODT|VP)-(\d{4})/i.exec(d.folio)?.[1] || String(new Date().getFullYear());
  return `<article class="cert-final ${d.muestra ? 'is-sample' : ''}" id="cert">
    <button class="cert-final__close" data-cert-close aria-label="Cerrar vista ampliada"><i data-lucide="x" class="i"></i></button>
    <div class="cert-final__security cert-final__security--top">DERMALYSSE · FORMACIÓN CONTINUA · CONOCIMIENTO QUE SE TRANSFORMA EN CRITERIO ·</div>
    <div class="cert-final__security cert-final__security--bottom">CERTIFICADO DIGITAL · AUTENTICIDAD VERIFICABLE · DERMALYSSE ·</div>
    <aside class="cert-final__rail">
      <div class="cert-final__monogram"><img src="/brand/dermalysse-isotipo.svg" alt=""><span>VP</span></div>
      <div class="cert-final__rail-copy"><b>Excelencia</b><span>Formación Dermalysse</span></div>
      <div class="cert-final__rail-foot"><div class="cert-final__discipline"><i data-lucide="${areaIcon}" class="i"></i><span>${esc(d.area)}</span></div><div class="cert-final__rail-year">${anio.slice(0, 2)}<span>${anio.slice(2)}</span></div></div>
    </aside>
    <div class="cert-final__sheet">
      <div class="cert-final__grain"></div>
      <div class="cert-final__watermark"><img src="/brand/dermalysse-isotipo.svg" alt=""></div>
      ${d.muestra ? '<span class="cert-final__sample">Vista previa · no válido</span>' : ''}
      <header class="cert-final__head">
        <img src="/brand/dermalysse-horizontal.svg" alt="Dermalysse">
        <div class="cert-final__credential"><i data-lucide="shield-check" class="i"></i><span>Credencial digital<strong>Finalización verificada</strong><small>ID ${esc(d.folio)}</small></span></div>
      </header>
      <main class="cert-final__body">
        <span class="cert-final__eyebrow">Certificado de finalización</span>
        <p>Dermalysse reconoce a</p>
        <h1>${esc(d.nombre)}</h1>
        <div class="cert-final__name-line"><i></i></div>
        <p>por haber completado satisfactoriamente el programa</p>
        <h2>${esc(d.curso)}</h2>
        <p class="cert-final__statement">y demostrar dedicación al fortalecimiento de sus conocimientos en dermatología, cosmetología y estética.</p>
        <div class="cert-final__facts">
          <div><i data-lucide="paw-print" class="i"></i><span>Área<b>${esc(d.area)}</b></span></div>
          <div><i data-lucide="gauge" class="i"></i><span>Nivel<b>${esc(d.nivel)}</b></span></div>
          <div><i data-lucide="clock-3" class="i"></i><span>Duración<b>${esc(d.duracion)}</b></span></div>
          <div><i data-lucide="layers-3" class="i"></i><span>Contenido<b>${d.clases} clases</b></span></div>
        </div>
      </main>
      <footer class="cert-final__foot">
        <div class="cert-final__signature"><span class="cert-final__signature-mark">Coordinación VP</span><i></i><strong>Coordinador académico</strong><small>Formación y control académico</small></div>
        <div class="cert-final__seal"><img src="/brand/certificado-sello-v1.png" alt="Sello institucional Dermalysse"><small>Sello institucional</small></div>
        <div class="cert-final__verify"><img class="cert-final__qr-img" src="${qr}" alt="QR de verificación del certificado"><div><span>Escanea para verificar</span><strong>${esc(d.folio)}</strong><small>${esc(verificar)}</small><em><i data-lucide="calendar-check" class="i"></i>Emitido el ${esc(d.fecha)}</em></div></div>
      </footer>
    </div>
  </article>`;
}

export async function certificados() {
  const listosDemo = Progreso.completados();
  const enMarcha = Progreso.enMarcha();
  let emitidos: CertificadoRemoto[] = [];
  let errorCarga = '';
  if (Datos.modo === 'api') {
    try { emitidos = await cargarCertificados(); }
    catch (e) { errorCarga = mensajeError(e); }
  }

  const lista = Datos.modo === 'api'
    ? emitidos.map((cert) => `
      <a class="card card--hover" href="#/certificados/${encodeURIComponent(cert.folio)}" style="overflow:hidden;color:inherit">
        <div class="cert-thumb"><img src="/brand/dermalysse-horizontal.svg" alt=""><span>Certificado oficial</span><strong>${esc(cert.cursoTitulo)}</strong><small>${esc(cert.folio)}</small></div>
        <div class="card--pad" style="padding:16px 18px;display:flex;justify-content:space-between;align-items:center"><div><strong style="font-size:var(--fs-sm)">${esc(cert.area)}</strong><br><span class="faint" style="font-size:var(--fs-xs)">${fechaLarga(cert.emitido)}</span></div><span class="circle-btn" style="width:36px;height:36px"><i data-lucide="arrow-up-right" class="i" style="width:15px;height:15px"></i></span></div>
      </a>`).join('')
    : listosDemo.map((c) => `
      <a class="card card--hover" href="#/certificados/${c.id}" style="overflow:hidden;color:inherit">
        <div class="cert-thumb"><img src="/brand/dermalysse-horizontal.svg" alt=""><span>Certificado de demostración</span><strong>${esc(c.titulo)}</strong><small>${folio(c)}</small></div>
        <div class="card--pad" style="padding:16px 18px;display:flex;justify-content:space-between;align-items:center"><div><strong style="font-size:var(--fs-sm)">${esc(c.area)}</strong><br><span class="faint" style="font-size:var(--fs-xs)">${fechaLarga(Progreso.de(c.id).actualizado)}</span></div><span class="circle-btn" style="width:36px;height:36px"><i data-lucide="arrow-up-right" class="i" style="width:15px;height:15px"></i></span></div>
      </a>`).join('');

  return `
  <section class="stack" style="gap:20px">
    <div class="section-head"><div><span class="chip chip--primary">Certificados</span><h1 class="display" style="font-size:var(--fs-2xl)">Tus <em>certificados</em> Dermalysse</h1>
      <p class="muted" style="margin-top:6px">Con folio único y verificación pública. Se emiten al completar todas las clases de un curso.</p></div>
      <a class="btn btn--secondary" href="#/certificados/muestra"><i data-lucide="scan-eye" class="i"></i>Ver certificado de muestra</a></div>
    ${errorCarga ? `<div class="card card--pad cert-sync-error"><i data-lucide="cloud-off" class="i"></i><div><strong>No pudimos consultar tus certificados</strong><p class="muted">${esc(errorCarga)}</p></div><a class="btn btn--secondary btn--sm" href="#/certificados?reintentar=${Date.now()}">Reintentar</a></div>` : ''}
    ${lista ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${lista}</div>` : !errorCarga ? `
      <div class="card card--pad cert-empty">
        <span class="circle-btn"><i data-lucide="award" class="i"></i></span>
        <div><h3>Tu primer certificado está a un curso de distancia</h3><p class="muted">Termina todas las clases de cualquier curso y aparecerá aquí con su folio verificable.</p></div>
        ${enMarcha[0] ? `<a class="btn btn--brand btn--sm" href="#/curso/${enMarcha[0].id}">Continuar curso</a>` : `<a class="btn btn--brand btn--sm" href="#/cursos">Elegir un curso</a>`}
      </div>` : ''}
    ${enMarcha.length ? `<h3 style="font-size:var(--fs-md)">En camino</h3><div class="stack" style="gap:10px">${enMarcha.map((c) => `<div class="upnext"><div class="upnext__thumb"><img src="${c.portada}" alt=""></div><div><div class="upnext__title">${esc(c.titulo)}</div><div class="lesson-progress" style="margin-top:6px"><div class="progress progress--thin"><span style="width:${Progreso.porcentaje(c)}%"></span></div>${Progreso.porcentaje(c)}%</div></div><a class="circle-btn" href="#/curso/${c.id}/clase/${Progreso.siguiente(c)}"><i data-lucide="play" class="i"></i></a></div>`).join('')}</div>` : ''}
  </section>`;
}

async function paginaCertificado(d: CertData) {
  return `<section class="certificate-page stack">
    <div class="certificate-page__bar">
      <a class="section-head__cta" href="#/certificados"><span class="circle-btn circle-btn--glass"><i data-lucide="arrow-left" class="i"></i></span>Certificados</a>
      <div class="row"><span class="chip ${d.muestra ? 'chip--warn' : 'chip--primary'}"><i data-lucide="${d.muestra ? 'eye' : 'badge-check'}" class="i"></i>${d.muestra ? 'Vista previa' : 'Emitido y verificable'}</span><button class="btn btn--secondary" data-cert-expand><i data-lucide="maximize-2" class="i"></i>Ampliar</button><button class="btn btn--secondary" data-imprimir><i data-lucide="printer" class="i"></i>Imprimir / Guardar PDF</button>${d.muestra ? '' : `<button class="btn btn--brand" data-compartir-cert="${d.folio}"><i data-lucide="share-2" class="i"></i>Compartir</button>`}</div>
    </div>
    ${await plantillaCertificado(d)}
    <div class="certificate-page__note"><i data-lucide="shield-check" class="i"></i><div><strong>${d.muestra ? 'Así se verá el certificado definitivo' : 'Certificado oficial emitido'}</strong><p>${d.muestra ? 'El sistema colocará automáticamente el nombre, curso, fecha, folio y QR verificable cuando el alumno complete el programa.' : 'Este documento cuenta con folio único y QR de verificación pública. Puedes compartir el enlace sin exponer datos privados de la cuenta.'} Usa “Ampliar” para revisar todos sus detalles.</p></div></div>
  </section>`;
}

export async function certificadoMuestra() {
  const c = getCurso('gallinas-de-postura') || cursos[0];
  const perfilNombre = Perfil.get().nombre.trim();
  const nombre = !perfilNombre || /demo/i.test(perfilNombre) ? 'Michael Angel Galicia Garcia' : perfilNombre;
  return paginaCertificado({ nombre, curso: c?.titulo || 'Curso Dermalysse', area: c?.area || 'Cosmetología', nivel: c?.nivel || 'Profesional', duracion: c ? duracionCurso(c) : '4 h 56', clases: c?.clases.length || 5, fecha: fechaLarga(new Date().toISOString()), folio: 'DRM-2026-00001', muestra: true });
}

export async function certificado(params: Record<string, string>) {
  if (Datos.modo === 'api') {
    let lista: CertificadoRemoto[];
    try { lista = await cargarCertificados(); }
    catch (e) { return placeholder('No pudimos abrir el certificado', mensajeError(e), 'cloud-off'); }
    const remoto = lista.find((c) => c.folio.toUpperCase() === params.id.toUpperCase());
    if (!remoto) return placeholder('Certificado no disponible', 'No encontramos un certificado emitido con ese folio en tu cuenta.', 'lock');
    const c = getCurso(remoto.cursoId);
    return paginaCertificado({
      nombre: remoto.nombre,
      curso: remoto.cursoTitulo,
      area: remoto.area,
      nivel: c?.nivel || 'Profesional',
      duracion: c ? duracionCurso(c) : `${remoto.clases} clases`,
      clases: remoto.clases,
      fecha: fechaLarga(remoto.emitido),
      folio: remoto.folio,
    });
  }
  const c = getCurso(params.id);
  if (!c || !Progreso.completado(c)) return placeholder('Certificado no disponible', 'Este curso todavía no está completado.', 'lock');
  const p = Perfil.get();
  return paginaCertificado({ nombre: p.nombre, curso: c.titulo, area: c.area, nivel: c.nivel, duracion: duracionCurso(c), clases: c.clases.length, fecha: fechaLarga(Progreso.de(c.id).actualizado), folio: folio(c) });
}

interface VerificacionPublica { valido: boolean; folio: string; nombre: string; cursoTitulo: string; emitido: string }

export async function verificarCertificado(params: Record<string, string>) {
  let resultado: VerificacionPublica | null = null;
  let error = '';
  try { resultado = await api<VerificacionPublica>(`/verificar/${encodeURIComponent(params.folio)}`); }
  catch (e) { error = mensajeError(e); }
  return `<section class="cert-verify-page">
    <div class="cert-verify-card">
      <img class="cert-verify-card__logo" src="/brand/dermalysse-horizontal.svg" alt="Dermalysse">
      ${resultado?.valido ? `<div class="cert-verify-card__status is-valid"><i data-lucide="badge-check" class="i"></i><span>Certificado auténtico<strong>Validado por Dermalysse</strong></span></div>
        <span class="eyebrow">Verificación pública</span>
        <h1>${esc(resultado.nombre)}</h1>
        <p>Completó satisfactoriamente</p>
        <h2>${esc(resultado.cursoTitulo)}</h2>
        <dl><div><dt>Folio</dt><dd>${esc(resultado.folio)}</dd></div><div><dt>Fecha de emisión</dt><dd>${fechaLarga(resultado.emitido)}</dd></div></dl>`
      : `<div class="cert-verify-card__status is-invalid"><i data-lucide="shield-x" class="i"></i><span>No se pudo validar<strong>${esc(error || 'El certificado no existe.')}</strong></span></div>
        <h1>Certificado no encontrado</h1><p>Revisa el folio o solicita al titular que comparta nuevamente su certificado.</p>`}
      <div class="cert-verify-card__foot"><img src="/brand/certificado-sello-v1.png" alt=""><div><strong>Registro digital protegido</strong><span>La consulta no revela correo, teléfono ni datos privados.</span></div></div>
      <a class="btn btn--brand" href="#/login">Entrar a Dermalysse</a>
    </div>
  </section>`;
}
