import assert from "node:assert/strict";
import test from "node:test";
import { AssetJobService } from "../src/application/services/AssetJobService.js";
import type { AssetArtifact, AssetJobRecord, AssetJobStatus } from "../src/domain/asset-jobs.js";
import type { AssetArtifactResolverPort, AssetJobStorePort } from "../src/application/ports/AssetJobPorts.js";
import { InMemoryAssetJobStore } from "../src/infrastructure/jobs/InMemoryAssetJobStore.js";

test("asset jobs transition asynchronously and keep compact outcomes", async () => {
  const store = new InMemoryAssetJobStore();
  const service = new AssetJobService({ run: async () => ({ ok: true, message: "created 2 artifacts" }) }, store, { ids: { next: () => "job_test" } });
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
  const service = new AssetJobService({ run: async () => { await waiting; return { ok: true, message: "late" }; } }, store, { ids: { next: () => "job_cancel" } });
  await service.start({ jobs: [{ recipe: "atlas", inputFilenames: ["input.png"] }], dryRun: false });
  await new Promise<void>((resolve) => setImmediate(resolve));
  const cancelled = await service.cancel("job_cancel");
  assert.equal(cancelled?.status, "cancelled");
  release();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal((await service.get("job_cancel"))?.status, "cancelled");
});

test("cancellation cannot be overwritten while the worker starts", async () => {
  let entered!: () => void;
  const enteredGate = new Promise<void>((resolve) => { entered = resolve; });
  let release!: () => void;
  const releaseGate = new Promise<void>((resolve) => { release = resolve; });
  const base = new InMemoryAssetJobStore();
  const store: AssetJobStorePort = {
    get: (id) => base.get(id),
    save: (record) => base.save(record),
    updateIfStatus: async (id: string, expected: AssetJobStatus | readonly AssetJobStatus[], patch: Partial<Omit<AssetJobRecord, "id" | "jobs" | "createdAt">>) => {
      if (patch.status === "running") { entered(); await releaseGate; }
      return base.updateIfStatus(id, expected, patch);
    },
  };
  const service = new AssetJobService({ run: async () => ({ ok: true, message: "must not run" }) }, store, { ids: { next: () => "job_race" } });

  await service.start({ jobs: [{ recipe: "gif", inputFilenames: ["input.png"] }], dryRun: false });
  await enteredGate;
  const cancelled = await service.cancel("job_race");
  assert.equal(cancelled?.status, "cancelled");
  release();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal((await service.get("job_race"))?.status, "cancelled");
});

test("job state and input are isolated from caller mutations", async () => {
  const store = new InMemoryAssetJobStore();
  let observedInput!: AssetJobRecord["jobs"];
  const service = new AssetJobService({
    run: async (input) => {
      observedInput = input.jobs;
      return { ok: true, message: "isolated" };
    },
  }, store, { ids: { next: () => "job_isolated" } });
  const input = { jobs: [{ recipe: "gif" as const, inputFilenames: ["source.png"] }], dryRun: false };

  const started = await service.start(input);
  started.jobs[0]!.inputFilenames[0] = "mutated-after-start.png";
  input.jobs[0]!.inputFilenames[0] = "mutated-input.png";

  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal((await service.get("job_isolated"))?.jobs[0]?.inputFilenames[0], "source.png");
  assert.equal(observedInput[0]?.inputFilenames[0], "source.png");
});

test("persists resolved artifact metadata after a successful job", async () => {
  const store = new InMemoryAssetJobStore();
  const artifact: AssetArtifact = {
    id: "artifact_job_artifacts_1",
    jobId: "job_artifacts",
    filename: "output.gif",
    format: "gif",
    sizeBytes: 42,
    sha256: "a".repeat(64),
    createdAt: "2026-08-02T00:00:00.000Z",
  };
  const resolver: AssetArtifactResolverPort = { resolve: async () => [artifact] };
  const service = new AssetJobService({ run: async () => ({ ok: true, message: "created" }) }, store, {
    ids: { next: () => "job_artifacts" },
    artifactResolver: resolver,
  });

  await service.start({ jobs: [{ recipe: "gif", inputFilenames: ["input.png"], outputFilename: "output.gif" }], dryRun: false });
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.deepEqual((await service.get("job_artifacts"))?.artifacts, [artifact]);
});
