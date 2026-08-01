import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AsepriteCliGateway } from "../../src/infrastructure/aseprite/AsepriteCliGateway.js";

const defaultAsepritePath = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Aseprite\\Aseprite.exe";
const asepritePath = process.env.ASEPRITE_PATH ?? defaultAsepritePath;

test("real Aseprite completes the core asset workflow", { skip: !existsSync(asepritePath) }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-mcp-integration-"));
  const source = path.join(directory, "hero.aseprite");
  const sheet = path.join(directory, "hero.png");
  const metadata = path.join(directory, "hero.json");
  const gateway = new AsepriteCliGateway({ executable: asepritePath });

  try {
    const steps = [
      await gateway.createCanvas(16, 16, source),
      await gateway.addGroup(source, "Character"),
      await gateway.addLayer(source, "body", "Character"),
      await gateway.drawRectangle(source, 2, 2, 8, 8, "#112233", true),
      await gateway.drawPixels(source, [{ x: 3, y: 3, color: "#abcdef" }, { x: 4, y: 3, color: "123" }]),
      await gateway.drawLine(source, 1, 1, 12, 12, "#445566", 2),
      await gateway.fillArea(source, 0, 0, "#171717"),
      await gateway.drawCircle(source, 8, 8, 3, "#f0f0f0", true),
      await gateway.addFrame(source),
      await gateway.addFrames(source, 2, 120),
      await gateway.drawPixelsAt(source, "body", 2, [{ x: 2, y: 2, color: "#ffffff" }, { x: 3, y: 2, color: "#abc" }], true),
      await gateway.drawLineAt(source, "body", 2, 1, 1, 10, 10, "#123456", 1, true),
      await gateway.drawRectangleAt(source, "body", 2, 4, 4, 5, 5, "#654321", true, true),
      await gateway.fillAreaAt(source, "body", 2, 0, 0, "#222222", true),
      await gateway.drawCircleAt(source, "body", 2, 8, 8, 2, "#fed", false, true),
      await gateway.drawPolygon(source, "body", 2, [{ x: 2, y: 12 }, { x: 6, y: 8 }, { x: 10, y: 12 }], "#ff8800", true, true),
      await gateway.drawPath(source, "body", 2, [{ x: 1, y: 14 }, { x: 8, y: 10 }, { x: 14, y: 14 }], "#00ff00", 1, true),
      await gateway.applyGradientRect(source, "body", 2, 2, 2, 8, 4, "#0000ff", "#ff00ff", true, true),
      await gateway.setFrame(source, 2),
      await gateway.setFrameDuration(source, 2, 150),
      await gateway.setFrameDurationAll(source, 120),
      await gateway.setLayerVisibility(source, "body", true),
      await gateway.setLayerOpacity(source, "body", 220),
      await gateway.setPalette(source, ["112233", "#abcdef"]),
      await gateway.setTag(source, "idle", 1, 3),
      await gateway.validateScene(source, ["body"], 1, 3),
      await gateway.exportSpritesheet({
        filename: source,
        outputFilename: sheet,
        dataFilename: metadata,
        listTags: true,
      }),
    ];
    for (const step of steps) assert.equal(step.ok, true, step.message);
    const missingCel = await gateway.drawPixelsAt(source, "body", 3, [{ x: 0, y: 0, color: "#ffffff" }], false);
    assert.equal(missingCel.ok, false);
    assert.equal(missingCel.message, "Cel not found");
    assert.equal(existsSync(source), true);
    assert.equal(existsSync(sheet), true);
    assert.equal(existsSync(metadata), true);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
