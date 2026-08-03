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

export interface PixelArtSubjectReport {
  width: number;
  height: number;
  opaquePixels: number;
  coverage: number;
  edgePixels: number;
  connectedComponents: number;
  largestComponentRatio: number;
  distinctRowSpans: number;
  transparentBorder: boolean;
}

export interface PixelArtQualityGateOptions {
  minOpaquePixels?: number | undefined;
  minCoverage?: number | undefined;
  maxCoverage?: number | undefined;
  minEdgePixels?: number | undefined;
  minDistinctRowSpans?: number | undefined;
  maxComponents?: number | undefined;
  minLargestComponentRatio?: number | undefined;
  requireTransparentBorder?: boolean | undefined;
}

export interface PixelArtQualityGateReport extends PixelArtSubjectReport {
  valid: boolean;
  violations: string[];
}
