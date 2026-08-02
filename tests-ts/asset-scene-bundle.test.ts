import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { AssetSceneBundleService } from "../src/application/services/AssetSceneBundleService.js";

const staticPayload = { operation: "compose_asset_scene", output: "out/bundle/scene.png", manifest: "out/bundle/scene.json", libraryVersion: "v1", itemIds: ["oak"], width: 64, height: 64, padding: 2, layers: [], deterministic: true, sourcePreserved: true } as const;
const animationPayload = { operation: "compose_asset_scene_animation", output: "out/bundle/scene.gif", manifest: "out/bundle/scene-animation.json", libraryVersion: "v1", itemIds: ["oak"], width: 64, height: 64, padding: 2, frames: 8, delayMs: 90, frameLayers: [], deterministic: true, sourcePreserved: true } as const;

test("builds static and animated scene outputs through existing composers", async () => {
  const calls: string[] = [];
  const service = new AssetSceneBundleService({ compose: async (input) => { calls.push(`static:${input.outputFilename}`); return { ok: true, message: JSON.stringify(staticPayload) }; } }, { compose: async (input) => { calls.push(`animation:${input.outputFilename}`); return { ok: true, message: JSON.stringify(animationPayload) }; } });
  const result = await service.build({ itemIds: ["oak"], outputPrefix: "out/bundle", width: 64, height: 64, padding: 2, frames: 8, delayMs: 90 });
  assert.equal(result.ok, true);
  const payload = JSON.parse(result.message) as { operation: string; static: { output: string }; animation: { output: string }; deterministic: boolean };
  assert.equal(payload.operation, "build_scene_bundle"); assert.equal(payload.static.output, staticPayload.output); assert.equal(payload.animation.output, animationPayload.output); assert.deepEqual(calls, [`static:${path.join("out/bundle", "scene.png")}`, `animation:${path.join("out/bundle", "scene.gif")}`]); assert.equal(payload.deterministic, true);
});

test("fails before composing unsafe or duplicate requests and stops after static failure", async () => {
  let calls = 0;
  const service = new AssetSceneBundleService({ compose: async () => { calls += 1; return { ok: false, message: "collision" }; } }, { compose: async () => { calls += 1; return { ok: true, message: JSON.stringify(animationPayload) }; } });
  assert.match((await service.build({ itemIds: ["oak", "OAK"], outputPrefix: "out", width: 64, height: 64, frames: 4 })).message, /unique/);
  assert.match((await service.build({ itemIds: ["oak"], outputPrefix: "../out", width: 64, height: 64, frames: 4 })).message, /unsafe/);
  assert.match((await service.build({ itemIds: ["oak"], outputPrefix: "out", width: 64, height: 64, frames: 4 })).message, /Static scene composition failed/);
  assert.equal(calls, 1);
});
