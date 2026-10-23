# Dermalysse Platform

Repositorio independiente de Dermalysse con dos entradas:

- `/`: landing editorial de Dermalysse.
- `/club/`: plataforma educativa basada en la arquitectura del club Elite Pecuario y adaptada a Dermalysse.

## Uso local

```powershell
npm install
npm run dev
```

La plataforma funciona en modo demo cuando `VITE_API_URL` no está definido. Firebase, API, pagos y video productivo solo se conectan mediante variables de entorno; el repositorio no incluye credenciales ni identificadores productivos.

## Verificación

```powershell
npm test
npm run build
```

El catálogo local se genera desde la fuente oficial disponible en `C:\dev\02_CLIENTES\Dermalysse\_fuentes\Club-Dermalysse` ejecutando `node scripts/prepare-migration.mjs`.

## Base común de calidad local · 20 de octubre de 2026

Se conserva el diseño propio. Se añadió caché por sesión con deduplicación, descarte de respuestas tardías al cambiar de cuenta e invalidación del catálogo y sus índices. Las peticiones JSON autenticadas comprueban que la cuenta no haya cambiado durante la obtención del token ni durante la respuesta. El progreso de práctica local se guarda por UID; los datos antiguos compartidos se conservan y sólo pueden recuperarse en la cuenta demo. Esto no convierte el almacenamiento local en persistencia de servidor ni cubre todas las rutas/módulos de la plataforma.

Se incorporaron 9 pruebas de regresión de sesión/almacenamiento por repositorio, Node >=24 y `npm run verify`. Las verificaciones de CI están preparadas en archivos locales; aún no se ejecutaron en GitHub. No hubo commit, push, despliegue, cambio de Firebase, pagos ni bases de datos.

Los retos de práctica local excluyen preguntas cuya respuesta correcta viene oculta (`correcta: -1`), evitando que un tiempo agotado se considere acierto o que una tarjeta revele `undefined`. El examen de clase continúa usando su calificación de servidor. Esta corrección no añade una API de arcade: si no hay banco local calificable, esas prácticas pueden quedar vacías. Debe integrarse un banco y calificación propios antes de anunciarlas como sincronizadas.

Verificación: frontend 29/29, API 214/214, comprobación de tipos y build aprobados. Smoke de Retos en navegador demo sin errores de consola; no sustituye QA autenticado ni móvil completo. Persiste la advertencia de bundle grande. El workflow existente de publicación añade comprobaciones previas y Node 24; editarlo no ejecuta un despliegue.

## Retos conectados · implementación local 2026-10-20

En modo API, Quiz, reto diario, casos y flashcards cargan GET /retos y guardan por POST /retos/responder. El servidor califica preguntas, limita premios, calcula fechas y conserva estado por UID en transacción. Las respuestas correctas/explicaciones no viajan en el catálogo de preguntas/casos; se entregan tras responder. El cliente no suma XP antes de confirmación ni recupera semillas al fallar. Se mantienen diseños y el modo demo separado.

Datos en la base Firestore propia de esta marca:
- v2_retos_banco/{id}: tipo pregunta|caso|tarjeta, estado aprobado, revision con responsable y fecha YYYY-MM-DD, gratis:true para acceso gratuito explícito y contenido. Sólo lectura desde API; hasta 500 registros en esta primera versión.
- Pregunta: q, opciones (2–8), correcta (índice), explicacion, curso/area opcionales. Caso: titulo, paciente, presentacion, hallazgos y diagnostico/plan con pregunta u q, opciones, correcta, explicacion. Tarjeta: frente/reverso texto plano y curso/area.
- v2_retos_estado/{UID codificado}: xp, quizBest, casos, sr (due/reps/fallos), diaria (fecha/racha). Subcolección acciones registra operaciones, partidas y premios para evitar duplicación. No se migra XP local previo.
- POST acepta id, operacion única y tipo; quiz añade partida y respuesta; diaria respuesta; caso fase diagnostico|plan y respuesta; tarjeta calidad otra|dificil|bien|facil. Respuesta null equivale a tiempo agotado. Reintento con misma operación/payload es idempotente; reutilizarla para otro payload devuelve 409. Campos ajenos a la modalidad o autoridad del cliente se rechazan.

Puntajes: quiz 100 por acierto y 10 XP en la primera respuesta correcta elegible del día por pregunta (máximo 20 preguntas por partida); diaria 30/10 XP una vez por día UTC; caso 50 XP una sola vez al resolver ambas etapas; tarjetas autoevaluadas 0/1/3/5 XP como máximo una vez por tarjeta/día. No equivalen a canjes, puntos comerciales ni certificados. El reloj visual no acredita velocidad ante el servidor.

El banco conectado es independiente del catálogo de quizzes de clase: requiere carga editorial revisada en v2_retos_banco. No se copió contenido de otra marca, no se aprobó contenido ni se escribió en una base real. Colección vacía produce práctica vacía; no se sustituyen preguntas por demos. Historia y clasificación conservan sus contratos existentes; esta entrega no unifica su puntuación con arcade.

Antes de publicar: comprobar Auth/Firestore real o emuladores, denegación de acceso directo del cliente al banco y estado, permisos por cuenta, carga editorial revisada y operaciones/reintentos con cuentas controladas. Verificar reglas desplegadas (las pruebas HTTP usan almacenamiento doble). El historial de acciones aún no tiene retención automática; definirla sin eliminar las claves necesarias para idempotencia. No se desplegó.

Verificación agregada: 4 pruebas frontend del transporte de retos (vacío, cuenta tardía, reintento, escape de tarjeta) y 3 grupos HTTP de API (acceso/redacción, persistencia/aislamiento/manipulación y diaria/caso/tarjeta). Revisión de escritorio y teléfono con datos técnicos en memoria, sin contenido profesional ni Firebase real.
