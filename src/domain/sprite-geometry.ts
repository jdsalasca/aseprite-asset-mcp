import type { AssetOperationResult } from "./asset-operations.js";
import type { RasterCodec } from "./image-assets.js";

export interface SpriteGeometryInput {
  filename: string;
  minComponentPixels?: number | undefined;
}

export interface SpriteGeometryPort {
  inspect(input: SpriteGeometryInput): Promise<AssetOperationResult>;
}

export interface SpriteGeometryDependencies { codec: RasterCodec; }
