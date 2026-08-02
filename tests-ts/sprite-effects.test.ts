import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import { SpriteEffectsService } from "../src/application/services/SpriteEffectsService.js";
import { SharpRasterCodec } from "../src/infrastructure/image/SharpRasterCodec.js";

async function makeSprite(filename: string): Promise<void> {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  for (let y = 1; y < 3; y += 1) for (let x = 1; x < 3; x += 1) pixels[(y * 4 + x) * 4] = 220, pixels[(y * 4 + x) * 4 + 1] = 90, pixels[(y * 4 + x) * 4 + 2] = 40, pixels[(y * 4 + x) * 4 + 3] = 255;
  await sharp(Buffer.from(pixels), { raw: { width: 4, height: 4, channels: 4 } }).png().toFile(filename);
}

function service(): SpriteEffectsService { return new SpriteEffectsService(new SharpRasterCodec()); }

test("pixel outline adds opaque edge pixels without overwriting source", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-outline-")); const input = path.join(directory, "input.png"); const output = path.join(directory, "output.png"); await makeSprite(input);
  const result = await service().applyPixelOutline({ inputFilename: input, outputFilename: output, color: "#ffffff", thickness: 1 });
  assert.equal(result.ok, true); const data = await sharp(output).raw().toBuffer({ resolveWithObject: true }); assert.ok([...data.data].some((value, index) => index % 4 === 3 && value > 0)); assert.notDeepEqual(await fs.readFile(input), await fs.readFile(output));
});

test("color grade is deterministic and rejects invalid ranges", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-grade-")); const input = path.join(directory, "input.png"); const first = path.join(directory, "first.png"); const second = path.join(directory, "second.png"); await makeSprite(input);
  assert.equal((await service().applyColorGrade({ inputFilename: input, outputFilename: first, brightness: 0.1, contrast: 1.2, saturation: 0.8 })).ok, true); assert.equal((await service().applyColorGrade({ inputFilename: input, outputFilename: second, brightness: 0.1, contrast: 1.2, saturation: 0.8 })).ok, true); assert.deepEqual(await fs.readFile(first), await fs.readFile(second));
  const invalid = await service().applyColorGrade({ inputFilename: input, outputFilename: path.join(directory, "invalid.png"), contrast: 3 }); assert.equal(invalid.ok, false);
});

test("sprite shadow uses alpha and preserves the original silhouette", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-shadow-")); const input = path.join(directory, "input.png"); const output = path.join(directory, "output.png"); await makeSprite(input);
  const result = await service().generateSpriteShadow({ inputFilename: input, outputFilename: output, offsetX: 1, offsetY: 1, color: "#000000", opacity: 0.5 }); assert.equal(result.ok, true); const data = await sharp(output).raw().toBuffer({ resolveWithObject: true }); assert.ok(data.data.some((value, index) => index % 4 === 3 && value > 0 && value < 255));
});

test("particle burst generation is seeded and exports the requested frame count", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-particles-")); const first = path.join(directory, "first.gif"); const second = path.join(directory, "second.gif");
  assert.equal((await service().generateParticleBurst({ outputFilename: first, width: 32, height: 32, frames: 6, particleCount: 20, seed: 7, color: "#ffcc55" })).ok, true); assert.equal((await service().generateParticleBurst({ outputFilename: second, width: 32, height: 32, frames: 6, particleCount: 20, seed: 7, color: "#ffcc55" })).ok, true); assert.deepEqual(await fs.readFile(first), await fs.readFile(second)); assert.equal((await sharp(first, { animated: true }).metadata()).pages, 6);
});

test("normal map encodes alpha depth and keeps transparent pixels empty", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-normal-")); const input = path.join(directory, "input.png"); const output = path.join(directory, "normal.png"); await makeSprite(input);
  const result = await service().generateNormalMap({ inputFilename: input, outputFilename: output, strength: 3 }); assert.equal(result.ok, true); const data = await sharp(output).raw().toBuffer({ resolveWithObject: true }); assert.deepEqual([...data.data.slice(0, 4)], [128, 128, 255, 0]); assert.equal(data.data[(1 * 4 + 1) * 4 + 3], 255);
});
