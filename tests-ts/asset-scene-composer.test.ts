import assert from "node:assert/strict";
import test from "node:test";
import type { AssetLibraryCatalog } from "../src/domain/asset-library.js";
import type { RasterCodec } from "../src/domain/image-assets.js";
import type { RasterFrame } from "../src/domain/pixel-art.js";
import { AssetSceneComposerService } from "../src/application/services/AssetSceneComposerService.js";

const item = (id: string) => ({ id, title: id, category: "flora", folder: `flora/${id}`, kind: "sprite" as const, description: id, tags: [], variants: [], formats: ["png"] as ["png"], readmePath: `flora/${id}/README.md`, previewPath: `flora/${id}/preview.png`, spritePath: `flora/${id}/sprite-sheet.png`, deterministic: true as const });
const catalog: AssetLibraryCatalog = { schemaVersion: 1, libraryVersion: "scene-v1", categories: [{ id: "flora", title: "Flora", description: "Plants", itemCount: 2 }], items: [item("oak"), item("pine")], presets: [] };
function frame(color: [number, number, number, number]): RasterFrame { const pixels = new Uint8ClampedArray(4 * 4 * 4); for (let index = 0; index < pixels.length; index += 4) pixels.set(color, index); return { width: 4, height: 4, pixels }; }

test("composes library previews into a deterministic PNG and manifest", async () => {
  let encoded: RasterFrame | undefined; let manifest: unknown;
  const codec: RasterCodec = { decode: async () => [], encode: async (frames) => { encoded = frames[0]; } };
  const decoder = { decodeBuffer: async (data: Uint8Array) => [frame(data[0] === 2 ? [0, 0, 255, 255] : [255, 0, 0, 255])] };
  const library = { load: async () => catalog, read: async (asset: { id: string }) => ({ data: new Uint8Array([asset.id === "pine" ? 2 : 1]), contentType: "image/png" }) };
  const result = await new AssetSceneComposerService(library, decoder, codec, { write: async (_filename, value) => { manifest = value; } }).compose({ itemIds: ["oak", "pine"], outputFilename: "out/scene.png", manifestFilename: "out/scene.json", width: 16, height: 16, padding: 2 });
  assert.equal(result.ok, true);
  assert.equal(encoded?.width, 16);
  assert.equal(encoded?.height, 16);
  assert.equal(encoded?.pixels[(8 * 16 + 8) * 4 + 2], 255);
  assert.equal((manifest as { kind: string }).kind, "asset_scene");
  assert.deepEqual(JSON.parse(result.message), { operation: "compose_asset_scene", output: "out/scene.png", manifest: "out/scene.json", libraryVersion: "scene-v1", itemIds: ["oak", "pine"], width: 16, height: 16, padding: 2, layers: [{ id: "scene-oak", assetId: "oak", title: "oak", category: "flora", kind: "sprite", role: "background", order: 0, previewPath: "flora/oak/preview.png", spritePath: "flora/oak/sprite-sheet.png", x: 6, y: 6, width: 4, height: 4 }, { id: "scene-pine", assetId: "pine", title: "pine", category: "flora", kind: "sprite", role: "foreground", order: 1, previewPath: "flora/pine/preview.png", spritePath: "flora/pine/sprite-sheet.png", x: 6, y: 6, width: 4, height: 4 }], deterministic: true, sourcePreserved: true });
});

test("composer rejects output collisions and missing references without encoding", async () => {
  let encoded = false;
  const codec: RasterCodec = { decode: async () => [], encode: async () => { encoded = true; } };
  const library = { load: async () => catalog, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) };
  const service = new AssetSceneComposerService(library, { decodeBuffer: async () => [frame([255, 0, 0, 255])] }, codec, { write: async () => undefined });
  assert.match((await service.compose({ itemIds: ["oak"], outputFilename: "scene.png", manifestFilename: "scene.png", width: 16, height: 16 })).message, /must differ/);
  assert.match((await service.compose({ itemIds: ["missing"], outputFilename: "scene.png", manifestFilename: "scene.json", width: 16, height: 16 })).message, /missing asset/);
  assert.equal(encoded, false);
});
