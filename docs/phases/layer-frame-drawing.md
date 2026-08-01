# Phase: Layer-Frame Drawing Tools

Status: implemented and verified on the migration branch.

## Scope

This slice migrates the upstream tools that draw on an explicit layer and animation frame:

- `draw_pixels_at`
- `draw_line_at`
- `draw_rectangle_at`
- `fill_area_at`
- `draw_circle_at`

The implementation keeps the hexagonal boundary: MCP schemas call the application service, the service calls the `AssetGateway` port, and the CLI adapter translates the operation into a validated Aseprite Lua script.

## TDD and bug hunting

The first test pass covered unsafe paths, empty layer names, non-positive frame indexes, empty pixel lists, non-integer coordinates, invalid dimensions, invalid radii, invalid thickness, and invalid colors. The gateway rejects these inputs before starting Aseprite.

The implementation also creates a missing cel only when `create_if_missing` is enabled, selects the requested layer and frame, and reports missing layers or out-of-range frames as operation errors. Layer names and paths are validated before Lua interpolation.

## Verification evidence

- `npm test`: 17 passed, 0 failed.
- TypeScript typecheck: passed.
- Real Aseprite integration: passed with a real `.aseprite` document, layer `body`, frame 2, and all five tools.
- MCP stdio E2E: passed with handshake, capabilities, layer/frame setup, all five tools, and PNG/JSON export.
- Registered TypeScript MCP tools: 28.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is `draw_polygon`, `draw_path`, and `apply_gradient_rect`. The generated Graphify graph and Harness Moon continuation record remain the source of truth for pending tools and continuation.
