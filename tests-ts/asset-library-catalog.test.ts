import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { FileAssetLibraryAdapter } from "../src/infrastructure/assets/FileAssetLibraryAdapter.js";

test("generated asset library exposes 100+ navigable folders and valid preset references", async () => {
  const catalog = await new FileAssetLibraryAdapter().load();
  assert.ok(catalog.items.length > 250);
  assert.equal(new Set(catalog.items.map((item) => item.id)).size, catalog.items.length);
  const itemIds = new Set(catalog.items.map((item) => item.id));
  for (const preset of catalog.presets) for (const itemId of preset.itemIds) assert.equal(itemIds.has(itemId), true, `${preset.id} references missing item ${itemId}`);
  for (const item of catalog.items.slice(0, 12)) {
    assert.equal((await fs.stat(path.resolve("assets/folders", item.readmePath))).isFile(), true);
    assert.equal((await fs.stat(path.resolve("assets/folders", item.previewPath))).isFile(), true);
    assert.equal((await fs.stat(path.resolve("assets/folders", item.spritePath))).isFile(), true);
  }
});
