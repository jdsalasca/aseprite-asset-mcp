import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import { inspectPixelArtSubject, inspectRasterFrame, runPixelArtQualityGate } from "../src/application/services/PixelArtPipeline.js";

const folder = path.resolve("assets/folders/mythical-creatures/dragon-ice");

test("dragon-ice is a premium reference-derived creature and not a catalog placeholder", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(folder, "manifest.json"), "utf8")) as { source?: string; qualityGate?: { valid?: boolean }; conversion?: { target?: number[]; paletteSize?: number } };
  const metadata = await sharp(path.join(folder, "preview.png")).metadata();
  const { data, info } = await sharp(path.join(folder, "preview.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const frame = { width: info.width, height: info.height, pixels: new Uint8ClampedArray(data) };
  const gate = runPixelArtQualityGate(frame, { minOpaquePixels: 2000, minCoverage: 0.12, maxCoverage: 0.85, minEdgePixels: 300, minDistinctRowSpans: 24, maxComponents: 32 });
  const raster = inspectRasterFrame(frame);
  const subject = inspectPixelArtSubject(frame);

  assert.equal(manifest.source, "imagegen-reference-derived-v1");
  assert.equal(manifest.qualityGate?.valid, true);
  assert.deepEqual(manifest.conversion?.target, [256, 256]);
  assert.ok((manifest.conversion?.paletteSize ?? 0) >= 32);
  assert.equal(metadata.width, 256);
  assert.equal(metadata.height, 256);
  assert.ok(raster.colors >= 24);
  assert.ok(subject.distinctRowSpans >= 24);
  assert.equal(gate.valid, true, gate.violations.join("; "));
});

test("dragon-ice ships a readable four-frame 256px animation", async () => {
  const metadata = await sharp(path.join(folder, "sprite-sheet.gif"), { animated: true }).metadata();
  const atlas = await sharp(path.join(folder, "sprite-sheet.png")).metadata();
  assert.equal(metadata.pages, 4);
  assert.equal(metadata.width, 256);
  assert.equal(metadata.pageHeight, 256);
  assert.equal(atlas.width, 1024);
  assert.equal(atlas.height, 256);
});
