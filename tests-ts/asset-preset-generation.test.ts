import assert from "node:assert/strict";
import test from "node:test";
import { AssetLibraryService } from "../src/application/services/AssetLibraryService.js";
import { AssetPresetGenerationService } from "../src/application/services/AssetPresetGenerationService.js";
import type { AssetLibraryCatalog } from "../src/domain/asset-library.js";
import type { AssetOperationResult } from "../src/domain/asset-operations.js";

const catalog: AssetLibraryCatalog = {
  schemaVersion: 1,
  libraryVersion: "test",
  categories: [{ id: "biomes-and-maps", title: "Biomes", description: "Maps", itemCount: 1 }],
  items: [{ id: "beach", title: "Beach", category: "biomes-and-maps", folder: "biomes-and-maps/beach", kind: "scene", description: "Beach", tags: ["beach"], variants: ["wave-reflection"], formats: ["png", "gif", "json"], readmePath: "beach/README.md", previewPath: "beach/preview.png", spritePath: "beach/sprite-sheet.png", deterministic: true }],
  presets: [{ id: "coastal-sunset", title: "Coastal sunset", description: "Beach and reflections", category: "biomes-and-maps", itemIds: ["beach"], recommendedTools: ["generate_beach_scene"], deterministic: true }],
};

function result(operation: string): AssetOperationResult { return { ok: true, message: JSON.stringify({ operation, artifacts: { previewPng: "coast-preview.png" }, deterministic: true, sourcePreserved: true }) }; }

test("asset preset generation resolves a preset and delegates scene work to the visual gateway", async () => {
  const calls: unknown[] = [];
  const service = new AssetPresetGenerationService(new AssetLibraryService({ load: async () => catalog, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) }), { generateEnvironmentPack: async (input) => { calls.push(input); return result("generate_environment_pack"); } });
  const generated = await service.generate({ presetId: "COASTAL-SUNSET", outputPrefix: "art/coast", width: 32, height: 24, seed: 9, tileSize: 8, detailLevel: "high" });
  assert.equal(generated.ok, true);
  const payload = JSON.parse(generated.message) as { operation: string; presetId: string; environmentKind: string; composition: { layers: unknown[] }; generation: { operation: string } };
  assert.equal(payload.operation, "generate_asset_preset");
  assert.equal(payload.presetId, "coastal-sunset");
  assert.equal(payload.environmentKind, "beach");
  assert.equal(payload.composition.layers.length, 1);
  assert.equal(payload.generation.operation, "generate_environment_pack");
  assert.deepEqual(calls[0], { kind: "beach", outputPrefix: "art/coast", width: 32, height: 24, seed: 9, tileSize: 8, detailLevel: "high" });
});

test("asset preset generation fails compactly for unknown presets", async () => {
  const service = new AssetPresetGenerationService(new AssetLibraryService({ load: async () => catalog, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) }), { generateEnvironmentPack: async () => result("generate_environment_pack") });
  const generated = await service.generate({ presetId: "missing", outputPrefix: "out", width: 32, height: 24, seed: 1 });
  assert.equal(generated.ok, false);
  assert.match(generated.message, /preset/i);
});
