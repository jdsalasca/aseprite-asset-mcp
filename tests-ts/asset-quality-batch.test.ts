import assert from "node:assert/strict";
import test from "node:test";
import type { AssetOperationResult } from "../src/domain/asset-operations.js";
import { AssetBatchQualityService } from "../src/application/services/AssetBatchQualityService.js";

function qualityResult(filename: string, valid: boolean): AssetOperationResult {
  return {
    ok: valid,
    message: JSON.stringify({
      operation: "inspect_asset_bundle",
      filename,
      inspection: { frameCount: 2, width: 16, height: 16, totalColors: valid ? 8 : 80, reports: [], delaysMs: [90, 90] },
      quality: { valid, maxColors: 32, maxIsolatedPixels: 4, violations: valid ? [] : [`frame 1: 80 colors > 32`] },
      recommendations: valid ? ["Asset passes the requested compact quality checks."] : ["Reduce the palette before export."],
      deterministic: true,
      sourcePreserved: true,
    }),
  };
}

test("batch quality inspects ordered assets once and returns a compact summary", async () => {
  const calls: string[] = [];
  const service = new AssetBatchQualityService({
    qualityBundle: async ({ filename }) => {
      calls.push(filename);
      return qualityResult(filename, filename.endsWith("good.png"));
    },
  });

  const result = await service.inspect({ filenames: ["hero-good.png", "hero-bad.png"], maxColors: 32, maxIsolatedPixels: 4 });
  assert.equal(result.ok, false);
  const payload = JSON.parse(result.message) as { operation: string; assets: Array<{ filename: string; valid: boolean }>; summary: { total: number; valid: number; invalid: number; failed: number }; deterministic: true; sourcePreserved: true };
  assert.equal(payload.operation, "inspect_asset_batch");
  assert.deepEqual(calls, ["hero-good.png", "hero-bad.png"]);
  assert.deepEqual(payload.assets.map((asset) => [asset.filename, asset.valid]), [["hero-good.png", true], ["hero-bad.png", false]]);
  assert.deepEqual(payload.summary, { total: 2, valid: 1, invalid: 1, failed: 0 });
  assert.equal(payload.deterministic, true);
  assert.equal(payload.sourcePreserved, true);
});

test("batch quality isolates decode failures and rejects unsafe or duplicate input", async () => {
  const service = new AssetBatchQualityService({ qualityBundle: async () => ({ ok: false, message: "decoder unavailable" }) });
  const failed = await service.inspect({ filenames: ["good.png", "broken.png"] });
  const payload = JSON.parse(failed.message) as { summary: { total: number; valid: number; invalid: number; failed: number }; assets: Array<{ error?: string; valid: boolean }> };
  assert.equal(payload.summary.failed, 2);
  assert.equal(payload.assets[0]?.valid, false);
  assert.match(payload.assets[0]?.error ?? "", /decoder unavailable/);
  const empty = await service.inspect({ filenames: [] });
  assert.equal(empty.ok, false);
  assert.match(empty.message, /at least one/i);
  const duplicate = await service.inspect({ filenames: ["A.png", "a.PNG"] });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.message, /duplicate/i);
  const nullByte = await service.inspect({ filenames: ["safe.png", "bad\0.png"] });
  assert.equal(nullByte.ok, false);
  assert.match(nullByte.message, /null/);
});
