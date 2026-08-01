# Phase: Palette Tool Expansion

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `remap_colors_in_cel_range`, `list_palette_presets`, `apply_palette_preset`, `generate_color_ramp`, `quantize_to_palette`, and `set_color_mode`.

The palette port separates pure ramp generation from Aseprite mutations, preserves alpha during remapping and quantization, supports optional cel creation from a source frame, and exposes a bounded set of retro palette presets.

## TDD and bug hunting

Contract tests cover traversal, empty/invalid mappings, unknown presets, ramp bounds, invalid frame ranges, and unsupported color modes before Aseprite starts. MCP E2E initially caught a stale test scenario that attempted to process a frame already deleted earlier in the workflow; the test now uses the surviving frame, while the gateway keeps rejecting invalid ranges.

Quantization uses cached nearest-color lookup and only changes opaque pixels. Mode conversion is restricted to RGB, grayscale, and indexed values; arbitrary format strings never reach Lua.

## Verification evidence

- TypeScript typecheck: passed.
- Gateway and real Aseprite tests: 24 passed, 0 failed in the focused run.
- MCP stdio E2E: 3 passed, 0 failed.
- Full branch suite target: 31 tests expected after final verification.
- Registered TypeScript MCP tools: 79.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is pixel-read tools, followed by selection, transforms, text, tilemap, slices, preview, quality, and script tools. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
