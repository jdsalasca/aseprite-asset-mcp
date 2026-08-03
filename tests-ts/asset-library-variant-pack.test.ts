import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import type { AssetLibraryCatalog } from "../src/domain/asset-library.js";
import type { AssetLibraryVariantPackResult } from "../src/domain/asset-library-variants.js";
import { AssetLibraryVariantPackService } from "../src/application/services/AssetLibraryVariantPackService.js";

const item = (id: string) => ({ id, title: id.toUpperCase(), category: "flora", folder: `flora/${id}`, kind: "sprite" as const, description: id, tags: [], variants: ["rain"], formats: ["png"] as ["png"], readmePath: `flora/${id}/README.md`, previewPath: `flora/${id}/preview.png`, spritePath: `flora/${id}/sprite.png`, deterministic: true as const });
const catalog: AssetLibraryCatalog = { schemaVersion: 1, libraryVersion: "library-variants-v1", categories: [{ id: "flora", title: "Flora", description: "Trees", itemCount: 2 }], items: [item("oak"), item("pine")], presets: [] };

test("resolves library ids and delegates each asset to the existing variant service", async () => {
  const calls: Array<Record<string, unknown>> = []; const released: string[] = []; let manifest: unknown;
  const service = new AssetLibraryVariantPackService({ load: async () => catalog, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) }, { materialize: async (asset) => ({ filename: `${asset.id}.png`, release: async () => { released.push(asset.id); } }) }, { generateVariantPack: async (input) => { calls.push(input); return { ok: true, message: JSON.stringify({ operation: "generate_variant_pack", artifacts: [{ variant: "rain", outputFilename: `${input.outputPrefix}-rain.gif`, operation: "generate_rain_overlay", frames: input.frames, format: "gif", deterministic: true, sourcePreserved: true }] }) }; } }, { write: async (_filename, value) => { manifest = value; } });
  const result = await service.generate({ itemIds: ["oak", "pine"], outputPrefix: "out/library", variants: ["rain"], frames: 6, seed: 9, delayMs: 120 });
  assert.equal(result.ok, true);
  const payload = JSON.parse(result.message) as AssetLibraryVariantPackResult;
  assert.deepEqual(payload.itemIds, ["oak", "pine"]);
  assert.deepEqual(calls.map((call) => call.outputPrefix), [path.join("out/library", "oak"), path.join("out/library", "pine")]);
  assert.deepEqual(calls.map((call) => call.seed), [9, 10]);
  assert.deepEqual(released.sort(), ["oak", "pine"]);
  assert.equal((manifest as AssetLibraryVariantPackResult).assets.length, 2);
});

test("fails closed before materializing for duplicate, missing, unsafe, and oversized selections", async () => {
  let materialized = 0;
  const service = new AssetLibraryVariantPackService({ load: async () => catalog, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) }, { materialize: async () => { materialized += 1; return { filename: "asset.png", release: async () => undefined }; } }, { generateVariantPack: async () => ({ ok: true, message: "{}" }) });
  assert.match((await service.generate({ itemIds: ["oak", "OAK"], outputPrefix: "out", variants: ["rain"], frames: 6, seed: 1 })).message, /duplicate/);
  assert.match((await service.generate({ itemIds: ["missing"], outputPrefix: "out", variants: ["rain"], frames: 6, seed: 1 })).message, /missing asset/);
  assert.match((await service.generate({ itemIds: ["oak"], outputPrefix: "../out", variants: ["rain"], frames: 6, seed: 1 })).message, /unsafe/);
  assert.match((await service.generate({ itemIds: Array.from({ length: 25 }, (_, index) => `asset-${index}`), outputPrefix: "out", variants: ["rain"], frames: 6, seed: 1 })).message, /between 1 and 24/);
  assert.equal(materialized, 0);
});

test("releases already materialized sources when a later variant execution fails", async () => {
  const released: string[] = [];
  const service = new AssetLibraryVariantPackService({ load: async () => catalog, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) }, { materialize: async (asset) => ({ filename: `${asset.id}.png`, release: async () => { released.push(asset.id); } }) }, { generateVariantPack: async (input) => input.outputPrefix.endsWith("pine") ? { ok: false, message: "variant gateway failed" } : { ok: true, message: JSON.stringify({ artifacts: [{ variant: "rain", outputFilename: "oak-rain.gif" }] }) } });
  const result = await service.generate({ itemIds: ["oak", "pine"], outputPrefix: "out", variants: ["rain"], frames: 4, seed: 3 });
  assert.equal(result.ok, false);
  assert.match(result.message, /variant gateway failed/);
  assert.deepEqual(released.sort(), ["oak", "pine"]);
});

test("delegates wind sway variants through the shared variant gateway", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const service = new AssetLibraryVariantPackService({ load: async () => catalog, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) }, { materialize: async (asset) => ({ filename: `${asset.id}.png`, release: async () => undefined }) }, { generateVariantPack: async (input) => { calls.push(input); return { ok: true, message: JSON.stringify({ artifacts: [{ variant: "wind_sway", outputFilename: `${input.outputPrefix}-wind_sway.gif` }] }) }; } });
  const result = await service.generate({ itemIds: ["oak"], outputPrefix: "out/wind", variants: ["wind_sway"], frames: 6, seed: 5 });
  assert.equal(result.ok, true);
  assert.deepEqual(calls[0]?.variants, ["wind_sway"]);
  assert.deepEqual(JSON.parse(result.message).variants, ["wind_sway"]);
});

test("rejects malformed delegated artifacts instead of publishing an incomplete manifest", async () => {
  let manifestWrites = 0;
  const service = new AssetLibraryVariantPackService({ load: async () => catalog, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) }, { materialize: async () => ({ filename: "asset.png", release: async () => undefined }) }, { generateVariantPack: async () => ({ ok: true, message: JSON.stringify({ artifacts: [{ variant: "rain" }] }) }) }, { write: async () => { manifestWrites += 1; } });
  const result = await service.generate({ itemIds: ["oak"], outputPrefix: "out", variants: ["rain"], frames: 4, seed: 3 });
  assert.equal(result.ok, false);
  assert.match(result.message, /malformed artifacts/);
  assert.equal(manifestWrites, 0);
});
