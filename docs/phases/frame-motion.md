# Phase: Frame Motion and Propagation

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `set_cel_position`, `tween_cel_positions`, `offset_cel_positions`, and `propagate_frame_to_range`.

The MCP adapter calls the application service and the `AssetGateway` port. The CLI adapter validates paths, layer names, frame indexes, ranges, coordinates, and optional source frames before running Lua.

## TDD and bug hunting

Tests cover traversal, non-positive frames, reversed ranges, invalid source frames, and non-integer coordinates before Aseprite starts.

The TypeScript implementation recursively visits nested groups during propagation, skips the source frame to avoid deleting its source cel, and preserves cel image positions while cloning. Missing cels are created only when the request explicitly enables creation.

## Verification evidence

- `npm test`: 22 passed, 0 failed.
- TypeScript typecheck: passed.
- Real Aseprite integration: passed set, tween, offset, and range propagation operations.
- MCP stdio E2E: passed discovery and all four frame-motion tools.
- Registered TypeScript MCP tools: 46.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is animation copy/delete and onion-skin controls. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
