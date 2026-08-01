# Phase: Layer and Tag Export Tools

Status: implemented and verified on the migration branch.

## Scope

This slice migrates `export_layers` and `export_tag`.

The gateway validates source and output paths, creates the requested output directory, preflights the animation tag, runs Aseprite through argument arrays, and confirms that new files were produced before returning success.

## TDD and bug hunting

Tests cover traversal in the output directory, blank tag names, and invalid scale values before Aseprite starts.

The tag export preflight closes an upstream reliability gap: a missing tag may still allow Aseprite to exit successfully and write an unrelated output. The TypeScript adapter resolves the tag first and fails with an explicit error when it is absent. Layer export also compares the directory contents before and after the command so stale PNGs cannot prove a new export.

## Verification evidence

- `npm test`: 20 passed, 0 failed.
- TypeScript typecheck: passed.
- Real Aseprite integration: passed per-layer PNG export and `idle` tag GIF export.
- MCP stdio E2E: passed tool discovery, tag creation, layer export, tag export, and output existence checks.
- Registered TypeScript MCP tools: 37.
- Upstream inventory: 116 tools at commit `90d1696a7e41edff89bbd0823ae6a5f86c114bcc`.

## Remaining migration

The migration is partial. The next focused slice is import and cel-processing tools. Graphify and Harness Moon records are regenerated with the current counts and continuation target.
