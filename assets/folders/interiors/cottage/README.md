# cottage

cottage interior with modular floor, wall, light and prop layers.

- **ID:** `cottage`
- **Categoría:** `interiors`
- **Formatos base:** PNG, GIF animado, SVG, JSON y quality report
- **Archivos:** [preview.png](./preview.png), [sprite-sheet.png](./sprite-sheet.png), [sprite-sheet.gif](./sprite-sheet.gif), [manifest.json](./manifest.json), [quality.json](./quality.json)
- **Calidad:** el manifest y `quality.json` registran el perfil, la paleta, la cobertura, la complejidad y el resultado del gate.
- **Reproducible:** sí; el catálogo y los previews se generan con la semilla derivada del ID.

## Variantes

- `day`: variante determinista sugerida para el pipeline.
- `night`: variante determinista sugerida para el pipeline.
- `firelight`: variante determinista sugerida para el pipeline.
- `rain`: variante determinista sugerida para el pipeline.

## Ejemplo MCP

Busca este asset con `get_asset_library` y después compón una receta con `create_asset_recipe`. Para una salida animada, usa `run_asset_recipe` con `animation_pixel_art` o aplica el efecto indicado por la variante.

## Carpeta

`interiors/cottage`
