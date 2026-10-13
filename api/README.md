# dermalysse-api

API del Club Dermalysse — **slice de etapa 4** de `docs/DECISION-ARQUITECTURA.md`: contrato + adaptadores + **datos de fixture NO productivos** + pruebas. Aditivo al repo; **no modifica el cliente** (`src/`).

> Sin Stripe, Bunny, Firebase ni Firestore reales. Esas integraciones son **seams** (interfaces + stubs que lanzan `NotImplemented`). Los secretos solo viajan por entorno del servidor; nunca en Git.

## Requisitos
- Node 20+ (probado en Node 24). Ejecuta TypeScript con `tsx` (sin paso de build).

## Comandos
```bash
cd api
npm install            # instala SOLO dentro de api/ (deps fijadas, con lockfile)
npm run typecheck      # tsc --noEmit
npm test               # node --test (runner nativo)
npm start              # levanta el server en http://localhost:8787
npm run dev            # igual que start, con recarga (tsx watch)
```

## Configuración (por entorno; ver `.env.example`, solo placeholders)
- `PORT` — puerto local (default `8787`).
- `AUTH_MODE` — `dev` (default) o `firebase`.
- `CORS_ORIGINS` — orígenes permitidos en desarrollo, separados por coma. Los dominios de producción se deciden después.

## Autenticación
- **dev** (default): `requireUser` acepta cualquier `Authorization: Bearer <token>` no vacío y resuelve un usuario de desarrollo `{ uid: 'dev-uid', email: 'dev@local', esVip: true, esAdmin: false }`. Sin token o sin `Bearer` ⇒ **401**. El cuerpo de la petición **nunca** decide identidad/VIP/admin.
- **firebase** (`AUTH_MODE=firebase`): `FirebaseAuthAdapter` es un **seam no implementado**; lanza `NotImplemented` (⇒ 501). Para implementarlo se necesita un service account de Firebase provisto por entorno (`FIREBASE_SERVICE_ACCOUNT`) y verificar el ID token con `firebase-admin`. **Fuera del alcance de este slice.**

## Endpoints del slice
| Método | Ruta | Auth | Propósito |
|---|---|---|---|
| GET | `/` | no | Salud/meta del servicio. |
| GET | `/config` | no | `{ precios:{mensual,anual}, descuentoVIP, contacto:{whatsappSoporte?,canalWhatsApp?} }`. |
| GET | `/catalogo` | no | `CatalogoRemoto` (cursos+clases, sin URLs premium). |
| GET | `/noticias` | no | `{ noticias: [] }`. |
| GET | `/foro` | no | Listado de hilos (`respuestas` = conteo). |
| GET | `/foro/:id` | no | `{ hilo, respuestas[] }`; 404 honesto si no existe. |
| GET | `/me` | **sí** | `{ uid,email,esVip,esAdmin,plan,vence,perfil }` del usuario resuelto por el servidor. |
| GET | `/experiencias` | no | Lista filtrable por `?categoria=&q=` (orden fecha desc). |
| POST | `/experiencias` | **sí** | Crea; el servidor asigna `id/fecha/autor` y valida (título 4–100, texto 20–900, categoría válida). 400 honesto si falla. |

Las formas replican lo que el cliente ya espera (ver `src/core/auth.ts`, `remoto.ts`, `comunidad.ts`, `directorio-experiencias.ts`).

## Arquitectura
```
src/
  app.ts            Ensambla Express (CORS dev, rutas, manejo de errores honesto) + buildApp()
  server.ts         Arranque local (puerto por env)
  middleware/auth.ts requireUser / requireAdmin (usa el AuthAdapter)
  routes/           config, catalogo, noticias, foro, me, experiencias
  services/         experiences (validación en servidor)
  adapters/
    interfaces.ts   Puertos: AuthAdapter, ContentStore, ExperienceStore + NotImplementedError
    dev/            Adaptadores dev: fixtureContent, memoryExperiences, devAuth
    stubs/          Seams reales no implementados: firebaseAuth, stripe, bunny
  domain/types.ts   Tipos del contrato
fixtures/           JSON de ejemplo NO productivos (catalogo, noticias, foro)
test/               Pruebas con node --test
```

## Garantías de seguridad del slice
- **El cliente no es autoridad:** VIP/admin/identidad provienen del `AuthAdapter`, nunca del cuerpo de la petición (hay prueba que lo verifica).
- **Errores honestos:** validación ⇒ 400, seam no implementado ⇒ 501, fallo interno ⇒ 500. Nunca se inventan datos demo para enmascarar un fallo.
- **Entrada validada en servidor** en `POST /experiencias`.
- **Secretos solo por entorno;** `.env.example` solo trae placeholders.
- **CORS** restringido a orígenes de la allowlist (dev).

## Pendiente (decisiones del líder)
Hosting del API, almacén de datos (p. ej. Firestore), Stripe (test/real), dominios de prod/CORS, Bunny para `/video/token`, y el resto del contrato que el cliente ya invoca (quiz corregido en servidor, progreso/certificados, admin de escritura, pagos). Ver propuesta DERM-005.
