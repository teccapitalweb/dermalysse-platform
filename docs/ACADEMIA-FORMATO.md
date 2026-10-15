# Academia Dermalysse · formato de contenido y estándar editorial

Este documento define cómo se escribe cada módulo de la Academia Dermalysse. Lo siguen las personas y los agentes que redactan contenido. El validador `node scripts/academia/validar.mjs <programa> --estricto` rechaza cualquier archivo que no lo cumpla.

## 1. Archivos

- Catálogo: `api/content/academia/catalogo.json`.
- Un archivo por módulo: `api/content/academia/<programa>/modulo-01.json`, `modulo-02.json`…, con dos dígitos.
- El `titulo` del módulo debe coincidir **exactamente** con el del catálogo.

## 2. Estructura de un módulo

```jsonc
{
  "programa": "fundamentos-de-la-piel",     // id del catálogo
  "modulo": 4,                               // número
  "titulo": "La barrera cutánea: lípidos, manto ácido y microbioma",   // = catálogo
  "estado": "borrador",                      // "borrador" | "revision" | "aprobado"; quien redacta SIEMPRE pone "borrador"
  "version": 1,
  "resumen": "Párrafo de 60 a 120 palabras: qué aprende la persona y por qué importa en la cabina o en su práctica.",
  "objetivos": ["Explicar…", "Identificar…", "…"],   // 4 a 6, verbos observables
  "duracionMin": 95,                         // suma aproximada de lectura + actividades + examen
  "portada": { "id": "fundamentos-de-la-piel/m04/portada", "proporcion": "16:9", "alt": "…", "prompt": "…" },
  "temas": [ /* 4 a 6 temas (5 recomendados), ver sección 3 */ ],
  "minijuego": { /* ver sección 5 */ },
  "examen": { "aprobar": 70, "mostrar": 10, "preguntas": [ /* 15 a 20, ver sección 6 */ ] },
  "fuentes": [ /* fuentes generales del módulo, ver sección 7 */ ]
}
```

| estado | Quién lo pone | Visible para miembros |
| --- | --- | --- |
| `borrador` | Quien redacta (persona o agente). | No; solo vista previa del administrador. |
| `revision` | El profesional revisor, mientras hace observaciones. | No. |
| `aprobado` | El profesional revisor. | Sí. |

## 3. Tema

```jsonc
{
  "n": "4.2",                               // <módulo>.<tema>
  "titulo": "El manto ácido y por qué importa el pH",
  "minutos": 12,
  "enPocasPalabras": "2 o 3 frases en lenguaje muy sencillo, que entienda alguien que empieza.",
  "bloques": [ /* ver sección 4 */ ],
  "glosario": [{ "termino": "Pérdida transepidérmica de agua", "definicion": "…" }],   // 3 a 8
  "verificacion": [ /* exactamente 3 preguntas de selección, ver sección 6 */ ],
  "fuentes": [ /* las que respaldan este tema */ ]
}
```

### Volumen mínimo por tema

- **De 1,000 a 1,400 palabras** de enseñanza real en bloques `texto`, `recuadro`, `pasos`, `lista` y `tabla` (el validador advierte por debajo de 900).
- Al menos **3 figuras** (`figura`) y **1 diagrama** (`diagrama`).
- Al menos **2 recuadros** de variantes distintas.
- Al menos **1 actividad** (`actividad`) dentro de los bloques.
- Subtítulos (`subtitulo`) cada 2 o 3 párrafos.
- Cada tema **cierra con una idea práctica** aplicable en la cabina, en el estudio o en casa.
- En el módulo, al menos **un recuadro `profundizar`** con nivel universitario o profesional.

## 4. Bloques

| tipo | campos | uso |
| --- | --- | --- |
| `subtitulo` | `texto` | Divide el tema en secciones. |
| `texto` | `md` | Párrafos. Admite `**negritas**`, `*cursivas*` y saltos de párrafo con línea en blanco. Nada de HTML. |
| `lista` | `titulo?`, `items[]`, `ordenada?` | Enumeraciones cortas (2 o más elementos). |
| `pasos` | `titulo`, `pasos[{ titulo, md }]` | Procedimientos explicados como concepto (2 o más pasos). |
| `tabla` | `titulo`, `columnas[]`, `filas[[]]` | Comparaciones y clasificaciones. Cada fila con tantas celdas como columnas. |
| `recuadro` | `variante`, `titulo`, `md` | `atencion` (riesgo para la piel o de bioseguridad), `sabias` (dato curioso con respaldo), `profundizar` (técnico, nivel universitario o profesional; el lector lo muestra plegable), `ejemplo` (caso ilustrativo en cabina), `mexico` (normativa o dato nacional verificado). |
| `figura` | `id`, `proporcion`, `alt`, `pie`, `prompt` | Imagen que genera el propietario con su generador de imágenes. |
| `diagrama` | `id`, `pie`, `descripcion`, `elementos[]` | Diagrama con etiquetas que se dibuja en código. `descripcion` explica qué debe mostrar; `elementos` lista las etiquetas exactas. |
| `cita` | `texto`, `autor` | Solo si es real y verificable. |
| `actividad` | ver sección 5 | Práctica dentro del tema. |

### Figuras

- `id`: `<programa>/m<NN>/<NN>` consecutivo dentro del módulo (la portada es `<programa>/m<NN>/portada`). Ejemplo: `fundamentos-de-la-piel/m04/07`.
- `proporcion`: una de `16:9`, `4:3`, `3:4`, `1:1`, `9:16`.
- `alt`: descripción accesible en una frase. `pie`: solo el texto del pie (el lector agrega «Figura 4.2.1»).
- `prompt`: en español, de **60 a 140 palabras**, describe sujeto, escena, acción, encuadre, luz y estilo. Termina con «Evitar: …». **Nunca pedir texto dentro de la imagen.**
- Estilo base de Dermalysse: fotografía editorial realista y luminosa, tonos cálidos crema y rosa empolvado, cabina estética limpia o estudio, piel real con textura natural (sin retoque excesivo), **diversidad de fototipos y edades**.
- Reglas fijas: anatomía correcta; sin lesiones graves, sangre ni contenido perturbador; sin personas reales identificables ni celebridades; equipo de protección correcto en escenas de cabina (guantes, cubrebocas cuando corresponda, cabello recogido); sin texto, letreros, marcas ni logotipos; sin prometer resultados (nada de «antes y después» milagrosos).
- Los diagramas con etiquetas (capas de la piel, ciclo del folículo, escala de fototipos, espectro solar) **no** se piden al generador: van como bloque `diagrama`.

### Diagramas

- `id`: `<programa>/m<NN>/d<N>` consecutivo dentro del módulo.

## 5. Actividades y minijuego

```jsonc
{ "tipo": "actividad", "actividad": "ordenar", "titulo": "…", "instruccion": "…", "elementos": ["Paso 1", "Paso 2", "…"] }
// elementos en el ORDEN CORRECTO; la app los baraja. 4 a 7 elementos, sin repetidos.
{ "tipo": "actividad", "actividad": "relacionar", "titulo": "…", "instruccion": "…", "pares": [{ "a": "Concepto", "b": "Definición" }] }   // 4 a 6 pares
{ "tipo": "actividad", "actividad": "vf", "titulo": "Mito o realidad", "afirmaciones": [{ "texto": "…", "verdadero": false, "explicacion": "…" }] }   // 4 a 6
{ "tipo": "actividad", "actividad": "caso", "titulo": "Caso en cabina", "situacion": "Párrafo sin datos identificables.", "opciones": [{ "texto": "…", "correcta": true, "retro": "…" }] }   // 3 o 4 opciones, una correcta
{ "tipo": "actividad", "actividad": "calculadora", "titulo": "…", "instruccion": "…", "formula": "texto legible", "variables": [{ "id": "x", "etiqueta": "…", "valor": 10, "unidad": "…" }], "resultado": { "expresion": "x * 2", "etiqueta": "…", "unidad": "…", "decimales": 1 } }
// expresion solo con ids de variables, números y + - * / ( ). Nunca calculadoras de dosis de medicamentos ni de concentraciones para preparar productos médicos.
```

Minijuego del módulo (uno por módulo). Tipo fijo según el número: **1, 4, 7, 10 → `sopa`; 2, 5, 8, 11 → `crucigrama`; 3, 6, 9, 12 → `memorama`**.

```jsonc
{ "tipo": "sopa", "titulo": "…", "palabras": ["EPIDERMIS", "MELANINA", "…"] }        // 8 a 12 palabras, MAYÚSCULAS, sin espacios, sin acentos, 4 a 12 letras
{ "tipo": "crucigrama", "titulo": "…", "pistas": [{ "palabra": "COLAGENO", "pista": "…" }] }   // 6 a 10
{ "tipo": "memorama", "titulo": "…", "pares": [{ "a": "Concepto", "b": "Pareja" }] }        // 6 a 8
```

## 6. Preguntas

```jsonc
{ "id": "m04-p07", "q": "Pregunta clara", "opciones": ["A", "B", "C", "D"], "correcta": 2, "explicacion": "Por qué es la correcta y por qué las otras no." }
```

- 4 opciones, una correcta (`correcta` de 0 a 3), distractores plausibles, **sin «todas las anteriores» ni «ninguna de las anteriores»**.
- Repartir la respuesta correcta entre A, B, C y D: ninguna letra con más del 35 % del examen.
- Examen del módulo: de 15 a 20 preguntas (la app muestra 10 al azar; se aprueba con 70). Mezclar recuerdo, comprensión y casos en cabina.
- Verificación del tema: exactamente 3 preguntas, con `id` `t4.2-1`, `t4.2-2`, `t4.2-3`.

## 7. Fuentes

```jsonc
{ "tipo": "oficial", "titulo": "…", "autor": "COFEPRIS", "anio": 2024 }
{ "tipo": "academica", "titulo": "…", "autor": "…", "anio": 2019 }
{ "tipo": "propia", "titulo": "Elaboración propia Dermalysse con base en …", "autor": "Dermalysse", "anio": 2026 }
```

Reglas de honestidad:

- **Nunca inventar** un dato, cifra, documento, autor, año, número de norma o URL. Si no estás seguro de que existe, no lo cites; usa `propia`.
- `url` solo si estás seguro de que es correcta; si no, omítela.
- Antes de citar una NOM o una regulación, confirma con una búsqueda que existe y está vigente (DOF, COFEPRIS). Si no puedes confirmarlo, describe el requisito sin el número y remite a la autoridad.
- Prioridad: OMS/OPS, Secretaría de Salud y COFEPRIS, academias de dermatología (American Academy of Dermatology, British Association of Dermatologists, Academia Española de Dermatología), textos universitarios de dermatología y cosmetología, revisiones revisadas por pares.
- Las fuentes **no se muestran** al alumno por ahora; quedan en el archivo para respaldo y revisión profesional.

## 8. Reglas de contenido

1. Español de México, claro y cálido, en segunda persona («observa», «registra»). Términos técnicos correctos, explicados la primera vez.
2. Técnicamente correcto y actualizado a 2025/2026. Cifras con contexto, unidad y fuente.
3. **Educativo, nunca médico**: no diagnosticar, no prescribir, no prometer resultados. Ante lesiones, cambios sospechosos o enfermedades de la piel, la indicación es **derivar al dermatólogo**.
4. **Sin dosis ni protocolos farmacológicos.** Activos cosméticos se explican como concepto (qué hacen, precauciones, por qué usar fotoprotección), no como receta.
5. Procedimientos médicos (toxina botulínica, rellenos, láser médico, peelings médicos profundos) solo para explicar el alcance profesional y la derivación.
6. Diversidad: ejemplos con distintos fototipos, edades y géneros.
7. Usar «» en lugar de comillas dobles ASCII dentro de los textos del JSON.
8. Cada tema cierra con una idea práctica aplicable.
