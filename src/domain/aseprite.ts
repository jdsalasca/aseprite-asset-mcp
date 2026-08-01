export interface AsepriteResult {
  ok: boolean;
  message: string;
}

export interface AsepriteGateway {
  createCanvas(width: number, height: number, filename: string): Promise<AsepriteResult>;
  addGroup(filename: string, groupName: string, parentGroup?: string): Promise<AsepriteResult>;
  addLayer(filename: string, layerName: string, group?: string): Promise<AsepriteResult>;
  addFrames(filename: string, count: number, durationMs?: number): Promise<AsepriteResult>;
  setPalette(filename: string, colors: string[]): Promise<AsepriteResult>;
  setTag(filename: string, name: string, fromFrame: number, toFrame: number, direction?: string): Promise<AsepriteResult>;
  createTilemapLayer(filename: string, layerName: string, tileWidth: number, tileHeight: number): Promise<AsepriteResult>;
  validateScene(filename: string, requiredLayers: string[], startFrame?: number, endFrame?: number): Promise<AsepriteResult>;
  exportSpritesheet(input: {
    filename: string;
    outputFilename: string;
    sheetType?: string;
    dataFilename?: string;
    scale?: number;
    padding?: number;
    tagName?: string;
    dataFormat?: string;
    listTags?: boolean;
  }): Promise<AsepriteResult>;
}
