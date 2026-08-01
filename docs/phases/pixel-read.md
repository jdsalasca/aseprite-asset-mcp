# Phase: Pixel Read Tools

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `get_pixel_color`, `get_pixels_rect`, `get_composite_pixel`, and `get_composite_rect`.

The gateway exposes read-only scripts: cel reads account for cel offsets and return transparent RGBA outside the image; composite reads clone and flatten the sprite without saving the source. Rectangular results are structured JSON with coordinates, lowercase hex, RGB, and alpha.

## TDD and bug hunting

Contract tests cover traversal, non-integer coordinates, invalid frame indexes, and non-positive rectangle dimensions before launching Aseprite. A parser now rejects malformed `PIXEL:` records instead of producing undefined numeric fields or a false success.

Real Aseprite tests cover single-pixel, rectangle, and flattened composite reads. MCP stdio covers public discovery and execution. The read path never calls the mutating script wrapper, so inspection cannot rewrite the asset.

## Verification evidence

- TypeScript typecheck: passed.
- Gateway and real Aseprite tests: focused read tests passed.
- MCP stdio E2E: 3 passed, 0 failed.
- Full branch suite target: 32 tests expected after final verification.
- Registered TypeScript MCP tools: 83.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is selection tools, followed by transforms, text, tilemap, slices, preview, quality, and script tools. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
