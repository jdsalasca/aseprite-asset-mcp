import type { AssetOperationResult } from "./asset-operations.js";
import type { ImageOutputFormat, RasterCodec, AssetManifestWriter } from "./image-assets.js";

export type SpritePivotMode = "center" | "bottom_center";

export interface SpriteNormalizationInput {
  inputFilename: string;
  outputFilename: string;
  manifestFilename: string;
  padding?: number | undefined;
  pivot?: SpritePivotMode | undefined;
  format?: ImageOutputFormat | undefined;
}

export interface SpriteNormalizationPort {
  normalize(input: SpriteNormalizationInput): Promise<AssetOperationResult>;
}

export interface SpriteNormalizationDependencies {
  codec: RasterCodec;
  manifestWriter: AssetManifestWriter;
}
