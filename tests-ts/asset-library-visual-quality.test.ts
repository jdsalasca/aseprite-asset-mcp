import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import { inspectPixelArtSubject, runPixelArtQualityGate } from "../src/application/services/PixelArtPipeline.js";

const root = path.resolve("assets/folders");

test("deer catalog asset is a real transparent sprite, not a generic opaque placeholder", async () => {
  const folder = path.join(root, "fauna", "deer");
  const manifest = JSON.parse(await fs.readFile(path.join(folder, "manifest.json"), "utf8")) as { source?: string };
  const metadata = await sharp(path.join(folder, "preview.png")).metadata();
  const { data, info } = await sharp(path.join(folder, "preview.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const frame = { width: info.width, height: info.height, pixels: new Uint8ClampedArray(data) };
  const gate = runPixelArtQualityGate(frame, { minOpaquePixels: 80, minCoverage: 0.08, maxCoverage: 0.95, minEdgePixels: 20, minDistinctRowSpans: 8 });

  assert.equal(manifest.source, "reference-pixel-art-v2");
  assert.ok((metadata.width ?? 0) >= 64);
  assert.ok((metadata.height ?? 0) >= 64);
  assert.equal(gate.valid, true, gate.violations.join("; "));
  assert.ok(inspectPixelArtSubject(frame).distinctRowSpans >= 8);
});

test("deer animation keeps four equal frames and nearest-readable dimensions", async () => {
  const metadata = await sharp(path.join(root, "fauna", "deer", "sprite-sheet.gif"), { animated: true }).metadata();
  assert.equal(metadata.pages, 4);
  assert.equal(metadata.width, 96);
  assert.equal(metadata.pageHeight, 96);
});

test("fauna, mounts and characters all use the structured renderer quality floor", async () => {
  const catalog = JSON.parse(await fs.readFile(path.join(root, "catalog.json"), "utf8")) as { items: Array<{ id: string; category: string; previewPath: string }> };
  const items = catalog.items.filter((item) => ["fauna", "mounts", "characters"].includes(item.category));
  assert.ok(items.length > 100);
  const failures: string[] = [];
  for (const item of items) {
    const filename = path.join(root, item.previewPath);
    const { data, info } = await sharp(filename).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const gate = runPixelArtQualityGate({ width: info.width, height: info.height, pixels: new Uint8ClampedArray(data) }, { minOpaquePixels: 80, minCoverage: 0.04, maxCoverage: 0.95, minEdgePixels: 12, minDistinctRowSpans: 4, maxComponents: 24 });
    if (!gate.valid) failures.push(`${item.id}: ${gate.violations.join(", ")}`);
  }
  assert.deepEqual(failures, []);
});
