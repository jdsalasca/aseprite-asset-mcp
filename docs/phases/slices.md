# Fase: slices

## Alcance

Esta fase migra `create_slice`, `set_slice_center`, `set_slice_pivot`, `list_slices` y `delete_slice`.

## Blindaje TDD y hallazgos

- Se validan nombres, coordenadas enteras y dimensiones positivas antes de iniciar Aseprite.
- `list_slices` serializa cada slice como JSON Lua, preservando nombres con separadores como `|` sin romper el parseo.
- Las lecturas usan un script de solo lectura; las operaciones de escritura quedan dentro del gateway y sus transacciones.
- La integración real verifica bounds, centro 9-patch, pivote, listado y eliminación.

## Verificación

- `npm run typecheck`
- `npx tsx --test tests-ts/gateway-validation.test.ts tests-ts/integration/real-aseprite.test.ts tests-ts/mcp-server.test.ts`
- `npm test`
- `git diff --check`

La migración continúa parcial; quedan calidad, preview, escena, controles de animación pendientes y script seguro.
