import assert from "node:assert/strict";
import test from "node:test";
import type { AssetLibraryCatalog } from "../src/domain/asset-library.js";
import { AssetScenePlannerService } from "../src/application/services/AssetScenePlannerService.js";

const item = (id: string, kind: "sprite" | "scene" | "effect", category = "flora") => ({ id, title: id, category, folder: `${category}/${id}`, kind, description: id, tags: [], variants: [], formats: ["png"] as ["png"], readmePath: `${category}/${id}/README.md`, previewPath: `${category}/${id}/preview.png`, spritePath: `${category}/${id}/sprite-sheet.png`, deterministic: true as const });
const catalog: AssetLibraryCatalog = { schemaVersion: 1, libraryVersion: "catalog-scene-v1", categories: [{ id: "flora", title: "Flora", description: "Plants", itemCount: 2 }], items: [item("oak", "scene"), item("knight", "sprite", "characters"), item("rain", "effect", "effects")], presets: [] };
const port = { load: async () => catalog, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) };

test("plans ordered scene layers from arbitrary library ids", async () => {
  const result = await new AssetScenePlannerService(port).plan(["KNIGHT", "oak", "rain"]);
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(result.message), { operation: "plan_asset_scene", libraryVersion: "catalog-scene-v1", itemIds: ["knight", "oak", "rain"], layers: [{ id: "scene-knight", assetId: "knight", title: "knight", category: "characters", kind: "sprite", role: "background", order: 0, previewPath: "characters/knight/preview.png", spritePath: "characters/knight/sprite-sheet.png" }, { id: "scene-oak", assetId: "oak", title: "oak", category: "flora", kind: "scene", role: "midground", order: 1, previewPath: "flora/oak/preview.png", spritePath: "flora/oak/sprite-sheet.png" }, { id: "scene-rain", assetId: "rain", title: "rain", category: "effects", kind: "effect", role: "effect", order: 2, previewPath: "effects/rain/preview.png", spritePath: "effects/rain/sprite-sheet.png" }], deterministic: true, sourcePreserved: true });
});

test("fails closed for empty, duplicate, missing, and unsafe scene selections", async () => {
  const service = new AssetScenePlannerService(port);
  await assert.rejects(() => service.plan([]), /at least one/);
  await assert.rejects(() => service.plan(["oak", "oak"]), /duplicate/);
  await assert.rejects(() => service.plan(["oak", "missing"]), /missing/);
  await assert.rejects(() => service.plan(["../oak"]), /unsafe/);
});
