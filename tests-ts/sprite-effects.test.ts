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

test("sprite color ramp maps luminance into deterministic palette bands and preserves alpha/source", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-color-ramp-"));
  const input = path.join(directory, "input.png"); const first = path.join(directory, "first.png"); const second = path.join(directory, "second.png");
  const pixels = new Uint8ClampedArray(3 * 1 * 4);
  pixels.set([20, 20, 20, 255], 0); pixels.set([120, 120, 120, 128], 4); pixels.set([240, 240, 240, 255], 8);
  await sharp(Buffer.from(pixels), { raw: { width: 3, height: 1, channels: 4 } }).png().toFile(input);
  const sourceBefore = await fs.readFile(input);
  const operation = { inputFilename: input, outputFilename: first, shadowColor: "#101020", midColor: "#6080A0", highlightColor: "#FFFFFF", shadowThreshold: 0.3, highlightThreshold: 0.7 };
  const apply = (service() as unknown as { applySpriteColorRamp(value: typeof operation): Promise<{ ok: boolean; message: string }> }).applySpriteColorRamp;
  assert.equal((await apply.call(service(), operation)).ok, true);
  assert.equal((await apply.call(service(), { ...operation, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second)); assert.deepEqual(await fs.readFile(input), sourceBefore);
  const output = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual(Array.from(output.data.slice(0, 4)), [16, 16, 32, 255]);
  assert.deepEqual(Array.from(output.data.slice(4, 8)), [96, 128, 160, 128]);
  assert.deepEqual(Array.from(output.data.slice(8, 12)), [255, 255, 255, 255]);
});

test("sprite color ramp rejects invalid threshold ordering and colors", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-color-ramp-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const apply = (service() as unknown as { applySpriteColorRamp(value: unknown): Promise<{ ok: boolean; message: string }> }).applySpriteColorRamp;
  const invalidOrder = await apply.call(service(), { inputFilename: input, outputFilename: path.join(directory, "order.png"), shadowColor: "#000000", midColor: "#888888", highlightColor: "#FFFFFF", shadowThreshold: 0.8, highlightThreshold: 0.2 });
  const invalidColor = await apply.call(service(), { inputFilename: input, outputFilename: path.join(directory, "color.png"), shadowColor: "bad", midColor: "#888888", highlightColor: "#FFFFFF" });
  assert.equal(invalidOrder.ok, false); assert.match(invalidOrder.message, /threshold/i);
  assert.equal(invalidColor.ok, false); assert.match(invalidColor.message, /color/i);
});

test("sprite grain is seeded, scale-aware, alpha-safe, and source-preserving", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-grain-"));
  const input = path.join(directory, "input.png"); const first = path.join(directory, "first.png"); const second = path.join(directory, "second.png");
  const pixels = new Uint8ClampedArray(6 * 6 * 4);
  for (let y = 1; y < 5; y += 1) for (let x = 1; x < 5; x += 1) pixels.set([120, 140, 160, 180], (y * 6 + x) * 4);
  await sharp(Buffer.from(pixels), { raw: { width: 6, height: 6, channels: 4 } }).png().toFile(input);
  const sourceBefore = await fs.readFile(input);
  const operation = { inputFilename: input, outputFilename: first, seed: 17, intensity: 0.8, scale: 2 };
  const apply = (service() as unknown as { applySpriteGrain(value: typeof operation): Promise<{ ok: boolean; message: string }> }).applySpriteGrain;
  assert.equal((await apply.call(service(), operation)).ok, true);
  assert.equal((await apply.call(service(), { ...operation, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second)); assert.deepEqual(await fs.readFile(input), sourceBefore);
  const output = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  assert.equal(output.data[(0 * 6 + 0) * 4 + 3], 0);
  assert.equal(output.data[(2 * 6 + 2) * 4 + 3], 180);
  assert.notDeepEqual(Array.from(output.data.slice((2 * 6 + 2) * 4, (2 * 6 + 2) * 4 + 3)), [120, 140, 160]);
});

test("sprite grain rejects invalid intensity and scale", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-grain-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const apply = (service() as unknown as { applySpriteGrain(value: unknown): Promise<{ ok: boolean; message: string }> }).applySpriteGrain;
  const invalidIntensity = await apply.call(service(), { inputFilename: input, outputFilename: path.join(directory, "intensity.png"), seed: 1, intensity: 2, scale: 1 });
  const invalidScale = await apply.call(service(), { inputFilename: input, outputFilename: path.join(directory, "scale.png"), seed: 1, intensity: 0.5, scale: 9 });
  assert.equal(invalidIntensity.ok, false); assert.match(invalidIntensity.message, /intensity/i);
  assert.equal(invalidScale.ok, false); assert.match(invalidScale.message, /scale/i);
});

test("sprite dithering is deterministic, alpha-safe, and source-preserving", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-dither-"));
  const input = path.join(directory, "input.png"); const first = path.join(directory, "first.png"); const second = path.join(directory, "second.png");
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 1; y < 7; y += 1) for (let x = 1; x < 7; x += 1) {
    const luma = Math.round((x / 6) * 255); pixels.set([luma, luma, luma, 200], (y * 8 + x) * 4);
  }
  await sharp(Buffer.from(pixels), { raw: { width: 8, height: 8, channels: 4 } }).png().toFile(input);
  const sourceBefore = await fs.readFile(input);
  const operation = { inputFilename: input, outputFilename: first, darkColor: "#202030", lightColor: "#F0E8C8", strength: 1, scale: 1 };
  const apply = (service() as unknown as { applySpriteDither(value: typeof operation): Promise<{ ok: boolean; message: string }> }).applySpriteDither;
  assert.equal((await apply.call(service(), operation)).ok, true);
  assert.equal((await apply.call(service(), { ...operation, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second)); assert.deepEqual(await fs.readFile(input), sourceBefore);
  const output = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  assert.equal(output.data[(0 * 8 + 0) * 4 + 3], 0);
  assert.equal(output.data[(3 * 8 + 3) * 4 + 3], 200);
  const colors = new Set<string>(); for (let offset = 0; offset < output.data.length; offset += 4) if (output.data[offset + 3] !== 0) colors.add(`${output.data[offset]},${output.data[offset + 1]},${output.data[offset + 2]}`);
  assert.ok(colors.has("32,32,48")); assert.ok(colors.has("240,232,200"));
});

test("sprite dithering rejects invalid strength, scale, and colors", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-dither-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const apply = (service() as unknown as { applySpriteDither(value: unknown): Promise<{ ok: boolean; message: string }> }).applySpriteDither;
  const invalidStrength = await apply.call(service(), { inputFilename: input, outputFilename: path.join(directory, "strength.png"), darkColor: "#000000", lightColor: "#ffffff", strength: 2, scale: 1 });
  const invalidScale = await apply.call(service(), { inputFilename: input, outputFilename: path.join(directory, "scale.png"), darkColor: "#000000", lightColor: "#ffffff", strength: 0.5, scale: 9 });
  const invalidColor = await apply.call(service(), { inputFilename: input, outputFilename: path.join(directory, "color.png"), darkColor: "bad", lightColor: "#ffffff", strength: 0.5, scale: 1 });
  assert.equal(invalidStrength.ok, false); assert.match(invalidStrength.message, /strength/i);
  assert.equal(invalidScale.ok, false); assert.match(invalidScale.message, /scale/i);
  assert.equal(invalidColor.ok, false); assert.match(invalidColor.message, /color/i);
});

test("sprite color temperature is deterministic, alpha-safe, and source-preserving", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-temperature-"));
  const input = path.join(directory, "input.png"); const first = path.join(directory, "first.png"); const second = path.join(directory, "second.png");
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  for (let y = 1; y < 3; y += 1) for (let x = 1; x < 3; x += 1) pixels.set([120, 140, 160, 180], (y * 4 + x) * 4);
  await sharp(Buffer.from(pixels), { raw: { width: 4, height: 4, channels: 4 } }).png().toFile(input);
  const sourceBefore = await fs.readFile(input);
  const operation = { inputFilename: input, outputFilename: first, temperature: 1, intensity: 1 };
  const apply = (service() as unknown as { applySpriteColorTemperature(value: typeof operation): Promise<{ ok: boolean; message: string }> }).applySpriteColorTemperature;
  assert.equal((await apply.call(service(), operation)).ok, true);
  assert.equal((await apply.call(service(), { ...operation, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second)); assert.deepEqual(await fs.readFile(input), sourceBefore);
  const output = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  assert.equal(output.data[3], 0); assert.equal(output.data[(1 * 4 + 1) * 4 + 3], 180);
  assert.notDeepEqual(Array.from(output.data.slice((1 * 4 + 1) * 4, (1 * 4 + 1) * 4 + 3)), [120, 140, 160]);
});

test("sprite color temperature rejects invalid ranges", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-temperature-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const apply = (service() as unknown as { applySpriteColorTemperature(value: unknown): Promise<{ ok: boolean; message: string }> }).applySpriteColorTemperature;
  const invalidTemperature = await apply.call(service(), { inputFilename: input, outputFilename: path.join(directory, "temperature.png"), temperature: 2, intensity: 0.5 });
  const invalidIntensity = await apply.call(service(), { inputFilename: input, outputFilename: path.join(directory, "intensity.png"), temperature: 0, intensity: 2 });
  assert.equal(invalidTemperature.ok, false); assert.match(invalidTemperature.message, /temperature/i);
  assert.equal(invalidIntensity.ok, false); assert.match(invalidIntensity.message, /intensity/i);
});

test("sprite silhouette is deterministic, preserves alpha, and keeps the source intact", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-silhouette-"));
  const input = path.join(directory, "input.png"); const first = path.join(directory, "first.png"); const second = path.join(directory, "second.png");
  await makeSprite(input); const sourceBefore = await fs.readFile(input);
  const operation = { inputFilename: input, outputFilename: first, color: "#08111F", opacity: 0.6 };
  assert.equal((await service().generateSpriteSilhouette(operation)).ok, true);
  assert.equal((await service().generateSpriteSilhouette({ ...operation, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second)); assert.deepEqual(await fs.readFile(input), sourceBefore);
  const source = await sharp(input).raw().toBuffer({ resolveWithObject: true }); const output = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  const opaqueOffset = (1 * 4 + 1) * 4;
  assert.equal(output.data[3], 0); assert.equal(output.data[opaqueOffset], 8); assert.equal(output.data[opaqueOffset + 1], 17); assert.equal(output.data[opaqueOffset + 2], 31); assert.equal(output.data[opaqueOffset + 3], Math.round((source.data[opaqueOffset + 3] ?? 0) * 0.6));
});

test("sprite silhouette rejects invalid opacity and colors", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-silhouette-invalid-")); const input = path.join(directory, "input.png"); await makeSprite(input);
  const invalidOpacity = await service().generateSpriteSilhouette({ inputFilename: input, outputFilename: path.join(directory, "opacity.png"), color: "#ffffff", opacity: 1.1 });
  const invalidColor = await service().generateSpriteSilhouette({ inputFilename: input, outputFilename: path.join(directory, "color.png"), color: "#gggggg", opacity: 1 });
  assert.equal(invalidOpacity.ok, false); assert.match(invalidOpacity.message, /opacity/i);
  assert.equal(invalidColor.ok, false); assert.match(invalidColor.message, /color/i);
});

test("wind sway is seeded, keeps the base stable, and exports a repeatable GIF", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-wind-sway-"));
  const input = path.join(directory, "tree.png"); const first = path.join(directory, "first.gif"); const second = path.join(directory, "second.gif");
  const pixels = new Uint8ClampedArray(7 * 7 * 4);
  const set = (x: number, y: number, color: [number, number, number, number]) => pixels.set(color, (y * 7 + x) * 4);
  for (let y = 1; y <= 3; y += 1) for (let x = 2; x <= 4; x += 1) set(x, y, [50, 180, 80, 255]);
  for (let y = 4; y < 7; y += 1) set(3, y, [110, 70, 35, 255]);
  await sharp(Buffer.from(pixels), { raw: { width: 7, height: 7, channels: 4 } }).png().toFile(input);
  const operation = { inputFilename: input, outputFilename: first, frames: 6, seed: 19, amplitude: 2, direction: "right" as const, delayMs: 75, format: "gif" as const };
  assert.equal((await service().generateWindSway(operation)).ok, true);
  assert.equal((await service().generateWindSway({ ...operation, outputFilename: second })).ok, true);
  assert.deepEqual(await fs.readFile(first), await fs.readFile(second));
  const metadata = await sharp(first, { animated: true }).metadata();
  assert.equal(metadata.pages, 6); assert.equal(metadata.width, 7); assert.equal(metadata.pageHeight, 7);
  const output = await sharp(first, { animated: true }).raw().toBuffer({ resolveWithObject: true });
  const pageBytes = 7 * 7 * 4;
  assert.notDeepEqual([...output.data.slice(0, pageBytes)], [...output.data.slice(pageBytes, pageBytes * 2)]);
  const baseOffset = (6 * 7 + 3) * 4;
  assert.equal(output.data[baseOffset + 3], 255);
});

test("wind sway rejects unsafe frame, amplitude, and direction contracts", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-wind-sway-invalid-")); const input = path.join(directory, "tree.png"); await makeSprite(input);
  const invalidFrames = await service().generateWindSway({ inputFilename: input, outputFilename: path.join(directory, "frames.gif"), frames: 1, seed: 1, amplitude: 2, direction: "left" });
  const invalidAmplitude = await service().generateWindSway({ inputFilename: input, outputFilename: path.join(directory, "amplitude.gif"), frames: 6, seed: 1, amplitude: 9, direction: "left" });
  const invalidDirection = await service().generateWindSway({ inputFilename: input, outputFilename: path.join(directory, "direction.gif"), frames: 6, seed: 1, amplitude: 2, direction: "up" as "left" });
  assert.equal(invalidFrames.ok, false); assert.match(invalidFrames.message, /frame/i);
  assert.equal(invalidAmplitude.ok, false); assert.match(invalidAmplitude.message, /amplitude/i);
  assert.equal(invalidDirection.ok, false); assert.match(invalidDirection.message, /direction/i);
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

test("fog overlay is seeded, preserves dimensions and alpha, and exports a repeatable animation", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-fog-overlay-"));
  const input = path.join(directory, "scene.png");
  const first = path.join(directory, "first.gif");
  const second = path.join(directory, "second.gif");
  await makeSprite(input);
  const fog = { inputFilename: input, outputFilename: first, seed: 23, density: 0.72, drift: -0.35, color: "#DDEBFF", frames: 5, delayMs: 110, format: "gif" as const };
  const result = await service().generateFogOverlay(fog);
  assert.equal(result.ok, true);
  assert.equal((await service().generateFogOverlay({ ...fog, outputFilename: second })).ok, true);
  const firstFrames = await new SharpRasterCodec().decode(first);
  const secondFrames = await new SharpRasterCodec().decode(second);
  assert.equal(firstFrames.length, 5);
  assert.deepEqual(firstFrames.map((frame) => [frame.width, frame.height]), secondFrames.map((frame) => [frame.width, frame.height]));
  assert.deepEqual(firstFrames.map((frame) => [...frame.pixels]), secondFrames.map((frame) => [...frame.pixels]));
  assert.equal(firstFrames[0]?.pixels[(0 * 8 + 0) * 4 + 3], 0);
  assert.match(result.message, /generate_fog_overlay/);
});

test("fog overlay rejects invalid density, drift, and animated PNG output", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-fog-overlay-invalid-"));
  const input = path.join(directory, "scene.png");
  await makeSprite(input);
  const invalidDensity = await service().generateFogOverlay({ inputFilename: input, outputFilename: path.join(directory, "density.gif"), seed: 1, density: 1.2, drift: 0, color: "#FFFFFF" });
  const invalidDrift = await service().generateFogOverlay({ inputFilename: input, outputFilename: path.join(directory, "drift.gif"), seed: 1, density: 0.5, drift: 2, color: "#FFFFFF" });
  const animatedPng = await service().generateFogOverlay({ inputFilename: input, outputFilename: path.join(directory, "animated.png"), seed: 1, density: 0.5, drift: 0, color: "#FFFFFF", frames: 2, format: "png" });
  assert.equal(invalidDensity.ok, false);
  assert.equal(invalidDrift.ok, false);
  assert.equal(animatedPng.ok, false);
});

test("snow overlay is deterministic, preserves transparent pixels, and animates flakes", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-snow-overlay-"));
  const input = path.join(directory, "scene.png");
  const first = path.join(directory, "first.gif");
  const second = path.join(directory, "second.gif");
  await makeSprite(input);
  const snow = { inputFilename: input, outputFilename: first, seed: 31, density: 0.8, wind: -0.25, color: "#F5FBFF", frames: 5, delayMs: 100, format: "gif" as const };
  const result = await service().generateSnowOverlay(snow);
  assert.equal(result.ok, true);
  assert.equal((await service().generateSnowOverlay({ ...snow, outputFilename: second })).ok, true);
  const firstFrames = await new SharpRasterCodec().decode(first);
  const secondFrames = await new SharpRasterCodec().decode(second);
  assert.equal(firstFrames.length, 5);
  assert.deepEqual(firstFrames.map((frame) => [...frame.pixels]), secondFrames.map((frame) => [...frame.pixels]));
  assert.equal(firstFrames[0]?.pixels[(0 * 4 + 0) * 4 + 3], 0);
  assert.match(result.message, /generate_snow_overlay/);
});

test("snow overlay rejects invalid density, wind, and animated PNG output", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-snow-overlay-invalid-"));
  const input = path.join(directory, "scene.png");
  await makeSprite(input);
  const invalidDensity = await service().generateSnowOverlay({ inputFilename: input, outputFilename: path.join(directory, "density.gif"), seed: 1, density: 1.2, wind: 0, color: "#FFFFFF" });
  const invalidWind = await service().generateSnowOverlay({ inputFilename: input, outputFilename: path.join(directory, "wind.gif"), seed: 1, density: 0.5, wind: 2, color: "#FFFFFF" });
  const animatedPng = await service().generateSnowOverlay({ inputFilename: input, outputFilename: path.join(directory, "animated.png"), seed: 1, density: 0.5, wind: 0, color: "#FFFFFF", frames: 2, format: "png" });
  assert.equal(invalidDensity.ok, false);
  assert.equal(invalidWind.ok, false);
  assert.equal(animatedPng.ok, false);
});

test("smoke overlay is deterministic, preserves transparent pixels, and animates rising puffs", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-smoke-overlay-"));
  const input = path.join(directory, "scene.png");
  const first = path.join(directory, "first.gif");
  const second = path.join(directory, "second.gif");
  await makeSprite(input);
  const smoke = { inputFilename: input, outputFilename: first, seed: 41, density: 0.75, drift: 0.2, rise: 0.8, color: "#8A91A8", frames: 5, delayMs: 100, format: "gif" as const };
  const result = await service().generateSmokeOverlay(smoke);
  assert.equal(result.ok, true);
  assert.equal((await service().generateSmokeOverlay({ ...smoke, outputFilename: second })).ok, true);
  const firstFrames = await new SharpRasterCodec().decode(first);
  const secondFrames = await new SharpRasterCodec().decode(second);
  assert.equal(firstFrames.length, 5);
  assert.deepEqual(firstFrames.map((frame) => [...frame.pixels]), secondFrames.map((frame) => [...frame.pixels]));
  assert.equal(firstFrames[0]?.pixels[(0 * 4 + 0) * 4 + 3], 0);
  assert.match(result.message, /generate_smoke_overlay/);
});

test("smoke overlay rejects invalid density, drift, rise, and animated PNG output", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-smoke-overlay-invalid-"));
  const input = path.join(directory, "scene.png");
  await makeSprite(input);
  const invalidDensity = await service().generateSmokeOverlay({ inputFilename: input, outputFilename: path.join(directory, "density.gif"), seed: 1, density: 1.2, drift: 0, rise: 0.6, color: "#FFFFFF" });
  const invalidDrift = await service().generateSmokeOverlay({ inputFilename: input, outputFilename: path.join(directory, "drift.gif"), seed: 1, density: 0.5, drift: 2, rise: 0.6, color: "#FFFFFF" });
  const invalidRise = await service().generateSmokeOverlay({ inputFilename: input, outputFilename: path.join(directory, "rise.gif"), seed: 1, density: 0.5, drift: 0, rise: 2, color: "#FFFFFF" });
  const animatedPng = await service().generateSmokeOverlay({ inputFilename: input, outputFilename: path.join(directory, "animated.png"), seed: 1, density: 0.5, drift: 0, rise: 0.6, color: "#FFFFFF", frames: 2, format: "png" });
  assert.equal(invalidDensity.ok, false);
  assert.equal(invalidDrift.ok, false);
  assert.equal(invalidRise.ok, false);
  assert.equal(animatedPng.ok, false);
});

test("fire overlay is deterministic, preserves transparent pixels, and animates flicker", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-fire-overlay-"));
  const input = path.join(directory, "scene.png");
  const first = path.join(directory, "first.gif");
  const second = path.join(directory, "second.gif");
  await makeSprite(input);
  const fire = { inputFilename: input, outputFilename: first, seed: 53, intensity: 0.82, flicker: 0.7, color: "#FFD65A", frames: 5, delayMs: 100, format: "gif" as const };
  const result = await service().generateFireOverlay(fire);
  assert.equal(result.ok, true);
  assert.equal((await service().generateFireOverlay({ ...fire, outputFilename: second })).ok, true);
  const firstFrames = await new SharpRasterCodec().decode(first);
  const secondFrames = await new SharpRasterCodec().decode(second);
  assert.equal(firstFrames.length, 5);
  assert.deepEqual(firstFrames.map((frame) => [...frame.pixels]), secondFrames.map((frame) => [...frame.pixels]));
  assert.equal(firstFrames[0]?.pixels[(0 * 4 + 0) * 4 + 3], 0);
  assert.match(result.message, /generate_fire_overlay/);
});

test("fire overlay rejects invalid intensity, flicker, and animated PNG output", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-fire-overlay-invalid-"));
  const input = path.join(directory, "scene.png");
  await makeSprite(input);
  const invalidIntensity = await service().generateFireOverlay({ inputFilename: input, outputFilename: path.join(directory, "intensity.gif"), seed: 1, intensity: 1.2, flicker: 0.5, color: "#FFFFFF" });
  const invalidFlicker = await service().generateFireOverlay({ inputFilename: input, outputFilename: path.join(directory, "flicker.gif"), seed: 1, intensity: 0.5, flicker: -1, color: "#FFFFFF" });
  const animatedPng = await service().generateFireOverlay({ inputFilename: input, outputFilename: path.join(directory, "animated.png"), seed: 1, intensity: 0.5, flicker: 0.5, color: "#FFFFFF", frames: 2, format: "png" });
  assert.equal(invalidIntensity.ok, false);
  assert.equal(invalidFlicker.ok, false);
  assert.equal(animatedPng.ok, false);
});

test("lightning overlay is deterministic, preserves transparent pixels, and animates flashes", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-lightning-overlay-"));
  const input = path.join(directory, "scene.png");
  const first = path.join(directory, "first.gif");
  const second = path.join(directory, "second.gif");
  await makeSprite(input);
  const lightning = { inputFilename: input, outputFilename: first, seed: 67, intensity: 0.72, flash: 0.8, color: "#D8F3FF", frames: 5, delayMs: 100, format: "gif" as const };
  const result = await service().generateLightningOverlay(lightning);
  assert.equal(result.ok, true);
  assert.equal((await service().generateLightningOverlay({ ...lightning, outputFilename: second })).ok, true);
  const firstFrames = await new SharpRasterCodec().decode(first);
  const secondFrames = await new SharpRasterCodec().decode(second);
  assert.equal(firstFrames.length, 5);
  assert.deepEqual(firstFrames.map((frame) => [...frame.pixels]), secondFrames.map((frame) => [...frame.pixels]));
  assert.equal(firstFrames[0]?.pixels[(0 * 4 + 0) * 4 + 3], 0);
  assert.match(result.message, /generate_lightning_overlay/);
});

test("lightning overlay rejects invalid intensity, flash, and animated PNG output", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-lightning-overlay-invalid-"));
  const input = path.join(directory, "scene.png");
  await makeSprite(input);
  const invalidIntensity = await service().generateLightningOverlay({ inputFilename: input, outputFilename: path.join(directory, "intensity.gif"), seed: 1, intensity: 1.2, flash: 0.5, color: "#FFFFFF" });
  const invalidFlash = await service().generateLightningOverlay({ inputFilename: input, outputFilename: path.join(directory, "flash.gif"), seed: 1, intensity: 0.5, flash: -1, color: "#FFFFFF" });
  const animatedPng = await service().generateLightningOverlay({ inputFilename: input, outputFilename: path.join(directory, "animated.png"), seed: 1, intensity: 0.5, flash: 0.5, color: "#FFFFFF", frames: 2, format: "png" });
  assert.equal(invalidIntensity.ok, false);
  assert.equal(invalidFlash.ok, false);
  assert.equal(animatedPng.ok, false);
});

test("wave overlay is deterministic, preserves transparent pixels, and animates shoreline foam", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-wave-overlay-"));
  const input = path.join(directory, "coast.png");
  const first = path.join(directory, "first.gif");
  const second = path.join(directory, "second.gif");
  await makeSprite(input);
  const wave = { inputFilename: input, outputFilename: first, seed: 79, density: 0.78, amplitude: 3, color: "#E6FAFF", frames: 5, delayMs: 100, format: "gif" as const };
  const result = await service().generateWaveOverlay(wave);
  assert.equal(result.ok, true);
  assert.equal((await service().generateWaveOverlay({ ...wave, outputFilename: second })).ok, true);
  const firstFrames = await new SharpRasterCodec().decode(first);
  const secondFrames = await new SharpRasterCodec().decode(second);
  assert.equal(firstFrames.length, 5);
  assert.deepEqual(firstFrames.map((frame) => [...frame.pixels]), secondFrames.map((frame) => [...frame.pixels]));
  assert.equal(firstFrames[0]?.pixels[(0 * 4 + 0) * 4 + 3], 0);
  assert.match(result.message, /generate_wave_overlay/);
});

test("wave overlay rejects invalid density, amplitude, and animated PNG output", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-wave-overlay-invalid-"));
  const input = path.join(directory, "coast.png");
  await makeSprite(input);
  const invalidDensity = await service().generateWaveOverlay({ inputFilename: input, outputFilename: path.join(directory, "density.gif"), seed: 1, density: 1.2, amplitude: 2, color: "#FFFFFF" });
  const invalidAmplitude = await service().generateWaveOverlay({ inputFilename: input, outputFilename: path.join(directory, "amplitude.gif"), seed: 1, density: 0.5, amplitude: 9, color: "#FFFFFF" });
  const animatedPng = await service().generateWaveOverlay({ inputFilename: input, outputFilename: path.join(directory, "animated.png"), seed: 1, density: 0.5, amplitude: 2, color: "#FFFFFF", frames: 2, format: "png" });
  assert.equal(invalidDensity.ok, false);
  assert.equal(invalidAmplitude.ok, false);
  assert.equal(animatedPng.ok, false);
});

test("water spray is deterministic, preserves transparent pixels, and animates droplets", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-water-spray-"));
  const input = path.join(directory, "coast.png"); const first = path.join(directory, "first.gif"); const second = path.join(directory, "second.gif");
  await makeSprite(input);
  const spray = { inputFilename: input, outputFilename: first, seed: 83, density: 0.7, drift: 0.4, color: "#F4FDFF", frames: 5, delayMs: 80, format: "gif" as const };
  const result = await service().generateWaterSpray(spray);
  assert.equal(result.ok, true);
  assert.equal((await service().generateWaterSpray({ ...spray, outputFilename: second })).ok, true);
  const firstFrames = await new SharpRasterCodec().decode(first); const secondFrames = await new SharpRasterCodec().decode(second);
  assert.equal(firstFrames.length, 5);
  assert.deepEqual(firstFrames.map((frame) => [...frame.pixels]), secondFrames.map((frame) => [...frame.pixels]));
  assert.equal(firstFrames[0]?.pixels[(0 * 4 + 0) * 4 + 3], 0);
  assert.match(result.message, /generate_water_spray/);
});

test("water spray rejects invalid density, drift, and animated PNG output", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-water-spray-invalid-")); const input = path.join(directory, "coast.png"); await makeSprite(input);
  const invalidDensity = await service().generateWaterSpray({ inputFilename: input, outputFilename: path.join(directory, "density.gif"), seed: 1, density: 1.2, drift: 0, color: "#FFFFFF" });
  const invalidDrift = await service().generateWaterSpray({ inputFilename: input, outputFilename: path.join(directory, "drift.gif"), seed: 1, density: 0.5, drift: 2, color: "#FFFFFF" });
  const animatedPng = await service().generateWaterSpray({ inputFilename: input, outputFilename: path.join(directory, "animated.png"), seed: 1, density: 0.5, drift: 0, color: "#FFFFFF", frames: 2, format: "png" });
  assert.equal(invalidDensity.ok, false); assert.equal(invalidDrift.ok, false); assert.equal(animatedPng.ok, false);
});

test("dust overlay is deterministic, preserves transparent pixels, and animates drifting grains", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-dust-overlay-"));
  const input = path.join(directory, "hero.png"); const first = path.join(directory, "first.gif"); const second = path.join(directory, "second.gif"); await makeSprite(input);
  const dust = { inputFilename: input, outputFilename: first, seed: 97, density: 0.72, drift: 0.25, rise: 0.5, color: "#C79A68", frames: 5, delayMs: 90, format: "gif" as const };
  const result = await service().generateDustOverlay(dust); assert.equal(result.ok, true);
  assert.equal((await service().generateDustOverlay({ ...dust, outputFilename: second })).ok, true);
  const firstFrames = await new SharpRasterCodec().decode(first); const secondFrames = await new SharpRasterCodec().decode(second);
  assert.equal(firstFrames.length, 5); assert.deepEqual(firstFrames.map((frame) => [...frame.pixels]), secondFrames.map((frame) => [...frame.pixels]));
  assert.equal(firstFrames[0]?.pixels[(0 * 4 + 0) * 4 + 3], 0); assert.match(result.message, /generate_dust_overlay/);
});

test("dust overlay rejects invalid density, drift, rise, and animated PNG output", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sprite-dust-overlay-invalid-")); const input = path.join(directory, "hero.png"); await makeSprite(input);
  const invalidDensity = await service().generateDustOverlay({ inputFilename: input, outputFilename: path.join(directory, "density.gif"), seed: 1, density: 1.2, drift: 0, rise: 0.5, color: "#FFFFFF" });
  const invalidDrift = await service().generateDustOverlay({ inputFilename: input, outputFilename: path.join(directory, "drift.gif"), seed: 1, density: 0.5, drift: 2, rise: 0.5, color: "#FFFFFF" });
  const invalidRise = await service().generateDustOverlay({ inputFilename: input, outputFilename: path.join(directory, "rise.gif"), seed: 1, density: 0.5, drift: 0, rise: -1, color: "#FFFFFF" });
  const animatedPng = await service().generateDustOverlay({ inputFilename: input, outputFilename: path.join(directory, "animated.png"), seed: 1, density: 0.5, drift: 0, rise: 0.5, color: "#FFFFFF", frames: 2, format: "png" });
  assert.equal(invalidDensity.ok, false); assert.equal(invalidDrift.ok, false); assert.equal(invalidRise.ok, false); assert.equal(animatedPng.ok, false);
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
