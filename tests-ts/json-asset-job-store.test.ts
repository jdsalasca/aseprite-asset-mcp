import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { JsonAssetJobStore } from "../src/infrastructure/jobs/JsonAssetJobStore.js";
import type { AssetJobRecord } from "../src/domain/asset-jobs.js";

function record(status: AssetJobRecord["status"] = "queued"): AssetJobRecord {
  return {
    id: "job_persisted",
    status,
    jobs: [{ recipe: "gif", inputFilenames: ["source.png"] }],
    createdAt: "now",
    updatedAt: "now",
    artifacts: [{ id: "artifact_1", jobId: "job_persisted", filename: "output.gif", format: "gif", sizeBytes: 42, sha256: "a".repeat(64), createdAt: "now" }],
  };
}

test("json job store recovers records after a new adapter instance", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "asset-job-store-"));
  const filename = path.join(directory, "jobs.json");
  const first = new JsonAssetJobStore(filename);
  await first.save(record());

  const second = new JsonAssetJobStore(filename);
  assert.deepEqual(await second.get("job_persisted"), record());
  assert.match(await readFile(filename, "utf8"), /job_persisted/);
});

test("json job store applies conditional transitions and rejects stale updates", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "asset-job-store-transition-"));
  const store = new JsonAssetJobStore(path.join(directory, "jobs.json"));
  await store.save(record());

  assert.equal(await store.updateIfStatus("job_persisted", "queued", { status: "cancelled", updatedAt: "later" }), true);
  assert.equal(await store.updateIfStatus("job_persisted", "queued", { status: "running", updatedAt: "stale" }), false);
  assert.equal((await store.get("job_persisted"))?.status, "cancelled");
});
