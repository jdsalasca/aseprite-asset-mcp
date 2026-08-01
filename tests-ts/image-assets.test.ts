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

test("asset recipe defaults to a compact dry-run plan", async () => {
  const service = new PixelArtAssetService(new SharpRasterCodec());
  const result = await service.runRecipe({ recipe: "animation_pixel_art", inputFilenames: ["input.gif"] });
  assert.equal(result.ok, true);
  assert.match(result.message, /"dryRun":true/);
  assert.match(result.message, /preserve delays/);
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
