# Plan · Academia Dermalysse

Decisión del propietario (15 de octubre de 2026): Dermalysse incorpora una **Academia** al nivel de las que ya tienen otros clubes del mismo equipo, con la identidad propia de Dermalysse (crema, vino y azul tinta, editorial). Elite Pecuario y OdonTeck sirven solo como **referencia técnica** del motor; no se copia su marca, contenido ni activos.

## 1. Qué es

- **Cursos** sigue siendo lo que ya existe: clases en video.
- **Academia** es lo nuevo: **programas** de lectura guiada por módulos, con figuras, actividades, un minijuego y un examen por módulo, al estilo de Cisco Networking Academy.

## 2. Cómo funciona un programa

- Avance secuencial: un módulo se abre al aprobar el examen del anterior con 70 % o más.
- Cada módulo: 4 a 6 temas de lectura (cada uno con «En pocas palabras», glosario y 3 preguntas de repaso), actividades (ordenar, relacionar, verdadero/falso, caso, calculadora), un minijuego (sopa de letras, crucigrama o memorama) y un examen de 15 a 20 preguntas (se muestran 10 al azar).
- Freemium: el módulo 1 de cada programa es gratis; el resto requiere VIP.
- Calendario de lanzamiento (decisión del propietario, 15 de octubre de 2026): un programa puede abrir sus módulos por fechas. *Fundamentos de la piel* abre el módulo 1 el **jueves 22 de octubre de 2026** y uno nuevo cada 7 días (módulo 12: 7 de enero de 2027), a las 00:00 de la Ciudad de México. Antes de su fecha, el módulo se ve como «Disponible el … · faltan N días» y no muestra contenido; la fecha se revisa antes que borrador, VIP y desbloqueo. Si las imágenes están listas antes, el administrador mueve la fecha de inicio en `/admin/academia` («Liberar el módulo 1 hoy» o una fecha elegida) y todo el calendario se recorre; «Volver a la fecha del catálogo» lo restablece. Campo `lanzamiento` del catálogo: ver `docs/ACADEMIA-FORMATO.md` §1.
- El examen lo emite y califica el servidor. Las respuestas correctas nunca viajan antes de responder y, al reprobar, no se revelan; tras reprobar hay una espera de 3 minutos. Para recibir el examen hay que haber leído todos los temas.
- Los minijuegos se presentan como **Laboratorio Dermalysse**: reto estable, validación por la API, avance sincronizado entre dispositivos y 10 Diamantes + 10 XP en la primera finalización de cada módulo. La vista previa administrativa y el modo local no acreditan premios reales.

## 3. Catálogo inicial

| # | Programa | Estado |
| --- | --- | --- |
| 1 | Fundamentos de la piel: estructura, función y cuidado (12 módulos) | **Piloto completo, en borrador** |
| 2 | Activos cosméticos y formulación | En preparación |
| 3 | Fotoprotección y fotoenvejecimiento | En preparación |
| 4 | Envejecimiento cutáneo y cuidado en cabina | En preparación |
| 5 | Bioseguridad y buenas prácticas en cabina | En preparación |

El catálogo vive en `api/content/academia/catalogo.json`; cada módulo en `api/content/academia/<programa>/modulo-NN.json`.

## 4. Calidad del contenido: punto crítico

1. Todo módulo nace como `borrador` y **solo lo ve el administrador** hasta que un profesional (dermatólogo o cosmetóloga con cédula) lo revise y lo marque como `aprobado`.
2. Cada tema lista sus fuentes. Nada de cifras, normas, autores ni URL inventados.
3. Contenido **educativo**: no diagnostica, no prescribe, no promete resultados y siempre indica cuándo derivar a un médico. Sin dosis ni protocolos médicos.
4. Procedimientos médicos (toxina botulínica, rellenos, láseres médicos) quedan fuera de la Academia o se mencionan solo para explicar el alcance profesional y la derivación.

Formato y estándar editorial: `docs/ACADEMIA-FORMATO.md`. Brief para redactores: `docs/ACADEMIA-BRIEF-AGENTES.md`. Validador: `node scripts/academia/validar.mjs [programa] [--estricto]`.
