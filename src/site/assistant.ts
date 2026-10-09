import type { LandingContent } from './types';

type Role = 'assistant' | 'user';
interface Message { role: Role; text: string; options?: string[]; action?: { label: string; href: string } }
type Pose = 'presenta' | 'saluda' | 'piensa' | 'explica' | 'celebra';
type CharacterVariant = 'launcher' | 'header';

const STORAGE_KEY = 'dermalysse:landing-assistant:v1';
const INITIAL_OPTIONS = ['Quiero elegir un curso', '¿Qué incluye el club?', 'Conocer Praxia', 'Ver una clase abierta'];
const POSE_ASSETS: Record<Pose, string> = {
  presenta: '/media/lia/lia-presenta-v2.png',
  saluda: '/media/lia/lia-saluda-v2.png',
  piensa: '/media/lia/lia-piensa-v2.png',
  explica: '/media/lia/lia-explica-v2.png',
  celebra: '/media/lia/lia-celebra-v2.png',
};
const esc = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const normalize = (value: string): string => value.toLocaleLowerCase('es-MX').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const includesAny = (text: string, words: string[]): boolean => words.some((word) => text.includes(word));

const welcome = (): Message => ({
  role: 'assistant',
  text: 'Hola, soy Lía, la guía virtual de Dermalysse. Puedo ayudarte a elegir una ruta de aprendizaje, conocer el club o ubicar una herramienta.',
  options: INITIAL_OPTIONS,
});

const characterMarkup = (variant: CharacterVariant): string => `
  <span class="dai-character dai-character--${variant}" data-dai-character data-pose="presenta" aria-hidden="true">
    <span class="dai-character__glow"></span>
    <span class="dai-character__orbit dai-character__orbit--outer"></span>
    <span class="dai-character__orbit dai-character__orbit--inner"></span>
    <span class="dai-character__spark dai-character__spark--one"></span>
    <span class="dai-character__spark dai-character__spark--two"></span>
    <span class="dai-character__spark dai-character__spark--three"></span>
    <span class="dai-character__portrait">
      <img class="is-active" data-dai-pose-layer src="${POSE_ASSETS.presenta}" alt="" width="1024" height="1536">
      <img data-dai-pose-layer alt="" width="1024" height="1536">
    </span>
  </span>`;

function answer(question: string, content: LandingContent): Message {
  const text = normalize(question);
  const course = (title: string) => content.courses.find((item) => normalize(item.title).includes(normalize(title)))?.title || title;

  if (includesAny(text, ['hola', 'buen dia', 'buenas', 'hey', 'ola'])) return welcome();
  if (includesAny(text, ['diagnost', 'receta', 'medicamento', 'enfermedad', 'curar', 'tratamiento medico', 'tengo acne', 'que tengo'])) {
    return { role: 'assistant', text: 'Puedo orientarte sobre el contenido educativo de Dermalysse, pero no diagnostico, prescribo ni sustituyo una valoración profesional. Si existe una preocupación de salud, lo adecuado es consultar a una persona profesional autorizada.', options: ['Quiero elegir un curso', '¿Qué incluye el club?'] };
  }
  if (includesAny(text, ['praxia', 'software', 'consultorio', 'agenda', 'paciente', 'expediente'])) {
    return { role: 'assistant', text: 'Praxia Medical es el software de TEC Capital para organizar la operación del consultorio: pacientes, documentos, agenda, recordatorios y reportes. El acceso o beneficio para miembros se confirma por separado con el equipo.', action: { label: 'Conocer Praxia', href: '/club/#/praxia' }, options: ['¿Qué incluye el club?', 'Quiero elegir un curso'] };
  }
  if (includesAny(text, ['precio', 'cuanto', 'costo', 'promocion', 'descuento', 'pagar', 'plan'])) {
    return { role: 'assistant', text: 'Los precios, planes y promociones deben consultarse en el acceso oficial del club para ver información vigente. Desde aquí no invento importes ni condiciones.', action: { label: 'Revisar acceso al club', href: '/club/#/login?vista=1' }, options: ['¿Qué incluye el club?', 'Ver una clase abierta'] };
  }
  if (includesAny(text, ['certificado', 'constancia', 'diploma', 'logro'])) {
    return { role: 'assistant', text: 'El club organiza progreso, logros y certificados dentro del perfil. La disponibilidad de cada certificado depende de los requisitos definidos para el curso correspondiente.', action: { label: 'Entrar al club', href: '/club/' }, options: ['¿Qué incluye el club?', 'Quiero elegir un curso'] };
  }
  if (includesAny(text, ['clase abierta', 'gratis', 'probar', 'muestra', 'introduccion'])) {
    return { role: 'assistant', text: 'Puedes abrir una clase introductoria desde esta landing para conocer el enfoque educativo antes de entrar al club.', action: { label: 'Ver clase abierta', href: '#formacion' }, options: ['Quiero elegir un curso', '¿Qué incluye el club?'] };
  }
  if (includesAny(text, ['incluye', 'membresia', 'membresía', 'club', 'beneficio', 'herramienta', 'material'])) {
    return { role: 'assistant', text: 'El Club Dermalysse reúne cursos a tu ritmo, primera clase abierta, biblioteca educativa, encuentros en vivo, herramientas de práctica, retos, progreso y certificados. Praxia se presenta como software complementario de TEC Capital y requiere confirmación separada.', action: { label: 'Explorar el club', href: '#club' }, options: ['Quiero elegir un curso', 'Conocer Praxia', 'Ver una clase abierta'] };
  }
  if (includesAny(text, ['cicatriz', 'acne', 'reparacion', 'dermapen'])) {
    return { role: 'assistant', text: `Por tu interés, comenzaría por “${course('Piel sin cicatrices')}”. Su enfoque combina Dermapen, acné y reparación desde una perspectiva educativa.`, action: { label: 'Ver formación', href: '#formacion' }, options: ['Manchas y activos', 'Protocolos de cabina', 'Cosmética natural'] };
  }
  if (includesAny(text, ['mancha', 'pigment', 'discrom', 'activo'])) {
    return { role: 'assistant', text: `La ruta más cercana es “${course('Manchas y discromías')}”: valoración, activos y seguimiento organizados para aprender con mayor criterio.`, action: { label: 'Ver formación', href: '#formacion' }, options: ['Piel y cicatrices', 'Protocolos de cabina', 'Cosmética natural'] };
  }
  if (includesAny(text, ['hidra', 'cabina', 'protocolo', 'facial'])) {
    return { role: 'assistant', text: `Te conviene explorar “${course('Hidrafacial esencial')}”, enfocado en protocolos, cabina y técnica.`, action: { label: 'Ver formación', href: '#formacion' }, options: ['Piel y cicatrices', 'Manchas y activos', 'Cosmética natural'] };
  }
  if (includesAny(text, ['cosmetica', 'natural', 'formula', 'formulacion', 'ingrediente'])) {
    return { role: 'assistant', text: `Tu mejor punto de partida es “${course('Cosmética natural')}”, con una introducción a formulación, piel y bienestar.`, action: { label: 'Ver formación', href: '#formacion' }, options: ['Piel y cicatrices', 'Manchas y activos', 'Protocolos de cabina'] };
  }
  if (includesAny(text, ['elegir', 'curso', 'recomienda', 'aprender', 'estudiar', 'ruta'])) {
    return { role: 'assistant', text: 'Para recomendarte mejor, dime qué te interesa fortalecer primero. Puedo orientarte entre piel y cicatrices, manchas y activos, protocolos de cabina o formulación cosmética.', options: ['Piel y cicatrices', 'Manchas y activos', 'Protocolos de cabina', 'Cosmética natural'] };
  }
  if (includesAny(text, ['gracias', 'perfecto', 'listo'])) return { role: 'assistant', text: 'Con gusto. Si quieres, puedo ayudarte a elegir el siguiente paso sin hacerte recorrer toda la página.', options: INITIAL_OPTIONS };
  return { role: 'assistant', text: 'Puedo ayudarte con cursos, membresía, clase abierta, certificados, herramientas o Praxia. Cuéntame cuál de esos temas buscas y te llevo al punto correcto.', options: INITIAL_OPTIONS };
}

function loadMessages(): Message[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [welcome()];
    const valid = parsed.filter((item): item is Message => !!item && typeof item === 'object' && ['assistant', 'user'].includes((item as Message).role) && typeof (item as Message).text === 'string').slice(-14);
    return valid.length ? valid : [welcome()];
  } catch { return [welcome()]; }
}

export function mountAssistant(content: LandingContent): void {
  const root = document.createElement('div');
  root.id = 'dermalysse-assistant';
  root.innerHTML = `
    <button class="dai-launcher" type="button" aria-label="Abrir a Lía, guía virtual" aria-expanded="false" aria-controls="dai-panel">
      ${characterMarkup('launcher')}
      <span class="dai-launcher__copy"><small><i></i>Guía virtual</small><strong>¿Te ayudo a elegir?</strong><em>Cursos · Club · Praxia <b>↗</b></em></span>
    </button>
    <div class="dai-backdrop" hidden></div>
    <section class="dai-panel" id="dai-panel" role="dialog" aria-modal="true" aria-label="Conversación con Lía, guía virtual de Dermalysse" hidden>
      <header class="dai-header">
        ${characterMarkup('header')}
        <div><small>DERMALYSSE · GUÍA VIRTUAL</small><strong>Lía</strong><span><i></i>Disponible ahora</span></div>
        <button type="button" data-dai-close aria-label="Cerrar asistente">×</button>
      </header>
      <p class="dai-disclosure">Respuestas guiadas con información de esta experiencia. No sustituye asesoría humana ni valoración clínica.</p>
      <div class="dai-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
      <form class="dai-composer"><label><span class="dai-sr-only">Escribe tu pregunta</span><input name="question" placeholder="¿Qué te gustaría aprender?" maxlength="300" autocomplete="off" required></label><button type="submit" aria-label="Enviar pregunta">↑</button></form>
      <footer><button type="button" data-dai-reset>Empezar de nuevo</button><a href="/club/">Entrar al club</a></footer>
    </section>`;
  document.body.appendChild(root);

  const launcher = root.querySelector<HTMLButtonElement>('.dai-launcher')!;
  const backdrop = root.querySelector<HTMLElement>('.dai-backdrop')!;
  const panel = root.querySelector<HTMLElement>('.dai-panel')!;
  const log = root.querySelector<HTMLElement>('.dai-messages')!;
  const form = root.querySelector<HTMLFormElement>('.dai-composer')!;
  const input = form.elements.namedItem('question') as HTMLInputElement;
  let messages = loadMessages();
  let typingTimer: number | undefined;
  let poseTimer: number | undefined;
  let currentPose: Pose = 'presenta';

  const transitionCharacter = (character: HTMLElement, pose: Pose): void => {
    if (character.dataset.pose === pose) return;
    const layers = Array.from(character.querySelectorAll<HTMLImageElement>('[data-dai-pose-layer]'));
    const active = layers.find((layer) => layer.classList.contains('is-active'));
    const incoming = layers.find((layer) => !layer.classList.contains('is-active'));
    if (!active || !incoming) return;
    let revealed = false;
    const reveal = (): void => {
      if (revealed) return;
      revealed = true;
      incoming.classList.add('is-active');
      active.classList.remove('is-active');
      character.dataset.pose = pose;
      window.setTimeout(() => {
        if (!active.classList.contains('is-active')) active.removeAttribute('src');
      }, 460);
    };
    incoming.onload = reveal;
    incoming.src = POSE_ASSETS[pose];
    if (incoming.complete) reveal();
  };
  const setPose = (pose: Pose, returnToIdle = false): void => {
    window.clearTimeout(poseTimer);
    currentPose = pose;
    root.dataset.pose = pose;
    root.querySelectorAll<HTMLElement>('[data-dai-character]').forEach((character) => transitionCharacter(character, pose));
    if (returnToIdle && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      poseTimer = window.setTimeout(() => setPose('presenta'), 3200);
    }
  };

  const save = (): void => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-14))); } catch { /* El asistente funciona aun sin almacenamiento. */ }
  };
  const render = (): void => {
    log.innerHTML = messages.map((message, index) => `<article class="dai-message dai-message--${message.role}"><small>${message.role === 'assistant' ? 'LÍA · GUÍA VIRTUAL' : 'TÚ'}</small><p>${esc(message.text)}</p>${message.action ? `<a href="${esc(message.action.href)}">${esc(message.action.label)} <span>→</span></a>` : ''}${message.options?.length && index === messages.length - 1 ? `<div>${message.options.map((option) => `<button type="button" data-dai-option="${esc(option)}">${esc(option)}</button>`).join('')}</div>` : ''}</article>`).join('');
    log.scrollTop = log.scrollHeight;
  };
  const open = (): void => {
    launcher.hidden = true; panel.hidden = false; backdrop.hidden = false;
    launcher.setAttribute('aria-expanded', 'true'); document.body.classList.add('dai-open');
    setPose('saluda', true); render(); window.setTimeout(() => input.focus({ preventScroll: true }), 60);
  };
  const close = (): void => {
    window.clearTimeout(typingTimer); panel.hidden = true; backdrop.hidden = true; launcher.hidden = false;
    launcher.setAttribute('aria-expanded', 'false'); document.body.classList.remove('dai-open'); setPose('presenta'); launcher.focus({ preventScroll: true });
  };
  const ask = (question: string): void => {
    const clean = question.trim(); if (!clean) return;
    const userMessage: Message = { role: 'user', text: clean };
    messages = [...messages, userMessage].slice(-13); render(); save();
    input.disabled = true; form.classList.add('is-thinking'); setPose('piensa');
    typingTimer = window.setTimeout(() => {
      messages = [...messages, answer(clean, content)].slice(-14); input.disabled = false; form.classList.remove('is-thinking');
      setPose(includesAny(normalize(clean), ['gracias', 'perfecto', 'listo']) ? 'celebra' : 'explica', true);
      render(); save(); input.focus({ preventScroll: true });
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420);
  };

  launcher.addEventListener('click', open);
  backdrop.addEventListener('click', close);
  root.querySelector<HTMLButtonElement>('[data-dai-close]')!.addEventListener('click', close);
  root.querySelector<HTMLButtonElement>('[data-dai-reset]')!.addEventListener('click', () => { messages = [welcome()]; setPose('saluda', true); save(); render(); input.focus(); });
  log.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-dai-option]');
    if (button?.dataset.daiOption) ask(button.dataset.daiOption);
  });
  form.addEventListener('submit', (event) => { event.preventDefault(); const question = input.value; input.value = ''; ask(question); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) close(); });
  launcher.addEventListener('pointermove', (event) => {
    const bounds = launcher.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - .5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - .5) * 2;
    launcher.style.setProperty('--dai-pointer-x', x.toFixed(3));
    launcher.style.setProperty('--dai-pointer-y', y.toFixed(3));
  });
  launcher.addEventListener('pointerleave', () => {
    launcher.style.setProperty('--dai-pointer-x', '0');
    launcher.style.setProperty('--dai-pointer-y', '0');
  });
  let compactFrame = 0;
  const syncLauncherMode = (): void => {
    compactFrame = 0;
    launcher.classList.toggle('is-compact', window.scrollY > 620);
  };
  window.addEventListener('scroll', () => {
    if (compactFrame) return;
    compactFrame = window.requestAnimationFrame(syncLauncherMode);
  }, { passive: true });
  syncLauncherMode();
  window.setInterval(() => {
    if (!panel.hidden || currentPose === 'piensa') return;
    setPose(currentPose === 'presenta' ? 'saluda' : 'presenta');
  }, 7200);
  render();
}
