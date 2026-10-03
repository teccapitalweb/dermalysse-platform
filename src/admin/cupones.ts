import { Datos } from '../core/datos';
import { esc } from '../ui/partials';
import { adminHead } from './shell';
import { AdminRemoto, type LoteCupones } from './remoto';

let ultimoLote: LoteCupones | null = null;
export function mostrarLoteCupones(lote: LoteCupones) { ultimoLote = lote; }

const duracion = (clave: string, dias: number | null) => ({
  '15d': '15 días', '1m': '1 mes', '3m': '3 meses', '1y': '1 año',
  personalizada: `${dias} días`,
} as Record<string, string>)[clave] || clave;

export function adminCupones() {
  const lista = AdminRemoto.cupones();
  const creados = lista.length;
  const disponibles = lista.filter((c) => c.activo && c.usos < c.maxUsos).length;
  return `
    ${adminHead('Cupones de acceso', 'Genera invitaciones VIP sin modificar las suscripciones ni las cortesías.', '<button class="btn btn--secondary" type="button" data-refrescar-cupones><i data-lucide="refresh-cw" class="i"></i>Actualizar usos</button>')}
    ${Datos.modo === 'demo' ? '<div class="card card--pad">Vista de demostración: para crear y canjear códigos reales, abre el club conectado a la API.</div>' : ''}
    <div class="kpis">
      <div class="kpi"><span class="kpi__label">Códigos creados</span><strong class="kpi__val">${creados}</strong></div>
      <div class="kpi"><span class="kpi__label">Con usos disponibles</span><strong class="kpi__val">${disponibles}</strong></div>
      <div class="kpi"><span class="kpi__label">Canjes realizados</span><strong class="kpi__val">${lista.reduce((n, c) => n + c.usos, 0)}</strong></div>
    </div>
    <div class="admin-grid admin-grid--even">
      <form class="card card--pad stack" data-form="generar-cupones" style="gap:14px">
        <div><h2 class="admin-card-title">Crear invitaciones</h2><p class="muted" style="font-size:var(--fs-sm)">El plazo empieza cuando cada persona canjea su código.</p></div>
        <div class="field"><label>Duración del acceso</label><select class="input" name="duracion" data-duracion-cupon>
          <option value="15d">15 días</option><option value="1m">1 mes</option><option value="3m">3 meses</option><option value="1y">1 año</option><option value="personalizada">Otra duración en días</option>
        </select></div>
        <div class="field" data-dias-cupon hidden><label>Días de acceso</label><input class="input" type="number" name="dias" min="1" max="3650" value="30" disabled></div>
        <div class="field"><label>¿Cómo se repartirán?</label><select class="input" name="modalidad">
          <option value="compartido">Un código para varias personas</option><option value="individuales">Un código diferente por persona</option>
        </select></div>
        <div class="field"><label>Cantidad de personas</label><input class="input" type="number" name="cantidad" min="1" max="100" value="15" required></div>
        <p class="faint" style="font-size:var(--fs-xs)">Cada cuenta puede usar un mismo código solo una vez. Los códigos no cobran, no cancelan pagos y pueden desactivarse para impedir nuevos canjes.</p>
        <button class="btn btn--brand" ${Datos.modo === 'demo' ? 'disabled' : ''}><i data-lucide="ticket-percent" class="i"></i>Generar códigos</button>
      </form>
      <div class="card card--pad stack" style="gap:14px">
        <div><h2 class="admin-card-title">Última generación</h2><p class="muted" style="font-size:var(--fs-sm)">Copia los códigos y compártelos directamente con las personas elegidas.</p></div>
        ${ultimoLote ? `<div class="chip chip--primary" style="align-self:flex-start">${esc(duracion(ultimoLote.duracion, ultimoLote.dias))} · ${ultimoLote.modalidad === 'compartido' ? `${ultimoLote.cantidad} usos` : `${ultimoLote.cantidad} códigos`}</div>
          <div class="code" style="display:grid;gap:7px;max-height:250px;overflow:auto">${ultimoLote.codigos.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
          <button type="button" class="btn btn--secondary" data-copiar-cupones="${esc(ultimoLote.codigos.join('\n'))}"><i data-lucide="copy" class="i"></i>Copiar ${ultimoLote.codigos.length === 1 ? 'código' : 'todos'}</button>`
          : '<p class="muted">Aquí aparecerán los códigos recién creados. También estarán en el historial.</p>'}
      </div>
    </div>
    <div class="card dtable-wrap"><table class="dtable"><thead><tr><th>Código</th><th>Duración</th><th>Usos</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
      ${lista.map((c) => `<tr><td><code class="mono">${esc(c.codigo)}</code></td><td>${esc(duracion(c.duracion, c.dias))}</td><td>${c.usos} / ${c.maxUsos}</td>
        <td><span class="chip ${c.activo && c.usos < c.maxUsos ? 'chip--primary' : ''}">${!c.activo ? 'Desactivado' : c.usos >= c.maxUsos ? 'Agotado' : 'Disponible'}</span></td>
        <td><div class="row" style="gap:6px"><button class="btn btn--ghost btn--xs" type="button" data-copiar-cupon="${esc(c.codigo)}" aria-label="Copiar código"><i data-lucide="copy" class="i"></i></button><button class="btn btn--secondary btn--sm" type="button" data-activar-cupon="${esc(c.codigo)}" data-activo="${c.activo}">${c.activo ? 'Desactivar' : 'Reactivar'}</button></div></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Todavía no hay cupones.</td></tr>'}
    </tbody></table></div>`;
}
