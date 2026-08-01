export interface AsepriteResult {
  ok: boolean;
  message: string;
}

export interface PixelInput {
  x: number;
  y: number;
  color: string;
}

export interface PointInput {
  x: number;
  y: number;
}

export interface AsepriteGateway {
  createCanvas(width: number, height: number, filename: string): Promise<AsepriteResult>;
  addGroup(filename: string, groupName: string, parentGroup?: string): Promise<AsepriteResult>;
  addLayer(filename: string, layerName: string, group?: string): Promise<AsepriteResult>;
  addFrame(filename: string): Promise<AsepriteResult>;
  addFrames(filename: string, count: number, durationMs?: number): Promise<AsepriteResult>;
  setFrame(filename: string, frameIndex: number): Promise<AsepriteResult>;
  setFrameDuration(filename: string, frameIndex: number, durationMs: number): Promise<AsepriteResult>;
  setFrameDurationAll(filename: string, durationMs: number): Promise<AsepriteResult>;
  setLayerVisibility(filename: string, layerName: string, visible?: boolean): Promise<AsepriteResult>;
  setLayerOpacity(filename: string, layerName: string, opacity: number): Promise<AsepriteResult>;
  setPalette(filename: string, colors: string[]): Promise<AsepriteResult>;
  drawPixels(filename: string, pixels: PixelInput[]): Promise<AsepriteResult>;
  drawLine(filename: string, x1: number, y1: number, x2: number, y2: number, color: string, thickness?: number): Promise<AsepriteResult>;
  drawRectangle(filename: string, x: number, y: number, width: number, height: number, color: string, fill?: boolean): Promise<AsepriteResult>;
  fillArea(filename: string, x: number, y: number, color: string): Promise<AsepriteResult>;
  drawCircle(filename: string, centerX: number, centerY: number, radius: number, color: string, fill?: boolean): Promise<AsepriteResult>;
  drawPixelsAt(filename: string, layerName: string, frameIndex: number, pixels: PixelInput[], createIfMissing?: boolean): Promise<AsepriteResult>;
  drawLineAt(filename: string, layerName: string, frameIndex: number, x1: number, y1: number, x2: number, y2: number, color: string, thickness?: number, createIfMissing?: boolean): Promise<AsepriteResult>;
  drawRectangleAt(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, color: string, fill?: boolean, createIfMissing?: boolean): Promise<AsepriteResult>;
  drawCircleAt(filename: string, layerName: string, frameIndex: number, centerX: number, centerY: number, radius: number, color: string, fill?: boolean, createIfMissing?: boolean): Promise<AsepriteResult>;
  fillAreaAt(filename: string, layerName: string, frameIndex: number, x: number, y: number, color: string, createIfMissing?: boolean): Promise<AsepriteResult>;
  drawPolygon(filename: string, layerName: string, frameIndex: number, points: PointInput[], color?: string, fill?: boolean, createIfMissing?: boolean): Promise<AsepriteResult>;
  drawPath(filename: string, layerName: string, frameIndex: number, points: PointInput[], color?: string, thickness?: number, createIfMissing?: boolean): Promise<AsepriteResult>;
  applyGradientRect(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorStart: string, colorEnd: string, horizontal?: boolean, createIfMissing?: boolean): Promise<AsepriteResult>;
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
