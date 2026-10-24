import {
  Directorio,
  type PerfilDirectorio,
  type OportunidadDirectorio,
} from '../core/directorio';
import { Perfil } from '../core/perfil';
import { esc, iniciales } from '../ui/partials';

const etiqueta = (v: string) => esc(v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()));
const listaCSV = (v: string[]) => esc(v.join(', '));

function avatarProfesional(p: Pick<PerfilDirectorio, 'nombre' | 'foto'>, clase = '') {
  return `<span class="network-avatar ${clase}"><span aria-hidden="true">${esc(iniciales(p.nombre))}</span>${
    p.foto ? `<img src="${esc(p.foto)}" alt="Foto de ${esc(p.nombre)}" width="720" height="720" loading="lazy" decoding="async" data-avatar-image>` : ''
  }</span>`;
}

const botonReportar = (tipo: 'perfil' | 'oportunidad', id: string, nombre: string) =>
  `<button class="network-report" type="button" data-network-report data-type="${tipo}" data-id="${esc(id)}" data-name="${esc(nombre)}" aria-label="Denunciar ${
    tipo === 'perfil' ? 'perfil' : 'oportunidad'
  }"><i data-lucide="flag" class="i"></i></button>`;

function tarjetaPersona(p: PerfilDirectorio) {
  const especialidad = p.especialidades[0] || etiqueta(p.etapa);
  return `<article class="network-card network-person">
    <div class="network-person__portrait ${p.foto ? 'has-photo' : 'is-fallback'}">
      ${avatarProfesional(p, 'network-avatar--profile')}
      <i data-lucide="sparkles" class="i network-person__watermark" aria-hidden="true"></i>
      <div class="network-person__badges">
        <span><i data-lucide="circle-dot" class="i"></i>${etiqueta(p.disponibilidad[0] || 'conectar')}</span>
        ${p.esMio ? '<b>Tu perfil</b>' : '<b><i data-lucide="badge-check" class="i"></i>Verificada</b>'}
      </div>
    </div>
    <div class="network-person__body">
      <span class="network-person__specialty">${esc(especialidad)}</span>
      <div class="network-person__title">
        <h3>${esc(p.nombre)} <i data-lucide="badge-check" class="i" aria-label="Perfil verificado Dermalysse"></i></h3>
        ${p.esMio ? '<span class="network-own">Tu perfil</span>' : ''}
      </div>
      <p class="network-person__role">${esc(p.titular)}</p>
      <p class="network-bio">${esc(p.bio)}</p>
      <div class="network-meta">
        <span><i data-lucide="map-pin" class="i"></i>${esc([p.ciudad, p.estado].filter(Boolean).join(', ') || 'Ubicación abierta')}</span>
        <span><i data-lucide="briefcase-business" class="i"></i>${etiqueta(p.etapa)}</span>
      </div>
      <div class="network-tags">
        ${[...p.especialidades, ...p.habilidades.slice(0, 2)].map((x) => `<span>${esc(x)}</span>`).join('')}
      </div>
    </div>
    <footer>
      <div class="network-availability">
        ${p.disponibilidad.slice(0, 2).map((x) => `<small><i data-lucide="check" class="i"></i>${etiqueta(x)}</small>`).join('')}
      </div>
      <div class="network-card__actions">
        <button class="btn btn--ghost btn--sm" data-network-view data-uid="${esc(p.uid)}">Ver perfil</button>
        ${
          p.esMio
            ? '<a class="btn btn--secondary btn--sm" href="#/directorio/perfil"><i data-lucide="pencil" class="i"></i>Editar</a>'
            : `${botonReportar('perfil', p.uid, p.nombre)}<button class="btn btn--brand btn--sm" data-network-connect data-uid="${esc(p.uid)}" data-name="${esc(p.nombre)}"><i data-lucide="user-plus" class="i"></i>Conectar</button>`
        }
      </div>
    </footer>
  </article>`;
}

function detallePersona(p: PerfilDirectorio) {
  const especialidad = p.especialidades[0] || etiqueta(p.etapa);
  const experiencia = p.experiencia ?? [];
  const formacion = p.formacion ?? [];
  const credenciales = p.credenciales ?? [];
  const idiomas = p.idiomas ?? [];
  return `<dialog class="network-profile-sheet" data-network-view-dialog="${esc(p.uid)}">
    <button class="network-profile-sheet__close" type="button" data-network-close aria-label="Cerrar perfil"><i data-lucide="x" class="i"></i></button>
    <div class="network-profile-sheet__cover ${p.banner ? 'has-banner' : ''}">
      ${p.banner ? `<img src="${esc(p.banner)}" alt="Portada profesional de ${esc(p.nombre)}" width="1600" height="560" loading="lazy" decoding="async">` : ''}
      <span><i data-lucide="badge-check" class="i"></i>Perfil profesional Dermalysse</span>
      <b>${etiqueta(p.disponibilidad[0] || 'conectar')}</b>
    </div>
    <div class="network-profile-sheet__body">
      <div class="network-profile-sheet__identity">
        ${avatarProfesional(p, 'network-avatar--sheet')}
        <div>
          <span class="network-person__specialty">${esc(especialidad)}</span>
          <h3>${esc(p.nombre)}</h3>
          <p>${esc(p.titular)}</p>
          <div class="network-meta">
            <span><i data-lucide="map-pin" class="i"></i>${esc([p.ciudad, p.estado].filter(Boolean).join(', ') || 'Ubicación abierta')}</span>
            <span><i data-lucide="briefcase-business" class="i"></i>${etiqueta(p.etapa)}</span>
          </div>
        </div>
      </div>
      <div class="network-profile-sheet__metrics">
        <span><strong>${p.anosExperiencia ?? '—'}</strong><small>años de experiencia en cabina</small></span>
        <span><strong>${experiencia.length}</strong><small>trayectorias registradas</small></span>
        <span><strong>${formacion.length + credenciales.length}</strong><small>diplomados y avales</small></span>
      </div>
      <div class="network-profile-sheet__content">
        <section class="network-profile-sheet__main">
          <span class="eyebrow">Práctica Cosmetológica</span>
          <h4>Sobre su práctica</h4>
          <p>${esc(p.bio)}</p>
          ${
            experiencia.length
              ? `<div class="network-profile-sheet__section" style="margin-top:18px">
                  <strong style="font-size:12px;color:var(--text-2)">Experiencia y cabinas</strong>
                  <div class="network-timeline" style="display:grid;gap:10px;margin-top:8px">
                    ${experiencia
                      .map(
                        (x) =>
                          `<article style="padding:10px;border-radius:10px;background:var(--surface-2)">
                            <small style="color:var(--text-3);font-size:10px">${esc(x.periodo)}</small>
                            <h5 style="font-size:13px;font-weight:700;margin:2px 0">${esc(x.puesto)}</h5>
                            <b style="font-size:11px;color:var(--primary)">${esc(x.organizacion)}</b>
                            ${x.descripcion ? `<p style="font-size:11px;color:var(--text-2);margin-top:4px">${esc(x.descripcion)}</p>` : ''}
                          </article>`
                      )
                      .join('')}
                  </div>
                </div>`
              : ''
          }
          ${
            formacion.length
              ? `<div class="network-profile-sheet__section" style="margin-top:16px">
                  <strong style="font-size:12px;color:var(--text-2)">Formación y avales</strong>
                  <div style="display:grid;gap:8px;margin-top:8px">
                    ${formacion
                      .map(
                        (x) =>
                          `<article style="padding:8px 12px;border-radius:10px;background:var(--surface-2);display:flex;align-items:center;gap:10px">
                            <i data-lucide="graduation-cap" class="i" style="color:var(--primary)"></i>
                            <div>
                              <h5 style="font-size:12px;font-weight:700">${esc(x.programa)}</h5>
                              <p style="font-size:10px;color:var(--text-3)">${esc(x.institucion)} · ${esc(x.periodo)}</p>
                            </div>
                          </article>`
                      )
                      .join('')}
                  </div>
                </div>`
              : ''
          }
        </section>
        <aside>
          <span class="eyebrow">Afinidad Estética</span>
          <h4>Disponible para</h4>
          <div class="network-tags" style="margin-bottom:14px">
            ${p.disponibilidad.map((x) => `<span><i data-lucide="check" class="i" style="width:11px"></i>${etiqueta(x)}</span>`).join('')}
          </div>
          <h4>Modalidad</h4>
          <div class="network-tags" style="margin-bottom:14px">
            ${p.modalidades.map((x) => `<span>${etiqueta(x)}</span>`).join('')}
          </div>
          ${
            credenciales.length
              ? `<h4>Acreditaciones y Aparatología</h4>
                 <div class="network-tags" style="margin-bottom:14px">
                   ${credenciales.map((x) => `<span><i data-lucide="award" class="i" style="width:11px"></i>${esc(x.nombre)} (${esc(x.anio)})</span>`).join('')}
                 </div>`
              : ''
          }
          ${
            idiomas.length
              ? `<h4>Idiomas</h4>
                 <div class="network-tags" style="margin-bottom:14px">
                   ${idiomas.map((x) => `<span>${esc(x)}</span>`).join('')}
                 </div>`
              : ''
          }
          <h4>Especialidades y técnicas</h4>
          <div class="network-tags">
            ${[...p.especialidades, ...p.habilidades].map((x) => `<span>${esc(x)}</span>`).join('')}
          </div>
          <p style="margin-top:18px;font-size:11px;color:var(--text-3)">
            <i data-lucide="shield-check" class="i" style="color:var(--primary);margin-right:4px"></i>Tus datos de WhatsApp y correo están resguardados hasta aceptar la conexión.
          </p>
        </aside>
      </div>
      <footer>
        <div>
          <span class="eyebrow">Comunidad Médica y Estética</span>
          <p style="font-size:11px;color:var(--text-3)">Preséntate y explica el objetivo de la interconsulta o vinculación.</p>
        </div>
        <div class="network-card__actions">
          ${
            p.esMio
              ? '<button class="btn btn--brand" data-network-profile><i data-lucide="pencil" class="i"></i>Editar mi perfil</button>'
              : `${botonReportar('perfil', p.uid, p.nombre)}<button class="btn btn--brand" data-network-connect data-uid="${esc(p.uid)}" data-name="${esc(p.nombre)}"><i data-lucide="send" class="i"></i>Enviar solicitud</button>`
          }
        </div>
      </footer>
    </div>
  </dialog>`;
}

function tarjetaOportunidad(o: OportunidadDirectorio) {
  return `<article class="network-card network-job">
    <header>
      <span class="network-job__icon">
        <i data-lucide="${o.tipo === 'renta_cabina' ? 'door-open' : o.tipo === 'renta_aparatologia' ? 'zap' : 'handshake'}" class="i"></i>
      </span>
      <div>
        <span class="eyebrow">${etiqueta(o.tipo)} · ${etiqueta(o.modalidad)}</span>
        <h3>${esc(o.titulo)}</h3>
        <p>${esc(o.organizacion)} · ${esc([o.ciudad, o.entidad].filter(Boolean).join(', ') || 'Ubicación flexible')}</p>
      </div>
    </header>
    <p class="network-bio">${esc(o.resumen)}</p>
    <div class="network-tags">${o.especialidades.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
    <footer>
      <small>Publicado por ${esc(o.autor)}</small>
      <div class="network-card__actions">
        ${
          o.esMia
            ? `<span class="network-own">Tu publicación</span>${o.estado === 'publicada' ? `<button class="btn btn--ghost btn--sm" data-network-close-job="${esc(o.id)}">Cerrar</button>` : ''}`
            : `${botonReportar('oportunidad', o.id, o.titulo)}<button class="btn btn--brand btn--sm" data-network-connect data-uid="${esc(o.autorUid)}" data-opportunity="${esc(o.id)}" data-name="${esc(o.autor)}">Me interesa</button>`
        }
      </div>
    </footer>
  </article>`;
}

function completitudPerfil(p: PerfilDirectorio | null) {
  if (!p) return 0;
  const senales = [
    p.foto,
    p.banner,
    p.titular,
    p.bio,
    p.ciudad || p.estado,
    p.especialidades.length,
    p.habilidades.length,
    p.anosExperiencia !== null && p.anosExperiencia !== undefined,
    p.experiencia?.length,
    p.formacion?.length,
    p.credenciales?.length,
    p.idiomas?.length,
  ];
  return Math.round((senales.filter(Boolean).length / senales.length) * 100);
}

const filaExperiencia = (x: { puesto?: string; organizacion?: string; periodo?: string; descripcion?: string } = {}) =>
  `<article class="network-repeat-row" data-network-repeat-row>
    <header>
      <span><i data-lucide="briefcase-business" class="i"></i>Cabina / Clínica</span>
      <button type="button" data-network-remove-row aria-label="Quitar experiencia"><i data-lucide="trash-2" class="i"></i></button>
    </header>
    <div>
      <label>Función o cargo<input class="input" name="experienciaPuesto" value="${esc(x.puesto || '')}" required maxlength="100" placeholder="Cosmiatra titular"></label>
      <label>Clínica o cabina<input class="input" name="experienciaOrganizacion" value="${esc(x.organizacion || '')}" required maxlength="120" placeholder="MedSpa Dermalysse"></label>
      <label>Periodo<input class="input" name="experienciaPeriodo" value="${esc(x.periodo || '')}" required maxlength="60" placeholder="2021 · Actualidad"></label>
      <label class="network-form-wide">Aparatología y protocolos<textarea class="input" name="experienciaDescripcion" rows="2" maxlength="500" placeholder="Tratamientos aplicados, equipos operados y enfoques cosméticos.">${esc(x.descripcion || '')}</textarea></label>
    </div>
  </article>`;

const filaFormacion = (x: { programa?: string; institucion?: string; periodo?: string } = {}) =>
  `<article class="network-repeat-row" data-network-repeat-row>
    <header>
      <span><i data-lucide="graduation-cap" class="i"></i>Formación académica</span>
      <button type="button" data-network-remove-row aria-label="Quitar formación"><i data-lucide="trash-2" class="i"></i></button>
    </header>
    <div>
      <label>Programa o especialidad<input class="input" name="formacionPrograma" value="${esc(x.programa || '')}" required maxlength="120" placeholder="Especialidad en Cosmiatría"></label>
      <label>Institución<input class="input" name="formacionInstitucion" value="${esc(x.institucion || '')}" required maxlength="120" placeholder="Instituto de Posgrados en Estética"></label>
      <label>Periodo<input class="input" name="formacionPeriodo" value="${esc(x.periodo || '')}" required maxlength="60" placeholder="2018 · 2020"></label>
    </div>
  </article>`;

const filaCredencial = (x: { nombre?: string; emisor?: string; anio?: string } = {}) =>
  `<article class="network-repeat-row" data-network-repeat-row>
    <header>
      <span><i data-lucide="award" class="i"></i>Certificación o taller</span>
      <button type="button" data-network-remove-row aria-label="Quitar credencial"><i data-lucide="trash-2" class="i"></i></button>
    </header>
    <div>
      <label>Nombre del certificado<input class="input" name="credencialNombre" value="${esc(x.nombre || '')}" required maxlength="120" placeholder="Manejo Seguro de Láser Diodo"></label>
      <label>Emisor o marca<input class="input" name="credencialEmisor" value="${esc(x.emisor || '')}" maxlength="120" placeholder="Sociedad de Tecnologías Estéticas"></label>
      <label>Año<input class="input" name="credencialAnio" value="${esc(x.anio || '')}" maxlength="20" placeholder="2024"></label>
    </div>
  </article>`;

function directorioPanel(query: URLSearchParams) {
  const data = Directorio.get();
  const miPerfil = data.miPerfil;
  const perfilIncompleto = !miPerfil || !miPerfil.titular || !miPerfil.bio;
  let nudgeOmitido = false;
  try { nudgeOmitido = sessionStorage.getItem('dermalysse:directorio:nudge') === 'omitido'; } catch { /* storage bloqueado */ }
  const mostrarNudge = perfilIncompleto && !nudgeOmitido;
  const vista = query.get('vista') || 'personas';
  const q = (query.get('q') || '').trim().toLocaleLowerCase('es-MX');
  const coincide = (campos: unknown[]) => !q || campos.flat().join(' ').toLocaleLowerCase('es-MX').includes(q);
  const perfiles = data.perfiles.filter((p) => coincide([p.nombre, p.titular, p.especialidades, p.ciudad, p.estado, p.habilidades]));
  const oportunidades = data.oportunidades.filter((o) => coincide([o.titulo, o.tipo, o.organizacion, o.especialidades, o.ciudad, o.entidad]));
  const afinidades = [...new Set(data.perfiles.flatMap((p) => p.especialidades))].slice(0, 6);
  const pendientes = data.conexiones.filter((c) => c.estado === 'pendiente').length;
  const hayMas = vista === 'personas' ? data.paginacion?.perfiles.hayMas : vista === 'oportunidades' ? data.paginacion?.oportunidades.hayMas : false;

  return `<section class="network-directory">
    <div class="network-hero">
      <div class="network-hero__copy">
        <span class="eyebrow"><i data-lucide="sparkles" class="i" style="margin-right:6px"></i>Red Profesional Club Dermalysse</span>
        <h2>La excelencia estética crece en comunidad y colaboración.</h2>
        <p>Vinculación especializada para cosmetólogas, cosmiatras y clínicas estéticas. Renta de cabinas y aparatología con contacto consentido.</p>
        <div class="network-hero__proof">
          <span>${data.perfiles.slice(0, 3).map((p) => avatarProfesional(p, 'network-avatar--mini')).join('')}</span>
          <p><strong>${data.perfiles.length} profesionales y clínicas</strong><br>Comunidad comprometida con la ética y aparatología segura.</p>
        </div>
      </div>
      <div class="network-hero__actions">
        <a class="btn btn--secondary" href="#/directorio/perfil"><i data-lucide="contact" class="i"></i>${data.miPerfil ? 'Editar mi perfil' : 'Crear mi perfil'}</a>
        <button class="btn btn--brand" data-network-job><i data-lucide="plus" class="i"></i>Publicar espacio / equipo</button>
      </div>
    </div>

    ${mostrarNudge ? `<div class="network-nudge" data-network-nudge>
      <div class="network-nudge__copy">
        <span class="eyebrow"><i data-lucide="sparkles" class="i"></i>Directorio profesional</span>
        <h3>${miPerfil ? 'Completa tu perfil profesional' : 'Crea tu perfil profesional'}</h3>
        <p>Aparece ante cosmetólogas y clínicas para interconsultas, colaboración y renta de espacios. Solo se muestra cuando tú lo publicas.</p>
      </div>
      <div class="network-nudge__actions">
        <a class="btn btn--brand" href="#/directorio/perfil"><i data-lucide="contact" class="i"></i>${miPerfil ? 'Completar mi perfil' : 'Crear mi perfil'}</a>
        <button type="button" class="btn btn--ghost" data-network-nudge-skip>Ahora no</button>
      </div>
    </div>` : ''}

    <div class="network-toolbar">
      <nav>
        <a class="${vista === 'personas' ? 'is-active' : ''}" href="#/directorio?vista=personas">Cosmetólogas y Clínicas <span>${data.perfiles.length}</span></a>
        <a class="${vista === 'oportunidades' ? 'is-active' : ''}" href="#/directorio?vista=oportunidades">Cabinas y Aparatología <span>${data.oportunidades.length}</span></a>
        <a class="${vista === 'conexiones' ? 'is-active' : ''}" href="#/directorio?vista=conexiones">Mis conexiones ${pendientes ? `<span>${pendientes}</span>` : ''}</a>
      </nav>
      <form data-network-search>
        <label>
          <i data-lucide="search" class="i"></i>
          <input name="q" value="${esc(query.get('q') || '')}" placeholder="Aparatología, ciudad o técnica...">
          <input type="hidden" name="vista" value="${esc(vista)}">
        </label>
      </form>
    </div>

    ${
      vista === 'personas'
        ? `<div class="network-affinities">
            <span><i data-lucide="sparkles" class="i"></i>Especialidades estéticas</span>
            <a class="${!q ? 'is-active' : ''}" href="#/directorio?vista=personas">Todas</a>
            ${afinidades.map((x) => `<a class="${q === x.toLocaleLowerCase('es-MX') ? 'is-active' : ''}" href="#/directorio?vista=personas&q=${encodeURIComponent(x)}">${esc(x)}</a>`).join('')}
          </div>`
        : ''
    }

    <div class="network-grid">
      ${
        vista === 'personas'
          ? perfiles.length
            ? perfiles.map(tarjetaPersona).join('')
            : '<div class="card card--pad" style="text-align:center;grid-column:1/-1;padding:48px 16px"><i data-lucide="search-x" class="i" style="width:36px;height:36px;color:var(--text-3);margin:0 auto 12px"></i><h3>No encontramos perfiles</h3><p style="color:var(--text-2);font-size:12px">Prueba con otra especialidad estética o ubicación.</p></div>'
          : ''
      }
      ${
        vista === 'oportunidades'
          ? oportunidades.length
            ? oportunidades.map(tarjetaOportunidad).join('')
            : '<div class="card card--pad" style="text-align:center;grid-column:1/-1;padding:48px 16px"><i data-lucide="briefcase-business" class="i" style="width:36px;height:36px;color:var(--text-3);margin:0 auto 12px"></i><h3>Sin publicaciones con ese filtro</h3><p style="color:var(--text-2);font-size:12px">Los miembros VIP pueden publicar renta de cabinas y aparatología.</p></div>'
          : ''
      }
      ${
        vista === 'conexiones'
          ? data.conexiones.length
            ? data.conexiones
                .map(
                  (c) => `<article class="network-card network-request">
                    <span class="network-avatar">${esc(iniciales(c.otraPersona))}</span>
                    <div>
                      <span class="eyebrow">${c.esEntrante ? 'Solicitud recibida' : 'Solicitud enviada'}</span>
                      <h3>${esc(c.otraPersona)}</h3>
                      <p>${esc(c.mensaje)}</p>
                      ${
                        c.contacto
                          ? `<a class="network-contact" href="${c.contacto.canal === 'correo' ? `mailto:${esc(c.contacto.valor)}` : `https://wa.me/${esc(c.contacto.valor.replace(/\D/g, ''))}`}" target="_blank" rel="noopener">
                              <i data-lucide="${c.contacto.canal === 'correo' ? 'mail' : 'message-circle'}" class="i"></i>Contactar por ${etiqueta(c.contacto.canal)}
                            </a>`
                          : ''
                      }
                    </div>
                    <aside>
                      <span class="network-status network-status--${esc(c.estado)}">${etiqueta(c.estado)}</span>
                      ${
                        c.esEntrante && c.estado === 'pendiente'
                          ? `<button class="btn btn--brand btn--sm" data-network-answer="aceptada" data-id="${esc(c.id)}">Aceptar</button>
                             <button class="btn btn--ghost btn--sm" data-network-answer="rechazada" data-id="${esc(c.id)}">Declinar</button>`
                          : ''
                      }
                    </aside>
                  </article>`
                )
                .join('')
            : '<div class="card card--pad" style="text-align:center;grid-column:1/-1;padding:48px 16px"><i data-lucide="handshake" class="i" style="width:36px;height:36px;color:var(--text-3);margin:0 auto 12px"></i><h3>Aún no tienes solicitudes</h3><p style="color:var(--text-2);font-size:12px">Explora profesionales o espacios para crear tu red estética.</p></div>'
          : ''
      }
    </div>

    ${hayMas ? `<div style="display:flex;justify-content:center;padding-top:20px"><button class="btn btn--secondary" data-network-load-more="${vista === 'personas' ? 'perfiles' : 'oportunidades'}"><i data-lucide="chevrons-down" class="i"></i>Cargar más</button></div>` : ''}

    ${vista === 'personas' ? perfiles.map(detallePersona).join('') : ''}


    <!-- Modal Publicar Oportunidad / Renta -->
    <dialog class="network-dialog" data-network-job-dialog>
      <form method="dialog" data-network-job-form>
        <header>
          <div>
            <span class="eyebrow">Espacios y Aparatología VIP</span>
            <h3>Nueva Oportunidad o Renta</h3>
          </div>
          <button type="button" data-network-close aria-label="Cerrar"><i data-lucide="x" class="i"></i></button>
        </header>
        <div class="network-form-grid">
          <label class="network-form-wide">Título de la publicación<input class="input" name="titulo" required minlength="8" maxlength="120" placeholder="Renta de Cabina Premium por Jornada"></label>
          <label>Tipo de publicación
            <select class="input" name="tipo">
              <option value="renta_cabina">Renta de cabina estética</option>
              <option value="renta_aparatologia">Renta de aparatología</option>
              <option value="interconsulta">Interconsulta clínica</option>
              <option value="suplencia">Suplencia temporal</option>
              <option value="empleo">Vacante para cosmetóloga</option>
            </select>
          </label>
          <label>Modalidad
            <select class="input" name="modalidad">
              <option value="presencial">Presencial en cabina</option>
              <option value="remoto">Remota / Asesoría</option>
              <option value="hibrido">Híbrida</option>
            </select>
          </label>
          <label>Clínica o Centro<input class="input" name="organizacion" required maxlength="120" placeholder="Lumière Esthétique"></label>
          <label>Ciudad<input class="input" name="ciudad" placeholder="Guadalajara"></label>
          <label>Estado<input class="input" name="entidad" placeholder="Jalisco"></label>
          <label>Aparatología o Especialidad<input class="input" name="especialidades" placeholder="HIFU, Láser Diodo, Cabinas"></label>
          <label class="network-form-wide">Descripción y equipamiento<textarea class="input" name="resumen" minlength="40" maxlength="1000" rows="4" required placeholder="Describe las características de la cabina o especificaciones técnicas del equipo..."></textarea></label>
          <label class="network-form-wide">Requisitos<textarea class="input" name="requisitos" maxlength="1000" rows="2" placeholder="Cédula profesional, depósito en garantía o constancia de capacitación."></textarea></label>
          <label class="network-form-wide">Costos y condiciones<input class="input" name="compensacion" maxlength="180" placeholder="$650 MXN / Jornada o condiciones de renta"></label>
        </div>
        <footer>
          <p>Visible durante 45 días. Exclusivo para miembros VIP.</p>
          <button class="btn btn--brand">Publicar oportunidad</button>
        </footer>
      </form>
    </dialog>

    <!-- Modal Solicitar Conexión -->
    <dialog class="network-dialog network-dialog--small" data-network-connect-dialog>
      <form method="dialog" data-network-connect-form>
        <header>
          <div>
            <span class="eyebrow">Contacto Seguro</span>
            <h3>Conectar con <span data-network-name>Colega</span></h3>
          </div>
          <button type="button" data-network-close aria-label="Cerrar"><i data-lucide="x" class="i"></i></button>
        </header>
        <input type="hidden" name="paraUid">
        <input type="hidden" name="oportunidadId">
        <div style="padding:16px 24px">
          <label style="display:grid;gap:6px;font-size:11px;font-weight:700;color:var(--text-2)">
            Mensaje inicial
            <textarea class="input" name="mensaje" required minlength="20" maxlength="500" rows="5" placeholder="Preséntate e indica tu interés en interconsulta, aparatología o vinculación profesional..."></textarea>
          </label>
        </div>
        <footer>
          <p>Tus datos no se compartirán hasta que la contraparte acepte.</p>
          <button class="btn btn--brand">Enviar solicitud</button>
        </footer>
      </form>
    </dialog>

    <!-- Modal Reporte / Denuncia -->
    <dialog class="network-dialog network-dialog--small" data-network-report-dialog>
      <form method="dialog" data-network-report-form>
        <header>
          <div>
            <span class="eyebrow">Comunidad Segura</span>
            <h3>Reportar <span data-network-report-name>contenido</span></h3>
          </div>
          <button type="button" data-network-close aria-label="Cerrar"><i data-lucide="x" class="i"></i></button>
        </header>
        <input type="hidden" name="tipo">
        <input type="hidden" name="objetivoId">
        <div class="network-form-grid">
          <label class="network-form-wide">Motivo del reporte
            <select class="input" name="motivo" required>
              <option value="spam">Spam o publicidad no solicitada</option>
              <option value="suplantacion">Suplantación de identidad</option>
              <option value="contenido_inapropiado">Contenido inapropiado o conducta indebida</option>
              <option value="datos_falsos">Información profesional o certificaciones falsas</option>
              <option value="otro">Otro motivo</option>
            </select>
          </label>
          <label class="network-form-wide">Detalles
            <textarea class="input" name="detalle" maxlength="500" rows="4" placeholder="Describe brevemente la situación..."></textarea>
          </label>
        </div>
        <footer>
          <p><i data-lucide="shield-check" class="i"></i>El equipo de moderación revisará la denuncia de forma confidencial.</p>
          <button class="btn btn--brand"><i data-lucide="flag" class="i"></i>Enviar reporte</button>
        </footer>
      </form>
    </dialog>
  </section>`;
}

export function directorio(_: Record<string, string>, query: URLSearchParams) {
  return `<section class="directory-page" aria-label="Directorio profesional Dermalysse">${directorioPanel(query)}</section>`;
}


// Formulario del Perfil Profesional, como MÓDULO (antes era un <dialog> flotante).
function formularioPerfil(data: ReturnType<typeof Directorio.get>) {
  return `<form data-network-profile-form>
        <header>
          <div>
            <span class="eyebrow">Directorio Dermalysse</span>
            <h3>Perfil Profesional Cosmetológico</h3>
            <p>Tu carta de presentación para interconsultas, colaboración clínica y renta de espacios.</p>
          </div>
          <div style="text-align:right">
            <span style="font-size:11px;font-weight:700;color:var(--primary)">${completitudPerfil(data.miPerfil)}% completo</span>
          </div>
        </header>

        <section class="network-banner-editor ${data.miPerfil?.banner ? 'has-banner' : ''}" data-network-banner-frame>
          ${data.miPerfil?.banner ? `<img src="${esc(data.miPerfil.banner)}" alt="Portada profesional" width="1600" height="560" loading="lazy" decoding="async" data-network-banner-preview>` : '<img alt="Portada profesional" data-network-banner-preview hidden>'}
          <div>
            <span class="eyebrow"><i data-lucide="panel-top" class="i"></i>Portada de tu cabina</span>
            <h4>Destaca tu espacio de atención</h4>
            <p>Sube una foto de tu cabina, consultorio o equipo de aparatología.</p>
            <div style="display:flex;gap:8px;margin-top:10px">
              <label class="btn btn--secondary btn--sm">
                <i data-lucide="image-up" class="i"></i>${data.miPerfil?.banner ? 'Cambiar portada' : 'Subir portada'}
                <input type="file" accept="image/jpeg,image/png,image/webp" data-network-banner-input hidden>
              </label>
              <button type="button" class="btn btn--ghost btn--sm" data-network-banner-remove ${data.miPerfil?.banner ? '' : 'hidden'}>Quitar</button>
            </div>
          </div>
        </section>

        <section class="network-photo-editor">
          <div class="network-photo-editor__avatar" data-network-photo-frame>
            <span data-network-photo-fallback>${esc(iniciales(data.miPerfil?.nombre || Perfil.get().nombre))}</span>
            ${data.miPerfil?.foto ? `<img src="${esc(data.miPerfil.foto)}" alt="Foto profesional" width="720" height="720" loading="lazy" decoding="async" data-network-photo-preview>` : '<img alt="Foto profesional" data-network-photo-preview hidden>'}
          </div>
          <div>
            <span class="eyebrow">Foto de perfil</span>
            <h4 style="font-size:15px;font-weight:700">Tu imagen profesional</h4>
            <p style="font-size:11px;color:var(--text-3)">Formato JPG, PNG o WebP de hasta 8 MB. Se optimiza automáticamente.</p>
            <div style="display:flex;gap:8px;margin-top:8px">
              <label class="btn btn--secondary btn--sm">
                <i data-lucide="upload" class="i"></i>${data.miPerfil?.foto ? 'Cambiar foto' : 'Subir foto'}
                <input type="file" accept="image/jpeg,image/png,image/webp" data-network-photo-input hidden>
              </label>
              <button type="button" class="btn btn--ghost btn--sm" data-network-photo-remove ${data.miPerfil?.foto ? '' : 'hidden'}>Quitar</button>
            </div>
          </div>
        </section>

        <div class="network-form-grid">
          <label class="network-form-wide">Titular profesional<input class="input" name="titular" value="${esc(data.miPerfil?.titular || '')}" required maxlength="100" placeholder="Cosmiatra Médica · Especialista en Aparatología Avanzada"></label>
          <label>Rol principal
            <select class="input" name="etapa" required>
              ${['cosmetologa', 'cosmiatra', 'clinica_estetica', 'medico_estetico', 'docente', 'estudiante', 'otro']
                .map((x) => `<option value="${x}" ${data.miPerfil?.etapa === x ? 'selected' : ''}>${etiqueta(x)}</option>`)
                .join('')}
            </select>
          </label>
          <label>Especialidades y técnicas<input class="input" name="especialidades" value="${listaCSV(data.miPerfil?.especialidades || [])}" placeholder="Láser Diodo, Peelings, Rejuvenecimiento"></label>
          <label>Ciudad<input class="input" name="ciudad" value="${esc(data.miPerfil?.ciudad || '')}" placeholder="San Pedro Garza García"></label>
          <label>Estado / Entidad<input class="input" name="estado" value="${esc(data.miPerfil?.estado || '')}" placeholder="Nuevo León"></label>
          <label>Aparatología y equipos dominados<input class="input" name="habilidades" value="${listaCSV(data.miPerfil?.habilidades || [])}" placeholder="HIFU 7D, Dermapen, Radiofrecuencia"></label>
          <label>Años de experiencia<input class="input" type="number" name="anosExperiencia" min="0" max="70" value="${data.miPerfil?.anosExperiencia ?? ''}" placeholder="8"></label>
          <label>Idiomas<input class="input" name="idiomas" value="${listaCSV(data.miPerfil?.idiomas || [])}" placeholder="Español, Inglés"></label>
          <label class="network-form-wide">Presentación y enfoque<textarea class="input" name="bio" rows="4" minlength="30" maxlength="600" required placeholder="Describe tu experiencia en cabina, protocolos estrella y tipo de vinculación que buscas...">${esc(data.miPerfil?.bio || '')}</textarea></label>
          
          <fieldset class="network-form-wide">
            <legend>Disponible para</legend>
            ${['interconsulta', 'renta_cabina', 'renta_aparatologia', 'suplencia', 'capacitacion', 'colaboraciones']
              .map((x) => `<label style="display:inline-flex;align-items:center;gap:4px;margin-right:12px"><input type="checkbox" name="disponibilidad" value="${x}" ${data.miPerfil?.disponibilidad.includes(x) ? 'checked' : ''}> ${etiqueta(x)}</label>`)
              .join('')}
          </fieldset>

          <label>Modalidad de atención
            <select class="input" name="modalidad">
              ${['presencial', 'remoto', 'hibrido'].map((x) => `<option value="${x}" ${data.miPerfil?.modalidades.includes(x) ? 'selected' : ''}>${etiqueta(x)}</option>`).join('')}
            </select>
          </label>
        </div>

        <!-- Secciones dinámicas de Experiencia y Formación -->
        <div style="padding:0 24px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h4 style="font-size:14px;font-weight:700">Experiencia en cabina y centros</h4>
            <button class="btn btn--secondary btn--sm" type="button" data-network-add-row="experiencia"><i data-lucide="plus" class="i"></i>Agregar cabina</button>
          </div>
          <div class="network-repeat-list" data-network-repeat-list="experiencia">${(data.miPerfil?.experiencia || []).map(filaExperiencia).join('')}</div>
          <template data-network-template="experiencia">${filaExperiencia()}</template>

          <div style="display:flex;align-items:center;justify-content:space-between;margin:20px 0 12px">
            <h4 style="font-size:14px;font-weight:700">Formación y Certificaciones</h4>
            <div style="display:flex;gap:6px">
              <button class="btn btn--ghost btn--sm" type="button" data-network-add-row="formacion"><i data-lucide="plus" class="i"></i>Grado</button>
              <button class="btn btn--ghost btn--sm" type="button" data-network-add-row="credenciales"><i data-lucide="plus" class="i"></i>Certificado</button>
            </div>
          </div>
          <div class="network-repeat-list" data-network-repeat-list="formacion">${(data.miPerfil?.formacion || []).map(filaFormacion).join('')}</div>
          <div class="network-repeat-list" data-network-repeat-list="credenciales" style="margin-top:10px">${(data.miPerfil?.credenciales || []).map(filaCredencial).join('')}</div>
          <template data-network-template="formacion">${filaFormacion()}</template>
          <template data-network-template="credenciales">${filaCredencial()}</template>
        </div>

        <!-- Privacidad y contacto -->
        <div class="network-form-grid" style="border-top:1px solid var(--line, #e7eef2);margin-top:20px">
          <label>Canal de contacto protegido
            <select class="input" name="contactoCanal">
              <option value="correo" ${data.miPerfil?.contacto?.canal !== 'whatsapp' ? 'selected' : ''}>Correo de mi cuenta</option>
              <option value="whatsapp" ${data.miPerfil?.contacto?.canal === 'whatsapp' ? 'selected' : ''}>WhatsApp profesional</option>
            </select>
          </label>
          <label data-network-whatsapp ${data.miPerfil?.contacto?.canal === 'whatsapp' ? '' : 'hidden'}>
            Número de WhatsApp
            <input class="input" name="contactoValor" value="${esc(data.miPerfil?.contacto?.canal === 'whatsapp' ? data.miPerfil.contacto.valor : '')}" placeholder="5218110000000">
          </label>
          <label class="network-form-wide" style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" name="visible" value="1" ${data.miPerfil?.visible !== false ? 'checked' : ''}>
            <span><strong>Mostrar mi perfil en el directorio</strong> (si lo desmarcas, tu perfil se oculta del listado público).</span>
          </label>
        </div>

        <footer>
          <div>
            <p><i data-lucide="shield-check" class="i"></i>Tus datos de contacto solo se revelan tras aceptar una conexión.</p>
            ${data.miPerfil ? '<button class="network-delete-profile" type="button" data-network-delete-profile style="margin-top:6px"><i data-lucide="user-round-x" class="i"></i>Eliminar mi perfil del directorio</button>' : ''}
          </div>
          <button class="btn btn--brand"><i data-lucide="badge-check" class="i"></i>Guardar perfil</button>
        </footer>
      </form>`;
}

// Página propia del perfil: #/directorio/perfil. El botón "Crear/Editar mi perfil" navega aquí.
export function directorioPerfil(_: Record<string, string>, _query: URLSearchParams) {
  const data = Directorio.get();
  const titulo = data.miPerfil ? 'Editar mi perfil' : 'Crear mi perfil';
  return `<section class="directory-page directory-page--perfil" aria-label="${titulo}">
    <a class="network-profile-page__back" href="#/directorio"><i data-lucide="arrow-left" class="i"></i>Volver al directorio</a>
    <div class="network-dialog network-dialog--profile network-profile-page">${formularioPerfil(data)}</div>
  </section>`;
}
