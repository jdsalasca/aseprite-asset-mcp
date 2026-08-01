import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filename);
    return entry.name.endsWith(".ts") ? [filename] : [];
  }));
  return nested.flat();
}

test("generic domain boundaries do not expose runtime-specific contract names", async () => {
  const root = path.resolve("src");
  const files = (await sourceFiles(root)).filter((filename) => !filename.endsWith("AsepriteCliGateway.ts"));
  const forbidden = /\b(?:AsepriteGateway|AsepriteResult)\b|domain[\\/]aseprite\.js/;
  const violations: string[] = [];

  for (const filename of files) {
    const contents = await readFile(filename, "utf8");
    if (forbidden.test(contents)) violations.push(path.relative(root, filename));
  }

  assert.deepEqual(violations, []);
});
