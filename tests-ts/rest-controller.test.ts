import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { AssetRecipeComposerService } from "../src/application/services/AssetRecipeComposerService.js";
import type { AssetRestUseCases } from "../src/application/ports/AssetRestPorts.js";
import { AssetRestController } from "../src/interfaces/rest/AssetRestController.js";
import type { AssetOperationResult } from "../src/domain/asset-operations.js";
import type { SpriteEffectsGateway } from "../src/domain/sprite-effects.js";
import { AssetLibraryService } from "../src/application/services/AssetLibraryService.js";
import type { AssetLibraryCatalog } from "../src/domain/asset-library.js";
import type { AssetLibraryPort } from "../src/application/ports/AssetLibraryPort.js";

function result(operation: string): AssetOperationResult { return { ok: true, message: JSON.stringify({ operation, deterministic: true, sourcePreserved: true }) }; }
const libraryCatalog: AssetLibraryCatalog = { schemaVersion: 1, libraryVersion: "test", categories: [{ id: "flora", title: "Flora", description: "Plants", itemCount: 1 }], items: [{ id: "oak", title: "Oak", category: "flora", folder: "flora/oak", kind: "sprite", description: "Tree", tags: ["tree"], variants: ["rain"], formats: ["png", "gif", "svg", "json"], readmePath: "flora/oak/README.md", previewPath: "flora/oak/preview.png", spritePath: "flora/oak/sprite-sheet.png", animationPath: "flora/oak/sprite-sheet.gif", deterministic: true }], presets: [{ id: "test-preset", title: "Test preset", description: "Oak", category: "flora", itemIds: ["oak"], recommendedTools: ["generate_world_map"], deterministic: true }] };
class FakeLibrary implements AssetLibraryPort { public async load(): Promise<AssetLibraryCatalog> { return libraryCatalog; } public async read() { return { data: new Uint8Array([137, 80, 78, 71]), contentType: "image/png" }; } }
function fakeUseCases(): AssetRestUseCases {
  const effects: SpriteEffectsGateway = { applyPixelOutline: async () => result("apply_pixel_outline"), removeBackground: async () => result("remove_background"), cleanupIsolatedPixels: async () => result("cleanup_isolated_pixels"), generateSpriteGlow: async () => result("generate_sprite_glow"), applySpriteRimLight: async () => result("apply_sprite_rim_light"), applyColorGrade: async () => result("apply_color_grade"), generateSpriteShadow: async () => result("generate_sprite_shadow"), generateParticleBurst: async () => result("generate_particle_burst"), generateNormalMap: async () => result("generate_normal_map"), generateRainOverlay: async () => result("generate_rain_overlay"), generateMotionPack: async () => result("generate_motion_pack"), generateSeamlessTexture: async () => result("generate_seamless_texture"), generateWaterReflection: async () => result("generate_water_reflection"), generateWaterCaustics: async () => result("generate_water_caustics"), generateDayNightCycle: async () => result("generate_day_night_cycle") };
  return {
    createRecipe: (input) => new AssetRecipeComposerService().compose(input),
    executeRecipe: async (input) => ({ ok: true, recipeId: "test-recipe", outputFilename: input.inputFilename, steps: [], sourcePreserved: true, deterministic: true }),
    spriteEffects: effects,
    variantPack: { generateVariantPack: async () => result("generate_variant_pack") },
    presetGeneration: { generate: async () => result("generate_asset_preset") },
    sceneEffectStack: { generateSceneEffectStack: async () => result("generate_scene_effect_stack") },
    applyMaterialTexture: async () => result("apply_material_texture"),
    applyDepthLighting: async () => result("apply_depth_lighting"),
    assetLibrary: new AssetLibraryService(new FakeLibrary()),
    assetLibraryAudit: { audit: async () => result("audit_asset_library") },
    assetLibrarySummary: { summarize: async () => result("summarize_asset_library") },
    assetScenePlanner: { plan: async () => result("plan_asset_scene") },
    assetSceneComposer: { compose: async () => result("compose_asset_scene") },
    assetSceneAnimationComposer: { compose: async () => result("compose_asset_scene_animation") },
    assetLibraryVariantPack: { generate: async () => result("generate_library_variant_pack") },
    assetManifestAudit: { audit: async () => result("audit_asset_manifest") },
    assetSceneRecommendation: { recommend: async () => result("recommend_asset_scene") },
    assetSceneBundle: { build: async () => result("build_scene_bundle") },
    enhancementBundle: { apply: async () => result("apply_enhancement_bundle") },
    enhancementBatch: { apply: async () => result("apply_enhancement_batch") },
    imageAssets: { upscalePixelArt: async () => result("upscale_pixel_art"), qualityBundle: async () => result("inspect_asset_bundle"), harmonizePalette: async () => result("harmonize_asset_palette") },
    batchQuality: { inspect: async () => result("inspect_asset_batch") },
    animationQuality: { inspect: async () => result("inspect_animation_quality") },
    spriteNormalization: { normalize: async () => result("normalize_sprite") },
    animationSheet: { build: async () => result("build_animation_sheet") },
    spriteGeometry: { inspect: async () => result("inspect_sprite_geometry") },
    spriteHitbox: { generate: async () => result("generate_sprite_hitboxes") },
    spriteRuntimeBundle: { build: async () => result("build_sprite_runtime_bundle") },
    spriteAnchors: { generate: async () => result("generate_sprite_anchors") },
    contactSheet: { build: async () => result("build_contact_sheet") },
    visualAssets: { extendScene: async () => result("extend_scene"), generateBiomeTransition: async () => result("generate_biome_transition") },
  };
}

async function openRest(): Promise<{ url: string; close(): Promise<void> }> {
  const server = createServer((request, response) => { void new AssetRestController(fakeUseCases()).handle(request, response); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

test("REST controller exposes the same recipe and effect application services", async () => {
  const rest = await openRest();
  try {
    const browserHealth = await fetch(rest.url + "/api/v1/health", { headers: { origin: "http://localhost:4173" } });
    assert.equal(browserHealth.headers.get("access-control-allow-origin"), "http://localhost:4173");
    const rejectedOrigin = await fetch(rest.url + "/api/v1/health", { headers: { origin: "https://untrusted.example" } });
    assert.equal(rejectedOrigin.headers.get("access-control-allow-origin"), "null");

    const health = await fetch(`${rest.url}/api/v1/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).data.architecture, "hexagonal");
    const background = await fetch(`${rest.url}/api/v1/effects/remove-background`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "input.png", output_filename: "output.png", background_color: "#142850", tolerance: 12, connected_only: true }) });
    assert.equal(background.status, 200);
    assert.equal((await background.json()).data.operation, "remove_background");
    const cleanup = await fetch(`${rest.url}/api/v1/effects/cleanup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "input.png", output_filename: "clean.png", min_neighbors: 1, iterations: 2 }) });
    assert.equal(cleanup.status, 200);
    assert.equal((await cleanup.json()).data.operation, "cleanup_isolated_pixels");
    const glow = await fetch(`${rest.url}/api/v1/effects/glow`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "input.png", output_filename: "glow.png", color: "#FFD166", radius: 2, opacity: 0.8 }) });
    assert.equal(glow.status, 200);
    assert.equal((await glow.json()).data.operation, "generate_sprite_glow");
    const rimLight = await fetch(rest.url + "/api/v1/effects/rim-light", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "input.png", output_filename: "rim.png", color: "#FFD166", direction: "north", strength: 0.75 }) });
    assert.equal(rimLight.status, 200);
    assert.equal((await rimLight.json()).data.operation, "apply_sprite_rim_light");
    const library = await fetch(`${rest.url}/api/v1/library?query=tree`);
    assert.equal(library.status, 200);
    assert.equal((await library.json()).data.items[0].id, "oak");
    const animation = await fetch(`${rest.url}/api/v1/library/items/oak/animation`);
    assert.equal(animation.status, 200);
    assert.equal(animation.headers.get("content-type"), "image/png");
    const audit = await fetch(`${rest.url}/api/v1/library/audit`);
    assert.equal(audit.status, 200);
    assert.equal((await audit.json()).data.operation, "audit_asset_library");
    const summary = await fetch(`${rest.url}/api/v1/library/summary`);
    assert.equal(summary.status, 200);
    assert.equal((await summary.json()).data.operation, "summarize_asset_library");
    const manifestAudit = await fetch(`${rest.url}/api/v1/assets/manifest-audit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ manifest_filename: "scene.json" }) });
    assert.equal(manifestAudit.status, 200);
    assert.equal((await manifestAudit.json()).data.operation, "audit_asset_manifest");
    const recommendations = await fetch(`${rest.url}/api/v1/library/recommendations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "tropical water", required_variants: ["water_reflection"], limit: 4, seed: 7 }) });
    assert.equal(recommendations.status, 200);
    assert.equal((await recommendations.json()).data.operation, "recommend_asset_scene");
    const sceneBundle = await fetch(`${rest.url}/api/v1/library/scene-bundle`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item_ids: ["oak"], output_prefix: "out/bundle", width: 64, height: 64, padding: 2, frames: 8, delay_ms: 90 }) });
    assert.equal(sceneBundle.status, 200);
    assert.equal((await sceneBundle.json()).data.operation, "build_scene_bundle");
    const scenePlan = await fetch(`${rest.url}/api/v1/library/scene-plan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item_ids: ["oak"] }) });
    assert.equal(scenePlan.status, 200);
    assert.equal((await scenePlan.json()).data.operation, "plan_asset_scene");
    const composedScene = await fetch(`${rest.url}/api/v1/library/scene-compose`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item_ids: ["oak"], output_filename: "scene.png", manifest_filename: "scene.json", width: 32, height: 32, padding: 2 }) });
    assert.equal(composedScene.status, 200);
    assert.equal((await composedScene.json()).data.operation, "compose_asset_scene");
    const animatedScene = await fetch(`${rest.url}/api/v1/library/scene-animation-compose`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item_ids: ["rain"], output_filename: "scene.gif", manifest_filename: "scene-animation.json", width: 32, height: 32, padding: 2, frames: 4, delay_ms: 120 }) });
    assert.equal(animatedScene.status, 200);
    assert.equal((await animatedScene.json()).data.operation, "compose_asset_scene_animation");
    const libraryVariants = await fetch(`${rest.url}/api/v1/library/variants/pack`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item_ids: ["oak"], output_prefix: "out/library", variants: ["rain", "walk"], frames: 6, seed: 3, delay_ms: 100 }) });
    assert.equal(libraryVariants.status, 200);
    assert.equal((await libraryVariants.json()).data.operation, "generate_library_variant_pack");
    const item = await fetch(`${rest.url}/api/v1/library/items/oak`);
    assert.equal((await item.json()).data.title, "Oak");
    const preview = await fetch(`${rest.url}/api/v1/library/items/oak/preview`);
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get("content-type"), "image/png");
    assert.deepEqual([...new Uint8Array(await preview.arrayBuffer())], [137, 80, 78, 71]);
    const composition = await fetch(`${rest.url}/api/v1/library/presets/test-preset/compose`);
    assert.equal(composition.status, 200);
    assert.equal((await composition.json()).data.layers[0].assetId, "oak");
    const missingItem = await fetch(`${rest.url}/api/v1/library/items/missing`);
    assert.equal(missingItem.status, 404);

    const recipe = await fetch(`${rest.url}/api/v1/recipes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset_id: "hero", input_filename: "hero.png", output_prefix: "out/hero", steps: ["outline", "quality_gate"], seed: 4 }) });
    const recipeBody = await recipe.json();
    assert.equal(recipe.status, 200);
    assert.equal(recipeBody.data.deterministic, true);
    assert.equal(recipeBody.data.steps[0].operation, "apply_pixel_outline");
    const execution = await fetch(rest.url + "/api/v1/recipes/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset_id: "hero", input_filename: "hero.png", output_prefix: "out/hero", steps: ["outline"] }) });
    const executionBody = await execution.json();
    assert.equal(execution.status, 200);
    assert.equal(executionBody.data.ok, true);
    assert.equal(executionBody.data.recipeId, "test-recipe");

    const effect = await fetch(`${rest.url}/api/v1/effects/outline`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.png", output_filename: "hero-outline.png", color: "#172033" }) });
    assert.equal(effect.status, 200);
    assert.equal((await effect.json()).data.operation, "apply_pixel_outline");
    const rain = await fetch(`${rest.url}/api/v1/effects/rain`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.png", output_filename: "hero-rain.gif", seed: 7, intensity: 0.7, wind: 0.2, color: "#b7d7ff", format: "gif" }) });
    assert.equal(rain.status, 200);
    assert.equal((await rain.json()).data.operation, "generate_rain_overlay");
    const motion = await fetch(`${rest.url}/api/v1/effects/motion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.png", output_filename: "hero-walk.gif", motion: "walk", frames: 8, seed: 2, amplitude: 2, format: "gif" }) });
    assert.equal(motion.status, 200);
    assert.equal((await motion.json()).data.operation, "generate_motion_pack");
    const upscale = await fetch(`${rest.url}/api/v1/effects/upscale`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.png", output_filename: "hero-3x.png", scale: 3 }) });
    assert.equal(upscale.status, 200);
    assert.equal((await upscale.json()).data.operation, "upscale_pixel_art");
    const harmonize = await fetch(`${rest.url}/api/v1/assets/palette-harmonize`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.png", output_filename: "hero-harmonized.png", accent_color: "#3155d8", strength: 0.8, max_colors: 8 }) });
    assert.equal(harmonize.status, 200);
    assert.equal((await harmonize.json()).data.operation, "harmonize_asset_palette");
    const contactSheet = await fetch(`${rest.url}/api/v1/assets/contact-sheet`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filenames: ["oak.png", "hero.png"], output_filename: "preview-sheet.png", manifest_filename: "preview-sheet.json", cell_width: 32, cell_height: 32, columns: 2, padding: 2 }) });
    assert.equal(contactSheet.status, 200);
    assert.equal((await contactSheet.json()).data.operation, "build_contact_sheet");
    const extension = await fetch(`${rest.url}/api/v1/scenes/extend`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_map_filename: "map.json", output_map_filename: "map-expanded.json", top: 2, right: 3, bottom: 1, left: 4, seed: 9 }) });
    assert.equal(extension.status, 200);
    assert.equal((await extension.json()).data.operation, "extend_scene");
    const transition = await fetch(`${rest.url}/api/v1/scenes/biome-transition`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_map_filename: "map.json", output_map_filename: "map-transition.json", preview_filename: "map-transition.png", transition_width: 2, seed: 9 }) });
    assert.equal(transition.status, 200);
    assert.equal((await transition.json()).data.operation, "generate_biome_transition");
    const seamless = await fetch(`${rest.url}/api/v1/effects/seamless`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.png", output_filename: "hero-seamless.png", seam_width: 2 }) });
    assert.equal(seamless.status, 200);
    assert.equal((await seamless.json()).data.operation, "generate_seamless_texture");
    const reflection = await fetch(`${rest.url}/api/v1/effects/water-reflection`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.png", output_filename: "hero-reflection.gif", waterline: 16, frames: 4, seed: 7, amplitude: 1, opacity: 0.6 }) });
    assert.equal(reflection.status, 200);
    assert.equal((await reflection.json()).data.operation, "generate_water_reflection");
    const caustics = await fetch(`${rest.url}/api/v1/effects/water-caustics`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.png", output_filename: "hero-caustics.gif", frames: 4, seed: 3, intensity: 0.8, scale: 3, color: "#DFF6FF" }) });
    assert.equal(caustics.status, 200);
    assert.equal((await caustics.json()).data.operation, "generate_water_caustics");
    const dayNight = await fetch(`${rest.url}/api/v1/effects/day-night`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.png", output_filename: "hero-day-night.gif", frames: 8, seed: 23, intensity: 0.8 }) });
    assert.equal(dayNight.status, 200);
    assert.equal((await dayNight.json()).data.operation, "generate_day_night_cycle");
    const variantPack = await fetch(`${rest.url}/api/v1/variants/pack`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "oak.png", output_prefix: "oak-variants", variants: ["rain", "fire", "birds"], frames: 6, seed: 4 }) });
    assert.equal(variantPack.status, 200);
    assert.equal((await variantPack.json()).data.operation, "generate_variant_pack");
    const qualityBundle = await fetch(`${rest.url}/api/v1/assets/quality-bundle`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: "hero.png", max_colors: 32, max_isolated_pixels: 4 }) });
    assert.equal(qualityBundle.status, 200);
    assert.equal((await qualityBundle.json()).data.operation, "inspect_asset_bundle");
    const enhancementBundle = await fetch(`${rest.url}/api/v1/assets/enhancement-bundle`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: "hero.png", output_filename: "hero-enhanced.png", goals: ["cleanup", "particles"], max_colors: 32, seed: 7 }) });
    assert.equal(enhancementBundle.status, 200);
    assert.equal((await enhancementBundle.json()).data.operation, "apply_enhancement_bundle");
    const enhancementBatch = await fetch(`${rest.url}/api/v1/assets/enhancement-batch`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: [{ filename: "hero.png", output_filename: "hero-batch.png", format: "png" }, { filename: "oak.png", output_filename: "oak-batch.gif", format: "gif" }], goals: ["cleanup"], max_colors: 32, seed: 7 }) });
    assert.equal(enhancementBatch.status, 200);
    assert.equal((await enhancementBatch.json()).data.operation, "apply_enhancement_batch");
    const qualityBatch = await fetch(`${rest.url}/api/v1/assets/quality-batch`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filenames: ["hero.png", "oak.png"], max_colors: 32, max_isolated_pixels: 4 }) });
    assert.equal(qualityBatch.status, 200);
    assert.equal((await qualityBatch.json()).data.operation, "inspect_asset_batch");
    const animationQuality = await fetch(`${rest.url}/api/v1/assets/animation-quality`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: "hero.gif" }) });
    assert.equal(animationQuality.status, 200);
    assert.equal((await animationQuality.json()).data.operation, "inspect_animation_quality");
    const normalized = await fetch(`${rest.url}/api/v1/assets/normalize-sprite`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.gif", output_filename: "hero-normalized.gif", manifest_filename: "hero-normalized.json", padding: 1, pivot: "bottom_center", format: "gif" }) });
    assert.equal(normalized.status, 200);
    assert.equal((await normalized.json()).data.operation, "normalize_sprite");
    const animationSheet = await fetch(`${rest.url}/api/v1/assets/animation-sheet`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.gif", output_filename: "hero-sheet.png", manifest_filename: "hero-sheet.json", columns: 2, padding: 1 }) });
    assert.equal(animationSheet.status, 200);
    assert.equal((await animationSheet.json()).data.operation, "build_animation_sheet");
    const geometry = await fetch(`${rest.url}/api/v1/assets/sprite-geometry`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: "hero.gif", min_component_pixels: 2 }) });
    assert.equal(geometry.status, 200);
    assert.equal((await geometry.json()).data.operation, "inspect_sprite_geometry");
    const hitboxes = await fetch(`${rest.url}/api/v1/assets/sprite-hitboxes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: "hero.gif", output_filename: "hero-hitboxes.json", mode: "components", padding: 1 }) });
    assert.equal(hitboxes.status, 200);
    assert.equal((await hitboxes.json()).data.operation, "generate_sprite_hitboxes");
    const runtimeBundle = await fetch(`${rest.url}/api/v1/assets/sprite-runtime-bundle`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.gif", sheet_filename: "hero-sheet.png", sheet_manifest_filename: "hero-sheet.json", hitbox_manifest_filename: "hero-hitboxes.json", bundle_manifest_filename: "hero-runtime.json", columns: 4, sheet_padding: 1, hitbox_mode: "components", hitbox_padding: 1 }) });
    assert.equal(runtimeBundle.status, 200);
    assert.equal((await runtimeBundle.json()).data.operation, "build_sprite_runtime_bundle");
    const anchors = await fetch(`${rest.url}/api/v1/assets/sprite-anchors`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: "hero.gif", output_filename: "hero-anchors.json", min_component_pixels: 1 }) });
    assert.equal(anchors.status, 200);
    assert.equal((await anchors.json()).data.operation, "generate_sprite_anchors");
    const generatedPreset = await fetch(`${rest.url}/api/v1/library/presets/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ preset_id: "coastal-sunset", output_prefix: "art/coast", width: 32, height: 24, seed: 9 }) });
    assert.equal(generatedPreset.status, 200);
    assert.equal((await generatedPreset.json()).data.operation, "generate_asset_preset");
    const effectStack = await fetch(`${rest.url}/api/v1/effects/scene-stack`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.png", output_prefix: "art/hero", effects: ["material_texture", "rain", "particles"], frames: 6, seed: 9 }) });
    assert.equal(effectStack.status, 200);
    assert.equal((await effectStack.json()).data.operation, "generate_scene_effect_stack");

    const invalid = await fetch(`${rest.url}/api/v1/effects/outline`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.png", output_filename: "hero-outline.png", color: "nope" }) });
    assert.equal(invalid.status, 400);
    const oversized = await fetch(rest.url + "/api/v1/recipes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset_id: "hero", input_filename: "hero.png", output_prefix: "out/hero", steps: ["outline"], note: "x".repeat(1_100_000) }) });
    assert.equal(oversized.status, 413);
    assert.match((await oversized.json()).error, /exceeds/);

  } finally { await rest.close(); }
});
