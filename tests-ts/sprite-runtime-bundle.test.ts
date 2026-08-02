import assert from "node:assert/strict";
import test from "node:test";
import type { AssetOperationResult } from "../src/domain/asset-operations.js";
import type { AssetManifestWriter } from "../src/domain/image-assets.js";
import { SpriteRuntimeBundleService } from "../src/application/services/SpriteRuntimeBundleService.js";

function operation(name: string, payload: Record<string, unknown> = {}): AssetOperationResult {
  return { ok: true, message: JSON.stringify({ operation: name, deterministic: true, sourcePreserved: true, ...payload }) };
}

test("builds one runtime bundle through animation and hitbox ports", async () => {
  const calls: string[] = [];
  let manifest: unknown;
  const writer: AssetManifestWriter = { write: async (_filename, value) => { manifest = value; } };
  const service = new SpriteRuntimeBundleService(
    { build: async (input) => { calls.push(`sheet:${input.outputFilename}`); return operation("build_animation_sheet", { output: input.outputFilename, manifest: input.manifestFilename, frames: 8, columns: 4, rows: 2, width: 132, height: 66, cellWidth: 32, cellHeight: 32, padding: input.padding ?? 0 }); } },
    { generate: async (input) => { calls.push(`hitboxes:${input.outputFilename}`); return operation("generate_sprite_hitboxes", { filename: input.filename, manifest: input.outputFilename, frames: 8, mode: input.mode ?? "components", padding: input.padding ?? 0, hitboxes: 24 }); } },
    writer,
  );

  const result = await service.build({ inputFilename: "hero.gif", sheetFilename: "hero-sheet.png", sheetManifestFilename: "hero-sheet.json", hitboxManifestFilename: "hero-hitboxes.json", bundleManifestFilename: "hero-runtime.json", columns: 4, sheetPadding: 1, hitboxMode: "components", hitboxPadding: 2 });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["sheet:hero-sheet.png", "hitboxes:hero-hitboxes.json"]);
  assert.deepEqual(JSON.parse(result.message), { operation: "build_sprite_runtime_bundle", manifest: "hero-runtime.json", filename: "hero.gif", frames: 8, artifacts: 2, deterministic: true, sourcePreserved: true });
  assert.deepEqual(manifest, { schemaVersion: 1, kind: "sprite_runtime_bundle", source: "hero.gif", artifacts: { animationSheet: { output: "hero-sheet.png", manifest: "hero-sheet.json", frames: 8, columns: 4, rows: 2, width: 132, height: 66, cellWidth: 32, cellHeight: 32, padding: 1 }, hitboxes: { manifest: "hero-hitboxes.json", mode: "components", padding: 2, hitboxes: 24 } }, deterministic: true, sourcePreserved: true });
});

test("fails before delegating when runtime outputs collide or options are unsafe", async () => {
  let calls = 0;
  const service = new SpriteRuntimeBundleService({ build: async () => { calls += 1; return operation("sheet"); } }, { generate: async () => { calls += 1; return operation("hitboxes"); } }, { write: async () => undefined });
  const collision = await service.build({ inputFilename: "hero.gif", sheetFilename: "hero-sheet.png", sheetManifestFilename: "hero-sheet.json", hitboxManifestFilename: "hero-hitboxes.json", bundleManifestFilename: "hero-sheet.png" });
  assert.equal(collision.ok, false);
  assert.match(collision.message, /different|different/i);
  const invalid = await service.build({ inputFilename: "hero.gif", sheetFilename: "hero-sheet.png", sheetManifestFilename: "hero-sheet.json", hitboxManifestFilename: "hero-hitboxes.json", bundleManifestFilename: "hero-runtime.json", columns: 17, sheetPadding: -1, hitboxPadding: 17 });
  assert.equal(invalid.ok, false);
  assert.equal(calls, 0);
});

test("propagates a failed child operation without writing a bundle manifest", async () => {
  let wrote = false;
  const service = new SpriteRuntimeBundleService({ build: async () => ({ ok: false, message: "sheet failed" }) }, { generate: async () => operation("hitboxes") }, { write: async () => { wrote = true; } });
  const result = await service.build({ inputFilename: "hero.gif", sheetFilename: "hero-sheet.png", sheetManifestFilename: "hero-sheet.json", hitboxManifestFilename: "hero-hitboxes.json", bundleManifestFilename: "hero-runtime.json" });
  assert.deepEqual(result, { ok: false, message: "sheet failed" });
  assert.equal(wrote, false);
});
