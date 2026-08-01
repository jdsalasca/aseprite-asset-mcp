# Phase: Legacy FX Compatibility

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `outline_cel` and `replace_color`, preserving compatibility with the upstream pixel-oriented FX tools alongside the native effects.

The outline reads from a cloned image so newly written outline pixels cannot cascade into later decisions. Color replacement operates only on opaque pixels, preserves each pixel's alpha, reports the replacement count, and supports bounded per-channel tolerance.

## TDD and bug hunting

Contract tests cover traversal, invalid colors, non-positive frames, and tolerance outside 0..255 before Aseprite starts. Integration tests verified real outline and replacement behavior on a normalized cel, while MCP stdio verified discovery and execution through the public schemas.

The main bug risks were prevented explicitly: source-image cloning avoids runaway outlines, alpha is retained during replacement, and no arbitrary Lua command or unbounded tolerance reaches Aseprite.

## Verification evidence

- TypeScript typecheck: passed.
- Gateway and real Aseprite tests: 22 passed, 0 failed in the focused run.
- MCP stdio E2E: 3 passed, 0 failed.
- Full branch suite target: 29 tests expected after final verification.
- Registered TypeScript MCP tools: 72.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is legacy HSL adjustment, followed by the remaining palette, pixel-read, selection, transform, text, tilemap, slice, preview, quality, and script tools. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
