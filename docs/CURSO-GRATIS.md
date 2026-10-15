# Metodología «Escoge tu curso gratis»

Decisión del propietario (15 de octubre de 2026): al entrar por primera vez, el miembro **gratuito** ve
un anuncio que lo invita a **escoger un curso gratis**. Ese curso queda abierto **completo salvo su
última clase** (la última pide VIP); **los demás cursos se cierran** (solo VIP). La elección es
**permanente** (solo se abre todo haciéndose VIP). El VIP/admin ve todo y no ve el anuncio.

Reemplaza el modelo anterior («la primera clase de cada curso es gratis»).

## Dónde vive

- **Dato:** `users/{uid}.cursoGratis` (id del curso) y `users/{uid}.cursoGratisDesde` (ISO). Campos
  **protegidos**: el cliente nunca los escribe por `PATCH /me/perfil`.
- **API nueva** (`api/`):
  - `POST /me/curso-gratis { cursoId }` → `{ cursoGratis }`. Solo gratuito (VIP → 403), curso publicado
    (si no → 404), y **una sola vez** (segunda vez → 409 con el curso ya elegido). `api/src/modulos/cursoGratis.ts`.
  - `GET /me` incluye `cursoGratis` (null si es VIP o no ha elegido).
- **Cliente** (`src/`): `src/core/curso-gratis.ts` (reglas), `src/ui/anuncio-curso-gratis.ts` (anuncio +
  confirmación), `src/core/acceso.ts` (el candado de clases pasa por aquí), tarjetas y página de curso.
  En **demo** la elección se simula en `localStorage['dermalysse:curso-gratis']`.

## El candado real: cambio en el webhook (pendiente de autorización)

El token de video lo emite el **webhook actual** (`dermalysse-webhook`, compartido con el club viejo).
Hoy solo libera la clase de muestra (`isPreview`). Para que el curso elegido se vea completo salvo la
última clase, hay que enseñarle a `authorizeLesson` a liberar las clases del curso elegido para un
gratuito. Es **aditivo y compatible**: el club viejo no escribe `cursoGratis`, así que su comportamiento
no cambia.

Parche en `dermalysse-webhook/index.js`, dentro de `authorizeLesson`, **reemplazando** el bloque:

```js
  if (!memberAccess.allowed) {
    return { allowed: false, reason: 'membership_required', isAdmin, userData, progressAllowed: false, releaseAccess };
  }
```

por:

```js
  if (!memberAccess.allowed) {
    // Metodología «curso gratis»: el gratuito abre su curso elegido salvo la última clase.
    const lessons = Array.isArray(course.lessons) ? course.lessons : [];
    const esUltima = lessons.length > 0 && String(lessons[lessons.length - 1].id || '') === String(lesson.id || '');
    if (userData.cursoGratis && String(userData.cursoGratis) === String(course.id) && !esUltima) {
      return { allowed: true, reason: 'curso_gratis', isAdmin, userData, progressAllowed: true, releaseAccess };
    }
    return { allowed: false, reason: 'membership_required', isAdmin, userData, progressAllowed: false, releaseAccess };
  }
```

La secuencia (`lessonSequenceAccess`) sigue aplicando: el gratuito ve la clase 1 (muestra), y al
completarla se abre la 2, etc., hasta la penúltima; la última pide VIP. Despliegue: `railway up` del
servicio `dermalysse-webhook` (proyecto `incredible-abundance`). Mientras no se aplique, el curso elegido
solo reproduce su clase de muestra (comportamiento actual); nada se rompe.

## Prueba

- API: `api/test/curso-gratis-modulo.test.ts` (elección única, permanente, VIP no elige, campo protegido,
  reglas `esUltimaClase`/`claseGratisPorEleccion`).
- Cliente: verificado en demo (anuncio, elección, confirmación permanente, curso elegido abierto salvo la
  última clase, demás cerrados, VIP sin anuncio, posponer + elegir desde la página del curso, móvil y
  modo oscuro).
