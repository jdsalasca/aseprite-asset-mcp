import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import { DeterministicEnhancementService } from "../src/application/services/DeterministicEnhancementService.js";
import type { EnhancementPlan } from "../src/domain/enhancement.js";
import { SharpRasterCodec } from "../src/infrastructure/image/SharpRasterCodec.js";

test("enhancement execution is deterministic, non-destructive, and writes a separate output", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "enhancement-apply-"));
  const source = path.join(directory, "source.png");
  const output = path.join(directory, "enhanced.png");
  const pixels = new Uint8ClampedArray(32 * 32 * 4);
  for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) {
    const at = (y * 32 + x) * 4;
    pixels[at] = 30; pixels[at + 1] = 90; pixels[at + 2] = 150; pixels[at + 3] = x > 2 && y > 2 ? 255 : 0;
  }
  await sharp(Buffer.from(pixels), { raw: { width: 32, height: 32, channels: 4 } }).png().toFile(source);
  const before = await fs.readFile(source);
  const plan: EnhancementPlan = {
    planId: "plan-test", algorithmVersion: "enhancement-plan-v1", filename: source, seed: 42,
    detectedSignals: [], warnings: [], destructive: false,
    passes: [
      { id: "cleanup", reason: "test", parameters: {} },
      { id: "terrain_grain", reason: "test", parameters: {} },
      { id: "water_flow", reason: "test", parameters: {} },
      { id: "directional_lighting", reason: "test", parameters: { intensity: 0.2 } },
      { id: "particles", reason: "test", parameters: {} },
      { id: "quality_gate", reason: "test", parameters: {} },
    ],
  };
  const service = new DeterministicEnhancementService(new SharpRasterCodec());
  const report = await service.apply(plan, { outputFilename: output, format: "png" });
  assert.deepEqual(report.passesApplied, ["cleanup", "terrain_grain", "water_flow", "directional_lighting", "particles"]);
  assert.equal(report.sourcePreserved, true);
  assert.deepEqual(await fs.readFile(source), before);
  assert.notDeepEqual(await fs.readFile(output), before);
  const outputMetadata = await sharp(output).metadata();
  assert.equal(outputMetadata.width, 32);
  assert.equal(outputMetadata.height, 32);
});
