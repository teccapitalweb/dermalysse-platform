# Dermalysse Platform

Reconstrucción independiente y unificada del ecosistema digital de Dermalysse.

## Estado

Primera base visual implementada y verificada localmente el 3 de octubre de 2026:

- landing editorial responsive;
- primera experiencia interna del club en modo local;
- contenido confirmado de las fuentes oficiales;
- cuatro rutas formativas destacadas;
- explorador interactivo del club;
- vista previa de clase y navegación móvil accesibles;
- sin cuentas, pagos ni servicios productivos conectados.

## Uso local

```powershell
npm install
npm run dev
```

Rutas locales:

- `/`: portada editorial.
- `/club.html`: interior del club en modo local.

Comandos de validación:

```powershell
npm test
npm run build
```

## Objetivo

Unificar en una arquitectura mantenible:

- el sitio público de Dermalysse;
- el club educativo para miembros;
- la administración de contenido y miembros;
- las operaciones de servidor necesarias para autenticación, membresías, video, progreso y certificados.

La experiencia conservará la identidad, el contenido y el modelo de negocio que puedan confirmarse en las fuentes oficiales. No se copiarán marcas, datos ni contenido de Elite Pecuario.

## Fuentes confirmadas

| Función | Fuente |
| --- | --- |
| Sitio público | `teccapitalweb/DERMALYSSE` y `https://www.dermalyssemx.com/` |
| Club | `teccapitalweb/Club-Dermalysse` y `https://club.dermalyssemx.com/` |
| API | `teccapitalweb/dermalysse-webhook` |
| Administración | `teccapitalweb/admin_club_dermalysse` |
| Referencia técnica | `teccapitalweb/elite-pecuario`, sin copiar contenido ni datos |

Las copias locales de las fuentes viven fuera de este repositorio, en `../_fuentes/`, para mantener intactos sus historiales.

## Documentación inicial

- `docs/FUENTES-Y-ALCANCE.md`: inventario, procedencia y exclusiones.
- `docs/DECISION-ARQUITECTURA.md`: arquitectura propuesta y límites de seguridad.

## Límites operativos

Este repositorio no tiene remoto configurado. No se han realizado pushes, despliegues, cambios de DNS ni conexiones a Firebase, Stripe, Bunny o Railway.
