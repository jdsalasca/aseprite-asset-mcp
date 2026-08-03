# Asset folders

Esta biblioteca contiene 339 carpetas deterministas. Cada carpeta incluye README, manifest, preview PNG/SVG y sprite sheet PNG/SVG/GIF animado.

## Calidad y procedencia

- El renderer v2 usa celdas de 64×64, formas por dominio y renderizado crispEdges; los sprites no usan el bloque universal anterior.
- La suite comprueba dimensiones, transparencia, cobertura, complejidad de silueta y componentes conectados para fauna, monturas y personajes.
- El ciervo es un caso derivado de referencia pública: su manifest conserva URL, licencia, hash y parámetros de conversión.
- Para reproducirlo usa `DEER_REFERENCE_FILENAME=<ruta> npm run asset:reference-fauna`.

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
