import { Datos } from '../core/datos';
import { Acceso } from '../core/acceso';
import { esc, placeholder } from '../ui/partials';

const STORAGE_KEY = 'dermalysse:lectura';

function getSavedPage(id: string): number {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')[id] || 0; } catch { return 0; }
}

function savePage(id: string, page: number) {
  try { const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); d[id] = page; localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {}
}

export function visor(params: Record<string, string>) {
  const m = Datos.materiales().find((x) => x.id === params.id);
  if (!m) return placeholder('Material no encontrado', 'Revisa la biblioteca.', 'search-x');
  if (!Acceso.materialAccesible(m)) return placeholder('Contenido VIP', 'Este material es exclusivo para miembros VIP.', 'crown');

  const totalPages = m.paginas || 10;
  const basePath = `/materiales/visor/${m.id}`;
  const saved = getSavedPage(m.id);

  return `
  <section class="libro" data-visor data-material-id="${m.id}" data-total="${totalPages}" data-base="${basePath}" data-saved="${saved}">
    <div class="libro__header" data-visor-header>
      <a class="libro__back" href="#/materiales/${m.id}">
        <i data-lucide="arrow-left" class="i" style="width:16px;height:16px"></i>
        <span>Biblioteca</span>
      </a>
      <div class="libro__header-centro">
        <span class="libro__ornamento">&#10022;</span>
        <h3 class="libro__titulo">${esc(m.titulo)}</h3>
        <span class="libro__ornamento">&#10022;</span>
      </div>
      <div class="libro__controles">
        <button class="libro__ctrl-btn" data-visor-zoom-out aria-label="Alejar"><i data-lucide="zoom-out" class="i" style="width:14px;height:14px"></i></button>
        <button class="libro__ctrl-btn" data-visor-zoom-in aria-label="Acercar"><i data-lucide="zoom-in" class="i" style="width:14px;height:14px"></i></button>
        <button class="libro__ctrl-btn" data-visor-fullscreen aria-label="Pantalla completa"><i data-lucide="maximize" class="i" style="width:14px;height:14px"></i></button>
      </div>
    </div>

    ${saved > 1 ? `<div class="libro__continuar" data-visor-continuar="${saved}">
      <i data-lucide="bookmark" class="i" style="width:14px;height:14px"></i>
      Continuar en página ${saved}
      <button data-visor-continuar-x aria-label="Cerrar"><i data-lucide="x" class="i" style="width:12px;height:12px"></i></button>
    </div>` : ''}

    <div class="libro__escenario" data-visor-escenario>
      <button class="libro__flecha libro__flecha--izq" data-visor-prev disabled aria-label="Anterior">
        <i data-lucide="chevron-left" class="i"></i>
      </button>

      <div class="libro__cuerpo" data-visor-canvas>
        <div class="libro__borde-ext libro__borde-ext--izq"></div>
        <div class="libro__pagina libro__pagina--izq">
          <div class="libro__esquina libro__esquina--tl"></div>
          <div class="libro__esquina libro__esquina--bl"></div>
          <div class="libro__pag-num libro__pag-num--izq" data-visor-num-left></div>
          <img data-visor-img-left draggable="false" alt="">
        </div>
        <div class="libro__lomo">
          <div class="libro__lomo-detalle"></div>
          <div class="libro__lomo-detalle"></div>
          <div class="libro__lomo-detalle"></div>
        </div>
        <div class="libro__pagina libro__pagina--der">
          <div class="libro__esquina libro__esquina--tr"></div>
          <div class="libro__esquina libro__esquina--br"></div>
          <div class="libro__pag-num libro__pag-num--der" data-visor-num-right></div>
          <img data-visor-img-right draggable="false" alt="">
        </div>
        <div class="libro__borde-ext libro__borde-ext--der"></div>
      </div>

      <button class="libro__flecha libro__flecha--der" data-visor-next aria-label="Siguiente">
        <i data-lucide="chevron-right" class="i"></i>
      </button>
    </div>

    <div class="libro__pie" data-visor-pie>
      <span class="libro__info"><i data-lucide="user" class="i" style="width:11px;height:11px;opacity:.5"></i> ${esc(m.autor)}</span>
      <div class="libro__paginador">
        <span class="libro__paginador-flor">&#9753;</span>
        <button class="libro__pag-btn" data-visor-pag-texto title="Ir a página…">Página <strong>1</strong> de <strong>${totalPages}</strong></button>
        <span class="libro__paginador-flor">&#9753;</span>
      </div>
      <div class="libro__ir-a" data-visor-ir-a style="display:none">
        <label>Ir a página</label>
        <input type="number" data-visor-ir-a-input min="1" max="${totalPages}" placeholder="1–${totalPages}">
        <button class="libro__ir-a-ok" data-visor-ir-a-ok>Ir</button>
        <button class="libro__ir-a-x" data-visor-ir-a-x>&times;</button>
      </div>
      <span class="libro__info"><i data-lucide="book-open" class="i" style="width:11px;height:11px;opacity:.5"></i> ${esc(m.tipo)} &middot; ${m.paginas} págs</span>
    </div>

    <div class="libro__progreso" data-visor-progreso>
      <div class="libro__progreso-fill" data-visor-progreso-fill></div>
      <div class="libro__progreso-thumb" data-visor-progreso-thumb></div>
    </div>
  </section>`;
}

export function montarVisor() {
  const el = document.querySelector<HTMLElement>('[data-visor]');
  if (!el) return;
  const root: HTMLElement = el;

  document.body.classList.add('visor-activo');

  const $ = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const imgLeft = $<HTMLImageElement>('[data-visor-img-left]');
  const imgRight = $<HTMLImageElement>('[data-visor-img-right]');
  const numLeft = $('[data-visor-num-left]');
  const numRight = $('[data-visor-num-right]');
  const canvas = $('[data-visor-canvas]');
  const prevBtn = $<HTMLButtonElement>('[data-visor-prev]');
  const nextBtn = $<HTMLButtonElement>('[data-visor-next]');
  const progresoFill = $('[data-visor-progreso-fill]');
  const progresoThumb = $('[data-visor-progreso-thumb]');
  const progresoBar = $('[data-visor-progreso]');
  const escenario = $('[data-visor-escenario]');
  const pagTexto = $('[data-visor-pag-texto]');
  const fullscreenBtn = $<HTMLButtonElement>('[data-visor-fullscreen]');
  const continuar = el.querySelector<HTMLElement>('[data-visor-continuar]');
  const irAPanel = $('[data-visor-ir-a]');
  const irAInput = $<HTMLInputElement>('[data-visor-ir-a-input]');

  const materialId = el.dataset.materialId!;
  const total = Number(el.dataset.total);
  const base = el.dataset.base!;
  const saved = Number(el.dataset.saved) || 0;
  let page = 1;
  let zoom = 1;
  const mobile = () => matchMedia('(max-width: 768px)').matches;

  const preloaded = new Set<string>();
  function preload(n: number) {
    if (n < 1 || n > total) return;
    const src = `${base}/p${n}.webp`;
    if (preloaded.has(src)) return;
    preloaded.add(src);
    new Image().src = src;
  }

  function loadImg(img: HTMLImageElement, n: number, numEl: HTMLElement) {
    if (n < 1 || n > total) {
      img.src = ''; img.alt = ''; numEl.textContent = '';
      img.closest('.libro__pagina')!.classList.add('libro__pagina--vacia');
      return;
    }
    img.closest('.libro__pagina')!.classList.remove('libro__pagina--vacia');
    img.style.opacity = '0.3';
    img.onload = () => { img.style.opacity = '1'; };
    img.onerror = () => { img.style.opacity = '0.15'; };
    img.src = `${base}/p${n}.webp`;
    img.alt = `Página ${n}`;
    numEl.textContent = String(n);
  }

  function updateProgress() {
    const pct = ((page - 1) / Math.max(total - 1, 1)) * 100;
    progresoFill.style.width = `${pct}%`;
    progresoThumb.style.left = `${pct}%`;
  }

  function go(p: number) {
    if (zoom > 1) setZoom(1);
    const m = mobile();
    if (m) {
      page = Math.max(1, Math.min(total, p));
      loadImg(imgLeft, page, numLeft);
      imgRight.src = ''; numRight.textContent = '';
      pagTexto.innerHTML = `Página <strong>${page}</strong> de <strong>${total}</strong>`;
      prevBtn.disabled = page <= 1;
      nextBtn.disabled = page >= total;
      preload(page + 1); preload(page + 2);
    } else {
      page = Math.max(1, p % 2 === 0 ? p - 1 : p);
      if (page > total) page = total % 2 === 0 ? total - 1 : total;
      const right = page + 1;
      loadImg(imgLeft, page, numLeft);
      loadImg(imgRight, right <= total ? right : -1, numRight);
      pagTexto.innerHTML = right <= total
        ? `Páginas <strong>${page}</strong>–<strong>${right}</strong> de <strong>${total}</strong>`
        : `Página <strong>${page}</strong> de <strong>${total}</strong>`;
      prevBtn.disabled = page <= 1;
      nextBtn.disabled = right >= total;
      preload(right + 1); preload(right + 2);
    }
    updateProgress();
    savePage(materialId, page);
  }

  function prev() { go(page - (mobile() ? 1 : 2)); }
  function next() { go(page + (mobile() ? 1 : 2)); }

  // — Zoom + Pan state —
  let panX = 0, panY = 0;

  function applyTransform() {
    canvas.style.transform = zoom === 1 && panX === 0 && panY === 0
      ? '' : `scale(${zoom}) translate(${panX}px, ${panY}px)`;
    canvas.style.cursor = zoom > 1 ? 'grab' : '';
  }

  function setZoom(z: number) {
    zoom = Math.max(0.5, Math.min(3, z));
    if (zoom <= 1) { zoom = 1; panX = 0; panY = 0; }
    applyTransform();
  }

  // Controls visibility (mobile tap)
  let controlsHidden = false;
  function toggleControls() {
    controlsHidden = !controlsHidden;
    root.classList.toggle('libro--ocultar', controlsHidden);
    if (controlsHidden) closeIrA();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) root.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  // — Events —
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
  $('[data-visor-zoom-in]').addEventListener('click', () => setZoom(zoom + 0.25));
  $('[data-visor-zoom-out]').addEventListener('click', () => setZoom(zoom - 0.25));
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  if (continuar) {
    continuar.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-visor-continuar-x]')) { continuar.remove(); return; }
      go(Number(continuar.dataset.visorContinuar));
      continuar.remove();
    });
  }

  // — Go to specific page —
  function openIrA() { irAPanel.style.display = 'flex'; irAInput.value = String(page); irAInput.focus(); irAInput.select(); }
  function closeIrA() { irAPanel.style.display = 'none'; }
  function submitIrA() {
    const n = Number(irAInput.value);
    if (n >= 1 && n <= total) go(n);
    closeIrA();
  }
  pagTexto.addEventListener('click', openIrA);
  $('[data-visor-ir-a-ok]').addEventListener('click', submitIrA);
  $('[data-visor-ir-a-x]').addEventListener('click', closeIrA);
  irAInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitIrA(); if (e.key === 'Escape') closeIrA(); });

  // — Drag to pan (mouse) —
  let isPanning = false, panStartX = 0, panStartY = 0, panBaseX = 0, panBaseY = 0, didPan = false;

  canvas.addEventListener('mousedown', (e) => {
    if (zoom <= 1 || (e.target as HTMLElement).closest('button')) return;
    isPanning = true; didPan = false;
    panStartX = e.clientX; panStartY = e.clientY;
    panBaseX = panX; panBaseY = panY;
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    const dx = (e.clientX - panStartX) / zoom;
    const dy = (e.clientY - panStartY) / zoom;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didPan = true;
    panX = panBaseX + dx;
    panY = panBaseY + dy;
    applyTransform();
  });
  document.addEventListener('mouseup', () => {
    if (isPanning) { isPanning = false; canvas.style.cursor = zoom > 1 ? 'grab' : ''; }
  });

  // Double-click to toggle 2x zoom
  canvas.addEventListener('dblclick', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (zoom > 1) { setZoom(1); } else { setZoom(2); }
    e.preventDefault();
  });

  // — Touch: swipe (zoom=1), pan (zoom>1), pinch-to-zoom —
  let tx = 0, ty = 0, lastPinchDist = 0, pinching = false;

  function pinchDist(touches: TouchList) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  escenario.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinching = true;
      lastPinchDist = pinchDist(e.touches);
      e.preventDefault();
      return;
    }
    if (e.touches.length !== 1) return;
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    if (zoom > 1) {
      isPanning = true; didPan = false;
      panStartX = tx; panStartY = ty;
      panBaseX = panX; panBaseY = panY;
    }
  }, { passive: false });

  escenario.addEventListener('touchmove', (e) => {
    if (pinching && e.touches.length === 2) {
      const d = pinchDist(e.touches);
      const scale = d / lastPinchDist;
      setZoom(zoom * scale);
      lastPinchDist = d;
      e.preventDefault();
      return;
    }
    if (isPanning && zoom > 1 && e.touches.length === 1) {
      const dx = (e.touches[0].clientX - panStartX) / zoom;
      const dy = (e.touches[0].clientY - panStartY) / zoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didPan = true;
      panX = panBaseX + dx;
      panY = panBaseY + dy;
      applyTransform();
      e.preventDefault();
    }
  }, { passive: false });

  escenario.addEventListener('touchend', (e) => {
    if (pinching) { pinching = e.touches.length >= 2; return; }
    isPanning = false;
    if (zoom > 1 && didPan) return;
    if (!e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (zoom <= 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next(); else prev();
    } else if (zoom <= 1 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      if (mobile() && !(e.target as HTMLElement).closest('button')) toggleControls();
    }
  }, { passive: true });

  // Scroll wheel zoom (desktop)
  escenario.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(zoom + (e.deltaY < 0 ? 0.15 : -0.15));
  }, { passive: false });

  // Keyboard
  const onKey = (e: KeyboardEvent) => {
    if (!document.querySelector('[data-visor]')) return;
    switch (e.key) {
      case 'ArrowLeft': prev(); break;
      case 'ArrowRight': case ' ': e.preventDefault(); next(); break;
      case 'Home': e.preventDefault(); go(1); break;
      case 'End': e.preventDefault(); go(total); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'Escape':
        if (zoom > 1) setZoom(1);
        else if (document.fullscreenElement) document.exitFullscreen();
        break;
      case '+': case '=': setZoom(zoom + 0.25); break;
      case '-': setZoom(zoom - 0.25); break;
      case '0': setZoom(1); break;
    }
  };
  document.addEventListener('keydown', onKey);

  // Progress bar
  function progressGo(e: MouseEvent | TouchEvent) {
    const rect = progresoBar.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    go(Math.round(Math.max(0, Math.min(1, x / rect.width)) * (total - 1)) + 1);
  }
  progresoBar.addEventListener('click', progressGo);
  let dragging = false;
  progresoThumb.addEventListener('mousedown', (e) => { e.preventDefault(); dragging = true; });
  document.addEventListener('mousemove', (e) => { if (dragging) progressGo(e); });
  document.addEventListener('mouseup', () => { dragging = false; });

  // Fullscreen icon
  document.addEventListener('fullscreenchange', () => {
    const ic = fullscreenBtn.querySelector('[data-lucide]');
    if (ic) ic.setAttribute('data-lucide', document.fullscreenElement ? 'minimize' : 'maximize');
    import('lucide').then(({ createIcons, icons }) => createIcons({ icons }));
  });

  // Re-render on resize/rotation (switch between 1-page and 2-page modes)
  let wasMobile = mobile();
  const onResize = () => {
    const nowMobile = mobile();
    if (nowMobile !== wasMobile) { wasMobile = nowMobile; go(page); }
  };
  window.addEventListener('resize', onResize);

  // Init
  go(saved > 1 ? saved : 1);
  preload(3); preload(4);

  // Cleanup when leaving visor
  const obs = new MutationObserver(() => {
    if (!document.querySelector('[data-visor]')) {
      document.body.classList.remove('visor-activo');
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      obs.disconnect();
    }
  });
  obs.observe(document.getElementById('outlet')!, { childList: true });
}
