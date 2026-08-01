# Phase: Cel Opacity and Palette Analysis

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `set_cel_opacity`, `get_color_stats`, `get_palette`, and `extract_palette`.

The adapter validates cel/frame and palette bounds, runs analysis on a clone where possible, parses structured output into JSON, and persists palette extraction through an explicit Aseprite command.

## TDD and bug hunting

Tests cover unsafe paths, invalid opacity, non-positive statistics limits, and palette limits before Aseprite starts.

Color statistics and palette reads return structured JSON instead of raw command logs. Palette extraction confirms that palette entries were returned after `ColorQuantization`; a successful process with no palette data is treated as failure.

## Verification evidence

- `npm test`: 25 passed, 0 failed.
- TypeScript typecheck: passed.
- Real Aseprite integration: passed cel opacity, color statistics JSON, palette JSON, and palette extraction JSON.
- MCP stdio E2E: passed all four tools.
- Registered TypeScript MCP tools: 55.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is native color effects, including HSL adjustment, brightness/contrast, inversion, and convolution. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
