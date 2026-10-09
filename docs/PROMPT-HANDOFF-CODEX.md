# Handoff a Codex · Dermalysse Platform

Actualizado: 9 de octubre de 2026.

Usa `docs/PROMPT-HANDOFF-CLAUDE.md` como handoff operativo completo: contiene el mismo contexto necesario para cualquier agente, no depende de funciones exclusivas de Claude y es la fuente de verdad más reciente.

Antes de trabajar:

1. Abre `C:/dev/02_CLIENTES/Dermalysse/dermalysse-platform`.
2. Ejecuta `git status --short --branch`, `git log --oneline -12` y `gh auth status`.
3. Lee completos `AGENTS.md`, `docs/PROMPT-HANDOFF-CLAUDE.md`, `docs/CONTEXTO-TRABAJO-CODEX.md` y `docs/VERIFICACION-LOCAL.md`.
4. Conserva cambios ajenos y no hagas pull, reset, push o deploy por suposición.
5. Abre la landing y el club local antes de dar algo por hecho.

Estado registrado:

- Último commit funcional: `eac969c`.
- Build correcto y tests 4/4.
- `main` local queda 4 commits por delante de `origin/main` al incluir este handoff.
- El usuario autorizó producción, pero GitHub seguía sin autenticación válida para `teccapitalweb` y el proveedor de hosting no estaba identificado.
- No afirmar despliegue hasta comprobar el dominio productivo.

Reglas esenciales:

- Sin precios, promociones o afirmaciones clínicas no validadas.
- Sin secretos ni datos personales.
- Toda cadena dinámica al DOM pasa por `esc()`.
- Élite Pecuario es sólo referencia de arquitectura y UX.
- Revisión visual en escritorio y teléfono para cambios de interfaz.
- No confundir build local, push y despliegue.
