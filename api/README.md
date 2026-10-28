# dermalysse-api

API del Club Dermalysse. Dos modos, elegidos por entorno:

| Modo | Variables | Para qué |
|---|---|---|
| **Desarrollo** (predeterminado) | `AUTH_MODE=dev` + `DATA_MODE=memoria` | Usuario de desarrollo, datos en memoria y fixtures NO productivos. Lo usan las pruebas y la demo. |
| **Producción** | `AUTH_MODE=firebase` + `DATA_MODE=firestore` | Login y membresías reales del proyecto Firebase **`club-dermalysse`** (los mismos usuarios y datos del club actual, sin migración) y el **webhook actual** para Bunny, Stripe, avance y certificados. |

Las combinaciones mixtas se rechazan al arrancar. Diseño y contrato: `docs/INTEGRACION-PRODUCCION.md`.

## Requisitos
- Node 22+ (lo exige `firebase-admin` 14; probado en Node 24). Ejecuta TypeScript con `tsx` (sin paso de build; `tsx` está en devDependencies, así que el servidor debe instalar también las dependencias de desarrollo).

## Comandos
```bash
cd api
npm install            # instala SOLO dentro de api/ (deps fijadas, con lockfile)
npm run typecheck      # tsc --noEmit
npm test               # node --test (runner nativo; sin red: Firestore y webhook falsos)
npm start              # levanta el server en http://localhost:8787
npm run dev            # igual que start, con recarga (tsx watch)
```

## Configuración (por entorno; ver `.env.example`, solo placeholders)
| Variable | Modo | Uso |
|---|---|---|
| `PORT` | ambos | Puerto (default `8787`). |
| `AUTH_MODE` | ambos | `dev` (default) o `firebase`. |
| `DATA_MODE` | ambos | `memoria` (default) o `firestore`. |
| `CORS_ORIGINS` | ambos | Orígenes permitidos, separados por coma. **Obligatorio en producción.** |
| `ACADEMIA_MOSTRAR_BORRADORES` | solo dev | `true` muestra borradores a todos; en producción se rechaza. |
| `FIREBASE_SERVICE_ACCOUNT` | producción | JSON completo de la cuenta de servicio de `club-dermalysse`, en una línea (puede ser la del webhook). Secreto. Debe traer `project_id = club-dermalysse`. |
| `LEGACY_WEBHOOK_URL` | producción | URL base https del webhook actual (`dermalysse-webhook` en Railway), sin ruta. |
| `APP_URL` | producción | URL pública https del club nuevo; Stripe vuelve a `<APP_URL>/#/suscripcion?pago=exito&session_id={CHECKOUT_SESSION_ID}` (cancelar: `?pago=cancelado`; portal: `/#/suscripcion`). |
| `CAMPANA_BIENVENIDA_CODIGO` | producción | Código oficial de la campaña inicial. Se guarda únicamente como variable protegida del servidor; nunca se incluye en el repositorio ni en el bundle web. |
| `LEGACY_WEBHOOK_TIMEOUT_MS` | producción, opcional | Tiempo máximo por llamada al webhook (1000–60000, default 15000). |

El arranque **falla rápido** si falta o es inválida cualquiera de las variables de producción; el mensaje solo nombra variables (nunca imprime valores ni cita el JSON de la cuenta de servicio). `firebase-admin` se inicializa de forma perezosa: en la primera petición, nunca al importar.

## Autenticación
- **dev**: cualquier `Authorization: Bearer <token>` no vacío resuelve `{ uid: 'dev-uid', email: 'dev@local', esVip: true, esAdmin: false }`. Sin token ⇒ **401**.
- **firebase**: `verifyIdToken(token, true)` (con revocación). Token inválido, vencido o revocado ⇒ **401**; falla del servicio ⇒ **500** (nunca un usuario inventado).
  - `esAdmin` = existe `admins/{uid}` (sin custom claims).
  - `esVip`, `plan`, `vence`, `motivoAcceso` = port **literal** de `dermalysse-webhook/access-policy.js` (`src/adapters/firebase/accessPolicy.ts`): cortesía `vigenciaHasta` ⇒ `courtesy`; `active`/`trialing` sin `currentPeriodEnd` o con él en el futuro; `canceled` o `cancelAtPeriodEnd` hasta `currentPeriodEnd` ⇒ `canceling`; si no, `expired`, `past_due` o `none`.
- El cuerpo de la petición **nunca** decide identidad, VIP, admin ni membresía.

## Endpoints
### Comunes
| Método | Ruta | Auth | Desarrollo | Producción (fuente) |
|---|---|---|---|---|
| GET | `/` | no | salud | salud (`authMode`, `dataMode`) |
| GET | `/config` | no | fixture | `{precios:{mensual,anual}, descuentoVIP, contacto, mantenimiento, registroAbierto}` de `config/club` (`precioMes`, `precioAno`; si faltan, 200/1799 como el webhook) y `config/platform` (`maintenance`, `openRegistration`) |
| GET | `/catalogo` | no | fixture | Firestore `courses` publicados (`status='published'`) **y** presentes en `content/club/cursos.json`; clase `n` = `lessons[n-1]` (por posición), `gratis = isPreview`, `duracionMin` de `durationSeconds` (o `dur`). **Nunca** `videoId` ni ids de Bunny |
| GET | `/noticias` | no | fixture | `news` con `status='published'` |
| GET | `/me` | sí | usuario dev | `{uid, email, nombre, esVip, esAdmin, plan, vence, motivoAcceso, perfil}`; si faltan `users/{uid}` o `members/{uid}` los crea con la forma exacta del club actual (403 `registro-cerrado` si `openRegistration=false`) |
| PATCH | `/me/perfil` | sí | memoria | `{nombre, apellido, telefono, ciudad, foto (https), avisos}` ⇒ `users.name, lastname, phone, city, photo, settings.notif_*`; campos protegidos nunca se escriben |
| GET | `/foro`, `/foro/:id` | dev: no · prod: **sí** | memoria | `forum` (orden `createdAt` desc) y `forum/{id}/replies`; `likes` ⇒ `util`/`marcadoUtil`; abrir un tema suma `views`. En producción exige sesión, como las reglas actuales |
| POST | `/foro`, `/foro/:id/respuestas`, `/foro/:id/util` | VIP | memoria | Misma forma actual: `{title, tag, body, authorUid (del token), authorName, createdAt (ms), replyCount, likes}`; responder suma `replyCount` y `lastReplyBy`; útil alterna el arreglo `likes` |
| GET/POST | `/experiencias` | GET no · POST sí | memoria | `v2_experiencias` |
| GET | `/liga` | sí | fixture | `v2_liga/clasificacion` (sin documento ⇒ solo la fila propia) |
| GET/POST | `/quiz/:cursoId/:n` | sí | fixture | `v2_quiz/{cursoId}__{n}` (sin banco ⇒ 404 honesto) |
| GET/PATCH | `/historia` | sí | memoria | `v2_historia/{uid}`. Forma `{completados: string[], puntajes: {[id]: 0–100}, ultimoNivel, actualizado (ISO)}` (la de `src/core/historia.ts`). PATCH valida tipos y tamaño (≤ 300 niveles, ids `^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$`; 400 si no) y fusiona de forma aditiva en transacción: unión de completados, máximo por puntaje, `ultimoNivel` de la fuente más reciente; el avance nunca retrocede |
| — | `/academia…`, `/admin/academia…` | sí / admin | memoria | `v2_academia_progreso`, `v2_academia_intentos`, `v2_academia_revisiones`, `v2_academia_lanzamiento` (contenido: `content/academia`) |

### Solo producción (delegan en el webhook reenviando el `Authorization` del miembro)
| Método | Ruta | Cuerpo | Respuesta | Webhook |
|---|---|---|---|---|
| POST | `/video/token` | `{cursoId, n}` | `{embedUrl, expires, preview, playbackSessionId\|null}`; 403 `{motivo, desbloqueo?}` (de `reason`/`unlockAt`) | `POST /bunny/playback {courseId, lessonId = lessons[n-1].id}` |
| GET | `/progreso` | — | `{[cursoId]: {vistas, porcentaje, ultima, actualizado}}` | lee `users.progress` y `users/{uid}/courseProgress` |
| POST | `/progreso/:cursoId/evento` | `{n, playbackSessionId, positionSeconds, durationSeconds, event}` | `{completada, ratio, vistas, porcentaje}` | `POST /courses/progress` |
| GET | `/certificados` | — | certificados válidos del uid | lee `certificates` where `uid` |
| POST | `/certificados` | `{cursoId}` | certificado (`folio` = `DRML-YYYY-<12 hex>`); 409 si faltan clases | `POST /courses/certificate` |
| GET | `/verificar/:folio` | — (público) | `{valido, folio, nombre, curso, cursoTitulo, emitido}` sin uid ni email | lee `certificates/{code}` (`status='valid'`) |
| POST | `/stripe/checkout` | `{plan: mensual\|anual}` | `{url}` | `POST /create-checkout-session` (conserva `metadata.source='dermalysse'`) |
| POST | `/stripe/portal` | — | `{url}` | `POST /create-portal-session` |
| POST | `/stripe/confirmar` | `{sessionId?}` | `{activa, plan, vence}` | relee `users/{uid}.subscription` (la escribe el webhook de Stripe) |

En producción **no existe** `POST /progreso/:cursoId/vista`: el avance solo lo acredita el webhook con eventos reales del reproductor. Errores del webhook: 4xx se propagan con su estado y mensaje; 5xx, red, tiempo agotado o respuesta ilegible ⇒ **502** `webhook/no-disponible` (sin reenviar detalles internos ni inventar datos).

### Academia
Contenido en `api/content/academia` (catálogo + `<programa>/modulo-NN.json`), leído del disco por `DiskAcademiaContentStore`. Reglas en `src/services/academia.ts`, pruebas en `test/academia.test.ts`. Rutas: `GET /academia`, `GET /academia/progreso`, `GET /academia/:programa/:n`, `POST /academia/:programa/:n/tema`, `GET|POST /academia/:programa/:n/examen`, `GET /admin/academia`, `PATCH|DELETE /admin/academia/:programa/lanzamiento`, `PATCH /admin/academia/:programa/:n`. Códigos: `403 modulo_programado`, `402 requiere_vip`, `403 modulo_bloqueado`, `404 modulo_en_preparacion`, `403 temas_pendientes`, `429 espera_examen`, `409 examen_no_emitido` / `examen_desactualizado`.

## Qué se reutiliza del sistema actual
- **Firebase `club-dermalysse`**: mismas cuentas (Auth) y colecciones `users`, `members`, `admins`, `courses`, `certificates`, `forum`, `news`, `config`. Lo nuevo va en colecciones `v2_*`.
- **Webhook actual** (sin cambios): Bunny (firma), avance con `playbackSessionId` (85 %, tiempo topado, clase previa), certificados `DRML`, Checkout y portal de Stripe. La API lo llama de servidor a servidor, así que su CORS no necesita los dominios nuevos para estas rutas.
- **Regla de acceso** `access-policy.js` (port literal) y la forma de alta de `users`/`members` del `index.html` del club actual.

## Arquitectura
```
src/
  app.ts                 createApp(deps) + buildApp(env, inyecciones) — elige adaptadores por AUTH_MODE/DATA_MODE
  config.ts              leerConfig(env): valida y falla rápido (ErrorConfiguracion)
  server.ts              arranque (sale con código 1 si la configuración no es válida)
  middleware/auth.ts     requireUser / requireAdmin (usa el AuthAdapter)
  routes/                config, catalogo, noticias, foro, me, experiencias, liga, quiz, progreso, certificados,
                         verificar, academia, historia; club.ts = rutas de producción (video, progreso, certificados, verificar, stripe)
  services/              learning, academia, community, experiences, clubProduccion (webhook + Firestore)
  adapters/
    interfaces.ts        puertos
    dev/                 fixtures y memoria
    firebase/            accessPolicy (port literal), firebaseAuth (verifyIdToken + admins + regla)
    firestore/           port.ts (puerto mínimo), admin.ts (firebase-admin perezoso), memoria.ts (falso para pruebas),
                         club.ts (colecciones actuales), v2.ts (experiencias, liga, quiz, historia), academia.ts (v2_academia_*)
    legacy/webhook.ts    cliente del webhook (fetch inyectable, timeout, errores honestos)
content/club/cursos.json catálogo editorial del club nuevo (ids de src/data/catalogo.json, sin videoId)
fixtures/                JSON de ejemplo NO productivos (solo modo dev)
test/                    node --test (dev, producción con Firestore/fetch falsos, regla de acceso, almacenes)
```

## Garantías
- **El cliente no es autoridad:** identidad, VIP, admin y membresía salen del token y de Firestore; el avance y los certificados, del webhook.
- **Campos protegidos** de `users` (`subscription, vigenciaHasta, regaloDesde, stripeCustomerId, stripeSubscriptionId, plan, status, role, admin, courtesy, isCourtesy, progress, playbackProgress`) nunca se escriben (hay prueba).
- **Sin ids de video** en respuestas: los `videoId` de Bunny viven solo en Firestore `courses` y en el webhook (hay prueba).
- **Errores honestos:** validación ⇒ 400, sin sesión ⇒ 401, sin acceso ⇒ 403, inexistente ⇒ 404, webhook caído ⇒ 502. Nunca datos demo en producción (liga, quiz y experiencias arrancan vacíos).
- **Secretos solo por entorno;** `.env.example` solo trae placeholders.
