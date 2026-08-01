export interface AssetOperationResult {
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

export type AnimationEasing = "linear" | "ease_in" | "ease_out" | "ease_in_out" | "smoothstep";
export type ScaleAnchor = "center" | "topleft";

export interface AssetRuntimePort {
  createCanvas(width: number, height: number, filename: string): Promise<AssetOperationResult>;
  addGroup(filename: string, groupName: string, parentGroup?: string): Promise<AssetOperationResult>;
  addLayer(filename: string, layerName: string, group?: string): Promise<AssetOperationResult>;
  deleteLayer(filename: string, layerName: string): Promise<AssetOperationResult>;
  renameLayer(filename: string, layerName: string, newName: string): Promise<AssetOperationResult>;
  duplicateLayer(filename: string, layerName: string, newName?: string, group?: string): Promise<AssetOperationResult>;
  reorderLayer(filename: string, layerName: string, position: number): Promise<AssetOperationResult>;
  setLayerBlendMode(filename: string, layerName: string, mode: string): Promise<AssetOperationResult>;
  mergeLayerDown(filename: string, layerName: string): Promise<AssetOperationResult>;
  flattenSprite(filename: string): Promise<AssetOperationResult>;
  addFrame(filename: string): Promise<AssetOperationResult>;
  addFrames(filename: string, count: number, durationMs?: number): Promise<AssetOperationResult>;
  setFrame(filename: string, frameIndex: number): Promise<AssetOperationResult>;
  setFrameDuration(filename: string, frameIndex: number, durationMs: number): Promise<AssetOperationResult>;
  setFrameDurationAll(filename: string, durationMs: number): Promise<AssetOperationResult>;
  setLayerVisibility(filename: string, layerName: string, visible?: boolean): Promise<AssetOperationResult>;
  setLayerOpacity(filename: string, layerName: string, opacity: number): Promise<AssetOperationResult>;
  setPalette(filename: string, colors: string[]): Promise<AssetOperationResult>;
  drawPixels(filename: string, pixels: PixelInput[]): Promise<AssetOperationResult>;
  drawLine(filename: string, x1: number, y1: number, x2: number, y2: number, color: string, thickness?: number): Promise<AssetOperationResult>;
  drawRectangle(filename: string, x: number, y: number, width: number, height: number, color: string, fill?: boolean): Promise<AssetOperationResult>;
  fillArea(filename: string, x: number, y: number, color: string): Promise<AssetOperationResult>;
  drawCircle(filename: string, centerX: number, centerY: number, radius: number, color: string, fill?: boolean): Promise<AssetOperationResult>;
  drawPixelsAt(filename: string, layerName: string, frameIndex: number, pixels: PixelInput[], createIfMissing?: boolean): Promise<AssetOperationResult>;
  drawLineAt(filename: string, layerName: string, frameIndex: number, x1: number, y1: number, x2: number, y2: number, color: string, thickness?: number, createIfMissing?: boolean): Promise<AssetOperationResult>;
  drawRectangleAt(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, color: string, fill?: boolean, createIfMissing?: boolean): Promise<AssetOperationResult>;
  drawCircleAt(filename: string, layerName: string, frameIndex: number, centerX: number, centerY: number, radius: number, color: string, fill?: boolean, createIfMissing?: boolean): Promise<AssetOperationResult>;
  fillAreaAt(filename: string, layerName: string, frameIndex: number, x: number, y: number, color: string, createIfMissing?: boolean): Promise<AssetOperationResult>;
  drawPolygon(filename: string, layerName: string, frameIndex: number, points: PointInput[], color?: string, fill?: boolean, createIfMissing?: boolean): Promise<AssetOperationResult>;
  drawPath(filename: string, layerName: string, frameIndex: number, points: PointInput[], color?: string, thickness?: number, createIfMissing?: boolean): Promise<AssetOperationResult>;
  applyGradientRect(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorStart: string, colorEnd: string, horizontal?: boolean, createIfMissing?: boolean): Promise<AssetOperationResult>;
  drawEllipseAt(filename: string, layerName: string, frameIndex: number, centerX: number, centerY: number, radiusX: number, radiusY: number, color?: string, fill?: boolean, createIfMissing?: boolean): Promise<AssetOperationResult>;
  exportSprite(filename: string, outputFilename: string, format?: string): Promise<AssetOperationResult>;
  copySprite(filename: string, outputFilename: string, overwrite?: boolean): Promise<AssetOperationResult>;
  exportFrame(filename: string, frameIndex: number, outputFilename: string, scale?: number): Promise<AssetOperationResult>;
  exportLayers(filename: string, outputDirectory: string, includeHidden?: boolean): Promise<AssetOperationResult>;
  exportTag(filename: string, tagName: string, outputFilename: string, scale?: number): Promise<AssetOperationResult>;
  importImageAsLayer(filename: string, imagePath: string, layerName: string, frameIndex?: number, x?: number, y?: number): Promise<AssetOperationResult>;
  createCel(filename: string, layerName: string, frameIndex: number, x?: number, y?: number): Promise<AssetOperationResult>;
  clearCel(filename: string, layerName: string, frameIndex: number): Promise<AssetOperationResult>;
  copyCel(filename: string, layerName: string, sourceFrame: number, targetFrame: number, replace?: boolean): Promise<AssetOperationResult>;
  copyFrame(filename: string, sourceFrame: number, targetFrame?: number, overwrite?: boolean): Promise<AssetOperationResult>;
  setCelPosition(filename: string, layerName: string, frameIndex: number, x: number, y: number, createIfMissing?: boolean, sourceFrameIndex?: number): Promise<AssetOperationResult>;
  tweenCelPositions(filename: string, layerName: string, startFrame: number, endFrame: number, startX: number, startY: number, endX: number, endY: number, createMissingCels?: boolean, sourceFrameIndex?: number): Promise<AssetOperationResult>;
  offsetCelPositions(filename: string, layerName: string, startFrame: number, endFrame: number, dx: number, dy: number): Promise<AssetOperationResult>;
  propagateFrameToRange(filename: string, sourceFrame: number, startFrame: number, endFrame: number, overwrite?: boolean): Promise<AssetOperationResult>;
  deleteFrame(filename: string, frameIndex: number): Promise<AssetOperationResult>;
  deleteTag(filename: string, name: string): Promise<AssetOperationResult>;
  setOnionSkin(filename: string, enabled?: boolean, before?: number, after?: number, opacity?: number): Promise<AssetOperationResult>;
  renderOnionSkin(filename: string, frameIndex: number, outputFilename: string, before?: number, after?: number, scale?: number, ghostOpacity?: number): Promise<AssetOperationResult>;
  compareFrames(filename: string, frameA: number, frameB: number): Promise<AssetOperationResult>;
  setCelOpacity(filename: string, layerName: string, frameIndex: number, opacity: number): Promise<AssetOperationResult>;
  getColorStats(filename: string, frameIndex?: number, top?: number): Promise<AssetOperationResult>;
  getPalette(filename: string): Promise<AssetOperationResult>;
  extractPalette(filename: string, maxColors?: number, withAlpha?: boolean): Promise<AssetOperationResult>;
  outlineNative(filename: string, layerName?: string, frameIndex?: number, color?: string, place?: string, matrix?: string): Promise<AssetOperationResult>;
  adjustHslNative(filename: string, layerName?: string, frameIndex?: number, hue?: number, saturation?: number, lightness?: number, x?: number, y?: number, width?: number, height?: number): Promise<AssetOperationResult>;
  adjustBrightnessContrast(filename: string, layerName?: string, frameIndex?: number, brightness?: number, contrast?: number, x?: number, y?: number, width?: number, height?: number): Promise<AssetOperationResult>;
  invertColors(filename: string, layerName?: string, frameIndex?: number, x?: number, y?: number, width?: number, height?: number): Promise<AssetOperationResult>;
  outlineCel(filename: string, layerName: string, frameIndex: number, color?: string, includeDiagonals?: boolean): Promise<AssetOperationResult>;
  replaceColor(filename: string, layerName: string, frameIndex: number, fromColor: string, toColor: string, tolerance?: number): Promise<AssetOperationResult>;
  adjustHsl(filename: string, layerName: string, frameIndex: number, hueShift?: number, saturationShift?: number, lightnessShift?: number): Promise<AssetOperationResult>;
  remapColorsInCelRange(filename: string, layerName: string, startFrame: number, endFrame: number, mappings: Array<{ from: string; to: string }>, createMissingCels?: boolean, sourceFrameIndex?: number): Promise<AssetOperationResult>;
  listPalettePresets(): Promise<AssetOperationResult>;
  applyPalettePreset(filename: string, preset: string): Promise<AssetOperationResult>;
  generateColorRamp(baseColor: string, steps?: number, hueShiftDegrees?: number, lightnessRange?: number): Promise<AssetOperationResult>;
  quantizeToPalette(filename: string, layerName?: string, startFrame?: number, endFrame?: number): Promise<AssetOperationResult>;
  setColorMode(filename: string, mode: string): Promise<AssetOperationResult>;
  getPixelColor(filename: string, x: number, y: number, layerName?: string, frameIndex?: number): Promise<AssetOperationResult>;
  getPixelsRect(filename: string, x: number, y: number, width: number, height: number, layerName?: string, frameIndex?: number): Promise<AssetOperationResult>;
  getCompositePixel(filename: string, x: number, y: number, frameIndex?: number): Promise<AssetOperationResult>;
  getCompositeRect(filename: string, x: number, y: number, width: number, height: number, frameIndex?: number): Promise<AssetOperationResult>;
  moveRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, destX: number, destY: number): Promise<AssetOperationResult>;
  copyRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, destX: number, destY: number, targetLayerName?: string, targetFrameIndex?: number): Promise<AssetOperationResult>;
  eraseRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number): Promise<AssetOperationResult>;
  eraseColor(filename: string, layerName: string, frameIndex: number, color: string, tolerance?: number): Promise<AssetOperationResult>;
  flipLayer(filename: string, layerName: string, frameIndex: number, direction?: "horizontal" | "vertical"): Promise<AssetOperationResult>;
  rotateLayer(filename: string, layerName: string, frameIndex: number, angle?: 90 | 180 | 270): Promise<AssetOperationResult>;
  resizeCanvas(filename: string, width: number, height: number): Promise<AssetOperationResult>;
  cropCanvas(filename: string, x: number, y: number, width: number, height: number): Promise<AssetOperationResult>;
  listTextFonts(): Promise<AssetOperationResult>;
  measureText(text: string, font: string, size?: number, letterSpacing?: number, bold?: number, antialias?: boolean): Promise<AssetOperationResult>;
  drawText(input: TextDrawInput): Promise<AssetOperationResult>;
  drawOnTile(filename: string, layerName: string, tileIndex: number, pixels: TilePixelInput[]): Promise<AssetOperationResult>;
  setTiles(filename: string, layerName: string, frameIndex: number, tiles: TilePlacementInput[]): Promise<AssetOperationResult>;
  getTileAt(filename: string, layerName: string, frameIndex: number, col: number, row: number): Promise<AssetOperationResult>;
  getTilemapInfo(filename: string, layerName: string): Promise<AssetOperationResult>;
  createSlice(filename: string, name: string, x: number, y: number, width: number, height: number): Promise<AssetOperationResult>;
  setSliceCenter(filename: string, name: string, x: number, y: number, width: number, height: number): Promise<AssetOperationResult>;
  setSlicePivot(filename: string, name: string, x: number, y: number): Promise<AssetOperationResult>;
  listSlices(filename: string): Promise<AssetOperationResult>;
  deleteSlice(filename: string, name: string): Promise<AssetOperationResult>;
  ensureLayersPresent(filename: string, layerNames: string[], startFrame?: number, endFrame?: number): Promise<AssetOperationResult>;
  auditAnimation(input: AnimationAuditInput): Promise<AssetOperationResult>;
  animationSanitize(input: AnimationSanitizeInput): Promise<AssetOperationResult>;
  startPreviewServer(directory: string, port?: number): Promise<AssetOperationResult>;
  stopPreviewServer(port?: number): Promise<AssetOperationResult>;
  copyLayersBetweenSprites(input: CopyLayersInput): Promise<AssetOperationResult>;
  getSpriteInfo(filename: string): Promise<AssetOperationResult>;
  duplicateFrameRange(filename: string, startFrame: number, endFrame: number, times?: number): Promise<AssetOperationResult>;
  propagateCels(filename: string, layerNames: string[], sourceFrame: number, startFrame: number, endFrame: number, replace?: boolean): Promise<AssetOperationResult>;
  tweenCelPositionsEased(filename: string, layerName: string, startFrame: number, endFrame: number, startX: number, startY: number, endX: number, endY: number, easing?: AnimationEasing, createMissingCels?: boolean, sourceFrameIndex?: number): Promise<AssetOperationResult>;
  oscillateCelPositions(filename: string, layerName: string, startFrame: number, endFrame: number, amplitudeX?: number, amplitudeY?: number, cycles?: number, phaseDeg?: number, createMissingCels?: boolean, sourceFrameIndex?: number): Promise<AssetOperationResult>;
  tweenCelOpacityEased(filename: string, layerName: string, startFrame: number, endFrame: number, startOpacity: number, endOpacity: number, easing?: AnimationEasing, createMissingCels?: boolean, sourceFrameIndex?: number): Promise<AssetOperationResult>;
  tweenCelScaleEased(filename: string, layerName: string, startFrame: number, endFrame: number, startScale: number, endScale: number, easing?: AnimationEasing, anchor?: ScaleAnchor, replace?: boolean, createMissingCels?: boolean, sourceFrameIndex?: number): Promise<AssetOperationResult>;
  setLayer(filename: string, layerName: string, createIfMissing?: boolean): Promise<AssetOperationResult>;
  animationWorkflowGuide(useCase?: string): Promise<AssetOperationResult>;
  runLuaScript(script: string, filename?: string): Promise<AssetOperationResult>;
  applyConvolution(filename: string, matrix: string, layerName?: string, frameIndex?: number, x?: number, y?: number, width?: number, height?: number): Promise<AssetOperationResult>;
  listConvolutionMatrices(): Promise<AssetOperationResult>;
  applyDitherGradient(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorStart: string, colorEnd: string, horizontal?: boolean, createIfMissing?: boolean): Promise<AssetOperationResult>;
  applyDitherPattern(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorA: string, colorB: string, density?: number, createIfMissing?: boolean): Promise<AssetOperationResult>;
  setTag(filename: string, name: string, fromFrame: number, toFrame: number, direction?: string): Promise<AssetOperationResult>;
  createTilemapLayer(filename: string, layerName: string, tileWidth: number, tileHeight: number): Promise<AssetOperationResult>;
  validateScene(filename: string, requiredLayers: string[], startFrame?: number, endFrame?: number): Promise<AssetOperationResult>;
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
  }): Promise<AssetOperationResult>;
}
