# Phase: Animation Controls

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `delete_frame`, `delete_tag`, and `set_onion_skin`.

The MCP adapter calls the application service and gateway port. Frame and tag deletion run validated Aseprite Lua. Onion-skin settings validate their contract and report the batch-mode limitation because Aseprite does not persist those UI settings through the batch adapter.

## TDD and bug hunting

Tests cover traversal, non-positive frame indexes, blank tag names, negative before/after counts, and opacity outside 0-255 before Aseprite starts.

The gateway refuses to delete the only frame, reports missing tags, and does not claim that a UI-only onion-skin setting was persisted.

## Verification evidence

- `npm test`: 23 passed, 0 failed.
- TypeScript typecheck: passed.
- Real Aseprite integration: passed tag deletion, frame deletion, and onion-skin contract validation.
- MCP stdio E2E: passed tool discovery and all three controls.
- Registered TypeScript MCP tools: 49.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is `render_onion_skin` and `compare_frames`, followed by cel opacity and palette analysis. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
