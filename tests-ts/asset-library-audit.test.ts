import assert from "node:assert/strict";
import test from "node:test";
import type { AssetLibraryCatalog } from "../src/domain/asset-library.js";
import { AssetLibraryAuditService } from "../src/application/services/AssetLibraryAuditService.js";

const item = (id: string, category = "flora") => ({ id, title: id, category, folder: `${category}/${id}`, kind: "sprite" as const, description: "test", tags: [category], variants: [], formats: ["png"] as ["png"], readmePath: `${category}/${id}/README.md`, previewPath: `${category}/${id}/preview.png`, spritePath: `${category}/${id}/sprite-sheet.png`, deterministic: true as const });
const validCatalog: AssetLibraryCatalog = { schemaVersion: 1, libraryVersion: "test-v1", categories: [{ id: "flora", title: "Flora", description: "Plants", itemCount: 1 }], items: [item("oak")], presets: [{ id: "grove", title: "Grove", description: "Oak", category: "flora", itemIds: ["oak"], recommendedTools: ["get_asset_library"], deterministic: true }] };

test("audits a valid catalog and returns compact navigation counts", async () => {
  const result = await new AssetLibraryAuditService({ load: async () => validCatalog, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) }).audit();
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(result.message), { operation: "audit_asset_library", libraryVersion: "test-v1", totalItems: 1, totalCategories: 1, totalPresets: 1, totalFolders: 1, readmePaths: 1, previewPaths: 1, spritePaths: 1, valid: true, violations: [], deterministic: true, sourcePreserved: true });
});

test("finds duplicate ids, missing preset references, missing categories, and unsafe paths", async () => {
  const broken: AssetLibraryCatalog = { ...validCatalog, categories: validCatalog.categories, items: [item("oak"), { ...item("OAK", "missing"), readmePath: "../outside/README.md" }], presets: [{ ...validCatalog.presets[0]!, itemIds: ["oak", "missing-tree"] }] };
  const result = await new AssetLibraryAuditService({ load: async () => broken, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) }).audit();
  assert.equal(result.ok, true);
  const payload = JSON.parse(result.message) as { valid: boolean; violations: string[] };
  assert.equal(payload.valid, false);
  assert.ok(payload.violations.some((violation) => violation.includes("duplicate item id")));
  assert.ok(payload.violations.some((violation) => violation.includes("missing preset item")));
  assert.ok(payload.violations.some((violation) => violation.includes("unknown category")));
  assert.ok(payload.violations.some((violation) => violation.includes("unsafe readme path")));
});

test("fails compactly when the catalog adapter cannot load", async () => {
  const result = await new AssetLibraryAuditService({ load: async () => { throw new Error("catalog unavailable"); }, read: async () => ({ data: new Uint8Array(), contentType: "image/png" }) }).audit();
  assert.deepEqual(result, { ok: false, message: "catalog unavailable" });
});
