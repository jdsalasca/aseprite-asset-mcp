import test from "node:test";
import assert from "node:assert/strict";
import type { AssetOperationResult } from "../src/domain/asset-operations.js";
import type { EnhancementPlan, EnhancementBundleResult } from "../src/domain/enhancement.js";
import type { ReferenceAnalysis } from "../src/domain/visual-assets.js";
import { EnhancementBundleService } from "../src/application/services/EnhancementBundleService.js";

const analysis: ReferenceAnalysis = { filename: "source.png", width: 16, height: 16, frames: 1, dominantColors: [{ color: "#112233", count: 4 }], averageLuminance: 0.4, contrast: 0.2, edgeDensity: 0.1, transparencyRatio: 0 };
const plan: EnhancementPlan = { planId: "plan-1", algorithmVersion: "enhancement-plan-v1", filename: "source.png", seed: 7, detectedSignals: [], warnings: [], passes: [{ id: "cleanup", reason: "cleanup", parameters: {} }, { id: "quality_gate", reason: "quality", parameters: {} }], destructive: false };
function result(value: unknown, ok = true): AssetOperationResult { return { ok, message: typeof value === "string" ? value : JSON.stringify(value) }; }

test("enhancement bundle composes inspect, plan, apply, and quality in one application port", async () => {
  const calls: string[] = [];
  const service = new EnhancementBundleService(
    { inspectReference: async () => { calls.push("inspect"); return result(analysis); }, runQualityGate: async () => { calls.push("quality"); return result({ valid: true, violations: [] }); } },
    { apply: async () => { calls.push("apply"); return { planId: plan.planId, outputFilename: "enhanced.png", format: "png", frames: 1, passesApplied: ["cleanup"], sourcePreserved: true }; } },
  );
  const response = await service.apply({ filename: "source.png", outputFilename: "enhanced.png", format: "png", goals: ["cleanup"], seed: 7 });
  assert.equal(response.ok, true);
  assert.deepEqual(calls, ["inspect", "apply", "quality"]);
  const payload = JSON.parse(response.message) as EnhancementBundleResult;
  assert.equal(payload.operation, "apply_enhancement_bundle");
  assert.equal(payload.deterministic, true);
  assert.equal(payload.sourcePreserved, true);
  assert.deepEqual(payload.quality.violations, []);
});

test("enhancement bundle stops before writing when reference inspection fails", async () => {
  let applied = false;
  const service = new EnhancementBundleService(
    { inspectReference: async () => result("reference unavailable", false), runQualityGate: async () => result({ valid: true, violations: [] }) },
    { apply: async () => { applied = true; return { planId: "x", outputFilename: "x.png", format: "png", frames: 1, passesApplied: [], sourcePreserved: true }; } },
  );
  const response = await service.apply({ filename: "source.png", outputFilename: "enhanced.png", format: "png" });
  assert.equal(response.ok, false);
  assert.equal(applied, false);
  assert.equal(response.message, "reference unavailable");
});
