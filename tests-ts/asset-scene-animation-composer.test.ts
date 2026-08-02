import assert from "node:assert/strict";
import test from "node:test";
import type { AssetLibraryCatalog } from "../src/domain/asset-library.js";
import type { RasterCodec } from "../src/domain/image-assets.js";
import type { RasterFrame } from "../src/domain/pixel-art.js";
import { AssetSceneAnimationComposerService } from "../src/application/services/AssetSceneAnimationComposerService.js";

const item = (id: string) => ({ id, title: id, category: "effects", folder: `effects/${id}`, kind: "effect" as const, description: id, tags: [], variants: [], formats: ["gif"] as ["gif"], readmePath: `effects/${id}/README.md`, previewPath: `effects/${id}/preview.gif`, spritePath: `effects/${id}/sprite-sheet.gif`, deterministic: true as const });
const catalog: AssetLibraryCatalog = { schemaVersion: 1, libraryVersion: "scene-animation-v1", categories: [{ id: "effects", title: "Effects", description: "Effects", itemCount: 1 }], items: [item("rain")], presets: [] };
function frame(color: [number, number, number, number]): RasterFrame { const pixels = new Uint8ClampedArray(4 * 4 * 4); for (let index = 0; index < pixels.length; index += 4) pixels.set(color, index); return { width: 4, height: 4, pixels }; }

test("composes animated library previews with cyclic frame selection and a GIF manifest", async () => {
  let encoded: RasterFrame[] = []; let encodedFormat = ""; let manifest: any;
  const codec: RasterCodec = { decode: async () => [], encode: async (frames, _filename, format) => { encoded = frames; encodedFormat = format; } };
  const decoder = { decodeBuffer: async () => [frame([255, 0, 0, 255]), frame([0, 0, 255, 255])] };
  const library = { load: async () => catalog, read: async () => ({ data: new Uint8Array([1]), contentType: "image/gif" }) };
  const result = await new AssetSceneAnimationComposerService(library, decoder, codec, { write: async (_filename, value) => { manifest = value; } }).compose({ itemIds: ["rain"], outputFilename: "out/scene.gif", manifestFilename: "out/scene.json", width: 16, height: 16, padding: 2, frames: 3, delayMs: 120 });
  assert.equal(result.ok, true);
  assert.equal(encodedFormat, "gif");
  assert.equal(encoded.length, 3);
  assert.deepEqual(encoded.map((entry) => [...entry.pixels.slice((6 * 16 + 6) * 4, (6 * 16 + 6) * 4 + 4)]), [[255, 0, 0, 255], [0, 0, 255, 255], [255, 0, 0, 255]]);
  assert.equal(encoded.every((entry) => entry.delayMs === 120), true);
  assert.equal(manifest.kind, "asset_scene_animation");
  assert.equal(manifest.frameLayers.length, 3);
  assert.deepEqual(JSON.parse(result.message), { operation: "compose_asset_scene_animation", output: "out/scene.gif", manifest: "out/scene.json", libraryVersion: "scene-animation-v1", itemIds: ["rain"], width: 16, height: 16, padding: 2, frames: 3, delayMs: 120, frameLayers: manifest.frameLayers, deterministic: true, sourcePreserved: true });
});

test("animated scene composition fails closed for invalid timing and output collisions", async () => {
  let encoded = false;
  const codec: RasterCodec = { decode: async () => [], encode: async () => { encoded = true; } };
  const library = { load: async () => catalog, read: async () => ({ data: new Uint8Array([1]), contentType: "image/gif" }) };
  const service = new AssetSceneAnimationComposerService(library, { decodeBuffer: async () => [frame([255, 0, 0, 255])] }, codec, { write: async () => undefined });
  assert.match((await service.compose({ itemIds: ["rain"], outputFilename: "scene.gif", manifestFilename: "scene.json", width: 16, height: 16, frames: 1 })).message, /frames must be/);
  assert.match((await service.compose({ itemIds: ["rain"], outputFilename: "scene.gif", manifestFilename: "scene.gif", width: 16, height: 16, frames: 2 })).message, /\.json/);
  assert.match((await service.compose({ itemIds: ["rain"], outputFilename: "scene.png", manifestFilename: "scene.json", width: 16, height: 16, frames: 2 })).message, /\.gif/);
  assert.match((await service.compose({ itemIds: ["rain"], outputFilename: "scene.gif", manifestFilename: "scene.txt", width: 16, height: 16, frames: 2 })).message, /\.json/);
  assert.match((await service.compose({ itemIds: ["rain"], outputFilename: "scene.gif", manifestFilename: "scene.json", width: 16, height: 16, frames: 2, delayMs: 0 })).message, /delay/);
  assert.equal(encoded, false);
});
