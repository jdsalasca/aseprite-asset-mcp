import assert from "node:assert/strict";
import test from "node:test";
import { buildCharacterPlan, buildScenePlan } from "../src/workflows/plans.js";

test("character plan creates a layered animation workflow and Godot manifest", () => {
  const plan = buildCharacterPlan({ assetId: "Moon Hero" });
  assert.equal(plan.kind, "character");
  assert.equal(plan.assetId, "moon-hero");
  assert.deepEqual(plan.godotManifest.animations.map((animation) => animation.name), ["idle", "walk", "attack"]);
  assert.equal(plan.calls[0]?.name, "create_canvas");
  assert.ok(plan.calls.some((call) => call.name === "add_group" && call.arguments.group_name === "Character"));
  assert.ok(plan.calls.some((call) => call.name === "set_tag" && call.arguments.name === "walk"));
  assert.ok(plan.calls.some((call) => call.name === "validate_scene"));
  assert.ok(plan.calls.filter((call) => call.name === "export_spritesheet").length >= 4);
});

test("scene plan includes a tilemap and deterministic scene layers", () => {
  const plan = buildScenePlan({ assetId: "Old Harbor", tileWidth: 32, tileHeight: 16 });
  assert.equal(plan.kind, "scene");
  assert.equal(plan.assetId, "old-harbor");
  assert.equal(plan.calls.find((call) => call.name === "create_tilemap_layer")?.arguments.tile_width, 32);
  assert.deepEqual(plan.godotManifest.animations.map((animation) => animation.name), ["day"]);
  assert.match(String(plan.godotManifest.texture), /old-harbor\.png$/);
});

test("invalid specs fail before an MCP process can be started", () => {
  assert.throws(() => buildCharacterPlan({ assetId: "", width: 0 }), /assetId/);
  assert.throws(() => buildScenePlan({ assetId: "map", animations: [{ name: "broken", fromFrame: 3, toFrame: 1 }] }), /invalid frame range/);
});

test("workflow plans reject blank layer names before execution", () => {
  assert.throws(() => buildCharacterPlan({ assetId: "hero", layers: ["body", ""] }), /layer name cannot be empty/);
  assert.throws(() => buildScenePlan({ assetId: "harbor", layers: ["background", "   "] }), /layer name cannot be empty/);
});
