# Phase: Legacy HSL Adjustment

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `adjust_hsl`, the upstream pixel-oriented HSL adjustment tool, alongside the already available native HSL command.

The gateway performs explicit RGB/HSL conversion in bounded Lua, clamps saturation and lightness deltas to the upstream contract, adjusts hue cyclically, processes only opaque pixels, and preserves alpha.

## TDD and bug hunting

Contract tests cover traversal, invalid frame indexes, non-finite shifts, and all three numeric ranges before Aseprite starts. Real Aseprite integration verified the Lua conversion on a normalized cel; MCP stdio verified public discovery and execution.

The native and legacy tools remain separate so callers do not silently change behavior: `adjust_hsl` preserves the upstream per-pixel algorithm, while `adjust_hsl_native` delegates to Aseprite's native command.

## Verification evidence

- TypeScript typecheck: passed.
- Gateway and real Aseprite tests: 23 passed, 0 failed in the focused run.
- MCP stdio E2E: 3 passed, 0 failed.
- Full branch suite target: 30 tests expected after final verification.
- Registered TypeScript MCP tools: 73.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is palette-tool expansion, followed by pixel reads, selection, transforms, text, tilemap, slices, preview, quality, and script tools. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
