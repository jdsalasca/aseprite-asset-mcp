import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FileAssetLibrarySourceAdapter } from "../src/infrastructure/assets/FileAssetLibrarySourceAdapter.js";

const item = { id: "rain", title: "Rain", category: "effects", folder: "effects/rain", kind: "effect" as const, description: "Rain", tags: [], variants: [], formats: ["gif"] as ["gif"], readmePath: "effects/rain/README.md", previewPath: "effects/rain/preview.gif", spritePath: "effects/rain/sprite.gif", deterministic: true as const };

test("materializes a library preview to a temporary file and releases it", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "library-source-test-"));
  const source = new FileAssetLibrarySourceAdapter({ load: async () => { throw new Error("not used"); }, read: async () => ({ data: new Uint8Array([71, 73, 70]), contentType: "image/gif" }) }, root);
  const materialized = await source.materialize(item);
  assert.match(materialized.filename, /source\.gif$/);
  assert.deepEqual([...await fs.readFile(materialized.filename)], [71, 73, 70]);
  await materialized.release();
  await assert.rejects(() => fs.access(materialized.filename));
  await fs.rm(root, { recursive: true, force: true });
});

test("rejects empty library previews before creating a temporary source", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "library-source-empty-"));
  const source = new FileAssetLibrarySourceAdapter({ load: async () => { throw new Error("not used"); }, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) }, root);
  await assert.rejects(() => source.materialize({ ...item, id: "empty" }), /empty/);
  assert.equal((await fs.readdir(root)).length, 0);
  await fs.rm(root, { recursive: true, force: true });
});
