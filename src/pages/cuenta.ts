import { Perfil } from '../core/perfil';
import { BRAND, wa } from '../core/brand';
import { Progreso } from '../core/progreso';
import { puntos } from '../core/logros';
import { esc } from '../ui/partials';
import { api, Auth, mensajeError } from '../core/auth';
import { Datos } from '../core/datos';
import { resumenExperienciaHTML } from '../ui/experiencia';

export function perfil() {
  const p = Perfil.get();
  const plan = BRAND.planes.find((x) => x.id === p.plan);
  const accesoTemporal = p.plan === 'cupon' ? 'Acceso por cupón' : p.plan === 'cortesia' ? 'Acceso de cortesía' : '';
  return `
  <section class="stack" style="gap:20px;max-width:900px">
    <div class="section-head"><div><span class="chip chip--primary">Mi perfil</span><h1 class="display" style="font-size:var(--fs-2xl)">Hola, <em>${esc(Perfil.primerNombre())}</em></h1></div></div>
    ${resumenExperienciaHTML()}
    <div class="grid" style="grid-template-columns:1fr 320px;gap:20px;align-items:start">
      <form class="card card--pad stack" data-form-perfil style="gap:14px">
        <div class="row" style="gap:14px"><div class="avatar avatar--lg">${Perfil.iniciales()}</div><div><strong>Foto de perfil</strong><br><span class="faint" style="font-size:var(--fs-xs)">Se sube desde el admin en la Fase 2 · por ahora, iniciales</span></div></div>
        <div class="field"><label>Nombre completo (así saldrá en tus certificados)</label><input class="input" name="nombre" value="${esc(p.nombre)}" required maxlength="60" placeholder="Dra. Nombre Apellido Apellido"></div>
        <div class="grid grid--2" style="gap:12px">
          <div class="field"><label>WhatsApp</label><input class="input" name="whatsapp" value="${esc(p.whatsapp)}" placeholder="+52 1 236 123 4567"></div>
          <div class="field"><label>Especialidad</label><input class="input" name="especialidad" value="${esc(p.especialidad)}" placeholder="Cosmetología, estética, dermatología…"></div>
        </div>
        <div class="field"><label>Ciudad</label><input class="input" name="ciudad" value="${esc(p.ciudad)}" placeholder="Puebla, Pue."></div>
        <div class="row" style="justify-content:flex-end"><button class="btn btn--brand btn--pill-arrow">Guardar cambios <span class="arrow"><i data-lucide="check" class="i"></i></span></button></div>
      </form>
      <div class="stack">
        <div class="card card--pad stack" style="gap:10px;background:var(--brand-navy);color:#fff;border:0">
          <span class="eyebrow" style="color:var(--brand-teal)">Tu membresía</span>
          <div class="display" style="font-size:var(--fs-xl)">${plan ? plan.nombre : accesoTemporal || 'Invitado'}</div>
          <p style="font-size:var(--fs-sm);opacity:.8">${plan ? `Renueva el ${new Date(p.vence).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })} · $${plan.precio} MXN/${plan.periodo}` : accesoTemporal && p.vence ? `Acceso VIP hasta el ${new Date(p.vence).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.` : 'Activa tu membresía para ver todo el catálogo.'}</p>
          <a class="btn btn--white btn--sm" href="#/suscripcion">Gestionar suscripción</a>
        </div>
        <div class="card card--pad stack" style="gap:8px">
          <span class="eyebrow">Tu actividad</span>
          ${[['Clases vistas', Progreso.totalVistas()], ['Cursos completados', Progreso.completados().length], ['Cursos en marcha', Progreso.enMarcha().length], ['Puntos', puntos()]].map(([l, v]) => `<div class="row" style="justify-content:space-between;font-size:var(--fs-sm)"><span class="muted">${l}</span><strong class="mono">${v}</strong></div>`).join('')}
        </div>
      </div>
    </div>
  </section>`;
}

export async function suscripcion(_params: Record<string, string>, query: URLSearchParams) {
  let avisoPago = '';
  const pago = query.get('pago');
  const sessionId = query.get('session_id');
  if (Datos.modo === 'api' && pago === 'exito' && sessionId) {
    try {
      await api('/stripe/confirmar', { method: 'POST', json: { sessionId } });
      await Auth.refrescarEstado();
      avisoPago = `<div class="card card--pad row" style="gap:12px;border-color:color-mix(in srgb,var(--primary) 35%,var(--line));background:var(--primary-soft)"><span class="circle-btn" style="background:var(--primary);color:#fff"><i data-lucide="badge-check" class="i"></i></span><div><strong>Pago confirmado y membresía activa</strong><p class="muted" style="font-size:var(--fs-sm)">Ya puedes acceder al contenido VIP. Tu recibo y método de pago están disponibles en el portal de facturación.</p></div></div>`;
      history.replaceState(null, '', '#/suscripcion?pago=confirmado');
    } catch (e) {
      avisoPago = `<div class="card card--pad row" style="gap:12px;border-color:var(--accent);background:var(--accent-soft)"><span class="circle-btn" style="color:var(--accent)"><i data-lucide="clock-3" class="i"></i></span><div><strong>Estamos confirmando tu pago</strong><p class="muted" style="font-size:var(--fs-sm)">${esc(mensajeError(e))} Si Stripe ya mostró el cobro como exitoso, no vuelvas a pagar; actualiza esta página en unos segundos.</p></div></div>`;
    }
  } else if (pago === 'confirmado') {
    avisoPago = `<div class="card card--pad row" style="gap:12px;border-color:color-mix(in srgb,var(--primary) 35%,var(--line));background:var(--primary-soft)"><span class="circle-btn" style="background:var(--primary);color:#fff"><i data-lucide="badge-check" class="i"></i></span><div><strong>Pago confirmado</strong><p class="muted" style="font-size:var(--fs-sm)">Tu membresía VIP está activa.</p></div></div>`;
  } else if (pago === 'cancelado') {
    avisoPago = `<div class="card card--pad row" style="gap:12px;border-color:var(--line);background:var(--surface-2)"><span class="circle-btn"><i data-lucide="info" class="i"></i></span><div><strong>No se realizó ningún cobro</strong><p class="muted" style="font-size:var(--fs-sm)">El proceso de pago fue cancelado. Puedes elegir un plan cuando quieras.</p></div></div>`;
  }
  const p = Perfil.get();
  const esVip = Auth.usuario?.esVip === true;
  const planPago = p.plan === 'mensual' || p.plan === 'anual';
  const nombreAcceso = p.plan === 'cupon' ? 'Acceso por cupón' : p.plan === 'cortesia' ? 'Acceso de cortesía' : BRAND.planes.find((x) => x.id === p.plan)?.nombre || 'VIP';
  const perks = [
    ['play-circle', 'Todos los cursos grabados'],
    ['book-open', 'Materiales y biblioteca completa'],
    ['radio', 'Encuentros y sesiones educativas'],
    ['award', 'Certificados de cada curso'],
    ['gamepad-2', 'Modo Historia y retos interactivos'],
    ['headset', 'Soporte prioritario por WhatsApp'],
  ];
  const mensual = BRAND.planes.find((x) => x.id === 'mensual');
  const anual = BRAND.planes.find((x) => x.id === 'anual');
  const precioMesAnual = anual && mensual ? Math.round(anual.precio / 12) : null;
  return `
  <section class="sus stack" style="gap:28px;max-width:920px">
    ${avisoPago}

    <div class="sus-hero">
      <div class="sus-hero__content">
        <span class="sus-hero__badge"><i data-lucide="crown" class="i"></i>${esVip ? 'Tu membresía' : 'Membresía VIP'}</span>
        <h1 class="display display--black">${esVip ? `${nombreAcceso} activo` : 'Desbloquea todo el club'}</h1>
        <p>${esVip && p.vence ? `Tu acceso está vigente hasta el ${new Date(p.vence).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}.` : esVip ? 'Tienes acceso completo al Club Dermalysse.' : 'Cursos, materiales, certificados y herramientas educativas para tu formación Dermalysse.'}</p>
      </div>
      <div class="sus-hero__deco"><i data-lucide="shield-check" class="i"></i></div>
    </div>

    ${!esVip ? `<form class="sus-cupon" data-form-canje-cupon>
      <div class="sus-cupon__icon"><i data-lucide="ticket" class="i"></i></div>
      <div class="sus-cupon__body">
        <strong>¿Tienes un cupón de acceso?</strong>
        <p class="muted">Canjéalo aquí. El tiempo se suma si ya tienes otro cupón activo.</p>
      </div>
      <div class="sus-cupon__form">
        <input class="input" name="codigo" required maxlength="23" autocomplete="off" placeholder="DRM-XXXXXXXX" aria-label="Código de cupón" style="text-transform:uppercase">
        <button class="btn btn--brand" ${Datos.modo === 'demo' ? 'disabled' : ''}>Canjear</button>
      </div>
      ${Datos.modo === 'demo' ? '<p class="sus-cupon__nota faint">El canje real está disponible en el club conectado.</p>' : ''}
    </form>` : ''}

    <div class="sus-planes">
      ${BRAND.planes.length ? '' : '<div class="card card--pad"><strong>Planes en preparación</strong><p class="muted">Los precios y métodos de pago se conectarán cuando Dermalysse los confirme.</p></div>'}
      ${BRAND.planes.map((pl) => {
        const activo = p.plan === pl.id;
        const recomendado = pl.id === 'anual';
        return `
      <div class="sus-plan ${recomendado ? 'sus-plan--best' : ''} ${activo ? 'sus-plan--activo' : ''}">
        ${recomendado && !activo ? '<div class="sus-plan__ribbon">Mejor precio</div>' : ''}
        ${activo ? '<div class="sus-plan__ribbon sus-plan__ribbon--active">Tu plan</div>' : ''}
        <div class="sus-plan__head">
          <strong>${pl.nombre}</strong>
          <div class="sus-plan__price"><span class="sus-plan__amount">$${pl.precio.toLocaleString('es-MX')}</span><span class="sus-plan__period">MXN/${pl.periodo}</span></div>
          ${recomendado && precioMesAnual ? `<span class="sus-plan__equiv">~$${precioMesAnual}/mes</span>` : ''}
        </div>
        <p class="sus-plan__note">${pl.ahorro || 'Cancela cuando quieras'}</p>
        ${activo ? `<button class="btn btn--secondary" disabled style="width:100%">Plan activo</button>` : planPago ? `<button class="btn btn--secondary" data-portal-stripe style="width:100%"><i data-lucide="settings-2" class="i"></i>Administrar plan</button>` : esVip ? `<button class="btn btn--secondary" disabled style="width:100%">Acceso VIP vigente</button>` : `<button class="btn ${recomendado ? 'btn--gradient' : 'btn--brand'} btn--lg" data-cambiar-plan="${pl.id}" style="width:100%">${recomendado ? 'Elegir mejor precio' : 'Elegir plan'}</button>`}
      </div>`;
      }).join('')}
    </div>

    <div class="sus-perks">
      <h2>Todo lo que incluye tu membresía</h2>
      <div class="sus-perks__grid">
        ${perks.map(([ic, txt]) => `<div class="sus-perk"><span class="sus-perk__ic"><i data-lucide="${ic}" class="i"></i></span><span>${txt}</span></div>`).join('')}
      </div>
    </div>

    <div class="sus-trust">
      <div class="sus-trust__item"><i data-lucide="shield-check" class="i"></i><div><strong>Pago seguro</strong><span>Procesado por Stripe</span></div></div>
      <div class="sus-trust__item"><i data-lucide="rotate-ccw" class="i"></i><div><strong>Cancela cuando quieras</strong><span>Sin permanencia mínima</span></div></div>
      <div class="sus-trust__item"><i data-lucide="credit-card" class="i"></i><div><strong>Facturación clara</strong><span>Recibos automáticos</span></div></div>
    </div>

    <div class="card card--pad sus-billing">
      <div class="sus-billing__head"><span class="circle-btn" style="background:var(--primary-soft);color:var(--primary);width:38px;height:38px"><i data-lucide="receipt" class="i"></i></span><div><h3>Facturación y pagos</h3><p class="muted">Administra tu método de pago, consulta recibos o contacta soporte.</p></div></div>
      <div class="sus-billing__actions">${planPago ? '<button class="btn btn--secondary" data-portal-stripe><i data-lucide="credit-card" class="i"></i>Portal de facturación</button>' : ''}<a class="btn btn--ghost" href="${wa('Hola Dermalysse, tengo una duda sobre mi suscripción VIP.')}" target="_blank" rel="noopener"><i data-lucide="message-circle" class="i"></i>Soporte por WhatsApp</a></div>
    </div>
  </section>`;
}

export function configuracion() {
  const p = Perfil.get();
  const sw = (k: keyof typeof p.avisos, l: string, d: string) => `<div class="row" style="justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--line)"><div><strong style="font-size:var(--fs-sm)">${l}</strong><br><span class="faint" style="font-size:var(--fs-xs)">${d}</span></div><button class="switch" role="switch" aria-checked="${p.avisos[k]}" data-aviso="${k}"></button></div>`;
  return `
  <section class="stack" style="gap:20px;max-width:760px">
    <div class="section-head"><div><span class="chip chip--primary">Configuración</span><h1 class="display" style="font-size:var(--fs-2xl)">Ajustes</h1></div></div>
    <div class="card card--pad"><span class="eyebrow">Apariencia</span>
      <div class="row" style="justify-content:space-between;padding:12px 0"><div><strong style="font-size:var(--fs-sm)">Modo oscuro</strong><br><span class="faint" style="font-size:var(--fs-xs)">Solo para esta sesión; el club siempre abre en claro</span></div><button class="btn btn--secondary btn--sm" data-theme-toggle><i data-lucide="moon" class="i"></i>Cambiar</button></div></div>
    <div class="card card--pad"><span class="eyebrow">Avisos</span>${sw('enVivo', 'Clases en vivo', 'Recordatorio antes de cada transmisión')}${sw('nuevos', 'Nuevos cursos y materiales', 'Cuando se publique algo nuevo')}${sw('comunidad', 'Comunidad', 'Respuestas a tus temas')}</div>
    <div class="card card--pad stack" style="gap:10px"><span class="eyebrow">App</span>
      <div class="row" style="justify-content:space-between"><div><strong style="font-size:var(--fs-sm)">Instalar Dermalysse como app</strong><br><span class="faint" style="font-size:var(--fs-xs)">Pantalla completa, más rápido, acceso desde tu inicio</span></div><button class="btn btn--brand btn--sm" data-install-btn><i data-lucide="download" class="i"></i>Instalar</button></div></div>
    <div class="card card--pad stack" style="gap:10px"><span class="eyebrow">Cuenta</span>
      <div class="row" style="justify-content:space-between"><div><strong style="font-size:var(--fs-sm)">Cerrar sesión</strong><br><span class="faint" style="font-size:var(--fs-xs)">Sales de este dispositivo</span></div><button class="btn btn--danger btn--sm" data-salir><i data-lucide="log-out" class="i"></i>Cerrar sesión</button></div>
      <div class="row" style="justify-content:space-between"><div><strong style="font-size:var(--fs-sm)">Legales</strong></div><div class="row"><a class="btn btn--ghost btn--sm" href="${BRAND.sitio}/pages/privacidad.html" target="_blank" rel="noopener">Privacidad</a><a class="btn btn--ghost btn--sm" href="${BRAND.sitio}/pages/terminos.html" target="_blank" rel="noopener">Términos</a></div></div>
    </div>
    <p class="faint" style="font-size:var(--fs-xs)">Club Dermalysse · versión local 0.4</p>
  </section>`;
}

export function mas() {
  const items = [...(Auth.usuario?.esAdmin ? [['#/admin', 'shield-check', 'Panel admin']] : []), ['#/comunidad', 'messages-square', 'Comunidad'], ['#/herramientas', 'wrench', 'Herramientas'], ['#/logros', 'flame', 'Logros'], ['#/certificados', 'award', 'Certificados'], ['#/recompensas', 'gift', 'Recompensas'], ['#/bienvenida', 'sparkles', 'Mi entrevista'], ['#/encuestas', 'message-square-heart', 'Encuestas'], ['#/perfil', 'user', 'Mi perfil'], ['#/suscripcion', 'credit-card', 'Suscripción'], ['#/configuracion', 'settings', 'Configuración']];
  return `
  <section class="stack" style="gap:16px">
    <div class="row" style="gap:12px"><div class="avatar avatar--lg">${Perfil.iniciales()}</div><div><div class="display" style="font-size:var(--fs-lg)">${esc(Perfil.get().nombre)}</div><span class="user-card__plan"><i data-lucide="crown" class="i"></i>VIP ${Perfil.get().plan}</span></div></div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">${items.map(([h, i, l]) => `<a class="card card--pad card--hover" href="${h}" style="display:flex;gap:12px;align-items:center;color:inherit;padding:16px"><span class="circle-btn" style="background:var(--primary-soft);color:var(--primary);width:38px;height:38px"><i data-lucide="${i}" class="i"></i></span><strong style="font-size:var(--fs-sm)">${l}</strong></a>`).join('')}</div>
    <a class="card card--pad" href="${BRAND.canalWhatsApp}" target="_blank" rel="noopener" style="display:flex;gap:12px;align-items:center;color:inherit;background:color-mix(in srgb,#25d366 10%,var(--surface))"><span class="circle-btn" style="background:#25d366"><i data-lucide="message-circle" class="i"></i></span><div><strong style="font-size:var(--fs-sm)">Grupo de WhatsApp</strong><br><span class="faint" style="font-size:var(--fs-xs)">Avisos y comunidad</span></div></a>
  </section>`;
}
