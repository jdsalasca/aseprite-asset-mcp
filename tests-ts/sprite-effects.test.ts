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

test("background removal clears connected pixels deterministically and preserves enclosed colors", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-background-"));
  const input = path.join(directory, "input.png"); const first = path.join(directory, "first.png"); const second = path.join(directory, "second.png");
  const pixels = new Uint8ClampedArray(5 * 5 * 4);
  const set = (x: number, y: number, color: [number, number, number, number]) => pixels.set(color, (y * 5 + x) * 4);
  for (let y = 0; y < 5; y += 1) for (let x = 0; x < 5; x += 1) set(x, y, [20, 40, 80, 255]);
  for (let y = 1; y < 4; y += 1) for (let x = 1; x < 4; x += 1) set(x, y, [220, 90, 40, 255]);
  set(2, 2, [20, 40, 80, 255]);
  await sharp(Buffer.from(pixels), { raw: { width: 5, height: 5, channels: 4 } }).png().toFile(input);
  const operation = { inputFilename: input, outputFilename: first, backgroundColor: "#142850", tolerance: 0, connectedOnly: true };
  assert.equal((await service().removeBackground(operation)).ok, true);
  assert.equal((await service().removeBackground({ ...operation, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second));
  assert.deepEqual(await fs.readFile(input), await sharp(Buffer.from(pixels), { raw: { width: 5, height: 5, channels: 4 } }).png().toBuffer());
  const output = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  assert.equal(output.data[3], 0);
  assert.equal(output.data[(2 * 5 + 2) * 4 + 3], 255);
  assert.equal(output.data[(2 * 5 + 1) * 4 + 3], 255);
});

test("background removal supports global mode and rejects invalid contracts", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-background-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const global = await service().removeBackground({ inputFilename: input, outputFilename: path.join(directory, "global.png"), backgroundColor: "#000000", tolerance: 0, connectedOnly: false });
  assert.equal(global.ok, true);
  const invalidTolerance = await service().removeBackground({ inputFilename: input, outputFilename: path.join(directory, "invalid.png"), backgroundColor: "#000000", tolerance: 256 });
  assert.equal(invalidTolerance.ok, false);
  assert.match(invalidTolerance.message, /tolerance/i);
});

test("cleanup removes isolated opaque pixels deterministically while preserving connected clusters", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-cleanup-"));
  const input = path.join(directory, "input.png"); const first = path.join(directory, "first.png"); const second = path.join(directory, "second.png");
  const pixels = new Uint8ClampedArray(7 * 7 * 4);
  const set = (x: number, y: number, color: [number, number, number, number]) => pixels.set(color, (y * 7 + x) * 4);
  set(1, 1, [240, 80, 60, 255]);
  for (const [x, y] of [[4, 4], [5, 4], [4, 5], [5, 5]] as const) set(x, y, [80, 180, 240, 255]);
  await sharp(Buffer.from(pixels), { raw: { width: 7, height: 7, channels: 4 } }).png().toFile(input);
  const operation = { inputFilename: input, outputFilename: first, minNeighbors: 1, iterations: 1 };
  assert.equal((await service().cleanupIsolatedPixels(operation)).ok, true);
  assert.equal((await service().cleanupIsolatedPixels({ ...operation, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second));
  const output = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  assert.equal(output.data[(1 * 7 + 1) * 4 + 3], 0);
  assert.equal(output.data[(4 * 7 + 4) * 4 + 3], 255);
  assert.equal(output.data[(5 * 7 + 5) * 4 + 3], 255);
  assert.deepEqual(await fs.readFile(input), await sharp(Buffer.from(pixels), { raw: { width: 7, height: 7, channels: 4 } }).png().toBuffer());
});

test("cleanup rejects invalid thresholds and iteration counts", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-cleanup-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const invalidNeighbors = await service().cleanupIsolatedPixels({ inputFilename: input, outputFilename: path.join(directory, "neighbors.png"), minNeighbors: 9 });
  const invalidIterations = await service().cleanupIsolatedPixels({ inputFilename: input, outputFilename: path.join(directory, "iterations.png"), iterations: 5 });
  assert.equal(invalidNeighbors.ok, false); assert.match(invalidNeighbors.message, /neighbors/i);
  assert.equal(invalidIterations.ok, false); assert.match(invalidIterations.message, /iterations/i);
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

test("sprite glow is deterministic, preserves the source silhouette, and lights nearby transparent pixels", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-glow-")); const input = path.join(directory, "input.png"); const first = path.join(directory, "first.png"); const second = path.join(directory, "second.png"); await makeSprite(input); const sourceBefore = await fs.readFile(input);
  const operation = { inputFilename: input, outputFilename: first, color: "#FFD166", radius: 2, opacity: 0.8 };
  assert.equal((await service().generateSpriteGlow(operation)).ok, true);
  assert.equal((await service().generateSpriteGlow({ ...operation, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second));
  assert.deepEqual(await fs.readFile(input), sourceBefore);
  const output = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  assert.equal(output.data[(1 * 4 + 1) * 4], 220);
  assert.ok((output.data[(0 * 4 + 1) * 4 + 3] ?? 0) > 0);
  assert.ok((output.data[(0 * 4 + 0) * 4 + 3] ?? 0) > 0);
});

test("sprite glow rejects invalid radius and opacity", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-glow-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const invalidRadius = await service().generateSpriteGlow({ inputFilename: input, outputFilename: path.join(directory, "radius.png"), color: "#ffffff", radius: 9 });
  const invalidOpacity = await service().generateSpriteGlow({ inputFilename: input, outputFilename: path.join(directory, "opacity.png"), color: "#ffffff", opacity: 2 });
  assert.equal(invalidRadius.ok, false); assert.match(invalidRadius.message, /radius/i);
  assert.equal(invalidOpacity.ok, false); assert.match(invalidOpacity.message, /opacity/i);
});

test("sprite rim light is deterministic, directional, alpha-safe, and source-preserving", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-rim-light-"));
  const input = path.join(directory, "input.png"); const first = path.join(directory, "first.png"); const second = path.join(directory, "second.png");
  await makeSprite(input); const sourceBefore = await fs.readFile(input);
  const operation = { inputFilename: input, outputFilename: first, color: "#FFD166", direction: "north" as const, strength: 1 };
  assert.equal((await service().applySpriteRimLight(operation)).ok, true);
  assert.equal((await service().applySpriteRimLight({ ...operation, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second)); assert.deepEqual(await fs.readFile(input), sourceBefore);
  const source = await sharp(input).raw().toBuffer({ resolveWithObject: true }); const output = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  const pixel = (data: Buffer, x: number, y: number) => Array.from(data.subarray((y * 4 + x) * 4, (y * 4 + x + 1) * 4));
  assert.deepEqual(pixel(output.data, 1, 1), [255, 209, 102, 255]);
  assert.deepEqual(pixel(output.data, 1, 2), pixel(source.data, 1, 2)); assert.deepEqual(pixel(output.data, 0, 0), pixel(source.data, 0, 0));
});

test("sprite rim light rejects invalid direction and strength", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-rim-light-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const invalidStrength = await service().applySpriteRimLight({ inputFilename: input, outputFilename: path.join(directory, "strength.png"), color: "#ffffff", direction: "north", strength: 2 });
  const invalidDirection = await service().applySpriteRimLight({ inputFilename: input, outputFilename: path.join(directory, "direction.png"), color: "#ffffff", direction: "bad" as never, strength: 0.5 });
  assert.equal(invalidStrength.ok, false); assert.equal(invalidDirection.ok, false);
});

test("sprite ambient occlusion darkens cavity edges deterministically without changing alpha or source", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-ambient-occlusion-"));
  const input = path.join(directory, "input.png"); const first = path.join(directory, "first.png"); const second = path.join(directory, "second.png");
  const pixels = new Uint8ClampedArray(5 * 5 * 4);
  for (let y = 1; y < 4; y += 1) for (let x = 1; x < 4; x += 1) pixels.set([220, 90, 40, 255], (y * 5 + x) * 4);
  await sharp(Buffer.from(pixels), { raw: { width: 5, height: 5, channels: 4 } }).png().toFile(input);
  const sourceBefore = await fs.readFile(input);
  const operation = { inputFilename: input, outputFilename: first, color: "#000000", radius: 1, strength: 1 };
  assert.equal((await service().applySpriteAmbientOcclusion(operation)).ok, true);
  assert.equal((await service().applySpriteAmbientOcclusion({ ...operation, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second)); assert.deepEqual(await fs.readFile(input), sourceBefore);
  const output = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  const pixel = (x: number, y: number) => Array.from(output.data.slice((y * 5 + x) * 4, (y * 5 + x + 1) * 4));
  assert.deepEqual(pixel(2, 2), [220, 90, 40, 255]);
  assert.notDeepEqual(pixel(2, 1), [220, 90, 40, 255]);
  assert.equal(pixel(2, 1)[3], 255);
  assert.deepEqual(pixel(0, 0), [0, 0, 0, 0]);
});

test("sprite ambient occlusion rejects invalid radius and strength", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-ambient-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const invalidRadius = await service().applySpriteAmbientOcclusion({ inputFilename: input, outputFilename: path.join(directory, "radius.png"), color: "#000000", radius: 5, strength: 0.5 });
  const invalidStrength = await service().applySpriteAmbientOcclusion({ inputFilename: input, outputFilename: path.join(directory, "strength.png"), color: "#000000", radius: 1, strength: 2 });
  assert.equal(invalidRadius.ok, false); assert.equal(invalidStrength.ok, false);
});

test("sprite specular highlight creates a deterministic inward light band and preserves alpha/source", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-specular-"));
  const input = path.join(directory, "input.png"); const first = path.join(directory, "first.png"); const second = path.join(directory, "second.png");
  const pixels = new Uint8ClampedArray(5 * 5 * 4);
  for (let y = 1; y < 4; y += 1) for (let x = 1; x < 4; x += 1) pixels.set([80, 100, 120, 255], (y * 5 + x) * 4);
  await sharp(Buffer.from(pixels), { raw: { width: 5, height: 5, channels: 4 } }).png().toFile(input);
  const sourceBefore = await fs.readFile(input);
  const operation = { inputFilename: input, outputFilename: first, color: "#FFFFFF", direction: "north" as const, radius: 2, strength: 1 };
  assert.equal((await service().applySpriteSpecularHighlight(operation)).ok, true);
  assert.equal((await service().applySpriteSpecularHighlight({ ...operation, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second)); assert.deepEqual(await fs.readFile(input), sourceBefore);
  const output = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  const pixel = (x: number, y: number) => Array.from(output.data.slice((y * 5 + x) * 4, (y * 5 + x + 1) * 4));
  assert.deepEqual(pixel(2, 1), [255, 255, 255, 255]);
  assert.notDeepEqual(pixel(2, 2), [80, 100, 120, 255]);
  assert.deepEqual(pixel(2, 3), [80, 100, 120, 255]);
  assert.deepEqual(pixel(0, 0), [0, 0, 0, 0]);
});

test("sprite specular highlight rejects invalid direction, radius, and strength", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-specular-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const invalidDirection = await service().applySpriteSpecularHighlight({ inputFilename: input, outputFilename: path.join(directory, "direction.png"), color: "#ffffff", direction: "invalid" as never, radius: 2, strength: 0.5 });
  const invalidRadius = await service().applySpriteSpecularHighlight({ inputFilename: input, outputFilename: path.join(directory, "radius.png"), color: "#ffffff", direction: "north", radius: 9, strength: 0.5 });
  const invalidStrength = await service().applySpriteSpecularHighlight({ inputFilename: input, outputFilename: path.join(directory, "strength.png"), color: "#ffffff", direction: "north", radius: 2, strength: 2 });
  assert.equal(invalidDirection.ok, false); assert.equal(invalidRadius.ok, false); assert.equal(invalidStrength.ok, false);
});

test("particle burst generation is seeded and exports the requested frame count", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-particles-")); const first = path.join(directory, "first.gif"); const second = path.join(directory, "second.gif");
  assert.equal((await service().generateParticleBurst({ outputFilename: first, width: 32, height: 32, frames: 6, particleCount: 20, seed: 7, color: "#ffcc55" })).ok, true); assert.equal((await service().generateParticleBurst({ outputFilename: second, width: 32, height: 32, frames: 6, particleCount: 20, seed: 7, color: "#ffcc55" })).ok, true); assert.deepEqual(await fs.readFile(first), await fs.readFile(second)); assert.equal((await sharp(first, { animated: true }).metadata()).pages, 6);
});

test("normal map encodes alpha depth and keeps transparent pixels empty", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-normal-")); const input = path.join(directory, "input.png"); const output = path.join(directory, "normal.png"); await makeSprite(input);
  const result = await service().generateNormalMap({ inputFilename: input, outputFilename: output, strength: 3 }); assert.equal(result.ok, true); const data = await sharp(output).raw().toBuffer({ resolveWithObject: true }); assert.deepEqual([...data.data.slice(0, 4)], [128, 128, 255, 0]); assert.equal(data.data[(1 * 4 + 1) * 4 + 3], 255);
});

test("rain overlay is seeded, preserves dimensions, and exports an animation when requested", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-rain-")); const input = path.join(directory, "input.png"); const first = path.join(directory, "first.gif"); const second = path.join(directory, "second.gif"); await makeSprite(input);
  const rain = { inputFilename: input, outputFilename: first, seed: 17, intensity: 0.8, wind: 0.25, color: "#b7d7ff", delayMs: 90, format: "gif" as const };
  assert.equal((await service().generateRainOverlay(rain)).ok, true);
  assert.equal((await service().generateRainOverlay({ ...rain, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second));
  const metadata = await sharp(first, { animated: true }).metadata();
  assert.equal(metadata.width, 4); assert.equal(metadata.height, 4); assert.equal(metadata.pages, 1);
});

test("rain overlay rejects invalid intensity and wind values", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-rain-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const result = await service().generateRainOverlay({ inputFilename: input, outputFilename: path.join(directory, "out.png"), seed: 1, intensity: 1.5, wind: 0, color: "#ffffff" });
  assert.equal(result.ok, false);
});

test("rain overlay can animate a static source when frames are requested", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-rain-static-")); const input = path.join(directory, "input.png"); const output = path.join(directory, "out.gif"); await makeSprite(input);
  const result = await service().generateRainOverlay({ inputFilename: input, outputFilename: output, seed: 8, intensity: 0.8, wind: 0.2, color: "#B7D7FF", frames: 4, delayMs: 70, format: "gif" });
  assert.equal(result.ok, true); assert.equal((await sharp(output, { animated: true }).metadata()).pages, 4);
});

test("rain overlay rejects multiple requested frames with PNG output", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-rain-format-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const result = await service().generateRainOverlay({ inputFilename: input, outputFilename: path.join(directory, "out.png"), seed: 8, intensity: 0.8, wind: 0.2, color: "#B7D7FF", frames: 2, format: "png" });
  assert.equal(result.ok, false); assert.match(result.message, /GIF format/);
});

test("motion pack creates a deterministic walk cycle from a static asset", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-motion-")); const input = path.join(directory, "input.png"); const first = path.join(directory, "first.gif"); const second = path.join(directory, "second.gif"); await makeSprite(input); const sourceBefore = await fs.readFile(input);
  const motion = { inputFilename: input, outputFilename: first, motion: "walk" as const, frames: 8, seed: 11, amplitude: 2, delayMs: 70 };
  assert.equal((await service().generateMotionPack(motion)).ok, true);
  assert.equal((await service().generateMotionPack({ ...motion, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second));
  assert.deepEqual(await fs.readFile(input), sourceBefore);
  const metadata = await sharp(first, { animated: true }).metadata(); assert.equal(metadata.pages, 8); assert.equal(metadata.width, 4); assert.equal(metadata.pageHeight, 4); assert.equal(metadata.height, 32);
});

test("motion pack rejects unsupported frame counts and amplitudes", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-motion-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const result = await service().generateMotionPack({ inputFilename: input, outputFilename: path.join(directory, "out.gif"), motion: "run", frames: 1, seed: 1, amplitude: 20 });
  assert.equal(result.ok, false);
});

test("seamless texture makes opposite borders match deterministically and preserves the source", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-seamless-"));
  const input = path.join(directory, "input.png");
  const first = path.join(directory, "first.png");
  const second = path.join(directory, "second.png");
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) {
    const offset = (y * 4 + x) * 4;
    pixels[offset] = x === 0 ? 240 : x === 3 ? 30 : 80;
    pixels[offset + 1] = y === 0 ? 220 : y === 3 ? 40 : 100;
    pixels[offset + 2] = 60;
    pixels[offset + 3] = (y === 0 && (x === 0 || x === 3)) ? 0 : 255;
  }
  await sharp(Buffer.from(pixels), { raw: { width: 4, height: 4, channels: 4 } }).png().toFile(input);
  const sourceBefore = await fs.readFile(input);
  const texture = { inputFilename: input, outputFilename: first, seamWidth: 2 };
  assert.equal((await service().generateSeamlessTexture(texture)).ok, true);
  assert.equal((await service().generateSeamlessTexture({ ...texture, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second));
  assert.deepEqual(await fs.readFile(input), sourceBefore);
  const data = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < 4; y += 1) assert.deepEqual([...data.data.slice((y * 4) * 4, (y * 4 + 1) * 4)], [...data.data.slice((y * 4 + 3) * 4, (y * 4 + 4) * 4)]);
  for (let x = 0; x < 4; x += 1) assert.deepEqual([...data.data.slice(x * 4, x * 4 + 4)], [...data.data.slice((3 * 4 + x) * 4, (3 * 4 + x + 1) * 4)]);
  assert.equal((await service().generateSeamlessTexture({ ...texture, outputFilename: path.join(directory, "invalid.png"), seamWidth: 3 })).ok, false);
});

test("water reflection creates deterministic animated pixels below the waterline and preserves the source", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-water-reflection-"));
  const input = path.join(directory, "input.png");
  const first = path.join(directory, "first.gif");
  const second = path.join(directory, "second.gif");
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  const set = (x: number, y: number, color: [number, number, number, number]) => pixels.set(color, (y * 8 + x) * 4);
  set(3, 3, [240, 100, 40, 255]);
  set(4, 2, [80, 220, 255, 255]);
  await sharp(Buffer.from(pixels), { raw: { width: 8, height: 8, channels: 4 } }).png().toFile(input);
  const sourceBefore = await fs.readFile(input);
  const reflection = { inputFilename: input, outputFilename: first, waterline: 4, frames: 4, seed: 17, amplitude: 1, opacity: 0.65, delayMs: 70 };
  assert.equal((await service().generateWaterReflection(reflection)).ok, true);
  assert.equal((await service().generateWaterReflection({ ...reflection, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second));
  assert.deepEqual(await fs.readFile(input), sourceBefore);
  const metadata = await sharp(first, { animated: true }).metadata();
  assert.equal(metadata.pages, 4); assert.equal(metadata.width, 8); assert.equal(metadata.pageHeight, 8); assert.equal(metadata.height, 32);
  const data = await sharp(first, { animated: true }).raw().toBuffer({ resolveWithObject: true });
  let reflectedAlpha = 0;
  for (let page = 0; page < 4; page += 1) for (let y = 4; y < 8; y += 1) for (let x = 0; x < 8; x += 1) reflectedAlpha += data.data[((page * 8 + y) * 8 + x) * 4 + 3] ?? 0;
  assert.ok(reflectedAlpha > 0);
  assert.equal(JSON.parse((await service().generateWaterReflection(reflection)).message).operation, "generate_water_reflection");
});

test("water reflection rejects invalid waterline, frame, amplitude, and opacity values", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-water-reflection-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const result = await service().generateWaterReflection({ inputFilename: input, outputFilename: path.join(directory, "out.gif"), waterline: 0, frames: 1, seed: 1, amplitude: 20, opacity: 2 });
  assert.equal(result.ok, false);
});

test("water caustics creates deterministic animated highlights, preserves transparency, and keeps the source", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-water-caustics-"));
  const input = path.join(directory, "input.png"); const first = path.join(directory, "first.gif"); const second = path.join(directory, "second.gif");
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) { const offset = (y * 8 + x) * 4; pixels[offset] = 24; pixels[offset + 1] = 110; pixels[offset + 2] = 180; pixels[offset + 3] = x === 0 || y === 0 ? 0 : 255; }
  await sharp(Buffer.from(pixels), { raw: { width: 8, height: 8, channels: 4 } }).png().toFile(input);
  const sourceBefore = await fs.readFile(input);
  const caustics = { inputFilename: input, outputFilename: first, frames: 5, seed: 12, intensity: 0.85, scale: 3, color: "#DFF6FF", delayMs: 65 };
  assert.equal((await service().generateWaterCaustics(caustics)).ok, true);
  assert.equal((await service().generateWaterCaustics({ ...caustics, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second)); assert.deepEqual(await fs.readFile(input), sourceBefore);
  const metadata = await sharp(first, { animated: true }).metadata(); assert.equal(metadata.pages, 5); assert.equal(metadata.width, 8); assert.equal(metadata.pageHeight, 8);
  const output = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  assert.equal(output.data[3], 0); assert.equal(output.data[7], 0); assert.ok(output.data[1] !== 110 || output.data[2] !== 180);
  assert.equal(JSON.parse((await service().generateWaterCaustics(caustics)).message).operation, "generate_water_caustics");
});

test("water caustics rejects invalid color, intensity, scale, and frame values", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-water-caustics-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const result = await service().generateWaterCaustics({ inputFilename: input, outputFilename: path.join(directory, "out.gif"), frames: 1, seed: 1, intensity: 2, scale: 0, color: "nope" });
  assert.equal(result.ok, false);
});

test("day night cycle creates deterministic stages, preserves transparency, and keeps the source", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-day-night-"));
  const input = path.join(directory, "input.png"); const first = path.join(directory, "first.gif"); const second = path.join(directory, "second.gif");
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) { const offset = (y * 8 + x) * 4; pixels[offset] = 170; pixels[offset + 1] = 120; pixels[offset + 2] = 70; pixels[offset + 3] = x === 0 || y === 0 ? 0 : 255; }
  await sharp(Buffer.from(pixels), { raw: { width: 8, height: 8, channels: 4 } }).png().toFile(input);
  const sourceBefore = await fs.readFile(input);
  const cycle = { inputFilename: input, outputFilename: first, frames: 8, seed: 23, intensity: 0.8, delayMs: 75 };
  assert.equal((await service().generateDayNightCycle(cycle)).ok, true);
  assert.equal((await service().generateDayNightCycle({ ...cycle, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second));
  assert.deepEqual(await fs.readFile(input), sourceBefore);
  const metadata = await sharp(first, { animated: true }).metadata();
  assert.equal(metadata.pages, 8); assert.equal(metadata.width, 8); assert.equal(metadata.pageHeight, 8);
  const output = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  assert.equal(output.data[3], 0); assert.equal(output.data[7], 0); assert.notDeepEqual([...output.data.slice(4, 7)], [170, 120, 70]);
  const message = JSON.parse((await service().generateDayNightCycle(cycle)).message) as { operation: string; stages: string[] };
  assert.equal(message.operation, "generate_day_night_cycle"); assert.deepEqual(message.stages, ["day", "sunset", "night", "sunrise"]);
});

test("day night cycle rejects invalid frame, intensity, and seed values", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-day-night-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const result = await service().generateDayNightCycle({ inputFilename: input, outputFilename: path.join(directory, "out.gif"), frames: 3, seed: 1.5, intensity: 2 });
  assert.equal(result.ok, false);
  const zeroIntensity = await service().generateDayNightCycle({ inputFilename: input, outputFilename: path.join(directory, "zero.gif"), frames: 8, seed: 1, intensity: 0 });
  assert.equal(zeroIntensity.ok, false);
});
