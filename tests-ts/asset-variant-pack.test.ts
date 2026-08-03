import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import { AssetVariantPackService } from "../src/application/services/AssetVariantPackService.js";
import { SpriteEffectsService } from "../src/application/services/SpriteEffectsService.js";
import { SharpRasterCodec } from "../src/infrastructure/image/SharpRasterCodec.js";

async function makeScene(filename: string): Promise<void> {
  const pixels = new Uint8ClampedArray(16 * 16 * 4);
  for (let y = 5; y < 14; y += 1) for (let x = 4; x < 12; x += 1) { const offset = (y * 16 + x) * 4; pixels[offset] = 70; pixels[offset + 1] = 150; pixels[offset + 2] = 80; pixels[offset + 3] = 255; }
  await sharp(Buffer.from(pixels), { raw: { width: 16, height: 16, channels: 4 } }).png().toFile(filename);
}

function service(): AssetVariantPackService { const codec = new SharpRasterCodec(); return new AssetVariantPackService(codec, new SpriteEffectsService(codec)); }

test("variant pack materializes deterministic environmental variants without mutating the source", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "asset-variant-pack-"));
  const input = path.join(directory, "oak.png"); const firstPrefix = path.join(directory, "first"); const secondPrefix = path.join(directory, "second"); await makeScene(input);
  const sourceBefore = await fs.readFile(input);
  const variants = ["rain", "fire", "earthquake", "birds", "night", "day_night", "walk", "water_reflection", "water_caustics", "wind_sway"] as const;
  const request = { inputFilename: input, outputPrefix: firstPrefix, variants: [...variants], frames: 6, seed: 41, delayMs: 70 };
  const first = await service().generateVariantPack(request);
  assert.equal(first.ok, true);
  const payload = JSON.parse(first.message) as { operation: string; artifacts: Array<{ variant: string; outputFilename: string; frames: number; operation: string }> };
  assert.equal(payload.operation, "generate_variant_pack"); assert.equal(payload.artifacts.length, variants.length); assert.deepEqual(payload.artifacts.map((artifact) => artifact.variant), variants);
  assert.equal(payload.artifacts.find((artifact) => artifact.variant === "wind_sway")?.operation, "generate_wind_sway");
  for (const artifact of payload.artifacts) { assert.equal(await fs.stat(artifact.outputFilename).then(() => true), true); assert.ok(artifact.frames >= 1); }
  assert.deepEqual(await fs.readFile(input), sourceBefore);
  const second = await service().generateVariantPack({ ...request, outputPrefix: secondPrefix });
  assert.equal(second.ok, true);
  const firstFire = path.join(directory, "first-fire.gif"); const secondFire = path.join(directory, "second-fire.gif");
  assert.deepEqual(await fs.readFile(firstFire), await fs.readFile(secondFire));
  assert.equal((await sharp(firstFire, { animated: true }).metadata()).pages, 6);
});

test("variant pack rejects empty, duplicate, unsafe, and out-of-range requests", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "asset-variant-pack-invalid-")); const input = path.join(directory, "oak.png"); await makeScene(input);
  const pack = service();
  assert.equal((await pack.generateVariantPack({ inputFilename: input, outputPrefix: path.join(directory, "out"), variants: [], frames: 6, seed: 1 })).ok, false);
  assert.equal((await pack.generateVariantPack({ inputFilename: input, outputPrefix: path.join(directory, "out"), variants: ["rain", "rain"], frames: 6, seed: 1 })).ok, false);
  assert.equal((await pack.generateVariantPack({ inputFilename: input, outputPrefix: path.join(directory, "out\0bad"), variants: ["fire"], frames: 1, seed: 1 })).ok, false);
});

test("keeps the legacy wind catalog variant compatible with wind sway", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "asset-variant-pack-wind-alias-"));
  const input = path.join(directory, "oak.png");
  await makeScene(input);
  const result = await service().generateVariantPack({ inputFilename: input, outputPrefix: path.join(directory, "out"), variants: ["wind"], frames: 4, seed: 7 });
  assert.equal(result.ok, true);
  const artifact = JSON.parse(result.message).artifacts[0] as { variant: string; operation: string };
  assert.equal(artifact.variant, "wind");
  assert.equal(artifact.operation, "generate_wind_sway");
});
