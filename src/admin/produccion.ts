// Inicio del admin en producción mientras 'adminGestion' esté apagado (src/core/funciones.ts):
// lo único con servidor es la revisión editorial de la Academia; el resto vive en el panel actual.
import { adminHead, tarjetaAdminLegado } from './shell';

export function adminInicioProduccion(): string {
  const legado = tarjetaAdminLegado('pagina');
  return `
  ${adminHead('Administración', 'Club Dermalysse · herramientas disponibles en el club nuevo')}
  <div class="admin-prod">
    <a class="card card--pad card--hover admin-prod__academia" href="#/admin/academia">
      <span class="admin-legado__ic" aria-hidden="true"><i data-lucide="book-open-text" class="i"></i></span>
      <div>
        <h2>Academia</h2>
        <p class="muted">Revisa y aprueba los módulos de lectura y ajusta su calendario de lanzamiento.</p>
      </div>
      <span class="circle-btn" aria-hidden="true"><i data-lucide="arrow-right" class="i"></i></span>
    </a>
    ${legado || '<p class="muted admin-prod__nota">Las demás secciones de administración se habilitarán aquí cuando estén conectadas al servidor.</p>'}
  </div>`;
}
