import type { AsepriteGateway, AsepriteResult, PixelInput } from "../../domain/aseprite.js";

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
