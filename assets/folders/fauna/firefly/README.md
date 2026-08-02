# firefly

firefly with idle, walk, hit and habitat variants.

- **ID:** `firefly`
- **Categoría:** `fauna`
- **Formatos base:** PNG, GIF animado, SVG y JSON
- **Archivos:** [preview.png](./preview.png), [sprite-sheet.png](./sprite-sheet.png), [sprite-sheet.gif](./sprite-sheet.gif), [manifest.json](./manifest.json)
- **Reproducible:** sí; el catálogo y los previews se generan con la semilla derivada del ID.

## Variantes

- `idle`: variante determinista sugerida para el pipeline.
- `walk`: variante determinista sugerida para el pipeline.
- `hit`: variante determinista sugerida para el pipeline.
- `sleep`: variante determinista sugerida para el pipeline.
- `rain`: variante determinista sugerida para el pipeline.

## Ejemplo MCP

Busca este asset con `get_asset_library` y después compón una receta con `create_asset_recipe`. Para una salida animada, usa `run_asset_recipe` con `animation_pixel_art` o aplica el efecto indicado por la variante.

## Carpeta

`fauna/firefly`
