import assert from "node:assert/strict";
import test from "node:test";
import type { AssetManifestWriter, RasterCodec } from "../src/domain/image-assets.js";
import type { RasterFrame } from "../src/domain/pixel-art.js";
import { SpriteNormalizationService } from "../src/application/services/SpriteNormalizationService.js";

function frame(x: number, y: number, delayMs: number): RasterFrame {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  pixels.set([255, 80, 20, 255], (y * 4 + x) * 4);
  return { width: 4, height: 4, pixels, delayMs };
}

test("normalizes all frames to shared alpha bounds, keeps delays, and writes pivot metadata", async () => {
  const encoded: RasterFrame[][] = [];
  let manifest: unknown;
  const codec: RasterCodec = { decode: async () => [frame(1, 1, 80), frame(2, 2, 120)], encode: async (frames) => { encoded.push(frames); } };
  const writer: AssetManifestWriter = { write: async (_filename, value) => { manifest = value; } };
  const result = await new SpriteNormalizationService(codec, writer).normalize({ inputFilename: "hero.gif", outputFilename: "hero-normalized.gif", manifestFilename: "hero-normalized.json", padding: 1, pivot: "bottom_center", format: "gif" });
  assert.equal(result.ok, true);
  const payload = JSON.parse(result.message) as { operation: string; width: number; height: number; frames: number; pivot: { x: number; y: number; mode: string }; bounds: { x: number; y: number; width: number; height: number }; sourcePreserved: true; deterministic: true };
  assert.deepEqual({ operation: payload.operation, width: payload.width, height: payload.height, frames: payload.frames, bounds: payload.bounds, pivot: payload.pivot }, { operation: "normalize_sprite", width: 4, height: 4, frames: 2, bounds: { x: 1, y: 1, width: 2, height: 2 }, pivot: { x: 2, y: 2, mode: "bottom_center" } });
  assert.equal(payload.sourcePreserved, true);
  assert.equal(payload.deterministic, true);
  assert.equal(encoded[0]?.[0]?.delayMs, 80);
  assert.equal(encoded[0]?.[1]?.delayMs, 120);
  assert.equal(encoded[0]?.[0]?.pixels[(1 * 4 + 1) * 4 + 3], 255);
  assert.equal((manifest as { pivot: { x: number; y: number } }).pivot.x, 2);
});

test("normalization rejects transparent sources, collisions, invalid padding, and unsafe names", async () => {
  const empty: RasterFrame = { width: 2, height: 2, pixels: new Uint8ClampedArray(16) };
  const codec: RasterCodec = { decode: async () => [empty], encode: async () => undefined };
  const writer: AssetManifestWriter = { write: async () => undefined };
  const service = new SpriteNormalizationService(codec, writer);
  const transparent = await service.normalize({ inputFilename: "empty.png", outputFilename: "out.png", manifestFilename: "out.json" });
  assert.equal(transparent.ok, false);
  assert.match(transparent.message, /opaque/i);
  const collision = await service.normalize({ inputFilename: "hero.png", outputFilename: "hero.png", manifestFilename: "hero.json" });
  assert.equal(collision.ok, false);
  assert.match(collision.message, /different/i);
  const padding = await service.normalize({ inputFilename: "hero.png", outputFilename: "out.png", manifestFilename: "out.json", padding: 17 });
  assert.equal(padding.ok, false);
  assert.match(padding.message, /padding/i);
  const unsafe = await service.normalize({ inputFilename: "bad\0.png", outputFilename: "out.png", manifestFilename: "out.json" });
  assert.equal(unsafe.ok, false);
  assert.match(unsafe.message, /null/i);
});
