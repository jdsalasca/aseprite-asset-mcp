import type { AsepriteGateway, AsepriteResult } from "../../domain/aseprite.js";

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
