import type { AssetOperationResult } from "./asset-operations.js";
import type { AssetManifestWriter } from "./image-assets.js";
import type { AnimationSheetPort } from "./animation-sheet.js";
import type { SpriteHitboxMode, SpriteHitboxPort } from "./sprite-hitbox.js";

export interface SpriteRuntimeBundleInput {
  inputFilename: string;
  sheetFilename: string;
  sheetManifestFilename: string;
  hitboxManifestFilename: string;
  bundleManifestFilename: string;
  columns?: number | undefined;
  sheetPadding?: number | undefined;
  hitboxMode?: SpriteHitboxMode | undefined;
  hitboxPadding?: number | undefined;
  minComponentPixels?: number | undefined;
}

export interface SpriteRuntimeBundlePort {
  build(input: SpriteRuntimeBundleInput): Promise<AssetOperationResult>;
}

export interface SpriteRuntimeBundleDependencies {
  animationSheet: AnimationSheetPort;
  hitboxes: SpriteHitboxPort;
  manifestWriter: AssetManifestWriter;
}
