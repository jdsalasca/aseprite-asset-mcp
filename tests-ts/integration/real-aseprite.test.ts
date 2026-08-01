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
  const exportedSprite = path.join(directory, "hero-copy.png");
  const copiedSprite = path.join(directory, "hero-copy.aseprite");
  const exportedFrame = path.join(directory, "hero-frame.png");
  const exportedLayers = path.join(directory, "layers");
  const exportedTag = path.join(directory, "hero-idle.gif");
  const onionRender = path.join(directory, "hero-onion.png");
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
      await gateway.drawEllipseAt(source, "body", 2, 8, 8, 4, 2, "#ffffff", false, true),
      await gateway.exportSprite(source, exportedSprite, "png"),
      await gateway.copySprite(source, copiedSprite),
      await gateway.exportFrame(source, 2, exportedFrame, 2),
      await gateway.exportLayers(source, exportedLayers),
      await gateway.importImageAsLayer(source, exportedFrame, "reference", 1, 0, 0),
      await gateway.createCel(source, "reference", 3, 1, 1),
      await gateway.copyCel(source, "body", 2, 3, true),
      await gateway.copyFrame(source, 2, 4, true),
      await gateway.clearCel(source, "reference", 3),
      await gateway.setCelPosition(source, "body", 2, 5, 5, true),
      await gateway.tweenCelPositions(source, "body", 2, 4, 2, 2, 6, 6, false),
      await gateway.offsetCelPositions(source, "body", 2, 4, 1, -1),
      await gateway.propagateFrameToRange(source, 2, 1, 4, true),
      await gateway.setFrame(source, 2),
      await gateway.setFrameDuration(source, 2, 150),
      await gateway.setFrameDurationAll(source, 120),
      await gateway.setLayerVisibility(source, "body", true),
      await gateway.setLayerOpacity(source, "body", 220),
      await gateway.setPalette(source, ["112233", "#abcdef"]),
      await gateway.setTag(source, "idle", 1, 3),
      await gateway.exportTag(source, "idle", exportedTag),
      await gateway.deleteTag(source, "idle"),
      await gateway.deleteFrame(source, 4),
      await gateway.setOnionSkin(source, true, 2, 2, 128),
      await gateway.renderOnionSkin(source, 2, onionRender, 1, 1, 2, 100),
      await gateway.setCelOpacity(source, "body", 2, 200),
      await gateway.outlineNative(source, "body", 2, "#00ff00", "outside", "circle"),
      await gateway.adjustHslNative(source, "body", 2, 5, 0, 0),
      await gateway.adjustBrightnessContrast(source, "body", 2, 0, 0),
      await gateway.invertColors(source, "body", 2),
      await gateway.listConvolutionMatrices(),
      await gateway.applyConvolution(source, "blur-3x3", "body", 2),
      await gateway.applyDitherGradient(source, "body", 2, 2, 2, 6, 4, "#000000", "#ffffff", true, true),
      await gateway.applyDitherPattern(source, "body", 2, 8, 8, 4, 4, "#112233", "#abcdef", 0.5, true),
      await gateway.validateScene(source, ["body"], 1, 3),
      await gateway.exportSpritesheet({
        filename: source,
        outputFilename: sheet,
        dataFilename: metadata,
        listTags: true,
      }),
    ];
    for (const step of steps) assert.equal(step.ok, true, step.message);
    const matricesResult = await gateway.listConvolutionMatrices();
    assert.equal(matricesResult.ok, true, matricesResult.message);
    const matrices = JSON.parse(matricesResult.message) as string[];
    assert.ok(matrices.includes("blur-3x3"));
    const comparison = await gateway.compareFrames(source, 1, 2);
    assert.equal(comparison.ok, true, comparison.message);
    const metrics = JSON.parse(comparison.message) as { changedPixels?: number; totalPixels?: number; bounds?: unknown };
    assert.equal(typeof metrics.changedPixels, "number");
    assert.equal(typeof metrics.totalPixels, "number");
    const stats = await gateway.getColorStats(source, 2, 4);
    assert.equal(stats.ok, true, stats.message);
    assert.equal(typeof (JSON.parse(stats.message) as { uniqueColors?: number }).uniqueColors, "number");
    const palette = await gateway.getPalette(source);
    assert.equal(palette.ok, true, palette.message);
    assert.ok(Array.isArray(JSON.parse(palette.message)));
    const extracted = await gateway.extractPalette(source, 8, false);
    assert.equal(extracted.ok, true, extracted.message);
    assert.equal(typeof (JSON.parse(extracted.message) as { count?: number }).count, "number");
    const missingCel = await gateway.drawPixelsAt(source, "reference", 3, [{ x: 0, y: 0, color: "#ffffff" }], false);
    assert.equal(missingCel.ok, false);
    assert.equal(missingCel.message, "Cel not found");
    assert.equal(existsSync(source), true);
    assert.equal(existsSync(sheet), true);
    assert.equal(existsSync(metadata), true);
    assert.equal(existsSync(exportedSprite), true);
    assert.equal(existsSync(copiedSprite), true);
    assert.equal(existsSync(exportedFrame), true);
    assert.ok(existsSync(exportedLayers));
    assert.equal(existsSync(exportedTag), true);
    assert.equal(existsSync(onionRender), true);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
