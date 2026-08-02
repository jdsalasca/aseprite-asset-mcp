import assert from "node:assert/strict";
import test from "node:test";
import type { AssetLibraryCatalog } from "../src/domain/asset-library.js";
import { AssetSceneRecommendationService } from "../src/application/services/AssetSceneRecommendationService.js";

const catalog: AssetLibraryCatalog = { schemaVersion: 1, libraryVersion: "recommendation-v1", categories: [{ id: "coast", title: "Coast", description: "Coast", itemCount: 3 }], items: [
  { id: "palm", title: "Palm Tree", category: "coast", folder: "coast/palm", kind: "sprite", description: "A tropical tree", tags: ["tree", "tropical"], variants: ["rain", "birds"], formats: ["png"], readmePath: "coast/palm/README.md", previewPath: "coast/palm/preview.png", spritePath: "coast/palm/sprite.png", deterministic: true },
  { id: "ocean", title: "Ocean Waves", category: "coast", folder: "coast/ocean", kind: "scene", description: "Animated water", tags: ["water", "wave"], variants: ["water_reflection", "water_caustics"], formats: ["png", "gif"], readmePath: "coast/ocean/README.md", previewPath: "coast/ocean/preview.png", spritePath: "coast/ocean/sprite.png", deterministic: true },
  { id: "sword", title: "Sword", category: "coast", folder: "coast/sword", kind: "prop", description: "A steel sword", tags: ["weapon"], variants: ["fire"], formats: ["png"], readmePath: "coast/sword/README.md", previewPath: "coast/sword/preview.png", spritePath: "coast/sword/sprite.png", deterministic: true },
], presets: [] };

const service = new AssetSceneRecommendationService({ load: async () => catalog, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) });

test("ranks scene assets by prompt, tags and variants with compact reasons", async () => {
  const result = await service.recommend({ prompt: "tropical water", requiredVariants: ["water_reflection"], limit: 2, seed: 7 });
  assert.equal(result.ok, true);
  const payload = JSON.parse(result.message) as { suggestedItemIds: string[]; recommendations: Array<{ assetId: string; reasons: string[] }>; deterministic: boolean };
  assert.deepEqual(payload.suggestedItemIds, ["ocean", "palm"]);
  assert.ok(payload.recommendations[0]?.reasons.includes("variant:water_reflection"));
  assert.equal(payload.deterministic, true);
});

test("uses the same seeded ordering and fails closed for empty intent or invalid limits", async () => {
  const input = { category: "coast", requiredKinds: ["sprite"] as ["sprite"], limit: 2, seed: 11 };
  assert.equal((await service.recommend(input)).message, (await service.recommend(input)).message);
  assert.match((await service.recommend({})).message, /requires a prompt/);
  assert.match((await service.recommend({ prompt: "tree", limit: 0 })).message, /limit/);
  assert.match((await service.recommend({ prompt: "tree", limit: 1.5 })).message, /limit/);
});
