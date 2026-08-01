import type { AsepriteGateway, AsepriteResult, PixelInput, PointInput } from "../../domain/aseprite.js";

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
