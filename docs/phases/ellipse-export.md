# Phase: Ellipse and Basic Export Tools

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `draw_ellipse_at`, `export_sprite`, `copy_sprite`, and `export_frame`.

The MCP adapter calls the application service, the service uses the gateway port, and the CLI adapter validates paths, formats, frame indexes, scale, colors, radii, and output existence before reporting success.

## TDD and bug hunting

Tests cover unsafe paths, invalid ellipse radii, unsafe export formats, invalid frame indexes, and invalid scales before Aseprite starts.

Real testing found an output-name bug: Aseprite can write frame-numbered sibling files for multi-frame exports even when the command exits successfully. The adapter now detects that result, renames the produced file to the requested output path, and only then reports success.

## Verification evidence

- `npm test`: 19 passed, 0 failed.
- TypeScript typecheck: passed.
- Real Aseprite integration: passed ellipse drawing, sprite export, Aseprite copy, and scaled frame export.
- MCP stdio E2E: passed handshake, capabilities, ellipse drawing, all basic exports, and file existence checks.
- Registered TypeScript MCP tools: 35.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is `export_layers` and `export_tag`, followed by import and cel-processing tools. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
