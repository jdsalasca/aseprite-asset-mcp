# Fase: texto rasterizado

## Alcance

Esta fase migra `list_text_fonts`, `measure_text` y `draw_text` al runtime TypeScript hexagonal. Como Aseprite no ofrece una API Lua de texto, el adaptador rasteriza fuentes TrueType/OpenType con una dependencia JavaScript pura y blitea el PNG transparente resultante en el cel solicitado.

## Blindaje TDD y hallazgos

- Se validan fuente, tamaño, espaciado, bold, coordenadas, frame, anclaje y colores antes de modificar el sprite.
- Se descubrió y corrigió que el bitmap de `pureimage` inicia blanco/opaco: ahora se limpia a alpha cero para impedir rectángulos blancos alrededor del texto.
- Se evita `strokeText` para outlines porque el backend produce advertencias geométricas en algunos glifos; el outline se construye mediante pasadas de glifo, más estable para pixel art.
- Se eliminan los PNG temporales aun cuando Aseprite falle.
- La integración mide y dibuja una fuente del sistema real, verifica color y alpha transparente, y el flujo MCP ejecuta las tres herramientas.

## Verificación

- `npm run typecheck`
- `npx tsx --test tests-ts/gateway-validation.test.ts tests-ts/integration/real-aseprite.test.ts tests-ts/mcp-server.test.ts`
- `npm test`
- `git diff --check`

La migración sigue parcial; quedan tilemap, slices, preview, calidad, escena y ejecución de scripts.
