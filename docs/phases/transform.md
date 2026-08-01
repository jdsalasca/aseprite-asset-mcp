# Fase: transformación de capas y lienzo

## Alcance

Esta fase migra `flip_layer`, `rotate_layer`, `resize_canvas` y `crop_canvas` desde el runtime heredado al límite hexagonal TypeScript.

## Blindaje TDD y hallazgos

- Se validan rutas, nombres de capa, índices de frame, dimensiones enteras positivas, coordenadas enteras de recorte, dirección y ángulos permitidos antes de iniciar Aseprite.
- La rotación conserva el tamaño local y la posición del cel para no desplazarlo silenciosamente; solo intercambia ancho y alto cuando corresponde.
- El recorte rechaza rectángulos completamente fuera del lienzo dentro del script Lua, evitando que Aseprite ejecute una operación inválida.
- Las pruebas de integración verifican que los píxeles sobreviven a un flip y una rotación reales, además de resize y crop contra la instalación local de Aseprite.

## Verificación

- `npm run typecheck`
- `npx tsx --test tests-ts/gateway-validation.test.ts tests-ts/integration/real-aseprite.test.ts tests-ts/mcp-server.test.ts`
- `npm test`
- `git diff --check`

La migración sigue siendo parcial mientras permanecen herramientas upstream de texto, tilemap, slices, preview, calidad, escena y script.
