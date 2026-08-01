import type { AsepriteGateway, AsepriteResult, PixelInput, PointInput, TextDrawInput } from "../../domain/aseprite.js";

export class AsepriteAssetService {
  public constructor(private readonly gateway: AsepriteGateway) {}

  public createCanvas(width: number, height: number, filename: string): Promise<AsepriteResult> {
    return this.gateway.createCanvas(width, height, filename);
  }

  public addGroup(filename: string, groupName: string, parentGroup = ""): Promise<AsepriteResult> {
    return this.gateway.addGroup(filename, groupName, parentGroup);
  }

  public addLayer(filename: string, layerName: string, group = ""): Promise<AsepriteResult> {
    return this.gateway.addLayer(filename, layerName, group);
  }

  public deleteLayer(filename: string, layerName: string): Promise<AsepriteResult> {
    return this.gateway.deleteLayer(filename, layerName);
  }

  public renameLayer(filename: string, layerName: string, newName: string): Promise<AsepriteResult> {
    return this.gateway.renameLayer(filename, layerName, newName);
  }

  public duplicateLayer(filename: string, layerName: string, newName = "", group = ""): Promise<AsepriteResult> {
    return this.gateway.duplicateLayer(filename, layerName, newName, group);
  }

  public reorderLayer(filename: string, layerName: string, position: number): Promise<AsepriteResult> {
    return this.gateway.reorderLayer(filename, layerName, position);
  }

  public setLayerBlendMode(filename: string, layerName: string, mode: string): Promise<AsepriteResult> {
    return this.gateway.setLayerBlendMode(filename, layerName, mode);
  }

  public mergeLayerDown(filename: string, layerName: string): Promise<AsepriteResult> {
    return this.gateway.mergeLayerDown(filename, layerName);
  }

  public flattenSprite(filename: string): Promise<AsepriteResult> {
    return this.gateway.flattenSprite(filename);
  }

  public addFrame(filename: string): Promise<AsepriteResult> {
    return this.gateway.addFrame(filename);
  }

  public addFrames(filename: string, count: number, durationMs?: number): Promise<AsepriteResult> {
    return this.gateway.addFrames(filename, count, durationMs);
  }

  public setFrame(filename: string, frameIndex: number): Promise<AsepriteResult> {
    return this.gateway.setFrame(filename, frameIndex);
  }

  public setFrameDuration(filename: string, frameIndex: number, durationMs: number): Promise<AsepriteResult> {
    return this.gateway.setFrameDuration(filename, frameIndex, durationMs);
  }

  public setFrameDurationAll(filename: string, durationMs: number): Promise<AsepriteResult> {
    return this.gateway.setFrameDurationAll(filename, durationMs);
  }

  public setLayerVisibility(filename: string, layerName: string, visible = true): Promise<AsepriteResult> {
    return this.gateway.setLayerVisibility(filename, layerName, visible);
  }

  public setLayerOpacity(filename: string, layerName: string, opacity: number): Promise<AsepriteResult> {
    return this.gateway.setLayerOpacity(filename, layerName, opacity);
  }

  public setPalette(filename: string, colors: string[]): Promise<AsepriteResult> {
    return this.gateway.setPalette(filename, colors);
  }

  public drawPixels(filename: string, pixels: PixelInput[]): Promise<AsepriteResult> {
    return this.gateway.drawPixels(filename, pixels);
  }

  public drawLine(filename: string, x1: number, y1: number, x2: number, y2: number, color: string, thickness = 1): Promise<AsepriteResult> {
    return this.gateway.drawLine(filename, x1, y1, x2, y2, color, thickness);
  }

  public drawRectangle(filename: string, x: number, y: number, width: number, height: number, color: string, fill = false): Promise<AsepriteResult> {
    return this.gateway.drawRectangle(filename, x, y, width, height, color, fill);
  }

  public fillArea(filename: string, x: number, y: number, color: string): Promise<AsepriteResult> {
    return this.gateway.fillArea(filename, x, y, color);
  }

  public drawCircle(filename: string, centerX: number, centerY: number, radius: number, color: string, fill = false): Promise<AsepriteResult> {
    return this.gateway.drawCircle(filename, centerX, centerY, radius, color, fill);
  }

  public drawPixelsAt(filename: string, layerName: string, frameIndex: number, pixels: PixelInput[], createIfMissing = true): Promise<AsepriteResult> {
    return this.gateway.drawPixelsAt(filename, layerName, frameIndex, pixels, createIfMissing);
  }

  public drawLineAt(filename: string, layerName: string, frameIndex: number, x1: number, y1: number, x2: number, y2: number, color: string, thickness = 1, createIfMissing = true): Promise<AsepriteResult> {
    return this.gateway.drawLineAt(filename, layerName, frameIndex, x1, y1, x2, y2, color, thickness, createIfMissing);
  }

  public drawRectangleAt(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, color: string, fill = false, createIfMissing = true): Promise<AsepriteResult> {
    return this.gateway.drawRectangleAt(filename, layerName, frameIndex, x, y, width, height, color, fill, createIfMissing);
  }

  public drawCircleAt(filename: string, layerName: string, frameIndex: number, centerX: number, centerY: number, radius: number, color: string, fill = false, createIfMissing = true): Promise<AsepriteResult> {
    return this.gateway.drawCircleAt(filename, layerName, frameIndex, centerX, centerY, radius, color, fill, createIfMissing);
  }

  public fillAreaAt(filename: string, layerName: string, frameIndex: number, x: number, y: number, color: string, createIfMissing = true): Promise<AsepriteResult> {
    return this.gateway.fillAreaAt(filename, layerName, frameIndex, x, y, color, createIfMissing);
  }

  public drawPolygon(filename: string, layerName: string, frameIndex: number, points: PointInput[], color = "#000000", fill = false, createIfMissing = true): Promise<AsepriteResult> {
    return this.gateway.drawPolygon(filename, layerName, frameIndex, points, color, fill, createIfMissing);
  }

  public drawPath(filename: string, layerName: string, frameIndex: number, points: PointInput[], color = "#000000", thickness = 1, createIfMissing = true): Promise<AsepriteResult> {
    return this.gateway.drawPath(filename, layerName, frameIndex, points, color, thickness, createIfMissing);
  }

  public applyGradientRect(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorStart: string, colorEnd: string, horizontal = true, createIfMissing = true): Promise<AsepriteResult> {
    return this.gateway.applyGradientRect(filename, layerName, frameIndex, x, y, width, height, colorStart, colorEnd, horizontal, createIfMissing);
  }

  public drawEllipseAt(filename: string, layerName: string, frameIndex: number, centerX: number, centerY: number, radiusX: number, radiusY: number, color = "#000000", fill = false, createIfMissing = true): Promise<AsepriteResult> {
    return this.gateway.drawEllipseAt(filename, layerName, frameIndex, centerX, centerY, radiusX, radiusY, color, fill, createIfMissing);
  }

  public exportSprite(filename: string, outputFilename: string, format = "png"): Promise<AsepriteResult> {
    return this.gateway.exportSprite(filename, outputFilename, format);
  }

  public copySprite(filename: string, outputFilename: string, overwrite = false): Promise<AsepriteResult> {
    return this.gateway.copySprite(filename, outputFilename, overwrite);
  }

  public exportFrame(filename: string, frameIndex: number, outputFilename: string, scale = 1): Promise<AsepriteResult> {
    return this.gateway.exportFrame(filename, frameIndex, outputFilename, scale);
  }

  public exportLayers(filename: string, outputDirectory: string, includeHidden = false): Promise<AsepriteResult> {
    return this.gateway.exportLayers(filename, outputDirectory, includeHidden);
  }

  public exportTag(filename: string, tagName: string, outputFilename: string, scale = 1): Promise<AsepriteResult> {
    return this.gateway.exportTag(filename, tagName, outputFilename, scale);
  }

  public importImageAsLayer(filename: string, imagePath: string, layerName: string, frameIndex = 1, x = 0, y = 0): Promise<AsepriteResult> {
    return this.gateway.importImageAsLayer(filename, imagePath, layerName, frameIndex, x, y);
  }

  public createCel(filename: string, layerName: string, frameIndex: number, x = 0, y = 0): Promise<AsepriteResult> {
    return this.gateway.createCel(filename, layerName, frameIndex, x, y);
  }

  public clearCel(filename: string, layerName: string, frameIndex: number): Promise<AsepriteResult> {
    return this.gateway.clearCel(filename, layerName, frameIndex);
  }

  public copyCel(filename: string, layerName: string, sourceFrame: number, targetFrame: number, replace = true): Promise<AsepriteResult> {
    return this.gateway.copyCel(filename, layerName, sourceFrame, targetFrame, replace);
  }

  public copyFrame(filename: string, sourceFrame: number, targetFrame?: number, overwrite = true): Promise<AsepriteResult> {
    return this.gateway.copyFrame(filename, sourceFrame, targetFrame, overwrite);
  }

  public setCelPosition(filename: string, layerName: string, frameIndex: number, x: number, y: number, createIfMissing = false, sourceFrameIndex?: number): Promise<AsepriteResult> {
    return this.gateway.setCelPosition(filename, layerName, frameIndex, x, y, createIfMissing, sourceFrameIndex);
  }

  public tweenCelPositions(filename: string, layerName: string, startFrame: number, endFrame: number, startX: number, startY: number, endX: number, endY: number, createMissingCels = false, sourceFrameIndex?: number): Promise<AsepriteResult> {
    return this.gateway.tweenCelPositions(filename, layerName, startFrame, endFrame, startX, startY, endX, endY, createMissingCels, sourceFrameIndex);
  }

  public offsetCelPositions(filename: string, layerName: string, startFrame: number, endFrame: number, dx: number, dy: number): Promise<AsepriteResult> {
    return this.gateway.offsetCelPositions(filename, layerName, startFrame, endFrame, dx, dy);
  }

  public propagateFrameToRange(filename: string, sourceFrame: number, startFrame: number, endFrame: number, overwrite = true): Promise<AsepriteResult> {
    return this.gateway.propagateFrameToRange(filename, sourceFrame, startFrame, endFrame, overwrite);
  }

  public deleteFrame(filename: string, frameIndex: number): Promise<AsepriteResult> {
    return this.gateway.deleteFrame(filename, frameIndex);
  }

  public deleteTag(filename: string, name: string): Promise<AsepriteResult> {
    return this.gateway.deleteTag(filename, name);
  }

  public setOnionSkin(filename: string, enabled = true, before = 2, after = 2, opacity = 128): Promise<AsepriteResult> {
    return this.gateway.setOnionSkin(filename, enabled, before, after, opacity);
  }

  public renderOnionSkin(filename: string, frameIndex: number, outputFilename: string, before = 1, after = 1, scale = 4, ghostOpacity = 100): Promise<AsepriteResult> {
    return this.gateway.renderOnionSkin(filename, frameIndex, outputFilename, before, after, scale, ghostOpacity);
  }

  public compareFrames(filename: string, frameA: number, frameB: number): Promise<AsepriteResult> {
    return this.gateway.compareFrames(filename, frameA, frameB);
  }

  public setCelOpacity(filename: string, layerName: string, frameIndex: number, opacity: number): Promise<AsepriteResult> {
    return this.gateway.setCelOpacity(filename, layerName, frameIndex, opacity);
  }

  public getColorStats(filename: string, frameIndex = 1, top = 16): Promise<AsepriteResult> {
    return this.gateway.getColorStats(filename, frameIndex, top);
  }

  public getPalette(filename: string): Promise<AsepriteResult> {
    return this.gateway.getPalette(filename);
  }

  public extractPalette(filename: string, maxColors = 16, withAlpha = false): Promise<AsepriteResult> {
    return this.gateway.extractPalette(filename, maxColors, withAlpha);
  }

  public outlineNative(filename: string, layerName = "", frameIndex = 1, color = "#000000", place = "outside", matrix = "circle"): Promise<AsepriteResult> {
    return this.gateway.outlineNative(filename, layerName, frameIndex, color, place, matrix);
  }

  public adjustHslNative(filename: string, layerName = "", frameIndex = 1, hue = 0, saturation = 0, lightness = 0, x = 0, y = 0, width = 0, height = 0): Promise<AsepriteResult> {
    return this.gateway.adjustHslNative(filename, layerName, frameIndex, hue, saturation, lightness, x, y, width, height);
  }

  public adjustBrightnessContrast(filename: string, layerName = "", frameIndex = 1, brightness = 0, contrast = 0, x = 0, y = 0, width = 0, height = 0): Promise<AsepriteResult> {
    return this.gateway.adjustBrightnessContrast(filename, layerName, frameIndex, brightness, contrast, x, y, width, height);
  }

  public invertColors(filename: string, layerName = "", frameIndex = 1, x = 0, y = 0, width = 0, height = 0): Promise<AsepriteResult> {
    return this.gateway.invertColors(filename, layerName, frameIndex, x, y, width, height);
  }

  public outlineCel(filename: string, layerName: string, frameIndex: number, color = "#000000", includeDiagonals = false): Promise<AsepriteResult> {
    return this.gateway.outlineCel(filename, layerName, frameIndex, color, includeDiagonals);
  }

  public replaceColor(filename: string, layerName: string, frameIndex: number, fromColor: string, toColor: string, tolerance = 0): Promise<AsepriteResult> {
    return this.gateway.replaceColor(filename, layerName, frameIndex, fromColor, toColor, tolerance);
  }

  public adjustHsl(filename: string, layerName: string, frameIndex: number, hueShift = 0, saturationShift = 0, lightnessShift = 0): Promise<AsepriteResult> {
    return this.gateway.adjustHsl(filename, layerName, frameIndex, hueShift, saturationShift, lightnessShift);
  }

  public remapColorsInCelRange(filename: string, layerName: string, startFrame: number, endFrame: number, mappings: Array<{ from: string; to: string }>, createMissingCels = false, sourceFrameIndex?: number): Promise<AsepriteResult> {
    return this.gateway.remapColorsInCelRange(filename, layerName, startFrame, endFrame, mappings, createMissingCels, sourceFrameIndex);
  }

  public listPalettePresets(): Promise<AsepriteResult> {
    return this.gateway.listPalettePresets();
  }

  public applyPalettePreset(filename: string, preset: string): Promise<AsepriteResult> {
    return this.gateway.applyPalettePreset(filename, preset);
  }

  public generateColorRamp(baseColor: string, steps = 5, hueShiftDegrees = 20, lightnessRange = 0.5): Promise<AsepriteResult> {
    return this.gateway.generateColorRamp(baseColor, steps, hueShiftDegrees, lightnessRange);
  }

  public quantizeToPalette(filename: string, layerName = "", startFrame = 1, endFrame = 0): Promise<AsepriteResult> {
    return this.gateway.quantizeToPalette(filename, layerName, startFrame, endFrame);
  }

  public setColorMode(filename: string, mode: string): Promise<AsepriteResult> {
    return this.gateway.setColorMode(filename, mode);
  }

  public getPixelColor(filename: string, x: number, y: number, layerName = "", frameIndex = 1): Promise<AsepriteResult> {
    return this.gateway.getPixelColor(filename, x, y, layerName, frameIndex);
  }

  public getPixelsRect(filename: string, x: number, y: number, width: number, height: number, layerName = "", frameIndex = 1): Promise<AsepriteResult> {
    return this.gateway.getPixelsRect(filename, x, y, width, height, layerName, frameIndex);
  }

  public getCompositePixel(filename: string, x: number, y: number, frameIndex = 1): Promise<AsepriteResult> {
    return this.gateway.getCompositePixel(filename, x, y, frameIndex);
  }

  public getCompositeRect(filename: string, x: number, y: number, width: number, height: number, frameIndex = 1): Promise<AsepriteResult> {
    return this.gateway.getCompositeRect(filename, x, y, width, height, frameIndex);
  }

  public moveRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, destX: number, destY: number): Promise<AsepriteResult> {
    return this.gateway.moveRegion(filename, layerName, frameIndex, x, y, width, height, destX, destY);
  }

  public copyRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, destX: number, destY: number, targetLayerName = "", targetFrameIndex = 0): Promise<AsepriteResult> {
    return this.gateway.copyRegion(filename, layerName, frameIndex, x, y, width, height, destX, destY, targetLayerName, targetFrameIndex);
  }

  public eraseRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number): Promise<AsepriteResult> {
    return this.gateway.eraseRegion(filename, layerName, frameIndex, x, y, width, height);
  }

  public eraseColor(filename: string, layerName: string, frameIndex: number, color: string, tolerance = 0): Promise<AsepriteResult> {
    return this.gateway.eraseColor(filename, layerName, frameIndex, color, tolerance);
  }

  public flipLayer(filename: string, layerName: string, frameIndex: number, direction: "horizontal" | "vertical" = "horizontal"): Promise<AsepriteResult> {
    return this.gateway.flipLayer(filename, layerName, frameIndex, direction);
  }

  public rotateLayer(filename: string, layerName: string, frameIndex: number, angle: 90 | 180 | 270 = 90): Promise<AsepriteResult> {
    return this.gateway.rotateLayer(filename, layerName, frameIndex, angle);
  }

  public resizeCanvas(filename: string, width: number, height: number): Promise<AsepriteResult> {
    return this.gateway.resizeCanvas(filename, width, height);
  }

  public cropCanvas(filename: string, x: number, y: number, width: number, height: number): Promise<AsepriteResult> {
    return this.gateway.cropCanvas(filename, x, y, width, height);
  }

  public listTextFonts(): Promise<AsepriteResult> {
    return this.gateway.listTextFonts();
  }

  public measureText(text: string, font: string, size = 1, letterSpacing = 0, bold = 0, antialias = false): Promise<AsepriteResult> {
    return this.gateway.measureText(text, font, size, letterSpacing, bold, antialias);
  }

  public drawText(input: TextDrawInput): Promise<AsepriteResult> {
    return this.gateway.drawText(input);
  }

  public applyConvolution(filename: string, matrix: string, layerName = "", frameIndex = 1, x = 0, y = 0, width = 0, height = 0): Promise<AsepriteResult> {
    return this.gateway.applyConvolution(filename, matrix, layerName, frameIndex, x, y, width, height);
  }

  public listConvolutionMatrices(): Promise<AsepriteResult> {
    return this.gateway.listConvolutionMatrices();
  }

  public applyDitherGradient(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorStart: string, colorEnd: string, horizontal = false, createIfMissing = true): Promise<AsepriteResult> {
    return this.gateway.applyDitherGradient(filename, layerName, frameIndex, x, y, width, height, colorStart, colorEnd, horizontal, createIfMissing);
  }

  public applyDitherPattern(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorA: string, colorB: string, density = 0.5, createIfMissing = true): Promise<AsepriteResult> {
    return this.gateway.applyDitherPattern(filename, layerName, frameIndex, x, y, width, height, colorA, colorB, density, createIfMissing);
  }

  public setTag(filename: string, name: string, fromFrame: number, toFrame: number, direction = "forward"): Promise<AsepriteResult> {
    return this.gateway.setTag(filename, name, fromFrame, toFrame, direction);
  }

  public createTilemapLayer(filename: string, layerName: string, tileWidth: number, tileHeight: number): Promise<AsepriteResult> {
    return this.gateway.createTilemapLayer(filename, layerName, tileWidth, tileHeight);
  }

  public validateScene(filename: string, requiredLayers: string[], startFrame = 1, endFrame?: number): Promise<AsepriteResult> {
    return this.gateway.validateScene(filename, requiredLayers, startFrame, endFrame);
  }

  public exportSpritesheet(input: Parameters<AsepriteGateway["exportSpritesheet"]>[0]): Promise<AsepriteResult> {
    return this.gateway.exportSpritesheet(input);
  }
}
