import assert from "node:assert/strict";
import test from "node:test";
import { AssetLibraryService } from "../src/application/services/AssetLibraryService.js";
import type { AssetLibraryCatalog } from "../src/domain/asset-library.js";
import type { AssetLibraryPort } from "../src/application/ports/AssetLibraryPort.js";

const catalog: AssetLibraryCatalog = {
  schemaVersion: 1,
  libraryVersion: "test",
  categories: [{ id: "flora", title: "Flora", description: "Plants", itemCount: 2 }, { id: "characters", title: "Characters", description: "People", itemCount: 1 }],
  items: [
    { id: "oak", title: "Oak tree", category: "flora", folder: "flora/oak", kind: "sprite", description: "Oak with rain and birds variants", tags: ["tree", "rain", "birds"], variants: ["rain", "birds"], formats: ["png", "svg", "json"], readmePath: "flora/oak/README.md", previewPath: "flora/oak/preview.png", spritePath: "flora/oak/sprite-sheet.png", deterministic: true },
    { id: "pine", title: "Pine tree", category: "flora", folder: "flora/pine", kind: "sprite", description: "Pine", tags: ["tree"], variants: ["fire"], formats: ["png", "svg", "json"], readmePath: "flora/pine/README.md", previewPath: "flora/pine/preview.png", spritePath: "flora/pine/sprite-sheet.png", deterministic: true },
    { id: "knight", title: "Knight", category: "characters", folder: "characters/knight", kind: "character", description: "Knight walk cycle", tags: ["walk", "combat"], variants: ["idle", "walk", "attack"], formats: ["png", "gif", "json"], readmePath: "characters/knight/README.md", previewPath: "characters/knight/preview.png", spritePath: "characters/knight/sprite-sheet.png", deterministic: true },
  ],
  presets: [{ id: "rainy-grove", title: "Rainy grove", description: "Oak, pine, rain and water", category: "flora", itemIds: ["oak", "pine"], recommendedTools: ["generate_environment_pack", "generate_time_of_day_pack"], deterministic: true }],
};
class FakeLibrary implements AssetLibraryPort { public async load(): Promise<AssetLibraryCatalog> { return catalog; } public async read() { return { data: new Uint8Array([1, 2, 3]), contentType: "image/png" }; } }

test("asset library searches tags, clamps limits, and returns matching categories", async () => {
  const result = await new AssetLibraryService(new FakeLibrary()).search({ query: "rain", limit: 999 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.id, "oak");
  assert.equal(result.query.limit, 100);
  assert.deepEqual(result.categories.map((category) => category.id), ["flora"]);
});

test("asset library resolves items and presets case-insensitively", async () => {
  const service = new AssetLibraryService(new FakeLibrary());
  assert.equal((await service.get("KNIGHT"))?.variants.includes("walk"), true);
  assert.equal((await service.preset("RAINY-GROVE"))?.itemIds.length, 2);
  assert.equal(await service.get("missing"), null);
});

test("asset library reads a binary preview only after resolving a known item", async () => {
  const service = new AssetLibraryService(new FakeLibrary());
  assert.deepEqual([...((await service.binary("OAK", "preview"))?.data ?? [])], [1, 2, 3]);
  assert.equal(await service.binary("missing", "preview"), null);
});
