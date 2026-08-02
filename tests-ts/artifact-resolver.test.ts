import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { FileAssetArtifactResolver } from "../src/infrastructure/jobs/FileAssetArtifactResolver.js";

test("file artifact resolver records deterministic metadata", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".artifact-test-"));
  const output = path.join(directory, "sprite.GIF");
  await writeFile(output, Buffer.from("pixel-art"));
  const resolver = new FileAssetArtifactResolver(() => "2026-08-02T00:00:00.000Z");

  const [artifact] = await resolver.resolve("job_hash", { jobs: [{ recipe: "gif", inputFilenames: ["source.png"], outputFilename: output }], dryRun: false });

  assert.equal(artifact?.jobId, "job_hash");
  assert.equal(artifact?.format, "gif");
  assert.equal(artifact?.sizeBytes, 9);
  assert.equal(artifact?.sha256, "c34b4a0d0888dc4635e11d52fed9d1848320fb9f7af4a8f8df23a55c5e237f72");
  assert.equal(artifact?.createdAt, "2026-08-02T00:00:00.000Z");
});

test("file artifact resolver fails when a successful job output is missing", async () => {
  const resolver = new FileAssetArtifactResolver();
  await assert.rejects(() => resolver.resolve("job_missing", { jobs: [{ recipe: "gif", inputFilenames: ["source.png"], outputFilename: path.join(process.cwd(), ".missing-output.gif") }], dryRun: false }));
});
