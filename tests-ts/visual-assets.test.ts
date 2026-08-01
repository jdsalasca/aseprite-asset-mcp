import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import { VisualAssetService } from "../src/application/services/VisualAssetService.js";
import { SharpRasterCodec } from "../src/infrastructure/image/SharpRasterCodec.js";
import { JsonAssetManifestWriter } from "../src/infrastructure/image/JsonAssetManifestWriter.js";

async function makeReference(filename: string): Promise<void> {
  const pixels = new Uint8ClampedArray([
    20, 30, 50, 255, 220, 180, 100, 255,
    20, 30, 50, 255, 0, 0, 0, 0,
  ]);
  await sharp(Buffer.from(pixels), { raw: { width: 2, height: 2, channels: 4 } }).png().toFile(filename);
}

function service(): VisualAssetService { return new VisualAssetService(new SharpRasterCodec(), new JsonAssetManifestWriter()); }

test("style bible and reference analysis produce compact contracts", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "visual-assets-style-"));
  const style = path.join(directory, "style.json");
  const reference = path.join(directory, "reference.png");
  const assetService = service();
  const styleResult = await assetService.createStyleBible({ filename: style, style: { id: "coastal", baseSize: 16, palette: ["#14253A", "#E2C277", "#30A0C0"], outlineColor: "#14253A", lightDirection: "south_east", detailLevel: "high", seed: 42, materials: { water: ["#30A0C0"] } } });
  assert.equal(styleResult.ok, true);
  await makeReference(reference);
  const report = await assetService.inspectReference(reference);
  assert.equal(report.ok, true);
  assert.match(report.message, /"frames":1/);
  assert.match(report.message, /"edgeDensity"/);
});

test("quality gate detects isolated pixels and low contrast", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "visual-assets-quality-"));
  const reference = path.join(directory, "reference.png");
  await makeReference(reference);
  const result = await service().runQualityGate({ filename: reference, maxIsolatedPixels: 0, minContrast: 0.9 });
  assert.equal(result.ok, false);
  assert.match(result.message, /isolated pixels|contrast/);
});

test("terrain tileset, world map, beach waves, and time-of-day pack are reproducible", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "visual-assets-world-"));
  const tileset = path.join(directory, "terrain.png");
  const tilesetManifest = path.join(directory, "terrain.json");
  const map = path.join(directory, "map.json");
  const preview = path.join(directory, "map.png");
  const waves = path.join(directory, "waves.gif");
  const timeOfDay = path.join(directory, "time-of-day.gif");
  const timeManifest = path.join(directory, "time-of-day.json");
  const assetService = service();
  assert.equal((await assetService.buildTerrainTileset({ outputFilename: tileset, manifestFilename: tilesetManifest, tileSize: 8, terrains: ["water", "sand", "grass", "rock"], seed: 7 })).ok, true);
  assert.equal((await assetService.generateBeachScene({ mapFilename: map, previewFilename: preview, waveFilename: waves, width: 24, height: 16, seed: 7, biomes: ["water", "sand"], waveFrames: 4 })).ok, true);
  assert.equal((await assetService.generateTimeOfDayPack({ inputFilename: preview, outputFilename: timeOfDay, manifestFilename: timeManifest, steps: 12 })).ok, true);
  const tilesetMetadata = await sharp(tileset).metadata();
  const waveMetadata = await sharp(waves, { animated: true }).metadata();
  const timeMetadata = await sharp(timeOfDay, { animated: true }).metadata();
  assert.equal(tilesetMetadata.width, 128);
  assert.equal(tilesetMetadata.height, 32);
  assert.equal(waveMetadata.pages, 4);
  assert.equal(timeMetadata.pages, 12);
  assert.match(await fs.readFile(map, "utf8"), /"seed": 7/);
  assert.match(await fs.readFile(tilesetManifest, "utf8"), /"adjacencyMask"/);
});

test("environment pack creates one themed artifact manifest", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "visual-assets-pack-"));
  const result = await service().generateEnvironmentPack({ kind: "forest", outputPrefix: path.join(directory, "forest"), width: 20, height: 12, seed: 99, tileSize: 8, detailLevel: "high" });
  assert.equal(result.ok, true);
  assert.match(result.message, /"generate_environment_pack"/);
  assert.equal((await fs.stat(path.join(directory, "forest-tileset.png"))).isFile(), true);
  assert.equal((await fs.stat(path.join(directory, "forest-map.json"))).isFile(), true);
  assert.equal((await fs.stat(path.join(directory, "forest-time-of-day.gif"))).isFile(), true);
});
