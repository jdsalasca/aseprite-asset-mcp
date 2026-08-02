import type { AssetLibraryItem } from "./asset-library.js";

export interface AssetSceneRecommendationInput {
  prompt?: string;
  category?: string;
  requiredKinds?: AssetLibraryItem["kind"][];
  requiredTags?: string[];
  requiredVariants?: string[];
  limit?: number;
  seed?: number;
}

export interface AssetSceneRecommendation {
  assetId: string;
  title: string;
  category: string;
  kind: AssetLibraryItem["kind"];
  score: number;
  reasons: string[];
  tags: string[];
  variants: string[];
}

export interface AssetSceneRecommendationResult {
  operation: "recommend_asset_scene";
  libraryVersion: string;
  input: Required<Pick<AssetSceneRecommendationInput, "limit" | "seed">> & Omit<AssetSceneRecommendationInput, "limit" | "seed">;
  recommendations: AssetSceneRecommendation[];
  suggestedItemIds: string[];
  coveredKinds: AssetLibraryItem["kind"][];
  coveredTags: string[];
  coveredVariants: string[];
  deterministic: true;
  sourcePreserved: true;
}
