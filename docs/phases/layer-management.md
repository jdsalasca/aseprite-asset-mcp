# Phase: Layer Management

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `delete_layer`, `rename_layer`, `duplicate_layer`, `reorder_layer`, `set_layer_blend_mode`, `merge_layer_down`, and `flatten_sprite`.

The operations are exposed through the domain port, application service, secure Aseprite CLI gateway, and typed MCP schemas. Duplication copies every existing cel, preserving cel opacity, layer opacity, blend mode, image position, and frame coverage.

## TDD and bug hunting

Contract tests cover traversal, empty names, invalid positions, and unsupported blend modes before Aseprite starts. Real workflow tests caught two interaction bugs in the first scenario: reordering to the bottom made merge-down correctly reject the request, and flattening removed a layer needed by a later cel assertion. The test flow now verifies each behavior in a valid state and keeps post-flatten assertions independent of layer names.

The gateway rejects group duplication as a layer operation, validates the source and destination groups, preserves cel metadata, and only sends allow-listed blend-mode constants to Lua.

## Verification evidence

- TypeScript typecheck: passed.
- Real Aseprite integration: passed all seven layer operations.
- MCP stdio E2E: passed discovery and execution of all seven operations.
- Full suite target: 28 tests expected after final branch verification.
- Registered TypeScript MCP tools: 70.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is legacy FX compatibility (`outline_cel` and `replace_color`). Graphify and Harness Moon records are regenerated with the current counts and continuation target.
