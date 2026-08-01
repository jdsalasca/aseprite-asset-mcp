# Phase: Polygon, Path, and Gradient Tools

Status: implemented and verified on the migration branch.

## Scope

This slice migrates the upstream tools `draw_polygon`, `draw_path`, and `apply_gradient_rect`.

The MCP adapter validates the request and calls the application service. The service uses the `AsepriteGateway` port. The CLI adapter validates paths, names, frame indexes, points, dimensions, colors, and thickness before generating Lua.

## TDD and bug hunting

Tests were added before implementation for unsafe paths, too few polygon/path points, non-integer point coordinates, invalid gradient dimensions, and invalid colors.

The migration also fixes a boundary bug in targeted drawing: an existing cel can have a non-zero position or a partial image. The adapter now normalizes such cels to a canvas-sized image at `(0, 0)` before drawing. New polygon, path, and gradient writes use bounds checks so out-of-canvas coordinates do not crash Aseprite.

## Verification evidence

- `npm test`: 18 passed, 0 failed.
- TypeScript typecheck: passed.
- Real Aseprite integration: passed with polygon fill, polyline, and horizontal gradient on `body`, frame 2.
- MCP stdio E2E: passed with handshake, capabilities, tool calls, and PNG/JSON export.
- Registered TypeScript MCP tools: 31.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is `draw_ellipse_at` and the export helpers. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
