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

test("file adapter serves a generated preview as binary data", async () => {
  const adapter = new FileAssetLibraryAdapter();
  const item = (await adapter.load()).items.find((entry) => entry.id === "oak");
  assert.ok(item);
  const binary = await adapter.read(item!, "preview");
  assert.equal(binary.contentType, "image/png");
  assert.ok(binary.data.byteLength > 20);
});

test("every generated folder and category has a navigation README", async () => {
  const directories = await fs.readdir(path.resolve("assets/folders"), { withFileTypes: true });
  const folders = directories.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  assert.ok(folders.length >= 10);
  for (const folder of folders) assert.equal((await fs.stat(path.resolve("assets/folders", folder, "README.md"))).isFile(), true, `missing category README: ${folder}`);
  const nested = (await fs.readdir(path.resolve("assets/folders"), { withFileTypes: true })).filter((entry) => entry.isDirectory());
  for (const category of nested) {
    for (const item of await fs.readdir(path.resolve("assets/folders", category.name), { withFileTypes: true })) if (item.isDirectory()) assert.equal((await fs.stat(path.resolve("assets/folders", category.name, item.name, "README.md"))).isFile(), true, `missing item README: ${category.name}/${item.name}`);
  }
});
