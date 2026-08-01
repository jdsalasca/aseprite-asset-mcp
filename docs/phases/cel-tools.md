# Phase: Import and Cel Tools

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `import_image_as_layer`, `create_cel`, `clear_cel`, `copy_cel`, and `copy_frame`.

The MCP adapter calls the application service and the `AsepriteGateway` port. The CLI adapter validates all paths, layer names, frame indexes, coordinates, and copy flags before building Lua.

## TDD and bug hunting

Tests cover unsafe image paths, invalid frame indexes, blank layer names, and invalid source/target frame contracts before Aseprite starts.

The implementation improves behavior over the upstream scripts by reporting a missing source cel as an error instead of silently returning success. `copy_frame` recursively visits nested groups and preserves source cel positions while cloning images. `import_image_as_layer` checks that the source image exists before starting Aseprite and creates the destination layer when absent.

## Verification evidence

- `npm test`: 21 passed, 0 failed.
- TypeScript typecheck: passed.
- Real Aseprite integration: passed image import, cel creation, cel copy, frame copy, and cel deletion.
- MCP stdio E2E: passed all five tools after real image export.
- Registered TypeScript MCP tools: 42.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is frame propagation and position tools. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
