# Phase: Convolution and Dithering

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `apply_convolution`, `list_convolution_matrices`, `apply_dither_gradient`, and `apply_dither_pattern`.

The hexagonal port keeps native convolution inside the Aseprite gateway and implements the two ordered-dither operations with bounded Lua pixel writes over normalized cels. MCP schemas expose the same contracts without leaking CLI details into the application layer.

## TDD and bug hunting

Tests first covered traversal rejection, unsupported matrix names, malformed regions, invalid dimensions and colors, and out-of-range density. The initial contract test failed because the new gateway operations did not exist; after implementation it passed without starting Aseprite for invalid input.

The main bug risks were addressed explicitly: only the allow-listed matrix resource names can reach Lua, partial or offset cels are normalized before dithering, and every dither write is bounds-checked so a rectangle extending beyond the canvas cannot abort the script.

## Verification evidence

- `npm test`: 27 passed, 0 failed.
- TypeScript typecheck: passed.
- Real Aseprite integration: passed matrix listing, `blur-3x3`, Bayer gradient, and Bayer pattern.
- MCP stdio E2E: passed all four new tools and capability discovery.
- Registered TypeScript MCP tools: 63.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is layer management. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
