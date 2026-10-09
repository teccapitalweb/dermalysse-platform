# Prompt de continuidad para Claude

Actualizado: 9 de octubre de 2026.

Copia y pega desde **PROMPT** en una sesión nueva de Claude. Este archivo refleja el estado local real del proyecto y sustituye cualquier handoff anterior.

---

## PROMPT

Hola. Vas a continuar **Dermalysse Platform**, una landing pública y un club educativo privado para profesionales de dermocosmética y nutrición. No reconstruyas lo que ya está terminado y no asumas que producción está sincronizada.

### 1. Repositorio y primera comprobación

- Working directory: `C:/dev/02_CLIENTES/Dermalysse/dermalysse-platform`
- Rama: `main`
- Remote: `https://github.com/teccapitalweb/dermalysse-platform`
- Cuenta propietaria: `teccapitalweb`
- Último commit local funcional al redactar este handoff: `eac969c feat(plataforma): completa experiencia Dermalysse`
- Estado esperado al incluir este handoff: árbol limpio y `main` local **4 commits por delante** de `origin/main`.

Antes de editar, ejecuta:

```powershell
git status --short --branch
git log --oneline -12
gh auth status
```

Después lee completos:

- `AGENTS.md`
- `docs/FUENTES-Y-ALCANCE.md`
- `docs/DECISION-ARQUITECTURA.md`
- `docs/CONTEXTO-TRABAJO-CODEX.md`
- `docs/VERIFICACION-LOCAL.md`
- `docs/DIRECCION-VISUAL-SOFT-3D.md`

No ejecutes `git pull` ni limpiezas si hay cambios locales. Conserva cualquier cambio ajeno.

### 2. Situación de publicación

El propietario ya pidió llevar el estado actual a producción, pero **todavía no se hizo push ni despliegue**.

Bloqueos conocidos:

- El token guardado de GitHub para `teccapitalweb` aparece inválido en `gh auth status`.
- El repositorio no contiene una configuración visible de GitHub Actions, Vercel, Netlify, Firebase Hosting o Wrangler.
- Las URLs públicas históricas `https://www.dermalyssemx.com/` y `https://club.dermalyssemx.com/` no están confirmadas como destino de este repositorio nuevo.

Para continuar la publicación:

1. Reautentica GitHub con la cuenta exacta `teccapitalweb` y confirma `gh auth status`.
2. Identifica el hosting real y su vínculo con este repo; no asumas que hacer push equivale a desplegar.
3. Ejecuta nuevamente build, tests y revisión visual.
4. Haz `git push origin main` sólo con la cuenta correcta.
5. Despliega usando el mecanismo real confirmado.
6. Verifica la URL productiva, `/club/`, consola, navegación y responsive antes de declarar producción lista.

No documentes ni compartas códigos temporales de autenticación. Si no puedes confirmar hosting o credenciales, detente y reporta el bloqueo con precisión.

### 3. Reglas duras

- No publicar precios, promociones, testimonios, credenciales profesionales ni afirmaciones clínicas sin validación.
- No diagnosticar, prescribir, prometer resultados ni presentar utilidades educativas como consulta médica.
- No exponer `.env`, tokens, credenciales, URLs privadas de video ni datos personales.
- No conectar o modificar Firebase, Stripe, Bunny, pagos, membresías, DNS o servicios reales sin alcance confirmado.
- Cuando una API falle o esté vacía, mostrar un estado honesto; nunca sustituir silenciosamente con demo.
- Imágenes del club: sin rostros reconocibles de pacientes, agujas penetrando piel, sangre o heridas abiertas.
- Toda cadena dinámica que entra al DOM debe pasar por `esc()` de `src/ui/partials.ts`.
- Nunca `--no-verify`, `--amend`, force-push o limpieza destructiva.
- Élite Pecuario es sólo referencia técnica y de UX. No modificarlo ni copiar marca, textos, datos, activos, credenciales o integraciones.

Referencia de solo lectura:

`C:/dev/02_CLIENTES/VisionPecuaria-Avicola/elite-pecuario`

### 4. Stack y estructura

- Vite + TypeScript vanilla; no React.
- Hash router propio: `src/core/router.ts`; registro de rutas en `src/main.ts`.
- Landing pública: `src/site/` y estilos en `src/site/styles/`.
- Club: páginas en `src/pages/`, motores en `src/core/`, componentes en `src/ui/`, estilos en `src/styles/`.
- Datos base: `src/data/*.json`.
- Assets: `public/`.
- Demo local: estado en claves `localStorage` con prefijo `dermalysse:`; `Datos.modo` define demo/API.
- Landing local: `http://127.0.0.1:5192/`.
- Club local: `http://127.0.0.1:5192/club/#/`.
- Login de revisión: `http://127.0.0.1:5192/club/#/login?vista=1`.

Usa el preview ya configurado para `dermalysse` cuando esté disponible. No levantes servidores duplicados.

### 5. Estado visual aprobado de la landing

- Identidad editorial propia: crema, vino, rosa mineral y azul tinta.
- Hero actual con `public/media/dermalysse-hero-selected.png`; composición compacta y sin recortes arbitrarios.
- La modelo y el texto viven lado a lado; no devolver texto gigante dentro de la imagen.
- Tarjetas de formación con imágenes reales en `public/media/`.
- La sección alrededor de la modelo presenta seis beneficios: cursos on demand, biblioteca clínica, herramientas educativas, encuentros en vivo, comunidad profesional, progreso y certificados.
- La conclusión comunica: “Más criterio, orden y confianza profesional”, en tono educativo responsable.
- La escena de papel rasgado usa `public/media/dermalysse-paper-rose.jpg`.
- Se agregaron detalles editoriales, principios, marcadores y microanimaciones sin scroll artificial.
- **Lía**, guía virtual de la landing, está en `src/site/assistant.ts` y `src/site/styles/assistant.css`.
- Assets de Lía: `public/media/lia/lia-{presenta,saluda,piensa,explica,celebra}-v2.png`.
- Lía cambia de pose, conserva conversación breve en localStorage, se compacta al hacer scroll y aclara límites médicos/precios/Praxia.

No agregues más elementos sólo por llenar. Mantén aire, jerarquía, contraste, movimiento sutil y respeto a `prefers-reduced-motion`.

### 6. Estado funcional del club

- Shell inspirado en la eficiencia de Élite Pecuario: sidebar fija en escritorio, topbar, contenido con un solo scroll y navegación inferior móvil.
- No debe existir scroll horizontal ni scroll independiente en el menú lateral.
- Inicio, catálogo, 12 cursos, clases, examen final, 5 materiales, visor, comunidad, en vivo y perfil están montados.
- Comunidad: feed estilo Instagram con 6 posts oficiales, perfil, XP, continuidad, novedades y eventos.
- Retos: hub visual con progreso, foco del día, modalidades, clasificación y Camino a Maestro.
- Juegos internos rediseñados: Quiz Relámpago, Casos Dermalysse, Flashcards y Modo historia.
- Assets de retos: `public/media/retos/*.webp`.
- Herramientas: Mapa de rutina, Mesa de activos, Canvas de protocolo y Bitácora privada, más utilidades de práctica profesional. Son educativas, locales y no diagnósticas.
- Praxia: página `#/praxia` con capturas en `public/praxia/`; el acceso/beneficio para miembros está sujeto a confirmación y no se activa automáticamente.
- Login: diseño dividido entre acceso/registro y beneficios de la membresía; la variante `?vista=1` permite revisarlo sin autenticarse.
- Logros: sala visual, rarezas, progreso, próxima meta y anuncio tipo consola con sonido opcional generado por Web Audio.
- Certificados: galería, vista de muestra, sello institucional, folio y QR. En demo debe quedar claro que no es una emisión oficial.
- Recompensas y En vivo existen; cualquier flujo real depende de datos/API válidos.

Rutas importantes:

```text
/club/#/
/club/#/cursos
/club/#/materiales
/club/#/comunidad
/club/#/retos
/club/#/retos/historia
/club/#/herramientas
/club/#/praxia
/club/#/logros
/club/#/certificados
/club/#/recompensas
/club/#/en-vivo
/club/#/login?vista=1
```

### 7. Archivos clave

- Landing: `src/site/render.ts`, `src/site/interactions.ts`, `src/site/assistant.ts`, `src/site/styles/*.css`.
- Shell y rutas: `src/main.ts`, `src/core/router.ts`, `src/ui/shell.ts`.
- Retos: `src/pages/retos.ts`, `src/pages/historia.ts`, `src/styles/arcade.css`, `src/styles/historia.css`.
- Herramientas/Praxia: `src/pages/herramientas.ts`, `src/pages/praxia.ts`, `src/styles/herramientas.css`.
- Logros/certificados: `src/core/logros.ts`, `src/pages/logros.ts`, `src/pages/certificados.ts`, `src/ui/logro-desbloqueado.ts`, `src/styles/logros.css`, `src/styles/certificado.css`.
- Login: `src/pages/login.ts`, `src/styles/login.css`.
- Datos y seguridad de render: `src/core/datos.ts`, `src/ui/partials.ts`.

### 8. Validación conocida

En el estado de `eac969c`:

- `npm run build`: correcto.
- `npm test`: 4/4 pruebas aprobadas.
- `git diff --check`: correcto; sólo avisos de conversión CRLF cuando aplican.
- Revisión visual reciente de la landing en escritorio y teléfono: sin overflow horizontal ni errores de consola.
- Revisión visual acumulada del club: rutas principales, retos, herramientas, Praxia, login, logros y certificados.

Esto no demuestra autenticación, pagos, membresía, certificados remotos, descargas privadas, API productiva ni despliegue.

### 9. Forma de trabajar

1. Lee entero el archivo que vayas a modificar.
2. Cambia únicamente el área solicitada y conserva decisiones ya aprobadas.
3. Revisa escritorio y teléfono para cualquier cambio visual.
4. Prueba carga, vacío, error y acceso denegado cuando correspondan.
5. Ejecuta:

```powershell
npm run build
npm test
git diff --check
```

6. Revisa la ruta real en pantalla y la consola.
7. Crea commits descriptivos y pequeños, sin reescribir historia.
8. Explica en español qué cambió, qué verificaste y qué no quedó demostrado.

Tu primer movimiento debe ser confirmar Git/GitHub, abrir la landing y `#/retos`, y resumir en pocas líneas el estado observado antes de tocar archivos.

---
