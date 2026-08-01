import path from "node:path";
import { promises as fs } from "node:fs";
import { VisualAssetService } from "../src/application/services/VisualAssetService.js";
import { SharpRasterCodec } from "../src/infrastructure/image/SharpRasterCodec.js";
import { JsonAssetManifestWriter } from "../src/infrastructure/image/JsonAssetManifestWriter.js";

const outputDirectory = path.resolve("docs/media");

async function run(): Promise<void> {
  await fs.mkdir(outputDirectory, { recursive: true });
  const service = new VisualAssetService(new SharpRasterCodec(), new JsonAssetManifestWriter());
  const tileset = path.join(outputDirectory, "coastal-terrain-tileset.png");
  const tilesetManifest = path.join(outputDirectory, "coastal-terrain-tileset.json");
  const map = path.join(outputDirectory, "coastal-map.json");
  const preview = path.join(outputDirectory, "coastal-map.png");
  const waves = path.join(outputDirectory, "beach-waves.gif");
  const timeOfDay = path.join(outputDirectory, "coastal-time-of-day.gif");
  const timeManifest = path.join(outputDirectory, "coastal-time-of-day.json");

  const results = [
    await service.createStyleBible({ filename: path.join(outputDirectory, "coastal-style.json"), style: { id: "coastal-showcase", baseSize: 16, palette: ["#12243A", "#3081AD", "#E2C277", "#57975B", "#686870", "#F2E9C9"], outlineColor: "#12243A", lightDirection: "south_east", detailLevel: "high", seed: 4217, materials: { water: ["#28577A", "#3081AD"], sand: ["#C49B57", "#E2C277"], grass: ["#3E7045", "#57975B"] } } }),
    await service.buildTerrainTileset({ outputFilename: tileset, manifestFilename: tilesetManifest, tileSize: 16, terrains: ["water", "sand", "grass", "rock"], seed: 4217 }),
    await service.generateBeachScene({ mapFilename: map, previewFilename: preview, waveFilename: waves, width: 96, height: 64, seed: 4217, biomes: ["water", "sand", "grass", "rock"], detailLevel: "high", waveFrames: 8, waveDelayMs: 150, landmarkCount: 12 }),
    await service.generateTimeOfDayPack({ inputFilename: preview, outputFilename: timeOfDay, manifestFilename: timeManifest, steps: 12, delayMs: 160 }),
  ];
  if (results.some((result) => !result.ok)) throw new Error(results.find((result) => !result.ok)?.message ?? "Showcase generation failed");
  console.log(JSON.stringify({ outputDirectory, artifacts: [tileset, tilesetManifest, map, preview, waves, timeOfDay, timeManifest] }, null, 2));
}

run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
