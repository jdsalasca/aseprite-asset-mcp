import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SERVER_VERSION } from "../src/domain/server-version.js";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

test("the reported server version comes from package.json so it can never drift", () => {
  assert.equal(SERVER_VERSION, packageJson.version);
});