import type { JuegoAcademia, Minijuego } from '../core/academia';
import { generarCrucigrama, generarSopa, hash } from './academia-bloques';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const ic = (n: string) => `<i data-lucide="${n}" class="i" aria-hidden="true"></i>`;
const tipoNombre = { sopa: 'Exploración visual', crucigrama: 'Dominio de conceptos', memorama: 'Conexiones esenciales' } as const;
const unidadProgreso = { sopa: 'términos', crucigrama: 'casillas', memorama: 'parejas' } as const;

type Validar = (entrada: Record<string, unknown>) => Promise<JuegoAcademia>;

function progresoVacio(tipo: JuegoAcademia['tipo']) {
  return { resueltos: [], marcadas: [], jugadas: 0, errores: 0, puntaje: 0, completado: false, completadoEn: null, recompensaAcreditada: false, tipo };
}

function barajar<T>(lista: T[], semilla: number) {
  let a = semilla >>> 0 || 1;
  const azar = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
  const salida = [...lista];
  for (let i = salida.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [salida[i], salida[j]] = [salida[j], salida[i]]; }
  return salida;
}

/** Control local honesto para la vista previa: reproduce el contrato, pero no acredita Diamantes. */
export function juegoLocal(juego: Minijuego, semilla: number): { juego: JuegoAcademia; validar: Validar } {
  const version = `demo-${hash(JSON.stringify(juego)).toString(36)}`;
  let actual: JuegoAcademia;
  let resolver: (entrada: Record<string, unknown>) => { resueltos: string[]; acierto: boolean };
  if (juego.tipo === 'sopa') {
    const palabras = (juego.palabras || []).map((p) => p.toUpperCase());
    const sopa = generarSopa(palabras, semilla);
    if (!sopa) throw new Error('No se pudo preparar la sopa de letras.');
    actual = {
      version, tipo: 'sopa', titulo: juego.titulo, total: palabras.length,
      recompensa: { diamantes: 10, acreditada: false }, progreso: progresoVacio('sopa'),
      tablero: { tam: sopa.tam, filas: sopa.grilla.map((f) => f.join('')), palabras },
    };
    resolver = (entrada) => {
      const ruta = Array.isArray(entrada.ruta) ? entrada.ruta.map(String) : [];
      const clave = ruta.join(';'), inversa = [...ruta].reverse().join(';');
      const encontrada = sopa.ubic.find((u) => u.celdas.map((x) => x.join(',')).join(';') === clave || u.celdas.map((x) => x.join(',')).join(';') === inversa);
      return { resueltos: encontrada ? [encontrada.palabra] : [], acierto: !!encontrada };
    };
  } else if (juego.tipo === 'crucigrama') {
    const cruz = generarCrucigrama((juego.pistas || []).map((p) => ({ ...p, palabra: p.palabra.toUpperCase() })));
    actual = {
      version, tipo: 'crucigrama', titulo: juego.titulo, total: cruz.celdas.size,
      recompensa: { diamantes: 10, acreditada: false }, progreso: progresoVacio('crucigrama'),
      tablero: {
        filas: cruz.filas, cols: cruz.cols, celdas: [...cruz.celdas.keys()], numeros: Object.fromEntries(cruz.nums),
        palabras: cruz.palabras.map((p, i) => ({
          id: `p${i}`, numero: p.num, pista: p.pista, largo: p.palabra.length, direccion: p.h ? 'horizontal' : 'vertical',
          celdas: Array.from({ length: p.palabra.length }, (_, k) => `${p.r + (p.h ? 0 : k)},${p.c + (p.h ? k : 0)}`),
        })),
      },
    };
    resolver = (entrada) => {
      const respuestas = entrada.respuestas && typeof entrada.respuestas === 'object' ? entrada.respuestas as Record<string, unknown> : {};
      const resueltos = [...cruz.celdas].filter(([k, letra]) => String(respuestas[k] || '').toUpperCase() === letra).map(([k]) => k);
      return { resueltos, acierto: resueltos.length > 0 };
    };
  } else {
    const cartas = barajar((juego.pares || []).flatMap((p, i) => [
      { id: `a${i}`, texto: p.a, pareja: `p${i}` }, { id: `b${i}`, texto: p.b, pareja: `p${i}` },
    ]), semilla);
    actual = {
      version, tipo: 'memorama', titulo: juego.titulo, total: (juego.pares || []).length,
      recompensa: { diamantes: 10, acreditada: false }, progreso: progresoVacio('memorama'),
      tablero: { cartas: cartas.map(({ id, texto }) => ({ id, texto })) },
    };
    resolver = (entrada) => {
      const ids = Array.isArray(entrada.cartas) ? entrada.cartas.map(String) : [];
      const [a, b] = ids.map((id) => cartas.find((c) => c.id === id));
      const acierto = !!a && !!b && a.id !== b.id && a.pareja === b.pareja;
      return { resueltos: acierto ? [a!.pareja] : [], acierto };
    };
  }
  return {
    juego: actual,
    validar: async (entrada) => {
      const r = resolver(entrada);
      const resueltos = [...new Set([...actual.progreso.resueltos, ...r.resueltos])].slice(0, actual.total);
      const marcadas = actual.tipo === 'sopa'
        ? (() => {
            const sopa = generarSopa(((actual.tablero.palabras as string[]) || []), semilla)!;
            return sopa.ubic.filter((u) => resueltos.includes(u.palabra)).flatMap((u) => u.celdas.map((x) => x.join(',')));
          })()
        : actual.tipo === 'crucigrama' ? resueltos : ((actual.tablero.cartas as { id: string }[]) || []).filter((c) => {
            const original = cartasPorJuego(juego).find((x) => x.id === c.id);
            return !!original && resueltos.includes(original.pareja);
          }).map((c) => c.id);
      const errores = actual.progreso.errores + (r.acierto ? 0 : 1);
      const completado = resueltos.length >= actual.total;
      actual = {
        ...actual, acierto: r.acierto, diamantesGanados: 0,
        progreso: {
          ...actual.progreso, resueltos, marcadas, jugadas: actual.progreso.jugadas + 1, errores, completado,
          puntaje: completado ? Math.max(60, 100 - errores * 4) : Math.round((resueltos.length / Math.max(1, actual.total)) * 100),
          completadoEn: completado ? new Date().toISOString() : null,
        },
      };
      return actual;
    },
  };
}

function cartasPorJuego(juego: Minijuego): { id: string; pareja: string }[] {
  if (juego.tipo !== 'memorama') return [];
  return (juego.pares || []).flatMap((_, i) => [{ id: `a${i}`, pareja: `p${i}` }, { id: `b${i}`, pareja: `p${i}` }]);
}

function sopaHTML(juego: JuegoAcademia) {
  const filas = juego.tablero.filas as string[];
  const palabras = juego.tablero.palabras as string[];
  const tam = Number(juego.tablero.tam);
  return `<div class="ac-lab-sopa" data-lab-sopa style="--tam:${tam}">
    <div class="ac-lab-sopa__zona"><div class="ac-lab-sopa__grid" role="grid" aria-label="Sopa de letras de ${tam} por ${tam}">${filas.map((fila, r) => [...fila].map((letra, c) => `<button type="button" class="ac-lab-sopa__c" data-rc="${r},${c}" role="gridcell" tabindex="${r || c ? -1 : 0}" aria-label="${letra}, fila ${r + 1}, columna ${c + 1}">${letra}</button>`).join('')).join('')}</div><p class="ac-lab__micro">Elige la primera y la última letra de cada término.</p></div>
    <aside class="ac-lab-sopa__panel"><span class="ac-lab__eyebrow">Mapa de conceptos</span><h3>Encuentra ${palabras.length} términos</h3><ul>${palabras.map((p) => `<li data-lab-palabra="${esc(p)}"><span>${esc(p)}</span>${ic('check')}</li>`).join('')}</ul><p data-lab-estado role="status" aria-live="polite">Elige un término para comenzar.</p></aside>
  </div>`;
}

interface PalabraCruz { id: string; numero: number; pista: string; largo: number; direccion: 'horizontal' | 'vertical'; celdas: string[] }
function crucigramaHTML(juego: JuegoAcademia) {
  const filas = Number(juego.tablero.filas), cols = Number(juego.tablero.cols);
  const celdas = new Set(juego.tablero.celdas as string[]);
  const numeros = juego.tablero.numeros as Record<string, number>;
  const palabras = juego.tablero.palabras as PalabraCruz[];
  const grid: string[] = [];
  for (let r = 0; r < filas; r++) for (let c = 0; c < cols; c++) {
    const key = `${r},${c}`;
    grid.push(celdas.has(key) ? `<label class="ac-lab-cruz__c" data-cruz-celda="${key}">${numeros[key] ? `<small>${numeros[key]}</small>` : ''}<input maxlength="1" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" data-rc="${key}" aria-label="Casilla fila ${r + 1}, columna ${c + 1}"></label>` : '<span class="ac-lab-cruz__v" aria-hidden="true"></span>');
  }
  return `<div class="ac-lab-cruz" data-lab-cruz><section class="ac-lab-cruz__foco"><span class="ac-lab__eyebrow">Pista activa</span><strong data-cruz-pista>Elige una pista para comenzar</strong><small data-cruz-meta>El tablero se centrará automáticamente.</small></section><div class="ac-lab-cruz__scroll" tabindex="0" role="region" aria-label="Tablero desplazable"><div class="ac-lab-cruz__grid" style="--cols:${cols}">${grid.join('')}</div></div><div class="ac-lab-cruz__pistas">${palabras.map((p) => `<button type="button" data-cruz-palabra="${esc(p.id)}" data-celdas="${p.celdas.join(';')}"><b>${p.numero}</b><span>${esc(p.pista)}</span><em>${p.direccion === 'horizontal' ? 'Horizontal' : 'Vertical'} · ${p.largo}</em></button>`).join('')}</div><footer class="ac-lab__acciones"><button type="button" class="btn btn--brand" data-cruz-revisar>Comprobar avance ${ic('check')}</button><p data-lab-estado role="status" aria-live="polite">Puedes comprobar cuantas veces necesites.</p></footer></div>`;
}

function memoramaHTML(juego: JuegoAcademia) {
  const cartas = juego.tablero.cartas as { id: string; texto: string }[];
  const movimientos = juego.progreso.jugadas;
  return `<div class="ac-lab-memo" data-lab-memo><header><div><span class="ac-lab__eyebrow">Conecta significado y función</span><h3>${juego.total} parejas esenciales</h3></div><p><b data-memo-mov>${movimientos}</b> <span data-memo-mov-label>${movimientos === 1 ? 'movimiento' : 'movimientos'}</span></p></header><div class="ac-lab-memo__grid">${cartas.map((c, i) => `<button type="button" class="ac-lab-memo__c" data-carta="${esc(c.id)}" aria-label="Carta ${i + 1}, oculta"><span class="ac-lab-memo__dorso" aria-hidden="true">${ic('sparkles')}<small>Dermalysse</small></span><span class="ac-lab-memo__cara" aria-hidden="true">${esc(c.texto)}</span></button>`).join('')}</div><p data-lab-estado role="status" aria-live="polite">Voltea dos cartas para encontrar su conexión.</p></div>`;
}

export function laboratorioHTML(juego: JuegoAcademia, remoto: boolean) {
  const resueltos = juego.progreso.resueltos.length;
  return `<section class="ac-lab" data-lab data-tipo="${juego.tipo}"><header class="ac-lab__barra"><div><span class="ac-lab__eyebrow">Laboratorio Dermalysse · ${tipoNombre[juego.tipo]}</span><strong>${esc(juego.titulo)}</strong></div><div class="ac-lab__estado-sync">${ic(remoto ? 'cloud-check' : 'monitor-dot')}<span>${remoto ? 'Progreso sincronizado' : 'Vista previa local'}</span></div></header><div class="ac-lab__marcador"><div class="ac-lab__progreso"><span><b data-lab-resueltos>${resueltos}</b> de ${juego.total} ${unidadProgreso[juego.tipo]}</span><div role="progressbar" aria-label="Progreso del laboratorio" aria-valuemin="0" aria-valuemax="${juego.total}" aria-valuenow="${resueltos}"><i data-lab-barra style="width:${(resueltos / Math.max(1, juego.total)) * 100}%"></i></div></div><div class="ac-lab__stat"><small>Precisión</small><b data-lab-puntaje>${juego.progreso.puntaje}%</b></div><div class="ac-lab__premio">${ic('gem')}<span><small>Primera finalización</small><b>+${juego.recompensa.diamantes} Diamantes</b></span></div></div><div class="ac-lab__escena">${juego.tipo === 'sopa' ? sopaHTML(juego) : juego.tipo === 'crucigrama' ? crucigramaHTML(juego) : memoramaHTML(juego)}</div></section>`;
}

export function montarLaboratorio(root: HTMLElement, inicial: JuegoAcademia, validar: Validar, alCompletar: (juego: JuegoAcademia) => void, signal: AbortSignal) {
  let actual = inicial;
  let ocupado = false;
  let anunciado = inicial.progreso.completado;
  let inicioSopa: HTMLElement | null = null;
  let cartas: HTMLButtonElement[] = [];
  const estado = () => root.querySelector<HTMLElement>('[data-lab-estado]');
  const mensaje = (texto: string, ok?: boolean) => { const el = estado(); if (el) { el.textContent = texto; el.classList.toggle('is-ok', ok === true); el.classList.toggle('is-no', ok === false); } };
  const aplicar = (juego: JuegoAcademia) => {
    actual = juego;
    const resueltos = root.querySelector<HTMLElement>('[data-lab-resueltos]'); if (resueltos) resueltos.textContent = String(juego.progreso.resueltos.length);
    const puntaje = root.querySelector<HTMLElement>('[data-lab-puntaje]'); if (puntaje) puntaje.textContent = `${juego.progreso.puntaje}%`;
    const barra = root.querySelector<HTMLElement>('[data-lab-barra]'); if (barra) barra.style.width = `${(juego.progreso.resueltos.length / Math.max(1, juego.total)) * 100}%`;
    barra?.parentElement?.setAttribute('aria-valuenow', String(juego.progreso.resueltos.length));
    if (juego.tipo === 'sopa') {
      root.querySelectorAll<HTMLElement>('[data-lab-palabra]').forEach((li) => li.classList.toggle('is-ok', juego.progreso.resueltos.includes(li.dataset.labPalabra!)));
      root.querySelectorAll<HTMLElement>('[data-rc]').forEach((c) => c.classList.toggle('is-ok', juego.progreso.marcadas.includes(c.dataset.rc!)));
    } else if (juego.tipo === 'crucigrama') {
      root.querySelectorAll<HTMLInputElement>('.ac-lab-cruz input').forEach((i) => i.classList.toggle('is-ok', juego.progreso.marcadas.includes(i.dataset.rc!)));
    } else {
      root.querySelectorAll<HTMLButtonElement>('[data-carta]').forEach((c) => {
        const lista = juego.progreso.marcadas;
        c.classList.toggle('is-ok', lista.includes(c.dataset.carta!)); c.disabled = lista.includes(c.dataset.carta!);
      });
      const mov = root.querySelector<HTMLElement>('[data-memo-mov]'); if (mov) mov.textContent = String(juego.progreso.jugadas);
      const movLabel = root.querySelector<HTMLElement>('[data-memo-mov-label]'); if (movLabel) movLabel.textContent = juego.progreso.jugadas === 1 ? 'movimiento' : 'movimientos';
    }
    if (juego.progreso.completado && !anunciado) { anunciado = true; alCompletar(juego); }
  };
  const enviar = async (entrada: Record<string, unknown>) => {
    if (ocupado) return null;
    ocupado = true; root.classList.add('is-validando');
    try { const r = await validar(entrada); aplicar(r); return r; }
    catch (e) { mensaje(e instanceof Error ? e.message : 'No pudimos validar la jugada. Intenta de nuevo.', false); return null; }
    finally { ocupado = false; root.classList.remove('is-validando'); }
  };
  aplicar(inicial);
  root.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.matches('.ac-lab-cruz input')) return;
    input.value = input.value.toUpperCase().replace(/[^A-ZÑ]/g, '').slice(-1); input.classList.remove('is-no');
    if (!input.value) return;
    const activa = root.querySelector<HTMLElement>('[data-cruz-palabra].is-activa');
    const celdas = (activa?.dataset.celdas || '').split(';').filter(Boolean);
    const siguiente = celdas[celdas.indexOf(input.dataset.rc!) + 1];
    if (siguiente) root.querySelector<HTMLInputElement>(`.ac-lab-cruz input[data-rc="${siguiente}"]`)?.focus();
  }, { signal });
  root.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement;
    if (!el.matches('.ac-lab-sopa__c')) return;
    const d = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, number[]>)[e.key];
    if (!d) return;
    e.preventDefault(); const tam = Number(actual.tablero.tam); const [r, c] = el.dataset.rc!.split(',').map(Number);
    const sig = root.querySelector<HTMLElement>(`[data-rc="${Math.min(tam - 1, Math.max(0, r + d[0]))},${Math.min(tam - 1, Math.max(0, c + d[1]))}"]`);
    if (sig) { el.tabIndex = -1; sig.tabIndex = 0; sig.focus(); }
  }, { signal });
  root.addEventListener('click', async (e) => {
    const el = e.target as HTMLElement;
    const celda = el.closest<HTMLElement>('.ac-lab-sopa__c');
    if (celda) {
      if (!inicioSopa) { inicioSopa = celda; celda.classList.add('is-ini'); mensaje('Ahora elige la última letra.'); return; }
      const [r0, c0] = inicioSopa.dataset.rc!.split(',').map(Number), [r1, c1] = celda.dataset.rc!.split(',').map(Number);
      inicioSopa.classList.remove('is-ini'); inicioSopa = null;
      if (!(r0 === r1 || c0 === c1 || Math.abs(r1 - r0) === Math.abs(c1 - c0))) { mensaje('La selección debe formar una línea recta.', false); return; }
      const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0), largo = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)) + 1;
      const ruta = Array.from({ length: largo }, (_, k) => `${r0 + dr * k},${c0 + dc * k}`);
      const r = await enviar({ ruta }); mensaje(r?.acierto ? '¡Concepto encontrado! Sigue construyendo tu mapa.' : 'Esa línea no corresponde a un término. Prueba otra.', r?.acierto); return;
    }
    const pista = el.closest<HTMLElement>('[data-cruz-palabra]');
    if (pista) {
      root.querySelectorAll('[data-cruz-palabra]').forEach((x) => x.classList.toggle('is-activa', x === pista));
      root.querySelectorAll('[data-cruz-celda]').forEach((x) => x.classList.toggle('is-activa', (pista.dataset.celdas || '').split(';').includes((x as HTMLElement).dataset.cruzCelda!)));
      const texto = root.querySelector<HTMLElement>('[data-cruz-pista]'); if (texto) texto.textContent = pista.querySelector('span')?.textContent || '';
      const meta = root.querySelector<HTMLElement>('[data-cruz-meta]'); if (meta) meta.textContent = pista.querySelector('em')?.textContent || '';
      const primera = (pista.dataset.celdas || '').split(';')[0]; const input = root.querySelector<HTMLInputElement>(`.ac-lab-cruz input[data-rc="${primera}"]`);
      input?.focus(); input?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); return;
    }
    if (el.closest('[data-cruz-revisar]')) {
      const respuestas: Record<string, string> = {};
      root.querySelectorAll<HTMLInputElement>('.ac-lab-cruz input').forEach((i) => { respuestas[i.dataset.rc!] = i.value; i.classList.remove('is-no'); });
      const r = await enviar({ respuestas });
      root.querySelectorAll<HTMLInputElement>('.ac-lab-cruz input').forEach((i) => { if (i.value && !r?.progreso.marcadas.includes(i.dataset.rc!)) i.classList.add('is-no'); });
      mensaje(r?.progreso.completado ? '¡Crucigrama dominado!' : `${r?.progreso.resueltos.length || 0} casillas correctas. Conservamos tu avance.`, r?.acierto); return;
    }
    const carta = el.closest<HTMLButtonElement>('[data-carta]');
    if (carta && !carta.disabled && !carta.classList.contains('is-up') && cartas.length < 2) {
      carta.classList.add('is-up'); carta.setAttribute('aria-label', `Carta volteada: ${carta.querySelector('.ac-lab-memo__cara')?.textContent || ''}`); cartas.push(carta);
      if (cartas.length === 2) {
        const par = [...cartas]; const r = await enviar({ cartas: par.map((c) => c.dataset.carta!) });
        if (r?.acierto) { par.forEach((c) => c.classList.add('is-ok')); mensaje('¡Conexión correcta! El concepto queda guardado.', true); cartas = []; }
        else { mensaje('No forman pareja. Obsérvalas y vuelve a intentarlo.', false); window.setTimeout(() => { par.forEach((c) => { c.classList.remove('is-up'); c.setAttribute('aria-label', 'Carta oculta'); }); cartas = []; }, 900); }
      }
    }
  }, { signal });
}
