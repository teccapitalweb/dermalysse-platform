# Dermalysse Platform

Reconstruccion independiente y unificada del ecosistema digital de Dermalysse.

## Estado

Repositorio local inicializado el 3 de octubre de 2026. Todavia no contiene una implementacion de producto ni esta conectado a servicios reales.

## Objetivo

Unificar en una arquitectura mantenible:

- el sitio publico de Dermalysse;
- el club educativo para miembros;
- la administracion de contenido y miembros;
- las operaciones de servidor necesarias para autenticacion, membresias, video, progreso y certificados.

La experiencia conservara la identidad, el contenido y el modelo de negocio que puedan confirmarse en las fuentes oficiales. No se copiaran marcas, datos ni contenido de Elite Pecuario.

## Fuentes confirmadas

| Funcion | Fuente |
| --- | --- |
| Sitio publico | `teccapitalweb/DERMALYSSE` y `https://www.dermalyssemx.com/` |
| Club | `teccapitalweb/Club-Dermalysse` y `https://club.dermalyssemx.com/` |
| API | `teccapitalweb/dermalysse-webhook` |
| Administracion | `teccapitalweb/admin_club_dermalysse` |
| Referencia tecnica | `teccapitalweb/elite-pecuario`, sin copiar contenido ni datos |

Las copias locales de las fuentes viven fuera de este repositorio, en `../_fuentes/`, para mantener intactos sus historiales.

## Documentacion inicial

- `docs/FUENTES-Y-ALCANCE.md`: inventario, procedencia y exclusiones.
- `docs/DECISION-ARQUITECTURA.md`: arquitectura propuesta y limites de seguridad.

## Limites operativos

Este repositorio no tiene remoto configurado. No se han realizado pushes, despliegues, cambios de DNS ni conexiones a Firebase, Stripe, Bunny o Railway.
