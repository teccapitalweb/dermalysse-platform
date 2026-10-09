# Verificación local

Última actualización: 9 de octubre de 2026.

## Estado verificado

Base verificada: `eac969c feat(plataforma): completa experiencia Dermalysse`.

- `npm run build`: correcto.
- `npm test`: 4 de 4 pruebas aprobadas.
- `git diff --check`: correcto; pueden aparecer avisos informativos de CRLF en Windows.
- Revisión de secretos: no se encontraron secretos incrustados; sólo referencias esperadas a variables/configuración.
- Landing en escritorio: sin overflow horizontal y sin errores de consola durante la revisión reciente.
- Landing en teléfono: composición responsive, Lía compacta y sin overflow horizontal.
- Club revisado acumulativamente en Inicio, Cursos, Materiales, Comunidad, Retos, Herramientas, Praxia, Login, Logros y Certificados.
- Se verificó que el menú lateral no dependa de un scroll propio y que el contenido sea el scroll principal.

## Direcciones locales

- Landing: `http://127.0.0.1:5192/`.
- Club: `http://127.0.0.1:5192/club/#/`.
- Retos: `http://127.0.0.1:5192/club/#/retos`.
- Herramientas: `http://127.0.0.1:5192/club/#/herramientas`.
- Praxia: `http://127.0.0.1:5192/club/#/praxia`.
- Login de revisión: `http://127.0.0.1:5192/club/#/login?vista=1`.
- Logros: `http://127.0.0.1:5192/club/#/logros`.
- Certificados: `http://127.0.0.1:5192/club/#/certificados`.

## Alcance de esta verificación

La prueba confirma compilación, contenido base, navegación local y presentación visual revisada. No confirma:

- autenticación productiva;
- pagos o membresía real;
- APIs remotas;
- video o descargas protegidas;
- emisión real de certificados;
- sincronización con GitHub;
- despliegue o DNS productivo.

Las funciones demo y la persistencia local no deben describirse como integraciones productivas.

## Estado remoto y producción

- Al incluir esta documentación, `main` local queda 4 commits por delante de `origin/main`.
- No se había realizado push del commit `eac969c`.
- `gh auth status` reportaba token inválido para `teccapitalweb`.
- No había configuración visible de hosting dentro del repositorio.
- La autorización del usuario para publicar existe, pero falta reautenticar, confirmar el hosting, pushear y verificar la URL final.

## Checklist antes de producción

1. Confirmar árbol limpio y revisar los commits pendientes.
2. Reautenticar `teccapitalweb` y confirmar el remote exacto.
3. Identificar el proveedor y proyecto de hosting real.
4. Ejecutar `npm run build`, `npm test` y `git diff --check`.
5. Revisar landing y club en escritorio y teléfono.
6. Probar rutas 404, login, estados vacíos, error y acceso denegado aplicables.
7. Hacer push sin reescribir `main`.
8. Desplegar por el mecanismo confirmado.
9. Verificar dominio, `/club/`, assets, consola y navegación productiva.
10. Registrar commit publicado, URL, fecha y resultado en este archivo.
