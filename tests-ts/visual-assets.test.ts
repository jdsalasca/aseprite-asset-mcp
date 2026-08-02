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

function service(): VisualAssetService { const manifest = new JsonAssetManifestWriter(); return new VisualAssetService(new SharpRasterCodec(), manifest, undefined, undefined, manifest); }

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

test("material texture is deterministic, preserves transparency, and cannot overwrite its source", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "visual-assets-material-"));
  const reference = path.join(directory, "reference.png");
  const firstOutput = path.join(directory, "earth-a.png");
  const secondOutput = path.join(directory, "earth-b.png");
  await makeReference(reference);
  const assetService = service();
  const first = await assetService.applyMaterialTexture({ inputFilename: reference, outputFilename: firstOutput, material: "earth", seed: 33, intensity: 0.8 });
  const second = await assetService.applyMaterialTexture({ inputFilename: reference, outputFilename: secondOutput, material: "earth", seed: 33, intensity: 0.8 });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(await fs.readFile(firstOutput), await fs.readFile(secondOutput));
  const metadata = await sharp(firstOutput).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(metadata.data[15], 0);
  const overwrite = await assetService.applyMaterialTexture({ inputFilename: reference, outputFilename: reference, material: "water", seed: 1 });
  assert.equal(overwrite.ok, false);
  assert.match(overwrite.message, /different/);
});

test("depth lighting is deterministic, directional, and preserves transparent pixels", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "visual-assets-lighting-"));
  const reference = path.join(directory, "reference.png");
  const firstOutput = path.join(directory, "light-a.png");
  const secondOutput = path.join(directory, "light-b.png");
  await makeReference(reference);
  const assetService = service();
  const input = { inputFilename: reference, outputFilename: firstOutput, direction: "south_east" as const, strength: 0.8, ambient: 0.25 };
  const first = await assetService.applyDepthLighting(input);
  const second = await assetService.applyDepthLighting({ ...input, outputFilename: secondOutput });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(await fs.readFile(firstOutput), await fs.readFile(secondOutput));
  const result = await sharp(firstOutput).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(result.data[15], 0);
  const overwrite = await assetService.applyDepthLighting({ ...input, outputFilename: reference });
  assert.equal(overwrite.ok, false);
  assert.match(overwrite.message, /different/);
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

test("extends a generated scene deterministically while preserving layers and shifting landmarks", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "visual-assets-extension-"));
  const sourceMap = path.join(directory, "source-map.json");
  const sourcePreview = path.join(directory, "source-preview.png");
  const outputMap = path.join(directory, "extended-map.json");
  const outputPreview = path.join(directory, "extended-preview.png");
  const assetService = service();
  assert.equal((await assetService.generateWorldMap({ mapFilename: sourceMap, previewFilename: sourcePreview, width: 8, height: 6, seed: 12, biomes: ["water", "sand", "grass"], landmarkCount: 2 })).ok, true);

  const first = await assetService.extendScene({ inputMapFilename: sourceMap, outputMapFilename: outputMap, previewFilename: outputPreview, padding: { top: 2, right: 3, bottom: 1, left: 4 }, seed: 99 });
  assert.equal(first.ok, true);
  const secondMap = path.join(directory, "extended-map-again.json");
  const second = await assetService.extendScene({ inputMapFilename: sourceMap, outputMapFilename: secondMap, padding: { top: 2, right: 3, bottom: 1, left: 4 }, seed: 99 });
  assert.equal(second.ok, true);
  assert.deepEqual(await fs.readFile(outputMap), await fs.readFile(secondMap));
  const extended = JSON.parse(await fs.readFile(outputMap, "utf8")) as { width: number; height: number; layers: Array<{ rows: string[] }>; landmarks: Array<{ x: number; y: number }>; extension: { padding: { left: number; top: number } } };
  const source = JSON.parse(await fs.readFile(sourceMap, "utf8")) as { layers: Array<{ rows: string[] }>; landmarks: Array<{ x: number; y: number }> };
  assert.equal(extended.width, 15);
  assert.equal(extended.height, 9);
  assert.equal(extended.layers[0]!.rows[2]!.slice(4, 12), source.layers[0]!.rows[0]);
  assert.equal(extended.layers[0]!.rows[3]!.slice(4, 12), source.layers[0]!.rows[1]);
  assert.equal(extended.landmarks[0]!.x, source.landmarks[0]!.x + 4);
  assert.equal(extended.landmarks[0]!.y, source.landmarks[0]!.y + 2);
  assert.deepEqual(extended.extension.padding, { top: 2, right: 3, bottom: 1, left: 4 });
  assert.equal((await sharp(outputPreview).metadata()).width, 15);
  assert.equal((await sharp(outputPreview).metadata()).height, 9);
});

test("generates deterministic biome transition metadata and preview without mutating the source map", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "visual-assets-transition-"));
  const sourceMap = path.join(directory, "source-map.json");
  const outputMap = path.join(directory, "transition-map.json");
  const secondMap = path.join(directory, "transition-map-again.json");
  const preview = path.join(directory, "transition-preview.png");
  const source = { schemaVersion: 1, kind: "world_map", width: 8, height: 5, seed: 4, biomes: ["water", "sand", "grass"], symbols: { water: "A", sand: "B", grass: "C" }, layers: [{ name: "terrain", rows: ["AAAABBBB", "AAAABBBB", "AAAABBBB", "CCCCBBBB", "CCCCBBBB"] }], landmarks: [{ id: "dock", x: 2, y: 1 }] };
  await fs.writeFile(sourceMap, `${JSON.stringify(source, null, 2)}\n`, "utf8");
  const before = await fs.readFile(sourceMap);
  const assetService = service();
  const input = { inputMapFilename: sourceMap, outputMapFilename: outputMap, previewFilename: preview, transitionWidth: 2, seed: 73 };
  const first = await assetService.generateBiomeTransition(input);
  const second = await assetService.generateBiomeTransition({ ...input, outputMapFilename: secondMap });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(await fs.readFile(outputMap), await fs.readFile(secondMap));
  assert.deepEqual(await fs.readFile(sourceMap), before);
  const generated = JSON.parse(await fs.readFile(outputMap, "utf8")) as { width: number; height: number; layers: unknown[]; landmarks: unknown[]; biomeTransitions: Array<{ x: number; y: number; from: string; to: string; distance: number; variant: string }>; transition: { width: number; seed: number; sourceMap: string } };
  assert.equal(generated.width, 8);
  assert.equal(generated.height, 5);
  assert.equal(generated.layers.length, 1);
  assert.equal(generated.landmarks.length, 1);
  assert.ok(generated.biomeTransitions.length > 0);
  assert.ok(generated.biomeTransitions.every((item) => item.distance >= 0 && item.distance <= 2 && item.from !== item.to));
  assert.deepEqual(generated.transition, { width: 2, seed: 73, sourceMap });
  assert.deepEqual(await sharp(preview).metadata().then(({ width, height }) => ({ width, height })), { width: 8, height: 5 });
});

test("biome transition generation rejects malformed maps, unsafe overwrites, and invalid widths", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "visual-assets-transition-invalid-"));
  const sourceMap = path.join(directory, "source-map.json");
  await fs.writeFile(sourceMap, JSON.stringify({ width: 2, height: 2, layers: [{ name: "terrain", rows: ["AA", "AA"] }] }), "utf8");
  const assetService = service();
  assert.equal((await assetService.generateBiomeTransition({ inputMapFilename: sourceMap, outputMapFilename: sourceMap, transitionWidth: 1, seed: 1 })).ok, false);
  assert.equal((await assetService.generateBiomeTransition({ inputMapFilename: sourceMap, outputMapFilename: path.join(directory, "out.json"), transitionWidth: 0, seed: 1 })).ok, false);
  assert.equal((await assetService.generateBiomeTransition({ inputMapFilename: sourceMap, outputMapFilename: path.join(directory, "out-2.json"), transitionWidth: 9, seed: 1 })).ok, false);
  assert.equal((await assetService.generateBiomeTransition({ inputMapFilename: sourceMap, outputMapFilename: path.join(directory, "out-3.json"), transitionWidth: 1.5, seed: 1 })).ok, false);
});
