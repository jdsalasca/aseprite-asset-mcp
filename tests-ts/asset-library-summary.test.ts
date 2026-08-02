import assert from "node:assert/strict";
import test from "node:test";
import type { AssetLibraryCatalog } from "../src/domain/asset-library.js";
import { AssetLibrarySummaryService } from "../src/application/services/AssetLibrarySummaryService.js";

const item = (id: string, category: string) => ({ id, title: id, category, folder: `${category}/${id}`, kind: "sprite" as const, description: id, tags: [], variants: [], formats: ["png"] as ["png"], readmePath: `${category}/${id}/README.md`, previewPath: `${category}/${id}/preview.png`, spritePath: `${category}/${id}/sprite-sheet.png`, deterministic: true as const });
const catalog: AssetLibraryCatalog = { schemaVersion: 1, libraryVersion: "catalog-v2", categories: [{ id: "flora", title: "Flora", description: "Plants", itemCount: 2 }, { id: "characters", title: "Characters", description: "Heroes", itemCount: 1 }], items: [item("oak", "flora"), item("pine", "flora"), item("knight", "characters")], presets: [{ id: "grove", title: "Living grove", description: "Forest", category: "flora", itemIds: ["oak", "pine"], recommendedTools: [], deterministic: true }] };

test("summarizes the catalog with bounded deterministic navigation data", async () => {
  const result = await new AssetLibrarySummaryService({ load: async () => catalog, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) }).summarize();
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(result.message), { operation: "summarize_asset_library", libraryVersion: "catalog-v2", totalItems: 3, totalCategories: 2, totalPresets: 1, categories: [{ id: "characters", title: "Characters", itemCount: 1, examples: ["knight"] }, { id: "flora", title: "Flora", itemCount: 2, examples: ["oak", "pine"] }], presets: [{ id: "grove", title: "Living grove", category: "flora", itemCount: 2 }], deterministic: true, sourcePreserved: true });
});

test("summary failures stay compact when the catalog adapter fails", async () => {
  const result = await new AssetLibrarySummaryService({ load: async () => { throw new Error("catalog unavailable"); }, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) }).summarize();
  assert.deepEqual(result, { ok: false, message: "catalog unavailable" });
});
