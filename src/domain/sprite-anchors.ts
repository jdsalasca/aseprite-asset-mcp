import type { AssetOperationResult } from "./asset-operations.js";
import type { AssetManifestWriter } from "./image-assets.js";
import type { SpriteGeometryPort } from "./sprite-geometry.js";

export interface SpriteAnchorsInput {
  filename: string;
  outputFilename: string;
  minComponentPixels?: number | undefined;
}

export interface SpriteAnchorsPort {
  generate(input: SpriteAnchorsInput): Promise<AssetOperationResult>;
}

export interface SpriteAnchorsDependencies {
  geometry: SpriteGeometryPort;
  manifestWriter: AssetManifestWriter;
}
