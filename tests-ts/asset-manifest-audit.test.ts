import assert from "node:assert/strict";
import test from "node:test";
import { AssetManifestAuditService } from "../src/application/services/AssetManifestAuditService.js";

test("audits referenced artifacts deterministically and reports missing and empty files", async () => {
  const service = new AssetManifestAuditService({
    readManifest: async () => ({ output: "out/scene.png", artifacts: [{ outputFilename: "out/scene.gif" }, { outputFilename: "out/empty.json" }] }),
    inspectArtifact: async (filename) => filename.endsWith("scene.png") ? { exists: true, sizeBytes: 4, format: "png", sha256: "a" } : filename.endsWith("empty.json") ? { exists: true, sizeBytes: 0, format: "json", sha256: "b" } : { exists: false, sizeBytes: 0, format: "gif", sha256: null },
  });
  const result = await service.audit({ manifestFilename: "out/scene.json" });
  assert.equal(result.ok, true);
  const payload = JSON.parse(result.message) as { valid: boolean; totalArtifacts: number; missingArtifacts: number; emptyArtifacts: number; artifacts: Array<{ filename: string; status: string }> };
  assert.equal(payload.valid, false);
  assert.equal(payload.totalArtifacts, 3);
  assert.equal(payload.missingArtifacts, 1);
  assert.equal(payload.emptyArtifacts, 1);
  assert.deepEqual(payload.artifacts.map((artifact) => artifact.filename), ["out/empty.json", "out/scene.gif", "out/scene.png"]);
});

test("fails closed for unsafe paths and manifests without output references", async () => {
  const service = new AssetManifestAuditService({ readManifest: async () => ({ output: "../escape.png" }), inspectArtifact: async () => ({ exists: true, sizeBytes: 1, format: "png", sha256: "x" }) });
  assert.match((await service.audit({ manifestFilename: "out/scene.json" })).message, /unsafe/);
  const empty = new AssetManifestAuditService({ readManifest: async () => ({ operation: "noop" }), inspectArtifact: async () => ({ exists: true, sizeBytes: 1, format: "png", sha256: "x" }) });
  assert.match((await empty.audit({ manifestFilename: "out/scene.json" })).message, /no auditable/);
});
