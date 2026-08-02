import type { AssetOperationResult } from "./asset-operations.js";
import type { AssetManifestWriter } from "./image-assets.js";
import type { SpriteGeometryPort } from "./sprite-geometry.js";

export type SpriteHitboxMode = "components" | "union";

export interface SpriteHitboxInput {
  filename: string;
  outputFilename: string;
  mode?: SpriteHitboxMode | undefined;
  padding?: number | undefined;
  minComponentPixels?: number | undefined;
}

export interface SpriteHitboxPort {
  generate(input: SpriteHitboxInput): Promise<AssetOperationResult>;
}

export interface SpriteHitboxDependencies {
  geometry: SpriteGeometryPort;
  manifestWriter: AssetManifestWriter;
}
