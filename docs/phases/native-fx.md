# Phase: Native Color Effects

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `outline_native`, `adjust_hsl_native`, `adjust_brightness_contrast`, and `invert_colors`.

The gateway activates the requested layer and frame, optionally scopes the command with a selection rectangle, invokes Aseprite native commands, and saves through the existing hexagonal gateway boundary.

## TDD and bug hunting

Tests cover unsafe paths, invalid outline colors and placement, HSL bounds, brightness/contrast bounds, and malformed regions before Aseprite starts.

Native effects use bounded numeric contracts and reject partially specified regions. The adapter does not interpolate arbitrary user commands; it constructs fixed native command names and validated arguments.

## Verification evidence

- `npm test`: 26 passed, 0 failed.
- TypeScript typecheck: passed.
- Real Aseprite integration: passed outline, HSL, brightness/contrast, and invert commands.
- MCP stdio E2E: passed all four native effects.
- Registered TypeScript MCP tools: 59.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is convolution and dither tools. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
