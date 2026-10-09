# Handoff a Codex · Dermalysse Platform

Prompt listo para pegar. Está pensado para una sesión nueva — no asumas memoria previa.

---

## PROMPT

Hola. Vas a continuar el desarrollo del **Club Dermalysse** (plataforma educativa privada para profesionales de dermocosmética y nutrición). Lee este bloque entero antes de hacer cualquier cosa.

### 1 · Ubicación y repo

- Working directory: `C:/dev/02_CLIENTES/Dermalysse/dermalysse-platform`
- Rama de trabajo: `main`
- Remote GitHub: `teccapitalweb/dermalysse-platform`
- La cuenta `teccapitalweb` es la que puede pushear este repo. Antes de `git push` cambia con `gh auth switch -u teccapitalweb`, y al terminar vuelve a la cuenta anterior.
- Antes de tocar nada: `git status`, `git log --oneline -10`, y **lee los `AGENTS.md` / `CLAUDE.md` del repo**. No arrastres reglas de otros clientes.

### 2 · Reglas duras (no se negocian)

- No publicar precios, promociones, testimonios, credenciales profesionales ni afirmaciones clínicas sin validación.
- No exponer secretos, credenciales, URLs privadas de video ni datos personales.
- No hacer push, deploys, cambios DNS ni conexiones a servicios reales sin autorización expresa del usuario.
- No mostrar datos de ejemplo cuando una API falle o entregue respuesta vacía (muestra estado vacío real).
- Imágenes del club: sin rostros reconocibles de pacientes, sin agujas penetrando piel, sin sangre, sin heridas abiertas, sin texto inventado dentro de la imagen.
- Nunca commits con `--no-verify`, nunca `--amend` para corregir hooks, nunca force-push a `main`.
- Toda cadena dinámica que entre al DOM pasa por `esc()` (ver `src/ui/partials.ts`). Los wrappers HTML son fijos; sólo los valores van escapados.

### 3 · Stack

- **Vite + TypeScript vanilla** (sin React / sin frameworks UI).
- **Hash router** propio en `src/core/router.ts` — las rutas se registran en `src/main.ts`.
- Carpetas clave:
  - `src/pages/` — una función por ruta que devuelve HTML string.
  - `src/core/` — datos y motores (`datos`, `catalogo`, `progreso`, `juegos`, `liga`, `comunidad`, `logros`, `perfil`).
  - `src/ui/` — partials y celebración.
  - `src/styles/` — CSS por página.
  - `src/data/` — JSON seeds (`catalogo`, `materiales`, `quizzes-demo`, `casos`, etc.).
  - `public/` — assets servidos (incluye `cursos/`, `materiales/portadas/`, `posts/`, `brand/`).
- Modo demo: estado real guardado en `localStorage` bajo keys `dermalysse:*`. Hay un flag `Datos.modo` para pasar a API.
- Dev server: `.claude/launch.json` ya configurado como `dermalysse` en puerto 5192. **Nunca lo lances con `npm run dev` desde Bash**, usa `preview_start { name: "dermalysse" }`. Si ya corre, sólo navega.

### 4 · Estado actual (hasta el último commit)

Últimos commits en `main`:
```
ff76793 feat(retos): rediseño pro del hub — hero con anillo XP, enfócate hoy, podio y camino visual
ad838d0 feat(portadas): mount 17 Nano Banana covers for cursos and biblioteca
276924d feat(comunidad): make the aside actually useful
52b922f style(comunidad): shrink posts to real Instagram proportions
22f28b1 feat(comunidad): add 6 @dermalysse official photos to the feed
933517e feat(comunidad): seed 5 official @dermalysse posts with verified badge
10b90cb docs: add prompt catalogue for @dermalysse community posts
```

Lo que ya está terminado y funcional:

- **Inicio** con widget de Novedades y continuidad.
- **Cursos** (12 cursos, cada uno con portada 16:9 real en `public/cursos/<id>.jpg`, verificadas). Catálogo + detalle + reproductor con notas.
- **Biblioteca** con 5 materiales base y portadas 3:4 reales en `public/materiales/portadas/`.
- **Comunidad** estilo Instagram: feed con 6 posts oficiales de `@dermalysse` (badge verificado, imágenes en `public/posts/`), aside funcional con perfil + XP + continuar + novedades + en vivo.
- **Retos**: rediseñado como hub pro — hero con anillo SVG de XP, sección "Enfócate hoy" dinámica (3 pasos cortos basados en el estado real: reto diario, flashcards vencidas, casos pendientes…), tiles con progress bar, podio top 3 y Camino a Maestro con rail vertical. Juegos funcionales: Quiz Relámpago (90 preguntas revisadas × 6 áreas), Reto diario, Casos Dermalysse (10 casos revisados), Flashcards con repetición espaciada, Modo historia.
- **Docs**: prompts de Nano Banana para cursos, materiales y posts (`docs/prompts-*.md`).

### 5 · Pendientes razonables (elige con el usuario antes de empezar)

- **Herramientas**: página existe en `src/pages/herramientas.ts` pero conviene revisarla y nivelarla al estándar de Retos/Comunidad.
- **Recompensas** (`src/pages/recompensas.ts`) y **Logros** (`src/pages/logros.ts`): revisar diseño y asegurar que XP, progreso y conteos vienen de `core/progreso.ts` + `core/juegos.ts` (fuente de verdad real, no mock).
- **En vivo** (`src/pages/envivo.ts`): la tarjeta del aside de Comunidad enlaza aquí; comprobar que la página esté a la altura.
- **Admin** (`src/pages/adminCursos.ts` y vecinos): no tocar la lógica salvo que el usuario lo pida; es la puerta a modo API.
- **Thumbnails individuales por clase**: si el usuario quiere portadas por clase (no sólo por curso), hay que ampliar `catalogo.json` con `thumb` por `clase` y actualizar el reproductor.
- **Modo historia**: hoy la ruta `/retos/historia` existe con un mundo. Si el usuario pide más mundos, el patrón está listo en `src/pages/retosHistoria.ts`.
- **Suscripción y Configuración**: páginas que viven en el sidebar; sólo tocar si el usuario lo pide y con autorización para no mostrar precios.

### 6 · Cómo trabajar

- **Antes de editar**, lee el archivo entero relevante. No intentes editar sin haberlo leído.
- Prefiere Edit sobre Write. Nunca crees documentación `.md` nueva salvo que el usuario la pida.
- No agregues comentarios que expliquen el qué (nombres ya lo dicen); sólo comentarios para invariantes no obvios.
- Después de cualquier cambio UI, **verifica en el navegador**:
  1. `preview_start { name: "dermalysse" }` (si no corre).
  2. Navega a la ruta real (recuerda que la app vive en `/club/#/<ruta>`, no en `/#/<ruta>`).
  3. `read_console_messages` para errores, `computer screenshot` para visuales.
  4. Prueba el flujo golden path y al menos un edge case.
- Para type-check: `npx tsc --noEmit`. No cometas si hay errores TS.
- Para servir el dev, el working directory ya es el correcto; no uses `cd`.

### 7 · Convenciones de commit

- Español, imperativo breve, scope entre paréntesis. Ejemplos del repo:
  - `feat(retos): …`
  - `style(comunidad): …`
  - `docs: …`
- Firma de co-autor obligatoria si eres un agente (ajusta a tu identidad):
  ```
  Co-Authored-By: <Modelo> <noreply@example.com>
  ```
- Nunca committees archivos de `.env`, nunca `--no-verify`, nunca pushes a `main` sin confirmación del usuario.

### 8 · Primer movimiento

1. `git log --oneline -10` y `git status`.
2. Abre la app con `preview_start { name: "dermalysse" }` y navega a `http://127.0.0.1:5192/club/#/retos`, luego `/#/cursos`, `/#/materiales`, `/#/comunidad`. Confirma que todo renderiza sin errores en consola (los errores viejos de `comunidad.ts` referidos a `REACTION` o `renderPerfilCard` son de módulos en caché del dev server — no son errores reales de la build actual; un reload duro los limpia).
3. Pregunta al usuario qué sigue antes de hacer cambios grandes. Opciones probables: Herramientas, Recompensas, En vivo, thumbnails por clase, o un ajuste puntual al rediseño de Retos recién publicado.

Trabaja con el mismo tono: respuestas cortas en español, explicando sólo lo útil, y verificando siempre en pantalla antes de dar por hecho que algo funciona.
