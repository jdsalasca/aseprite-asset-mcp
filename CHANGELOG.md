# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-20

First public release of the TypeScript/Node MCP server.

### Added

- 185 MCP tools exposed over stdio, a superset of the upstream `diivi` Aseprite MCP tool set.
- Explicit tool catalog with per-tool descriptions and folder grouping (`get_tools_list`, `get_tools_by_folder`, `get_tools_search`) to keep agent context small.
- Deterministic asset jobs (`start_asset_job`, `get_asset_job_status`, `cancel_asset_job`, `batch_asset_job`) with JSON and in-memory stores.
- Artifact resolution and manifest auditing with SHA-256 hashes and optional `ASSET_ARTIFACT_ROOT` sandboxing.
- Quality gates for batches, animation, sprite geometry, hitboxes, anchors, and runtime bundles.
- Godot-ready manifests: spritesheets, atlas packs, scene bundles, terrain tilesets, world maps, and environment packs.
- Deterministic pixel-art enhancements, composable recipes, source variant packs, and a 339-item reusable asset library.
- Dockerfile and docker compose setup for a containerized development image.
- 185 unit/domain tests plus 8 real-Aseprite integration tests.

### Notes

- Requires Node.js 24+ and npm 11+.
- Aseprite must be installed; set `ASEPRITE_PATH` when the executable is not on `PATH`.
- Runtime is ESM (`"type": "module"`) and is built with TypeScript 6.0.3.
