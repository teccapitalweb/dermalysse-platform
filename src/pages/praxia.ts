import { BRAND } from '../core/brand';
import { esc } from '../ui/partials';

export function paginaPraxia() {
  return `<section class="praxia-page">
    <header class="praxia-page__hero">
      <div class="praxia-page__copy">
        <span class="praxia-page__eyebrow"><i data-lucide="sparkles" class="i"></i>Software para consultorios · TEC Capital</span>
        <h1 class="display display--black">Tu práctica merece un sistema, <em>no herramientas dispersas.</em></h1>
        <p>Praxia Medical reúne la operación cotidiana del consultorio en un solo espacio: pacientes, documentos emitidos, agenda, recordatorios y reportes.</p>
        <div class="praxia-page__features"><span><i data-lucide="users" class="i"></i>Pacientes</span><span><i data-lucide="file-badge" class="i"></i>Documentos</span><span><i data-lucide="calendar-days" class="i"></i>Agenda</span><span><i data-lucide="chart-no-axes-column-increasing" class="i"></i>Reportes</span></div>
        <div class="praxia-page__actions"><a class="btn btn--white btn--lg btn--pill-arrow" href="${esc(BRAND.praxia)}" target="_blank" rel="noopener">Explorar Praxia <span class="arrow"><i data-lucide="arrow-up-right" class="i"></i></span></a><a class="praxia-page__back" href="#/herramientas"><i data-lucide="arrow-left" class="i"></i>Volver a Herramientas</a></div>
        <small class="praxia-page__note"><i data-lucide="info" class="i"></i>El acceso o beneficio para miembros se confirma por separado con el equipo; esta pantalla no activa automáticamente una cuenta.</small>
      </div>
      <div class="praxia-page__screen"><span class="praxia-page__screen-label">PRAXIA / DOCUMENTOS</span><img src="/praxia/captura-1.webp" alt="Vista de documentos emitidos en Praxia Medical"></div>
    </header>
    <div class="praxia-page__cards"><article><span><i data-lucide="file-check-2" class="i"></i></span><h2>Documentos emitidos</h2><p>Consulta documentos profesionales, folios y estados desde un registro central.</p></article><article><span><i data-lucide="calendar-check" class="i"></i></span><h2>Agenda de consultorio</h2><p>Organiza citas por mes, semana o día y conserva una lectura clara de su estado.</p></article><article><span><i data-lucide="bell-ring" class="i"></i></span><h2>Seguimiento operativo</h2><p>Centraliza recordatorios e indicadores para mantener la práctica en movimiento.</p></article></div>
    <figure class="praxia-page__agenda"><figcaption><span>Agenda visual</span><strong>Tu día, semana y mes en una sola vista.</strong></figcaption><img src="/praxia/captura-2.webp" alt="Agenda mensual de Praxia Medical"></figure>
  </section>`;
}
