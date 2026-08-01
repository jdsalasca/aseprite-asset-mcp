# Phase: Bug Hunt and Core Animation

## Objective

Find reproducible bugs in the TypeScript runtime.

Migrate the missing core frame and layer property tools.

## Evidence

- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.
- TypeScript server: 18 registered tools.
- Unit, contract, workflow, and MCP tests: 13 passed.
- Real Aseprite integration: passed.
- Diff check: passed.

## Changed files

- `src/infrastructure/aseprite/AsepriteCliGateway.ts`
- `src/domain/aseprite.ts`
- `src/application/ports/AssetGatewayPort.ts`
- `src/interfaces/mcp-server.ts`
- `src/workflows/mcp-client.ts`
- `src/workflows/plans.ts`
- `tests-ts/gateway-validation.test.ts`
- `tests-ts/integration/real-aseprite.test.ts`
- `tests-ts/mcp-server.test.ts`
- `tests-ts/plans.test.ts`
- `docs/graphify/migration.graph.json`
- `docs/graphify/migration.mmd`
- `docs/upstream-tool-inventory.json`
- `.harness-moon/continuation-state.json`

## Bugs fixed

- Reject traversal in all migrated input sprite paths.
- Reject null bytes in paths.
- Reject invalid hexadecimal colors.
- Reject invalid frame ranges before Aseprite starts.
- Reject invalid dimensions and export options.
- Reject false export success when Aseprite writes no output.
- Reject blank workflow layer names.
- Report runtime, commit, migration status, and exact tool count.

## Migration status

- Tools migrated in this phase: `add_frame`, `set_frame`, `set_frame_duration`, `set_frame_duration_all`, `set_layer_visibility`, `set_layer_opacity`.
- Verified existing core tools: canvas, groups, layers, frames, palette, tags, tilemap, scene validation, and spritesheet export.
- Integration status: verified with the installed Aseprite executable.
- Commit: `4032357`.
- Merge status: pending.
- Risk level: `best`.
- Blockers: none for this phase.
- Next phase: drawing tools.
