# Comparativa de arquitectura y plan de brechas — Dermalysse

Fecha de corte: 20 de octubre de 2026
Alcance: inspección estática de los repositorios y validación local de build/pruebas. No se inspeccionaron secretos ni servicios de producción, y no se hicieron cambios en Élite Pecuario.

## Resumen ejecutivo

Dermalysse ya tiene una base arquitectónica modular y, en varias áreas, más desacoplada que la referencia: frontend Vite + TypeScript, API TypeScript separada por dominio/rutas/servicios/adaptadores, selección explícita entre modo local y Firebase/Firestore, y pruebas con dependencias inyectables. No hace falta reconstruir el club copiando la arquitectura de Élite.

Hay dos flujos de incorporación importantes que deben evaluarse antes de ampliar funciones: la entrevista inicial y la elección del curso gratis. Dermalysse tiene ambos, pero son procesos separados; además, la regla de reproducción para que el curso elegido quede realmente abierto todavía depende del webhook legado. La otra brecha de comportamiento entre demo y cuenta real está en la gamificación: Retos guarda XP de juegos, racha diaria, casos y repetición espaciada en `localStorage`, mientras que `/recompensas` sí calcula y canjea desde el servidor.

Las otras brechas principales son de cierre operativo, no de diseño de pantallas: pruebas de integración reales controladas para Firebase/webhook, una compuerta CI que ejecute frontend y API, documentación de estado actualizada, y optimización del bundle del club. El despliegue sigue fuera de alcance: el workflow despliega GitHub Pages al actualizar `main`, así que cualquier publicación requiere una decisión y autorización explícitas.

## Evidencia y límites de la comparación

- Dermalysse inspeccionado en `C:/dev/02_CLIENTES/Dermalysse/dermalysse-wt-produccion`, rama `feat/produccion`, HEAD `c245418`.
- Élite Pecuario inspeccionado en `C:/dev/02_CLIENTES/VisionPecuaria-Avicola/elite-pecuario`, rama `main`, HEAD `02bcf57`.
- Ambos repositorios tenían cambios locales sin commit al momento de la auditoría. En Élite también están modificados `docs/CONTEXTO-MAESTRO.md` y `docs/contrato.md`; por eso la referencia refleja el árbol visible de trabajo, no una afirmación de que todo esté publicado o incluso integrado en `main`.
- El árbol de Dermalysse tenía 14 archivos modificados relacionados con el directorio de experiencias y su moderación. Se preservaron íntegramente. Esta comparación no confirma que ese trabajo esté terminado o revisado por el propietario.
- La revisión de Élite fue solo de lectura y limitada a estructura, contratos, controles y documentación. No se copiaron código, marca, datos, assets, reglas pecuarias, credenciales ni configuración de sus servicios.
- Build y pruebas locales no prueban login remoto, datos reales, webhooks, Stripe, Bunny, certificados en producción, seguridad de reglas desplegadas ni disponibilidad pública.

## Arquitectura observada

| Área | Élite Pecuario / patrón útil | Dermalysse actual | Evaluación |
| --- | --- | --- | --- |
| Aplicación web | Vite + TypeScript vanilla; carpetas distintas para `core`, `pages`, `admin`, `ui` y `styles`; hash router. | Mismo enfoque general; entradas separadas de landing y club, con `src/site/` para el sitio público y `src/pages/` + `src/core/` para el club. | La base de Dermalysse ya sigue el patrón útil. Conservar su identidad y contenido propios. |
| API | Express/Node, rutas agrupadas por área, middleware de usuario/admin, lógica de dominio y bibliotecas de soporte; contratos detallados entre cliente, admin y API. | Express + TypeScript, `routes/`, `services/`, `domain/`, `middleware/`, `adapters/` y módulos montables. Las dependencias se inyectan para probar memoria y producción. | Dermalysse ya está bien separada y tipada. Mantener la arquitectura más desacoplada; usar de Élite la claridad del contrato y las puertas de calidad, no su implementación literal. |
| Datos/auth | Firebase Auth verificado por API; Admin SDK/Firestore; las rutas sensibles validan usuario y rol en servidor. | `AUTH_MODE=dev` con memoria o `firebase` con `firestore`; combinaciones mixtas rechazadas. Admin se resuelve desde `admins/{uid}`; la política de membresía se porta del webhook de Dermalysse. | La decisión de autoridad está definida en documentación y código. Falta demostrar el flujo de extremo a extremo con entorno de prueba autorizado. |
| Pagos, video y certificados | El servidor valida acceso; Stripe y Bunny quedan tras la API; los eventos de video acreditan progreso. Élite tiene su integración propia y contrato explícito. | La API Dermalysse delega checkout, portal, reproducción, avance y certificado al webhook existente; Firebase contiene el estado que el webhook actualiza. | Patrón correcto para conservar el sistema actual; falta verificar integración coordinada, idempotencia, retornos y fallos con sandbox/entorno de pruebas. No intercambiar credenciales ni endpoints entre marcas. |
| Cursos y administración | Contrato API y módulos admin para cursos, miembros, materiales, eventos, foro, cupones y otras áreas. | Hay rutas/servicios admin para catálogo, miembros, contenidos/eventos, foro, experiencia, configuración, cupones y Academia; el cliente tiene módulos `src/admin/`. | La paridad arquitectónica básica ya está presente. Auditar permisos, flujos completos y auditoría de cambios, no añadir módulos solo por imitación. |
| Comunidad | Foro con identidad derivada del token y moderación administrativa; Directorio Pecuario es funcionalidad propia de Élite. | Foro y módulo Dermalysse de experiencias/directorio; la rama actual incluye cambios sin commit para moderación del directorio. | Mantener el directorio como producto Dermalysse con privacidad, consentimiento, retención, borrado y moderación definidos antes de operar con perfiles reales. No copiar el Directorio Pecuario. |
| Recompensas y retos | XP, recompensas y beneficios sensibles se calculan/canjean en API; las reglas no las decide el navegador. | Recompensas/cupones tienen servicios de API; sin embargo `src/core/juegos.ts` guarda XP, racha diaria, casos y repetición espaciada en `localStorage`. El progreso total suma progreso de curso y XP local. No aparece un endpoint de API para acreditar el resultado de esos juegos. | Brecha prioritaria: separar estado visual/de práctica local de XP, rachas y logros que cuentan para una cuenta real. Calificar y acreditar del lado servidor. |
| Pruebas | Pruebas API/clientes y pruebas específicas de reglas Firebase mediante emuladores están definidas en scripts. | En esta revisión: 20 pruebas frontend, 214 pruebas API y typecheck API pasan. Los tests de producción usan Firestore/fetch falsos; no se ejecutó una prueba contra Firebase o webhook real. El workflow de Pages construye el frontend, pero no ejecuta `npm test` ni las pruebas/typecheck de API. | Buena base unitaria; falta integrar estos checks en CI y añadir smoke/E2E seguro para el entorno de prueba. No usar datos de miembros ni cobros reales. |
| Operación y publicación | Élite documenta su flujo de publicación e infraestructura propia; esa configuración no es transferible. | `.github/workflows/deploy.yml` publica GitHub Pages después de un `push` a `main` y exige `VITE_API_URL` para evitar una compilación de club en modo demo. | Antes de cualquier publicación se debe revisar el workflow y los secretos/variables en la cuenta propietaria. Esta tarea no hizo push ni despliegue. |
| Rendimiento | Separación de chunks y verificación de pantallas son parte de la operación de referencia. | El build termina, pero avisa que el chunk `club` pesa ~1.13 MB minificado y que el CSS pesa ~546 KB; el dynamic import de Lucide no crea un chunk separado porque también se importa estáticamente. | Optimización recomendada después de proteger flujos funcionales: separar rutas/módulos pesados e iconos y medir el efecto, sin perseguir números a costa de estabilidad. |
| Contexto del proyecto | Contexto maestro y contrato se actualizan con cambios relevantes. | `docs/CONTEXTO-TRABAJO-CODEX.md` y otros handoffs aún mencionan `eac969c`/estado de octubre 9, pero el HEAD actual es `c245418` y la rama `feat/produccion`. | Hay deriva documental: actualizar handoff y registro de estado una vez que el trabajo sucio actual se concilie, sin eliminarlo ni asumir que está listo. |

## Incorporación: entrevista, elección gratis y primeros pasos

Estos elementos se parecen en el recorrido del miembro, pero no son una sola función:

| Paso o función | Élite Pecuario, estado observado | Dermalysse, estado observado | Qué falta cerrar |
| --- | --- | --- | --- |
| Entrevista inicial | Existe una entrevista de bienvenida/encuesta separada, con consentimiento, respuestas guardadas en API, resultados agregados para admin y posible beneficio sujeto a elegibilidad/campaña. En el flujo actual, no sustituye la elección inicial del curso. | Si una cuenta nueva llega a Inicio con entrevista pendiente, `src/main.ts` la redirige a `/bienvenida`. Tiene respuestas/recomendaciones; su posible beneficio depende de reglas de campaña en API. | Confirmar el orden deseado por Dermalysse y que la entrevista pueda posponerse/retomarse sin bloquear cursos ni confundirla con el regalo del curso. No habilitar beneficios comerciales sin aprobación. |
| Curso gratis | La ruta de primera entrada para cuenta no VIP sin elección es `#/elige-curso`. La selección se valida en API y se guarda una sola vez. | Existe pantalla/anuncio para elegir, confirmación permanente y selección API en `POST /me/curso-gratis`; modo demo usa almacenamiento local. El disparador actual abre la entrevista primero si está pendiente y, después, presenta la elección del curso. | La persistencia de la elección está implementada; falta verificar el recorrido completo con cuenta nueva real y asegurar que el backend de reproducción aplique la excepción del curso seleccionado. |
| Regla de acceso a clases | Curso elegido abierto según la regla del proyecto; los demás requieren acceso correspondiente. La decisión se verifica en servidor. | El producto promete curso elegido completo salvo la última clase; los demás son VIP. `docs/CURSO-GRATIS.md` advierte que el webhook actual aún solo libera la clase `isPreview`; el parche de `authorizeLesson` sigue pendiente de autorización/aplicación y prueba. | **Bloqueo funcional importante:** mientras el webhook no implemente y pruebe la regla `users/{uid}.cursoGratis`, la selección guardada no garantiza reproducción de todas las clases prometidas. No tratar el flujo como verificado en producción. |
| Perfil posterior | Élite tiene un recorrido documentado en tres pasos: curso gratis → ficha profesional opcional/directorio → perfil de talentos de 15 reactivos; algunos pasos se pueden saltar y luego se retoman desde Inicio. | Dermalysse tiene tour general (`src/ui/onboarding.ts`), entrevista de necesidades (`/bienvenida`) y encuesta posterior (`/encuestas`); no encontré un equivalente a la secuencia de ficha + test de talentos de Élite, lo cual no implica que deba copiarse. | Decidir qué preguntas realmente necesita Dermalysse para personalizar cursos. Si el dueño quiere ficha o diagnóstico de intereses, diseñarlo con datos mínimos, propósito, consentimiento, retención y salida; no importar talentos/campos pecuarios. |

La bienvenida de Dermalysse pregunta siete cosas breves: relación/perfil profesional, objetivo, áreas de interés, punto de partida, formato preferido, disponibilidad y cómo conoció el club. Con las áreas seleccionadas puede recomendar cursos. **Hallazgo de contenido a corregir antes de dar esa entrevista por lista:** las opciones actuales incluyen “veterinario”, “productor” y “producción”, y la pregunta de áreas dice “áreas o especies” (`src/ui/experiencia.ts`). Eso no concuerda de forma evidente con la audiencia Dermalysse descrita en `docs/FUENTES-Y-ALCANCE.md` y parece vocabulario trasladado de una plataforma pecuaria. No modifiqué la encuesta; hay que validar y adaptar sus opciones a profesionales y estudiantes de dermatología, cosmetología, estética y nutrición, usando categorías reales del catálogo.

### Lectura del flujo Dermalysse hoy

1. Inicio de sesión/creación de cuenta y carga del estado de miembro.
2. Si es cuenta nueva y la entrevista está pendiente, se ofrece `/bienvenida` primero; respuestas y avance se guardan con API cuando está conectado.
3. Para cuenta gratuita sin curso elegido, aparece la elección del curso; se puede posponer o elegir permanentemente. `POST /me/curso-gratis` guarda la elección validada.
4. La interfaz etiqueta el curso elegido y presenta sus candados; sin embargo, en modo producción la emisión de token de video pasa por el webhook legado. El documento `docs/CURSO-GRATIS.md` declara pendiente allí la nueva política de acceso. Esa es la diferencia entre “la elección quedó guardada” y “el curso completo ya funciona gratis”.
5. La entrevista puede activar un beneficio de bienvenida únicamente si la política/campaña y elegibilidad del servidor lo permiten; no debe presentarse como un premio garantizado solo por completar una pantalla.

Hay además una decisión de producto pendiente en el orden/beneficio: si la entrevista otorga la cortesía VIP temporal, `Auth.refrescarEstado()` actualiza `esVip` y el selector de curso gratuito aplica solo a miembros que no sean VIP. En ese caso la elección puede no salir al inicio y quedar pendiente hasta que expire la cortesía. Hay que decidir si la oferta es: (a) días VIP y curso gratis después, (b) un curso gratis desde el primer día, o (c) ambos desde el inicio; no asumir ni anunciar la tercera opción sin validación.

Para llevar Dermalysse a un recorrido comparable en claridad con Élite, la recomendación no es agregar preguntas porque sí. Primero confirmar el orden de los pasos, reducir preguntas a las necesarias para recomendar formación Dermalysse, explicar claramente las condiciones del curso gratis y probar que lo prometido coincide con el control real de acceso del servidor.

## Plan de trabajo propuesto

### Fase 0 — Congelar el mapa y conciliar el estado local

1. Mantener intactos los 14 cambios locales del directorio de experiencias; revisar sus diffs por separado con el propietario antes de incorporarlos.
2. Actualizar handoff, rama/commit, rutas de preview y estado de publicación para reflejar el worktree real; mantener `docs/FUENTES-Y-ALCANCE.md` como autoridad de marca y procedencia.
3. Completar un inventario de flujos por perfil: visitante, miembro gratuito, miembro con acceso y administrador. Marcar cada flujo como demo, API implementada, API verificada en test, o verificada en entorno de prueba.

**Salida para cerrar:** inventario y documentación coherentes con el HEAD vigente; ningún cambio previo perdido o presentado como release.

### Fase 1 — Terminar y probar onboarding + curso gratis

1. Acordar el orden visible: registro/login → elección de curso gratis → entrevista breve (o entrevista antes, por decisión explícita) → perfil opcional. Evitar que dos pantallas de bienvenida compitan o repitan preguntas.
2. Revisar con el propietario las preguntas, recomendaciones, consentimiento, persistencia, posponer/retomar y mensajes de beneficio; entrevistas y promociones deben tener una política de datos clara.
3. Revisar las opciones de la entrevista señaladas arriba y quitar/adaptar términos pecuarios; cada respuesta debe recomendar solo cursos Dermalysse realmente publicados y pertinentes.
4. Resolver la interacción entre cortesía VIP y selección gratis: hacer explícito qué recibe cada miembro gratuito y en qué momento.
5. Completar el soporte en `dermalysse-webhook` para autorizar el curso elegido salvo su última clase, conservando acceso VIP, clases preview, secuencia, expiración y controles actuales. Requiere revisar el repositorio correcto y autorización específica antes de editar/desplegarlo.
6. Añadir pruebas del webhook para cuenta gratuita sin elección, curso elegido, otra materia, última clase, curso no publicado, clase secuencial, miembro VIP, token válido/revocado y reintentos; hacer prueba integrada aislada con cuenta de staging.
7. Confirmar que API `/me`, catálogo, UI y webhook interpretan el mismo id/posición del curso; no exponer IDs de Bunny ni permitir cambiar la elección mediante el cliente.

**Salida para cerrar:** recorrido de registro probado desde sesión nueva hasta reproducción de la última clase gratuita permitida; la clase final y otros cursos siguen protegidos; entrevista alineada con Dermalysse; cortesía/curso gratis coherentes y consentimiento/beneficio activos solo cuando la campaña válida lo autoriza.

### Fase 2 — Cerrar la fuente autoritativa de Retos y Logros

1. Diseñar contrato Dermalysse para entregar respuestas de juegos y consultar estado de XP/racha/logros; no reutilizar endpoints ni colecciones de Élite.
2. Mantener preguntas/respuestas correctas en servidor; el cliente no debe enviar XP, precisión, racha ni premios como hechos confiables.
3. Acreditar XP con transacciones idempotentes por cuenta/actividad/fecha; bloquear respuestas duplicadas, repetición abusiva y cambios de zona horaria/reloj del cliente.
4. Migrar el consumo de `retos.ts`, `logros.ts` y `juegos.ts` al contrato API en modo API, conservando modo demo separado y estado de error honesto.
5. Definir qué puede permanecer local: preferencia de estudio y repetición espaciada podrían ser datos de dispositivo; cualquier progreso que afecte ranking, recompensa, certificado o beneficio debe tener política de sincronización del servidor.

**Salida para cerrar:** tests que prueben idempotencia, carreras concurrentes, acceso, cuenta nueva y error API; el cliente no puede otorgarse puntos modificando localStorage o la petición.

### Fase 3 — Endurecer el contrato de producción

1. Verificar Firebase Auth con revocación, rol admin, membresía, estados gratis/VIP/cortesía/cancelación y registro cerrado usando cuentas de prueba.
2. Validar contra Firebase Emulator las reglas de lectura/escritura y las colecciones existentes + `v2_*`; confirmar que el navegador no escribe campos protegidos.
3. Usar webhook sandbox o entorno de prueba aislado para comprobar checkout, portal, retorno, video firmado, eventos válidos de avance y certificados; cubrir timeout, 4xx/5xx, repetición de webhook e idempotencia.
4. Documentar contratos de API como fuente única (DTO, errores, permisos, propietario del dato, persistencia y compatibilidad); añadir pruebas contrato entre frontend/API.
5. Añadir límites/validación por endpoint y registro operativo sin tokens, datos personales ni secretos; definir alertas y política de retención para las nuevas experiencias.

**Salida para cerrar:** matriz endpoint-permiso-persistencia, suite de emulador, evidencia reproducible de prueba y tratamiento comprobado de fallos. Ninguna prueba contra cobros o cuentas reales.

### Fase 4 — Cerrar administración y comunidad

1. Comprobar que cada acción administrativa visible tenga autorización `requireAdmin` en servidor y registro de quién/cuándo/cambio para operaciones sensibles.
2. Validar formularios, cargas, estados borrador/publicado, borrado, concurrencia y errores de API en cursos, materiales, eventos, avisos, foro y nuevas experiencias.
3. Para el directorio: aprobar aviso de privacidad, finalidades, campos visibles, consentimiento, edición/eliminación, retención, denuncia y moderación antes de habilitar datos reales.
4. Revisar Praxia y otras referencias externas como enlaces/beneficios informativos hasta tener autorización y contrato de integración propios.

**Salida para cerrar:** pruebas API de autorización y validación más aceptación de contenido/privacidad; demo claramente separada de personas reales.

### Fase 5 — Calidad continua y rendimiento

1. Separar CI de publicación: un workflow de verificación debe correr `npm ci`, build/tests del frontend, `api/npm ci`, typecheck y tests API con Node compatible (API exige Node 22+).
2. Mantener un workflow de deploy separado y condicionado; revisar que no se pueda activar accidentalmente con una rama o variable equivocada.
3. Añadir pruebas de navegador para rutas críticas en desktop y móvil: entrar, registro, catálogo, clase, paywall, comunidad, reto, admin, loading/vacío/error/401/403.
4. Optimizar el chunk del club mediante imports por ruta y reducción de imports globales de iconos; establecer un presupuesto de bundle y medirlo tras cada cambio.
5. Revisar accesibilidad de teclado, foco, etiquetas, movimiento reducido, contraste y errores de formularios.

**Salida para cerrar:** CI verde obligatorio, suite E2E reproducible y presupuesto de carga aceptado.

### Fase 6 — Puerta de release (solo cuando el propietario lo solicite)

1. Confirmar cuenta, repositorio remoto, hosting, variables/secretos y dominios exactos.
2. Desplegar primero a preview/staging con usuarios de prueba y sin datos ni cobros reales.
3. Probar los flujos con perfiles gratuito, VIP y administrador; revisar cookies/sesión, CORS, video, Stripe sandbox, certificados y regreso de URLs.
4. Solicitar confirmación para la publicación final y comprobar dominio/recursos después del release.
5. Registrar commit, workflow, fecha, URL y comprobaciones. No deducir una autorización para publicar por haber pedido esta auditoría.

## Decisiones que conviene aprobar antes de implementar Fase 1/2

- ¿El ranking de Retos será global, por cohorte o privado? ¿Qué datos del perfil se muestran?
- ¿Qué actividades otorgan XP y con qué topes? Evitar premiar volumen de clics o respuestas repetidas.
- ¿Las rachas y flashcards se sincronizan entre dispositivos? ¿Qué política de recuperación/reset aplica?
- ¿Qué beneficios de membresía están aprobados y cuáles son solo demostración? No inventar precios, promociones ni días de cortesía.
- ¿El directorio de experiencias será privado, visible para miembros, o público? No publicar perfiles reales hasta aprobación de privacidad y moderación.
- ¿Cuál es el dominio de staging y qué cuentas de prueba se usarán? No colocar credenciales dentro del repositorio.

## Verificación ejecutada en este corte

- `npm run build`: pasó (Vite 8.3.2); quedaron advertencias de chunk grande y dynamic import inefectivo de Lucide.
- `npm test`: 20/20 pasaron.
- `api/npm run typecheck`: pasó.
- `api/npm test`: 214/214 pasaron; usa adaptadores/mocks y no acredita integración con Firebase, Stripe, Bunny o webhook reales.
- La verificación fue local. No se abrió un flujo autenticado remoto ni se inspeccionaron configuraciones privadas.
- No se modificó Élite Pecuario. No se hizo commit, push, cambio de configuración externa ni despliegue.

## Fuentes de código y documentos

**Dermalysse:** `AGENTS.md`; `docs/FUENTES-Y-ALCANCE.md`; `docs/DECISION-ARQUITECTURA.md`; `docs/INTEGRACION-PRODUCCION.md`; `docs/CURSO-GRATIS.md`; `docs/PROMPT-HANDOFF-CLAUDE.md`; `docs/CONTEXTO-TRABAJO-CODEX.md`; `api/README.md`; `api/src/app.ts`; `api/src/config.ts`; `api/src/modulos/cursoGratis.ts`; `api/src/modulos/experiencia.ts`; `src/main.ts`; `src/core/curso-gratis.ts`; `src/ui/anuncio-curso-gratis.ts`; `src/ui/experiencia.ts`; `src/core/experiencia.ts`; `src/core/auth.ts`; `src/ui/onboarding.ts`; `src/core/juegos.ts`; `src/core/logros.ts`; `src/core/remoto.ts`; `.github/workflows/deploy.yml`.

**Referencia de Élite (solo lectura):** `AGENTS.md`; `CLAUDE.md`; `docs/CONTEXTO-MAESTRO.md`; `docs/contrato.md`; `api/src/routes/`; `api/src/lib/`; `api/package.json`; `package.json`.
