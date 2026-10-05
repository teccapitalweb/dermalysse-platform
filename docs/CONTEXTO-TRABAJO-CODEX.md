# Contexto de trabajo: Dermalysse Platform

Ultima actualizacion: 5 de octubre de 2026.

## Repositorio definitivo

- Proyecto: `dermalysse-platform`
- Ruta local: `C:/dev/02_CLIENTES/Dermalysse/dermalysse-platform`
- Remoto: `https://github.com/teccapitalweb/dermalysse-platform`
- Visibilidad: privada
- Rama principal: `main`
- Ultimo commit funcional antes de este documento: `441fe92`

Este repositorio es independiente. No se debe mezclar con DermaExpo, IPCIL, GlobalVet ni otros clientes.

## Referencia permitida

`C:/dev/02_CLIENTES/VisionPecuaria-Avicola/elite-pecuario` se usa solamente como referencia tecnica y de experiencia de usuario. No se modifica, no se copian sus datos pecuarios, marca, credenciales, servicios ni activos propios.

La landing de Dermalysse conserva identidad editorial propia. El interior del club adopta la estructura modular, jerarquia, navegacion y comportamiento responsive de Elite Pecuario, adaptados a la marca y contenido de Dermalysse.

## Estado local

- Landing: `http://127.0.0.1:5192/`
- Club: `http://127.0.0.1:5192/club/`
- El servidor local se ejecuta con Vite.
- La landing y el club son entradas independientes.

## Trabajo realizado

### Landing

- Se construyo una direccion editorial en crema, vino, rosa mineral y azul tinta.
- La portada usa `public/media/dermalysse-hero-selected.png`.
- El hero fue compactado para evitar recortes y exceso de altura.
- Los botones principales permanecen en una sola fila en escritorio.
- La seccion de aprendizaje usa `public/media/dermalysse-learning-rose.jpg` con la modelo centrada, titulo a la izquierda, aprendizajes a la derecha y una capa superior azul para dar profundidad.
- La seccion de papel rasgado usa `public/media/dermalysse-paper-rose.jpg`.
- Se eliminaron elementos flotantes arbitrarios y espacios de scroll artificiales.

### Club

- Mantiene el shell de escritorio inspirado en Elite Pecuario: sidebar, topbar, dashboard, catalogo, materiales, comunidad, retos, herramientas, logros, certificados y recompensas.
- El breakpoint principal del shell se ajusto a `920px` para conservar el sidebar en la ventana local de revision y usar navegacion inferior en pantallas menores.
- El catalogo conserva los 12 cursos confirmados de Dermalysse.
- La biblioteca muestra un estado vacio honesto cuando no existen materiales publicados.
- Los modos demo no representan membresia VIP, pagos, progreso ni certificados reales.

## Verificacion acumulada

- `npm run build`: correcto.
- `npm test`: 4 de 4 pruebas aprobadas.
- Revision visual realizada en la landing, Inicio del club, Cursos y Materiales.
- El arbol de trabajo estaba limpio al conectar el remoto.
- `main` local y `origin/main` quedaron sincronizadas en `441fe92`.

La compilacion local no demuestra autenticacion real, pagos, video protegido, descargas remotas, API productiva ni despliegue.

## Historial visual relevante

- `01808dd`: reconstruccion editorial de la landing.
- `48df40f`: profundidad por capas en la escena de aprendizaje.
- `f9dce69`: mayor respiracion en la landing.
- `9509822`: alineacion a una reticula editorial consistente.
- `91c6a6d`: recuperacion de la composicion de aprendizaje alrededor de la modelo.
- `d82bae1`: compactacion del hero.
- `441fe92`: shell de escritorio del club alineado con Elite Pecuario.

## Limites y pendientes

- No desplegar, cambiar DNS ni conectar Firebase, Stripe, Bunny u otros servicios reales sin autorizacion expresa.
- No publicar precios, promociones, testimonios, credenciales profesionales o afirmaciones clinicas sin validacion.
- No inventar materiales cuando la API o el catalogo esten vacios.
- Antes de publicar cambios visuales importantes, revisar escritorio y telefono.
- Antes de declarar listo un flujo protegido, probar carga, vacio, error, acceso denegado y autenticacion real.
- Continuar trabajando sobre este repositorio y conservar la landing actual salvo que el propietario pida cambios concretos.

## Flujo recomendado para continuar

1. Confirmar `git status --short --branch`.
2. Ejecutar y revisar localmente el area solicitada.
3. Mantener marca y datos de Dermalysse aunque se reutilicen patrones neutrales de Elite Pecuario.
4. Ejecutar `npm run build` y `npm test`.
5. Revisar visualmente la ruta modificada.
6. Crear un commit pequeno y descriptivo.
7. Subir a `origin/main` solo cuando el propietario lo autorice o lo solicite.
