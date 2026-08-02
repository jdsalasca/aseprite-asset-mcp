import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FileAssetManifestAuditAdapter } from "../src/infrastructure/assets/FileAssetManifestAuditAdapter.js";

test("reads a manifest, hashes existing artifacts, and reports missing files", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "manifest-audit-test-"));
  try {
    const manifest = path.join(directory, "scene.json");
    const output = path.join(directory, "scene.png");
    await fs.writeFile(output, Buffer.from([1, 2, 3]));
    await fs.writeFile(manifest, JSON.stringify({ output, artifacts: [{ outputFilename: path.join(directory, "missing.gif") }] }));
    const adapter = new FileAssetManifestAuditAdapter([directory]);
    assert.deepEqual(await adapter.readManifest(manifest), { output, artifacts: [{ outputFilename: path.join(directory, "missing.gif") }] });
    assert.equal((await adapter.inspectArtifact(output)).sizeBytes, 3);
    assert.equal((await adapter.inspectArtifact(path.join(directory, "missing.gif"))).exists, false);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("rejects artifacts outside the configured root", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "manifest-audit-root-"));
  try { await assert.rejects(() => new FileAssetManifestAuditAdapter([directory]).inspectArtifact(path.join(os.tmpdir(), "outside.png")), /outside allowed roots/); }
  finally { await fs.rm(directory, { recursive: true, force: true }); }
});
