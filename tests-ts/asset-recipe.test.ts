import assert from "node:assert/strict";
import test from "node:test";
import { AssetRecipeComposerService } from "../src/application/services/AssetRecipeComposerService.js";

test("asset recipe composer creates deterministic compact steps", () => {
  const service = new AssetRecipeComposerService();
  const input = { assetId: "hero", inputFilename: "art/hero.png", outputPrefix: "art/hero", steps: ["outline", "material_texture", "depth_lighting", "quality_gate"] as const, seed: 42, material: "stone" as const, direction: "south_west" as const };
  const first = service.compose(input);
  const second = service.compose(input);

  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, 1);
  assert.equal(first.sourcePreserved, true);
  assert.deepEqual(first.steps.map((step) => step.operation), ["apply_pixel_outline", "apply_material_texture", "apply_depth_lighting", "run_asset_quality_gate"]);
  assert.equal(first.steps[0]?.inputFilename, "art/hero.png");
  assert.equal(first.steps[1]?.inputFilename, "art/hero-outline.png");
  assert.equal(first.steps[2]?.inputFilename, "art/hero-material_texture.png");
  assert.equal(first.steps[3]?.inputFilename, "art/hero-depth_lighting.png");
  assert.equal(first.steps[1]?.arguments.material, "stone");
  assert.equal(first.steps[2]?.arguments.direction, "south_west");
});

test("asset recipe composer rejects empty, oversized, and traversal recipes", () => {
  const service = new AssetRecipeComposerService();
  assert.throws(() => service.compose({ assetId: "", inputFilename: "hero.png", outputPrefix: "out", steps: ["outline"] }), /required/);
  assert.throws(() => service.compose({ assetId: "hero", inputFilename: "hero.png", outputPrefix: "out", steps: [] }), /between 1 and 8/);
  assert.throws(() => service.compose({ assetId: "hero", inputFilename: "hero.png", outputPrefix: "out", steps: ["outline", "outline", "outline", "outline", "outline", "outline", "outline", "outline", "outline"] }), /between 1 and 8/);
  assert.throws(() => service.compose({ assetId: "hero", inputFilename: "hero.png", outputPrefix: "../out", steps: ["outline"] }), /traversal/);
  assert.throws(() => service.compose({ assetId: "hero", inputFilename: "../hero.png", outputPrefix: "out", steps: ["outline"] }), /traversal/);
});
