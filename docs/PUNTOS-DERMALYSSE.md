# Puntos Dermalysse · reglas y arquitectura

Fecha: 26 de octubre de 2026.

## Objetivo

Puntos Dermalysse convierte actividad educativa verificable en beneficios reales. Hay dos cantidades distintas:

- **saldo**: puntos disponibles para canjear;
- **experiencia**: puntos históricos que nunca disminuyen y determinan el nivel.

Gastar puntos no reduce el nivel. Los niveles reconocen participación dentro del club; no son títulos, certificaciones ni credenciales profesionales.

## Fuentes activas

| Actividad | Crédito | Autoridad |
| --- | ---: | --- |
| Clase acreditada | 10 puntos | `users.progress`, escrito por el webhook después del avance real del reproductor |
| Curso completado | 100 puntos adicionales | todas las clases publicadas acreditadas |
| Certificado válido | 50 puntos | `certificates`, emitido por el servidor |
| Retos | 1 punto por cada 2 XP | `v2_retos_estado.xp`, calificado y limitado por la API |

La conciliación es retroactiva e idempotente: reconoce actividad previa y guarda hasta qué contador fue acreditado. Repetir una consulta o una operación no vuelve a entregar puntos.

Modo Historia y Comunidad no entregan saldo todavía. Historia permite avance reportado por el cliente; Comunidad necesita moderación de calidad y defensa contra spam. Sus metas anteriores conservan progreso visible, pero el canje queda pausado hasta tener autoridad de servidor.

## Bonos de Pasaporte

Además del crédito base, el servidor entrega bonos vitalicios al alcanzar hitos verificables. Cada bono tiene un identificador estable, se registra como movimiento y solo puede acreditarse una vez:

| Ruta | Hito | Bono |
| --- | ---: | ---: |
| Clases | 1 / 5 / 15 / 30 | 25 / 50 / 100 / 200 puntos |
| Cursos | 1 / 3 / 5 | 125 / 300 / 500 puntos |
| Certificados | 1 / 3 | 100 / 250 puntos |
| Retos | 100 / 500 XP verificados | 50 / 250 puntos |

El arreglo `hitos` de `v2_puntos/{uid}` funciona como recibo de acreditación. Los movimientos usan ids deterministas `uid__hito__<id>`, por lo que una consulta repetida no duplica saldo ni experiencia. Los bonos son retroactivos: reconocen la trayectoria que ya esté acreditada al estrenarse el programa.

## Niveles

| Nivel | Experiencia requerida |
| --- | ---: |
| Descubrimiento | 0 |
| Constancia | 300 |
| Criterio | 900 |
| Círculo Dermalysse | 1,800 |
| Curaduría | 3,500 |
| Legado Dermalysse | 6,000 |

La interfaz presenta además un **Pasaporte Dermalysse** con avance por hito, rareza visual y sello de finalización. Es reconocimiento de participación en la plataforma, no una certificación profesional.

## Colecciones y objetivo recomendado

La biblioteca permanente genera cuatro sellos visuales al reunir 1, 3, 6 y 9 materiales. Estas colecciones no gastan ni entregan puntos por sí mismas; reflejan derechos reales presentes en `v2_beneficios`.

El panel recomienda el beneficio disponible más cercano al saldo actual y muestra porcentaje, puntos faltantes, equivalencia orientativa en clases o cursos y una acción inmediata cuando el saldo sea suficiente. Las equivalencias son solo una guía calculada con las reglas base; no predicen un plazo ni prometen puntos futuros.

## Boutique

La primera versión ofrece únicamente beneficios que la plataforma puede cumplir de inmediato:

- acceso permanente a nueve materiales reales que ya están disponibles en la biblioteca;
- pase VIP de 24 horas por 350 puntos;
- 3 días VIP por 900 puntos;
- 7 días VIP por 1,800 puntos;
- 15 días VIP por 3,500 puntos;
- 30 días VIP por 6,500 puntos.

Los materiales se comprueban contra `pdfs/{id}` antes del canje. Si el archivo deja de estar disponible, el beneficio se oculta o se rechaza sin descontar puntos. Un derecho permanente se guarda en `v2_beneficios` y también autoriza `GET /materiales/:id/acceso` aunque la cuenta no sea VIP.

Los canjes con puntos permiten un máximo de 30 días VIP por año calendario. Extienden `vigenciaHasta` mediante `services/vip.ts`, nunca modifican `subscription` y quedan en `v2_vip_bitacora`.

La API expone el cupo anual usado y disponible. Una opción que exceda los días restantes permanece visible, pero queda desactivada antes del intento; la transacción vuelve a validar el límite para evitar carreras.

## Datos

- `v2_puntos/{uid}`: saldo, experiencia, totales, contadores acreditados, hitos vitalicios, número de canjes y días VIP del año.
- `v2_puntos_movimientos/{id}`: libro mayor de créditos y gastos con idempotencia por rango acreditado.
- `v2_puntos_canjes/{id}`: recibo inmutable de cada canje.
- `v2_beneficios/{uid}__{materialId}`: derecho permanente sobre un material.

Todas las colecciones tienen prefijo `v2_`, solo se leen y escriben con Firebase Admin a través de la API y están cubiertas por el cierre denegado de `api/firestore.rules`. Las consultas usan un único filtro de igualdad por `uid`; no requieren índices compuestos nuevos en Firestore Standard.

## Contrato

- `GET /recompensas`: recompensas VIP anteriores más `{ puntos, boutique, movimientos, canjes, hitos, colecciones, objetivo, vipAnual, proximasFormasDeGanar }`.
- `POST /beneficios/:id/canjear`: descuenta puntos y crea el beneficio de forma transaccional.
- `GET /materiales/:id/acceso`: acepta VIP, administrador, material gratis o derecho permanente.

Errores esperados: `puntos/insuficientes`, `beneficio/ya-canjeado`, `beneficio/no-disponible`, `beneficio/limite-vip` y `recompensa/validacion-pendiente`.

## Antes de producción

1. Ejecutar `npm run verify` y las pruebas de Academia.
2. Probar una cuenta gratuita, VIP y administrador en un entorno autorizado.
3. Confirmar que los nueve documentos siguen disponibles y tienen permiso/licencia de distribución.
4. Desplegar primero la API y después el cliente; el cliente nuevo espera los campos ampliados de `GET /recompensas`.
5. Verificar canje, saldo, historial, acceso permanente y extensión VIP sin tocar una suscripción pagada.
