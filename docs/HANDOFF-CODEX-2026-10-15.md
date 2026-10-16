# Relevo para Codex — Dermalysse Platform (15 de octubre de 2026)

Escrito por Claude. Estado de la rama `feat/produccion` (== `origin/main`, en `HEAD f1685bd`).
Todo lo de abajo está **commiteado y desplegado**, salvo lo marcado como PENDIENTE.

## Qué está en vivo

- **API nueva:** servicio Railway `dermalysse-api` (proyecto `incredible-abundance`), en
  `https://dermalysse-api-production.up.railway.app`, modo `firebase`/`firestore` sobre el proyecto real
  `club-dermalysse`. Se despliega con `railway up --service dermalysse-api --detach` desde
  `dermalysse-wt-produccion/api` (ya linkeado). `FIREBASE_SERVICE_ACCOUNT` es una referencia a la del
  webhook; nunca imprimir valores.
- **Club nuevo:** `https://teccapitalweb.github.io/dermalysse-platform/club/` (GitHub Pages por workflow;
  `git push origin feat/produccion:main` lo despliega). Variable de repo `VITE_API_URL` ya apunta a la API.
- **www./club.dermalyssemx.com siguen en los repos VIEJOS** (DERMALYSSE y Club-Dermalysse). El corte de
  dominios no se ha hecho.

## Lo que se construyó en esta tanda (todo en producción)

1. **Las 4 funciones que estaban apagadas ya tienen backend y están encendidas** (`EN_PRODUCCION` todo
   `true` en `src/core/funciones.ts`): recompensas, cupones, experiencia (bienvenida/encuestas) y
   adminGestion (admin completo del club). Arquitectura: `api/src/modulos/*.ts` montados en
   `crearModulos()` de `api/src/app.ts`. Días VIP SOLO por `api/src/services/vip.ts` (extiende la cortesía
   vigente, bitácora `v2_vip_bitacora`, nunca toca `subscription`).
2. **Biblioteca y En vivo** ya traen datos reales (colecciones viejas `pdfs`/`webinars`, sin demos ni fuga
   de enlaces) + 5 materiales editoriales. **45 quizzes** de clase empaquetados + `v2_quiz`.
3. **Recompensas:** progreso calculado en el servidor desde métricas confiables
   (`api/src/adapters/firestore/metricasVip.ts`). Los niveles de historia solo cuentan los del catálogo
   real (`api/content/club/historia-niveles.json`, 10 niveles) para que no se inflen por `PATCH /historia`.
4. **Escoge tu curso gratis** (lo más reciente): anuncio de primera vez para el gratuito; elige UN curso
   (abierto completo salvo su última clase); los demás se cierran; elección PERMANENTE. Ver
   `docs/CURSO-GRATIS.md`.

Verificación: `cd api && npm test` → 210 pasan; en la raíz `npm test` → 20; `npx tsc --noEmit -p .` limpio
en ambos; build con `VITE_API_URL=... npm run build`. Para auditar modo producción en local sin red:
`buildApp` con `MemoryFirestore` + verificador/fetch falsos (ver `api/test/produccion.test.ts`), y para el
cliente, alias de `@firebase/auth|app` a módulos falsos (patrón en `scratchpad/staging`, no versionado).

## PENDIENTE #1 (bloqueante del «curso gratis»): parche del webhook — REQUIERE AUTORIZACIÓN DE MIGUEL

El candado real de reproducción lo decide el **webhook viejo** (`dermalysse-webhook`, compartido con el
club viejo). Hoy solo libera la clase de muestra (`isPreview`). Para que el curso elegido se reproduzca
completo salvo la última clase, hay que aplicar el parche de `authorizeLesson` descrito en
`docs/CURSO-GRATIS.md` (sección «El candado real») y hacer `railway up` del servicio `dermalysse-webhook`.
Es aditivo y compatible (el club viejo no escribe `users.cursoGratis`). **No lo apliques sin el OK expreso
de Miguel**: es un servicio en vivo del club actual. Mientras no se aplique, el curso elegido solo
reproduce su clase de muestra; nada se rompe.

## PENDIENTE #2: decisiones/acciones del propietario (no son código)

- **Recompensas por Modo Historia (honor):** 4 de 5 métricas no se pueden falsear; la de historia la
  reporta el cliente. Decisión abierta: dejarla, quitar «explorador»/«aventurero», o atarla a algo
  verificable.
- **Socio que paga y canjea días:** aparece como «cortesía» (la regla de acceso revisa cortesía antes que
  suscripción). Se dejó igual que el sistema viejo; cambiarlo es decisión suya.
- **Firebase Auth / Bunny:** al decidir el corte, agregar los dominios nuevos en «Authorized domains» de
  Firebase y en el panel de Bunny.
- **Prueba con cuenta real:** Claude no puede escribir contraseñas; la prueba de login real la hace Miguel.

## Reglas de trabajo (no romper)

- Nada de push/deploy/DNS ni cambios a servicios reales (sobre todo el webhook) sin autorización expresa
  de Miguel. Sin secretos en repos, prompts ni reportes.
- Firestore solo vía `FirestorePort`; colecciones nuevas con prefijo `v2_`; campos protegidos en
  `CAMPOS_PROTEGIDOS_USERS` (incluye ya `cursoGratis`). Identidad/VIP/admin los decide el servidor.
- Compatibilidad con lo viejo: al escribir `courses`/`pdfs`/`webinars`/`notifications`/`config`, usar las
  mismas formas del panel admin viejo (merge, sin borrar campos); nunca exponer `videoId`/`bunnyCollectionId`.
