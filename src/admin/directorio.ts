// Admin · moderación de perfiles clínicos, renta de cabinas y reportes del directorio Dermalysse.
import { Datos } from '../core/datos';
import { esc } from '../ui/partials';
import { adminHead } from './shell';
import { vacio } from './contenido';
import { AdminRemoto, type ReporteAdmin, type PerfilAdminDirectorio } from './remoto';

const MOTIVOS_ETIQUETA: Record<string, string> = {
  spam: 'Spam comercial',
  suplantacion: 'Suplantación de identidad',
  contenido_inapropiado: 'Contenido inapropiado',
  datos_falsos: 'Cédula / datos apócrifos',
  otro: 'Otro motivo',
};

const DEMO_REPORTES: ReporteAdmin[] = [
  {
    id: 'rep-demo-1',
    reportanteUid: 'demo-user-1',
    tipo: 'perfil',
    objetivoId: 'demo-sofia',
    motivo: 'datos_falsos',
    detalle: 'La cédula de cosmiatría clínica registrada no coincide con el padrón estatal de salud.',
    resumenObjetivo: 'Lic. Sofía Valenzuela · Cosmiatra Clínica Especialista en HIFU',
    autorUid: 'demo-sofia',
    estado: 'pendiente',
    creado: new Date(Date.now() - 3600000 * 3).toISOString(),
    actualizado: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
];

const DEMO_PERFILES: PerfilAdminDirectorio[] = [
  {
    uid: 'demo-sofia',
    nombre: 'Lic. Sofía Valenzuela',
    titular: 'Cosmiatra Clínica Especialista en HIFU y Rejuvenecimiento',
    etapa: 'cosmiatra',
    especialidades: ['Anti-edad y Flacidez', 'HIFU 7D', 'Peelings Químicos'],
    aparatologia: ['HIFU', 'Radiofrecuencia Fraccionada'],
    ciudad: 'Guadalajara',
    estado: 'Jalisco',
    visible: true,
    actualizado: new Date().toISOString(),
  },
  {
    uid: 'demo-camila',
    nombre: 'Dra. Camila Morales',
    titular: 'Médico Estético · Especialista en Armonización Facial y Láser',
    etapa: 'medico_estetico',
    especialidades: ['Láser Diodo', 'Armonización Facial', 'Bioestimuladores'],
    aparatologia: ['Láser Diodo', 'Dermapen'],
    ciudad: 'Ciudad de México',
    estado: 'CDMX',
    visible: true,
    actualizado: new Date().toISOString(),
  },
  {
    uid: 'demo-lumiere',
    nombre: 'Cosm. Regina Alatorre',
    titular: 'Dueña de Cabina · Cabina Spa Lumière Providencia',
    etapa: 'duena_cabina',
    especialidades: ['Renta de Cabinas', 'Protocolos Corporales'],
    aparatologia: ['Cavitación', 'Presoterapia'],
    ciudad: 'Monterrey',
    estado: 'Nuevo León',
    visible: true,
    actualizado: new Date().toISOString(),
  },
];

function obtenerReportes(): ReporteAdmin[] {
  if (Datos.modo === 'api') {
    return AdminRemoto.reportesDirectorio();
  }
  try {
    const raw = localStorage.getItem('dermalysse_admin_directorio_reportes');
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEMO_REPORTES;
}

export function guardarReportesDemo(lista: ReporteAdmin[]) {
  try {
    localStorage.setItem('dermalysse_admin_directorio_reportes', JSON.stringify(lista));
  } catch {}
}

function obtenerPerfiles(): PerfilAdminDirectorio[] {
  if (Datos.modo === 'api') {
    return AdminRemoto.perfilesDirectorio();
  }
  try {
    const raw = localStorage.getItem('dermalysse_admin_directorio_perfiles');
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEMO_PERFILES;
}

export function guardarPerfilesDemo(lista: PerfilAdminDirectorio[]) {
  try {
    localStorage.setItem('dermalysse_admin_directorio_perfiles', JSON.stringify(lista));
  } catch {}
}

export function adminDirectorio() {
  const reportes = obtenerReportes();
  const perfiles = obtenerPerfiles();

  const pendientes = reportes.filter((r) => r.estado === 'pendiente');
  const atendidos = reportes.filter((r) => r.estado !== 'pendiente');
  const visibles = perfiles.filter((p) => p.visible);

  const kpi = (icon: string, label: string, valor: string, nota: string) => `
    <div class="kpi">
      <span class="kpi__ic"><i data-lucide="${icon}" class="i"></i></span>
      <span class="kpi__label">${label}</span>
      <strong class="kpi__val">${valor}</strong>
      <span class="kpi__nota">${nota}</span>
    </div>`;

  return `
  ${adminHead('Directorio Clínico & Red Profesional', 'Moderación de perfiles cosmetológicos, cabinas y atención de denuncias comunitarias.')}
  <div class="kpis">
    ${kpi('users', 'Especialistas en red', String(perfiles.length), `${visibles.length} perfiles activos en directorio`)}
    ${kpi('shield-alert', 'Denuncias pendientes', String(pendientes.length), pendientes.length === 0 ? 'Sin denuncias activas' : 'Requieren revisión clínica')}
    ${kpi('shield-check', 'Denuncias atendidas', String(atendidos.length), 'Descartadas o sancionadas')}
    ${kpi('eye-off', 'Perfiles ocultos', String(perfiles.length - visibles.length), 'Suspendidos o en revisión')}
  </div>

  <section class="stack" style="gap:16px">
    <div class="section-head" style="margin-top:8px">
      <div>
        <h2 class="display" style="font-size:var(--fs-xl)">Denuncias pendientes de moderación</h2>
        <p class="muted" style="font-size:var(--fs-sm)">Reportes emitidos por cosmetólogas, cosmiatras o dueñas de cabina.</p>
      </div>
    </div>

    ${pendientes.length ? `<div class="stack" style="gap:12px">${pendientes.map((r) => `
      <div class="card card--pad stack" style="gap:12px;border-left:4px solid var(--accent)">
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div class="row" style="gap:8px">
            <span class="chip chip--accent">${esc(MOTIVOS_ETIQUETA[r.motivo] || r.motivo)}</span>
            <span class="chip chip--secondary">${r.tipo === 'perfil' ? 'Perfil especialista' : 'Oportunidad / Cabina'}</span>
          </div>
          <span class="faint" style="font-size:var(--fs-xs)">${new Date(r.creado).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div>
          <strong style="font-size:var(--fs-md)">${esc(r.resumenObjetivo || r.objetivoId)}</strong>
          ${r.detalle ? `<p class="muted" style="font-size:var(--fs-sm);margin-top:6px;background:var(--surface);padding:10px 14px;border-radius:var(--radius-sm)">«${esc(r.detalle)}»</p>` : ''}
          <div class="row faint" style="gap:16px;font-size:var(--fs-xs);margin-top:6px">
            <span>ID objetivo: <code class="mono">${esc(r.objetivoId)}</code></span>
            <span>Denunciante: <code class="mono">${esc(r.reportanteUid)}</code></span>
          </div>
        </div>
        <div class="row" style="justify-content:flex-end;gap:10px;margin-top:4px">
          <button class="btn btn--sm btn--secondary" data-admin-reporte-descartar="${esc(r.id)}">
            <i data-lucide="check" class="i"></i>Descartar reporte
          </button>
          ${r.tipo === 'perfil' ? `
            <button class="btn btn--sm btn--danger" data-admin-reporte-ocultar="${esc(r.id)}" data-uid="${esc(r.objetivoId)}">
              <i data-lucide="eye-off" class="i"></i>Ocultar perfil
            </button>` : `
            <button class="btn btn--sm btn--danger" data-admin-reporte-cerrar="${esc(r.id)}" data-op-id="${esc(r.objetivoId)}">
              <i data-lucide="x-circle" class="i"></i>Cerrar oportunidad
            </button>`}
        </div>
      </div>`).join('')}</div>` : vacio('Bandeja limpia', 'No hay reportes pendientes en el directorio clínico.')}
  </section>

  <section class="stack" style="gap:16px;margin-top:16px">
    <div class="section-head">
      <div>
        <h2 class="display" style="font-size:var(--fs-xl)">Especialistas en el Directorio Dermalysse</h2>
        <p class="muted" style="font-size:var(--fs-sm)">Control de visibilidad y acceso de cosmiatras y dueñas de cabina.</p>
      </div>
    </div>

    ${perfiles.length ? `
    <div class="card" style="overflow:hidden">
      <div style="overflow-x:auto">
        <table class="table" style="width:100%;text-align:left;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid var(--border);font-size:var(--fs-xs);color:var(--text-muted)">
              <th style="padding:12px 16px">Especialista</th>
              <th style="padding:12px 16px">Titular / Aparatología</th>
              <th style="padding:12px 16px">Ubicación</th>
              <th style="padding:12px 16px">Estado</th>
              <th style="padding:12px 16px;text-align:right">Acción</th>
            </tr>
          </thead>
          <tbody>
            ${perfiles.map((p) => `
            <tr style="border-bottom:1px solid var(--border);font-size:var(--fs-sm)">
              <td style="padding:12px 16px">
                <strong>${esc(p.nombre)}</strong>
                <div class="faint mono" style="font-size:11px">${esc(p.uid)}</div>
              </td>
              <td style="padding:12px 16px">
                <div>${esc(p.titular)}</div>
                <div class="row" style="gap:4px;margin-top:4px">
                  ${p.especialidades.slice(0, 2).map((e) => `<span class="chip chip--xs">${esc(e)}</span>`).join('')}
                  ${(p.aparatologia || []).slice(0, 1).map((a) => `<span class="chip chip--xs chip--accent">${esc(a)}</span>`).join('')}
                </div>
              </td>
              <td style="padding:12px 16px">${esc(p.ciudad ? `${p.ciudad}, ${p.estado}` : p.estado || 'México')}</td>
              <td style="padding:12px 16px">
                <span class="chip ${p.visible ? 'chip--primary' : 'chip--danger'}">
                  ${p.visible ? 'Visible' : 'Oculto'}
                </span>
              </td>
              <td style="padding:12px 16px;text-align:right">
                <button class="btn btn--xs ${p.visible ? 'btn--secondary' : 'btn--brand'}" data-admin-perfil-toggle="${esc(p.uid)}" data-visible="${p.visible}">
                  <i data-lucide="${p.visible ? 'eye-off' : 'eye'}" class="i"></i>${p.visible ? 'Ocultar' : 'Reactivar'}
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : vacio('Sin perfiles', 'No hay especialistas registradas en el directorio.')}
  </section>`;
}
