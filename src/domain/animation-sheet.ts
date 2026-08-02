import type { AssetOperationResult } from "./asset-operations.js";
import type { AssetManifestWriter, RasterCodec } from "./image-assets.js";

export interface AnimationSheetInput {
  inputFilename: string;
  outputFilename: string;
  manifestFilename: string;
  columns?: number | undefined;
  padding?: number | undefined;
}

export interface AnimationSheetPort {
  build(input: AnimationSheetInput): Promise<AssetOperationResult>;
}

export interface AnimationSheetDependencies {
  codec: RasterCodec;
  manifestWriter: AssetManifestWriter;
}
