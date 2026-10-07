// Comunidad compartida. En producción consume el foro del backend; el modo demo
// conserva una experiencia local completa para poder recorrer la plataforma.
import { api } from './auth';
import { Datos } from './datos';
import { Perfil } from './perfil';

export interface Respuesta { id: string; autor: string; texto: string; fecha: string }
export interface Hilo {
  id: string;
  titulo: string;
  texto: string;
  autor: string;
  fecha: string;
  cursoId: string | null;
  respuestas: Respuesta[];
  respuestasTotal: number;
  util: number;
  marcadoUtil?: boolean;
  oculto?: boolean;
}

interface HiloRemoto extends Omit<Hilo, 'respuestas' | 'respuestasTotal'> { respuestas: number }
interface DetalleRemoto { hilo: HiloRemoto; respuestas: Respuesta[] }

const KEY = 'dermalysse:foro:v2';
const uid = () => Math.random().toString(36).slice(2, 10);
let listadoApi: Hilo[] | null = null;
const detallesApi = new Map<string, Hilo>();
let cargandoListado: Promise<void> | null = null;
const cargandoDetalle = new Map<string, Promise<void>>();

const SEMILLA: Hilo[] = [
  {
    id: 'bienvenida',
    titulo: 'Bienvenidas y bienvenidos a la comunidad Dermalysse',
    texto: 'Este es un espacio educativo para conversar sobre los cursos, compartir aprendizajes y formular preguntas. Evita datos personales, fotografías identificables y solicitudes de diagnóstico. Cuando el caso lo amerite, deriva a especialidad médica.',
    autor: 'Equipo Dermalysse', fecha: '2026-09-01T10:00:00.000Z', cursoId: null, respuestas: [], respuestasTotal: 0, util: 42,
  },
  {
    id: 'notas-de-clase',
    titulo: '¿Cómo organizan sus notas después de cada clase?',
    texto: 'Estoy separando conceptos, dudas y ejemplos prácticos para poder repasar más rápido. ¿Qué estructura les funciona mejor?',
    autor: 'Mariana R.', fecha: '2026-09-18T17:20:00.000Z', cursoId: null, util: 18, respuestasTotal: 3,
    respuestas: [
      { id: 'r1', autor: 'Paola C.', fecha: '2026-09-18T18:05:00.000Z', texto: 'Uso tres bloques: lo esencial, lo que necesito investigar y una aplicación posible. Me ayuda a no confundir apuntes con indicaciones profesionales.' },
      { id: 'r2', autor: 'Equipo Dermalysse', fecha: '2026-09-18T19:10:00.000Z', texto: 'Muy buena estructura. También puedes guardar tus notas dentro de cada clase para retomarlas junto al contenido.' },
      { id: 'r3', autor: 'Lucía M.', fecha: '2026-09-19T08:45:00.000Z', texto: 'A mí me funciona grabarme un audio de 2 minutos al terminar la clase explicando lo que entendí. Si no lo puedo contar, es que no quedó claro.' },
    ],
  },
  {
    id: 'documentar-primera-consulta',
    titulo: '¿Qué incluyen siempre en la primera consulta?',
    texto: 'Estoy armando mi propia ficha de valoración inicial y me gustaría comparar criterios. ¿Qué datos consideran indispensables y cómo los organizan?',
    autor: 'Sofía E.', fecha: '2026-09-24T12:40:00.000Z', cursoId: 'course-uso-de-tecnologias-avanzadas-en-cosmiatria', util: 23, respuestasTotal: 4,
    respuestas: [
      { id: 'r1', autor: 'Equipo Dermalysse', fecha: '2026-09-24T14:00:00.000Z', texto: 'En la clase se mencionan cuatro bloques base: antecedentes personales, hábitos de autocuidado, objetivos del paciente y expectativas realistas. La plantilla de la biblioteca sigue esa misma estructura.' },
      { id: 'r2', autor: 'Daniela V.', fecha: '2026-09-24T15:12:00.000Z', texto: 'Sumo siempre: medicamentos actuales, antecedentes alérgicos y procedimientos previos (fecha y resultado). Me evitó más de un problema.' },
      { id: 'r3', autor: 'Jimena O.', fecha: '2026-09-24T18:30:00.000Z', texto: 'Yo documento también una foto frontal y lateral estandarizada (misma luz, misma distancia). Siempre con consentimiento firmado.' },
      { id: 'r4', autor: 'Sofía E.', fecha: '2026-09-25T09:05:00.000Z', texto: '¡Gracias! Me quedo con lo del consentimiento específico para la fotografía. Estaba usando el general y entiendo que es mejor separar.' },
    ],
  },
  {
    id: 'fotoproteccion-post-tratamiento',
    titulo: 'Fotoprotección después de procedimientos: ¿qué recomiendan a pacientes?',
    texto: 'Después de un dermaplaning noto que varias pacientes no sostienen la fotoprotección más allá de los primeros días. ¿Qué estrategias usan ustedes para que se vuelva hábito?',
    autor: 'Carla P.', fecha: '2026-09-27T11:15:00.000Z', cursoId: 'course-microdermoabrasion-y-dermaplaning-tecnicas-de-exfoliacion-avanzada', util: 31, respuestasTotal: 3,
    respuestas: [
      { id: 'r1', autor: 'Renata G.', fecha: '2026-09-27T12:50:00.000Z', texto: 'A mí me ha funcionado dejar la recomendación escrita (dosis, horario, textura) y entregarla impresa al final de la sesión. Lo verbal se olvida.' },
      { id: 'r2', autor: 'Equipo Dermalysse', fecha: '2026-09-27T14:30:00.000Z', texto: 'Buen punto. En la clase 3 verán el patrón de ficha post-procedimiento: ayuda a convertir la recomendación en un compromiso visible.' },
      { id: 'r3', autor: 'Mariana R.', fecha: '2026-09-28T07:40:00.000Z', texto: 'Yo mando un recordatorio por WhatsApp a los 3 y 7 días. Breve, sin spam. La adherencia subió bastante.' },
    ],
  },
  {
    id: 'consentimiento-informado',
    titulo: 'Consentimiento informado: ¿qué nunca puede faltar?',
    texto: 'Estoy actualizando mis formatos de consentimiento y quiero verificar que los elementos clave estén cubiertos. ¿Qué revisan ustedes antes de aplicar cualquier procedimiento?',
    autor: 'Alejandra T.', fecha: '2026-09-30T09:20:00.000Z', cursoId: 'course-regulacion-cosmetica', util: 27, respuestasTotal: 3,
    respuestas: [
      { id: 'r1', autor: 'Equipo Dermalysse', fecha: '2026-09-30T10:45:00.000Z', texto: 'La guía del módulo de Regulación lista siete puntos: identificación de la persona, descripción del procedimiento, beneficios esperables, riesgos conocidos, alternativas disponibles, derecho a retirar el consentimiento y datos del profesional responsable. Firma y fecha en cada copia.' },
      { id: 'r2', autor: 'Fernanda L.', fecha: '2026-09-30T13:00:00.000Z', texto: 'Agrego siempre una línea donde la persona confirma que comprendió el documento y pudo hacer preguntas. Pequeño detalle que ha pesado mucho en revisiones.' },
      { id: 'r3', autor: 'Alejandra T.', fecha: '2026-10-01T08:10:00.000Z', texto: 'Gracias. Me faltaba la de retirar el consentimiento; ya está en el formato nuevo.' },
    ],
  },
  {
    id: 'expectativas-redes-sociales',
    titulo: 'Pacientes que llegan comparando con resultados de redes sociales',
    texto: 'Cada vez más pacientes muestran fotos de redes como referencia. ¿Cómo manejan la conversación de expectativas realistas sin que se sientan rechazados?',
    autor: 'Natalia M.', fecha: '2026-10-02T15:00:00.000Z', cursoId: null, util: 36, respuestasTotal: 4,
    respuestas: [
      { id: 'r1', autor: 'Equipo Dermalysse', fecha: '2026-10-02T16:40:00.000Z', texto: 'Validar lo que están buscando y luego traducirlo a lo que su piel/caso realmente permite ayuda a bajar la tensión. Mostrar casos propios (con consentimiento) de perfiles similares es más honesto que comparar con una foto editada.' },
      { id: 'r2', autor: 'Paola C.', fecha: '2026-10-02T18:15:00.000Z', texto: 'A mí me ha funcionado explicar que esas fotos tienen edición, iluminación y a veces maquillaje; y que no sabemos qué procedimientos previos tuvo esa persona. No descalifico la referencia, la contextualizo.' },
      { id: 'r3', autor: 'Daniela V.', fecha: '2026-10-02T19:50:00.000Z', texto: 'También pregunto qué les gustaría sentir después del tratamiento, no sólo cómo verse. Eso suele ser más alcanzable y más duradero.' },
      { id: 'r4', autor: 'Natalia M.', fecha: '2026-10-03T07:20:00.000Z', texto: 'Me quedo con "qué les gustaría sentir". Es un giro súper útil. Gracias.' },
    ],
  },
  {
    id: 'biblioteca-ingredientes-inci',
    titulo: 'Biblioteca personal de ingredientes INCI: ¿cómo la organizan?',
    texto: 'Estoy armando mi propia referencia para consultar ingredientes rápido durante la consulta. ¿Qué formato y qué fuentes usan?',
    autor: 'Camila S.', fecha: '2026-10-04T10:05:00.000Z', cursoId: 'course-formulacion-de-cosmetica-natural', util: 19, respuestasTotal: 2,
    respuestas: [
      { id: 'r1', autor: 'Lucía M.', fecha: '2026-10-04T11:40:00.000Z', texto: 'Yo tengo una hoja por ingrediente con: nombre INCI, función, concentración segura típica, incompatibilidades, embarazo/lactancia (si aplica) y fuente de la información. Me obligo a citar la fuente para no mezclar opiniones con evidencia.' },
      { id: 'r2', autor: 'Equipo Dermalysse', fecha: '2026-10-04T12:30:00.000Z', texto: 'Excelente criterio citar la fuente. El glosario del club seguirá ese mismo formato cuando esté publicado.' },
    ],
  },
  {
    id: 'estetica-corporal-expectativas',
    titulo: 'Cómo comunicar que la estética corporal requiere constancia',
    texto: 'Es común que la gente espere resultados visibles en una sola sesión. ¿Qué recursos usan para explicar que el proceso es progresivo y depende de hábitos?',
    autor: 'Beatriz R.', fecha: '2026-10-05T09:30:00.000Z', cursoId: 'course-estetica-corporal-tecnicas-de-contorno-y-remodelacion', util: 14, respuestasTotal: 2,
    respuestas: [
      { id: 'r1', autor: 'Fernanda L.', fecha: '2026-10-05T11:00:00.000Z', texto: 'Les muestro una línea de tiempo realista: cuándo se nota el primer cambio, cuándo el intermedio y qué pasa si se interrumpe. Firman esa línea del tiempo junto con el consentimiento.' },
      { id: 'r2', autor: 'Equipo Dermalysse', fecha: '2026-10-05T13:10:00.000Z', texto: 'Buen enfoque. En la clase 5 del curso se habla justamente de cómo documentar hitos para que la constancia tenga referencias objetivas.' },
    ],
  },
  {
    id: 'nutricion-adherencia',
    titulo: 'Pacientes que se desaniman en la segunda semana del plan',
    texto: 'Es un patrón que veo mucho: arrancan con mucho ánimo y para la segunda o tercera semana aflojan. ¿Qué les ha funcionado para sostener la adherencia sin presión?',
    autor: 'Rodrigo A.', fecha: '2026-10-05T18:20:00.000Z', cursoId: 'course-nutricion-clinica-para-enfermedades-cronicas', util: 29, respuestasTotal: 3,
    respuestas: [
      { id: 'r1', autor: 'Renata G.', fecha: '2026-10-05T19:40:00.000Z', texto: 'Pequeñas metas semanales (no mensuales) y revisiones breves por mensaje. La sensación de "logré algo" cada 7 días cambia la curva.' },
      { id: 'r2', autor: 'Equipo Dermalysse', fecha: '2026-10-05T21:00:00.000Z', texto: 'La guía de seguimiento del módulo trabaja justamente eso: objetivos cortos y revisables, con espacio para registrar emociones y no sólo cumplimiento.' },
      { id: 'r3', autor: 'Jimena O.', fecha: '2026-10-06T08:00:00.000Z', texto: 'Yo pregunto qué los enganchó al inicio y lo uso como ancla cuando aflojan. Reconectar con el "por qué" ayuda más que insistir con el "cómo".' },
    ],
  },
  {
    id: 'bioseguridad-cabina',
    titulo: 'Protocolo de higiene en cabina: ¿cuál es su checklist antes de atender?',
    texto: 'Estoy haciendo mi checklist formal para cada sesión. ¿Qué pasos consideran mínimos indispensables antes de que entre la persona?',
    autor: 'Priscila N.', fecha: '2026-10-06T10:15:00.000Z', cursoId: null, util: 21, respuestasTotal: 3,
    respuestas: [
      { id: 'r1', autor: 'Carla P.', fecha: '2026-10-06T11:30:00.000Z', texto: 'Superficies desinfectadas, equipo estéril o desechable listo, lavado de manos y EPP puesto antes de abrir la puerta. Si falta algo, no entra la paciente.' },
      { id: 'r2', autor: 'Equipo Dermalysse', fecha: '2026-10-06T12:45:00.000Z', texto: 'En la biblioteca ya está la plantilla "Checklist de higiene y bioseguridad en cabina" para que la personalicen con sus propios insumos.' },
      { id: 'r3', autor: 'Alejandra T.', fecha: '2026-10-06T14:20:00.000Z', texto: 'Agrego: ventilación y temperatura ambiente antes de que llegue la persona. Suena menor pero mejora mucho la experiencia.' },
    ],
  },
];

function normalizar(h: Partial<Hilo> & { id: string }): Hilo {
  const respuestas = Array.isArray(h.respuestas) ? h.respuestas : [];
  return {
    id: h.id,
    titulo: h.titulo || '', texto: h.texto || '', autor: h.autor || 'Miembro Dermalysse',
    fecha: h.fecha || new Date().toISOString(), cursoId: h.cursoId || null,
    respuestas, respuestasTotal: Number(h.respuestasTotal ?? respuestas.length) || 0,
    util: Number(h.util) || 0, marcadoUtil: h.marcadoUtil === true, oculto: h.oculto === true,
  };
}

function desdeRemoto(h: HiloRemoto, respuestas: Respuesta[] = []): Hilo {
  return normalizar({ ...h, respuestas, respuestasTotal: Number(h.respuestas) || respuestas.length });
}

function leer(): Hilo[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return Array.isArray(v) ? v.map(normalizar) : structuredClone(SEMILLA);
  } catch { return structuredClone(SEMILLA); }
}
function escribir(h: Hilo[]) { try { localStorage.setItem(KEY, JSON.stringify(h)); } catch {} }

export const Comunidad = {
  hilos(cursoId?: string | null): Hilo[] {
    const origen = Datos.modo === 'api' ? (listadoApi || []) : leer();
    const h = origen.filter((x) => !x.oculto).sort((a, b) => b.fecha.localeCompare(a.fecha));
    return cursoId === undefined ? h : h.filter((x) => x.cursoId === cursoId);
  },
  hilo(id: string) {
    if (Datos.modo === 'api') return detallesApi.get(id) || listadoApi?.find((h) => h.id === id);
    return leer().find((h) => h.id === id && !h.oculto);
  },
  cargando() { return Datos.modo === 'api' && listadoApi === null; },
  necesitaDetalle(id: string) { return Datos.modo === 'api' && !detallesApi.has(id); },
  async cargarListado() {
    if (Datos.modo !== 'api' || listadoApi) return;
    if (!cargandoListado) cargandoListado = api<HiloRemoto[]>('/foro')
      .then((hilos) => { listadoApi = hilos.map((h) => desdeRemoto(h)); })
      .finally(() => { cargandoListado = null; });
    return cargandoListado;
  },
  async cargarDetalle(id: string) {
    if (Datos.modo !== 'api' || detallesApi.has(id)) return;
    if (!cargandoDetalle.has(id)) cargandoDetalle.set(id, api<DetalleRemoto>(`/foro/${encodeURIComponent(id)}`)
      .then((d) => {
        const completo = desdeRemoto(d.hilo, d.respuestas || []);
        detallesApi.set(id, completo);
        if (listadoApi) listadoApi = listadoApi.map((h) => h.id === id ? completo : h);
      })
      .finally(() => { cargandoDetalle.delete(id); }));
    return cargandoDetalle.get(id);
  },
  todos() { return (Datos.modo === 'api' ? (listadoApi || []) : leer()).sort((a, b) => b.fecha.localeCompare(a.fecha)); },
  alternarOculto(id: string) {
    if (Datos.modo === 'api') return;
    const h = leer(); const t = h.find((x) => x.id === id); if (t) { t.oculto = !t.oculto; escribir(h); }
  },
  async crear(titulo: string, texto: string, cursoId: string | null) {
    if (Datos.modo === 'api') {
      const remoto = await api<HiloRemoto>('/foro', { method: 'POST', json: { titulo, texto, cursoId } });
      const nuevo = desdeRemoto(remoto); listadoApi = [nuevo, ...(listadoApi || [])]; detallesApi.set(nuevo.id, nuevo); return nuevo;
    }
    const h = leer();
    const nuevo: Hilo = { id: uid(), titulo, texto, autor: Perfil.get().nombre, fecha: new Date().toISOString(), cursoId, respuestas: [], respuestasTotal: 0, util: 0 };
    h.push(nuevo); escribir(h); return nuevo;
  },
  async responder(id: string, texto: string) {
    if (Datos.modo === 'api') {
      const respuesta = await api<Respuesta>(`/foro/${encodeURIComponent(id)}/respuestas`, { method: 'POST', json: { texto } });
      const t = detallesApi.get(id); if (t) { t.respuestas.push(respuesta); t.respuestasTotal += 1; }
      const lista = listadoApi?.find((h) => h.id === id); if (lista && lista !== t) lista.respuestasTotal += 1;
      return;
    }
    const h = leer(); const t = h.find((x) => x.id === id); if (!t) return;
    t.respuestas.push({ id: uid(), autor: Perfil.get().nombre, texto, fecha: new Date().toISOString() }); t.respuestasTotal = t.respuestas.length; escribir(h);
  },
  async util(id: string) {
    if (Datos.modo === 'api') {
      const r = await api<{ util: number }>(`/foro/${encodeURIComponent(id)}/util`, { method: 'POST' });
      const actualizar = (t?: Hilo) => { if (t) { t.util = r.util; t.marcadoUtil = true; } };
      actualizar(detallesApi.get(id)); actualizar(listadoApi?.find((h) => h.id === id)); return;
    }
    const h = leer(); const t = h.find((x) => x.id === id); if (t && !t.marcadoUtil) { t.util++; t.marcadoUtil = true; escribir(h); }
  },
  misHilos() { const n = Perfil.get().nombre; return (Datos.modo === 'api' ? (listadoApi || []) : leer()).filter((h) => h.autor === n); },
};

export const hace = (iso: string) => {
  const ms = new Date(iso).getTime();
  if (!iso || !Number.isFinite(ms)) return '—';
  const d = (Date.now() - ms) / 60000;
  if (d < 60) return `hace ${Math.max(1, Math.round(d))} min`;
  if (d < 1440) return `hace ${Math.round(d / 60)} h`;
  if (d < 43200) return `hace ${Math.round(d / 1440)} d`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};
