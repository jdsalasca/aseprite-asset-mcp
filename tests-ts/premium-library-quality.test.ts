import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import type { PixelArtQualityGateOptions } from "../src/domain/pixel-art.js";
import { runPixelArtQualityGate } from "../src/application/services/PixelArtPipeline.js";

const root = path.resolve("assets/folders");

function profile(category: string, kind: string): PixelArtQualityGateOptions {
  if (kind === "scene" || ["biomes-and-maps", "interiors"].includes(category)) return { minOpaquePixels: 2000, minCoverage: 0.8, maxCoverage: 1, minEdgePixels: 100, minDistinctRowSpans: 1, maxComponents: 80, minLargestComponentRatio: 0, requireTransparentBorder: false };
  if (kind === "effect" || category === "scene-effects") return { minOpaquePixels: 24, minCoverage: 0.004, maxCoverage: 0.8, minEdgePixels: 20, minDistinctRowSpans: 8, maxComponents: 160, minLargestComponentRatio: 0 };
  return { minOpaquePixels: 200, minCoverage: 0.02, maxCoverage: 0.9, minEdgePixels: 24, minDistinctRowSpans: 8, maxComponents: 32 };
}

test("the complete catalog ships premium manifests and passes domain quality gates", async () => {
  const catalog = JSON.parse(await fs.readFile(path.join(root, "catalog.json"), "utf8")) as { items: Array<{ id: string; category: string; kind: string; folder: string; previewPath: string }> };
  assert.ok(catalog.items.length >= 339);
  const failures: string[] = [];
  for (const item of catalog.items) {
    const folder = path.join(root, item.folder);
    const manifest = JSON.parse(await fs.readFile(path.join(folder, "manifest.json"), "utf8")) as { source?: string; qualityGate?: { valid?: boolean }; render?: { cellSize?: number } };
    if (!manifest.source?.includes("premium") && !manifest.source?.includes("reference") && manifest.source !== "deterministic-library-generator-v3") failures.push(`${item.id}: legacy source ${manifest.source ?? "missing"}`);
    if (manifest.qualityGate?.valid !== true) failures.push(`${item.id}: missing or invalid quality manifest`);
    if ((manifest.render?.cellSize ?? 0) < 128 && !manifest.source?.includes("reference")) failures.push(`${item.id}: low cell size`);
    const { data, info } = await sharp(path.join(root, item.previewPath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const gate = runPixelArtQualityGate({ width: info.width, height: info.height, pixels: new Uint8ClampedArray(data) }, profile(item.category, item.kind));
    if (!gate.valid) failures.push(`${item.id}: ${gate.violations.join(", ")}`);
  }
  assert.deepEqual(failures, []);
});

test("opaque scene quality gates can skip transparent-border requirements explicitly", () => {
  const pixels = new Uint8ClampedArray(16 * 16 * 4).fill(255);
  const report = runPixelArtQualityGate({ width: 16, height: 16, pixels }, { minCoverage: 1, maxCoverage: 1, minDistinctRowSpans: 1, minEdgePixels: 1, minLargestComponentRatio: 1, requireTransparentBorder: false });
  assert.equal(report.valid, true, report.violations.join("; "));
});
