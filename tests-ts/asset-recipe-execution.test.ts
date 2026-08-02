import test from "node:test";
import assert from "node:assert/strict";
import { AssetRecipeExecutionService } from "../src/application/services/AssetRecipeExecutionService.js";
import type { AssetRecipeOperationPort } from "../src/application/ports/AssetRecipeExecutionPort.js";
import type { AssetOperationResult } from "../src/domain/asset-operations.js";
import { AssetRecipeComposerService } from "../src/application/services/AssetRecipeComposerService.js";

function result(operation: string, ok = true): AssetOperationResult { return { ok, message: JSON.stringify({ operation, sourcePreserved: true, deterministic: true }) }; }

test("executes a composed recipe as a chained pipeline and quality-checks the final output", async () => {
  const calls: string[] = [];
  const operations: AssetRecipeOperationPort = {
    applyPixelOutline: async (input) => { calls.push("outline:" + input.inputFilename + "->" + input.outputFilename); return result("apply_pixel_outline"); },
    applyColorGrade: async (input) => { calls.push("grade:" + input.inputFilename + "->" + input.outputFilename); return result("apply_color_grade"); },
    applyMaterialTexture: async (input) => { calls.push("material:" + input.inputFilename + "->" + input.outputFilename); return result("apply_material_texture"); },
    applyDepthLighting: async (input) => { calls.push("lighting:" + input.inputFilename + "->" + input.outputFilename); return result("apply_depth_lighting"); },
    generateSpriteShadow: async (input) => { calls.push("shadow:" + input.inputFilename + "->" + input.outputFilename); return result("generate_sprite_shadow"); },
    generateParticleBurst: async (input) => { calls.push("particles:" + input.outputFilename); return result("generate_particle_burst"); },
    generateNormalMap: async (input) => { calls.push("normal:" + input.inputFilename + "->" + input.outputFilename); return result("generate_normal_map"); },
    runQualityGate: async (input) => { calls.push("quality:" + input.filename); return result("run_asset_quality_gate"); },
  };
  const plan = new AssetRecipeComposerService().compose({ assetId: "hero", inputFilename: "hero.png", outputPrefix: "out/hero", steps: ["outline", "material_texture", "depth_lighting", "quality_gate"], seed: 9 });
  const executed = await new AssetRecipeExecutionService(operations).execute(plan);

  assert.equal(executed.ok, true);
  assert.equal(executed.outputFilename, "out/hero-depth_lighting.png");
  assert.deepEqual(calls, [
    "outline:hero.png->out/hero-outline.png",
    "material:out/hero-outline.png->out/hero-material_texture.png",
    "lighting:out/hero-material_texture.png->out/hero-depth_lighting.png",
    "quality:out/hero-depth_lighting.png",
  ]);
});

test("stops a composed recipe at the first failed operation", async () => {
  let calls = 0;
  const operations: AssetRecipeOperationPort = {
    applyPixelOutline: async () => { calls += 1; return result("apply_pixel_outline", false); },
    applyColorGrade: async () => { calls += 1; return result("apply_color_grade"); },
    applyMaterialTexture: async () => { calls += 1; return result("apply_material_texture"); },
    applyDepthLighting: async () => { calls += 1; return result("apply_depth_lighting"); },
    generateSpriteShadow: async () => { calls += 1; return result("generate_sprite_shadow"); },
    generateParticleBurst: async () => { calls += 1; return result("generate_particle_burst"); },
    generateNormalMap: async () => { calls += 1; return result("generate_normal_map"); },
    runQualityGate: async () => { calls += 1; return result("run_asset_quality_gate"); },
  };
  const plan = new AssetRecipeComposerService().compose({ assetId: "hero", inputFilename: "hero.png", outputPrefix: "out/hero", steps: ["outline", "quality_gate"] });
  const executed = await new AssetRecipeExecutionService(operations).execute(plan);

  assert.equal(executed.ok, false);
  assert.equal(calls, 1);
  assert.equal(executed.failedStep, "outline");
});
