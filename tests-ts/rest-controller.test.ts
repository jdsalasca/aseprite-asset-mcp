import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { AssetRecipeComposerService } from "../src/application/services/AssetRecipeComposerService.js";
import type { AssetRestUseCases } from "../src/application/ports/AssetRestPorts.js";
import { AssetRestController } from "../src/interfaces/rest/AssetRestController.js";
import type { AssetOperationResult } from "../src/domain/asset-operations.js";
import type { SpriteEffectsGateway } from "../src/domain/sprite-effects.js";

function result(operation: string): AssetOperationResult { return { ok: true, message: JSON.stringify({ operation, deterministic: true, sourcePreserved: true }) }; }
function fakeUseCases(): AssetRestUseCases {
  const effects: SpriteEffectsGateway = { applyPixelOutline: async () => result("apply_pixel_outline"), applyColorGrade: async () => result("apply_color_grade"), generateSpriteShadow: async () => result("generate_sprite_shadow"), generateParticleBurst: async () => result("generate_particle_burst"), generateNormalMap: async () => result("generate_normal_map") };
  return { createRecipe: (input) => new AssetRecipeComposerService().compose(input), spriteEffects: effects, applyMaterialTexture: async () => result("apply_material_texture"), applyDepthLighting: async () => result("apply_depth_lighting") };
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

    const recipe = await fetch(`${rest.url}/api/v1/recipes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset_id: "hero", input_filename: "hero.png", output_prefix: "out/hero", steps: ["outline", "quality_gate"], seed: 4 }) });
    const recipeBody = await recipe.json();
    assert.equal(recipe.status, 200);
    assert.equal(recipeBody.data.deterministic, true);
    assert.equal(recipeBody.data.steps[0].operation, "apply_pixel_outline");

    const effect = await fetch(`${rest.url}/api/v1/effects/outline`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.png", output_filename: "hero-outline.png", color: "#172033" }) });
    assert.equal(effect.status, 200);
    assert.equal((await effect.json()).data.operation, "apply_pixel_outline");

    const invalid = await fetch(`${rest.url}/api/v1/effects/outline`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input_filename: "hero.png", output_filename: "hero-outline.png", color: "nope" }) });
    assert.equal(invalid.status, 400);
  } finally { await rest.close(); }
});
