# Contexto maestro de trabajo · Dermalysse Platform

Última actualización: 9 de octubre de 2026.

## Repositorio definitivo

- Proyecto: `dermalysse-platform`
- Ruta: `C:/dev/02_CLIENTES/Dermalysse/dermalysse-platform`
- Remoto: `https://github.com/teccapitalweb/dermalysse-platform`
- Rama: `main`
- Cuenta propietaria: `teccapitalweb`
- Último commit local funcional: `eac969c feat(plataforma): completa experiencia Dermalysse`
- Estado esperado al incluir este documento: árbol limpio; `main` local 4 commits por delante de `origin/main`.

Este repositorio es independiente. No mezclarlo con DermaExpo, IPCIL, GlobalVet, Visión Pecuaria u otros clientes.

## Referencia permitida

`C:/dev/02_CLIENTES/VisionPecuaria-Avicola/elite-pecuario` es una referencia de arquitectura, eficiencia y experiencia. No se modifica y no se copian su marca, contenido pecuario, datos, activos, servicios, credenciales o configuraciones productivas.

La landing de Dermalysse conserva identidad editorial propia. El interior del club reutiliza patrones neutrales de jerarquía, navegación y responsive, adaptados a Dermalysse.

## Producto y arquitectura

- Landing: `http://127.0.0.1:5192/`.
- Club: `http://127.0.0.1:5192/club/#/`.
- Stack: Vite + TypeScript vanilla.
- Router: hash router en `src/core/router.ts`; rutas registradas en `src/main.ts`.
- Landing: `src/site/`.
- Club: `src/pages/`, `src/core/`, `src/ui/`, `src/styles/`.
- Datos semilla: `src/data/`.
- Assets: `public/`.
- Demo: persistencia local bajo claves `dermalysse:*`; el modo API no debe ocultar errores con datos demo.

## Estado aprobado de la landing

- Dirección editorial crema, vino, rosa mineral y azul tinta.
- Hero compacto con `public/media/dermalysse-hero-selected.png`.
- Imágenes de formación reales en `public/media/`.
- Sección de aprendizaje con seis beneficios alrededor de la modelo y una conclusión profesional responsable.
- Papel rasgado con `public/media/dermalysse-paper-rose.jpg`.
- Mayor riqueza visual mediante retícula, capas, marcadores, principios y microanimación; sin scroll vacío ni ornamentos que tapen contenido.
- Lía funciona como guía virtual local en la landing, cambia de pose, se compacta al desplazarse y orienta sobre cursos, club, clase abierta y Praxia.
- Lía no diagnostica, no inventa precios y no sustituye atención profesional.

Archivos principales: `src/site/render.ts`, `src/site/interactions.ts`, `src/site/assistant.ts`, `src/site/styles/` y `public/media/lia/`.

## Estado aprobado del club

### Shell y navegación

- Sidebar fija en escritorio, topbar y navegación inferior móvil.
- El contenido principal es el único scroll vertical previsto.
- No debe haber scroll horizontal ni scroll separado en el menú lateral.
- Login en pantalla dividida: formularios de acceso/registro y beneficios del club.

### Contenido

- 12 cursos con portadas y flujo de catálogo, detalle, clase, notas y examen.
- Biblioteca con 5 materiales y visor.
- Comunidad estilo Instagram con 6 posts oficiales y aside útil.
- En vivo, perfil, cuenta, configuración, suscripción, onboarding y encuestas disponibles como rutas.

### Retos

- Hero de progreso, foco diario, cuatro modalidades, clasificación y Camino a Maestro.
- Quiz Relámpago, Casos Dermalysse, Flashcards y Modo historia tienen interfaces internas propias.
- Progreso, XP y estados deben derivarse de los motores del proyecto; no de números decorativos desconectados.

### Herramientas y Praxia

- Herramientas activas: Mapa de rutina, Mesa de activos, Canvas de protocolo y Bitácora privada.
- También existen utilidades de campo para consulta guiada, revisión editorial de claims y preparación de cabina.
- Todo se presenta como apoyo educativo, no como diagnóstico o recomendación clínica.
- Praxia se muestra como software de TEC Capital para pacientes, documentos, agenda, recordatorios y reportes.
- La pantalla declara que el beneficio/acceso para miembros requiere confirmación separada.

### Logros y certificados

- Sala de logros con categorías, rarezas, progreso, siguiente meta y opción de sonido.
- El anuncio de logro usa animación, celebración y sonido Web Audio opcional.
- Certificados con galería, muestra, sello, folio y QR verificable.
- El modo demo diferencia explícitamente una vista de muestra de una emisión oficial.

## Controles de contenido y seguridad

- Toda cadena dinámica al DOM pasa por `esc()`.
- No se publican precios, promociones, testimonios, credenciales o afirmaciones clínicas sin validación.
- No se exponen secretos, URLs privadas o datos personales.
- No se presentan herramientas como diagnóstico, prescripción o garantía de resultados.
- Las imágenes del club evitan pacientes reconocibles, sangre, heridas abiertas o agujas penetrando piel.
- Los estados API vacíos o fallidos deben ser honestos.

## Verificación acumulada

Sobre el estado `eac969c`:

- `npm run build`: correcto.
- `npm test`: 4/4.
- `git diff --check`: correcto.
- Landing revisada en escritorio y teléfono, sin overflow horizontal ni errores de consola.
- Revisión visual acumulada de Inicio, Cursos, Materiales, Comunidad, Retos, Herramientas, Praxia, Login, Logros y Certificados.

La compilación local no demuestra autenticación, pagos, membresía, certificados remotos, API productiva, descargas protegidas o publicación.

## Estado de producción

El usuario autorizó llevar el estado actual a producción. Aún no se publicó.

Bloqueos registrados:

- `gh auth status` reporta token inválido para `teccapitalweb`.
- No se encontró configuración visible de GitHub Actions, Vercel, Netlify, Firebase Hosting o Wrangler en el repositorio.
- No está confirmado qué hosting sirve `www.dermalyssemx.com` y `club.dermalyssemx.com` ni si apunta a este repo.

La siguiente persona debe reautenticar la cuenta correcta, identificar el hosting real, volver a verificar, pushear los commits locales y comprobar la URL pública. No debe afirmar “en producción” hasta completar esas pruebas.

## Historial relevante

- `ad838d0`: 17 portadas de cursos y materiales.
- `ff76793`: primer rediseño profesional del hub de Retos.
- `eac969c`: integración amplia de landing, Lía, retos, herramientas, Praxia, login, logros y certificados.

## Flujo recomendado

1. `git status --short --branch` y `git log --oneline -12`.
2. `gh auth status` antes de cualquier operación remota.
3. Leer `AGENTS.md`, este documento y `docs/VERIFICACION-LOCAL.md`.
4. Revisar localmente el área solicitada en escritorio y teléfono.
5. Ejecutar build, tests y `git diff --check`.
6. Crear un commit pequeño y descriptivo.
7. Hacer push/despliegue sólo con la cuenta y hosting confirmados.
