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
    assert.equal(existsSync(source), true);
    assert.equal(existsSync(sheet), true);
    assert.equal(existsSync(metadata), true);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
