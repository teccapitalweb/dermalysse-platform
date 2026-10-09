import { createIcons, icons } from 'lucide';
import { esc } from '../ui/partials';

type Paso = { nombre: string; minutos: number };
type EntradaBitacora = { id: string; fecha: string; clave: string; foco: string; nota: string };

const BITACORA_KEY = 'dermalysse:herramientas:bitacora:v1';

const activos: Record<string, { nombre: string; familia: string }> = {
  niacinamida: { nombre: 'Niacinamida', familia: 'soporte de barrera' },
  vitamina_c: { nombre: 'Vitamina C', familia: 'antioxidantes' },
  retinoides: { nombre: 'Retinoides cosméticos', familia: 'renovación' },
  aha: { nombre: 'AHA', familia: 'exfoliación química' },
  bha: { nombre: 'BHA', familia: 'exfoliación lipofílica' },
  peptidos: { nombre: 'Péptidos', familia: 'acondicionamiento' },
  ceramidas: { nombre: 'Ceramidas', familia: 'lípidos de barrera' },
  acido_hialuronico: { nombre: 'Ácido hialurónico', familia: 'humectantes' },
};

const alternar = new Set(['aha|retinoides', 'bha|retinoides', 'aha|bha', 'retinoides|vitamina_c']);

const pasosIniciales: Paso[] = [
  { nombre: 'Definir objetivo de la práctica', minutos: 3 },
  { nombre: 'Preparación y observación', minutos: 5 },
  { nombre: 'Secuencia educativa principal', minutos: 12 },
  { nombre: 'Registro de conclusiones', minutos: 5 },
];

function opcionesActivos() {
  return Object.entries(activos).map(([valor, activo]) => `<option value="${valor}">${activo.nombre}</option>`).join('');
}

export function herramientas() {
  return `<section class="tools-page">
    <header class="tools-hero">
      <div class="tools-hero__copy">
        <span class="tools-hero__eyebrow"><i data-lucide="wand-sparkles" class="i"></i>Estudio de práctica Dermalysse</span>
        <h1 class="display display--black">Herramientas que convierten teoría en <em>decisiones ordenadas.</em></h1>
        <p>Crea rutas, compara conceptos, organiza tiempos y registra aprendizajes en un espacio privado de práctica educativa.</p>
        <div class="tools-hero__chips" aria-label="Características"><span><i data-lucide="check" class="i"></i>4 utilidades activas</span><span><i data-lucide="hard-drive" class="i"></i>Trabajo local</span><span><i data-lucide="shield-check" class="i"></i>Enfoque educativo</span></div>
      </div>
      <div class="tools-hero__orb" aria-hidden="true">
        <span class="tools-orbit tools-orbit--one"></span>
        <span class="tools-orbit tools-orbit--two"></span>
        <span class="tools-hero__orb-index">D / 04</span>
        <span class="tools-hero__orb-core">
          <span class="tools-hero__orb-mark"><img src="/brand/dermalysse-isotipo.svg" alt=""></span>
          <span class="tools-hero__orb-word"><small>DERMALYSSE</small><strong>Practice Lab</strong></span>
        </span>
        <b>IDEA</b><b>ORDEN</b><b>PRÁCTICA</b>
      </div>
    </header>

    <div class="tools-studio" data-tools-root>
      <aside class="tools-dock" aria-label="Selector de herramientas">
        <div class="tools-dock__head"><span>Tu mesa de trabajo</span><strong>Elige una herramienta</strong></div>
        <button class="tools-dock__item is-active" type="button" data-tool-tab="rutina" aria-pressed="true"><span class="tools-dock__icon tools-dock__icon--wine"><i data-lucide="route" class="i"></i></span><span><strong>Mapa de rutina</strong><small>Ordena una secuencia</small></span><i data-lucide="chevron-right" class="i tools-dock__arrow"></i></button>
        <button class="tools-dock__item" type="button" data-tool-tab="activos" aria-pressed="false"><span class="tools-dock__icon tools-dock__icon--blue"><i data-lucide="test-tubes" class="i"></i></span><span><strong>Mesa de activos</strong><small>Compara dos familias</small></span><i data-lucide="chevron-right" class="i tools-dock__arrow"></i></button>
        <button class="tools-dock__item" type="button" data-tool-tab="protocolo" aria-pressed="false"><span class="tools-dock__icon tools-dock__icon--peach"><i data-lucide="list-plus" class="i"></i></span><span><strong>Canvas de protocolo</strong><small>Pasos y tiempos</small></span><i data-lucide="chevron-right" class="i tools-dock__arrow"></i></button>
        <button class="tools-dock__item" type="button" data-tool-tab="bitacora" aria-pressed="false"><span class="tools-dock__icon tools-dock__icon--sage"><i data-lucide="notebook-pen" class="i"></i></span><span><strong>Bitácora privada</strong><small>Guarda aprendizajes</small></span><i data-lucide="chevron-right" class="i tools-dock__arrow"></i></button>
        <div class="tools-dock__privacy"><i data-lucide="lock-keyhole" class="i"></i><span><strong>Privado en este dispositivo</strong><small>No enviamos estos borradores.</small></span></div>
      </aside>

      <main class="tools-workspace">
        <section class="tool-panel" data-tool-panel="rutina">
          <div class="tool-panel__heading"><div><span class="eyebrow">01 · Mapa de rutina</span><h2 class="display">Construye una secuencia con lógica.</h2><p>Elige contexto y profundidad para obtener un mapa educativo editable.</p></div><span class="tool-panel__badge"><i data-lucide="zap" class="i"></i>Resultado inmediato</span></div>
          <div class="tool-split">
            <form class="tool-form" data-rutina-form>
              <label>Objetivo de estudio<select name="objetivo"><option value="barrera">Confort y barrera</option><option value="hidratacion">Hidratación y humectación</option><option value="textura">Textura y renovación</option><option value="luminosidad">Luminosidad y antioxidantes</option></select></label>
              <label>Momento<select name="momento"><option value="manana">Rutina de mañana</option><option value="noche">Rutina de noche</option></select></label>
              <label>Nivel de detalle<select name="nivel"><option value="esencial">Esencial · 3 pasos</option><option value="completa">Completa · 5 pasos</option></select></label>
              <button class="tools-action" type="submit">Crear mi mapa <span><i data-lucide="arrow-right" class="i"></i></span></button>
              <small class="tool-form__hint"><i data-lucide="info" class="i"></i>Plantilla de estudio; adapta productos y frecuencia a la formación recibida.</small>
            </form>
            <div class="tool-output tool-output--paper" data-rutina-output aria-live="polite"><div class="tool-output__empty"><span><i data-lucide="sparkles" class="i"></i></span><strong>Tu mapa aparecerá aquí</strong><p>Tres elecciones bastan para organizar el orden y la intención de cada paso.</p></div></div>
          </div>
        </section>

        <section class="tool-panel" data-tool-panel="activos" hidden>
          <div class="tool-panel__heading"><div><span class="eyebrow">02 · Mesa de activos</span><h2 class="display">Compara antes de formular una idea.</h2><p>Contrasta dos familias cosméticas y recibe preguntas clave para estudiarlas.</p></div><span class="tool-panel__badge"><i data-lucide="scan-search" class="i"></i>Lectura guiada</span></div>
          <div class="tool-split">
            <form class="tool-form" data-activos-form>
              <label>Primer activo<select name="activoA">${opcionesActivos()}</select></label><div class="tool-form__connector"><span></span><b>+</b><span></span></div>
              <label>Segundo activo<select name="activoB"><option value="ceramidas">Ceramidas</option>${opcionesActivos()}</select></label>
              <button class="tools-action" type="submit">Analizar dupla <span><i data-lucide="git-compare-arrows" class="i"></i></span></button>
            </form>
            <div class="tool-output tool-output--analysis" data-activos-output aria-live="polite"><div class="tool-output__empty"><span><i data-lucide="test-tubes" class="i"></i></span><strong>Selecciona una dupla</strong><p>Verás afinidad conceptual, puntos de revisión y una sugerencia de estudio.</p></div></div>
          </div>
        </section>

        <section class="tool-panel" data-tool-panel="protocolo" hidden>
          <div class="tool-panel__heading"><div><span class="eyebrow">03 · Canvas de protocolo</span><h2 class="display">Diseña el flujo, controla el tiempo.</h2><p>Agrega o elimina pasos de una práctica educativa y calcula la duración total.</p></div><span class="tool-panel__badge"><i data-lucide="timer" class="i"></i><b data-protocolo-total>25</b> min</span></div>
          <div class="tool-split tool-split--protocol">
            <form class="tool-form" data-protocolo-form><label>Nombre del paso<input name="paso" maxlength="70" placeholder="Ej. Registro fotográfico educativo" required></label><label>Duración estimada<div class="tool-form__number"><input name="minutos" type="number" min="1" max="120" value="5" required><span>min</span></div></label><button class="tools-action" type="submit">Agregar al canvas <span><i data-lucide="plus" class="i"></i></span></button><button class="tools-subaction" type="button" data-protocolo-copy><i data-lucide="copy" class="i"></i>Copiar protocolo</button></form>
            <div class="protocol-canvas"><div class="protocol-canvas__head"><span>Secuencia actual</span><small>Usa × para retirar un paso</small></div><ol data-protocolo-list></ol><p class="tools-live" data-tools-live aria-live="polite"></p></div>
          </div>
        </section>

        <section class="tool-panel" data-tool-panel="bitacora" hidden>
          <div class="tool-panel__heading"><div><span class="eyebrow">04 · Bitácora privada</span><h2 class="display">Registra lo que aprendiste.</h2><p>Guarda observaciones educativas sin nombres ni información identificable.</p></div><span class="tool-panel__badge"><i data-lucide="hard-drive" class="i"></i>Solo en tu navegador</span></div>
          <div class="tool-split tool-split--notes">
            <form class="tool-form" data-bitacora-form><label>Clave de práctica<input name="clave" maxlength="28" placeholder="Ej. PRÁCTICA-01" required></label><label>Foco de aprendizaje<select name="foco"><option>Lectura de la piel</option><option>Activos cosméticos</option><option>Diseño de rutina</option><option>Protocolo de práctica</option><option>Seguimiento educativo</option></select></label><label>Conclusión<textarea name="nota" rows="4" maxlength="360" placeholder="Describe qué observaste o qué deseas repasar. No escribas nombres ni datos clínicos." required></textarea></label><button class="tools-action" type="submit">Guardar aprendizaje <span><i data-lucide="save" class="i"></i></span></button></form>
            <div class="notes-board"><div class="notes-board__head"><span>Últimos apuntes</span><small data-bitacora-count>0 guardados</small></div><div class="notes-board__list" data-bitacora-list></div></div>
          </div>
        </section>
      </main>
    </div>

    <section class="praxis-suite" data-praxis-root>
      <header class="praxis-suite__head">
        <div><span class="tools-hero__eyebrow"><i data-lucide="briefcase-business" class="i"></i>Estudio profesional · herramientas de campo</span><h2 class="display">Del conocimiento a una práctica <em>más clara.</em></h2><p>Utilidades creadas para tareas que se repiten en formulación, consulta, comunicación y preparación de cabina.</p></div>
        <div class="praxis-suite__seal"><span>04</span><small>nuevas<br>utilidades</small></div>
      </header>
      <nav class="praxis-tabs" aria-label="Herramientas Praxis">
        <button class="is-active" type="button" data-praxis-tab="formula" aria-pressed="true"><i data-lucide="flask-conical" class="i"></i><span><b>Laboratorio de fórmula</b><small>Porcentajes y lotes</small></span></button>
        <button type="button" data-praxis-tab="consulta" aria-pressed="false"><i data-lucide="messages-square" class="i"></i><span><b>Guía de consulta</b><small>Preguntas inteligentes</small></span></button>
        <button type="button" data-praxis-tab="claims" aria-pressed="false"><i data-lucide="badge-alert" class="i"></i><span><b>Revisor de claims</b><small>Comunicación responsable</small></span></button>
        <button type="button" data-praxis-tab="cabina" aria-pressed="false"><i data-lucide="clipboard-check" class="i"></i><span><b>Checklist de cabina</b><small>Preparación y cierre</small></span></button>
      </nav>

      <div class="praxis-panel" data-praxis-panel="formula">
        <div class="praxis-panel__intro"><span>01 / FORMULA LAB</span><h3 class="display">Escala una fórmula sin perder la proporción.</h3><p>Convierte porcentajes a gramos y verifica que el lote cierre en 100%. Es una calculadora matemática; no valida seguridad, estabilidad ni eficacia.</p><label class="praxis-batch">Tamaño del lote <span><input type="number" min="1" max="100000" value="100" data-formula-batch> gramos</span></label></div>
        <div class="formula-sheet"><div class="formula-sheet__head"><span>Ingrediente o fase</span><span>%</span><span>gramos</span><span></span></div><div data-formula-rows><div class="formula-row"><input value="Base acuosa" maxlength="45" aria-label="Ingrediente 1"><input type="number" value="80" min="0" max="100" step="0.01" aria-label="Porcentaje 1"><output>80 g</output><button type="button" data-formula-remove aria-label="Quitar fila">×</button></div><div class="formula-row"><input value="Fase oleosa" maxlength="45" aria-label="Ingrediente 2"><input type="number" value="15" min="0" max="100" step="0.01" aria-label="Porcentaje 2"><output>15 g</output><button type="button" data-formula-remove aria-label="Quitar fila">×</button></div><div class="formula-row"><input value="Humectante" maxlength="45" aria-label="Ingrediente 3"><input type="number" value="5" min="0" max="100" step="0.01" aria-label="Porcentaje 3"><output>5 g</output><button type="button" data-formula-remove aria-label="Quitar fila">×</button></div></div><div class="formula-sheet__foot"><button type="button" data-formula-add><i data-lucide="plus" class="i"></i>Añadir fila</button><div data-formula-status><span>Total</span><strong>100%</strong><small>Fórmula completa</small></div></div></div>
      </div>

      <div class="praxis-panel" data-praxis-panel="consulta" hidden>
        <div class="praxis-panel__intro"><span>02 / CONSULTA GUIADA</span><h3 class="display">Prepara una conversación que sí escucha.</h3><p>Genera un guion educativo para ordenar la entrevista. No recopila nombres, diagnósticos ni datos personales.</p><form class="praxis-mini-form" data-consulta-form><label>Momento<select name="tipo"><option value="primera">Primera conversación</option><option value="seguimiento">Seguimiento</option></select></label><label>Objetivo principal<select name="objetivo"><option value="rutina">Rutina en casa</option><option value="cabina">Experiencia en cabina</option><option value="producto">Selección de productos</option><option value="habitos">Hábitos y constancia</option></select></label><button class="tools-action" type="submit">Crear guion <span><i data-lucide="arrow-right" class="i"></i></span></button></form></div>
        <div class="praxis-result" data-consulta-output><div class="tool-output__empty"><span><i data-lucide="message-circle-question" class="i"></i></span><strong>Una consulta con intención</strong><p>Elige dos opciones para preparar preguntas abiertas y un cierre claro.</p></div></div>
      </div>

      <div class="praxis-panel" data-praxis-panel="claims" hidden>
        <div class="praxis-panel__intro"><span>03 / CLAIMS CHECK</span><h3 class="display">Revisa antes de publicar.</h3><p>Detecta expresiones que pueden sonar absolutas, médicas o difíciles de respaldar. Es una alerta editorial, no asesoría legal.</p><form class="praxis-mini-form" data-claims-form><label>Texto a revisar<textarea name="claim" rows="6" maxlength="600" placeholder="Ej. Nuestro sérum elimina definitivamente las manchas..." required></textarea></label><button class="tools-action" type="submit">Revisar texto <span><i data-lucide="scan-text" class="i"></i></span></button></form></div>
        <div class="praxis-result" data-claims-output><div class="tool-output__empty"><span><i data-lucide="badge-alert" class="i"></i></span><strong>Comunica con más criterio</strong><p>La revisión marcará absolutos, lenguaje terapéutico y promesas sin contexto.</p></div></div>
      </div>

      <div class="praxis-panel" data-praxis-panel="cabina" hidden>
        <div class="praxis-panel__intro"><span>04 / ROOM READY</span><h3 class="display">Prepara, realiza, cierra.</h3><p>Un checklist general de organización. Debe complementarse con el protocolo validado de cada procedimiento y la normativa aplicable.</p><div class="cabina-progress"><span><b data-cabina-percent>0%</b><small>completado</small></span><div><i data-cabina-bar></i></div></div></div>
        <div class="cabina-checklist" data-cabina-list><label><input type="checkbox"><span><b>Superficies y equipo listos</b><small>Área despejada y preparada según el protocolo del establecimiento.</small></span></label><label><input type="checkbox"><span><b>Materiales verificados</b><small>Productos, consumibles y fechas revisados antes de comenzar.</small></span></label><label><input type="checkbox"><span><b>Objetivo de la sesión confirmado</b><small>Expectativas y alcance explicados con claridad.</small></span></label><label><input type="checkbox"><span><b>Indicaciones previas revisadas</b><small>Usar únicamente la lista validada para la práctica correspondiente.</small></span></label><label><input type="checkbox"><span><b>Registro educativo preparado</b><small>Sin capturar información sensible en esta herramienta.</small></span></label><label><input type="checkbox"><span><b>Cierre y próximos pasos</b><small>Explicar cuidados y seguimiento aprobados para la práctica.</small></span></label><button type="button" data-cabina-reset><i data-lucide="rotate-ccw" class="i"></i>Reiniciar checklist</button></div>
      </div>
    </section>

    <section class="praxia-offer">
      <div class="praxia-offer__copy">
        <span class="praxia-offer__brand"><i data-lucide="stethoscope" class="i"></i>Praxia Medical · software de TEC Capital</span>
        <h2 class="display display--black">Tu consultorio, <em>en orden.</em></h2>
        <p>Expediente, documentos profesionales, agenda, recordatorios y reportes reunidos en una plataforma creada para la operación diaria de tu práctica.</p>
        <ul><li><i data-lucide="file-check-2" class="i"></i>Documentos emitidos con folio</li><li><i data-lucide="calendar-check-2" class="i"></i>Agenda y seguimiento de citas</li><li><i data-lucide="bell-ring" class="i"></i>Recordatorios y reportes</li></ul>
        <div class="praxia-offer__actions"><a class="btn btn--white btn--lg btn--pill-arrow" href="#/praxia">Conocer Praxia <span class="arrow"><i data-lucide="arrow-right" class="i"></i></span></a><small>Beneficio sujeto a confirmación por el equipo.</small></div>
      </div>
      <div class="praxia-offer__visual"><span>SOFTWARE PARA CONSULTORIOS</span><img src="/praxia/captura-1.webp" alt="Panel de documentos de Praxia Medical"></div>
    </section>

    <div class="tools-footnote"><i data-lucide="shield-check" class="i"></i><div><strong>Espacio educativo, no diagnóstico</strong><span>Estas utilidades ayudan a estudiar y organizar ideas. No sustituyen valoración, diagnóstico, indicaciones profesionales ni la revisión de la formulación específica de cada producto.</span></div></div>
  </section>`;
}

function mapaRutina(objetivo: string, momento: string, nivel: string) {
  const enfoque: Record<string, { titulo: string; paso: string; nota: string }> = {
    barrera: { titulo: 'Confort y barrera', paso: 'Soporte de barrera', nota: 'Prioriza fórmulas simples y registra la respuesta percibida.' },
    hidratacion: { titulo: 'Hidratación y humectación', paso: 'Capa humectante', nota: 'Observa la relación entre humectación, emoliencia y oclusión.' },
    textura: { titulo: 'Textura y renovación', paso: 'Paso de renovación', nota: 'Revisa tolerancia, frecuencia y formulación antes de combinar.' },
    luminosidad: { titulo: 'Luminosidad y antioxidantes', paso: 'Soporte antioxidante', nota: 'Estudia estabilidad, envase y momento de aplicación.' },
  };
  const elegido = enfoque[objetivo] || enfoque.barrera;
  const pasos = nivel === 'completa'
    ? ['Limpieza respetuosa', elegido.paso, 'Capa complementaria opcional', 'Hidratación de cierre', momento === 'manana' ? 'Fotoprotección' : 'Registro de tolerancia']
    : ['Limpieza respetuosa', elegido.paso, momento === 'manana' ? 'Hidratación + fotoprotección' : 'Hidratación de cierre'];
  return { ...elegido, pasos };
}

function leerBitacora(): EntradaBitacora[] {
  try {
    const valor: unknown = JSON.parse(localStorage.getItem(BITACORA_KEY) || '[]');
    if (!Array.isArray(valor)) return [];
    return valor.filter((item): item is EntradaBitacora => !!item && typeof item === 'object' && typeof (item as EntradaBitacora).id === 'string').slice(0, 8);
  } catch { return []; }
}

function guardarBitacora(entradas: EntradaBitacora[]) {
  try { localStorage.setItem(BITACORA_KEY, JSON.stringify(entradas.slice(0, 8))); } catch { /* La página sigue operativa sin almacenamiento. */ }
}

async function copiar(texto: string) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { return false; }
}

export function montarHerramientas() {
  const root = document.querySelector<HTMLElement>('[data-tools-root]');
  if (!root) return;

  root.querySelectorAll<HTMLButtonElement>('[data-tool-tab]').forEach((boton) => boton.addEventListener('click', () => {
    const id = boton.dataset.toolTab;
    root.querySelectorAll<HTMLButtonElement>('[data-tool-tab]').forEach((item) => { const activo = item === boton; item.classList.toggle('is-active', activo); item.setAttribute('aria-pressed', String(activo)); });
    root.querySelectorAll<HTMLElement>('[data-tool-panel]').forEach((panel) => { panel.hidden = panel.dataset.toolPanel !== id; });
  }));

  root.querySelector<HTMLFormElement>('[data-rutina-form]')?.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const formulario = evento.currentTarget as HTMLFormElement;
    const form = new FormData(formulario);
    const momento = String(form.get('momento') || 'manana');
    const resultado = mapaRutina(String(form.get('objetivo') || 'barrera'), momento, String(form.get('nivel') || 'esencial'));
    const salida = root.querySelector<HTMLElement>('[data-rutina-output]');
    if (!salida) return;
    salida.innerHTML = `<div class="tool-result__head"><span>Mapa listo</span><b>${esc(resultado.titulo)}</b></div><ol class="routine-map">${resultado.pasos.map((paso, indice) => `<li><span>${String(indice + 1).padStart(2, '0')}</span><div><strong>${esc(paso)}</strong><small>${indice === 0 ? 'Prepara sin sobrecargar.' : indice === resultado.pasos.length - 1 ? 'Cierra y documenta.' : 'Aplica con intención y observa.'}</small></div></li>`).join('')}</ol><div class="tool-result__note"><i data-lucide="book-open-check" class="i"></i><p><strong>Pregunta de estudio</strong>${esc(resultado.nota)}</p></div>`;
    createIcons({ icons });
  });

  root.querySelector<HTMLFormElement>('[data-activos-form]')?.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const formulario = evento.currentTarget as HTMLFormElement;
    const form = new FormData(formulario);
    const a = String(form.get('activoA') || 'niacinamida');
    const b = String(form.get('activoB') || 'ceramidas');
    const salida = root.querySelector<HTMLElement>('[data-activos-output]');
    if (!salida) return;
    const activoA = activos[a] || activos.niacinamida;
    const activoB = activos[b] || activos.ceramidas;
    const mismo = a === b;
    const separar = alternar.has([a, b].sort().join('|'));
    const estado = mismo ? 'Comparación repetida' : separar ? 'Conviene estudiar por separado' : 'Dupla de estudio flexible';
    const clase = mismo ? 'is-neutral' : separar ? 'is-caution' : 'is-compatible';
    const detalle = mismo ? 'Elegiste la misma familia. Compara concentraciones, vehículo, pH y forma cosmética en lugar de duplicarla.' : separar ? 'La combinación puede elevar complejidad o demanda de tolerancia. Para aprenderla, estudia primero cada activo por separado y revisa la formulación concreta.' : 'No aparece una fricción general en esta guía conceptual. Aun así, la compatibilidad real depende de fórmula, concentración, pH, frecuencia y tolerancia.';
    salida.innerHTML = `<div class="compat-result ${clase}"><span class="compat-result__signal"></span><div><small>Lectura educativa</small><h3>${esc(estado)}</h3></div></div><div class="compat-pair"><span><b>${esc(activoA.nombre)}</b><small>${esc(activoA.familia)}</small></span><i data-lucide="plus" class="i"></i><span><b>${esc(activoB.nombre)}</b><small>${esc(activoB.familia)}</small></span></div><p class="compat-detail">${esc(detalle)}</p><div class="compat-questions"><strong>Antes de decidir, revisa</strong><span>01 · ¿Qué indica la fórmula completa?</span><span>02 · ¿Cuál es la frecuencia y tolerancia?</span><span>03 · ¿Se requiere fotoprotección reforzada?</span></div>`;
    createIcons({ icons });
  });

  let pasos = pasosIniciales.map((paso) => ({ ...paso }));
  const listaPasos = root.querySelector<HTMLOListElement>('[data-protocolo-list]');
  const totalPasos = root.querySelector<HTMLElement>('[data-protocolo-total]');
  const live = root.querySelector<HTMLElement>('[data-tools-live]');
  const renderPasos = () => {
    if (!listaPasos || !totalPasos) return;
    totalPasos.textContent = String(pasos.reduce((total, paso) => total + paso.minutos, 0));
    listaPasos.innerHTML = pasos.length ? pasos.map((paso, indice) => `<li><span class="protocol-step__number">${String(indice + 1).padStart(2, '0')}</span><div><strong>${esc(paso.nombre)}</strong><small>${paso.minutos} min</small></div><button type="button" data-paso-remove="${indice}" aria-label="Quitar ${esc(paso.nombre)}">×</button></li>`).join('') : '<li class="protocol-empty">Agrega un paso para comenzar tu canvas.</li>';
  };
  renderPasos();
  root.querySelector<HTMLFormElement>('[data-protocolo-form]')?.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const formulario = evento.currentTarget as HTMLFormElement;
    const data = new FormData(formulario);
    const nombre = String(data.get('paso') || '').trim();
    const minutos = Math.min(120, Math.max(1, Number(data.get('minutos')) || 1));
    if (!nombre) return;
    pasos.push({ nombre, minutos }); formulario.reset();
    const minutosInput = formulario.elements.namedItem('minutos') as HTMLInputElement | null;
    if (minutosInput) minutosInput.value = '5';
    renderPasos();
    if (live) live.textContent = `“${nombre}” se agregó al canvas.`;
  });
  listaPasos?.addEventListener('click', (evento) => {
    const boton = (evento.target as HTMLElement).closest<HTMLButtonElement>('[data-paso-remove]');
    if (!boton) return;
    pasos.splice(Number(boton.dataset.pasoRemove), 1); renderPasos();
    if (live) live.textContent = 'Paso retirado del canvas.';
  });
  root.querySelector<HTMLButtonElement>('[data-protocolo-copy]')?.addEventListener('click', async (evento) => {
    const texto = `Protocolo educativo Dermalysse\n${pasos.map((paso, indice) => `${indice + 1}. ${paso.nombre} — ${paso.minutos} min`).join('\n')}\nTotal: ${pasos.reduce((total, paso) => total + paso.minutos, 0)} min`;
    const ok = await copiar(texto);
    if (live) live.textContent = ok ? 'Protocolo copiado al portapapeles.' : 'No fue posible copiar automáticamente.';
    (evento.currentTarget as HTMLButtonElement).classList.toggle('is-done', ok);
  });

  let entradas = leerBitacora();
  const listaEntradas = root.querySelector<HTMLElement>('[data-bitacora-list]');
  const contador = root.querySelector<HTMLElement>('[data-bitacora-count]');
  const renderEntradas = () => {
    if (!listaEntradas || !contador) return;
    contador.textContent = `${entradas.length} ${entradas.length === 1 ? 'guardado' : 'guardados'}`;
    listaEntradas.innerHTML = entradas.length ? entradas.map((entrada) => `<article class="note-entry"><div class="note-entry__meta"><span>${esc(entrada.fecha)}</span><button type="button" data-note-remove="${esc(entrada.id)}" aria-label="Eliminar ${esc(entrada.clave)}">Eliminar</button></div><strong>${esc(entrada.clave)}</strong><small>${esc(entrada.foco)}</small><p>${esc(entrada.nota)}</p></article>`).join('') : '<div class="notes-empty"><span><i data-lucide="notebook" class="i"></i></span><strong>Aún no hay apuntes</strong><p>Tu primer aprendizaje guardado aparecerá aquí.</p></div>';
    createIcons({ icons });
  };
  renderEntradas();
  root.querySelector<HTMLFormElement>('[data-bitacora-form]')?.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const formulario = evento.currentTarget as HTMLFormElement;
    const data = new FormData(formulario);
    const clave = String(data.get('clave') || '').trim();
    const nota = String(data.get('nota') || '').trim();
    if (!clave || !nota) return;
    entradas = [{ id: `${Date.now()}`, fecha: new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()), clave, foco: String(data.get('foco') || ''), nota }, ...entradas].slice(0, 8);
    guardarBitacora(entradas); formulario.reset(); renderEntradas();
  });
  listaEntradas?.addEventListener('click', (evento) => {
    const boton = (evento.target as HTMLElement).closest<HTMLButtonElement>('[data-note-remove]');
    if (!boton) return;
    entradas = entradas.filter((entrada) => entrada.id !== boton.dataset.noteRemove);
    guardarBitacora(entradas); renderEntradas();
  });

  const praxis = document.querySelector<HTMLElement>('[data-praxis-root]');
  if (!praxis) return;
  praxis.querySelectorAll<HTMLButtonElement>('[data-praxis-tab]').forEach((boton) => boton.addEventListener('click', () => {
    const id = boton.dataset.praxisTab;
    praxis.querySelectorAll<HTMLButtonElement>('[data-praxis-tab]').forEach((item) => { const activo = item === boton; item.classList.toggle('is-active', activo); item.setAttribute('aria-pressed', String(activo)); });
    praxis.querySelectorAll<HTMLElement>('[data-praxis-panel]').forEach((panel) => { panel.hidden = panel.dataset.praxisPanel !== id; });
  }));

  const filasFormula = praxis.querySelector<HTMLElement>('[data-formula-rows]');
  const loteFormula = praxis.querySelector<HTMLInputElement>('[data-formula-batch]');
  const estadoFormula = praxis.querySelector<HTMLElement>('[data-formula-status]');
  const calcularFormula = () => {
    if (!filasFormula || !loteFormula || !estadoFormula) return;
    const lote = Math.max(0, Number(loteFormula.value) || 0);
    let total = 0;
    filasFormula.querySelectorAll<HTMLElement>('.formula-row').forEach((fila) => {
      const porcentaje = Math.max(0, Number(fila.querySelectorAll<HTMLInputElement>('input')[1]?.value) || 0);
      total += porcentaje;
      const salida = fila.querySelector<HTMLOutputElement>('output');
      if (salida) salida.textContent = `${((porcentaje / 100) * lote).toLocaleString('es-MX', { maximumFractionDigits: 2 })} g`;
    });
    const diferencia = 100 - total;
    estadoFormula.classList.toggle('is-ok', Math.abs(diferencia) < .001);
    estadoFormula.classList.toggle('is-warning', Math.abs(diferencia) >= .001);
    estadoFormula.innerHTML = `<span>Total</span><strong>${total.toLocaleString('es-MX', { maximumFractionDigits: 2 })}%</strong><small>${Math.abs(diferencia) < .001 ? 'Fórmula completa' : diferencia > 0 ? `Falta ${diferencia.toLocaleString('es-MX', { maximumFractionDigits: 2 })}%` : `Excede ${Math.abs(diferencia).toLocaleString('es-MX', { maximumFractionDigits: 2 })}%`}</small>`;
  };
  calcularFormula();
  loteFormula?.addEventListener('input', calcularFormula);
  filasFormula?.addEventListener('input', calcularFormula);
  praxis.querySelector<HTMLButtonElement>('[data-formula-add]')?.addEventListener('click', () => {
    if (!filasFormula || filasFormula.children.length >= 12) return;
    const numero = filasFormula.children.length + 1;
    filasFormula.insertAdjacentHTML('beforeend', `<div class="formula-row"><input value="Nuevo ingrediente" maxlength="45" aria-label="Ingrediente ${numero}"><input type="number" value="0" min="0" max="100" step="0.01" aria-label="Porcentaje ${numero}"><output>0 g</output><button type="button" data-formula-remove aria-label="Quitar fila">×</button></div>`);
    calcularFormula();
  });
  filasFormula?.addEventListener('click', (evento) => {
    const boton = (evento.target as HTMLElement).closest<HTMLButtonElement>('[data-formula-remove]');
    if (!boton || !filasFormula || filasFormula.children.length <= 1) return;
    boton.closest('.formula-row')?.remove();
    calcularFormula();
  });

  const preguntasBase = [
    '¿Qué te gustaría comprender o mejorar de tu experiencia actual?',
    '¿Qué has probado antes y cómo lo integraste en tu rutina?',
    '¿Qué nivel de tiempo y constancia es realista para ti?',
  ];
  const preguntasObjetivo: Record<string, string[]> = {
    rutina: ['¿Cuántos pasos utilizas por la mañana y por la noche?', '¿Qué parte de tu rutina te cuesta sostener?'],
    cabina: ['¿Qué esperas sentir o aprender durante esta experiencia?', '¿Qué indicaciones previas ya recibiste?'],
    producto: ['¿Qué productos utilizas hoy y con qué frecuencia?', '¿Prefieres una rutina esencial o una experiencia más completa?'],
    habitos: ['¿Qué momento del día facilita más tu constancia?', '¿Qué obstáculo suele interrumpir tus hábitos?'],
  };
  praxis.querySelector<HTMLFormElement>('[data-consulta-form]')?.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const data = new FormData(evento.currentTarget as HTMLFormElement);
    const tipo = String(data.get('tipo') || 'primera');
    const objetivo = String(data.get('objetivo') || 'rutina');
    const preguntas = [...preguntasBase, ...(preguntasObjetivo[objetivo] || preguntasObjetivo.rutina)];
    if (tipo === 'seguimiento') preguntas.unshift('Desde la última conversación, ¿qué cambio notaste y qué permaneció igual?');
    const salida = praxis.querySelector<HTMLElement>('[data-consulta-output]');
    if (!salida) return;
    salida.innerHTML = `<div class="praxis-result__top"><span>Guion listo</span><strong>${tipo === 'seguimiento' ? 'Seguimiento' : 'Primera conversación'} · ${preguntas.length} preguntas</strong></div><ol class="consult-script">${preguntas.map((pregunta, indice) => `<li><span>${String(indice + 1).padStart(2, '0')}</span><p>${esc(pregunta)}</p></li>`).join('')}</ol><div class="consult-close"><i data-lucide="flag" class="i"></i><p><strong>Cierre recomendado</strong>Resume lo escuchado, confirma expectativas y explica el siguiente paso sin prometer resultados.</p></div>`;
    createIcons({ icons });
  });

  const alertasClaims = [
    { patron: /\b(cura|curar|tratamiento médico|diagnostica|prescribe)\b/i, titulo: 'Lenguaje terapéutico', texto: 'Puede presentar el producto o servicio como intervención médica.' },
    { patron: /\b(elimina|borra|desaparece|definitiv[oa]s?|permanente)\b/i, titulo: 'Promesa absoluta', texto: 'Conviene describir apariencia, apoyo o experiencia sin garantizar eliminación.' },
    { patron: /(100\s*%|garantizad[oa]s?|sin riesgo|resultados inmediatos)/i, titulo: 'Garantía difícil de sustentar', texto: 'Añade contexto, condiciones y evidencia verificable antes de publicarlo.' },
    { patron: /\b(rejuvenece \d+ años|milagro|revolucionario|único en el mundo)\b/i, titulo: 'Superlativo sin respaldo', texto: 'Reformula con beneficios observables y una fuente concreta.' },
  ];
  praxis.querySelector<HTMLFormElement>('[data-claims-form]')?.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const texto = String(new FormData(evento.currentTarget as HTMLFormElement).get('claim') || '').trim();
    const hallazgos = alertasClaims.filter((alerta) => alerta.patron.test(texto));
    const salida = praxis.querySelector<HTMLElement>('[data-claims-output]');
    if (!salida) return;
    salida.innerHTML = hallazgos.length
      ? `<div class="claims-score is-review"><span><i data-lucide="triangle-alert" class="i"></i></span><div><small>Revisión recomendada</small><strong>${hallazgos.length} ${hallazgos.length === 1 ? 'alerta encontrada' : 'alertas encontradas'}</strong></div></div><div class="claims-list">${hallazgos.map((hallazgo) => `<article><b>${esc(hallazgo.titulo)}</b><p>${esc(hallazgo.texto)}</p></article>`).join('')}</div><p class="claims-foot">Verifica siempre el contexto, la evidencia y las obligaciones regulatorias aplicables.</p>`
      : '<div class="claims-score is-clear"><span><i data-lucide="circle-check" class="i"></i></span><div><small>Lectura editorial</small><strong>No detectamos absolutos evidentes</strong></div></div><div class="claims-clear"><p>Antes de publicar, confirma que cada beneficio tenga respaldo y que el texto no sugiera diagnóstico, curación ni resultados garantizados.</p><span><i data-lucide="check" class="i"></i>Beneficio específico</span><span><i data-lucide="check" class="i"></i>Evidencia disponible</span><span><i data-lucide="check" class="i"></i>Alcance y condiciones claros</span></div>';
    createIcons({ icons });
  });

  const listaCabina = praxis.querySelector<HTMLElement>('[data-cabina-list]');
  const porcentajeCabina = praxis.querySelector<HTMLElement>('[data-cabina-percent]');
  const barraCabina = praxis.querySelector<HTMLElement>('[data-cabina-bar]');
  const actualizarCabina = () => {
    if (!listaCabina || !porcentajeCabina || !barraCabina) return;
    const checks = [...listaCabina.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    const porcentaje = checks.length ? Math.round((checks.filter((check) => check.checked).length / checks.length) * 100) : 0;
    porcentajeCabina.textContent = `${porcentaje}%`;
    barraCabina.style.width = `${porcentaje}%`;
  };
  listaCabina?.addEventListener('change', actualizarCabina);
  praxis.querySelector<HTMLButtonElement>('[data-cabina-reset]')?.addEventListener('click', () => {
    listaCabina?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((check) => { check.checked = false; });
    actualizarCabina();
  });
}
