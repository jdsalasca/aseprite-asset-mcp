# Fase: tilemaps

## Alcance

Esta fase migra `draw_on_tile`, `set_tiles`, `get_tile_at` y `get_tilemap_info`, completando el manejo operativo del tilemap sobre la capa ya creada por `create_tilemap_layer`.

## Blindaje TDD y hallazgos

- Se validan índices reservados, listas no vacías, coordenadas enteras/no negativas, colores y rangos de frame antes de iniciar Aseprite.
- Se agregó guardia contra nombres de capa duplicados al crear una capa tilemap.
- Las lecturas de tile y metadatos usan scripts de solo lectura y no guardan el sprite accidentalmente.
- La información reporta dimensiones de tile, cantidad real de tiles y tamaño del mapa; las pruebas reales verifican que el tile colocado pueda leerse de vuelta.

## Verificación

- `npm run typecheck`
- `npx tsx --test tests-ts/gateway-validation.test.ts tests-ts/integration/real-aseprite.test.ts tests-ts/mcp-server.test.ts`
- `npm test`
- `git diff --check`

La migración continúa parcial; quedan slices, preview, calidad, escena y ejecución de scripts.
