# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-10-03

### Fixed
- `compose_asset_scene_animation` composed from the static preview and returned 1 frame instead of N; it now uses the library's animation sheets (339 items) and cycles their 4 real frames.
- `inspect_animation_quality` flagged a "loop seam" on any real cycle; it now only flags it when the seam exceeds twice the median of the internal changes.
- `generate_particle_burst` was invisible (1 px particles collapsing to 3 pixels, and continuous alpha made the encoder merge frames); it now has an ignition core, radial streaks, and color shading with opaque pixels.
- `compose_asset_scene` stacked every layer in the center, so only the last one was visible; each layer now occupies a cell of a grid.
- The burst core tinted toward a fixed warm shift and came out magenta with cool colors; it now blends toward white.
- `server_capabilities` reported a hardcoded version; it is now derived from `package.json`.

## [1.1.0] - 2026-10-02

### Added
- `generate_day_night_cycle` accepts an optional `manifest_filename` and writes a deterministic JSON manifest (`kind: "day_night_cycle"`, phases `day/sunset/night/sunrise`); the result reports `manifest` (or `null`).

### Changed
- REST: `POST /api/v1/assets/enhancement-bundle` renamed to `POST /api/v1/assets/enhancement-plan`; internal service/port renamed to `EnhancementPlanService`/`enhancementPlan`.

### Breaking
- REST route `/enhancement-bundle` now returns 404 (use `/enhancement-plan`).
- Payload label for composed enhancements changes from `apply_enhancement_bundle` to `apply_enhancement_plan`; the batch item results do not expose that label.

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
