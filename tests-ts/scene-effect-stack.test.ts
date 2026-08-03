import assert from "node:assert/strict";
import test from "node:test";
import type { RasterCodec } from "../src/domain/image-assets.js";
import type { RasterFrame } from "../src/domain/pixel-art.js";
import type { SpriteEffectsGateway } from "../src/domain/sprite-effects.js";
import type { VisualAssetGateway } from "../src/domain/visual-assets.js";
import { SceneEffectStackService } from "../src/application/services/SceneEffectStackService.js";

const frame: RasterFrame = { width: 12, height: 10, pixels: new Uint8ClampedArray(12 * 10 * 4), delayMs: 80 };
function operation(name: string): { ok: true; message: string } { return { ok: true, message: JSON.stringify({ operation: name, frames: 6, format: "gif" }) }; }

function service(calls: string[]): SceneEffectStackService {
  const codec: RasterCodec = { decode: async () => [frame], encode: async () => undefined };
  const effects: SpriteEffectsGateway = {
    applySpriteAmbientOcclusion: async () => operation("apply_sprite_ambient_occlusion"),
    applySpriteSpecularHighlight: async () => operation("apply_sprite_specular_highlight"),
    applySpriteColorRamp: async () => operation("apply_sprite_color_ramp"),
    applySpriteGrain: async () => operation("apply_sprite_grain"),
    applySpriteDither: async () => operation("apply_sprite_dither"),
    applySpriteColorTemperature: async () => operation("apply_sprite_color_temperature"),
    applyPixelOutline: async () => operation("outline"), removeBackground: async () => operation("remove_background"), cleanupIsolatedPixels: async () => operation("cleanup_isolated_pixels"), generateSpriteGlow: async () => { calls.push("glow"); return operation("generate_sprite_glow"); }, generateSpriteSilhouette: async () => operation("generate_sprite_silhouette"), applySpriteRimLight: async () => operation("apply_sprite_rim_light"), applyColorGrade: async () => operation("grade"), generateSpriteShadow: async () => { calls.push("shadow"); return operation("shadow"); }, generateParticleBurst: async (input) => { calls.push(`particles:${input.width}x${input.height}`); return operation("generate_particle_burst"); }, generateNormalMap: async () => operation("normal"), generateRainOverlay: async () => { calls.push("rain"); return operation("generate_rain_overlay"); }, generateMotionPack: async () => operation("motion"), generateWindSway: async () => { calls.push("wind"); return operation("generate_wind_sway"); }, generateSeamlessTexture: async () => operation("seamless"), generateWaterReflection: async () => { calls.push("reflection"); return operation("generate_water_reflection"); }, generateWaterCaustics: async () => { calls.push("caustics"); return operation("generate_water_caustics"); }, generateDayNightCycle: async () => { calls.push("day_night"); return operation("generate_day_night_cycle"); },
  };
  const visual: Pick<VisualAssetGateway, "applyMaterialTexture" | "applyDepthLighting"> = { applyMaterialTexture: async () => { calls.push("material"); return operation("apply_material_texture"); }, applyDepthLighting: async () => { calls.push("lighting"); return operation("apply_depth_lighting"); } };
  return new SceneEffectStackService(codec, effects, visual);
}

test("scene effect stack delegates selected effects once, infers particle size, and preserves order", async () => {
  const calls: string[] = [];
  const result = await service(calls).generateSceneEffectStack({ inputFilename: "scene.png", outputPrefix: "out/scene", effects: ["material_texture", "rain", "wind_sway", "sprite_shadow", "sprite_glow", "particles", "water_caustics"], frames: 6, seed: 33, material: "earth", format: "gif" });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["material", "rain", "wind", "shadow", "glow", "particles:12x10", "caustics"]);
  const payload = JSON.parse(result.message) as { operation: string; artifacts: Array<{ effect: string; outputFilename: string }>; deterministic: boolean; sourcePreserved: boolean };
  assert.equal(payload.operation, "generate_scene_effect_stack");
  assert.deepEqual(payload.artifacts.map((artifact) => artifact.effect), ["material_texture", "rain", "wind_sway", "sprite_shadow", "sprite_glow", "particles", "water_caustics"]);
  assert.equal(payload.artifacts[0]?.outputFilename, "out/scene-material_texture.gif");
  assert.equal(payload.deterministic, true);
  assert.equal(payload.sourcePreserved, true);
});

test("scene effect stack rejects duplicate effects, unsafe paths, invalid frames, and source collisions", async () => {
  const stack = service([]);
  const base = { inputFilename: "scene.png", outputPrefix: "out/scene", effects: ["rain"] as ("rain")[], frames: 6, seed: 1 };
  assert.equal((await stack.generateSceneEffectStack({ ...base, effects: ["rain", "rain"] })).ok, false);
  assert.equal((await stack.generateSceneEffectStack({ ...base, outputPrefix: "out/../scene" })).ok, false);
  assert.equal((await stack.generateSceneEffectStack({ ...base, frames: 1 })).ok, false);
  assert.equal((await stack.generateSceneEffectStack({ ...base, outputPrefix: "scene.png" })).ok, false);
});
