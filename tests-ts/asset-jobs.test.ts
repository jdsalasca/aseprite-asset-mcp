import assert from "node:assert/strict";
import test from "node:test";
import { AssetJobService } from "../src/application/services/AssetJobService.js";
import { InMemoryAssetJobStore } from "../src/infrastructure/jobs/InMemoryAssetJobStore.js";

test("asset jobs transition asynchronously and keep compact outcomes", async () => {
  const store = new InMemoryAssetJobStore();
  const service = new AssetJobService({ run: async () => ({ ok: true, message: "created 2 artifacts" }) }, store, { next: () => "job_test" });
  const started = await service.start({ jobs: [{ recipe: "gif", inputFilenames: ["input.png"], outputFilename: "output.gif" }], dryRun: false });
  assert.equal(started.status, "queued");
  await new Promise<void>((resolve) => setImmediate(resolve));
  const completed = await service.get("job_test");
  assert.equal(completed?.status, "completed");
  assert.deepEqual(completed?.outcome, { ok: true, message: "created 2 artifacts" });
});

test("cancellation wins over a late runner result", async () => {
  const store = new InMemoryAssetJobStore();
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const service = new AssetJobService({ run: async () => { await waiting; return { ok: true, message: "late" }; } }, store, { next: () => "job_cancel" });
  await service.start({ jobs: [{ recipe: "atlas", inputFilenames: ["input.png"] }], dryRun: false });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const cancelled = await service.cancel("job_cancel");
  assert.equal(cancelled?.status, "cancelled");
  release();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal((await service.get("job_cancel"))?.status, "cancelled");
});
