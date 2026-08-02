# flute

flute prop for taverns, churches and festivals.

- **ID:** `flute`
- **Categoría:** `instruments`
- **Formatos base:** PNG, GIF animado, SVG y JSON
- **Archivos:** [preview.png](./preview.png), [sprite-sheet.png](./sprite-sheet.png), [sprite-sheet.gif](./sprite-sheet.gif), [manifest.json](./manifest.json)
- **Reproducible:** sí; el catálogo y los previews se generan con la semilla derivada del ID.

## Variantes

- `clean`: variante determinista sugerida para el pipeline.
- `played`: variante determinista sugerida para el pipeline.
- `golden`: variante determinista sugerida para el pipeline.

## Ejemplo MCP

Busca este asset con `get_asset_library` y después compón una receta con `create_asset_recipe`. Para una salida animada, usa `run_asset_recipe` con `animation_pixel_art` o aplica el efecto indicado por la variante.

## Carpeta

`instruments/flute`
