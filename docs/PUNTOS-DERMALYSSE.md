# Diamantes Dermalysse · reglas y arquitectura

Fecha: 26 de octubre de 2026.

## Objetivo

**Diamantes Dermalysse** es el nombre visible de la moneda de recompensas. El contrato conserva los nombres técnicos `puntos`, `saldo` y `v2_puntos*` para no romper compatibilidad. La moneda convierte actividad educativa verificable en beneficios reales. Hay dos cantidades distintas:

- **saldo**: diamantes disponibles para canjear;
- **experiencia**: XP histórico que nunca disminuye y determina el nivel.

Gastar diamantes no reduce el nivel. Los niveles reconocen participación dentro del club; no son títulos, certificaciones ni credenciales profesionales.

## Recompensa garantizada para todas las cuentas

La primera conciliación de cada cuenta acredita automáticamente y una sola vez un **Cofre de Bienvenida de 350 Diamantes Dermalysse**. Aplica a cuentas nuevas y existentes que todavía no tengan el recibo `bienvenidaAcreditada`.

- 350 diamantes alcanzan para la Guía de regulación cosmética, Estudios de estabilidad o un pase VIP de 24 horas, siempre que la opción continúe disponible y no se posea.
- el regalo aumenta `saldo` y `ganados`, pero no `experiencia`; una promoción no adelanta niveles educativos;
- el movimiento usa el id determinista `uid__cofre-bienvenida`, por lo que recargar o consultar varias veces no duplica el saldo;
- `v2_puntos/{uid}.bienvenidaAcreditada` queda como recibo permanente.

## Fuentes activas

| Actividad | Crédito | Autoridad |
| --- | ---: | --- |
| Clase acreditada | 10 puntos | `users.progress`, escrito por el webhook después del avance real del reproductor |
| Curso completado | 100 puntos adicionales | todas las clases publicadas acreditadas |
| Certificado válido | 50 puntos | `certificates`, emitido por el servidor |
| Retos | 1 punto por cada 2 XP | `v2_retos_estado.xp`, calificado y limitado por la API |
| Racha de Retos | bonos en hitos de 3 / 7 / 14 / 30 días | `v2_retos_estado.diaria.racha`, calculada por la API |

La conciliación es retroactiva e idempotente: reconoce actividad previa y guarda hasta qué contador fue acreditado. Repetir una consulta o una operación no vuelve a entregar puntos.

Modo Historia y Comunidad no entregan saldo todavía. Historia permite avance reportado por el cliente; Comunidad necesita moderación de calidad y defensa contra spam. Sus metas anteriores conservan progreso visible, pero el canje queda pausado hasta tener autoridad de servidor.

## Bonos de Pasaporte

Además del crédito base, el servidor entrega bonos vitalicios al alcanzar hitos verificables. Cada bono tiene un identificador estable, se registra como movimiento y solo puede acreditarse una vez:

| Ruta | Hito | Bono |
| --- | ---: | ---: |
| Clases | 1 / 5 / 15 / 30 / 50 / 75 / 100 | 25 / 50 / 100 / 200 / 350 / 600 / 1,000 puntos |
| Cursos | 1 / 3 / 5 / 8 / 12 | 125 / 300 / 500 / 800 / 1,400 puntos |
| Certificados | 1 / 3 / 5 / 10 | 100 / 250 / 500 / 1,200 puntos |
| Retos | 100 / 500 / 1,000 / 2,500 XP verificados | 50 / 250 / 500 / 1,100 puntos |
| Racha de Retos | 3 / 7 / 14 / 30 días | 60 / 160 / 350 / 800 puntos |

El arreglo `hitos` de `v2_puntos/{uid}` funciona como recibo de acreditación. Los movimientos usan ids deterministas `uid__hito__<id>`, por lo que una consulta repetida no duplica saldo ni experiencia. Los bonos son retroactivos: reconocen la trayectoria que ya esté acreditada al estrenarse el programa.

## Misiones progresivas

Hay nueve misiones opt-in distribuidas en tres rutas y tres tramos:

| Ruta | Actividad nueva requerida | Bonos por tramo |
| --- | --- | --- |
| Estudio | 5 / 10 / 20 clases | 75 / 175 / 400 puntos |
| Programas | 1 / 2 / 3 cursos completos | 175 / 400 / 750 puntos |
| Práctica | 100 / 300 / 600 XP de Retos | 75 / 250 / 550 puntos |

Al activar una misión, la API guarda el contador acreditado de ese instante como `base`; por eso la actividad previa no completa la misión. Cada tramo requiere completar el anterior. La conciliación compara solo métricas autoritativas, acredita el bono con el movimiento determinista `uid__mision__<id>` y marca la misión como completada dentro de la misma transacción. Una misión no se reactiva ni se cobra dos veces.

## Niveles

| Nivel | Experiencia requerida |
| --- | ---: |
| Descubrimiento | 0 |
| Constancia | 300 |
| Criterio | 900 |
| Círculo Dermalysse | 1,800 |
| Curaduría | 3,500 |
| Legado Dermalysse | 6,000 |
| Maestría Editorial | 10,000 |
| Ícono Dermalysse | 18,000 |

La interfaz presenta además un **Pasaporte Dermalysse** con avance por hito, rareza visual y sello de finalización. Es reconocimiento de participación en la plataforma, no una certificación profesional.

## Colecciones y meta de ahorro

La biblioteca permanente genera cuatro sellos visuales al reunir 1, 3, 6 y 9 materiales. Estas colecciones no gastan ni entregan puntos por sí mismas; reflejan derechos reales presentes en `v2_beneficios`.

El panel recomienda el beneficio disponible más cercano al saldo actual, pero la persona puede elegir cualquier beneficio como **meta de ahorro**. La elección persiste en `v2_puntos/{uid}.objetivoElegido` hasta cambiarla, canjearla o despejarla. El panel muestra porcentaje, puntos faltantes, equivalencia orientativa en clases o cursos y una acción inmediata cuando el saldo sea suficiente. Las equivalencias son solo una guía calculada con las reglas base; no predicen un plazo ni prometen puntos futuros.

La **Ruta de deseos** permite conservar hasta cinco beneficios adicionales. Los ids se guardan en `v2_puntos/{uid}.favoritos`; la API valida que existan, que su contenido siga disponible y que todavía no se posean. Canjear un material retira automáticamente de la ruta su beneficio individual. La meta principal y los favoritos son independientes: guardar una opción no altera la meta hasta que la persona lo solicite.

## Atelier Dermalysse

El Atelier permite formar una colección personalizada con entre dos y cinco materiales reales todavía no adquiridos. La escala es fija y autoritativa:

| Materiales | Descuento sobre el precio individual |
| ---: | ---: |
| 2 | 8 % |
| 3 | 12 % |
| 4 | 16 % |
| 5 | 20 % |

La cotización se calcula en la API, redondeada a decenas. El canje vuelve a leer saldo, disponibilidad y derechos dentro de una transacción antes de descontar puntos. Después crea un recibo de categoría `paquete`, conserva `costoOriginal` y `ahorro`, y genera un derecho permanente por material. Una cotización previa no reserva precio ni contenido; la transacción de canje es la autoridad final.

## Inteligencia de puntos

`GET /recompensas` calcula, sin escribir datos nuevos:

- puntos ganados, gastados y balance de los últimos 30 días;
- valor histórico canjeado y ahorro acumulado en colecciones;
- materiales permanentes y días VIP entregados;
- ritmo semanal observado a partir de los últimos 30 días;
- historial agregado de los seis meses más recientes;
- distribución de canjes entre materiales, colecciones, VIP y premios de nivel.

Estas métricas describen actividad ya registrada. No predicen cuándo se alcanzará una recompensa ni prometen créditos futuros.

## Boutique

La primera versión ofrece únicamente beneficios que la plataforma puede cumplir de inmediato:

- acceso permanente a nueve materiales reales que ya están disponibles en la biblioteca;
- cuatro colecciones curadas: Fundamentos Profesionales (760), Rejuvenecimiento Facial (990), Tecnología Aplicada (1,140) y Biblioteca Completa (2,860 puntos);
- pase VIP de 24 horas por 350 puntos;
- 2 días VIP por 650 puntos;
- 3 días VIP por 900 puntos;
- 5 días VIP por 1,400 puntos;
- 7 días VIP por 1,800 puntos;
- 10 días VIP por 2,500 puntos;
- 15 días VIP por 3,500 puntos;
- 30 días VIP por 6,500 puntos.

Los materiales se comprueban contra `pdfs/{id}` antes del canje. Si el archivo deja de estar disponible, el beneficio se oculta o se rechaza sin descontar puntos. Un derecho permanente se guarda en `v2_beneficios` y también autoriza `GET /materiales/:id/acceso` aunque la cuenta no sea VIP.

Las colecciones agrupan tres o nueve materiales, se entregan como derechos permanentes en una sola transacción y nunca cobran dos veces una pieza existente. Si la cuenta ya posee parte del paquete, la API recalcula el precio preferente solo sobre los materiales faltantes, redondeado a decenas; la respuesta expone costo por separado, ahorro, contenido y cantidad pendiente. El cliente no decide ni envía el precio.

Los canjes con puntos permiten un máximo de 30 días VIP por año calendario. Extienden `vigenciaHasta` mediante `services/vip.ts`, nunca modifican `subscription` y quedan en `v2_vip_bitacora`.

La API expone el cupo anual usado y disponible. Una opción que exceda los días restantes permanece visible, pero queda desactivada antes del intento; la transacción vuelve a validar el límite para evitar carreras.

## Bóveda de nivel

Al alcanzar cada nivel posterior a Descubrimiento se abre una elección de una sola vez. No consume saldo ni reduce experiencia:

| Nivel | Elección VIP | Elección permanente |
| --- | --- | --- |
| Constancia | 1 día VIP | Regulación cosmética |
| Criterio | 2 días VIP | Estudios de estabilidad |
| Círculo Dermalysse | 3 días VIP | Nutrición y prevención |
| Curaduría | 5 días VIP | Manual de técnicas avanzadas |
| Legado Dermalysse | 7 días VIP | Tecnologías en cosmiatría |
| Maestría Editorial | 10 días VIP | Colección Rejuvenecimiento Facial |
| Ícono Dermalysse | 15 días VIP | Biblioteca Dermalysse Completa |

La API vuelve a comprobar experiencia, disponibilidad del contenido, derechos existentes y cupo VIP dentro de la transacción. Guarda `premiosNivel.<nivelId>` como recibo permanente, crea un canje con `costo: 0` y `origen: nivel`, y entrega el beneficio en la misma operación. Repetir la solicitud no vuelve a otorgar valor. Si una opción permanente ya está completa en la cuenta, se debe elegir la alternativa.

## Bienvenida Dermalysse · Primera Edición

La campaña inicial admite exactamente 50 cuentas distintas entre el 28 de octubre y el 31 de diciembre de 2026. El código oficial vive únicamente en `CAMPANA_BIENVENIDA_CODIGO` dentro del entorno protegido de la API: no se guarda en Git, no entra al bundle web y nunca viaja en `GET /campanas/bienvenida`; solo se compara en el servidor al canjearlo.

Cada cuenta aceptada recibe, dentro de una sola transacción:

- 750 Diamantes Dermalysse sin incrementar experiencia ni adelantar niveles;
- 7 días VIP mediante la misma regla de `services/vip.ts` que conserva suscripciones pagadas;
- acceso permanente a Regulación cosmética;
- acceso permanente a Estudios de estabilidad cosmética.

Antes de reservar el lugar, la API vuelve a comprobar que ambos documentos sigan publicados y disponibles. Si alguno deja de estarlo, el canje se rechaza sin consumir cupo ni entregar una parte del paquete. El identificador de cuenta, la reserva, los movimientos, los derechos y la vigencia se resuelven en el backend; el navegador no puede fijar saldo, cupo o estado.

Cerrar el modal con la X o con «No tengo un código ahora» guarda una preferencia de siete días en el servidor. Tras el canje, el paquete permanece visible en Recompensas como entregado y activado. Al agotarse los 50 lugares se muestra «cupo agotado» y no se promete un sustituto.

El panel `#/admin/campanas` permite consultar solicitudes, emisiones, activaciones, pendientes y actividad diaria agregada; pausar o reactivar; ampliar el cupo sin bajarlo de lo ya utilizado; ajustar vigencia; exportar un CSV agregado sin datos personales y crear campañas nuevas con beneficios internos existentes. La campaña inicial no depende de aliados, envíos físicos ni contenido clínico nuevo. Ninguna pantalla o configuración equivale a una aprobación profesional acreditada.

Colecciones: `v2_campanas`, `v2_campanas_codigos`, `v2_campanas_canjes` y `v2_campanas_preferencias`; todas están cerradas al cliente por `api/firestore.rules`.

## Datos

- `v2_puntos/{uid}`: saldo de diamantes, experiencia, totales, recibo del Cofre de Bienvenida, contadores acreditados (incluida la mayor racha), hitos vitalicios, estado/base/objetivo de misiones, meta elegida, hasta cinco favoritos, premios de nivel, número de canjes y días VIP del año.
- `v2_puntos_movimientos/{id}`: libro mayor de créditos y gastos con idempotencia por rango acreditado.
- `v2_puntos_canjes/{id}`: recibo inmutable de cada canje.
- `v2_beneficios/{uid}__{materialId}`: derecho permanente sobre un material.
- `v2_admin_puntos_bitacora/{uid}__admin__{idempotencia}`: evidencia inmutable de ajustes manuales, con cantidad, motivo, referencia y administrador responsable. Esta identidad no se copia al libro mayor visible para el miembro.

Todas las colecciones tienen prefijo `v2_`, solo se leen y escriben con Firebase Admin a través de la API y están cubiertas por el cierre denegado de `api/firestore.rules`. Las consultas usan un único filtro de igualdad por `uid`; no requieren índices compuestos nuevos en Firestore Standard.

## Contrato

- `GET /recompensas`: recompensas VIP anteriores más `{ puntos, boutique, favoritos, atelier, inteligencia, movimientos, canjes, hitos, misiones, niveles, premiosNivel, colecciones, objetivo, vipAnual, proximasFormasDeGanar }`; `puntos.moneda` identifica Diamantes Dermalysse y `puntos.recompensaInicial` confirma el cofre garantizado.
- `POST /puntos/misiones/:id/activar`: captura la base actual y activa un tramo disponible sin acreditar puntos todavía.
- `PUT /puntos/objetivo` con `{ beneficioId: string | null }`: selecciona o despeja una meta disponible.
- `PUT /puntos/favoritos/:id` con `{ activo: boolean }`: guarda o retira un beneficio de la ruta de deseos; máximo cinco.
- `POST /beneficios/atelier/cotizar` con `{ materialIds: string[] }`: valida entre dos y cinco piezas y devuelve precio, descuento, ahorro, saldo y faltante.
- `POST /beneficios/atelier/canjear` con `{ materialIds: string[] }`: confirma el precio, descuenta saldo y entrega todos los derechos en una transacción.
- `POST /puntos/niveles/:id/canjear` con `{ beneficioId }`: entrega una de las dos opciones del nivel sin gastar saldo.
- `POST /beneficios/:id/canjear`: calcula el precio autoritativo, descuenta puntos y crea uno o varios derechos de forma transaccional.
- `GET /materiales/:id/acceso`: acepta VIP, administrador, material gratis o derecho permanente.

### Centro administrativo

- `GET /admin/recompensas/resumen`: totales de circulación, créditos, gastos, canjes, días VIP, derechos permanentes y actividad reciente.
- `GET /admin/recompensas/cuentas`: cuentas de `users`, `members` y `v2_puntos`, incluidas las que aún no han abierto el cofre de bienvenida. Consultar no acredita premios.
- `GET /admin/recompensas/cuentas/:uid`: monedero, nivel, libro mayor, canjes y materiales permanentes de una cuenta.
- `POST /admin/recompensas/ajustes` con `{ uid, diamantes, motivo, idempotencia }`: acredita o retira un entero entre −10,000 y 10,000. Nunca modifica experiencia o nivel, impide saldo negativo, exige un motivo de 10–240 caracteres y registra una bitácora separada. Repetir la misma referencia con el mismo cuerpo no duplica el movimiento; reutilizarla con datos distintos se rechaza.

Todas estas rutas requieren administrador autenticado. El panel no permite editar precios del catálogo desde el navegador: los costos y efectos de cada beneficio siguen siendo código autoritativo revisable.

Errores esperados: `puntos/insuficientes`, `beneficio/ya-canjeado`, `beneficio/no-disponible`, `beneficio/limite-vip`, `objetivo/invalido`, `objetivo/no-disponible`, `objetivo/ya-obtenido`, `favorito/invalido`, `favorito/limite`, `favorito/ya-obtenido`, `favorito/no-disponible`, `atelier/seleccion-invalida`, `atelier/material-invalido`, `atelier/material-obtenido`, `atelier/material-no-disponible`, `nivel/opcion-invalida`, `nivel/bloqueado`, `nivel/canjeado`, `nivel/beneficio-obtenido`, `nivel/beneficio-no-disponible`, `mision/activa`, `mision/completada`, `mision/bloqueada` y `recompensa/validacion-pendiente`.

## Antes de producción

1. Ejecutar `npm run verify` y las pruebas de Academia.
2. Probar una cuenta gratuita, VIP y administrador en un entorno autorizado.
3. Confirmar que los nueve documentos siguen disponibles y tienen permiso/licencia de distribución.
4. Desplegar primero la API y después el cliente; el cliente nuevo espera los campos ampliados de `GET /recompensas`.
5. Verificar materiales individuales, paquetes parciales, Atelier de 2–5 piezas, meta persistente, cinco favoritos, inteligencia histórica, una elección de nivel, saldo, historial, acceso permanente y extensión VIP sin tocar una suscripción pagada.
