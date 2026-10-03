# Fuentes y alcance confirmado

Fecha de inventario: 3 de octubre de 2026.

## Identidad

La marca encontrada en dominios, repositorios y logotipo se escribe **Dermalysse**. La propuesta publica se presenta como `The Skin Edit` y `The Beauty Knowledge Club`, con una identidad editorial en crema, vino, azul y tonos naturales.

## Fuentes oficiales confirmadas

### Sitio publico

- Dominio: `https://www.dermalyssemx.com/`
- Repositorio: `https://github.com/teccapitalweb/DERMALYSSE`
- Revision local: `c61ded1`
- Aporta: identidad, logo, direccion editorial, manifiesto, cuatro cursos destacados, video de introduccion y llamadas a registro.

### Club

- Dominio: `https://club.dermalyssemx.com/`
- Repositorio: `https://github.com/teccapitalweb/Club-Dermalysse`
- Revision local: `8ffcb40`
- Aporta: autenticacion, navegacion del miembro, catalogo, clase, progreso, webinars, PDFs, noticias, foro, perfil, suscripcion, logros, ruta, beneficios y herramientas educativas.
- El JSON versionado contiene 12 cursos publicados y funciona como respaldo; el contenido real puede diferir porque el club tambien consulta Firestore.

### Backend

- Repositorio: `https://github.com/teccapitalweb/dermalysse-webhook`
- Revision local: `bcc8c1c`
- Aporta: Stripe, verificacion de Firebase, membresia, Bunny Stream, progreso, certificados y funciones adicionales de congreso.
- No se copiara ningun secreto ni configuracion de produccion.

### Administracion

- Repositorio: `https://github.com/teccapitalweb/admin_club_dermalysse`
- Revision local: `a6eb520`
- Aporta: gestion de cursos, webinars, PDFs, noticias, miembros, notificaciones, atlas, configuracion y operacion de congreso.
- La nueva arquitectura no permitira que el cliente sea la autoridad final de operaciones sensibles.

## Negocio observado

Dermalysse ofrece una experiencia educativa para profesionales y personas adultas interesadas en dermatologia, cosmetologia y estetica. La accion principal del sitio publico es crear una cuenta y entrar al club. El ecosistema incluye cursos bajo demanda, clases iniciales abiertas, materiales, encuentros en vivo, comunidad, progreso y certificados.

Esta descripcion procede de las fuentes oficiales. No valida por si sola precios, promociones, resultados, credenciales profesionales ni afirmaciones clinicas.

## Contenido migrable con procedencia

- Logo e identidad: sitio publico y club.
- Manifiesto y tono editorial: sitio publico.
- Nombres, descripciones y estructura de cursos: catalogo versionado del club y backend, sujetos a conciliacion.
- Reglas de acceso, progreso y certificados: backend y sus pruebas.
- Modulos y flujos administrativos: panel actual, redisenados con controles de servidor.
- Avisos legales existentes: club actual, solo como borrador para revision legal; no se asumiran aprobados.

## Elementos que requieren confirmacion o revision

- Precio mensual y anual, promociones y descuentos.
- Testimonios y autorizacion para publicarlos.
- Numero real de cursos, webinars y materiales disponibles.
- Identidad y credenciales de instructores.
- Vigencia y licencia de fotografias, videos, PDFs y temarios.
- Afirmaciones dermatologicas, protocolos, compatibilidad de activos y contenido del atlas.
- Alcance permanente del congreso dentro de esta plataforma.
- Texto definitivo de privacidad, terminos, derechos ARCO y conservacion de datos.

## Fuentes excluidas

- `C:/dev/02_CLIENTES/DermaExpo/vr-dermaexpo`: experiencia VR de otro proyecto.
- Elite Pecuario: referencia tecnica solamente.
- IPCIL: el logo de Dermalysse aparece entre materiales institucionales, pero IPCIL no es fuente funcional del producto.
- Activos promocionales de Teccapital: evidencia de relacion comercial, no fuente principal de producto.
- Dermaliss, Dermalise y otras marcas encontradas en internet con ortografia distinta.

## Ubicaciones locales

- Proyecto nuevo: `C:/dev/02_CLIENTES/Dermalysse/dermalysse-platform`
- Fuentes de solo lectura: `C:/dev/02_CLIENTES/Dermalysse/_fuentes`
- Referencia tecnica: `C:/dev/02_CLIENTES/VisionPecuaria-Avicola/elite-pecuario`

No existe remoto para el proyecto nuevo y no se ha realizado ningun despliegue.
