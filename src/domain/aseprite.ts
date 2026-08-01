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

export interface TextDrawInput {
  filename: string;
  text: string;
  x: number;
  y: number;
  font: string;
  size?: number | undefined;
  color?: string | undefined;
  layerName?: string | undefined;
  frameIndex?: number | undefined;
  anchor?: string | undefined;
  letterSpacing?: number | undefined;
  bold?: number | undefined;
  outlineColor?: string | undefined;
  outlineWidth?: number | undefined;
  outlineDiagonal?: boolean | undefined;
  shadowColor?: string | undefined;
  shadowDx?: number | undefined;
  shadowDy?: number | undefined;
  antialias?: boolean | undefined;
  createIfMissing?: boolean | undefined;
}

export interface TilePixelInput {
  x: number;
  y: number;
  color: string;
}

export interface TilePlacementInput {
  col: number;
  row: number;
  tileIndex: number;
}

export interface AnimationAuditInput {
  filename: string;
  startFrame?: number | undefined;
  endFrame?: number | undefined;
  layerNames?: string[] | undefined;
  overlapPairs?: string[] | undefined;
  layerFrameRanges?: string[] | undefined;
  reportCels?: boolean | undefined;
  reportBounds?: boolean | undefined;
  maxOverlaps?: number | undefined;
  maxOutOfRange?: number | undefined;
}

export interface AnimationSanitizeInput extends AnimationAuditInput {
  layerOrder?: string[] | undefined;
  ensureLayers?: string[] | undefined;
  outOfRangeAction?: "set_opacity_zero" | "delete_cels" | "none" | undefined;
  outOfRangeOpacity?: number | undefined;
  reportOnly?: boolean | undefined;
  includeStats?: boolean | undefined;
  ignoreFullCanvasOverlaps?: boolean | undefined;
}

export interface CopyLayersInput {
  sourceFilename: string;
  targetFilename: string;
  layerNames: string[];
  replace?: boolean | undefined;
  createMissingFrames?: boolean | undefined;
}

export interface AsepriteGateway {
  createCanvas(width: number, height: number, filename: string): Promise<AsepriteResult>;
  addGroup(filename: string, groupName: string, parentGroup?: string): Promise<AsepriteResult>;
  addLayer(filename: string, layerName: string, group?: string): Promise<AsepriteResult>;
  deleteLayer(filename: string, layerName: string): Promise<AsepriteResult>;
  renameLayer(filename: string, layerName: string, newName: string): Promise<AsepriteResult>;
  duplicateLayer(filename: string, layerName: string, newName?: string, group?: string): Promise<AsepriteResult>;
  reorderLayer(filename: string, layerName: string, position: number): Promise<AsepriteResult>;
  setLayerBlendMode(filename: string, layerName: string, mode: string): Promise<AsepriteResult>;
  mergeLayerDown(filename: string, layerName: string): Promise<AsepriteResult>;
  flattenSprite(filename: string): Promise<AsepriteResult>;
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
  outlineNative(filename: string, layerName?: string, frameIndex?: number, color?: string, place?: string, matrix?: string): Promise<AsepriteResult>;
  adjustHslNative(filename: string, layerName?: string, frameIndex?: number, hue?: number, saturation?: number, lightness?: number, x?: number, y?: number, width?: number, height?: number): Promise<AsepriteResult>;
  adjustBrightnessContrast(filename: string, layerName?: string, frameIndex?: number, brightness?: number, contrast?: number, x?: number, y?: number, width?: number, height?: number): Promise<AsepriteResult>;
  invertColors(filename: string, layerName?: string, frameIndex?: number, x?: number, y?: number, width?: number, height?: number): Promise<AsepriteResult>;
  outlineCel(filename: string, layerName: string, frameIndex: number, color?: string, includeDiagonals?: boolean): Promise<AsepriteResult>;
  replaceColor(filename: string, layerName: string, frameIndex: number, fromColor: string, toColor: string, tolerance?: number): Promise<AsepriteResult>;
  adjustHsl(filename: string, layerName: string, frameIndex: number, hueShift?: number, saturationShift?: number, lightnessShift?: number): Promise<AsepriteResult>;
  remapColorsInCelRange(filename: string, layerName: string, startFrame: number, endFrame: number, mappings: Array<{ from: string; to: string }>, createMissingCels?: boolean, sourceFrameIndex?: number): Promise<AsepriteResult>;
  listPalettePresets(): Promise<AsepriteResult>;
  applyPalettePreset(filename: string, preset: string): Promise<AsepriteResult>;
  generateColorRamp(baseColor: string, steps?: number, hueShiftDegrees?: number, lightnessRange?: number): Promise<AsepriteResult>;
  quantizeToPalette(filename: string, layerName?: string, startFrame?: number, endFrame?: number): Promise<AsepriteResult>;
  setColorMode(filename: string, mode: string): Promise<AsepriteResult>;
  getPixelColor(filename: string, x: number, y: number, layerName?: string, frameIndex?: number): Promise<AsepriteResult>;
  getPixelsRect(filename: string, x: number, y: number, width: number, height: number, layerName?: string, frameIndex?: number): Promise<AsepriteResult>;
  getCompositePixel(filename: string, x: number, y: number, frameIndex?: number): Promise<AsepriteResult>;
  getCompositeRect(filename: string, x: number, y: number, width: number, height: number, frameIndex?: number): Promise<AsepriteResult>;
  moveRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, destX: number, destY: number): Promise<AsepriteResult>;
  copyRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, destX: number, destY: number, targetLayerName?: string, targetFrameIndex?: number): Promise<AsepriteResult>;
  eraseRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number): Promise<AsepriteResult>;
  eraseColor(filename: string, layerName: string, frameIndex: number, color: string, tolerance?: number): Promise<AsepriteResult>;
  flipLayer(filename: string, layerName: string, frameIndex: number, direction?: "horizontal" | "vertical"): Promise<AsepriteResult>;
  rotateLayer(filename: string, layerName: string, frameIndex: number, angle?: 90 | 180 | 270): Promise<AsepriteResult>;
  resizeCanvas(filename: string, width: number, height: number): Promise<AsepriteResult>;
  cropCanvas(filename: string, x: number, y: number, width: number, height: number): Promise<AsepriteResult>;
  listTextFonts(): Promise<AsepriteResult>;
  measureText(text: string, font: string, size?: number, letterSpacing?: number, bold?: number, antialias?: boolean): Promise<AsepriteResult>;
  drawText(input: TextDrawInput): Promise<AsepriteResult>;
  drawOnTile(filename: string, layerName: string, tileIndex: number, pixels: TilePixelInput[]): Promise<AsepriteResult>;
  setTiles(filename: string, layerName: string, frameIndex: number, tiles: TilePlacementInput[]): Promise<AsepriteResult>;
  getTileAt(filename: string, layerName: string, frameIndex: number, col: number, row: number): Promise<AsepriteResult>;
  getTilemapInfo(filename: string, layerName: string): Promise<AsepriteResult>;
  createSlice(filename: string, name: string, x: number, y: number, width: number, height: number): Promise<AsepriteResult>;
  setSliceCenter(filename: string, name: string, x: number, y: number, width: number, height: number): Promise<AsepriteResult>;
  setSlicePivot(filename: string, name: string, x: number, y: number): Promise<AsepriteResult>;
  listSlices(filename: string): Promise<AsepriteResult>;
  deleteSlice(filename: string, name: string): Promise<AsepriteResult>;
  ensureLayersPresent(filename: string, layerNames: string[], startFrame?: number, endFrame?: number): Promise<AsepriteResult>;
  auditAnimation(input: AnimationAuditInput): Promise<AsepriteResult>;
  animationSanitize(input: AnimationSanitizeInput): Promise<AsepriteResult>;
  startPreviewServer(directory: string, port?: number): Promise<AsepriteResult>;
  stopPreviewServer(port?: number): Promise<AsepriteResult>;
  copyLayersBetweenSprites(input: CopyLayersInput): Promise<AsepriteResult>;
  applyConvolution(filename: string, matrix: string, layerName?: string, frameIndex?: number, x?: number, y?: number, width?: number, height?: number): Promise<AsepriteResult>;
  listConvolutionMatrices(): Promise<AsepriteResult>;
  applyDitherGradient(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorStart: string, colorEnd: string, horizontal?: boolean, createIfMissing?: boolean): Promise<AsepriteResult>;
  applyDitherPattern(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorA: string, colorB: string, density?: number, createIfMissing?: boolean): Promise<AsepriteResult>;
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
