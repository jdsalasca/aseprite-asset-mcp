import assert from "node:assert/strict";
import test from "node:test";
import type { RasterCodec } from "../src/domain/image-assets.js";
import type { RasterFrame } from "../src/domain/pixel-art.js";
import { AnimationQualityService } from "../src/application/services/AnimationQualityService.js";

function frame(x: number, delayMs: number, color: [number, number, number, number] = [255, 0, 0, 255]): RasterFrame {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  pixels.set(color, (x + 1) * 4);
  return { width: 4, height: 4, pixels, delayMs };
}

test("animation audit finds duplicate frames, irregular timing, and reports a closed loop", async () => {
  const frames = [frame(0, 100), frame(1, 100), frame(1, 120), frame(0, 100)];
  const codec: RasterCodec = { decode: async () => frames, encode: async () => undefined };
  const result = await new AnimationQualityService(codec).inspect({ filename: "hero.gif" });
  assert.equal(result.ok, false);
  const payload = JSON.parse(result.message) as { operation: string; duplicateFrames: number[]; loop: { closed: boolean; changedPixels: number }; timing: { consistent: boolean }; quality: { violations: string[] }; deterministic: true; sourcePreserved: true };
  assert.equal(payload.operation, "inspect_animation_quality");
  assert.deepEqual(payload.duplicateFrames, [3]);
  assert.equal(payload.loop.closed, true);
  assert.equal(payload.loop.changedPixels, 0);
  assert.equal(payload.timing.consistent, false);
  assert.ok(payload.quality.violations.some((violation) => /duplicate|timing/i.test(violation)));
  assert.equal(payload.deterministic, true);
  assert.equal(payload.sourcePreserved, true);
});

function solid(delayMs: number, color: [number, number, number, number] = [0, 0, 255, 255]): RasterFrame {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  for (let index = 0; index < pixels.length; index += 4) pixels.set(color, index);
  return { width: 4, height: 4, pixels, delayMs };
}

test("animation audit accepts a smooth looping cycle whose last frame differs from the first", async () => {
  // A seamless loop repeats frame 1 after the last frame, so the last frame must differ from the first.
  const frames = [frame(0, 100), frame(1, 100), frame(2, 100), frame(3, 100)];
  const codec: RasterCodec = { decode: async () => frames, encode: async () => undefined };
  const result = await new AnimationQualityService(codec).inspect({ filename: "loop.gif" });
  const payload = JSON.parse(result.message) as { loop: { closed: boolean }; quality: { valid: boolean; violations: string[] } };
  assert.deepEqual(payload.quality.violations, []);
  assert.equal(payload.quality.valid, true);
  assert.equal(result.ok, true);
  assert.equal(payload.loop.closed, false);
});

test("animation audit reports a loop seam pop when the wrap-around jump dwarfs the internal steps", async () => {
  const frames = [frame(0, 100), frame(1, 100), frame(2, 100), solid(100)];
  const codec: RasterCodec = { decode: async () => frames, encode: async () => undefined };
  const result = await new AnimationQualityService(codec).inspect({ filename: "pop.gif" });
  const payload = JSON.parse(result.message) as { loop: { changedPixels: number }; quality: { violations: string[] } };
  assert.ok(payload.quality.violations.some((violation) => /loop seam/i.test(violation)), `expected a loop seam violation, got: ${payload.quality.violations.join("; ")}`);
  assert.equal(result.ok, false);
});

test("animation audit rejects static, unsafe, and mismatched-frame inputs before analysis", async () => {
  const codec: RasterCodec = { decode: async (filename) => filename.includes("static") ? [frame(0, 100)] : [frame(0, 100), { ...frame(0, 100), width: 2, height: 4, pixels: new Uint8ClampedArray(2 * 4 * 4) }], encode: async () => undefined };
  const service = new AnimationQualityService(codec);
  const staticResult = await service.inspect({ filename: "static.png" });
  assert.equal(staticResult.ok, false);
  assert.match(staticResult.message, /at least two/);
  const unsafeResult = await service.inspect({ filename: "bad\0.gif" });
  assert.equal(unsafeResult.ok, false);
  assert.match(unsafeResult.message, /null/);
  const mismatch = await service.inspect({ filename: "mismatch.gif" });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.message, /dimensions/);
});
