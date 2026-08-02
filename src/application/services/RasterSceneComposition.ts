import { resizeRasterFrame } from "./PixelArtPipeline.js";
import type { AssetSceneLayer } from "../../domain/asset-scene.js";
import type { RasterFrame } from "../../domain/pixel-art.js";

export type RasterScenePlacement = AssetSceneLayer & { x: number; y: number; width: number; height: number };

export interface RasterSceneCompositionFrame {
  frame: RasterFrame;
  placements: RasterScenePlacement[];
}

export interface RasterSceneCompositionInput {
  width: number;
  height: number;
  padding: number;
  layers: readonly AssetSceneLayer[];
  frames: readonly (readonly RasterFrame[])[];
  frameIndex?: number;
}

function fit(frame: RasterFrame, maxWidth: number, maxHeight: number): RasterFrame {
  if (frame.width <= 0 || frame.height <= 0 || frame.pixels.length !== frame.width * frame.height * 4) throw new Error("Scene layer frame has invalid raster dimensions");
  const scale = Math.min(1, maxWidth / frame.width, maxHeight / frame.height);
  if (scale === 1) return { ...frame, pixels: new Uint8ClampedArray(frame.pixels) };
  return resizeRasterFrame(frame, Math.max(1, Math.round(frame.width * scale)), Math.max(1, Math.round(frame.height * scale)), "nearest");
}

function composite(target: Uint8ClampedArray, targetWidth: number, targetHeight: number, source: RasterFrame, x: number, y: number): void {
  for (let sourceY = 0; sourceY < source.height; sourceY += 1) for (let sourceX = 0; sourceX < source.width; sourceX += 1) {
    const targetX = x + sourceX; const targetY = y + sourceY;
    if (targetX < 0 || targetY < 0 || targetX >= targetWidth || targetY >= targetHeight) continue;
    const sourceOffset = (sourceY * source.width + sourceX) * 4; const targetOffset = (targetY * targetWidth + targetX) * 4;
    const sourceAlpha = (source.pixels[sourceOffset + 3] ?? 0) / 255;
    if (sourceAlpha === 0) continue;
    const targetAlpha = (target[targetOffset + 3] ?? 0) / 255;
    const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
    for (let channel = 0; channel < 3; channel += 1) target[targetOffset + channel] = Math.round(((source.pixels[sourceOffset + channel] ?? 0) * sourceAlpha + (target[targetOffset + channel] ?? 0) * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
    target[targetOffset + 3] = Math.round(outputAlpha * 255);
  }
}

export function composeRasterSceneFrame(input: RasterSceneCompositionInput): RasterSceneCompositionFrame {
  if (input.frames.length !== input.layers.length) throw new Error("Scene layer frames must match scene layers");
  const frameIndex = input.frameIndex ?? 0;
  const drawableWidth = input.width - input.padding * 2;
  const drawableHeight = input.height - input.padding * 2;
  const pixels = new Uint8ClampedArray(input.width * input.height * 4);
  const placements: RasterScenePlacement[] = [];
  input.layers.forEach((layer, index) => {
    const availableFrames = input.frames[index];
    if (!availableFrames || availableFrames.length === 0) throw new Error(`Scene layer has no renderable frames: ${layer.assetId}`);
    const source = availableFrames[frameIndex % availableFrames.length];
    if (!source) throw new Error(`Scene layer frame is unavailable: ${layer.assetId}`);
    const fitted = fit(source, drawableWidth, drawableHeight);
    const x = input.padding + Math.floor((drawableWidth - fitted.width) / 2);
    const y = input.padding + Math.floor((drawableHeight - fitted.height) / 2);
    composite(pixels, input.width, input.height, fitted, x, y);
    placements.push({ ...layer, x, y, width: fitted.width, height: fitted.height });
  });
  return { frame: { width: input.width, height: input.height, pixels }, placements };
}
