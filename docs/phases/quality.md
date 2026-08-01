# Fase: calidad y sanitización de animaciones

## Alcance

Esta fase migra `ensure_layers_present`, `audit_animation` y `animation_sanitize`.

## Blindaje TDD y hallazgos

- Se validan rangos, límites de reporte, acciones de sanitización y opacidad antes de iniciar Aseprite.
- La auditoría devuelve JSON con cels, bounds, overlaps y actividad fuera de rangos declarados.
- La sanitización soporta modo reporte, creación de cels faltantes, opacidad cero y eliminación de cels fuera de rango.
- Se detectó un bug de sintaxis Lua provocado por bloques de control comprimidos; se corrigió expandiendo los bloques y se dejó una prueba real de sanitización para evitar regresión.
- Los errores del ejecutable ahora incluyen stdout/stderr cuando están disponibles, facilitando diagnóstico de futuros fallos.

## Verificación

- `npm run typecheck`
- `npx tsx --test tests-ts/gateway-validation.test.ts tests-ts/integration/real-aseprite.test.ts tests-ts/mcp-server.test.ts`
- `npm test`
- `git diff --check`

La migración continúa parcial; quedan preview, copia entre escenas, controles de animación heredados y ejecución de scripts endurecida.
