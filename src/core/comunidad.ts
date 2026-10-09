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
  imagen?: string; // Imagen propia del post (equipo oficial). Si falta, se usa la portada del curso o un placeholder gráfico.
  verificado?: boolean; // Marca al autor como voz oficial del club (chip ✓ tipo IG verified).
  tipo?: 'post' | 'pregunta'; // "post" = publicación editorial del equipo, "pregunta" = hilo de un miembro.
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
  // ═══ Publicaciones del equipo oficial Dermalysse (voz institucional) ═══
  {
    id: 'post-novedad-modulo',
    tipo: 'post', verificado: true,
    titulo: 'Nuevo módulo en el club · Observación de la piel',
    texto: 'Abrimos un nuevo capítulo en el catálogo: una ruta pensada para afinar la mirada antes de proponer protocolos. Contenido académico revisado y escrito con criterio editorial. Ya disponible dentro de tu catálogo Dermalysse. ✨',
    autor: 'Equipo Dermalysse', fecha: '2026-10-06T14:30:00.000Z', cursoId: null,
    imagen: '/posts/post-novedad-modulo.jpg',
    respuestas: [
      { id: 'r1', autor: 'Natalia M.', fecha: '2026-10-06T15:12:00.000Z', texto: 'Qué buena noticia. ¿Van a cubrir también casos de fototipos altos? Es donde más necesitamos criterio.' },
      { id: 'r2', autor: 'Equipo Dermalysse', fecha: '2026-10-06T16:00:00.000Z', texto: 'Sí, Natalia. La ruta parte justo desde ahí porque es donde más fallan los protocolos genéricos. Avisamos en cuanto publiquemos el primer mundo.' },
    ],
    respuestasTotal: 2, util: 58,
  },
  {
    id: 'post-tip-fotoproteccion',
    tipo: 'post', verificado: true,
    titulo: 'Recordatorio editorial · la fotoprotección no cambia por el clima',
    texto: 'SPF 50+ cada día del año, también en días nublados y en interiores con grandes ventanales. Es la indicación con mayor evidencia dermatológica para prevenir fotoenvejecimiento. Compártelo con tus pacientes cuando apliques cualquier procedimiento ablativo. ☀️',
    autor: 'Equipo Dermalysse', fecha: '2026-10-05T09:15:00.000Z', cursoId: null,
    imagen: '/posts/post-tip-fotoproteccion.jpg',
    respuestas: [
      { id: 'r1', autor: 'Carla P.', fecha: '2026-10-05T10:45:00.000Z', texto: 'Lo tengo impreso en cabina y lo entrego al cierre de cada sesión. Mejor que repetirlo verbal.' },
      { id: 'r2', autor: 'Jimena O.', fecha: '2026-10-05T12:20:00.000Z', texto: 'Agrego: insistir en el reaplicar cada 2 h si hay exposición directa. Es lo que más se olvida.' },
      { id: 'r3', autor: 'Equipo Dermalysse', fecha: '2026-10-05T13:00:00.000Z', texto: 'Excelentes dos tips. Ambos van al checklist de post-procedimiento que estamos preparando para Biblioteca.' },
    ],
    respuestasTotal: 3, util: 94,
  },
  {
    id: 'post-agenda-envivo',
    tipo: 'post', verificado: true,
    titulo: 'Agenda · próxima clase en vivo con el equipo académico',
    texto: 'La semana que viene nos vemos en vivo para conversar sobre criterios de valoración inicial. Reserva tu lugar desde En Vivo. Si no puedes conectarte, la grabación queda disponible dentro del club.',
    autor: 'Equipo Dermalysse', fecha: '2026-10-04T18:00:00.000Z', cursoId: null,
    imagen: '/posts/post-agenda-envivo.jpg',
    respuestas: [
      { id: 'r1', autor: 'Priscila N.', fecha: '2026-10-04T19:20:00.000Z', texto: 'Reservado. ¿Habrá tiempo para preguntas al final o conviene mandarlas antes?' },
      { id: 'r2', autor: 'Equipo Dermalysse', fecha: '2026-10-04T20:00:00.000Z', texto: 'Siempre dejamos los últimos 15 min para preguntas. Si quieres asegurar que la tuya entre, mándala por aquí y la agendamos.' },
    ],
    respuestasTotal: 2, util: 77,
  },
  {
    id: 'post-caso-criterio',
    tipo: 'post', verificado: true,
    titulo: 'Caso de criterio · ¿qué harías tú?',
    texto: 'Llega una paciente sin cita pidiendo un procedimiento para un evento en 48 h. Nunca ha hecho un tratamiento estético y no sabe si es alérgica a algún ingrediente. Expectativa fuerte: "irreconocible". Cuéntanos en comentarios cómo lo manejarías.',
    autor: 'Equipo Dermalysse', fecha: '2026-10-02T11:30:00.000Z', cursoId: null,
    imagen: '/posts/post-caso-criterio.jpg',
    respuestas: [
      { id: 'r1', autor: 'Alejandra T.', fecha: '2026-10-02T12:15:00.000Z', texto: 'Valoración primero, siempre. Nada se aplica el mismo día sin anamnesis ni consentimiento informado, por mucho evento que haya.' },
      { id: 'r2', autor: 'Fernanda L.', fecha: '2026-10-02T13:40:00.000Z', texto: 'Yo agendaría la valoración ese día y propondría un plan seguro ajustado a las 48 h. Hay opciones realistas, pero sin saltar pasos.' },
      { id: 'r3', autor: 'Equipo Dermalysse', fecha: '2026-10-02T16:00:00.000Z', texto: 'Dos respuestas excelentes. Lo veremos a fondo en el próximo caso del modo historia: cómo convertir una expectativa poco realista en un plan honesto.' },
    ],
    respuestasTotal: 3, util: 86,
  },
  {
    id: 'post-material-nuevo',
    tipo: 'post', verificado: true,
    titulo: 'Ya disponible · Ficha de valoración inicial de la piel',
    texto: 'Plantilla editable para documentar la primera consulta: antecedentes, autocuidado, objetivos y pendientes. No reemplaza tu propia metodología; es un formato de trabajo para que lo personalices con tu criterio. En Biblioteca → Materiales. 📋',
    autor: 'Equipo Dermalysse', fecha: '2026-09-29T16:20:00.000Z', cursoId: null,
    imagen: '/posts/post-material-nuevo.jpg',
    respuestas: [
      { id: 'r1', autor: 'Alejandra T.', fecha: '2026-09-29T17:00:00.000Z', texto: 'La estoy adaptando a mi consultorio. Agradezco mucho que el bloque de consentimiento esté separado del clínico; evita confusiones.' },
    ],
    respuestasTotal: 1, util: 48,
  },
  {
    id: 'post-behind-scenes',
    tipo: 'post', verificado: true,
    titulo: 'Detrás de cada clase hay horas de revisión académica',
    texto: 'Antes de que llegue un módulo al catálogo pasa por lectura, verificación de referencias, grabación, edición y una última revisión con el equipo académico. Por eso tardamos: queremos que cada clase que vean sea criterio profesional sostenido, no contenido rápido.',
    autor: 'Equipo Dermalysse', fecha: '2026-09-25T10:00:00.000Z', cursoId: null,
    imagen: '/posts/post-behind-scenes.jpg',
    respuestas: [
      { id: 'r1', autor: 'Mariana R.', fecha: '2026-09-25T11:30:00.000Z', texto: 'Se nota la diferencia con otros cursos online que solo repiten tendencias de redes. Gracias por sostener la línea editorial.' },
      { id: 'r2', autor: 'Daniela V.', fecha: '2026-09-25T13:45:00.000Z', texto: 'Me quedo con la frase "criterio profesional sostenido". Perfecta para explicarlo a colegas que preguntan por qué me formo aquí.' },
    ],
    respuestasTotal: 2, util: 132,
  },

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
    imagen: typeof h.imagen === 'string' ? h.imagen : undefined,
    verificado: h.verificado === true,
    tipo: h.tipo === 'post' ? 'post' : 'pregunta',
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
      const nuevo = desdeRemoto(remoto); listadoApi = [nuevo, ...(listadoApi || [])]; detallesApi.set(nuevo.id, nuevo);
      window.dispatchEvent(new CustomEvent('comunidad:cambio', { detail: { tipo: 'tema', id: nuevo.id } }));
      return nuevo;
    }
    const h = leer();
    const nuevo: Hilo = { id: uid(), titulo, texto, autor: Perfil.get().nombre, fecha: new Date().toISOString(), cursoId, respuestas: [], respuestasTotal: 0, util: 0 };
    h.push(nuevo); escribir(h);
    window.dispatchEvent(new CustomEvent('comunidad:cambio', { detail: { tipo: 'tema', id: nuevo.id } }));
    return nuevo;
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
