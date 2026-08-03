# Asset folders

Esta biblioteca contiene 339 carpetas premium deterministas. Cada carpeta incluye README, manifest, quality report, preview PNG/SVG y sprite sheet PNG/SVG/GIF animado.

## Calidad y procedencia

- El renderer v3 usa celdas de 128×128, capas por dominio, paletas ampliadas, materiales, iluminación, textura y renderizado crispEdges.
- La suite de calidad comprueba dimensiones, paleta, cobertura, transparencia, complejidad de silueta, componentes conectados y perfiles específicos para escenas opacas, efectos y sprites.
- `quality-report.json` resume la auditoría completa para agentes y la UX sin cargar todos los PNG.
- `deer` conserva su procedencia pública y `dragon-ice` conserva su fuente visual premium; sus manifests no se sobrescriben con el renderer genérico.
- Cada carpeta incluye `quality.json` para que un agente pueda filtrar assets válidos sin cargar todos los PNG.

## Navegación rápida

- Consulta `catalog.json` o usa el MCP `get_asset_library`.
- Resuelve un item con `get_asset_library_item`.
- Usa presets con `get_asset_preset`.
- Las variantes de lluvia, fuego, terremoto, pájaros, luz y movimiento se aplican con los algoritmos del MCP.

## Categorías

- [characters](./characters/): 150 items
- [flora](./flora/): 38 items
- [fauna](./fauna/): 21 items
- [mythical creatures](./mythical-creatures/): 20 items
- [mounts](./mounts/): 12 items
- [props and weapons](./props-and-weapons/): 26 items
- [biomes and maps](./biomes-and-maps/): 20 items
- [interiors](./interiors/): 22 items
- [scene effects](./scene-effects/): 20 items
- [instruments](./instruments/): 10 items
