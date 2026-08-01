# Phase: Selection Tools

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `move_region`, `copy_region`, `erase_region`, and `erase_color`.

The gateway normalizes source and destination cels for cross-layer/frame copies, bounds all region writes to the canvas, treats transparent pixels as non-overwriting during copies, and preserves alpha for moved content. Color erasure reports the number of removed pixels.

## TDD and bug hunting

Contract tests cover traversal, invalid frames, coordinates, dimensions, colors, and tolerance before Aseprite starts. Real Aseprite and MCP workflows exercise move, cross-destination copy, rectangular erase, and tolerance-based color erase.

The main safety risks are addressed in the adapter: out-of-canvas regions are clipped, destination cels are created only for copy operations, and transparent source pixels never erase unrelated destination artwork.

## Verification evidence

- TypeScript typecheck: passed.
- Gateway and real Aseprite tests: 26 passed, 0 failed in the focused run.
- MCP stdio E2E: 3 passed, 0 failed.
- Full branch suite target: 33 tests expected after final verification.
- Registered TypeScript MCP tools: 87.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is transform tools, followed by text, tilemap, slices, preview, quality, and script tools. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
