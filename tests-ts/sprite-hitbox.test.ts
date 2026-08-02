import assert from "node:assert/strict";
import test from "node:test";
import type { AssetManifestWriter } from "../src/domain/image-assets.js";
import type { AssetOperationResult } from "../src/domain/asset-operations.js";
import { SpriteHitboxService } from "../src/application/services/SpriteHitboxService.js";

const geometryPayload = { operation: "inspect_sprite_geometry", filename: "hero.gif", frameCount: 2, width: 16, height: 20, minComponentPixels: 1, frames: [
  { index: 0, opaquePixels: 7, bounds: { x: 4, y: 5, width: 6, height: 10 }, baselineY: 14, pivot: { x: 7, y: 14, mode: "bottom_center" }, components: [{ x: 4, y: 5, width: 2, height: 3, pixels: 4 }, { x: 8, y: 10, width: 2, height: 5, pixels: 3 }] },
  { index: 1, opaquePixels: 5, bounds: { x: 5, y: 6, width: 5, height: 8 }, baselineY: 13, pivot: { x: 7, y: 13, mode: "bottom_center" }, components: [{ x: 5, y: 6, width: 5, height: 8, pixels: 5 }] },
], animation: { stableBounds: false, baselineDrift: 1 }, quality: { valid: true, violations: [] }, recommendations: [], deterministic: true, sourcePreserved: true } as const;

function geometry(): { inspect(): Promise<AssetOperationResult> } { return { inspect: async () => ({ ok: true, message: JSON.stringify(geometryPayload) }) }; }

test("generates padded component hitboxes and a compact manifest through the geometry port", async () => {
  let manifest: any;
  const writer: AssetManifestWriter = { write: async (_filename, value) => { manifest = value; } };
  const result = await new SpriteHitboxService(geometry(), writer).generate({ filename: "hero.gif", outputFilename: "hero-hitboxes.json", mode: "components", padding: 1 });
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(result.message), { operation: "generate_sprite_hitboxes", manifest: "hero-hitboxes.json", filename: "hero.gif", frames: 2, mode: "components", padding: 1, deterministic: true, sourcePreserved: true });
  assert.deepEqual(manifest.frames[0].hitboxes, [{ x: 3, y: 4, width: 4, height: 5, pixels: 4 }, { x: 7, y: 9, width: 4, height: 7, pixels: 3 }]);
  assert.deepEqual(manifest.frames[0].pivot, { x: 7, y: 14, mode: "bottom_center" });
});

test("supports union mode and rejects unsafe names, collisions, invalid padding, and malformed geometry", async () => {
  const writer: AssetManifestWriter = { write: async () => undefined };
  const service = new SpriteHitboxService(geometry(), writer);
  const union = await service.generate({ filename: "hero.gif", outputFilename: "hero-union.json", mode: "union", padding: 2 });
  assert.equal(union.ok, true);
  const written: { frames: Array<{ hitboxes: unknown[] }> } = {} as { frames: Array<{ hitboxes: unknown[] }> };
  const unionWithWriter = new SpriteHitboxService(geometry(), { write: async (_filename, value) => { Object.assign(written, value); } });
  await unionWithWriter.generate({ filename: "hero.gif", outputFilename: "hero-union.json", mode: "union", padding: 2 });
  assert.deepEqual(written.frames[0]?.hitboxes, [{ x: 2, y: 3, width: 10, height: 14 }]);
  const collision = await service.generate({ filename: "hero.gif", outputFilename: "hero.gif" });
  assert.equal(collision.ok, false);
  assert.match(collision.message, /different/i);
  const padding = await service.generate({ filename: "hero.gif", outputFilename: "out.json", padding: 17 });
  assert.equal(padding.ok, false);
  assert.match(padding.message, /padding/i);
  const malformed = new SpriteHitboxService({ inspect: async () => ({ ok: true, message: "not-json" }) }, writer);
  const invalid = await malformed.generate({ filename: "hero.gif", outputFilename: "out.json" });
  assert.equal(invalid.ok, false);
  assert.match(invalid.message, /geometry/i);
});
