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

  public addFrames(filename: string, count: number, durationMs?: number): Promise<AsepriteResult> {
    return this.gateway.addFrames(filename, count, durationMs);
  }

  public setPalette(filename: string, colors: string[]): Promise<AsepriteResult> {
    return this.gateway.setPalette(filename, colors);
  }

  public drawRectangle(filename: string, x: number, y: number, width: number, height: number, color: string, fill = false): Promise<AsepriteResult> {
    return this.gateway.drawRectangle(filename, x, y, width, height, color, fill);
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
