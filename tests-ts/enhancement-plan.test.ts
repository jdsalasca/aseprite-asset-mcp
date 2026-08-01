import assert from "node:assert/strict";
import test from "node:test";
import { EnhancementPlanService } from "../src/application/services/EnhancementPlanService.js";
import type { ReferenceAnalysis } from "../src/domain/visual-assets.js";

const analysis: ReferenceAnalysis = { filename: "beach.png", width: 64, height: 64, frames: 4, dominantColors: Array.from({ length: 80 }, (_, index) => ({ color: `#${index.toString(16).padStart(6, "0")}`, count: 1 })), averageLuminance: 0.4, contrast: 0.04, edgeDensity: 0.25, transparencyRatio: 0.1 };

test("enhancement planner is deterministic, explainable, and non-destructive", () => {
  const service = new EnhancementPlanService();
  const input = { filename: "beach.png", analysis, goals: ["water_flow", "particles"] as const, maxColors: 32, seed: 42 };
  const first = service.suggest(input);
  const second = service.suggest(input);
  assert.deepEqual(first, second);
  assert.equal(first.destructive, false);
  assert.deepEqual(first.passes.map((pass) => pass.id), ["water_flow", "particles", "quality_gate"]);
  assert.deepEqual(first.warnings, ["low_contrast", "palette_exceeds_target"]);
  assert.match(first.passes[0]?.reason ?? "", /directional wave/);
});

test("planner infers cleanup and lighting from weak contrast", () => {
  const plan = new EnhancementPlanService().suggest({ filename: "sprite.png", analysis: { ...analysis, dominantColors: [], contrast: 0.03, edgeDensity: 0.1 }, seed: 7 });
  assert.deepEqual(plan.passes.map((pass) => pass.id), ["cleanup", "directional_lighting", "quality_gate"]);
});
