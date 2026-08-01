import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AsepriteCliGateway } from "../../src/infrastructure/aseprite/AsepriteCliGateway.js";

const defaultAsepritePath = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Aseprite\\Aseprite.exe";
const asepritePath = process.env.ASEPRITE_PATH ?? defaultAsepritePath;
const textFontPath = ["C:\\Windows\\Fonts\\arial.ttf", "C:\\Windows\\Fonts\\segoeui.ttf"].find((filename) => existsSync(filename));

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
      await gateway.outlineCel(source, "body", 2, "#00ff00", true),
      await gateway.replaceColor(source, "body", 2, "#00ff00", "#ff00ff", 0),
      await gateway.adjustHsl(source, "body", 2, 5, 0, 0),
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
      await gateway.addLayer(source, "scratch"),
      await gateway.renameLayer(source, "scratch", "scratch-renamed"),
      await gateway.duplicateLayer(source, "body", "body-copy"),
      await gateway.setLayerBlendMode(source, "body-copy", "multiply"),
      await gateway.mergeLayerDown(source, "body-copy"),
      await gateway.duplicateLayer(source, "body", "body-copy-reordered"),
      await gateway.reorderLayer(source, "body-copy-reordered", 1),
      await gateway.deleteLayer(source, "scratch-renamed"),
      await gateway.remapColorsInCelRange(source, "body", 1, 3, [{ from: "#112233", to: "#abcdef" }], true, 2),
      await gateway.listPalettePresets(),
      await gateway.applyPalettePreset(source, "gameboy"),
      await gateway.generateColorRamp("#D04648", 5, 20, 0.5),
      await gateway.quantizeToPalette(source, "body", 1, 3),
      await gateway.setColorMode(source, "grayscale"),
      await gateway.setColorMode(source, "rgb"),
      await gateway.getPixelColor(source, 2, 2, "body", 2),
      await gateway.getPixelsRect(source, 0, 0, 2, 2, "body", 2),
      await gateway.getCompositePixel(source, 2, 2, 2),
      await gateway.getCompositeRect(source, 0, 0, 2, 2, 2),
      await gateway.moveRegion(source, "body", 1, 0, 0, 2, 2, 2, 2),
      await gateway.copyRegion(source, "body", 1, 2, 2, 2, 2, 4, 4),
      await gateway.eraseRegion(source, "body", 1, 4, 4, 1, 1),
      await gateway.eraseColor(source, "body", 1, "#abcdef", 0),
    ];
    for (const [index, step] of steps.entries()) assert.equal(step.ok, true, `step ${index}: ${step.message}`);
    const matricesResult = await gateway.listConvolutionMatrices();
    assert.equal(matricesResult.ok, true, matricesResult.message);
    const matrices = JSON.parse(matricesResult.message) as string[];
    assert.ok(matrices.includes("blur-3x3"));
    const presets = await gateway.listPalettePresets();
    assert.equal(presets.ok, true, presets.message);
    assert.ok(JSON.parse(presets.message).gameboy);
    const ramp = await gateway.generateColorRamp("#D04648", 5);
    assert.equal(ramp.ok, true, ramp.message);
    assert.equal(JSON.parse(ramp.message).length, 5);
    const pixel = await gateway.getPixelColor(source, 2, 2, "body", 2);
    assert.equal(pixel.ok, true, pixel.message);
    assert.match(pixel.message, /^#[0-9a-f]{6} \(r=\d+, g=\d+, b=\d+, a=\d+\)$/);
    const pixels = await gateway.getPixelsRect(source, 0, 0, 2, 2, "body", 2);
    assert.equal(pixels.ok, true, pixels.message);
    assert.equal(JSON.parse(pixels.message).length, 4);
    const composite = await gateway.getCompositeRect(source, 0, 0, 2, 2, 2);
    assert.equal(composite.ok, true, composite.message);
    assert.equal(JSON.parse(composite.message).length, 4);
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
    const flattened = await gateway.flattenSprite(source);
    assert.equal(flattened.ok, true, flattened.message);
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

test("real Aseprite applies layer transforms without losing pixel data", { skip: !existsSync(asepritePath) }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-mcp-transform-"));
  const source = path.join(directory, "transform.aseprite");
  const gateway = new AsepriteCliGateway({ executable: asepritePath });
  const pixel = async (x: number, y: number) => {
    const result = await gateway.getPixelColor(source, x, y, "pixels", 1);
    assert.equal(result.ok, true, result.message);
    return result.message;
  };

  const created = await gateway.createCanvas(4, 2, source);
  assert.equal(created.ok, true, created.message);
  assert.equal((await gateway.addLayer(source, "pixels")).ok, true);
  assert.equal((await gateway.drawPixelsAt(source, "pixels", 1, [
    { x: 0, y: 0, color: "#ff0000" },
    { x: 1, y: 0, color: "#00ff00" },
    { x: 3, y: 1, color: "#0000ff" },
  ], true)).ok, true);

  assert.equal((await gateway.flipLayer(source, "pixels", 1, "horizontal")).ok, true);
  assert.match(await pixel(3, 0), /#ff0000/);
  assert.match(await pixel(2, 0), /#00ff00/);
  assert.match(await pixel(0, 1), /#0000ff/);

  assert.equal((await gateway.rotateLayer(source, "pixels", 1, 180)).ok, true);
  assert.match(await pixel(0, 1), /#ff0000/);
  assert.match(await pixel(1, 1), /#00ff00/);
  assert.match(await pixel(3, 0), /#0000ff/);

  assert.equal((await gateway.resizeCanvas(source, 6, 4)).ok, true);
  assert.equal((await gateway.cropCanvas(source, 1, 1, 4, 2)).ok, true);
});

test("real TypeScript text rasterizer measures and draws a system font", { skip: !existsSync(asepritePath) || !textFontPath }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-mcp-text-"));
  const source = path.join(directory, "text.aseprite");
  const gateway = new AsepriteCliGateway({ executable: asepritePath });
  const fonts = await gateway.listTextFonts();
  assert.equal(fonts.ok, true, fonts.message);
  assert.match(fonts.message, /System fonts/);
  const measured = await gateway.measureText("Aseprite", textFontPath as string, 8, 1, 1, false);
  assert.equal(measured.ok, true, measured.message);
  assert.match(measured.message, /width=\d+ height=\d+ advance_width=\d+/);
  assert.equal((await gateway.createCanvas(48, 24, source)).ok, true);
  assert.equal((await gateway.drawText({ filename: source, text: "A", x: 4, y: 4, font: textFontPath as string, size: 12, color: "#ff0000", layerName: "labels", anchor: "topleft", outlineColor: "#000000", shadowColor: "#0000ff", createIfMissing: true })).ok, true);
  const pixels = await gateway.getPixelsRect(source, 0, 0, 32, 24, "labels", 1);
  assert.equal(pixels.ok, true, pixels.message);
  const values = JSON.parse(pixels.message) as Array<{ r: number; g: number; b: number; a: number }>;
  assert.equal(values[0]?.a, 0);
  assert.ok(values.some((pixel) => pixel.r > 200 && pixel.g < 80 && pixel.b < 80 && pixel.a > 0));
});

test("real Aseprite creates, edits, places, and reads tilemap data", { skip: !existsSync(asepritePath) }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-mcp-tilemap-"));
  const source = path.join(directory, "tilemap.aseprite");
  const gateway = new AsepriteCliGateway({ executable: asepritePath });

  assert.equal((await gateway.createCanvas(16, 16, source)).ok, true);
  const created = await gateway.createTilemapLayer(source, "terrain", 4, 4);
  assert.equal(created.ok, true, created.message);
  const infoBefore = await gateway.getTilemapInfo(source, "terrain");
  assert.equal(infoBefore.ok, true, infoBefore.message);
  assert.deepEqual(JSON.parse(infoBefore.message), { tile_width: 4, tile_height: 4, tile_count: 0, map_cols: 4, map_rows: 4 });
  const drawn = await gateway.drawOnTile(source, "terrain", 1, [{ x: 0, y: 0, color: "#ff0000" }, { x: 3, y: 3, color: "#00ff00" }]);
  assert.equal(drawn.ok, true, drawn.message);
  const placed = await gateway.setTiles(source, "terrain", 1, [{ col: 0, row: 0, tileIndex: 1 }, { col: 3, row: 3, tileIndex: 1 }]);
  assert.equal(placed.ok, true, placed.message);
  const tile = await gateway.getTileAt(source, "terrain", 1, 3, 3);
  assert.equal(tile.ok, true, tile.message);
  assert.deepEqual(JSON.parse(tile.message), { col: 3, row: 3, tile_index: 1 });
  const infoAfter = await gateway.getTilemapInfo(source, "terrain");
  assert.equal(infoAfter.ok, true, infoAfter.message);
  assert.equal(JSON.parse(infoAfter.message).tile_count, 1);
});

test("real Aseprite creates, updates, lists, and deletes slices", { skip: !existsSync(asepritePath) }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-mcp-slices-"));
  const source = path.join(directory, "slices.aseprite");
  const gateway = new AsepriteCliGateway({ executable: asepritePath });

  assert.equal((await gateway.createCanvas(16, 16, source)).ok, true);
  assert.equal((await gateway.createSlice(source, "hud|panel", 1, 2, 8, 6)).ok, true);
  assert.equal((await gateway.setSliceCenter(source, "hud|panel", 2, 1, 4, 3)).ok, true);
  assert.equal((await gateway.setSlicePivot(source, "hud|panel", 3, 2)).ok, true);
  const listed = await gateway.listSlices(source);
  assert.equal(listed.ok, true, listed.message);
  assert.deepEqual(JSON.parse(listed.message), [{ name: "hud|panel", x: 1, y: 2, width: 8, height: 6, center: { x: 2, y: 1, width: 4, height: 3 }, pivot: { x: 3, y: 2 } }]);
  assert.equal((await gateway.deleteSlice(source, "hud|panel")).ok, true);
  assert.deepEqual(JSON.parse((await gateway.listSlices(source)).message), []);
});

test("real Aseprite audits and sanitizes animation cels", { skip: !existsSync(asepritePath) }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-mcp-quality-"));
  const source = path.join(directory, "quality.aseprite");
  const gateway = new AsepriteCliGateway({ executable: asepritePath });

  assert.equal((await gateway.createCanvas(16, 16, source)).ok, true);
  assert.equal((await gateway.addLayer(source, "hero")).ok, true);
  assert.equal((await gateway.addLayer(source, "shadow")).ok, true);
  assert.equal((await gateway.addFrame(source)).ok, true);
  assert.equal((await gateway.drawPixelsAt(source, "hero", 1, [{ x: 1, y: 1, color: "#ff0000" }], true)).ok, true);
  assert.equal((await gateway.drawPixelsAt(source, "shadow", 1, [{ x: 2, y: 2, color: "#000000" }], true)).ok, true);
  const ensured = await gateway.ensureLayersPresent(source, ["hero", "shadow"], 1, 2);
  assert.equal(ensured.ok, true, ensured.message);
  const audit = await gateway.auditAnimation({ filename: source, startFrame: 1, endFrame: 2, layerNames: ["hero", "shadow"], overlapPairs: ["hero,shadow"], layerFrameRanges: ["hero:2-2"], reportCels: true, reportBounds: true });
  assert.equal(audit.ok, true, audit.message);
  const report = JSON.parse(audit.message) as { summary?: { totalCels?: number; overlapsTotal?: number; outOfRange?: number } };
  assert.ok((report.summary?.totalCels ?? 0) >= 4);
  assert.ok((report.summary?.outOfRange ?? 0) >= 1);
  const sanitized = await gateway.animationSanitize({ filename: source, startFrame: 1, endFrame: 2, layerNames: ["hero", "shadow"], layerFrameRanges: ["hero:2-2"], outOfRangeAction: "set_opacity_zero", outOfRangeOpacity: 0 });
  assert.equal(sanitized.ok, true, sanitized.message);
  assert.equal(JSON.parse(sanitized.message).sanitized.opacitySet, 1);
});

test("real TypeScript gateway serves a preview and copies selected layers between sprites", { skip: !existsSync(asepritePath) }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-mcp-preview-"));
  const source = path.join(directory, "source.aseprite");
  const target = path.join(directory, "target.aseprite");
  const port = 19000 + (process.pid % 500);
  const gateway = new AsepriteCliGateway({ executable: asepritePath });
  let serverStarted = false;

  try {
    await fs.writeFile(path.join(directory, "index.html"), "<h1>preview-ok</h1>", "utf8");
    const preview = await gateway.startPreviewServer(directory, port);
    assert.equal(preview.ok, true, preview.message);
    serverStarted = true;
    const response = await fetch(`http://127.0.0.1:${port}/index.html`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "<h1>preview-ok</h1>");
    const stopped = await gateway.stopPreviewServer(port);
    assert.equal(stopped.ok, true, stopped.message);
    serverStarted = false;

    assert.equal((await gateway.createCanvas(8, 8, source)).ok, true);
    assert.equal((await gateway.addLayer(source, "hero")).ok, true);
    assert.equal((await gateway.drawPixelsAt(source, "hero", 1, [{ x: 2, y: 3, color: "#ff0000" }], true)).ok, true);
    assert.equal((await gateway.createCanvas(8, 8, target)).ok, true);
    const copied = await gateway.copyLayersBetweenSprites({ sourceFilename: source, targetFilename: target, layerNames: ["hero"] });
    assert.equal(copied.ok, true, copied.message);
    const pixel = await gateway.getPixelColor(target, 2, 3, "hero", 1);
    assert.equal(pixel.ok, true, pixel.message);
    assert.match(pixel.message, /#ff0000/);
  } finally {
    if (serverStarted) await gateway.stopPreviewServer(port);
    await fs.rm(directory, { recursive: true, force: true });
  }
});
