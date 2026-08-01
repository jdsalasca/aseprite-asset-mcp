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
  drawEllipseAt(filename: string, layerName: string, frameIndex: number, centerX: number, centerY: number, radiusX: number, radiusY: number, color?: string, fill?: boolean, createIfMissing?: boolean): Promise<AsepriteResult>;
  exportSprite(filename: string, outputFilename: string, format?: string): Promise<AsepriteResult>;
  copySprite(filename: string, outputFilename: string, overwrite?: boolean): Promise<AsepriteResult>;
  exportFrame(filename: string, frameIndex: number, outputFilename: string, scale?: number): Promise<AsepriteResult>;
  exportLayers(filename: string, outputDirectory: string, includeHidden?: boolean): Promise<AsepriteResult>;
  exportTag(filename: string, tagName: string, outputFilename: string, scale?: number): Promise<AsepriteResult>;
  importImageAsLayer(filename: string, imagePath: string, layerName: string, frameIndex?: number, x?: number, y?: number): Promise<AsepriteResult>;
  createCel(filename: string, layerName: string, frameIndex: number, x?: number, y?: number): Promise<AsepriteResult>;
  clearCel(filename: string, layerName: string, frameIndex: number): Promise<AsepriteResult>;
  copyCel(filename: string, layerName: string, sourceFrame: number, targetFrame: number, replace?: boolean): Promise<AsepriteResult>;
  copyFrame(filename: string, sourceFrame: number, targetFrame?: number, overwrite?: boolean): Promise<AsepriteResult>;
  setCelPosition(filename: string, layerName: string, frameIndex: number, x: number, y: number, createIfMissing?: boolean, sourceFrameIndex?: number): Promise<AsepriteResult>;
  tweenCelPositions(filename: string, layerName: string, startFrame: number, endFrame: number, startX: number, startY: number, endX: number, endY: number, createMissingCels?: boolean, sourceFrameIndex?: number): Promise<AsepriteResult>;
  offsetCelPositions(filename: string, layerName: string, startFrame: number, endFrame: number, dx: number, dy: number): Promise<AsepriteResult>;
  propagateFrameToRange(filename: string, sourceFrame: number, startFrame: number, endFrame: number, overwrite?: boolean): Promise<AsepriteResult>;
  deleteFrame(filename: string, frameIndex: number): Promise<AsepriteResult>;
  deleteTag(filename: string, name: string): Promise<AsepriteResult>;
  setOnionSkin(filename: string, enabled?: boolean, before?: number, after?: number, opacity?: number): Promise<AsepriteResult>;
  renderOnionSkin(filename: string, frameIndex: number, outputFilename: string, before?: number, after?: number, scale?: number, ghostOpacity?: number): Promise<AsepriteResult>;
  compareFrames(filename: string, frameA: number, frameB: number): Promise<AsepriteResult>;
  setCelOpacity(filename: string, layerName: string, frameIndex: number, opacity: number): Promise<AsepriteResult>;
  getColorStats(filename: string, frameIndex?: number, top?: number): Promise<AsepriteResult>;
  getPalette(filename: string): Promise<AsepriteResult>;
  extractPalette(filename: string, maxColors?: number, withAlpha?: boolean): Promise<AsepriteResult>;
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
