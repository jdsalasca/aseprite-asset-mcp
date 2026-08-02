import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("effects showcase manifest stays portable and source-preserving", async () => {
  const manifestFilename = path.join(process.cwd(), "examples", "effects", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestFilename, "utf8")) as { source: string; outputs: string[]; operations: Array<{ input?: string; output?: string; sourcePreserved?: boolean }> };

  assert.equal(manifest.source, "hero-base.png");
  assert.deepEqual(manifest.outputs, ["hero-outline.png", "hero-color-grade.png", "hero-shadow.png", "hero-normal-map.png", "hero-particles.gif"]);
  assert.ok(manifest.operations.every((operation) => !operation.input?.includes(process.cwd()) && !operation.output?.includes(process.cwd())));
  assert.ok(manifest.operations.filter((operation) => operation.sourcePreserved !== undefined).every((operation) => operation.sourcePreserved === true));
});
