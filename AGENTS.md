# Dermalysse · instrucciones del repositorio

Este es el repositorio independiente para reconstruir y unificar Dermalysse.

## Antes de cambiar archivos

1. Lee `docs/FUENTES-Y-ALCANCE.md` y `docs/DECISION-ARQUITECTURA.md`.
2. Ejecuta `git status --short --branch` y conserva cambios ajenos.
3. Las copias bajo `../_fuentes/` son referencias de solo lectura. Nunca se editan ni se incorporan con su historial Git.
4. Elite Pecuario es referencia de arquitectura y calidad, no una fuente de contenido, marca, datos ni activos.

## Reglas no negociables

- La marca oficial se escribe **Dermalysse** salvo que el propietario decida otra cosa.
- No mezclar este proyecto con DermaExpo, Vision Pecuaria, GlobalVet, IPCIL u otros clientes.
- No mostrar datos de ejemplo cuando una API falle o entregue una respuesta vacia.
- No exponer secretos, credenciales, URLs privadas de video ni datos personales.
- Membresias, pagos, progreso, certificados y administracion deben validarse en una API autenticada.
- No diagnosticar, prometer resultados ni presentar herramientas educativas como consulta medica.
- Precios, promociones, testimonios, credenciales profesionales y afirmaciones clinicas requieren validacion antes de publicarse.
- No hacer push, despliegues, cambios DNS ni conexiones a servicios reales sin autorizacion expresa.

## Verificacion esperada

Cuando exista implementacion:

- build y pruebas del frontend;
- check y pruebas de la API;
- revision en telefono y escritorio de todo cambio visual;
- comprobacion de estados de carga, vacio, error y acceso denegado;
- resumen de procedencia del contenido migrado y estado de Git.
