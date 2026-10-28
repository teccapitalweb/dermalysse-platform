# Integración a producción · Dermalysse Platform

Decisión del propietario (15 de octubre de 2026): publicar el club nuevo con **login y membresías reales**, usando el mismo proyecto Firebase y los mismos datos que el club actual, para que los miembros entren con sus cuentas de siempre sin migración. Fuentes analizadas (solo lectura): `../_fuentes/Club-Dermalysse`, `../_fuentes/dermalysse-webhook`, `../_fuentes/admin_club_dermalysse`.

## 1. Sistema actual (no se modifica en esta fase)

| Pieza | Repositorio | Hosting |
| --- | --- | --- |
| Sitio `www.dermalyssemx.com` | `teccapitalweb/DERMALYSSE` | GitHub Pages (`main`, raíz) |
| Club `club.dermalyssemx.com` | `teccapitalweb/Club-Dermalysse` | GitHub Pages |
| Backend (Stripe, membresía, Bunny, avance, certificados, congreso) | `teccapitalweb/dermalysse-webhook` | Railway, `https://dermalysse-webhook-production.up.railway.app` |
| Panel admin | `teccapitalweb/admin_club_dermalysse` | Firebase |

- Firebase: proyecto **`club-dermalysse`** (`club-dermalysse.firebaseapp.com`). Login con correo/contraseña y Google. La configuración web es pública por diseño (está en el HTML del club actual).
- **Administrador** = existe el documento `admins/{uid}`. No hay custom claims.
- **Membresía** en `users/{uid}`:
  - `subscription{status, plan ('mensual'|'anual'), currentPeriodEnd (ISO), cancelAtPeriodEnd, stripeCustomerId, stripeSubscriptionId, subscribedAt, …}` — solo la escribe el webhook (Stripe).
  - `vigenciaHasta` (ISO, cortesía) y `regaloDesde` — los escribe el admin.
  - Regla de acceso (copiar tal cual, `dermalysse-webhook/access-policy.js`):
    1. `vigenciaHasta` en el futuro ⇒ acceso (`courtesy`).
    2. `status` `active` o `trialing` ⇒ acceso si no hay `currentPeriodEnd` o si está en el futuro.
    3. `status` `canceled` o `cancelAtPeriodEnd === true`, con `currentPeriodEnd` en el futuro ⇒ acceso (`canceling`).
    4. En otro caso, sin acceso (`past_due` o `none`).
- Perfil en `users/{uid}`: `name, lastname, email, phone, city, bio, photo, settings{notif_*}`. **Campos protegidos** que el cliente nunca escribe: `subscription, vigenciaHasta, regaloDesde, stripeCustomerId, stripeSubscriptionId, plan, status, role, admin, courtesy, isCourtesy, progress, playbackProgress`.
- Alta: el club actual crea `users/{uid}` y `members/{uid}` (`{id, uid, name, email, plan:'Free', status:'active', joined, courses:0}`) al registrarse; el admin lista miembros desde `members`.
- Avance: `users/{uid}.progress{[courseId]: number[]}` = índices **base 1** de clases completadas; detalle en `users/{uid}/courseProgress/{courseId}`. Lo acredita **el webhook** con eventos reales del reproductor (`POST /courses/progress`, 85 % visto, tiempo topado al real, exige la clase anterior). Nunca un botón manual.
- Certificados: `certificates/{code}`, folio `DRML-YYYY-<12 hex>`; los emite el webhook (`POST /courses/certificate`, 409 si falta alguna clase); verificación pública `GET /certificates/:code`. Los QR impresos apuntan a `club.dermalyssemx.com/verify.html?code=…`.
- Foro: `forum/{id}{title, tag, body, authorUid, authorName, createdAt(ms), replyCount, views, likes:uid[], lastReplyBy}` y `forum/{id}/replies/{rid}{text, authorUid, authorName, createdAt(ms), likes}`.
- Contenido del admin: `courses`, `webinars`, `pdfs`, `news`, `notifications`, `atlas`. Configuración: `config/club{precioMes, precioAno}`, `config/platform{maintenance, openRegistration}`.
- Catálogo: 12 cursos y 45 clases, **los mismos ids** que `src/data/catalogo.json`. La clase `n` del club nuevo = `lessons[n-1]` del catálogo actual (ids como `<curso>-s01` o `-s01-02`; mapear **por posición**, nunca por el sufijo). Los `videoId` de Bunny viven solo en el servidor (Firestore `courses`).
- Stripe compartido con otros clubes: todo checkout debe ir por el webhook (conserva `metadata.source='dermalysse'`). El webhook ignora eventos de modo prueba.

## 2. Arquitectura objetivo

- El **webhook actual se conserva** como única pieza que habla con Stripe y Bunny y que acredita avance y certificados.
- La **API nueva** (`api/`) usa Firebase Admin sobre `club-dermalysse`:
  - verifica el ID token en cada petición; `esAdmin` = existe `admins/{uid}`; `esVip` = regla de acceso de arriba;
  - **lee** las colecciones actuales (users, members, courses, certificates, forum, news, config) sin romper sus formas;
  - **escribe** en las actuales solo campos no protegidos (perfil, foro) y lo nuevo en colecciones `v2_*` (Academia, retos, historia, experiencias, revisiones);
  - **delega** al webhook, reenviando el ID token del miembro: firma de video, eventos de avance, emisión de certificados, checkout y portal de Stripe.
- Modo por variables: `AUTH_MODE=dev|firebase`, `DATA_MODE=memoria|firestore`. El modo dev con memoria sigue siendo el predeterminado (pruebas y demo).

## 3. Contrato cliente ↔ API (nuevo o ajustado)

| Método y ruta | Cuerpo | Respuesta | Fuente |
| --- | --- | --- | --- |
| GET `/me` | — | `{uid, email, nombre, esVip, esAdmin, plan ('mensual'\|'anual'\|'cortesia'\|null), vence (ISO\|null), motivoAcceso, perfil}`; si faltan `users/{uid}` o `members/{uid}`, la API los crea con la forma actual | users, admins, members |
| PATCH `/me/perfil` | `{nombre?, apellido?, telefono?, ciudad?, foto?, avisos?}` | perfil | `users` (solo campos no protegidos) |
| GET `/config` | — | `{precios:{mensual, anual}, mantenimiento, registroAbierto}` | `config/club`, `config/platform` |
| GET `/catalogo` | — | cursos publicados con clases `{n, titulo, duracionMin, gratis}`, **sin** `videoId` | Firestore `courses` |
| GET `/progreso` | — | `{[cursoId]: {vistas:number[], porcentaje}}` | `users.progress`, `courseProgress` |
| POST `/video/token` | `{cursoId, n}` | `{embedUrl, expires, preview, playbackSessionId\|null}`; 403 con `{motivo, desbloqueo?}` | webhook `/bunny/playback` |
| POST `/progreso/:cursoId/evento` | `{n, playbackSessionId, positionSeconds, durationSeconds, event: 'timeupdate'\|'pause'\|'ended'}` | `{completada, ratio, vistas:number[], porcentaje}` | webhook `/courses/progress` |
| GET `/certificados` | — | certificados del usuario | `certificates` where `uid` |
| POST `/certificados` | `{cursoId}` | certificado (`folio` = código `DRML-…`) | webhook `/courses/certificate` |
| GET `/verificar/:folio` | — | `{valido, folio, nombre, curso, emitido}` (acepta `DRML-YYYY-XXXXXXXXXXXX`) | `certificates/{code}` |
| POST `/stripe/checkout` | `{plan:'mensual'\|'anual'}` | `{url}` | webhook `/create-checkout-session` |
| POST `/stripe/portal` | — | `{url}` | webhook `/create-portal-session` |
| POST `/stripe/confirmar` | `{sessionId?}` | `{activa, plan, vence}` (relee `users/{uid}.subscription`) | users |
| GET/POST `/foro…` | contrato actual del cliente | | `forum`, `forum/{id}/replies` |
| GET `/noticias` | — | publicadas | `news` |
| `/academia…` | contrato actual | | `v2_academia_progreso`, `v2_academia_intentos`, `v2_academia_revisiones`, `v2_academia_lanzamiento` |
| GET `/historia` | — | `{completados: string[], puntajes: {[idNivel]: 0–100}, ultimoNivel, actualizado}` (vacío si no hay) | `v2_historia/{uid}` |
| PATCH `/historia` | misma forma (campos opcionales) | avance fusionado: unión de completados, máximo de puntajes, `ultimoNivel` de la fuente más reciente; nunca retrocede. 400 si tipos o tamaño inválidos | `v2_historia/{uid}` (transacción) |
| GET `/recompensas` | — | `{recompensas: [{id, nombre, descripcion, icono, progreso, meta, completado, canjeado, canjeadoEn, premio:{duracion, dias}}]}`; reglas y progreso calculados en el servidor | `users.progress` + `courses` publicados, `v2_historia`, `forum` (authorUid), `certificates` (valid), `v2_recompensas/{uid}` |
| POST `/recompensas/:id/canjear` | — | `{ok, hasta, regaloDesde, dias, recompensa}`; 403 `recompensa/incompleta`, 404, 409 `recompensa/canjeada` | transacción: `v2_recompensas/{uid}` + `users.vigenciaHasta/regaloDesde` + `v2_vip_bitacora` |
| GET `/recompensas` (ampliado) | — | además de `recompensas`, entrega `{puntos, boutique, favoritos, atelier, inteligencia, movimientos, canjes, hitos, misiones, niveles, premiosNivel, colecciones, objetivo, vipAnual, proximasFormasDeGanar}`; `puntos.moneda` presenta la moneda como Diamantes Dermalysse y `puntos.recompensaInicial` confirma el Cofre de Bienvenida de 350 diamantes, acreditado una sola vez sin sumar experiencia | `users.progress`, `certificates`, `v2_retos_estado`, `v2_puntos*`, `v2_beneficios` |
| POST `/puntos/misiones/:id/activar` | — | `{ok, mision}`; captura una base de actividad autoritativa, exige el tramo anterior y no otorga puntos al activar | transacción en `v2_puntos/{uid}` |
| PUT `/puntos/objetivo` | `{beneficioId: string\|null}` | `{ok, beneficioId}`; conserva o despeja una meta de ahorro, solo si el beneficio existe, está disponible y no se posee | transacción en `v2_puntos/{uid}` |
| PUT `/puntos/favoritos/:id` | `{activo: boolean}` | `{ok, favoritos}`; guarda o retira una opción de la ruta de deseos, con límite de cinco y validación de disponibilidad/derechos | transacción en `v2_puntos/{uid}` |
| POST `/beneficios/atelier/cotizar` | `{materialIds: string[]}` | `{ok, cotizacion}`; entre 2 y 5 materiales distintos, descuento escalonado de 8/12/16/20 %, precio y saldo calculados por la API | `v2_puntos`, `v2_beneficios`, `pdfs` |
| POST `/beneficios/atelier/canjear` | `{materialIds: string[]}` | `{ok, canje, puntos}`; confirma disponibilidad, propiedad, precio y saldo; entrega todos los materiales permanentemente en la misma transacción | transacción: `v2_puntos`, `v2_puntos_canjes`, `v2_puntos_movimientos`, `v2_beneficios` |
| POST `/puntos/niveles/:id/canjear` | `{beneficioId}` | `{ok, canje, premio}`; una elección sin costo por nivel alcanzado; 403 si está bloqueado, 409 si ya se eligió o la opción no puede entregarse | transacción: `v2_puntos`, `v2_puntos_canjes`, `v2_beneficios` o `users` + `v2_vip_bitacora` |
| POST `/beneficios/:id/canjear` | — | `{ok, canje, puntos}`; admite materiales, VIP y colecciones con precio dinámico solo sobre piezas faltantes; 409 por saldo insuficiente, canje repetido, material no disponible o límite VIP | transacción: `v2_puntos`, `v2_puntos_canjes`, `v2_puntos_movimientos`, `v2_beneficios` y, para días VIP, `users` + `v2_vip_bitacora` |
| POST `/cupones/canjear` | `{codigo}` | `{ok, codigo, dias, hasta, regaloDesde}`; 404 `cupon/no-existe`, 409 `cupon/inactivo`\|`cupon/ya-usado`\|`cupon/agotado`, 410 `cupon/vencido` | transacción: `v2_cupones/{CODIGO}` (+ `canjes/{uid}`) + `users` + `v2_vip_bitacora` |
| GET `/admin/cupones` (admin) | — | `[{codigo, loteId, duracion, dias, maxUsos, usos, activo, creadoEn, venceEn}]` | `v2_cupones` |
| POST `/admin/cupones` (admin) | `{duracion: '15d'\|'1m'\|'3m'\|'1y'\|'personalizada', dias?, modalidad: 'compartido'\|'individuales', cantidad (1–100), idempotencia?, venceEn?}` | 201 `{id, modalidad, cantidad, duracion, dias, codigos, creadoEn}` (misma `idempotencia` ⇒ mismo lote) | `v2_cupones`, `v2_cupones_lotes` |
| PATCH `/admin/cupones/:codigo` (admin) | `{activo: boolean}` | cupón actualizado | `v2_cupones/{CODIGO}` |
| GET `/admin/recompensas/resumen` (admin) | — | circulación, créditos, gastos, canjes y beneficios entregados | `v2_puntos*`, `v2_beneficios` |
| GET `/admin/recompensas/cuentas` y `/:uid` (admin) | — | monederos y libro mayor, sin acreditar por consultar | `users`, `members`, `v2_puntos*` |
| POST `/admin/recompensas/ajustes` (admin) | `{uid, diamantes, motivo, idempotencia}` | saldo y movimiento; idempotente, sin modificar XP | `v2_puntos`, `v2_puntos_movimientos`, `v2_admin_puntos_bitacora` |

Días VIP de recompensas y cupones: solo `api/src/services/vip.ts` (extiende desde la cortesía vigente; nunca toca `subscription`). «1 mes» = 30 días, «1 año» = 365; máximo 366 días por otorgamiento.

Puntos Dermalysse: reglas, costos, niveles, colecciones y controles en `docs/PUNTOS-DERMALYSSE.md`. Los materiales canjeados se autorizan permanentemente en `GET /materiales/:id/acceso`. Historia y foro no generan valor canjeable hasta tener validación autoritativa/antispam.

### Funciones por interruptor en producción

Los interruptores de `src/core/funciones.ts` (`EN_PRODUCCION`) deciden qué se ve en modo API; en demo todo sigue disponible. El 15 de octubre de 2026, por decisión del propietario, las cuatro quedaron **encendidas** porque ya tienen backend propio (cada una con sus pruebas):

| Función | Qué habilita | Backend (módulo en `api/src/modulos/`) |
| --- | --- | --- |
| `recompensas` | `#/recompensas`, menú, «Más», Inicio, botón Canjear | `vip.ts` (`GET /recompensas`, `POST /recompensas/:id/canjear`) |
| `cupones` | canje en `#/suscripcion` y admin de cupones | `vip.ts` (`POST /cupones/canjear`, `/admin/cupones…`) |
| `experiencia` | `#/bienvenida`, `#/encuestas`, redirección de bienvenida, tarjeta de Inicio, resumen en Perfil | `experiencia.ts` (`/me/experiencia…`, entrevista y encuesta) |
| `adminGestion` | todo el admin nuevo (resumen, cursos, miembros+cortesía, Diamantes, avisos, foro, ajustes, cupones, experiencia) además de Academia | `admin.ts` + `contenido.ts` + `vip.ts` + `experiencia.ts` (`/admin/*`) |

Biblioteca y En vivo (`/catalogo`) ya no salen vacías en producción: `contenido.ts` sirve los materiales editoriales + la colección vieja `pdfs`, y los eventos desde `webinars` programados. Los 45 quizzes de clase viven empaquetados y en `v2_quiz`. Días VIP (recompensas, cupones, bienvenida, cortesía del admin) solo por `api/src/services/vip.ts`: extiende desde la cortesía vigente y nunca toca `subscription`.

## 4. Lo que debe aportar el propietario (solo nombres; nunca valores en el repo)

- API nueva (nuevo servicio en Railway): `AUTH_MODE=firebase`, `DATA_MODE=firestore`, `FIREBASE_SERVICE_ACCOUNT` (cuenta de servicio de `club-dermalysse`; puede ser la misma que ya usa el webhook), `CORS_ORIGINS`, `LEGACY_WEBHOOK_URL`, `PORT`.
- Build del cliente: `VITE_API_URL` y `VITE_FIREBASE_*` (valores públicos del club actual).
- Firebase Auth: agregar los dominios nuevos a «Authorized domains».
- Webhook en Railway: agregar los orígenes nuevos a su lista CORS (cambio pequeño en `dermalysse-webhook/index.js`, requiere autorización y redeploy).
- DNS / GitHub Pages: decidir qué repo sirve `www.` y `club.` en el corte.

## 5. Corte (cuando todo lo anterior esté verificado)

1. Desplegar API nueva y cliente en un dominio de prueba; probar con cuenta gratuita, VIP y admin.
2. Mover dominios; redirigir `club.dermalyssemx.com` (incluido `verify.html?code=` → `#/verificar/:code`) y retirar el service worker viejo.
3. Nunca probar Stripe en modo prueba contra producción (el webhook ignora esos eventos).
