import assert from "node:assert/strict";
import test from "node:test";
import type { AssetManifestWriter, RasterCodec } from "../src/domain/image-assets.js";
import type { RasterFrame } from "../src/domain/pixel-art.js";
import { AnimationSheetService } from "../src/application/services/AnimationSheetService.js";

function frame(color: number, delayMs: number): RasterFrame {
  const pixels = new Uint8ClampedArray(2 * 2 * 4);
  pixels.set([color, 20, 40, 255], 0);
  return { width: 2, height: 2, pixels, delayMs };
}

test("builds an animation sheet with stable frame coordinates and timing manifest", async () => {
  let encoded: RasterFrame | undefined;
  let manifest: any;
  const codec: RasterCodec = { decode: async () => [frame(10, 80), frame(20, 100), frame(30, 120)], encode: async (frames) => { encoded = frames[0]; } };
  const writer: AssetManifestWriter = { write: async (_filename, value) => { manifest = value; } };
  const result = await new AnimationSheetService(codec, writer).build({ inputFilename: "hero.gif", outputFilename: "hero-sheet.png", manifestFilename: "hero-sheet.json", columns: 2, padding: 1 });
  assert.equal(result.ok, true);
  const payload = JSON.parse(result.message) as { operation: string; width: number; height: number; frames: number; columns: number; rows: number; deterministic: true; sourcePreserved: true };
  assert.deepEqual(payload, { operation: "build_animation_sheet", output: "hero-sheet.png", manifest: "hero-sheet.json", frames: 3, columns: 2, rows: 2, width: 7, height: 7, cellWidth: 2, cellHeight: 2, padding: 1, deterministic: true, sourcePreserved: true });
  assert.equal(encoded?.width, 7);
  assert.equal(encoded?.height, 7);
  assert.equal(encoded?.pixels[(1 * 7 + 1) * 4], 10);
  assert.deepEqual(manifest.frames, [
    { index: 0, x: 1, y: 1, width: 2, height: 2, delayMs: 80, pivot: { x: 2, y: 2, mode: "bottom_center" } },
    { index: 1, x: 4, y: 1, width: 2, height: 2, delayMs: 100, pivot: { x: 5, y: 2, mode: "bottom_center" } },
    { index: 2, x: 1, y: 4, width: 2, height: 2, delayMs: 120, pivot: { x: 2, y: 5, mode: "bottom_center" } },
  ]);
});

test("rejects unsafe names, collisions, invalid grid options, and mismatched frames", async () => {
  const codec: RasterCodec = { decode: async () => [{ width: 2, height: 2, pixels: new Uint8ClampedArray(16) }, { width: 3, height: 2, pixels: new Uint8ClampedArray(24) }], encode: async () => undefined };
  const writer: AssetManifestWriter = { write: async () => undefined };
  const service = new AnimationSheetService(codec, writer);
  const mismatch = await service.build({ inputFilename: "hero.gif", outputFilename: "sheet.png", manifestFilename: "sheet.json" });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.message, /share dimensions/i);
  const collision = await service.build({ inputFilename: "hero.gif", outputFilename: "hero.gif", manifestFilename: "sheet.json" });
  assert.equal(collision.ok, false);
  assert.match(collision.message, /different/i);
  const columns = await service.build({ inputFilename: "hero.gif", outputFilename: "sheet.png", manifestFilename: "sheet.json", columns: 0 });
  assert.equal(columns.ok, false);
  assert.match(columns.message, /columns/i);
  const unsafe = await service.build({ inputFilename: "bad\0.gif", outputFilename: "sheet.png", manifestFilename: "sheet.json" });
  assert.equal(unsafe.ok, false);
  assert.match(unsafe.message, /null/i);
});
