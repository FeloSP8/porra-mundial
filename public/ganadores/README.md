# Imágenes de ganador

Aquí van las imágenes que se muestran en la portada (home) cuando **termina el
torneo** (una vez jugada la final). Se muestra la del **ganador de la porra**
(el 1º de la clasificación general).

## Cómo nombrar los archivos

El nombre del archivo es el **nombre del jugador** (su `display_name`)
convertido a "slug":

- minúsculas
- sin acentos
- los espacios y cualquier símbolo pasan a guion `-`

Extensión `.jpg` (si no existe, se prueba `.png`).

### Ejemplos

| Nombre del jugador | Archivo a subir            |
| ------------------ | -------------------------- |
| `Julio`            | `julio.jpg`                |
| `José María`       | `jose-maria.jpg`           |
| `Ana Belén`        | `ana-belen.jpg`            |

Sube una imagen por cada posible ganador (`public/ganadores/<slug>.jpg`). Si el
ganador no tiene imagen, la portada muestra un banner de texto con el trofeo,
así que nunca se rompe.

> La imagen se muestra a lo ancho, centrada, con un máximo del 70% de la altura
> de la pantalla. Recomendado: horizontal o cuadrada, y comprimida (< 1–2 MB).
