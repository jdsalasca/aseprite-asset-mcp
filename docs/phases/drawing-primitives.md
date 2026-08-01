# Phase: Drawing Primitives

## Objective

Migrate the upstream drawing primitives through the hexagonal TypeScript layers.

Blind every input before process execution.

## Evidence

- Upstream inventory: 116 tools at commit 90d1696a7e41edff89bbd0823ae6a5f86c114bcc.
- TypeScript server: 23 registered tools.
- Tests: 16 passed, 0 failed.
- Real Aseprite integration: passed.
- MCP stdio E2E: passed.
- Diff check: passed.

## Migrated tools

- draw_pixels
- draw_line
- draw_rectangle
- fill_area
- draw_circle

## Bugs found and fixed

- Reject traversal before drawing.
- Reject empty pixel batches.
- Reject non-integer coordinates.
- Reject invalid colors.
- Reject non-positive line thickness.
- Reject non-positive circle radius.
- Support short and long hexadecimal colors.

## Architecture

- Domain defines typed drawing ports.
- Application service delegates use cases.
- Aseprite gateway owns Lua and process execution.
- MCP adapter owns runtime schemas and responses.

## Status

- Integration status: verified.
- Commit: 2cb135e.
- Merge status: merged into develop through 524e66d.
- Risk level: best.
- Blockers: none.
- Next phase: layer and frame drawing tools.
