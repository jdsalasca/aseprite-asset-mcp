import assert from "node:assert/strict";
import test from "node:test";
import { buildOdiseumStyleManifest } from "../src/workflows/odiseum-style.js";

test("Odiseum style keeps one shared palette and a four-frame idle loop", () => {
  const manifest = buildOdiseumStyleManifest();

  assert.equal(manifest.nearestFilter, true);
  assert.equal(manifest.pixelScale, 3);
  assert.equal(manifest.animations[0]?.name, "idle");
  assert.deepEqual(manifest.animations[0] && [manifest.animations[0].fromFrame, manifest.animations[0].toFrame], [1, 4]);
  assert.ok(manifest.palette.includes("#17152E"));
  assert.ok(manifest.palette.includes("#F5D76E"));
  assert.equal(manifest.worldProps.frameCount, 6);
  assert.equal(manifest.worldProps.frameSize, 32);
  assert.deepEqual([manifest.portalAnimation.fromFrame, manifest.portalAnimation.toFrame], [1, 4]);
  assert.equal(manifest.starfallCrystal.frameCount, 4);
  assert.equal(manifest.reusableLibrary.name, "odiseum-cozy-kit");
  assert.equal(manifest.reusableLibrary.frameCount, 8);
  assert.equal(manifest.reusableLibrary.frameSize, 48);
  assert.equal(manifest.reusableLibrary.exportScale, 2);
});
