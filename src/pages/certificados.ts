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
  if (a.includes('nutri')) return 'apple';
  if (a.includes('regul')) return 'scale';
  if (a.includes('corporal')) return 'activity';
  if (a.includes('facial') || a.includes('piel')) return 'scan-face';
  if (a.includes('cosmet') || a.includes('cosmi')) return 'sparkles';
  return 'graduation-cap';
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
    color: { dark: '#0b2435', light: '#ffffff' },
  });
  const areaIcon = iconoArea(d.area);
  const anio = /DRM-(\d{4})/i.exec(d.folio)?.[1] || String(new Date().getFullYear());
  return `<article class="cert-final ${d.muestra ? 'is-sample' : ''}" id="cert">
    <button class="cert-final__close" data-cert-close aria-label="Cerrar vista ampliada"><i data-lucide="x" class="i"></i></button>
    <div class="cert-final__security cert-final__security--top">DERMALYSSE · FORMACIÓN CONTINUA · CONOCIMIENTO QUE SE TRANSFORMA EN CRITERIO ·</div>
    <div class="cert-final__security cert-final__security--bottom">CERTIFICADO DIGITAL · AUTENTICIDAD VERIFICABLE · DERMALYSSE ·</div>
    <aside class="cert-final__rail">
      <div class="cert-final__monogram"><img src="/brand/dermalysse-isotipo.svg" alt=""><span>DL</span></div>
      <div class="cert-final__rail-copy"><b>Excelencia</b><span>Formación Dermalysse</span></div>
      <div class="cert-final__rail-foot"><div class="cert-final__discipline"><i data-lucide="${esc(areaIcon)}" class="i"></i><span>${esc(d.area)}</span></div><div class="cert-final__rail-year">${esc(anio.slice(0, 2))}<span>${esc(anio.slice(2))}</span></div></div>
    </aside>
    <div class="cert-final__sheet">
      <div class="cert-final__grain"></div>
      <div class="cert-final__watermark"><img src="/brand/dermalysse-isotipo.svg" alt=""></div>
      ${d.muestra ? '<span class="cert-final__sample">Vista previa · no válido</span>' : ''}
      <header class="cert-final__head">
        <img src="/brand/dermalysse-horizontal.svg" alt="Dermalysse">
        <div class="cert-final__credential"><i data-lucide="shield-check" class="i"></i><span>Credencial digital<strong>${d.muestra ? 'Vista previa sin validez' : 'Finalización verificada'}</strong><small>ID ${esc(d.folio)}</small></span></div>
      </header>
      <main class="cert-final__body">
        <span class="cert-final__eyebrow">Certificado de finalización</span>
        <p>Dermalysse reconoce a</p>
        <h1>${esc(d.nombre)}</h1>
        <div class="cert-final__name-line"><i></i></div>
        <p>por haber completado satisfactoriamente el programa</p>
        <h2>${esc(d.curso)}</h2>
        <p class="cert-final__statement">y demostrar dedicación al fortalecimiento de sus conocimientos en el área de formación correspondiente.</p>
        <div class="cert-final__facts">
          <div><i data-lucide="${esc(areaIcon)}" class="i"></i><span>Área<b>${esc(d.area)}</b></span></div>
          <div><i data-lucide="gauge" class="i"></i><span>Nivel<b>${esc(d.nivel)}</b></span></div>
          <div><i data-lucide="clock-3" class="i"></i><span>Duración<b>${esc(d.duracion)}</b></span></div>
          <div><i data-lucide="layers-3" class="i"></i><span>Contenido<b>${esc(String(d.clases))} clases</b></span></div>
        </div>
      </main>
      <footer class="cert-final__foot">
        <div class="cert-final__signature"><span class="cert-final__signature-mark">Dermalysse</span><i></i><strong>Coordinación académica</strong><small>Formación y control académico</small></div>
        <div class="cert-final__seal"><img src="/brand/certificado-sello-v1.svg" alt="Sello institucional Dermalysse"><small>Sello institucional</small></div>
        <div class="cert-final__verify"><img class="cert-final__qr-img" src="${esc(qr)}" alt="QR de verificación del certificado"><div><span>${d.muestra ? 'QR ilustrativo' : 'Escanea para verificar'}</span><strong>${esc(d.folio)}</strong><small>${esc(verificar)}</small><em><i data-lucide="calendar-check" class="i"></i>${d.muestra ? 'Vista previa del ' : 'Emitido el '}${esc(d.fecha)}</em></div></div>
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

  const totalEmitidos = Datos.modo === 'api' ? emitidos.length : listosDemo.length;
  const esDemo = Datos.modo !== 'api';
  const lista = Datos.modo === 'api'
    ? emitidos.map((cert) => `
      <a class="certificate-card" href="#/certificados/${esc(encodeURIComponent(cert.folio))}">
        <div class="certificate-card__paper">
          <div class="certificate-card__rail"><i data-lucide="${esc(iconoArea(cert.area))}" class="i"></i></div>
          <img src="/brand/dermalysse-horizontal.svg" alt="Dermalysse">
          <span>Credencial digital</span><strong>${esc(cert.cursoTitulo)}</strong><small>${esc(cert.folio)}</small>
          <img class="certificate-card__seal" src="/brand/certificado-sello-v1.svg" alt="">
        </div>
        <div class="certificate-card__meta"><div><span>${esc(cert.area)}</span><strong>${esc(fechaLarga(cert.emitido))}</strong></div><span class="certificate-card__open"><i data-lucide="arrow-up-right" class="i"></i></span></div>
      </a>`).join('')
    : listosDemo.map((c) => `
      <a class="certificate-card" href="#/certificados/${esc(c.id)}">
        <div class="certificate-card__paper">
          <div class="certificate-card__rail"><i data-lucide="${esc(iconoArea(c.area))}" class="i"></i></div>
          <img src="/brand/dermalysse-horizontal.svg" alt="Dermalysse">
          <span>Demostración · sin validez</span><strong>${esc(c.titulo)}</strong><small>${esc(folio(c))}</small>
          <img class="certificate-card__seal" src="/brand/certificado-sello-v1.svg" alt="">
        </div>
        <div class="certificate-card__meta"><div><span>${esc(c.area)}</span><strong>${esc(fechaLarga(Progreso.de(c.id).actualizado))}</strong></div><span class="certificate-card__open"><i data-lucide="arrow-up-right" class="i"></i></span></div>
      </a>`).join('');

  return `<section class="certificates-hub">
    <header class="certificates-hero">
      <div class="certificates-hero__copy">
        <span class="certificates-hero__kicker"><i data-lucide="badge-check" class="i"></i>Credenciales Dermalysse</span>
        <h1>Tus logros, <em>respaldados.</em></h1>
        <p>${esDemo ? 'Explora cómo se presentarán tus constancias. En este modo, cualquier certificado está marcado claramente como demostración.' : 'Cada credencial emitida integra folio único y una consulta pública que no expone los datos privados de tu cuenta.'}</p>
        <div class="certificates-hero__actions">
          <a class="btn btn--brand" href="#/certificados/muestra"><i data-lucide="scan-eye" class="i"></i>Ver certificado de muestra</a>
          <a class="btn btn--secondary" href="#/cursos"><i data-lucide="graduation-cap" class="i"></i>Continuar formación</a>
        </div>
      </div>
      <div class="certificates-hero__visual" aria-hidden="true">
        <div class="certificates-mini-cert"><span>Dermalysse</span><i></i><strong>Certificado de finalización</strong><small>Folio digital verificable</small><img src="/brand/certificado-sello-v1.svg" alt=""></div>
        <span class="certificates-hero__verified"><i data-lucide="shield-check" class="i"></i>Diseño institucional</span>
      </div>
      <div class="certificates-hero__stats">
        <div><strong>${totalEmitidos}</strong><span>${esDemo ? 'muestras generadas' : 'credenciales emitidas'}</span></div>
        <div><strong>${enMarcha.length}</strong><span>cursos en camino</span></div>
        <div><i data-lucide="qr-code" class="i"></i><span>${esDemo ? 'QR ilustrativo' : 'verificación pública'}</span></div>
      </div>
    </header>

    ${errorCarga ? `<div class="cert-sync-error"><i data-lucide="cloud-off" class="i"></i><div><strong>No pudimos consultar tus certificados</strong><p>${esc(errorCarga)}</p></div><a class="btn btn--secondary btn--sm" href="#/certificados?reintentar=${Date.now()}">Reintentar</a></div>` : ''}

    <section class="certificates-section">
      <header><div><span>${esDemo ? 'Vista de demostración' : 'Tu archivo'}</span><h2>Certificados obtenidos</h2><p>${esDemo ? 'Estas piezas no sustituyen una credencial emitida por el sistema conectado.' : 'Abre, imprime o comparte únicamente las credenciales emitidas a tu cuenta.'}</p></div><strong>${totalEmitidos}</strong></header>
      ${lista ? `<div class="certificates-grid">${lista}</div>` : !errorCarga ? `<div class="cert-empty"><span><i data-lucide="award" class="i"></i></span><div><h3>Tu primera credencial empieza con una clase</h3><p>Completa un curso para que la emisión aparezca aquí.</p></div>${enMarcha[0] ? `<a class="btn btn--brand btn--sm" href="#/curso/${esc(enMarcha[0].id)}">Retomar curso</a>` : '<a class="btn btn--brand btn--sm" href="#/cursos">Elegir un curso</a>'}</div>` : ''}
    </section>

    ${enMarcha.length ? `<section class="certificates-section certificates-section--journey"><header><div><span>Próximas credenciales</span><h2>En camino</h2><p>El porcentaje proviene de tus clases realmente completadas.</p></div><strong>${enMarcha.length}</strong></header><div class="certificate-journey-grid">${enMarcha.map((c) => {
      const pct = Progreso.porcentaje(c);
      const siguiente = Progreso.siguiente(c);
      return `<article class="certificate-journey"><img src="${esc(c.portada)}" alt=""><div><span>${esc(c.area)}</span><h3>${esc(c.titulo)}</h3><div class="certificate-journey__progress"><div><i style="width:${pct}%"></i></div><strong>${pct}%</strong></div><small>${esc(String(Progreso.de(c.id).vistas.length))} de ${esc(String(c.clases.length))} clases</small></div><a href="#/curso/${esc(c.id)}/clase/${esc(String(siguiente))}" aria-label="Continuar ${esc(c.titulo)}"><i data-lucide="play" class="i"></i></a></article>`;
    }).join('')}</div></section>` : ''}
  </section>`;
}

async function paginaCertificado(d: CertData) {
  return `<section class="certificate-page stack">
    <div class="certificate-page__bar">
      <a class="section-head__cta" href="#/certificados"><span class="circle-btn circle-btn--glass"><i data-lucide="arrow-left" class="i"></i></span>Certificados</a>
      <div class="row"><span class="chip ${d.muestra ? 'chip--warn' : 'chip--primary'}"><i data-lucide="${d.muestra ? 'eye' : 'badge-check'}" class="i"></i>${d.muestra ? 'Vista previa' : 'Emitido y verificable'}</span><button class="btn btn--secondary" data-cert-expand><i data-lucide="maximize-2" class="i"></i>Ampliar</button><button class="btn btn--secondary" data-imprimir><i data-lucide="printer" class="i"></i>Imprimir / Guardar PDF</button>${d.muestra ? '' : `<button class="btn btn--brand" data-compartir-cert="${esc(d.folio)}"><i data-lucide="share-2" class="i"></i>Compartir</button>`}</div>
    </div>
    ${await plantillaCertificado(d)}
    <div class="certificate-page__note"><i data-lucide="shield-check" class="i"></i><div><strong>${d.muestra ? 'Así se verá el certificado definitivo' : 'Certificado oficial emitido'}</strong><p>${d.muestra ? 'El sistema colocará automáticamente el nombre, curso, fecha, folio y QR verificable cuando el alumno complete el programa.' : 'Este documento cuenta con folio único y QR de verificación pública. Puedes compartir el enlace sin exponer datos privados de la cuenta.'} Usa “Ampliar” para revisar todos sus detalles.</p></div></div>
  </section>`;
}

export async function certificadoMuestra() {
  const c = cursos[0];
  const perfilNombre = Perfil.get().nombre.trim();
  const nombre = !perfilNombre || /demo/i.test(perfilNombre) ? 'Participante Dermalysse' : perfilNombre;
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
      <div class="cert-verify-card__foot"><img src="/brand/certificado-sello-v1.svg" alt=""><div><strong>Registro digital protegido</strong><span>La consulta no revela correo, teléfono ni datos privados.</span></div></div>
      <a class="btn btn--brand" href="#/login">Entrar a Dermalysse</a>
    </div>
  </section>`;
}
