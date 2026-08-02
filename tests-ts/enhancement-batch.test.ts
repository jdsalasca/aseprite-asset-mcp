import assert from "node:assert/strict";
import test from "node:test";
import type { AssetOperationResult } from "../src/domain/asset-operations.js";
import type { EnhancementBatchResult } from "../src/domain/enhancement.js";
import { EnhancementBatchService } from "../src/application/services/EnhancementBatchService.js";

function success(filename: string, outputFilename: string, planId = "plan-1"): AssetOperationResult {
  return { ok: true, message: JSON.stringify({ operation: "apply_enhancement_bundle", plan: { planId }, applied: { planId, outputFilename, frames: 1, passesApplied: ["cleanup"] }, quality: { valid: true, violations: [] }, deterministic: true, sourcePreserved: true }) };
}

test("enhancement batch preserves order and isolates one failed asset", async () => {
  const calls: string[] = [];
  const service = new EnhancementBatchService({ apply: async (input) => { calls.push(input.filename); return input.filename === "broken.png" ? { ok: false, message: "decode failed" } : success(input.filename, input.outputFilename); } });
  const response = await service.apply({ items: [{ filename: "hero.png", outputFilename: "hero-out.png", format: "png" }, { filename: "broken.png", outputFilename: "broken-out.png", format: "png" }, { filename: "oak.png", outputFilename: "oak-out.gif", format: "gif" }], goals: ["cleanup"], seed: 9 });
  assert.equal(response.ok, false);
  assert.deepEqual(calls, ["hero.png", "broken.png", "oak.png"]);
  const payload = JSON.parse(response.message) as EnhancementBatchResult;
  assert.deepEqual(payload.summary, { total: 3, succeeded: 2, failed: 1 });
  assert.equal(payload.items[1]?.error, "decode failed");
  assert.equal(payload.items[2]?.ok, true);
  assert.equal(payload.deterministic, true);
  assert.equal(payload.sourcePreserved, true);
});

test("enhancement batch fails before delegating on cross-item source/output collisions", async () => {
  let delegated = false;
  const service = new EnhancementBatchService({ apply: async () => { delegated = true; return success("a.png", "a-out.png"); } });
  const response = await service.apply({ items: [{ filename: "a.png", outputFilename: "a-out.png", format: "png" }, { filename: "b.png", outputFilename: "a.png", format: "png" }] });
  assert.equal(response.ok, false);
  assert.match(response.message, /overwrite any source/);
  assert.equal(delegated, false);
});

test("enhancement batch rejects duplicate sources and unsupported sizes", async () => {
  const service = new EnhancementBatchService({ apply: async () => success("a.png", "out.png") });
  const duplicate = await service.apply({ items: [{ filename: "a.png", outputFilename: "one.png", format: "png" }, { filename: "A.PNG", outputFilename: "two.png", format: "png" }] });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.message, /Duplicate enhancement source/);
  const oversized = await service.apply({ items: Array.from({ length: 25 }, (_, index) => ({ filename: `a-${index}.png`, outputFilename: `out-${index}.png`, format: "png" as const })) });
  assert.equal(oversized.ok, false);
  assert.match(oversized.message, /more than 24/);
});
