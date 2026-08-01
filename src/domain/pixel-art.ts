export type DitherMode = "none" | "bayer4x4";
export type ResizeMode = "box" | "nearest";

export interface RasterFrame {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  delayMs?: number | undefined;
}

export interface PixelArtOptions {
  width: number;
  height: number;
  maxColors: number;
  resizeMode?: ResizeMode | undefined;
  dither?: DitherMode | undefined;
  alphaThreshold?: number | undefined;
}

export interface PixelArtQualityReport {
  width: number;
  height: number;
  colors: number;
  opaquePixels: number;
  transparentPixels: number;
  isolatedPixels: number;
}
