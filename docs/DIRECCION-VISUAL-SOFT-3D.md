# Dermalysse · Soft 3D Editorial

Fecha: 8 de octubre de 2026.

## Nombre de la dirección

**Soft 3D Editorial Dermalysse**

Es una combinación de:

- claymorphism refinado;
- ilustración editorial de producto;
- objetos 3D mate con volumen suave;
- composiciones aisladas que funcionan como símbolos visuales.

No busca verse infantil, como videojuego ni como iconografía médica. La intención es transmitir aprendizaje, cuidado y criterio profesional mediante objetos cálidos, claros y memorables.

## Principios

1. **Un concepto por imagen.** Cada ilustración representa una acción o modalidad concreta.
2. **Silueta reconocible.** Debe entenderse incluso cuando se muestra a 80–120 px.
3. **Poco ruido.** Entre dos y cuatro objetos relacionados; nunca una escena completa.
4. **Volumen delicado.** Bordes redondeados, sombras difusas y materiales mate.
5. **Color con función.** Cada modalidad conserva un color identificador.
6. **La interfaz sigue mandando.** La imagen acompaña el contenido; no sustituye títulos, estados ni controles.

## Lenguaje visual

### Forma

- Volúmenes redondeados y compactos.
- Objetos ligeramente superpuestos para crear profundidad.
- Curvas limpias y proporciones amables.
- Detalles suficientes para comunicar la idea, sin miniaturas decorativas innecesarias.

### Materiales

- Cerámica mate.
- Papel grueso con grano fino.
- Acrílico translúcido o esmerilado.
- Vidrio suave únicamente como acento.
- Perlas o piezas satinadas en composiciones narrativas.

### Iluminación

- Luz de estudio amplia y difusa.
- Sombras suaves, cortas y naturales.
- Brillos controlados.
- Contraste medio; nunca iluminación dramática ni clínica.

### Composición

- Formato maestro cuadrado 1:1.
- Elemento principal centrado.
- Márgenes transparentes generosos.
- Lectura clara a tamaño miniatura.
- Fondo realmente transparente.
- Sin texto incrustado.

## Paleta por modalidad

| Modalidad | Color dominante | Acentos |
| --- | --- | --- |
| Quiz Relámpago | azul cobalto empolvado | marfil, vino mínimo |
| Casos Dermalysse | jade o verde azulado apagado | marfil, blush |
| Flashcards | durazno y terracota suave | marfil, dorado tenue |
| Modo historia | vino profundo y malva | marfil, azul tinta |

La paleta debe sentirse integrada con los fondos crema, vino y azul tinta de Dermalysse. Evitar colores neón y saturación excesiva.

## Activos actuales

Los archivos optimizados se encuentran en:

| Modalidad | Archivo |
| --- | --- |
| Quiz Relámpago | `/public/media/retos/quiz-relampago.webp` |
| Casos Dermalysse | `/public/media/retos/casos-dermalysse.webp` |
| Flashcards | `/public/media/retos/flashcards.webp` |
| Modo historia | `/public/media/retos/modo-historia.webp` |
| Hero de progreso | `/public/media/retos/hero-progreso.webp` |

Especificación actual:

- WebP con transparencia.
- Máximo de 640 × 640 px.
- Peso objetivo: 35–60 KB.
- Carga diferida con `loading="lazy"`.
- Uso decorativo con `alt=""` cuando el título ya comunica el significado.

## Prompt maestro

```text
Use case: stylized-concept
Asset type: small website feature illustration for Dermalysse
Primary request: create an elegant compact visual symbolizing [CONCEPTO]
Scene/backdrop: isolated composition on a genuinely transparent background
Subject: [OBJETO PRINCIPAL] with [DOS O TRES ELEMENTOS SECUNDARIOS]
Style/medium: premium soft 3D clay and matte paper-cut editorial illustration, refined skincare-education brand aesthetic, sophisticated and not cartoonish
Composition/framing: square 1:1, centered object cluster, generous transparent padding, strong readable silhouette at thumbnail size
Lighting/mood: soft studio light, calm, polished and premium
Color palette: [COLOR DOMINANTE], warm ivory, [ACENTO]
Materials/textures: matte ceramic, frosted acrylic and fine paper grain
Constraints: no text, no letters, no numbers, no logo, no watermark, no people, no faces, no patients, no needles, no blood, genuinely transparent background
```

## Variaciones usadas

### Quiz Relámpago

- Concepto: respuesta rápida y conocimiento.
- Objetos: cronómetro, tres tarjetas de respuesta y destello.
- Paleta: cobalto, marfil y vino.

### Casos Dermalysse

- Concepto: observación, análisis y razonamiento profesional.
- Objetos: carpeta abstracta, lupa, muestra cosmética translúcida y marcadores de revisión.
- Paleta: jade, marfil y blush.
- Nunca representar diagnóstico, pacientes ni procedimientos.

### Flashcards

- Concepto: memoria activa y repetición espaciada.
- Objetos: tarjetas apiladas, cinta de repetición y puntos de recuerdo.
- Paleta: durazno, terracota, marfil y dorado.

### Modo historia

- Concepto: recorrido narrativo guiado.
- Objetos: libro abierto, sendero curvo, puntos de avance y arco de destino.
- Paleta: vino, malva, marfil y azul tinta.

### Hero de progreso

- Concepto: precisión, avance y reconocimiento.
- Objetos: objetivo con perla central, tres peldaños ascendentes y medalla.
- Paleta: vino profundo, azul tinta, blush, marfil y reflejos perlados.
- Uso: una sola pieza flotante junto al nivel; nunca detrás del texto principal.

## Integración en interfaz

- Mostrar la ilustración entre 84 y 120 px según el ancho disponible.
- Reservar una columna propia dentro de la tarjeta.
- Mantener el texto y los indicadores en una columna distinta.
- Usar `object-fit: contain`.
- Aplicar solo una sombra difusa ligera.
- En hover, limitar el movimiento a 2–3 px y una escala máxima aproximada de 1.03.
- No usar las ilustraciones como fondos a sangre detrás de texto.
- No añadir más de una ilustración protagonista por tarjeta.

## No hacer

- No mezclar fotografías con estas ilustraciones dentro del mismo grupo.
- No generar personajes, rostros ni pacientes para representar modalidades.
- No usar jeringas, agujas, sangre, bisturís o procedimientos sobre piel.
- No incluir texto generado dentro de la imagen.
- No convertir cada indicador, insignia o botón en una ilustración 3D.
- No usar sombras negras duras, plástico brillante ni acabado infantil.
- No aumentar el tamaño hasta competir con el título o la acción principal.

## Extensión a nuevas secciones

Para conservar coherencia, cada nueva imagen debe definir antes:

1. una sola acción que representa;
2. un objeto principal;
3. un máximo de tres apoyos;
4. un color dominante ya presente en Dermalysse;
5. una razón clara para existir en la interfaz.

Si el concepto se puede resolver mejor con un icono Lucide pequeño, no se genera una ilustración. Soft 3D se reserva para categorías, modalidades, hitos y momentos editoriales importantes.
