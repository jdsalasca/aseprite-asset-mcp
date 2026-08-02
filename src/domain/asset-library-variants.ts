import type { AssetOperationResult } from "./asset-operations.js";
import type { AssetVariantArtifact, AssetVariantKind } from "./asset-variant-pack.js";

export interface AssetLibraryVariantPackInput {
  itemIds: string[];
  outputPrefix: string;
  variants: AssetVariantKind[];
  frames: number;
  seed: number;
  delayMs?: number;
}

export interface AssetLibraryVariantAssetResult {
  assetId: string;
  title: string;
  outputPrefix: string;
  artifacts: AssetVariantArtifact[];
}

export interface AssetLibraryVariantPackResult {
  operation: "generate_library_variant_pack";
  manifest: string;
  libraryVersion: string;
  itemIds: string[];
  outputPrefix: string;
  variants: AssetVariantKind[];
  frames: number;
  seed: number;
  assets: AssetLibraryVariantAssetResult[];
  deterministic: true;
  sourcePreserved: true;
}

export interface AssetLibraryVariantPackGateway {
  generate(input: AssetLibraryVariantPackInput): Promise<AssetOperationResult>;
}
