import assert from "node:assert/strict";
import test from "node:test";
import { AsepriteCliGateway } from "../src/infrastructure/aseprite/AsepriteCliGateway.js";

const gateway = new AsepriteCliGateway({ executable: "aseprite-test-double" });

test("rejects traversal in every input sprite path before starting Aseprite", async () => {
  const results = await Promise.all([
    gateway.addGroup("../sprite.aseprite", "Group"),
    gateway.addLayer("../sprite.aseprite", "Layer"),
    gateway.drawRectangle("../sprite.aseprite", 0, 0, 1, 1, "#112233", true),
    gateway.addFrame("../sprite.aseprite"),
    gateway.addFrames("../sprite.aseprite", 1),
    gateway.setFrame("../sprite.aseprite", 1),
    gateway.setFrameDuration("../sprite.aseprite", 1, 100),
    gateway.setFrameDurationAll("../sprite.aseprite", 100),
    gateway.setLayerVisibility("../sprite.aseprite", "Layer"),
    gateway.setLayerOpacity("../sprite.aseprite", "Layer", 255),
    gateway.setPalette("../sprite.aseprite", ["#112233"]),
    gateway.setTag("../sprite.aseprite", "idle", 1, 1),
    gateway.createTilemapLayer("../sprite.aseprite", "Tiles", 16, 16),
    gateway.validateScene("../sprite.aseprite", ["Layer"]),
  ]);

  for (const result of results) {
    assert.equal(result.ok, false);
    assert.equal(result.message, "Parent directory traversal is not allowed");
  }
});

test("rejects invalid hexadecimal palette colors before starting Aseprite", async () => {
  const result = await gateway.setPalette("sprite.aseprite", ["#12GG34"]);

  assert.equal(result.ok, false);
  assert.equal(result.message, "Colors must use hexadecimal values");
});

test("rejects invalid drawing dimensions and colors before starting Aseprite", async () => {
  const invalidDimensions = await gateway.drawRectangle("sprite.aseprite", 0, 0, 1.5, 2, "#112233");
  const invalidColor = await gateway.drawRectangle("sprite.aseprite", 0, 0, 2, 2, "#12GG34");

  assert.equal(invalidDimensions.message, "Width and height must be positive integers");
  assert.equal(invalidColor.message, "Colors must use hexadecimal values");
});

test("rejects invalid tag frame ranges before starting Aseprite", async () => {
  const result = await gateway.setTag("sprite.aseprite", "idle", 0, 2);

  assert.equal(result.ok, false);
  assert.equal(result.message, "Frame range must start at 1 and end at or after the start");
});

test("rejects invalid scene frame ranges before starting Aseprite", async () => {
  const result = await gateway.validateScene("sprite.aseprite", ["Layer"], 3, 2);

  assert.equal(result.ok, false);
  assert.equal(result.message, "Frame range must start at 1 and end at or after the start");
});

test("rejects invalid spritesheet export options before starting Aseprite", async () => {
  const result = await gateway.exportSpritesheet({
    filename: "sprite.aseprite",
    outputFilename: "sprite.png",
    sheetType: "invalid",
    dataFormat: "invalid",
    scale: 0,
    padding: -1,
  });

  assert.equal(result.ok, false);
  assert.equal(result.message, "Unsupported spritesheet type: invalid");
});

test("rejects a successful Aseprite exit when the spritesheet file is missing", async () => {
  const result = await new AsepriteCliGateway({
    executable: "unused",
    commandRunner: async () => ({ ok: true, output: "" }),
  }).exportSpritesheet({
    filename: "sprite.aseprite",
    outputFilename: "missing.png",
  });

  assert.equal(result.ok, false);
  assert.equal(result.message, "Aseprite exited successfully but did not create the spritesheet");
});
