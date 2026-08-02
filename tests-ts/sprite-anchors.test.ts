import assert from "node:assert/strict";
import test from "node:test";
import type { AssetOperationResult } from "../src/domain/asset-operations.js";
import type { AssetManifestWriter } from "../src/domain/image-assets.js";
import { SpriteAnchorsService } from "../src/application/services/SpriteAnchorsService.js";

const geometryPayload = { operation: "inspect_sprite_geometry", filename: "hero.gif", frameCount: 2, width: 16, height: 20, minComponentPixels: 1, frames: [
  { index: 0, opaquePixels: 12, bounds: { x: 4, y: 5, width: 6, height: 10 }, baselineY: 14, pivot: { x: 6, y: 14, mode: "bottom_center" }, components: [] },
  { index: 1, opaquePixels: 10, bounds: { x: 5, y: 6, width: 5, height: 8 }, baselineY: 13, pivot: { x: 7, y: 13, mode: "bottom_center" }, components: [] },
], animation: { stableBounds: false, baselineDrift: 1 }, quality: { valid: true, violations: [] }, recommendations: [], deterministic: true, sourcePreserved: true } as const;

function geometry(): { inspect(): Promise<AssetOperationResult> } { return { inspect: async () => ({ ok: true, message: JSON.stringify(geometryPayload) }) }; }

test("generates deterministic placement anchors from shared sprite geometry", async () => {
  let manifest: unknown;
  const writer: AssetManifestWriter = { write: async (_filename, value) => { manifest = value; } };
  const result = await new SpriteAnchorsService(geometry(), writer).generate({ filename: "hero.gif", outputFilename: "hero-anchors.json" });
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(result.message), { operation: "generate_sprite_anchors", manifest: "hero-anchors.json", filename: "hero.gif", frames: 2, anchorTypes: 6, baselineDrift: 1, deterministic: true, sourcePreserved: true });
  assert.deepEqual((manifest as { frames: Array<{ anchors: Record<string, unknown> }> }).frames[0]!.anchors, { bottom_center: { x: 6, y: 14 }, center: { x: 6, y: 9 }, top_center: { x: 6, y: 5 }, left_center: { x: 4, y: 9 }, right_center: { x: 9, y: 9 }, baseline: { x: 6, y: 14 } });
});

test("keeps transparent frames explicit and rejects unsafe output contracts", async () => {
  const writer: AssetManifestWriter = { write: async () => undefined };
  const emptyGeometry = { inspect: async () => ({ ok: true, message: JSON.stringify({ ...geometryPayload, frames: [{ ...geometryPayload.frames[0], bounds: null, baselineY: null, pivot: { x: 8, y: 19, mode: "bottom_center" } }] }) }) };
  const service = new SpriteAnchorsService(emptyGeometry, writer);
  const empty = await service.generate({ filename: "hero.gif", outputFilename: "hero-anchors.json" });
  assert.equal(empty.ok, true);
  assert.equal((JSON.parse(empty.message) as { frames: number }).frames, 1);
  const collision = await service.generate({ filename: "hero.gif", outputFilename: "hero.gif" });
  assert.equal(collision.ok, false);
  assert.match(collision.message, /different/i);
});
