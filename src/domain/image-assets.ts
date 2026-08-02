import type { PixelArtOptions, PixelArtQualityReport, RasterFrame } from "./pixel-art.js";

export type ImageOutputFormat = "png" | "gif";

export interface RasterCodec {
  decode(filename: string): Promise<RasterFrame[]>;
  encode(frames: RasterFrame[], filename: string, format: ImageOutputFormat): Promise<void>;
}

export interface ConvertImageInput extends PixelArtOptions {
  inputFilename: string;
  outputFilename: string;
  format?: ImageOutputFormat | undefined;
}

export interface UpscalePixelArtInput {
  inputFilename: string;
  outputFilename: string;
  scale: number;
  format?: ImageOutputFormat | undefined;
}

export interface PaletteHarmonizeInput {
  inputFilename: string;
  outputFilename: string;
  accentColor: string;
  strength: number;
  maxColors: number;
  format?: ImageOutputFormat | undefined;
}

export interface AssetInspection {
  filename: string;
  frameCount: number;
  width: number;
  height: number;
  totalColors: number;
  reports: PixelArtQualityReport[];
  delaysMs: number[];
}

export interface AssetQualityInput {
  filename: string;
  maxColors?: number | undefined;
  maxIsolatedPixels?: number | undefined;
}

export interface AssetQualityBundleInput extends AssetQualityInput {}

export interface TextureAtlasInput {
  inputFilenames: string[];
  outputFilename: string;
  columns?: number | undefined;
  padding?: number | undefined;
}

export interface AssetPackInput extends TextureAtlasInput {
  manifestFilename: string;
}

export interface ContactSheetInput {
  inputFilenames: string[];
  outputFilename: string;
  manifestFilename: string;
  cellWidth: number;
  cellHeight: number;
  columns?: number | undefined;
  padding?: number | undefined;
}

export interface AssetManifestWriter {
  write(filename: string, value: unknown): Promise<void>;
}

export interface AssetManifestReader {
  read<T>(filename: string): Promise<T>;
}

export type AssetRecipe = "pixel_art" | "animation_pixel_art" | "gif" | "atlas";

export interface AssetRecipeInput {
  recipe: AssetRecipe;
  inputFilenames: string[];
  outputFilename?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  maxColors?: number | undefined;
  dryRun?: boolean | undefined;
}

export interface BatchAssetJobInput {
  jobs: AssetRecipeInput[];
  dryRun?: boolean | undefined;
}
