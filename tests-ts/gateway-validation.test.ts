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
    gateway.drawPixels("../sprite.aseprite", [{ x: 0, y: 0, color: "#112233" }]),
    gateway.drawLine("../sprite.aseprite", 0, 0, 1, 1, "#112233"),
    gateway.fillArea("../sprite.aseprite", 0, 0, "#112233"),
    gateway.drawCircle("../sprite.aseprite", 0, 0, 1, "#112233"),
    gateway.drawPixelsAt("../sprite.aseprite", "Layer", 1, [{ x: 0, y: 0, color: "#112233" }]),
    gateway.drawLineAt("../sprite.aseprite", "Layer", 1, 0, 0, 1, 1, "#112233"),
    gateway.drawRectangleAt("../sprite.aseprite", "Layer", 1, 0, 0, 1, 1, "#112233"),
    gateway.drawCircleAt("../sprite.aseprite", "Layer", 1, 0, 0, 1, "#112233"),
    gateway.fillAreaAt("../sprite.aseprite", "Layer", 1, 0, 0, "#112233"),
    gateway.drawPolygon("../sprite.aseprite", "Layer", 1, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]),
    gateway.drawPath("../sprite.aseprite", "Layer", 1, [{ x: 0, y: 0 }, { x: 1, y: 1 }]),
    gateway.applyGradientRect("../sprite.aseprite", "Layer", 1, 0, 0, 2, 2, "#000000", "#ffffff"),
    gateway.drawEllipseAt("../sprite.aseprite", "Layer", 1, 0, 0, 1, 1),
    gateway.exportSprite("../sprite.aseprite", "output.png"),
    gateway.copySprite("../sprite.aseprite", "output.aseprite"),
    gateway.exportFrame("../sprite.aseprite", 1, "output.png"),
    gateway.exportLayers("../sprite.aseprite", "output"),
    gateway.exportTag("../sprite.aseprite", "idle", "output.png"),
    gateway.importImageAsLayer("../sprite.aseprite", "image.png", "Layer"),
    gateway.createCel("../sprite.aseprite", "Layer", 1),
    gateway.clearCel("../sprite.aseprite", "Layer", 1),
    gateway.copyCel("../sprite.aseprite", "Layer", 1, 2),
    gateway.copyFrame("../sprite.aseprite", 1),
    gateway.setCelPosition("../sprite.aseprite", "Layer", 1, 0, 0),
    gateway.tweenCelPositions("../sprite.aseprite", "Layer", 1, 2, 0, 0, 1, 1),
    gateway.offsetCelPositions("../sprite.aseprite", "Layer", 1, 2, 1, 1),
    gateway.propagateFrameToRange("../sprite.aseprite", 1, 1, 2),
    gateway.deleteFrame("../sprite.aseprite", 1),
    gateway.deleteTag("../sprite.aseprite", "idle"),
    gateway.setOnionSkin("../sprite.aseprite"),
    gateway.renderOnionSkin("../sprite.aseprite", 1, "output.png"),
    gateway.compareFrames("../sprite.aseprite", 1, 2),
    gateway.setCelOpacity("../sprite.aseprite", "Layer", 1, 128),
    gateway.getColorStats("../sprite.aseprite"),
    gateway.getPalette("../sprite.aseprite"),
    gateway.extractPalette("../sprite.aseprite"),
    gateway.outlineNative("../sprite.aseprite"),
    gateway.adjustHslNative("../sprite.aseprite"),
    gateway.adjustBrightnessContrast("../sprite.aseprite"),
    gateway.invertColors("../sprite.aseprite"),
    gateway.applyConvolution("../sprite.aseprite", "blur-3x3"),
    gateway.applyDitherGradient("../sprite.aseprite", "Layer", 1, 0, 0, 2, 2, "#000000", "#ffffff"),
    gateway.applyDitherPattern("../sprite.aseprite", "Layer", 1, 0, 0, 2, 2, "#000000", "#ffffff"),
    gateway.deleteLayer("../sprite.aseprite", "Layer"),
    gateway.renameLayer("../sprite.aseprite", "Layer", "Renamed"),
    gateway.duplicateLayer("../sprite.aseprite", "Layer"),
    gateway.reorderLayer("../sprite.aseprite", "Layer", 1),
    gateway.setLayerBlendMode("../sprite.aseprite", "Layer", "normal"),
    gateway.mergeLayerDown("../sprite.aseprite", "Layer"),
    gateway.flattenSprite("../sprite.aseprite"),
    gateway.outlineCel("../sprite.aseprite", "Layer", 1),
    gateway.replaceColor("../sprite.aseprite", "Layer", 1, "#000000", "#ffffff"),
    gateway.adjustHsl("../sprite.aseprite", "Layer", 1),
    gateway.remapColorsInCelRange("../sprite.aseprite", "Layer", 1, 1, [{ from: "#000000", to: "#ffffff" }]),
    gateway.applyPalettePreset("../sprite.aseprite", "gameboy"),
    gateway.quantizeToPalette("../sprite.aseprite"),
    gateway.setColorMode("../sprite.aseprite", "rgb"),
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

test("rejects invalid primitive drawing contracts before starting Aseprite", async () => {
  const emptyPixels = await gateway.drawPixels("sprite.aseprite", []);
  const badPixel = await gateway.drawPixels("sprite.aseprite", [{ x: 0.5, y: 0, color: "#112233" }]);
  const badLine = await gateway.drawLine("sprite.aseprite", 0, 0, 4, 4, "#112233", 0);
  const badFill = await gateway.fillArea("sprite.aseprite", 0.5, 0, "#112233");
  const badCircle = await gateway.drawCircle("sprite.aseprite", 0, 0, 0, "#112233");
  const badColor = await gateway.drawLine("sprite.aseprite", 0, 0, 4, 4, "#12GG34");

  assert.equal(emptyPixels.message, "Pixels list cannot be empty");
  assert.equal(badPixel.message, "Pixel coordinates must be integers");
  assert.equal(badLine.message, "Thickness must be a positive integer");
  assert.equal(badFill.message, "Coordinates must be integers");
  assert.equal(badCircle.message, "Radius must be a positive integer");
  assert.equal(badColor.message, "Colors must use hexadecimal values");
});

test("rejects invalid layer-frame drawing contracts before starting Aseprite", async () => {
  const badFrame = await gateway.drawPixelsAt("sprite.aseprite", "Layer", 0, [{ x: 0, y: 0, color: "#112233" }]);
  const badLayer = await gateway.drawLineAt("sprite.aseprite", "", 1, 0, 0, 1, 1, "#112233");
  const badPixels = await gateway.drawPixelsAt("sprite.aseprite", "Layer", 1, []);
  const badLine = await gateway.drawLineAt("sprite.aseprite", "Layer", 1, 0, 0, 1, 1, "#112233", 0);
  const badRectangle = await gateway.drawRectangleAt("sprite.aseprite", "Layer", 1, 0, 0, 0, 1, "#112233");
  const badCircle = await gateway.drawCircleAt("sprite.aseprite", "Layer", 1, 0, 0, 0, "#112233");
  const badFill = await gateway.fillAreaAt("sprite.aseprite", "Layer", 1, 0.5, 0, "#112233");

  assert.equal(badFrame.message, "Frame index must be a positive integer");
  assert.equal(badLayer.message, "Layer name cannot be empty");
  assert.equal(badPixels.message, "Pixels list cannot be empty");
  assert.equal(badLine.message, "Thickness must be a positive integer");
  assert.equal(badRectangle.message, "Width and height must be positive integers");
  assert.equal(badCircle.message, "Radius must be a positive integer");
  assert.equal(badFill.message, "Coordinates must be integers");
});

test("rejects invalid polygon, path, and gradient contracts before starting Aseprite", async () => {
  const badPolygon = await gateway.drawPolygon("sprite.aseprite", "Layer", 1, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  const badPath = await gateway.drawPath("sprite.aseprite", "Layer", 1, [{ x: 0, y: 0 }]);
  const badPoint = await gateway.drawPath("sprite.aseprite", "Layer", 1, [{ x: 0.5, y: 0 }, { x: 1, y: 1 }]);
  const badGradientSize = await gateway.applyGradientRect("sprite.aseprite", "Layer", 1, 0, 0, 0, 2, "#000000", "#ffffff");
  const badGradientColor = await gateway.applyGradientRect("sprite.aseprite", "Layer", 1, 0, 0, 2, 2, "#000000", "#12GG34");

  assert.equal(badPolygon.message, "Polygon requires at least 3 points");
  assert.equal(badPath.message, "Path requires at least 2 points");
  assert.equal(badPoint.message, "Point coordinates must be integers");
  assert.equal(badGradientSize.message, "Width and height must be positive integers");
  assert.equal(badGradientColor.message, "Colors must use hexadecimal values");
});

test("rejects invalid ellipse and export contracts before starting Aseprite", async () => {
  const badEllipse = await gateway.drawEllipseAt("sprite.aseprite", "Layer", 1, 0, 0, 0, 1);
  const badFormat = await gateway.exportSprite("sprite.aseprite", "output", "bad/format");
  const badCopy = await gateway.copySprite("sprite.aseprite", "../output.aseprite");
  const badFrame = await gateway.exportFrame("sprite.aseprite", 0, "output.png");
  const badScale = await gateway.exportFrame("sprite.aseprite", 1, "output.png", 65);

  assert.equal(badEllipse.message, "Radius X and radius Y must be positive integers");
  assert.equal(badFormat.message, "Format must contain only letters and numbers");
  assert.equal(badCopy.message, "Parent directory traversal is not allowed");
  assert.equal(badFrame.message, "Frame index must be a positive integer");
  assert.equal(badScale.message, "Scale must be between 1 and 64");
});

test("rejects invalid layer and tag export contracts before starting Aseprite", async () => {
  const badLayers = await gateway.exportLayers("sprite.aseprite", "../output");
  const badTag = await gateway.exportTag("sprite.aseprite", "", "output.png");
  const badScale = await gateway.exportTag("sprite.aseprite", "idle", "output.png", 65);

  assert.equal(badLayers.message, "Parent directory traversal is not allowed");
  assert.equal(badTag.message, "Tag name cannot be empty");
  assert.equal(badScale.message, "Scale must be between 1 and 64");
});

test("rejects invalid import and cel contracts before starting Aseprite", async () => {
  const badImport = await gateway.importImageAsLayer("sprite.aseprite", "../image.png", "Layer");
  const badCreate = await gateway.createCel("sprite.aseprite", "Layer", 0);
  const badClear = await gateway.clearCel("sprite.aseprite", "", 1);
  const badCopyCel = await gateway.copyCel("sprite.aseprite", "Layer", 0, 2);
  const badCopyFrame = await gateway.copyFrame("sprite.aseprite", 0);

  assert.equal(badImport.message, "Parent directory traversal is not allowed");
  assert.equal(badCreate.message, "Frame index must be a positive integer");
  assert.equal(badClear.message, "Layer name cannot be empty");
  assert.equal(badCopyCel.message, "Source frame must be a positive integer");
  assert.equal(badCopyFrame.message, "Source frame must be a positive integer");
});

test("rejects invalid frame motion contracts before starting Aseprite", async () => {
  const badSet = await gateway.setCelPosition("sprite.aseprite", "Layer", 0, 0, 0);
  const badTween = await gateway.tweenCelPositions("sprite.aseprite", "Layer", 3, 2, 0, 0, 1, 1);
  const badOffset = await gateway.offsetCelPositions("sprite.aseprite", "Layer", 3, 2, 1, 1);
  const badPropagate = await gateway.propagateFrameToRange("sprite.aseprite", 0, 1, 2);

  assert.equal(badSet.message, "Frame index must be a positive integer");
  assert.equal(badTween.message, "Frame range must start at 1 and end at or after the start");
  assert.equal(badOffset.message, "Frame range must start at 1 and end at or after the start");
  assert.equal(badPropagate.message, "Source frame must be a positive integer");
});

test("rejects invalid animation control contracts before starting Aseprite", async () => {
  const badFrame = await gateway.deleteFrame("sprite.aseprite", 0);
  const badTag = await gateway.deleteTag("sprite.aseprite", "");
  const badOnionRange = await gateway.setOnionSkin("sprite.aseprite", true, -1, 2, 128);
  const badOnionOpacity = await gateway.setOnionSkin("sprite.aseprite", true, 1, 1, 256);

  assert.equal(badFrame.message, "Frame index must be a positive integer");
  assert.equal(badTag.message, "Tag name cannot be empty");
  assert.equal(badOnionRange.message, "Before and after must be non-negative integers");
  assert.equal(badOnionOpacity.message, "Opacity must be between 0 and 255");
});

test("rejects invalid visual analysis contracts before starting Aseprite", async () => {
  const badRenderRange = await gateway.renderOnionSkin("sprite.aseprite", 1, "output.png", -1, 1);
  const badRenderScale = await gateway.renderOnionSkin("sprite.aseprite", 1, "output.png", 1, 1, 0);
  const badOpacity = await gateway.renderOnionSkin("sprite.aseprite", 1, "output.png", 1, 1, 1, 256);
  const badCompare = await gateway.compareFrames("sprite.aseprite", 0, 2);

  assert.equal(badRenderRange.message, "Before and after must be non-negative integers");
  assert.equal(badRenderScale.message, "Scale must be between 1 and 64");
  assert.equal(badOpacity.message, "Ghost opacity must be between 0 and 255");
  assert.equal(badCompare.message, "Frame A and frame B must be positive integers");
});

test("rejects invalid opacity and palette analysis contracts before starting Aseprite", async () => {
  const badOpacity = await gateway.setCelOpacity("sprite.aseprite", "Layer", 1, -1);
  const badStats = await gateway.getColorStats("sprite.aseprite", 1, 0);
  const badPalette = await gateway.extractPalette("sprite.aseprite", 0);

  assert.equal(badOpacity.message, "Opacity must be between 0 and 255");
  assert.equal(badStats.message, "Top must be a positive integer");
  assert.equal(badPalette.message, "Max colors must be between 1 and 256");
});

test("rejects invalid native effect contracts before starting Aseprite", async () => {
  const badOutlineColor = await gateway.outlineNative("sprite.aseprite", "Layer", 1, "#GGGGGG");
  const badOutlinePlace = await gateway.outlineNative("sprite.aseprite", "Layer", 1, "#000000", "invalid");
  const badHsl = await gateway.adjustHslNative("sprite.aseprite", "Layer", 1, 181, 0, 0);
  const badContrast = await gateway.adjustBrightnessContrast("sprite.aseprite", "Layer", 1, 0, 101);
  const badRegion = await gateway.invertColors("sprite.aseprite", "Layer", 1, 0, 0, 0, 2);

  assert.equal(badOutlineColor.message, "Colors must use hexadecimal values");
  assert.equal(badOutlinePlace.message, "Place must be 'outside' or 'inside'");
  assert.equal(badHsl.message, "Hue must be between -180 and 180");
  assert.equal(badContrast.message, "Brightness and contrast must be between -100 and 100");
  assert.equal(badRegion.message, "Region width and height must both be zero or positive integers");
});

test("rejects invalid convolution and dithering contracts before starting Aseprite", async () => {
  const badMatrix = await gateway.applyConvolution("sprite.aseprite", "not-a-matrix");
  const badConvolutionRegion = await gateway.applyConvolution("sprite.aseprite", "blur-3x3", "Layer", 1, 0, 0, 2, 0);
  const matrices = await gateway.listConvolutionMatrices();
  const badGradientSize = await gateway.applyDitherGradient("sprite.aseprite", "Layer", 1, 0, 0, 0, 2, "#000000", "#ffffff");
  const badGradientColor = await gateway.applyDitherGradient("sprite.aseprite", "Layer", 1, 0, 0, 2, 2, "invalid", "#ffffff");
  const badPatternDensity = await gateway.applyDitherPattern("sprite.aseprite", "Layer", 1, 0, 0, 2, 2, "#000000", "#ffffff", 1.1);

  assert.equal(badMatrix.message, "Unknown convolution matrix: not-a-matrix");
  assert.equal(badConvolutionRegion.message, "Region width and height must both be zero or positive integers");
  assert.equal(matrices.ok, true);
  assert.match(matrices.message, /blur-3x3/);
  assert.equal(badGradientSize.message, "Width and height must be positive integers");
  assert.equal(badGradientColor.message, "Colors must use hexadecimal values");
  assert.equal(badPatternDensity.message, "Density must be between 0 and 1");
});

test("rejects invalid layer management contracts before starting Aseprite", async () => {
  const badDeleteName = await gateway.deleteLayer("sprite.aseprite", "");
  const badRenameName = await gateway.renameLayer("sprite.aseprite", "Layer", "");
  const badReorderPosition = await gateway.reorderLayer("sprite.aseprite", "Layer", 0);
  const badBlendMode = await gateway.setLayerBlendMode("sprite.aseprite", "Layer", "not-a-mode");
  const badMergeName = await gateway.mergeLayerDown("sprite.aseprite", "");

  assert.equal(badDeleteName.message, "Layer name cannot be empty");
  assert.equal(badRenameName.message, "New layer name cannot be empty");
  assert.equal(badReorderPosition.message, "Position must be a positive integer");
  assert.match(badBlendMode.message, /Unsupported blend mode: not-a-mode/);
  assert.equal(badMergeName.message, "Layer name cannot be empty");
});

test("rejects invalid legacy FX contracts before starting Aseprite", async () => {
  const badOutlineColor = await gateway.outlineCel("sprite.aseprite", "Layer", 1, "invalid");
  const badOutlineFrame = await gateway.outlineCel("sprite.aseprite", "Layer", 0);
  const badReplaceColor = await gateway.replaceColor("sprite.aseprite", "Layer", 1, "invalid", "#ffffff");
  const badTolerance = await gateway.replaceColor("sprite.aseprite", "Layer", 1, "#000000", "#ffffff", 256);

  assert.equal(badOutlineColor.message, "Colors must use hexadecimal values");
  assert.equal(badOutlineFrame.message, "Frame index must be a positive integer");
  assert.equal(badReplaceColor.message, "Colors must use hexadecimal values");
  assert.equal(badTolerance.message, "Tolerance must be between 0 and 255");
});

test("rejects invalid legacy HSL contracts before starting Aseprite", async () => {
  const badHue = await gateway.adjustHsl("sprite.aseprite", "Layer", 1, 361);
  const badSaturation = await gateway.adjustHsl("sprite.aseprite", "Layer", 1, 0, -101);
  const badLightness = await gateway.adjustHsl("sprite.aseprite", "Layer", 1, 0, 0, 101);
  const badFrame = await gateway.adjustHsl("sprite.aseprite", "Layer", 0);

  assert.equal(badHue.message, "Hue shift must be between -360 and 360");
  assert.equal(badSaturation.message, "Saturation shift must be between -100 and 100");
  assert.equal(badLightness.message, "Lightness shift must be between -100 and 100");
  assert.equal(badFrame.message, "Frame index must be a positive integer");
});

test("rejects invalid palette expansion contracts before starting Aseprite", async () => {
  const badMappings = await gateway.remapColorsInCelRange("sprite.aseprite", "Layer", 1, 1, []);
  const badMappingColor = await gateway.remapColorsInCelRange("sprite.aseprite", "Layer", 1, 1, [{ from: "invalid", to: "#ffffff" }]);
  const presets = await gateway.listPalettePresets();
  const badPreset = await gateway.applyPalettePreset("sprite.aseprite", "not-a-preset");
  const badRampColor = await gateway.generateColorRamp("invalid");
  const badRampSteps = await gateway.generateColorRamp("#112233", 1);
  const badQuantizeFrame = await gateway.quantizeToPalette("sprite.aseprite", "", 0);
  const badMode = await gateway.setColorMode("sprite.aseprite", "cmyk");

  assert.equal(badMappings.message, "Mappings list cannot be empty");
  assert.equal(badMappingColor.message, "Mappings must use hexadecimal values");
  assert.equal(presets.ok, true);
  assert.match(presets.message, /gameboy/);
  assert.match(badPreset.message, /Unknown palette preset: not-a-preset/);
  assert.equal(badRampColor.message, "Colors must use hexadecimal values");
  assert.equal(badRampSteps.message, "Steps must be between 2 and 16");
  assert.equal(badQuantizeFrame.message, "Frame range must start at 1 and end at or after the start");
  assert.equal(badMode.message, "Mode must be 'rgb', 'grayscale', or 'indexed'");
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
