import { instalarBaseShim } from './core/base-shim';
instalarBaseShim();
import '@fontsource-variable/outfit/wght.css';
import '@fontsource-variable/inter/opsz.css';
import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/active.css';
import './styles/admin.css';
import './styles/arcade.css';
import './styles/ficha.css';
import './styles/perfil.css';
import './styles/herramientas.css';
import './styles/community.css';
import './styles/quiz.css';
import './styles/certificado.css';
import './styles/historia.css';
import './styles/recompensas.css';
import './styles/curso-gratis.css';
import './styles/noticias.css';
import './styles/dashboard.css';
import './styles/experiencia.css';
import './styles/admin-experiencia.css';
import './styles/login.css';
import './styles/logros.css';
import './styles/academia.css';
import './styles/produccion.css';
import './styles/responsive.css';
import './styles/directorio.css';
import { createIcons, icons } from 'lucide';
import { route, startRouter, onRender, onBeforeRender, current, navigate, render, type Page } from './core/router';
import { shellHTML, marcarNavActivo } from './ui/shell';
import { adminShellHTML, marcarAdminActivo } from './admin/shell';
import { instalarAccionesAdmin } from './admin/acciones';
import { Auth, api, mensajeError } from './core/auth';
import { Datos } from './core/datos';
import { Progreso } from './core/progreso';
import { Perfil } from './core/perfil';
import { Comunidad } from './core/comunidad';
import { curso as getCurso } from './core/catalogo';
import { esc } from './ui/partials';
import { inicio } from './pages/inicio';
import { catalogo } from './pages/cursos';
import { curso } from './pages/curso';
import { clase, refrescarClaseEnSitio } from './pages/clase';
import { montarReproductorApi, type Reproductor, type RespuestaEvento } from './ui/reproductor';
import { cargarPlataforma, disponible, plataforma, type Funcion } from './core/plataforma';
import { funcionDeRuta } from './core/funciones';
import { paginaProximamente } from './pages/proximamente';
import { adminInicioProduccion } from './admin/produccion';
import { busquedaSinCodigo, hashVerificacionLegada } from './core/legado';
import { alternarMaterialGuardado, biblioteca, material } from './pages/materiales';
import { visor, montarVisor } from './pages/visor';
import { envivo, toggleReserva } from './pages/envivo';
import { comunidad, hilo } from './pages/comunidad';
import { directorioExperiencias } from './pages/directorio-experiencias';
import { DirectorioExperiencias, type CategoriaExperiencia } from './core/directorio-experiencias';
import { paginaLogros } from './pages/logros';
import { retos, montarArcade } from './pages/retos';
import { historia, montarHistoria } from './pages/historia';
import { Acceso, mostrarPaywall } from './core/acceso';
import { mostrarOnboarding } from './ui/onboarding';
import { cargarExperiencia, getExperiencia, limpiarExperiencia, registrarSesion } from './core/experiencia';
import { montarExperiencia } from './ui/experiencia';
import { paginaBienvenida, paginaEncuestas } from './pages/experiencia';
import { paginaAdminExperiencia, montarAdminExperiencia } from './admin/experiencia';
import { VISIT_KEYS, ocultarChecklist } from './ui/checklist';
import { certificados, certificado, certificadoMuestra, verificarCertificado } from './pages/certificados';
import { emitirCertificado, limpiarCertificados } from './core/certificados-remotos';
import { herramientas, montarHerramientas } from './pages/herramientas';
import { paginaPraxia } from './pages/praxia';
import { paginaRecompensas } from './pages/recompensas';
import { perfil, suscripcion, configuracion, mas, confirmarPagoStripe } from './pages/cuenta';
import { directorio, directorioPerfil } from './pages/directorio';
import { instalarInteraccionesDirectorio } from './pages/directorio-interacciones';
import { Directorio } from './core/directorio';
import { login } from './pages/login';
import { adminCursos, adminCurso, adminQuizzes, adminQuiz, adminMateriales, adminMaterial, adminEnVivo, adminEvento } from './admin/contenido';
import { adminResumen, adminMiembros, adminMiembro, adminComunidad, adminAvisos, adminAjustes } from './admin/gestion';
import { adminCupones } from './admin/cupones';
import { adminDirectorio } from './admin/directorio';
import { cargarAdmin } from './admin/remoto';
import { cargarClub } from './core/remoto';
import { registrarIntentoQuiz } from './core/quiz-clase';
import { registrarIntentoExamen, preguntaExamenActual } from './core/examen-final';
import { examenFinal } from './pages/examen-final';
import { academia, academiaPrograma, academiaModulo, academiaTema, academiaJuego, academiaExamen, montarAcademia } from './pages/academia';
import { adminAcademia, montarAdminAcademia } from './admin/academia';
import { ganarXP } from './core/juegos';
import { celebrar } from './ui/celebracion';
import { montarTicker } from './ui/noticias';
import { paginaCursoGratis, confirmarCursoGratis } from './pages/curso-gratis';
import { debeElegir } from './core/curso-gratis';
import { instalarAvisosLogros } from './ui/logro-desbloqueado';

let _showQuiz = false;
let desmontarExperiencia: (() => void) | null = null;
let desmontarAdminExperiencia: (() => void) | null = null;

// ── Tema: claro por defecto, siempre. El cambio solo dura la sesión ──
const root = document.documentElement;
function setTheme(t: 'light' | 'dark') {
  root.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0d1220' : '#f6f5f1');
  document.querySelectorAll<HTMLElement>('[data-theme-toggle] [data-lucide], [data-theme-toggle] svg').forEach((i) => i.setAttribute('data-lucide', t === 'dark' ? 'sun' : 'moon'));
  document.querySelectorAll<HTMLImageElement>('[data-logo]').forEach((img) => {
    const admin = !!img.closest('.sidebar--admin');
    img.src = admin || t === 'dark' ? '/brand/dermalysse-horizontal-light.svg' : '/brand/dermalysse-horizontal.svg';
  });
  createIcons({ icons });
}

// ── Avisos breves ──
function toast(msg: string, icon = 'check') {
  let host = document.querySelector('.toast-host');
  if (!host) { host = document.createElement('div'); host.className = 'toast-host'; document.body.appendChild(host); }
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<i data-lucide="${icon}" class="i"></i>${esc(msg)}`;
  host.appendChild(t); createIcons({ icons }); setTimeout(() => t.remove(), 3200);
}

// ── Cascarones: miembro, admin o pantalla sola (login) ──
let shellActual: 'miembro' | 'admin' | 'solo' | null = null;
function montar(tipo: 'miembro' | 'admin' | 'solo') {
  if (shellActual === tipo) return;
  shellActual = tipo;
  document.getElementById('app')!.innerHTML = tipo === 'miembro' ? shellHTML() : tipo === 'admin' ? adminShellHTML() : '<main id="outlet"></main>';
  setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
  actualizarNotifs();
}
function remontar() { const t = shellActual; shellActual = null; if (t) montar(t); render(); }

// ── Mantenimiento (GET /config): solo administración entra; el resto ve una pantalla honesta ──
function pantallaMantenimiento() {
  montar('solo');
  const outlet = document.getElementById('outlet');
  if (!outlet) return;
  outlet.innerHTML = `<section class="mantenimiento" role="status">
    <div class="mantenimiento__card">
      <img src="/brand/dermalysse-horizontal.svg" alt="Dermalysse" class="mantenimiento__logo">
      <span class="mantenimiento__ic"><i data-lucide="wrench" class="i"></i></span>
      <h1>Club en mantenimiento</h1>
      <p>Estamos haciendo mejoras en la plataforma. Tu cuenta, tu avance y tus certificados están a salvo; vuelve a intentar en unos minutos.</p>
      <div class="mantenimiento__acciones"><button type="button" class="btn btn--brand" data-reintentar-club><i data-lucide="refresh-cw" class="i"></i>Volver a intentar</button><button type="button" class="btn btn--ghost" data-salir><i data-lucide="log-out" class="i"></i>Cerrar sesión</button></div>
    </div>
  </section>`;
  createIcons({ icons });
}

// ── Reproductor de clase en modo API (avance real); se desmonta en cada cambio de ruta ──
let reproductor: Reproductor | null = null;

const invitacionExperiencia = (uid: string) => `dermalysse:experiencia:invitacion:v2:${uid}`;
onBeforeRender(async (path) => {
  desmontarExperiencia?.(); desmontarExperiencia = null;
  desmontarAdminExperiencia?.(); desmontarAdminExperiencia = null;
  reproductor?.desmontar(); reproductor = null;
  if (speechSynthesis.speaking) speechSynthesis.cancel();
  if (path.startsWith('/verificar/')) { montar('solo'); return true; }
  await Auth.iniciar();
  const u = Auth.usuario;
  if (path === '/login') {
    const vistaPrevia = current().query.get('vista') === '1';
    if (u && !vistaPrevia) { navigate(sessionStorage.getItem('dermalysse:volver') || '/'); return false; }
    montar('solo'); return true;
  }
  if (!u) { limpiarExperiencia(); sessionStorage.setItem('dermalysse:volver', location.hash.slice(1) || '/'); navigate('/login'); return false; }
  if (Datos.modo === 'api') {
    if (!u.esAdmin && (await cargarPlataforma()).mantenimiento) { pantallaMantenimiento(); return false; }
    const errorEstado = Auth.tomarErrorEstado(); // una vez por inicio de sesión
    if (errorEstado) toast(errorEstado, 'circle-alert');
  }
  // Funciones apagadas en producción (src/core/funciones.ts): nunca un error, siempre una salida amable.
  const funcionRuta = funcionDeRuta(path);
  const funcionApagada = funcionRuta !== null && !disponible(funcionRuta);
  if (path.startsWith('/admin')) {
    if (!u.esAdmin) { toast('Tu cuenta no tiene acceso al panel de administración', 'shield-alert'); navigate('/'); return false; }
    // Sin 'adminGestion' solo existen el Inicio del admin y la Academia; el resto lleva al Inicio (con el enlace al panel actual).
    if (funcionApagada && !/^\/admin\/?$/.test(path)) { navigate('/admin'); return false; }
    try { await cargarAdmin(path); }
    catch (e) { toast(`No se pudieron cargar los datos reales: ${mensajeError(e)}`, 'circle-alert'); }
    montar('admin'); return true;
  }
  try { await cargarClub(path); }
  catch (e) { toast(`No se pudo cargar el catálogo: ${mensajeError(e)}`, 'circle-alert'); }
  if (path.startsWith('/directorio')) {
    try {
      if (!Directorio.cargado() || !Directorio.vigente(300_000)) await Directorio.cargar();
    } catch (errDir) {
      toast(`No se pudieron cargar perfiles: ${mensajeError(errDir)}`, 'circle-alert');
    }
  }
  // El nuevo flujo no bloquea clases, exámenes ni facturación. Un fallo API se
  // muestra en su propia tarjeta/página y nunca se sustituye por una demo.
  if (disponible('experiencia') && ['/', '/perfil', '/bienvenida', '/encuestas'].includes(path)) {
    try {
      await cargarExperiencia();
      if (Auth.usuario?.uid === u.uid) await registrarSesion();
    } catch { /* La interfaz de experiencia conserva el error recuperable. */ }
  }
  if (Auth.usuario?.uid !== u.uid) return false;
  // Primera vez que la cuenta abre el club en este dispositivo: bienvenida a pantalla completa.
  // Se muestra una sola vez; después queda la invitación en Inicio. No intercepta enlaces a
  // clases, exámenes o pagos ni envía telemetría.
  const experiencia = disponible('experiencia') ? getExperiencia() : null;
  if (path === '/' && experiencia && ['nueva', 'demo'].includes(experiencia.cohorte)
    && experiencia.entrevista.estado === 'pendiente') {
    try {
      if (!localStorage.getItem(invitacionExperiencia(u.uid))) { navigate('/bienvenida'); return false; }
    } catch { /* Si el navegador no guarda preferencias, usar solo la tarjeta. */ }
  }
  // Bienvenida y encuesta ocupan toda la pantalla, sin menú ni barras del club.
  // Si la función está apagada, la ruta muestra «Próximamente» dentro del club (con menú).
  // El módulo «curso gratis» también va a pantalla completa (solo ese módulo, sin menú del club),
  // como una página dedicada de primera vez; al elegir, continúa al curso.
  const pantallaCompleta = (!funcionApagada && (path === '/bienvenida' || path === '/encuestas')) || path === '/curso-gratis';
  if (pantallaCompleta && path === '/bienvenida') { try { localStorage.setItem(invitacionExperiencia(u.uid), '1'); } catch { /* sin almacenamiento */ } }
  montar(pantallaCompleta ? 'solo' : 'miembro');
  if (!pantallaCompleta) instalarAvisosLogros(u.uid);
  return true;
});

// Rutas que dependen de una función de src/core/funciones.ts: si está apagada, se pinta `alterna`.
const segun = (funcion: Funcion, pagina: Page, alterna: Page): Page => (params, query) => (disponible(funcion) ? pagina(params, query) : alterna(params, query));
const proximamente = (funcion: Funcion): Page => () => paginaProximamente(funcion);

// ── Rutas del miembro ──
route('/login', login);
route('/verificar/:folio', verificarCertificado);
route('/', inicio);
route('/cursos', catalogo);
route('/curso/:id', curso);
route('/curso/:id/clase/:n', clase);
route('/curso/:id/examen', examenFinal);
route('/curso-gratis', paginaCursoGratis);
// Academia: juego y examen antes de :t para que no los capture el lector de temas.
route('/academia', academia);
route('/academia/:programa', academiaPrograma);
route('/academia/:programa/:n', academiaModulo);
route('/academia/:programa/:n/juego', academiaJuego);
route('/academia/:programa/:n/examen', academiaExamen);
route('/academia/:programa/:n/:t', academiaTema);
route('/materiales', biblioteca);
route('/materiales/:id', material);
route('/materiales/:id/visor', visor);
route('/en-vivo', envivo);
route('/comunidad', comunidad);
route('/comunidad/experiencias', directorioExperiencias);
route('/comunidad/:id', hilo);
route('/directorio', directorio);
route('/directorio/perfil', directorioPerfil);
route('/logros', paginaLogros);
route('/retos', retos);
route('/retos/historia', historia);
route('/retos/historia/:id', historia);
route('/certificados', certificados);
route('/certificados/muestra', certificadoMuestra);
route('/certificados/:id', certificado);
route('/herramientas', herramientas);
route('/praxia', paginaPraxia);
route('/recompensas', segun('recompensas', paginaRecompensas, proximamente('recompensas')));
route('/bienvenida', segun('experiencia', paginaBienvenida, proximamente('experiencia')));
route('/encuestas', segun('experiencia', paginaEncuestas, proximamente('experiencia')));
route('/perfil', perfil);
route('/suscripcion', suscripcion);
route('/configuracion', configuracion);
route('/mas', mas);
// ── Rutas del admin ──
route('/admin', segun('adminGestion', adminResumen, adminInicioProduccion));
route('/admin/cursos', adminCursos);
route('/admin/cursos/:id', adminCurso);
route('/admin/quizzes', adminQuizzes);
route('/admin/quizzes/:cursoId/:n', adminQuiz);
route('/admin/academia', adminAcademia);
route('/admin/materiales', adminMateriales);
route('/admin/materiales/:id', adminMaterial);
route('/admin/en-vivo', adminEnVivo);
route('/admin/en-vivo/:id', adminEvento);
route('/admin/miembros', adminMiembros);
route('/admin/miembros/:uid', adminMiembro);
route('/admin/directorio', adminDirectorio);
route('/admin/cupones', adminCupones);
route('/admin/experiencia', paginaAdminExperiencia);
route('/admin/comunidad', adminComunidad);
route('/admin/avisos', adminAvisos);
route('/admin/ajustes', adminAjustes);

onRender(() => {
  const { path } = current();
  if (shellActual === 'admin') marcarAdminActivo(path); else marcarNavActivo(path);
  // Anuncio de primera vez «Escoge tu curso gratis» (solo miembro gratuito que aún no eligió).
  // La bienvenida guiada conduce al regalo de curso al final; no interrumpirla con el modal global.
  const estadoBienvenida = getExperiencia()?.entrevista.estado;
  const bienvenidaTerminada = !disponible('experiencia') || !estadoBienvenida || estadoBienvenida === 'completada';
  // Miembro gratuito que aún no elige su curso: se le lleva al MÓDULO #/curso-gratis una vez por sesión
  // (sin "posponer" permanente, para que no se lo salte). Después puede navegar para decidir con calma.
  if (shellActual === 'miembro' && path !== '/bienvenida' && path !== '/curso-gratis' && bienvenidaTerminada && debeElegir()) {
    let yaLlevado = false;
    try { yaLlevado = sessionStorage.getItem('dermalysse:curso-gratis-llevado') === '1'; } catch { /* sin almacenamiento */ }
    if (!yaLlevado) {
      try { sessionStorage.setItem('dermalysse:curso-gratis-llevado', '1'); } catch { /* sin almacenamiento */ }
      navigate('/curso-gratis');
      return;
    }
  }
  const crumb = document.querySelector('[data-crumb]'); if (crumb) crumb.textContent = document.querySelector('#outlet h1')?.textContent?.trim() || 'Administración';
  if (Datos.modo === 'api') {
    const video = document.querySelector<HTMLElement>('[data-video-api]');
    if (video && !reproductor) reproductor = montarReproductorApi(video, { toast, alAcreditar: alAcreditarClase });
    const pago = document.querySelector<HTMLElement>('[data-confirmar-pago]');
    if (pago) void confirmarPagoStripe(pago, () => { remontar(); celebrar('grande'); toast('Pago confirmado. Tu membresía VIP está activa.', 'badge-check'); });
  }
  if (path === '/') montarTicker();
  if (path.startsWith('/retos')) montarArcade();
  if (path.startsWith('/retos/historia')) montarHistoria();
  if (path === '/herramientas') montarHerramientas();
  montarAcademia(); // siempre: desmonta la página anterior y solo conecta si la actual es de la Academia
  if (shellActual === 'admin' && path === '/admin/academia') montarAdminAcademia(toast, render);
  if (path === '/comunidad' && Comunidad.cargando()) Comunidad.cargarListado().then(() => render()).catch((e) => toast(mensajeError(e), 'circle-alert'));
  if (path.startsWith('/comunidad/') && path !== '/comunidad/experiencias') {
    const id = path.split('/')[2];
    if (id && Comunidad.necesitaDetalle(id)) Comunidad.cargarDetalle(id).then(() => render()).catch((e) => toast(mensajeError(e), 'circle-alert'));
  }
  if (path.includes('/visor')) montarVisor();
  if ((shellActual === 'miembro' && ['/', '/perfil'].includes(path)) || (shellActual === 'solo' && ['/bienvenida', '/encuestas'].includes(path))) desmontarExperiencia = montarExperiencia();
  if (shellActual === 'admin' && path === '/admin/experiencia') desmontarAdminExperiencia = montarAdminExperiencia();
  if (_showQuiz) {
    _showQuiz = false;
    const tabsEl = document.querySelector('[data-tabs]');
    if (tabsEl) {
      tabsEl.querySelectorAll<HTMLButtonElement>('.tabs button[data-for]').forEach((b) => b.classList.toggle('is-active', b.dataset.for === 'quiz'));
      tabsEl.querySelectorAll<HTMLElement>('[data-tab]').forEach((p) => (p.hidden = p.dataset.tab !== 'quiz'));
    }
    const quizEl = document.querySelector('[data-quiz-shell]') || document.querySelector('.quiz-pending');
    if (quizEl) setTimeout(() => quizEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  }
  createIcons({ icons });
  if (shellActual === 'miembro') {
    // El recorrido antiguo sigue accesible desde Ayuda, pero ya no encadena
    // modales automáticos ni obliga a proporcionar WhatsApp al entrar.
    const vk = Object.entries(VISIT_KEYS).find(([prefix]) => path.startsWith(prefix));
    if (vk) try { localStorage.setItem(vk[1], '1'); } catch {}
  }
});
instalarAccionesAdmin(toast);
instalarInteraccionesDirectorio(toast, render, navigate);
// QR del club actual: club.dermalyssemx.com/verify.html?code=DRML-… → (redirección) → #/verificar/DRML-…
const hashLegado = hashVerificacionLegada(location.search, location.hash);
if (hashLegado) history.replaceState(null, '', `${location.pathname}${busquedaSinCodigo(location.search)}${hashLegado}`);
startRouter();
window.addEventListener('datos:cambio', (e) => { if ((e as CustomEvent).detail === 'avisos') actualizarNotifs(); });

// ── Avance real (modo API): el servidor acreditó una clase con eventos del reproductor ──
function alAcreditarClase(cursoId: string, n: number, r: RespuestaEvento, evento: 'timeupdate' | 'pause' | 'ended') {
  const c = getCurso(cursoId);
  if (!c) return;
  refrescarClaseEnSitio(cursoId, n);
  createIcons({ icons });
  celebrar('normal');
  const completo = (Array.isArray(r.vistas) && c.clases.every((k) => r.vistas!.includes(k.n))) || Number(r.porcentaje) >= 100;
  if (!completo) { toast('Clase acreditada. Ya puedes continuar con la siguiente.', 'circle-check'); return; }
  // Curso completo: el servidor emite el certificado (409 si aún falta alguna clase).
  // Si el video sigue en reproducción (85 %), no se interrumpe; al terminar se abre el certificado.
  void abrirCertificado(cursoId, evento === 'ended');
}

// Stripe (modo API): la API delega al webhook actual (conserva metadata.source='dermalysse').
async function irAStripe(boton: HTMLButtonElement, ruta: string, json?: unknown) {
  if (boton.disabled) return;
  boton.disabled = true;
  boton.setAttribute('aria-busy', 'true');
  try {
    const r = await api<{ url?: string }>(ruta, { method: 'POST', ...(json !== undefined ? { json } : {}) });
    let destino: URL | null = null;
    try { destino = r.url ? new URL(r.url) : null; } catch { destino = null; }
    if (!destino || destino.protocol !== 'https:') throw new Error('Stripe no devolvió un enlace válido. Intenta de nuevo en un momento.');
    toast('Abriendo Stripe de forma segura…', 'credit-card');
    location.href = destino.toString();
  } catch (err) {
    toast(mensajeError(err), 'alert-triangle');
    boton.disabled = false;
    boton.removeAttribute('aria-busy');
  }
}

// Enlaces protegidos (modo API): /catalogo no trae enlaces de Drive ni de la transmisión; se piden con
// sesión al abrir. La pestaña se abre en el mismo clic para que el navegador no la bloquee.
async function abrirEnlaceProtegido(boton: HTMLElement, ruta: string, elegir: (r: Record<string, unknown>) => unknown, paywall: string) {
  if (boton.getAttribute('aria-busy') === 'true') return;
  boton.setAttribute('aria-busy', 'true');
  const ventana = window.open('', '_blank');
  try {
    const valor = elegir(await api<Record<string, unknown>>(ruta));
    let destino: URL | null = null;
    try { destino = typeof valor === 'string' ? new URL(valor) : null; } catch { destino = null; }
    if (!destino || destino.protocol !== 'https:') throw new Error('El enlace aún no está disponible.');
    if (ventana) { ventana.opener = null; ventana.location.href = destino.toString(); } else location.href = destino.toString();
  } catch (err: any) {
    ventana?.close();
    if (err?.status === 403) mostrarPaywall(paywall);
    else toast(mensajeError(err), 'circle-alert');
  } finally {
    boton.removeAttribute('aria-busy');
  }
}

async function abrirCertificado(cursoId: string, navegar: boolean, boton?: HTMLButtonElement) {
  if (boton) boton.disabled = true;
  try {
    const cert = await emitirCertificado(cursoId);
    celebrar('grande');
    toast('¡Curso completado! Tu certificado verificable está listo.', 'award');
    if (navegar) navigate(`/certificados/${encodeURIComponent(cert.folio)}`);
  } catch (err: any) {
    toast(err?.status === 409 ? 'Aún falta acreditar alguna clase del curso para emitir el certificado.' : `No se pudo emitir el certificado: ${mensajeError(err)}`, 'circle-alert');
  } finally { if (boton) boton.disabled = false; }
}

// ── Notificaciones (avisos publicados desde el admin) ──
const VISTO_KEY = 'dermalysse:avisos-visto';
function actualizarNotifs() {
  const badge = document.querySelector<HTMLElement>('[data-notifs-badge]'); if (!badge) return;
  const visto = localStorage.getItem(VISTO_KEY) || '';
  const nuevos = Datos.avisos().filter((a) => a.fecha > visto).length;
  badge.hidden = !nuevos; badge.textContent = String(nuevos);
}
function abrirNotifs(panel: HTMLElement) {
  const visto = localStorage.getItem(VISTO_KEY) || '';
  const l = Datos.avisos();
  panel.innerHTML = `<div class="row" style="justify-content:space-between;padding:6px 10px"><strong style="font-size:var(--fs-sm)">Avisos</strong><span class="faint" style="font-size:var(--fs-xs)">${l.length}</span></div>` +
    (l.length ? l.map((a) => `<a class="notif ${a.fecha > visto ? 'is-new' : ''}" href="${esc(a.enlace || '#/')}"><strong>${esc(a.titulo)}</strong><p>${esc(a.texto)}</p></a>`).join('')
              : '<p class="muted" style="padding:16px;font-size:var(--fs-sm);text-align:center">No tienes avisos nuevos.</p>');
  localStorage.setItem(VISTO_KEY, new Date().toISOString());
  actualizarNotifs();
}

// ── Quiz de clase: experiencia guiada, una pregunta a la vez ──
function quizShell(el: HTMLElement) { return el.closest<HTMLElement>('[data-quiz-shell]'); }

function prepararQuizClase(shell: HTMLElement) {
  const form = shell.querySelector<HTMLFormElement>('[data-quiz-miembro]');
  if (!form) return;
  form.reset();
  form.dataset.posicion = '0';
  form.querySelectorAll<HTMLElement>('[data-pregunta]').forEach((pregunta, i) => {
    pregunta.hidden = i !== 0;
    delete pregunta.dataset.correcta;
    pregunta.querySelectorAll<HTMLInputElement>('input').forEach((input) => { input.disabled = false; });
    pregunta.querySelectorAll('.quiz__opt').forEach((opcion) => opcion.classList.remove('is-correct', 'is-wrong', 'is-disabled'));
    const feedback = pregunta.querySelector<HTMLElement>('.quiz__feedback'); if (feedback) feedback.hidden = true;
  });
  const intro = shell.querySelector<HTMLElement>('[data-quiz-intro]'); if (intro) intro.hidden = true;
  const resultado = shell.querySelector<HTMLElement>('[data-quiz-result]'); if (resultado) resultado.hidden = true;
  form.hidden = false;
  shell.dataset.quizMode = 'active';
  actualizarNavegacionQuiz(form);
  requestAnimationFrame(() => shell.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

function actualizarNavegacionQuiz(form: HTMLFormElement) {
  const pos = Number(form.dataset.posicion || 0);
  const total = Number(form.dataset.total || 1);
  const contador = form.querySelector<HTMLElement>('[data-quiz-counter]');
  const barra = form.querySelector<HTMLElement>('[data-quiz-progress]');
  if (contador) contador.textContent = `Pregunta ${pos + 1} de ${total}`;
  if (barra) barra.style.width = `${((pos + 1) / total) * 100}%`;
  form.querySelector<HTMLElement>('.quiz-run__progress')?.setAttribute('aria-valuenow', String(pos + 1));
  const comprobar = form.querySelector<HTMLElement>('[data-quiz-check]'); if (comprobar) comprobar.hidden = false;
  const siguiente = form.querySelector<HTMLButtonElement>('[data-quiz-next]');
  if (siguiente) {
    siguiente.hidden = true;
    siguiente.innerHTML = pos === total - 1
      ? 'Ver mi resultado <span class="arrow"><i data-lucide="trophy" class="i"></i></span>'
      : 'Siguiente <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span>';
  }
  const pista = form.querySelector<HTMLElement>('.quiz-run__hint');
  if (pista) pista.innerHTML = '<i data-lucide="mouse-pointer-click" class="i"></i>Elige una respuesta';
  createIcons({ icons });
}

function comprobarPreguntaQuiz(form: HTMLFormElement) {
  const pos = Number(form.dataset.posicion || 0);
  const pregunta = form.querySelector<HTMLElement>(`[data-pregunta="${pos}"]`);
  const marcada = pregunta?.querySelector<HTMLInputElement>('input:checked');
  if (!pregunta || !marcada) { toast('Selecciona una respuesta para continuar', 'mouse-pointer-click'); return; }
  const [cursoId, numero] = form.dataset.quizMiembro!.split(':');
  const quiz = Datos.quiz(cursoId, Number(numero));
  const reactivo = quiz?.preguntas[pos];
  if (!reactivo) return;
  const elegida = Number(marcada.value);
  if (Datos.modo === 'api') {
    pregunta.dataset.respuesta = String(elegida);
    pregunta.querySelectorAll<HTMLInputElement>('input').forEach((input) => { input.disabled = true; });
    marcada.closest('.quiz__opt')?.classList.add('is-selected');
    form.querySelector<HTMLElement>('[data-quiz-check]')!.hidden = true;
    form.querySelector<HTMLButtonElement>('[data-quiz-next]')!.hidden = false;
    const pista = form.querySelector<HTMLElement>('.quiz-run__hint');
    if (pista) pista.innerHTML = '<i data-lucide="shield-check" class="i"></i>Respuesta registrada de forma segura';
    createIcons({ icons });
    return;
  }
  const acierto = elegida === reactivo.correcta;
  pregunta.dataset.correcta = acierto ? '1' : '0';
  pregunta.querySelectorAll<HTMLInputElement>('input').forEach((input) => { input.disabled = true; });
  pregunta.querySelectorAll<HTMLLabelElement>('.quiz__opt').forEach((opcion, i) => {
    opcion.classList.toggle('is-correct', i === reactivo.correcta);
    opcion.classList.toggle('is-wrong', i === elegida && !acierto);
    opcion.classList.toggle('is-disabled', i !== reactivo.correcta && i !== elegida);
  });
  const feedback = pregunta.querySelector<HTMLElement>('.quiz__feedback');
  if (feedback) {
    feedback.hidden = false;
    feedback.classList.toggle('is-correct', acierto);
    feedback.classList.toggle('is-wrong', !acierto);
    const titulo = feedback.querySelector<HTMLElement>('[data-quiz-feedback-title]');
    if (titulo) titulo.textContent = acierto ? '¡Correcto! Buen criterio.' : 'Casi. Esta es la respuesta correcta.';
  }
  form.querySelector<HTMLElement>('[data-quiz-check]')!.hidden = true;
  const siguiente = form.querySelector<HTMLButtonElement>('[data-quiz-next]')!;
  siguiente.hidden = false;
  const pista = form.querySelector<HTMLElement>('.quiz-run__hint');
  if (pista) pista.innerHTML = `<i data-lucide="${acierto ? 'circle-check' : 'book-open-check'}" class="i"></i>${acierto ? 'Respuesta dominada' : 'Lee la explicación antes de seguir'}`;
  createIcons({ icons });
}

async function terminarQuizClase(shell: HTMLElement, form: HTMLFormElement) {
  const [cursoId, numero] = form.dataset.quizMiembro!.split(':');
  const total = Number(form.dataset.total || 1);
  const preguntas = [...form.querySelectorAll<HTMLElement>('[data-pregunta]')];
  let aciertos = preguntas.filter((p) => p.dataset.correcta === '1').length;
  if (Datos.modo === 'api') {
    try {
      const respuestas = preguntas.map((p) => Number(p.dataset.respuesta));
      const remoto = await api<{ correctas: number; total: number; aprobado: boolean; detalle: { correcta: number; acertada: boolean; explicacion: string }[] }>(`/quiz/${encodeURIComponent(cursoId)}/${Number(numero)}`, { method: 'POST', json: { respuestas } });
      aciertos = remoto.correctas;
      preguntas.forEach((pregunta, i) => {
        pregunta.dataset.correcta = remoto.detalle[i]?.acertada ? '1' : '0';
        const explicacion = pregunta.querySelector<HTMLElement>('[data-quiz-explanation]');
        if (explicacion) explicacion.textContent = remoto.detalle[i]?.explicacion || '';
      });
    } catch (error) {
      toast(mensajeError(error), 'circle-alert');
      return;
    }
  }
  const registro = registrarIntentoQuiz(cursoId, Number(numero), aciertos, total);
  if (registro.primeraAprobacion) ganarXP(25);
  form.hidden = true;
  shell.dataset.quizMode = 'result';
  const resultado = shell.querySelector<HTMLElement>('[data-quiz-result]')!;
  const curso = getCurso(cursoId);
  const siguiente = curso?.clases.find((clase) => clase.n === Number(numero) + 1);
  const destino = siguiente ? `#/curso/${cursoId}/clase/${siguiente.n}` : `#/curso/${cursoId}`;
  const fallos = total - aciertos;
  resultado.className = `quiz-result ${registro.aprobado ? 'is-approved' : 'is-review'}`;
  resultado.innerHTML = `
    <div class="quiz-result__celebration"><span><i data-lucide="${registro.aprobado ? 'trophy' : 'target'}" class="i"></i></span>${registro.primeraAprobacion ? '<b>+25 XP</b>' : ''}</div>
    <span class="quiz-kicker"><i data-lucide="${registro.aprobado ? 'badge-check' : 'refresh-cw'}" class="i"></i>${registro.aprobado ? 'Reto aprobado' : 'Sigue practicando'}</span>
    <h2>${registro.aprobado ? '¡Excelente trabajo!' : 'Estás muy cerca'}</h2>
    <p>${registro.aprobado ? 'Demostraste que comprendiste los puntos clave de esta clase.' : 'Revisa las explicaciones y vuelve a intentarlo para consolidar el aprendizaje.'}</p>
    <div class="quiz-result__score" style="--score:${registro.porcentaje}"><strong>${registro.porcentaje}%</strong><span>${aciertos} de ${total} correctas</span></div>
    <div class="quiz-result__summary">
      <span><i data-lucide="circle-check" class="i"></i><b>${aciertos}</b><small>aciertos</small></span>
      <span><i data-lucide="circle-x" class="i"></i><b>${fallos}</b><small>por repasar</small></span>
      <span><i data-lucide="chart-no-axes-column-increasing" class="i"></i><b>${registro.mejor}%</b><small>mejor marca</small></span>
    </div>
    ${registro.primeraAprobacion ? '<div class="quiz-result__xp"><i data-lucide="sparkles" class="i"></i><span><strong>Ganaste 25 XP</strong><small>Ya cuentan para tu posición en la clasificación.</small></span></div>' : ''}
    <div class="quiz-result__actions">
      <button type="button" class="btn btn--secondary" data-quiz-retry><i data-lucide="rotate-ccw" class="i"></i>Repetir reto</button>
      <a class="btn btn--brand btn--pill-arrow" href="${destino}">${siguiente ? 'Siguiente clase' : 'Volver al curso'} <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span></a>
    </div>`;
  resultado.hidden = false;
  createIcons({ icons });
  if (registro.aprobado) celebrar(registro.primeraAprobacion ? 'grande' : 'normal');
  requestAnimationFrame(() => resultado.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

async function siguientePreguntaQuiz(shell: HTMLElement, form: HTMLFormElement) {
  const pos = Number(form.dataset.posicion || 0);
  const total = Number(form.dataset.total || 1);
  if (pos + 1 >= total) { await terminarQuizClase(shell, form); return; }
  form.querySelector<HTMLElement>(`[data-pregunta="${pos}"]`)!.hidden = true;
  form.dataset.posicion = String(pos + 1);
  form.querySelector<HTMLElement>(`[data-pregunta="${pos + 1}"]`)!.hidden = false;
  actualizarNavegacionQuiz(form);
}

function salirQuizClase(shell: HTMLElement) {
  const form = shell.querySelector<HTMLFormElement>('[data-quiz-miembro]'); if (form) form.hidden = true;
  const resultado = shell.querySelector<HTMLElement>('[data-quiz-result]'); if (resultado) resultado.hidden = true;
  const intro = shell.querySelector<HTMLElement>('[data-quiz-intro]'); if (intro) intro.hidden = false;
  shell.dataset.quizMode = 'intro';
}

// ── Evaluación final del curso ──
function exShell(el: HTMLElement) { return el.closest<HTMLElement>('[data-examen-shell]'); }

function prepararExamen(shell: HTMLElement) {
  const form = shell.querySelector<HTMLFormElement>('[data-examen-form]');
  if (!form) return;
  form.reset();
  form.dataset.posicion = '0';
  form.querySelectorAll<HTMLElement>('[data-pregunta]').forEach((p, i) => {
    p.hidden = i !== 0;
    delete p.dataset.correcta;
    p.querySelectorAll<HTMLInputElement>('input').forEach((input) => { input.disabled = false; });
    p.querySelectorAll('.quiz__opt').forEach((opt) => opt.classList.remove('is-correct', 'is-wrong', 'is-disabled'));
    const fb = p.querySelector<HTMLElement>('.quiz__feedback'); if (fb) fb.hidden = true;
  });
  shell.querySelector<HTMLElement>('[data-examen-intro]')!.hidden = true;
  shell.querySelector<HTMLElement>('[data-examen-result]')!.hidden = true;
  form.hidden = false;
  actualizarNavExamen(form);
  requestAnimationFrame(() => shell.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

function actualizarNavExamen(form: HTMLFormElement) {
  const pos = Number(form.dataset.posicion || 0);
  const total = Number(form.dataset.total || 1);
  const contador = form.querySelector<HTMLElement>('[data-examen-counter]');
  const barra = form.querySelector<HTMLElement>('[data-examen-progress]');
  if (contador) contador.textContent = `Pregunta ${pos + 1} de ${total}`;
  if (barra) barra.style.width = `${((pos + 1) / total) * 100}%`;
  form.querySelector<HTMLElement>('[data-examen-check]')!.hidden = false;
  const siguiente = form.querySelector<HTMLButtonElement>('[data-examen-next]');
  if (siguiente) {
    siguiente.hidden = true;
    siguiente.innerHTML = pos === total - 1
      ? 'Ver mi resultado <span class="arrow"><i data-lucide="trophy" class="i"></i></span>'
      : 'Siguiente <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span>';
  }
  const pista = form.querySelector<HTMLElement>('.quiz-run__hint');
  if (pista) pista.innerHTML = '<i data-lucide="mouse-pointer-click" class="i"></i>Elige una respuesta';
  createIcons({ icons });
}

function comprobarPreguntaExamen(form: HTMLFormElement) {
  const pos = Number(form.dataset.posicion || 0);
  const pregunta = form.querySelector<HTMLElement>(`[data-pregunta="${pos}"]`);
  const marcada = pregunta?.querySelector<HTMLInputElement>('input:checked');
  if (!pregunta || !marcada) { toast('Selecciona una respuesta', 'mouse-pointer-click'); return; }
  const reactivo = preguntaExamenActual(pos);
  if (!reactivo) return;
  const elegida = Number(marcada.value);
  const acierto = elegida === reactivo.correcta;
  pregunta.dataset.correcta = acierto ? '1' : '0';
  pregunta.querySelectorAll<HTMLInputElement>('input').forEach((input) => { input.disabled = true; });
  pregunta.querySelectorAll<HTMLLabelElement>('.quiz__opt').forEach((opcion, i) => {
    opcion.classList.toggle('is-correct', i === reactivo.correcta);
    opcion.classList.toggle('is-wrong', i === elegida && !acierto);
    opcion.classList.toggle('is-disabled', i !== reactivo.correcta && i !== elegida);
  });
  const feedback = pregunta.querySelector<HTMLElement>('.quiz__feedback');
  if (feedback) {
    feedback.hidden = false;
    feedback.classList.toggle('is-correct', acierto);
    feedback.classList.toggle('is-wrong', !acierto);
    const titulo = feedback.querySelector<HTMLElement>('[data-examen-feedback-title]');
    if (titulo) titulo.textContent = acierto ? '¡Correcto!' : 'No es la respuesta correcta.';
  }
  form.querySelector<HTMLElement>('[data-examen-check]')!.hidden = true;
  form.querySelector<HTMLButtonElement>('[data-examen-next]')!.hidden = false;
  const pista = form.querySelector<HTMLElement>('.quiz-run__hint');
  if (pista) pista.innerHTML = `<i data-lucide="${acierto ? 'circle-check' : 'book-open-check'}" class="i"></i>${acierto ? 'Respuesta correcta' : 'Revisa la explicación'}`;
  createIcons({ icons });
}

function terminarExamen(shell: HTMLElement, form: HTMLFormElement) {
  const cursoId = shell.dataset.examenCurso!;
  const total = Number(form.dataset.total || 1);
  const preguntas = [...form.querySelectorAll<HTMLElement>('[data-pregunta]')];
  const aciertos = preguntas.filter((p) => p.dataset.correcta === '1').length;
  const registro = registrarIntentoExamen(cursoId, aciertos, total);
  if (registro.primeraAprobacion) ganarXP(50);
  form.hidden = true;
  const resultado = shell.querySelector<HTMLElement>('[data-examen-result]')!;
  const fallos = total - aciertos;
  resultado.className = `quiz-result ${registro.aprobado ? 'is-approved' : 'is-review'}`;
  resultado.innerHTML = `
    <div class="quiz-result__celebration"><span><i data-lucide="${registro.aprobado ? 'trophy' : 'target'}" class="i"></i></span>${registro.primeraAprobacion ? '<b>+50 XP</b>' : ''}</div>
    <span class="quiz-kicker"><i data-lucide="${registro.aprobado ? 'badge-check' : 'refresh-cw'}" class="i"></i>${registro.aprobado ? 'Evaluación aprobada' : 'Sigue practicando'}</span>
    <h2>${registro.aprobado ? '¡Felicidades, lo lograste!' : 'Estás muy cerca'}</h2>
    <p>${registro.aprobado ? 'Aprobaste la evaluación final. Tu certificado verificable ya está listo.' : 'Repasa las clases y vuelve a intentarlo. Cada intento te acerca más.'}</p>
    <div class="quiz-result__score" style="--score:${registro.porcentaje}"><strong>${registro.porcentaje}%</strong><span>${aciertos} de ${total} correctas</span></div>
    <div class="quiz-result__summary">
      <span><i data-lucide="circle-check" class="i"></i><b>${aciertos}</b><small>aciertos</small></span>
      <span><i data-lucide="circle-x" class="i"></i><b>${fallos}</b><small>por repasar</small></span>
      <span><i data-lucide="chart-no-axes-column-increasing" class="i"></i><b>${registro.mejor}%</b><small>mejor marca</small></span>
    </div>
    ${registro.primeraAprobacion ? '<div class="quiz-result__xp"><i data-lucide="sparkles" class="i"></i><span><strong>Ganaste 50 XP</strong><small>Tu esfuerzo suma para la clasificación.</small></span></div>' : ''}
    <div class="quiz-result__actions">
      <button type="button" class="btn btn--secondary" data-examen-retry><i data-lucide="rotate-ccw" class="i"></i>Repetir</button>
      ${registro.aprobado
        ? `<a class="btn btn--brand btn--pill-arrow" href="#/certificados">Ver mi certificado <span class="arrow"><i data-lucide="award" class="i"></i></span></a>`
        : `<a class="btn btn--brand btn--pill-arrow" href="#/curso/${cursoId}">Repasar el curso <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span></a>`}
    </div>`;
  resultado.hidden = false;
  createIcons({ icons });
  if (registro.aprobado) celebrar(registro.primeraAprobacion ? 'grande' : 'normal');
  requestAnimationFrame(() => resultado.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

function siguientePreguntaExamen(shell: HTMLElement, form: HTMLFormElement) {
  const pos = Number(form.dataset.posicion || 0);
  const total = Number(form.dataset.total || 1);
  if (pos + 1 >= total) { terminarExamen(shell, form); return; }
  form.querySelector<HTMLElement>(`[data-pregunta="${pos}"]`)!.hidden = true;
  form.dataset.posicion = String(pos + 1);
  form.querySelector<HTMLElement>(`[data-pregunta="${pos + 1}"]`)!.hidden = false;
  actualizarNavExamen(form);
}

function salirExamen(shell: HTMLElement) {
  const form = shell.querySelector<HTMLFormElement>('[data-examen-form]'); if (form) form.hidden = true;
  const resultado = shell.querySelector<HTMLElement>('[data-examen-result]'); if (resultado) resultado.hidden = true;
  shell.querySelector<HTMLElement>('[data-examen-intro]')!.hidden = false;
}

// ── Interacciones globales del miembro ──
document.addEventListener('click', async (e) => {
  const el = e.target as HTMLElement;
  const pw = el.closest<HTMLElement>('[data-paywall]');
  if (pw) { mostrarPaywall(pw.dataset.paywall || undefined); return; }

  // «Escoge tu curso gratis»: desde la página del curso se va al MÓDULO dedicado (no un modal flotante).
  const elegirCurso = el.closest<HTMLElement>('[data-elegir-curso]');
  if (elegirCurso) { e.preventDefault(); navigate('/curso-gratis'); return; }

  // Tarjeta del módulo #/curso-gratis: confirma la elección (permanente) y lleva al curso.
  const cgElegir = el.closest<HTMLElement>('[data-cg-elegir]');
  if (cgElegir) { e.preventDefault(); confirmarCursoGratis(cgElegir.dataset.cgElegir!, toast, navigate); return; }

  // Modo API: material con archivo protegido y enlaces de En vivo (los pide a la API con sesión).
  const abrirMaterial = el.closest<HTMLElement>('[data-abrir-material]');
  if (abrirMaterial) {
    const id = abrirMaterial.dataset.abrirMaterial!;
    await abrirEnlaceProtegido(abrirMaterial, `/materiales/${encodeURIComponent(id)}/acceso`, (r) => r.url, 'Este material es exclusivo para miembros VIP.');
    return;
  }
  const abrirEvento = el.closest<HTMLElement>('[data-abrir-evento]');
  if (abrirEvento) {
    const id = abrirEvento.dataset.abrirEvento!;
    const tipo = abrirEvento.dataset.eventoTipo === 'grabacion' ? 'grabacion' : 'transmision';
    await abrirEnlaceProtegido(abrirEvento, `/eventos/${encodeURIComponent(id)}/acceso`, (r) => r[tipo], 'Las clases en vivo son para miembros VIP.');
    return;
  }

  if (el.closest('[data-guia]')) { mostrarOnboarding(true); return; }
  if (el.closest('[data-ckl-dismiss]')) { ocultarChecklist(); document.querySelector('.ckl')?.remove(); return; }

  if (el.closest('[data-theme-toggle]')) setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');

  const bell = el.closest('[data-notifs]');
  const panel = document.querySelector<HTMLElement>('[data-notifs-panel]');
  if (panel) {
    if (bell) { panel.hidden = !panel.hidden; if (!panel.hidden) abrirNotifs(panel); }
    else if (!el.closest('[data-notifs-panel]')) panel.hidden = true;
  }

  const tab = el.closest<HTMLButtonElement>('.tabs button[data-for]');
  if (tab) {
    tab.parentElement!.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === tab));
    tab.closest('[data-tabs]')?.querySelectorAll<HTMLElement>('[data-tab]').forEach((p) => (p.hidden = p.dataset.tab !== tab.dataset.for));
  }

  const emitir = el.closest<HTMLButtonElement>('[data-emitir-certificado]');
  if (emitir && Datos.modo === 'api') { if (!emitir.disabled) await abrirCertificado(emitir.dataset.emitirCertificado!, true, emitir); return; }
  if (el.closest('[data-reintentar-club]')) { await cargarPlataforma(true); render(); return; }

  // «Marcar vista» existe solo en demo. En modo API la clase se acredita con eventos reales del reproductor.
  const marcar = Datos.modo === 'demo' ? el.closest<HTMLElement>('[data-marcar-vista]') : null;
  if (marcar) {
    const [id, n] = marcar.dataset.marcarVista!.split(':');
    const c = getCurso(id);
    const yaEstabaVista = Progreso.de(id).vistas.includes(Number(n));
    Progreso.marcarVista(id, Number(n));
    const hayNext = c && c.clases.some((k) => k.n === Number(n) + 1);
    if (!yaEstabaVista) celebrar('normal');
    if (c && !hayNext) {
      toast('¡Todas las clases vistas! Ahora toma tu evaluación final.', 'graduation-cap');
      navigate(`/curso/${id}/examen`);
    } else if (!yaEstabaVista) {
      _showQuiz = true;
      render();
      toast('¡Clase completada! Toma el quiz para reforzar.', 'brain-circuit');
    } else {
      navigate(hayNext ? `/curso/${id}/clase/${Number(n) + 1}` : `/curso/${id}`);
    }
  }

  const canjear = disponible('recompensas') ? el.closest<HTMLButtonElement>('[data-canjear]') : null;
  if (canjear) {
    if (canjear.disabled) return;
    canjear.disabled = true;
    const rid = canjear.dataset.canjear!;
    try {
      const resultado = await api<{ hasta: string }>(`/recompensas/${rid}/canjear`, { method: 'POST' });
      await Auth.refrescarEstado();
      remontar();
      navigate('/recompensas');
      celebrar('grande');
      toast(`Recompensa canjeada. VIP hasta ${new Date(resultado.hasta).toLocaleDateString('es-MX')}.`, 'gift');
    } catch (err) { toast(mensajeError(err), 'circle-alert'); canjear.disabled = false; }
    return;
  }

  const res = el.closest<HTMLElement>('[data-reservar]');
  if (res) {
    const id = res.dataset.reservar!;
    const reservada = toggleReserva(id);
    document.querySelectorAll<HTMLElement>('[data-reservar]').forEach((boton) => {
      if (boton.dataset.reservar !== id) return;
      const hero = boton.dataset.reservarFormato === 'hero';
      boton.classList.toggle('btn--brand', !hero && !reservada);
      boton.classList.toggle('btn--secondary', !hero && reservada);
      boton.setAttribute('aria-pressed', String(reservada));
      boton.innerHTML = hero
        ? `${reservada ? 'Reservado · te avisamos' : 'Reservar mi lugar'} <span class="arrow" style="background:var(--brand-navy);color:#fff"><i data-lucide="${reservada ? 'check' : 'bell'}" class="i"></i></span>`
        : reservada ? 'Reservado' : 'Reservar';
    });
    createIcons({ icons });
    toast(reservada ? 'Lugar reservado · te avisaremos antes de la clase' : 'Reserva cancelada', reservada ? 'bell' : 'bell-off');
  }

  if (el.closest('[data-nuevo-hilo]')) {
    if (!Acceso.puedeComunidad()) { mostrarPaywall('Publicar en la comunidad es para miembros VIP. Puedes leer todos los temas gratis.'); return; }
    const f = document.querySelector<HTMLElement>('[data-form-hilo]'); if (f) { f.hidden = false; f.querySelector('input')?.focus(); } }
  if (el.closest('[data-cancelar-hilo]')) { const f = document.querySelector<HTMLElement>('[data-form-hilo]'); if (f) f.hidden = true; }
  if (el.closest('[data-exp-open]')) {
    if (!Acceso.puedeComunidad()) { mostrarPaywall('Compartir experiencias en Comunidad es para miembros VIP.'); return; }
    const f = document.querySelector<HTMLElement>('[data-form-exp]');
    if (f) { f.hidden = false; f.querySelector<HTMLInputElement>('input[name="titulo"]')?.focus(); }
  }
  if (el.closest('[data-exp-reintentar]')) render();
  if (el.closest('[data-exp-close]')) { const f = document.querySelector<HTMLElement>('[data-form-exp]'); if (f) f.hidden = true; }
  const util = el.closest<HTMLElement>('[data-util]');
  if (util) {
    if (!Acceso.puedeComunidad()) { mostrarPaywall('Reaccionar en la comunidad es para miembros VIP.'); return; }
    try {
      const id = util.dataset.util!;
      await Comunidad.util(id);
      const actualizado = Comunidad.hilo(id);
      if (actualizado) {
        util.classList.add('is-marked');
        util.setAttribute('disabled', '');
        util.setAttribute('aria-pressed', 'true');
        util.innerHTML = `<i data-lucide="thumbs-up" class="i"></i>Marcado útil · ${actualizado.util}`;
        createIcons({ icons });
      }
    } catch (err) { toast(mensajeError(err), 'circle-alert'); }
  }

  const aviso = el.closest<HTMLElement>('[data-aviso]');
  if (aviso) { const p = Perfil.get(); const k = aviso.dataset.aviso as keyof typeof p.avisos; p.avisos[k] = !p.avisos[k]; Perfil.set({ avisos: p.avisos }); aviso.setAttribute('aria-checked', String(p.avisos[k])); }

  const plan = el.closest<HTMLButtonElement>('[data-cambiar-plan]');
  if (plan) {
    if (Datos.modo === 'api') { await irAStripe(plan, '/stripe/checkout', { plan: plan.dataset.cambiarPlan }); }
    else toast('En el demo no se cobra. Con el backend conectado abre el pago seguro de Stripe.', 'credit-card');
  }
  const portal = el.closest<HTMLButtonElement>('[data-portal-stripe]');
  if (portal) {
    if (Datos.modo === 'api') { await irAStripe(portal, '/stripe/portal'); }
    else toast('El portal de facturación de Stripe se abre con el backend conectado.', 'credit-card');
  }

  if (el.closest('[data-imprimir]')) window.print();
  if (el.closest('[data-cert-expand]')) { document.body.classList.add('cert-is-expanded'); return; }
  if (el.closest('[data-cert-close]')) { document.body.classList.remove('cert-is-expanded'); return; }
  const share = el.closest<HTMLElement>('[data-compartir-cert], [data-compartir]');
  if (share) {
    const folio = share.dataset.compartirCert;
    const materialId = share.dataset.compartir;
    const materialCompartido = materialId ? Datos.materiales().find((m) => m.id === materialId) : null;
    const url = folio
      ? `${location.origin}${location.pathname}#/verificar/${encodeURIComponent(folio)}`
      : materialId
        ? `${location.origin}${location.pathname}#/materiales/${encodeURIComponent(materialId)}`
        : location.href;
    const title = materialCompartido?.titulo || 'Club Dermalysse';
    try {
      if (navigator.share) await navigator.share({ title, text: materialCompartido ? `Te comparto este material de Dermalysse: ${title}` : undefined, url });
      else { await navigator.clipboard.writeText(url); toast('Enlace copiado · listo para compartir', 'link'); }
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') toast('No se pudo compartir. Intenta de nuevo.', 'circle-alert');
    }
  }
  const guardarMaterial = el.closest<HTMLElement>('[data-guardar]');
  if (guardarMaterial) {
    const activo = alternarMaterialGuardado(guardarMaterial.dataset.guardar!);
    guardarMaterial.classList.toggle('is-saved', activo);
    guardarMaterial.setAttribute('aria-pressed', String(activo));
    guardarMaterial.setAttribute('aria-label', activo ? 'Quitar de guardados' : 'Guardar como favorito');
    guardarMaterial.setAttribute('title', activo ? 'Quitar de guardados' : 'Guardar como favorito');
    guardarMaterial.innerHTML = `<i data-lucide="${activo ? 'bookmark-check' : 'bookmark'}" class="i"></i>`;
    createIcons({ icons });
    toast(activo ? 'Guardado en tus favoritos' : 'Quitado de tus favoritos', activo ? 'bookmark-check' : 'bookmark-x');
  }

  // Login: cambio de modo sin flasheo
  const modoLink = el.closest<HTMLElement>('[data-login-modo]');
  if (modoLink) {
    e.preventDefault();
    const nuevoModo = modoLink.dataset.loginModo!;
    const panel = document.querySelector<HTMLElement>('[data-login-panel]');
    if (panel && panel.dataset.modoActivo !== nuevoModo) {
      panel.dataset.modoActivo = nuevoModo;
      panel.querySelectorAll<HTMLElement>('.login__switch [data-login-modo]').forEach((opcion) => opcion.classList.toggle('is-active', opcion.dataset.loginModo === nuevoModo));
      const activo = panel.querySelector<HTMLElement>(`.login__modo[data-modo="${nuevoModo}"]`);
      if (activo) { activo.removeAttribute('data-entering'); void activo.offsetHeight; activo.setAttribute('data-entering', ''); }
      const query = new URLSearchParams();
      if (nuevoModo !== 'entrar') query.set('modo', nuevoModo);
      if (panel.dataset.loginPreview === 'true') query.set('vista', '1');
      history.replaceState(null, '', `#/login${query.size ? `?${query}` : ''}`);
    }
    return;
  }
  // Login
  if (el.closest('[data-login-demo]')) { await Auth.entrarDemo(); remontarDesdeLogin(); }
  // Sin await antes de la ventana de Google (los navegadores bloquean popups diferidos): /config ya se leyó al pintar el login.
  if (el.closest('[data-login-google]')) { try { await Auth.entrarGoogle(plataforma().registroAbierto); remontarDesdeLogin(); } catch (err) { mostrarErrorLogin(err); } }
  if (el.closest('[data-salir]')) { await Auth.salir(); limpiarCertificados(); limpiarExperiencia(); shellActual = null; navigate('/login'); }

  // ── Notas interactivas ──
  const seekBtn = el.closest<HTMLElement>('[data-seek-time]');
  if (seekBtn) {
    const t = seekBtn.dataset.seekTime!;
    const [m, s] = t.split(':').map(Number);
    const seconds = (m || 0) * 60 + (s || 0);
    // API: salta con player.js sin recargar el video firmado (conserva la sesión de avance).
    if (reproductor?.buscar(seconds)) return;
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[data-video]');
    if (iframe?.src) {
      const url = new URL(iframe.src);
      url.searchParams.set('t', String(seconds));
      iframe.src = url.toString();
      iframe.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }
  const audioBtn = el.closest<HTMLElement>('[data-notas-audio]');
  if (audioBtn) {
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); audioBtn.classList.remove('is-playing'); return; }
    const notas = audioBtn.closest('.notas');
    if (!notas) return;
    const resumen = notas.querySelector('.notas__resumen p')?.textContent || '';
    const conceptos = Array.from(notas.querySelectorAll('.notas__texto')).map(n => n.textContent).join('. ');
    const u = new SpeechSynthesisUtterance(`Resumen. ${resumen}. Conceptos clave. ${conceptos}`);
    u.lang = 'es-MX'; u.rate = 0.95;
    u.onend = () => audioBtn.classList.remove('is-playing');
    audioBtn.classList.add('is-playing');
    speechSynthesis.speak(u);
    return;
  }
  const domBtn = el.closest<HTMLElement>('[data-dom-set]');
  if (domBtn) {
    const parts = domBtn.dataset.domSet!.split(':');
    const estado = Number(parts.pop());
    const key = parts.join(':');
    try {
      const all = JSON.parse(localStorage.getItem('dermalysse:dominio:v1') || '{}');
      all[key] = all[key] === estado ? -1 : estado;
      localStorage.setItem('dermalysse:dominio:v1', JSON.stringify(all));
      domBtn.closest('.notas__dominio')!.querySelectorAll<HTMLElement>('.dom').forEach(b => {
        const v = Number(b.dataset.domSet!.split(':').pop());
        b.classList.toggle('is-active', all[key] === v);
      });
    } catch {}
    return;
  }
  const preguntaBtn = el.closest<HTMLElement>('[data-pregunta-enviar]');
  if (preguntaBtn) {
    const seccion = preguntaBtn.closest('.notas__seccion');
    const input = seccion?.querySelector<HTMLInputElement>('[data-pregunta-input]');
    const resultado = seccion?.querySelector<HTMLElement>('[data-pregunta-resultado]');
    if (!input || !resultado) return;
    const q = input.value.trim().toLowerCase();
    if (!q) { input.focus(); return; }
    const notasEl = preguntaBtn.closest('.notas');
    const cursoId = notasEl?.getAttribute('data-notas-curso') || '';
    const resumen = notasEl?.querySelector('.notas__resumen p')?.textContent || '';
    const conceptos = Array.from(notasEl?.querySelectorAll('.notas__texto') || []).map(el => el.textContent || '');
    const palabras = q.split(/\s+/).filter(w => w.length > 2);
    const hits: string[] = [];
    if (palabras.some(w => resumen.toLowerCase().includes(w))) hits.push(`<strong>Del resumen:</strong><p>${esc(resumen)}</p>`);
    conceptos.forEach((c, i) => { if (palabras.some(w => c.toLowerCase().includes(w))) hits.push(`<strong>Concepto ${i + 1}:</strong><p>${esc(c)}</p>`); });
    const quizzes = Datos.quizzes().filter(qz => qz.cursoId === cursoId && qz.estado === 'aprobado');
    for (const quiz of quizzes) for (const p of quiz.preguntas) if (palabras.some(w => p.q.toLowerCase().includes(w) || p.explicacion.toLowerCase().includes(w))) hits.push(`<strong>Quiz clase ${quiz.n}:</strong><p>${esc(p.q)}</p><p>${esc(p.explicacion)}</p>`);
    resultado.hidden = false;
    resultado.innerHTML = hits.length ? hits.slice(0, 3).join('') : `<p>No encontré resultados para "<em>${esc(q)}</em>". Prueba con otras palabras del tema.</p>`;
    createIcons({ icons });
    return;
  }

  const iniciarQuiz = el.closest<HTMLElement>('[data-quiz-start], [data-quiz-retry]');
  if (iniciarQuiz) { const shell = quizShell(iniciarQuiz); if (shell) prepararQuizClase(shell); return; }
  const salirQuiz = el.closest<HTMLElement>('[data-quiz-exit]');
  if (salirQuiz) { const shell = quizShell(salirQuiz); if (shell) salirQuizClase(shell); return; }
  const comprobarQuiz = el.closest<HTMLElement>('[data-quiz-check]');
  if (comprobarQuiz) { const form = comprobarQuiz.closest<HTMLFormElement>('[data-quiz-miembro]'); if (form) comprobarPreguntaQuiz(form); return; }
  const avanzarQuiz = el.closest<HTMLElement>('[data-quiz-next]');
  if (avanzarQuiz) { const form = avanzarQuiz.closest<HTMLFormElement>('[data-quiz-miembro]'); const shell = quizShell(avanzarQuiz); if (form && shell) await siguientePreguntaQuiz(shell, form); return; }

  // Evaluación final del curso
  const iniciarExamen = el.closest<HTMLElement>('[data-examen-start], [data-examen-retry]');
  if (iniciarExamen) { const shell = exShell(iniciarExamen); if (shell) prepararExamen(shell); return; }
  const salirEx = el.closest<HTMLElement>('[data-examen-exit]');
  if (salirEx) { const shell = exShell(salirEx); if (shell) salirExamen(shell); return; }
  const comprobarEx = el.closest<HTMLElement>('[data-examen-check]');
  if (comprobarEx) { const form = comprobarEx.closest<HTMLFormElement>('[data-examen-form]'); if (form) comprobarPreguntaExamen(form); return; }
  const avanzarEx = el.closest<HTMLElement>('[data-examen-next]');
  if (avanzarEx) { const form = avanzarEx.closest<HTMLFormElement>('[data-examen-form]'); const shell = exShell(avanzarEx); if (form && shell) siguientePreguntaExamen(shell, form); return; }

  // Opción de quiz/examen marcada visualmente (el input está oculto).
  const opt = el.closest<HTMLLabelElement>('.quiz__opt');
  if (opt && (opt.closest('[data-quiz-miembro]') || opt.closest('[data-examen-form]')) && !opt.querySelector<HTMLInputElement>('input')?.disabled) opt.querySelector<HTMLInputElement>('input')!.checked = true;
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.body.classList.remove('cert-is-expanded');
  if (e.key === 'Enter' && (e.target as HTMLElement).matches('[data-pregunta-input]')) {
    e.preventDefault();
    (e.target as HTMLElement).closest('.notas__seccion')?.querySelector<HTMLButtonElement>('[data-pregunta-enviar]')?.click();
  }
});

let _apuntesTimer: ReturnType<typeof setTimeout>;
document.addEventListener('input', (e) => {
  const ta = e.target as HTMLTextAreaElement;
  if (!ta.matches('[data-apuntes]')) return;
  const key = ta.dataset.apuntes!;
  clearTimeout(_apuntesTimer);
  _apuntesTimer = setTimeout(() => {
    try {
      const all = JSON.parse(localStorage.getItem('dermalysse:apuntes:v1') || '{}');
      all[key] = ta.value;
      localStorage.setItem('dermalysse:apuntes:v1', JSON.stringify(all));
      const status = ta.closest('.notas__seccion')?.querySelector('[data-apuntes-status]');
      if (status) { status.textContent = '✓ Guardado'; status.classList.add('is-visible'); setTimeout(() => status.classList.remove('is-visible'), 2000); }
    } catch {}
  }, 500);
});

function remontarDesdeLogin() { shellActual = null; const v = sessionStorage.getItem('dermalysse:volver') || '/'; sessionStorage.removeItem('dermalysse:volver'); navigate(v === '/login' ? '/' : v); render(); }
function mostrarErrorLogin(err: unknown) { const p = document.querySelector<HTMLElement>('[data-login-error]'); if (p) { p.hidden = false; p.textContent = mensajeError(err); } else toast(mensajeError(err), 'alert-triangle'); }

document.addEventListener('submit', async (e) => {
  const f = e.target as HTMLFormElement;
  if (f.matches('[data-form-canje-cupon]')) {
    e.preventDefault();
    if (!disponible('cupones')) return;
    if (Datos.modo !== 'api') { toast('El canje está disponible en el club conectado.', 'circle-alert'); return; }
    const btn = f.querySelector<HTMLButtonElement>('button');
    btn?.setAttribute('disabled', '');
    try {
      const codigo = String(new FormData(f).get('codigo') || '').trim();
      const resultado = await api<{ hasta: string }>('/cupones/canjear', { method: 'POST', json: { codigo } });
      await Auth.refrescarEstado();
      remontar();
      toast(`Cupón aplicado. Acceso VIP hasta ${new Date(resultado.hasta).toLocaleDateString('es-MX')}.`, 'ticket-percent');
    } catch (err) { toast(mensajeError(err), 'circle-alert'); }
    finally { btn?.removeAttribute('disabled'); }
    return;
  }
  if (f.matches('[data-search]')) {
    e.preventDefault(); const q = new FormData(f).get('q') as string;
    navigate('/cursos' + (q ? '?q=' + encodeURIComponent(q) : ''));
  }
  if (f.matches('[data-form-exp-search]')) {
    e.preventDefault();
    const d = new FormData(f);
    const q = String(d.get('q') || '').trim();
    const categoria = String(d.get('categoria') || 'todas');
    const params = new URLSearchParams();
    if (categoria !== 'todas') params.set('categoria', categoria);
    if (q) params.set('q', q);
    const query = params.toString();
    navigate(`/comunidad/experiencias${query ? `?${query}` : ''}`);
    return;
  }
  if (f.matches('[data-login-form]')) {
    e.preventDefault(); const d = new FormData(f); const btn = f.querySelector('button')!; btn.setAttribute('disabled', '');
    try {
      const modo = f.dataset.loginForm;
      if (modo === 'entrar') await Auth.entrarCorreo(String(d.get('email')), String(d.get('pass')));
      if (modo === 'registro') await Auth.registrar(String(d.get('nombre')).trim(), String(d.get('email')), String(d.get('pass')), (await cargarPlataforma()).registroAbierto);
      if (modo === 'recuperar') {
        await Auth.recuperar(String(d.get('email'))); toast('Te enviamos un correo para crear tu contraseña', 'mail');
        const panel = document.querySelector<HTMLElement>('[data-login-panel]');
        if (panel) { panel.dataset.modoActivo = 'entrar'; history.replaceState(null, '', '#/login'); }
        return;
      }
      remontarDesdeLogin();
    } catch (err) { mostrarErrorLogin(err); } finally { btn.removeAttribute('disabled'); }
  }
  if (f.matches('[data-form-hilo]')) {
    e.preventDefault();
    if (!Acceso.puedeComunidad()) { mostrarPaywall('Publicar en la comunidad es para miembros VIP.'); return; }
    const d = new FormData(f);
    try {
      const h = await Comunidad.crear(String(d.get('titulo')).trim(), String(d.get('texto')).trim(), (d.get('cursoId') as string) || null);
      toast('Tema publicado', 'message-circle'); navigate(`/comunidad/${h.id}`);
    } catch (err) { toast(mensajeError(err), 'circle-alert'); }
  }
  if (f.matches('[data-form-exp]')) {
    e.preventDefault();
    if (!Acceso.puedeComunidad()) { mostrarPaywall('Compartir experiencias en Comunidad es para miembros VIP.'); return; }
    const d = new FormData(f);
    const boton = f.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (boton) boton.disabled = true;
    try {
      const categoria = String(d.get('categoria')) as CategoriaExperiencia;
      if (DirectorioExperiencias.local()) {
        DirectorioExperiencias.crear(String(d.get('titulo') || ''), String(d.get('texto') || ''), categoria, d.get('anonima') === 'on');
        toast('Experiencia guardada en este dispositivo', 'notebook-pen');
      } else {
        await api('/experiencias', { method: 'POST', json: {
          titulo: String(d.get('titulo') || ''), texto: String(d.get('texto') || ''), categoria,
          anonima: d.get('anonima') === 'on', confirmoPrivacidad: d.get('confirmoPrivacidad') === 'on',
        } });
        toast('Envío recibido. Tu aporte queda privado hasta que Comunidad lo revise.', 'shield-check');
      }
      navigate(`/comunidad/experiencias?categoria=${encodeURIComponent(categoria)}`);
    } catch (err) { toast(mensajeError(err), 'circle-alert'); }
    finally { if (boton?.isConnected) boton.disabled = false; }
  }
  if (f.matches('[data-form-respuesta]')) {
    e.preventDefault();
    if (!Acceso.puedeComunidad()) { mostrarPaywall('Responder en la comunidad es para miembros VIP.'); return; }
    try {
      const id = f.dataset.formRespuesta!;
      await Comunidad.responder(id, String(new FormData(f).get('texto')).trim());
      const actualizado = document.createElement('div');
      actualizado.innerHTML = hilo({ id });
      const respuestasNuevas = actualizado.querySelector('.community-replies');
      const accionesNuevas = actualizado.querySelector('.community-question__actions');
      const respuestasActuales = document.querySelector('.community-replies');
      const accionesActuales = document.querySelector('.community-question__actions');
      if (respuestasNuevas && respuestasActuales) respuestasActuales.replaceWith(respuestasNuevas);
      if (accionesNuevas && accionesActuales) accionesActuales.replaceWith(accionesNuevas);
      f.reset();
      createIcons({ icons });
      toast('Respuesta publicada', 'message-square-check');
    }
    catch (err) { toast(mensajeError(err), 'circle-alert'); }
  }
  if (f.matches('[data-form-perfil]')) {
    e.preventDefault(); const d = new FormData(f);
    const cambios = { nombre: String(d.get('nombre')).trim(), whatsapp: String(d.get('whatsapp')).trim(), especialidad: String(d.get('especialidad')).trim(), ciudad: String(d.get('ciudad')).trim() };
    try {
      const guardado = Datos.modo === 'api' ? await api<typeof cambios>('/me/perfil', { method: 'PATCH', json: cambios }) : cambios;
      Perfil.set(guardado); remontar(); toast('Perfil guardado', 'check');
    } catch (err) { toast(mensajeError(err), 'circle-alert'); }
  }
});

// ── PWA: service worker y botón de instalar fijo, nunca popups ──
// Registro del service worker + auto-update: cuando llega un bundle nuevo,
// activamos el SW y recargamos UNA sola vez para servir la versión fresca
// sin pedirle al usuario hacer Ctrl+Shift+R.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js');
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) nuevo.postMessage('SKIP_WAITING');
        });
      });
      let recargando = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (recargando) return;
        recargando = true;
        location.reload();
      });
    } catch { /* El cliente seguirá funcionando sin SW */ }
  });
}
let deferred: any = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
window.addEventListener('appinstalled', () => { document.querySelectorAll('[data-install]').forEach((x) => x.remove()); toast('Dermalysse quedó instalado en tu dispositivo', 'smartphone'); });
document.addEventListener('click', async (e) => {
  if (!(e.target as HTMLElement).closest('[data-install-btn]')) return;
  if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  toast(ios ? 'En iPhone: toca Compartir y luego "Agregar a inicio".' : 'En Chrome: menú ⋮ → "Instalar app" o "Agregar a pantalla principal".', 'smartphone');
});
if (window.matchMedia('(display-mode: standalone)').matches) document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('[data-install]').forEach((x) => x.remove()));
