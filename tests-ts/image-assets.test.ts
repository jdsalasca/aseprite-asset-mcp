import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import { PixelArtAssetService } from "../src/application/services/PixelArtAssetService.js";
import { SharpRasterCodec } from "../src/infrastructure/image/SharpRasterCodec.js";
import { JsonAssetManifestWriter } from "../src/infrastructure/image/JsonAssetManifestWriter.js";

async function makePng(filename: string, color: [number, number, number, number]): Promise<void> {
  await sharp(Buffer.from(color), { raw: { width: 1, height: 1, channels: 4 } }).png().toFile(filename);
}

test("Sharp codec decodes PNG and encodes GIF with frame delays", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-image-test-"));
  const codec = new SharpRasterCodec();
  const input = path.join(directory, "input.png");
  const gif = path.join(directory, "output.gif");
  await makePng(input, [255, 20, 40, 255]);
  const frames = await codec.decode(input);
  assert.equal(frames.length, 1);
  assert.deepEqual([...frames[0]!.pixels], [255, 20, 40, 255]);
  await codec.encode([{ ...frames[0]!, delayMs: 80 }, { width: 1, height: 1, pixels: new Uint8ClampedArray([20, 255, 40, 255]), delayMs: 120 }], gif, "gif");
  const metadata = await sharp(gif, { animated: true }).metadata();
  assert.equal(metadata.pages, 2);
  assert.deepEqual(metadata.delay, [80, 120]);
});

test("Sharp codec decodes an in-memory preview buffer without touching disk", async () => {
  const codec = new SharpRasterCodec();
  const encoded = await sharp(Buffer.from([12, 34, 56, 255, 200, 100, 20, 255]), { raw: { width: 2, height: 1, channels: 4 } }).png().toBuffer();
  const frames = await codec.decodeBuffer(encoded);
  assert.equal(frames.length, 1);
  assert.equal(frames[0]?.width, 2);
  assert.equal(frames[0]?.height, 1);
  assert.deepEqual([...frames[0]!.pixels], [12, 34, 56, 255, 200, 100, 20, 255]);
});

test("asset service converts, inspects, validates, and packs without shelling out", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-asset-service-test-"));
  const inputA = path.join(directory, "a.png");
  const inputB = path.join(directory, "b.png");
  const converted = path.join(directory, "converted.png");
  const atlas = path.join(directory, "atlas.png");
  const manifest = path.join(directory, "atlas.json");
  await makePng(inputA, [255, 0, 0, 255]);
  await makePng(inputB, [0, 255, 0, 255]);
  const service = new PixelArtAssetService(new SharpRasterCodec());
  const conversion = await service.convertImage({ inputFilename: inputA, outputFilename: converted, width: 2, height: 2, maxColors: 2 });
  assert.equal(conversion.ok, true);
  const inspection = await service.inspect(converted);
  assert.equal(inspection.ok, true);
  assert.match(inspection.message, /"frameCount":1/);
  const inspectionPayload = JSON.parse(inspection.message) as { subject?: unknown[] };
  assert.equal(inspectionPayload.subject?.length, 1);
  const validation = await service.validate({ filename: inputA, maxColors: 2, maxIsolatedPixels: 0 });
  assert.equal(validation.ok, false);
  const atlasResult = await service.buildAtlas({ inputFilenames: [inputA, inputB], outputFilename: atlas, columns: 2, padding: 1 });
  assert.equal(atlasResult.ok, true);
  const atlasMetadata = await sharp(atlas).metadata();
  assert.equal(atlasMetadata.width, 3);
  assert.equal(atlasMetadata.height, 1);
  const packService = new PixelArtAssetService(new SharpRasterCodec(), new JsonAssetManifestWriter());
  const packResult = await packService.exportPack({ inputFilenames: [inputA, inputB], outputFilename: atlas, manifestFilename: manifest, columns: 2 });
  assert.equal(packResult.ok, true);
  assert.match(await fs.readFile(manifest, "utf8"), /"schemaVersion": 1/);
});

test("asset quality bundle inspects once and returns compact violations with recommendations", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-quality-bundle-test-"));
  const input = path.join(directory, "isolated.png");
  await makePng(input, [255, 0, 0, 255]);
  const service = new PixelArtAssetService(new SharpRasterCodec());
  const result = await service.qualityBundle({ filename: input, maxColors: 2, maxIsolatedPixels: 0 });
  assert.equal(result.ok, false);
  const payload = JSON.parse(result.message) as { operation: string; inspection: { frameCount: number }; quality: { valid: boolean; violations: string[] }; recommendations: string[] };
  assert.equal(payload.operation, "inspect_asset_bundle");
  assert.equal(payload.inspection.frameCount, 1);
  assert.equal(payload.quality.valid, false);
  assert.match(payload.quality.violations[0] ?? "", /isolated pixels/);
  assert.ok(payload.recommendations.some((recommendation) => /outline|aislad|isolated/i.test(recommendation)));
});

test("asset recipe defaults to a compact dry-run plan", async () => {
  const service = new PixelArtAssetService(new SharpRasterCodec());
  const result = await service.runRecipe({ recipe: "animation_pixel_art", inputFilenames: ["input.gif"] });
  assert.equal(result.ok, true);
  assert.match(result.message, /"dryRun":true/);
  assert.match(result.message, /preserve delays/);
});

test("atlas and pack operations reject overwriting an input asset", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-nondestructive-atlas-"));
  const inputA = path.join(directory, "a.png");
  const inputB = path.join(directory, "b.png");
  await makePng(inputA, [255, 0, 0, 255]);
  await makePng(inputB, [0, 255, 0, 255]);
  const service = new PixelArtAssetService(new SharpRasterCodec(), new JsonAssetManifestWriter());

  const atlas = await service.buildAtlas({ inputFilenames: [inputA, inputB], outputFilename: inputA });
  const pack = await service.exportPack({ inputFilenames: [inputA, inputB], outputFilename: inputB, manifestFilename: path.join(directory, "manifest.json") });

  assert.equal(atlas.ok, false);
  assert.match(atlas.message, /different from an input asset/);
  assert.equal(pack.ok, false);
  assert.match(pack.message, /different from an input asset/);
});

test("pixel upscale uses nearest-neighbor, preserves transparency and animation timing", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-upscale-test-"));
  const input = path.join(directory, "source.png");
  const output = path.join(directory, "upscaled.png");
  await sharp(Buffer.from([
    255, 0, 0, 255, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 255, 0, 255,
  ]), { raw: { width: 2, height: 2, channels: 4 } }).png().toFile(input);
  const service = new PixelArtAssetService(new SharpRasterCodec());

  const result = await service.upscalePixelArt({ inputFilename: input, outputFilename: output, scale: 3 });
  assert.equal(result.ok, true);
  const pixels = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual(pixels.info, { format: "raw", width: 6, height: 6, channels: 4, depth: "uchar", premultiplied: false, hasAlpha: true, size: 144 });
  assert.deepEqual([...pixels.data.subarray(0, 4)], [255, 0, 0, 255]);
  assert.deepEqual([...pixels.data.subarray(4, 8)], [255, 0, 0, 255]);
  assert.deepEqual([...pixels.data.subarray(8, 12)], [255, 0, 0, 255]);
  assert.deepEqual([...pixels.data.subarray(12, 16)], [0, 0, 0, 0]);
  const animatedInput = path.join(directory, "source.gif");
  const animatedOutput = path.join(directory, "upscaled.gif");
  const codec = new SharpRasterCodec();
  await codec.encode([
    { width: 1, height: 1, pixels: new Uint8ClampedArray([255, 0, 0, 255]), delayMs: 70 },
    { width: 1, height: 1, pixels: new Uint8ClampedArray([0, 0, 255, 255]), delayMs: 130 },
  ], animatedInput, "gif");
  const animatedResult = await service.upscalePixelArt({ inputFilename: animatedInput, outputFilename: animatedOutput, scale: 2 });
  assert.equal(animatedResult.ok, true);
  const animatedMetadata = await sharp(animatedOutput, { animated: true }).metadata();
  assert.equal(animatedMetadata.pages, 2);
  assert.deepEqual(animatedMetadata.delay, [70, 130]);
  assert.equal((await service.upscalePixelArt({ inputFilename: input, outputFilename: input, scale: 2 })).ok, false);
});

test("palette harmonization is deterministic, bounded, animated-safe, and source-preserving", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-palette-harmony-test-"));
  const input = path.join(directory, "source.png");
  const output = path.join(directory, "source-harmonized.png");
  await sharp(Buffer.from([
    255, 32, 32, 255, 32, 255, 64, 255,
    32, 32, 32, 0, 64, 128, 255, 255,
  ]), { raw: { width: 2, height: 2, channels: 4 } }).png().toFile(input);
  const original = await fs.readFile(input);
  const service = new PixelArtAssetService(new SharpRasterCodec());

  const result = await service.harmonizePalette({ inputFilename: input, outputFilename: output, accentColor: "3155d8", strength: 0.8, maxColors: 2 });
  assert.equal(result.ok, true);
  const payload = JSON.parse(result.message) as { operation: string; palette: string[]; frames: number; deterministic: boolean; sourcePreserved: boolean; strength: number; accentColor: string };
  assert.equal(payload.operation, "harmonize_asset_palette");
  assert.equal(payload.frames, 1);
  assert.equal(payload.palette.length <= 2, true);
  assert.equal(payload.deterministic, true);
  assert.equal(payload.sourcePreserved, true);
  assert.equal(payload.strength, 0.8);
  assert.equal(payload.accentColor, "#3155D8");
  assert.equal(payload.palette.every((color) => color.startsWith("#")), true);
  assert.deepEqual(await fs.readFile(input), original);
  const pixels = await sharp(output).raw().toBuffer();
  assert.deepEqual([...pixels.subarray(8, 12)], [0, 0, 0, 0]);

  const second = path.join(directory, "source-harmonized-2.png");
  const repeat = await service.harmonizePalette({ inputFilename: input, outputFilename: second, accentColor: "#3155d8", strength: 0.8, maxColors: 2 });
  assert.equal(repeat.ok, true);
  assert.deepEqual(await fs.readFile(output), await fs.readFile(second));
});

test("palette harmonization rejects unsafe aliases, invalid colors, strength, and palette limits", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-palette-harmony-invalid-"));
  const input = path.join(directory, "source.png");
  await makePng(input, [255, 0, 0, 255]);
  const service = new PixelArtAssetService(new SharpRasterCodec());
  assert.equal((await service.harmonizePalette({ inputFilename: input, outputFilename: `${directory}${path.sep}nested${path.sep}..${path.sep}source.png`, accentColor: "#3155d8", strength: 0.5, maxColors: 4 })).ok, false);
  assert.equal((await service.harmonizePalette({ inputFilename: input, outputFilename: path.join(directory, "bad-color.png"), accentColor: "blue", strength: 0.5, maxColors: 4 })).ok, false);
  assert.equal((await service.harmonizePalette({ inputFilename: input, outputFilename: path.join(directory, "bad-strength.png"), accentColor: "#3155d8", strength: 1.1, maxColors: 4 })).ok, false);
  assert.equal((await service.harmonizePalette({ inputFilename: input, outputFilename: path.join(directory, "bad-palette.png"), accentColor: "#3155d8", strength: 0.5, maxColors: 1 })).ok, false);
});

test("batch asset jobs return one compact plan", async () => {
  const service = new PixelArtAssetService(new SharpRasterCodec());
  const result = await service.runBatch({ jobs: [
    { recipe: "pixel_art", inputFilenames: ["a.png"], outputFilename: "a-pixel.png" },
    { recipe: "atlas", inputFilenames: ["a.png", "b.png"], outputFilename: "atlas.png" },
  ] });
  assert.equal(result.ok, true);
  assert.match(result.message, /"jobs"/);
  assert.match(result.message, /"atlas"/);
});
