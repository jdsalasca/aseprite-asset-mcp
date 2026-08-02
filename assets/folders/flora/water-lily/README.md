# water lily

water lily prop for layered scenes.

- **ID:** `water-lily`
- **Categoría:** `flora`
- **Formatos base:** PNG, SVG y JSON
- **Archivos:** [preview.png](./preview.png), [sprite-sheet.png](./sprite-sheet.png), [manifest.json](./manifest.json)
- **Reproducible:** sí; el catálogo y los previews se generan con la semilla derivada del ID.

## Variantes

- `rain`: variante determinista sugerida para el pipeline.
- `wind`: variante determinista sugerida para el pipeline.
- `snow`: variante determinista sugerida para el pipeline.
- `fire`: variante determinista sugerida para el pipeline.

## Ejemplo MCP

Busca este asset con `get_asset_library` y después compón una receta con `create_asset_recipe`. Para una salida animada, usa `run_asset_recipe` con `animation_pixel_art` o aplica el efecto indicado por la variante.

## Carpeta

`flora/water-lily`
