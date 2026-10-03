# Dermalysse Platform

Repositorio independiente de Dermalysse con dos entradas:

- `/`: landing editorial de Dermalysse.
- `/club/`: plataforma educativa basada en la arquitectura del club Elite Pecuario y adaptada a Dermalysse.

## Uso local

```powershell
npm install
npm run dev
```

La plataforma funciona en modo demo cuando `VITE_API_URL` no está definido. Firebase, API, pagos y video productivo solo se conectan mediante variables de entorno; el repositorio no incluye credenciales ni identificadores productivos.

## Verificación

```powershell
npm test
npm run build
```

El catálogo local se genera desde la fuente oficial disponible en `C:\dev\02_CLIENTES\Dermalysse\_fuentes\Club-Dermalysse` ejecutando `node scripts/prepare-migration.mjs`.
