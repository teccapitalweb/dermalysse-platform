# Prompt de continuidad para Claude

Copia y pega el siguiente bloque en Claude cuando quieras continuar el proyecto.

---

Quiero que continúes trabajando en **Dermalysse Platform** desde el estado actual, sin reconstruir lo que ya está terminado.

## Repositorio definitivo

- Ruta local: `C:/dev/02_CLIENTES/Dermalysse/dermalysse-platform`
- GitHub privado: `https://github.com/teccapitalweb/dermalysse-platform`
- Rama: `main`
- Cuenta propietaria: `teccapitalweb`

Antes de editar:

1. Entra al repositorio definitivo; no trabajes en copias históricas.
2. Ejecuta `git status --short --branch` y conserva cualquier cambio que no hayas creado.
3. Ejecuta `git pull --ff-only` solamente si el árbol está limpio.
4. Lee completos estos archivos:
   - `AGENTS.md`
   - `docs/FUENTES-Y-ALCANCE.md`
   - `docs/DECISION-ARQUITECTURA.md`
   - `docs/CONTEXTO-TRABAJO-CODEX.md`
5. Confirma que la landing abre en `http://127.0.0.1:5192/` y el club en `http://127.0.0.1:5192/club/` cuando el servidor local esté activo.

## Objetivo de producto

Dermalysse debe conservar su identidad editorial propia, mientras que el interior del club debe seguir casi exactamente la estructura, eficiencia, jerarquía, navegación y experiencia de **Élite Pecuario**, adaptadas a Dermalysse.

Referencia técnica de solo lectura:

`C:/dev/02_CLIENTES/VisionPecuaria-Avicola/elite-pecuario`

Puedes comparar arquitectura, shell, páginas, estados, responsive y patrones neutrales. No modifiques ese repositorio y no copies su marca, textos pecuarios, datos, imágenes, credenciales, servicios, Firebase, Stripe ni configuraciones productivas.

## Estado aprobado de la landing

- Mantén la landing actual salvo que el usuario pida un cambio concreto.
- Paleta editorial: crema, vino, rosa mineral y azul tinta.
- Hero: `public/media/dermalysse-hero-selected.png`.
- El hero ya fue compactado: debe verse completo, sin título ni rostro cortados y sin altura excesiva.
- En escritorio, los dos botones principales permanecen en una sola fila.
- Escena de aprendizaje: `public/media/dermalysse-learning-rose.jpg`.
- Esa escena mantiene a la modelo centrada, el título a la izquierda, los cuatro aprendizajes a la derecha y una franja azul superior que aporta profundidad.
- Imagen de papel rasgado: `public/media/dermalysse-paper-rose.jpg`.
- No recuperes tarjetas flotantes arbitrarias, secciones pegajosas con scroll vacío ni espacios gigantes.

## Estado aprobado del club

- El shell sigue el patrón de Élite Pecuario: sidebar, topbar, dashboard, catálogo, materiales, comunidad, retos, herramientas, logros, certificados y recompensas.
- El breakpoint principal del shell es `920px`: sidebar en la ventana de revisión y navegación inferior por debajo de ese ancho.
- Conserva los 12 cursos confirmados de Dermalysse.
- Si no existen materiales, muestra un estado vacío honesto; no inventes recursos.
- Las pantallas demo no demuestran VIP real, pagos, progreso, certificados, descargas ni servicios productivos.
- No conviertas herramientas educativas en diagnóstico o consulta médica.

## Límites obligatorios

- No mezcles Dermalysse con DermaExpo, IPCIL, GlobalVet, Visión Pecuaria ni otros clientes.
- No expongas secretos, `.env`, credenciales, URLs privadas de video ni datos personales.
- No conectes ni modifiques Firebase, Stripe, Bunny, APIs reales, membresías, pagos, DNS o despliegues sin autorización expresa.
- No publiques precios, promociones, testimonios, credenciales profesionales o afirmaciones clínicas sin validación.
- En modo API, un error o una lista vacía debe producir un estado honesto, nunca datos demo silenciosos.
- No hagas cambios globales de Git ni limpiezas destructivas.

## Forma de trabajar

- Haz primero una revisión visual y técnica de la ruta afectada.
- Mantén los cambios pequeños y concentrados en la petición actual.
- Para cambios visuales, revisa escritorio y teléfono.
- Verifica estados de carga, vacío, error y acceso denegado cuando el flujo los use.
- Ejecuta como mínimo:
  - `npm run build`
  - `npm test`
  - `git diff --check`
- Un build exitoso no demuestra autenticación, pagos, descargas, API ni producción; informa esos límites con honestidad.
- Crea commits descriptivos y pequeños.
- Sube a `origin/main` después de verificar cuando el usuario haya pedido que el trabajo quede sincronizado en `teccapitalweb`.
- No despliegues la web por el simple hecho de hacer `push`.

## Comunicación

Habla en español claro. Enseña el resultado local al usuario y explica brevemente qué cambió, qué se comprobó y qué continúa sin verificar. Si la petición visual es ambigua, toma como prioridad las decisiones ya aprobadas en `docs/CONTEXTO-TRABAJO-CODEX.md`.

Empieza confirmando el estado de Git, leyendo los documentos obligatorios y resumiendo en pocas líneas qué parte vas a modificar antes de tocar archivos.

---
