# Phase: Visual Frame Analysis

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `render_onion_skin` and `compare_frames`.

`render_onion_skin` clones and flattens the sprite, composites neighboring frames with configurable ghost opacity, scales the result with nearest-neighbor pixels, and confirms the requested PNG exists. `compare_frames` returns JSON metrics for changed pixels, total pixels, percent changed, and the changed bounds.

## TDD and bug hunting

Tests cover unsafe output paths, invalid frame indexes, negative before/after values, invalid scale, invalid ghost opacity, and non-positive comparison frames before Aseprite starts.

The MCP E2E initially exposed a sequence bug in the test flow: it deleted frame 2 before asking the renderer to analyze frame 2. The scenario was reordered so analysis runs before destructive deletion; the final E2E verifies the real PNG and JSON response.

## Verification evidence

- `npm test`: 24 passed, 0 failed.
- TypeScript typecheck: passed.
- Real Aseprite integration: passed onion-skin PNG generation and parsed frame-difference JSON.
- MCP stdio E2E: passed discovery, PNG existence, and comparison call.
- Registered TypeScript MCP tools: 51.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is cel opacity and palette/color analysis. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
