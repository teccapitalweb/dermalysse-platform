// Panel admin · Academia: revisión editorial de módulos.
// El estado efectivo (lo que ven los miembros) es la revisión guardada desde aquí; si no existe,
// cuenta el «estado» escrito en el JSON. Solo «aprobado» se publica.
import { createIcons, icons } from 'lucide';
import { adminHead } from './shell';
import { alternarModoRevisorDemo, cargarRevisionAcademia, modoRevisorDemo, revisarModulo, type EstadoRevision, type ProgramaRevision } from '../core/academia';
import { mensajeError } from '../core/auth';
import { Datos } from '../core/datos';
import { esc } from '../ui/partials';

const ic = (n: string) => `<i data-lucide="${n}" class="i" aria-hidden="true"></i>`;
const ETIQUETA: Record<string, string> = { borrador: 'Borrador', revision: 'En revisión', aprobado: 'Aprobado' };
const fecha = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const chipEstado = (estado: string | null) => `<span class="ac-estado-chip" data-estado="${esc(estado || 'borrador')}">${esc(ETIQUETA[estado || 'borrador'] || estado || '')}</span>`;

export async function adminAcademia() {
  const cabeza = adminHead('Academia', 'Revisa cada módulo antes de publicarlo. Solo los aprobados los ven los miembros.');
  let programas: ProgramaRevision[];
  try { programas = await cargarRevisionAcademia(); }
  catch (e) { return `${cabeza}<div class="card card--pad" role="alert"><strong>No se pudo cargar la revisión de la Academia.</strong><p class="muted">${esc(mensajeError(e))}</p></div>`; }
  const filas = programas.flatMap((p) => p.modulos.map((m) => ({ p, m })));
  const escritos = filas.filter((f) => f.m.existe).length;
  const aprobados = filas.filter((f) => f.m.estado === 'aprobado').length;
  const enRevision = filas.filter((f) => f.m.estado === 'revision').length;
  const dato = (etiqueta: string, valor: number) => `<div class="card card--pad"><span class="ac-admin__eyebrow">${etiqueta}</span><div class="display" style="font-size:var(--fs-xl)">${valor}</div></div>`;
  return `${cabeza}
  <section class="ac ac-admin" data-ac-admin>
    <div class="grid grid--4">${dato('Módulos en catálogo', filas.length)}${dato('Escritos', escritos)}${dato('En revisión', enRevision)}${dato('Publicados', aprobados)}</div>
    <p class="ac-nota">${ic('shield-check')}Aprueba un módulo solo cuando una profesional (dermatóloga o cosmetóloga con cédula) haya revisado su contenido. La nota queda guardada con la decisión.</p>
    ${Datos.modo === 'demo' ? `<div class="ac-admin__demo"><p class="ac-nota">${ic('flask-conical')}Demo: las decisiones se guardan en este navegador y no publican nada.</p><button type="button" class="btn ${modoRevisorDemo() ? 'btn--brand' : 'btn--secondary'} btn--sm" data-ac-modo-revisor aria-pressed="${modoRevisorDemo()}">${ic(modoRevisorDemo() ? 'lock-open' : 'lock')}Modo revisor: ${modoRevisorDemo() ? 'todos los módulos abiertos' : 'desactivado'}</button></div>` : ''}
    ${programas.map((p) => `
    <details class="card ac-admin__prog" ${p.modulos.some((m) => m.existe) ? 'open' : ''}>
      <summary><span><strong>${p.numero ? `${String(p.numero).padStart(2, '0')} · ` : ''}${esc(p.titulo)}</strong><small>${esc(p.area)} · ${p.modulos.filter((m) => m.existe).length} de ${p.modulos.length} escritos · ${p.modulos.filter((m) => m.estado === 'aprobado').length} aprobados</small></span>${ic('chevron-down')}</summary>
      <div class="dtable-wrap ac-admin__tabla" tabindex="0" role="region" aria-label="Módulos de ${esc(p.titulo)}">
        <table class="dtable">
          <thead><tr><th scope="col">Módulo</th><th scope="col">Estado</th><th scope="col">Contenido</th><th scope="col">Nota de revisión</th><th scope="col">Acciones</th></tr></thead>
          <tbody>${p.modulos.map((m) => `
            <tr data-ac-fila="${esc(p.id)}|${m.n}">
              <th scope="row"><span class="mono">${String(m.n).padStart(2, '0')}</span> ${esc(m.titulo)}</th>
              <td>${m.existe ? `${chipEstado(m.estado)}<small class="ac-admin__meta">${m.revision ? `Revisado ${fecha(m.revision.fecha)}` : 'Sin revisión'}${m.estadoArchivo && m.estadoArchivo !== m.estado ? ` · archivo: ${esc(ETIQUETA[m.estadoArchivo] || m.estadoArchivo)}` : ''}</small>` : '<span class="ac-admin__meta">Sin escribir</span>'}</td>
              <td>${m.existe ? `<small>${m.temas} temas · ${m.palabras.toLocaleString('es-MX')} palabras · ${m.figuras} figuras · ${m.actividades} actividades · ${m.preguntas} preguntas</small>` : ''}</td>
              <td>${m.existe ? `<input class="input ac-admin__nota" data-ac-nota maxlength="500" placeholder="Observaciones (opcional)" value="${esc(m.nota || '')}" aria-label="Nota de revisión del módulo ${m.n}">` : ''}</td>
              <td>${m.existe ? `<div class="row ac-admin__acciones">
                <a class="btn btn--ghost btn--sm" href="#/academia/${encodeURIComponent(p.id)}/${m.n}" target="_blank" rel="noopener">${ic('eye')}Vista previa</a>
                ${m.estado !== 'aprobado' ? `<button type="button" class="btn btn--brand btn--sm" data-ac-revisar="aprobado">${ic('badge-check')}Aprobar</button>` : ''}
                ${m.estado !== 'revision' ? `<button type="button" class="btn btn--secondary btn--sm" data-ac-revisar="revision">${ic('message-square-text')}A revisión</button>` : ''}
                ${m.estado !== 'borrador' ? `<button type="button" class="btn btn--secondary btn--sm" data-ac-revisar="borrador">${ic('undo-2')}A borrador</button>` : ''}
              </div>` : ''}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </details>`).join('')}
  </section>`;
}

let abortar: AbortController | null = null;
export function montarAdminAcademia(toast: (msg: string, icon?: string) => void, repintar: () => void) {
  abortar?.abort(); abortar = null;
  const root = document.querySelector<HTMLElement>('[data-ac-admin]');
  if (!root) return;
  abortar = new AbortController();
  root.addEventListener('click', async (e) => {
    if ((e.target as HTMLElement).closest('[data-ac-modo-revisor]')) {
      alternarModoRevisorDemo();
      toast(modoRevisorDemo() ? 'Modo revisor activado: puedes abrir todos los módulos' : 'Modo revisor desactivado', modoRevisorDemo() ? 'lock-open' : 'lock');
      repintar();
      return;
    }
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-ac-revisar]');
    if (!b) return;
    const fila = b.closest<HTMLElement>('[data-ac-fila]')!;
    const [p, n] = fila.dataset.acFila!.split('|');
    const estado = b.dataset.acRevisar as EstadoRevision;
    const nota = fila.querySelector<HTMLInputElement>('[data-ac-nota]')?.value.trim() || '';
    if (/[<>]/.test(nota)) { toast('La nota no puede contener los signos < o >.', 'circle-alert'); return; }
    if (estado === 'aprobado' && !confirm('¿Publicar este módulo para los miembros? Confirma que una profesional revisó su contenido.')) return;
    fila.querySelectorAll('button').forEach((x) => (x.disabled = true));
    try {
      await revisarModulo(p, Number(n), estado, nota);
      toast(estado === 'aprobado' ? 'Módulo aprobado y publicado' : estado === 'revision' ? 'Módulo enviado a revisión' : 'Módulo devuelto a borrador', 'check');
      repintar();
    } catch (err) {
      fila.querySelectorAll('button').forEach((x) => (x.disabled = false));
      toast(mensajeError(err), 'circle-alert');
    }
  }, { signal: abortar.signal });
  createIcons({ icons, root });
}
