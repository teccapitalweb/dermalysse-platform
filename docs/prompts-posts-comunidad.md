# Dermalysse · Prompts de publicaciones del equipo — **1:1 cuadrado (feed Comunidad)**

Posts tipo Instagram para que **@dermalysse** (voz oficial del club) aparezca de forma regular en el feed de Comunidad. Formato cuadrado, estilo editorial Dermalysse, listo para pegar en Nano Banana 2.1.

## Cómo hacerlo

1. **Configura:** Imagen · proporción **1:1** · modelo **Nano Banana 2.1** · **x2** opciones.
2. **No adjuntes logo** (en el feed el nombre `@dermalysse` ya se muestra con el avatar del post, el posteo no necesita logo encima).
3. **Pega el bloque gris** del tipo de post que quieras generar.
4. **Guarda** con el nombre que indica cada bloque. Yo lo optimizo a WebP y lo coloco en `public/posts/`.
5. **Sube el post real** editando `src/core/comunidad.ts` → `SEMILLA` con la imagen (yo te hago el campo cuando pases 2-3).

### Checklist visual antes de aceptar la imagen

- Paleta **crema (#f6f5f1), vino (#681c31), rosa mineral (#f0b5be), azul tinta (#0b2435)** y ningún color más.
- **Sin rostros reconocibles** de personas reales. Si aparece una persona, de perfil, con cabello cubriendo o enfoque muy cercano a manos / cuello / detalle de piel.
- **Sin agujas penetrando piel, sin sangre, sin heridas abiertas**.
- **Sin texto inventado** dentro de la imagen (ni títulos ni frases). El texto va en la caption del post, no en la foto.
- **Composición centrada** con buen aire alrededor.
- **Iluminación suave** tipo spa / editorial de belleza, nunca luz fría clínica.

---

## Super prompt base

Este es el **esqueleto que no cambia**. Solo sustituyes `[SUJETO ESPECÍFICO DEL POST]` por el detalle de cada tipo:

```
Premium editorial square photograph for an Instagram-style post of a professional skincare / aesthetics education brand, 1:1 square format. [SUJETO ESPECÍFICO DEL POST]. Modern aesthetic skincare studio, soft diffused daylight falling from the upper left, warm editorial palette of cream, deep bordeaux wine, muted mineral rose and ink navy over soft neutral surfaces, shallow depth of field, crisp macro detail, photorealistic, calm and sophisticated. Center the main subject with generous negative space around it, keep the composition balanced so a text overlay is not required: this photo is strong on its own. No letters, no numbers, no watermark, no logo, no borders. Gloved professional hands only when hands appear, no recognizable patient faces, no needles piercing skin, no blood, no open wounds.
```

---

## Los 6 tipos de post

### 01 · Novedad editorial · nuevo módulo publicado
**Cuándo usarlo:** cada vez que publiques un curso o módulo nuevo del catálogo.
**Guardar como:** `post-novedad-modulo`
**Caption sugerido:** *"Nuevo módulo en el club: **[Nombre del módulo]**. Ya disponible dentro de tu catálogo Dermalysse."*

```
Premium editorial square photograph for an Instagram-style post of a professional skincare / aesthetics education brand, 1:1 square format. An elegant still life flat lay on cream linen: an open hardcover notebook with a quality fountain pen resting diagonally across it, a small amber glass dropper bottle with a cosmetic serum, dried rose petals and a single eucalyptus sprig arranged with intention, a brass bookmark peeking between pages. The scene suggests a new chapter being written in a knowledge library. Modern aesthetic skincare studio, soft diffused daylight falling from the upper left, warm editorial palette of cream, deep bordeaux wine, muted mineral rose and ink navy over soft neutral surfaces, shallow depth of field, crisp macro detail, photorealistic, calm and sophisticated. Center the main subject with generous negative space around it, keep the composition balanced so a text overlay is not required: this photo is strong on its own. No letters, no numbers, no watermark, no logo, no borders. Gloved professional hands only when hands appear, no recognizable patient faces, no needles piercing skin, no blood, no open wounds.
```

---

### 02 · Tip del día · fotoprotección responsable
**Cuándo usarlo:** cualquier día que quieras publicar un recordatorio educativo. Puedes rotar: fotoprotección, hidratación, higiene de cabina, consentimiento.
**Guardar como:** `post-tip-fotoproteccion`
**Caption sugerido:** *"Recordatorio del equipo Dermalysse: la fotoprotección diaria no cambia por el clima. SPF 50+, cada día del año. #CriterioProfesional"*

```
Premium editorial square photograph for an Instagram-style post of a professional skincare / aesthetics education brand, 1:1 square format. A beautifully composed still life of three unlabeled frosted glass sunscreen bottles of different heights, arranged in a soft triangular composition on travertine stone, a small folded white linen cloth beside them, a single sprig of fresh fig leaf casting a delicate shadow suggesting midday sun protection. Natural rays of warm sunlight catch the edge of the bottles. Modern aesthetic skincare studio, soft diffused daylight falling from the upper left, warm editorial palette of cream, deep bordeaux wine, muted mineral rose and ink navy over soft neutral surfaces, shallow depth of field, crisp macro detail, photorealistic, calm and sophisticated. Center the main subject with generous negative space around it, keep the composition balanced so a text overlay is not required: this photo is strong on its own. No letters, no numbers, no watermark, no logo, no borders. Gloved professional hands only when hands appear, no recognizable patient faces, no needles piercing skin, no blood, no open wounds.
```

---

### 03 · Agenda · próxima clase en vivo
**Cuándo usarlo:** 48-72 h antes de una transmisión en vivo.
**Guardar como:** `post-agenda-envivo`
**Caption sugerido:** *"Este [día] nos vemos en vivo con el equipo académico. Tema: **[Tema]**. Reserva tu lugar desde En Vivo."*

```
Premium editorial square photograph for an Instagram-style post of a professional skincare / aesthetics education brand, 1:1 square format. A refined still life of a modern analog brass desk clock reading an elegant time, a leather-bound classic agenda book slightly open, a ceramic cup of specialty coffee with faint steam rising, a small vase with a single pink peony and two sprigs of eucalyptus, suggesting the quiet moments before an important meeting. Soft warm morning window light. Modern aesthetic skincare studio, soft diffused daylight falling from the upper left, warm editorial palette of cream, deep bordeaux wine, muted mineral rose and ink navy over soft neutral surfaces, shallow depth of field, crisp macro detail, photorealistic, calm and sophisticated. Center the main subject with generous negative space around it, keep the composition balanced so a text overlay is not required: this photo is strong on its own. No letters, no numbers, no watermark, no logo, no borders. Gloved professional hands only when hands appear, no recognizable patient faces, no needles piercing skin, no blood, no open wounds.
```

---

### 04 · Caso de criterio · ¿qué harías tú?
**Cuándo usarlo:** cuando quieras abrir conversación en Comunidad. El post invita a debatir un escenario.
**Guardar como:** `post-caso-criterio`
**Caption sugerido:** *"Caso de criterio del jueves: una paciente llega sin cita pidiendo un procedimiento para un evento en 48 h. ¿Qué harías tú? Cuéntanos en comentarios."*

```
Premium editorial square photograph for an Instagram-style post of a professional skincare / aesthetics education brand, 1:1 square format. An over-the-shoulder editorial perspective of a professional's workspace: a half-finished skincare consultation form on quality paper beside a vintage magnifying glass, a cup of herbal tea, a small terracotta pot with a succulent, and a partially open leather folder with blank organized tabs. The scene suggests a thoughtful moment of professional reflection. Modern aesthetic skincare studio, soft diffused daylight falling from the upper left, warm editorial palette of cream, deep bordeaux wine, muted mineral rose and ink navy over soft neutral surfaces, shallow depth of field, crisp macro detail, photorealistic, calm and sophisticated. Center the main subject with generous negative space around it, keep the composition balanced so a text overlay is not required: this photo is strong on its own. No letters, no numbers, no watermark, no logo, no borders. Gloved professional hands only when hands appear, no recognizable patient faces, no needles piercing skin, no blood, no open wounds.
```

---

### 05 · Material disponible · nueva ficha o guía
**Cuándo usarlo:** cuando subas un material nuevo a la Biblioteca.
**Guardar como:** `post-material-nuevo`
**Caption sugerido:** *"Ya disponible en Biblioteca: **[Nombre del material]**. Un formato de trabajo para que lo personalices con tu propia metodología."*

```
Premium editorial square photograph for an Instagram-style post of a professional skincare / aesthetics education brand, 1:1 square format. A sophisticated flat lay of a stack of three cream-colored premium folders tied with a thin bordeaux grosgrain ribbon, a brass paper clip holding a few pages, a wax seal set in deep bordeaux wax (unstamped surface, pure color), a small vintage brass stamp beside it, dried hydrangea petals scattered sparsely as a decorative accent. The composition suggests archival documents being carefully prepared and shared. Modern aesthetic skincare studio, soft diffused daylight falling from the upper left, warm editorial palette of cream, deep bordeaux wine, muted mineral rose and ink navy over soft neutral surfaces, shallow depth of field, crisp macro detail, photorealistic, calm and sophisticated. Center the main subject with generous negative space around it, keep the composition balanced so a text overlay is not required: this photo is strong on its own. No letters, no numbers, no watermark, no logo, no borders. Gloved professional hands only when hands appear, no recognizable patient faces, no needles piercing skin, no blood, no open wounds.
```

---

### 06 · Behind the scenes · así se hace un curso Dermalysse
**Cuándo usarlo:** 1 vez al mes, para humanizar al equipo y mostrar el trabajo editorial detrás del contenido.
**Guardar como:** `post-behind-scenes`
**Caption sugerido:** *"Detrás de cada clase hay horas de revisión, grabación y edición. Así es como armamos los módulos que llegan a tu club."*

```
Premium editorial square photograph for an Instagram-style post of a professional skincare / aesthetics education brand, 1:1 square format. A tasteful workspace scene from an editorial production desk: a professional camera lens laid on cream velvet, a small desktop monitor showing an abstract waveform (no readable text), a pair of elegant studio headphones, a steel pen and a storyboard notebook with hand-drawn blank panels, warm desk lamp light pooling across the scene. Suggests careful editorial craft. Modern aesthetic skincare studio, soft diffused daylight falling from the upper left, warm editorial palette of cream, deep bordeaux wine, muted mineral rose and ink navy over soft neutral surfaces, shallow depth of field, crisp macro detail, photorealistic, calm and sophisticated. Center the main subject with generous negative space around it, keep the composition balanced so a text overlay is not required: this photo is strong on its own. No letters, no numbers, no watermark, no logo, no borders. Gloved professional hands only when hands appear, no recognizable patient faces, no needles piercing skin, no blood, no open wounds.
```

---

## Cómo los sembramos en el feed

Cuando me pases 3-4 imágenes ya exportadas:

1. Las optimizo a **WebP** 1080×1080 y las guardo como `public/posts/<slug>.webp`.
2. Agrego los posts al `SEMILLA` de `src/core/comunidad.ts` con:
   - `autor: "Equipo Dermalysse"`
   - `imagen: "/posts/<slug>.webp"` (voy a extender el tipo `Hilo` para soportar `imagen?: string`)
   - `cursoId: null` (porque son publicaciones del equipo, no preguntas asociadas a un curso)
   - Fechas escalonadas para que aparezcan en orden
3. Ajusto `tarjetaHilo()` para que **priorice `h.imagen` sobre `c.portada`** cuando exista.

Así los posts de @dermalysse se mezclan con los hilos de la comunidad en el feed, exactamente como una cuenta oficial de Instagram.

---

## Variantes útiles sin re-escribir el prompt

Si quieres variar sin cambiar el estilo general, en el bloque de cada tipo puedes jugar con:

- **Hora del día:** reemplaza `morning` por `late afternoon golden` o `evening amber`.
- **Ángulo:** `flat lay from directly above (90° overhead)` → `three-quarters perspective, 45° angle` → `extreme macro close-up`.
- **Acento vegetal:** `eucalyptus` → `dried lavender` → `olive branch` → `fresh fig leaf`.
- **Material base:** `cream linen` → `travertine stone` → `aged walnut wood` → `brushed brass tray`.
- **Humor:** añade `celebratory, warm` para posts de milestone, o `serene, meditative` para tips de autocuidado.

Mantén siempre la última línea del prompt (**la de las restricciones**) sin cambios: es la que protege la marca.

---

## Reglas no negociables (idénticas a las de portadas de curso)

- Nombre oficial: **Dermalysse** (una sola palabra).
- Paleta: crema, vino, rosa mineral, azul tinta. Nada más.
- **Nunca** rostros reconocibles de pacientes ni testimonios con fotografía identificable.
- **Nunca** agujas penetrando piel, sangre, lesiones abiertas o afirmaciones clínicas en imagen.
- **Nunca** texto inventado dentro de la imagen (ni precios, ni promesas, ni citas).
- Si una imagen generada rompe cualquiera de estas reglas, se descarta y se regenera.
