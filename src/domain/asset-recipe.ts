export const ASSET_RECIPE_STEPS = ["outline", "color_grade", "material_texture", "depth_lighting", "shadow", "particles", "normal_map", "quality_gate"] as const;
export type AssetRecipeStep = typeof ASSET_RECIPE_STEPS[number];
export type AssetRecipeFormat = "png" | "gif";

export interface AssetRecipeCreateInput {
  assetId: string;
  inputFilename: string;
  outputPrefix: string;
  format?: AssetRecipeFormat | undefined;
  steps: readonly AssetRecipeStep[];
  seed?: number | undefined;
  material?: "water" | "earth" | "grass" | "stone" | "snow" | undefined;
  direction?: "north" | "south" | "east" | "west" | "north_east" | "north_west" | "south_east" | "south_west" | undefined;
}

export interface AssetRecipeStepPlan {
  id: AssetRecipeStep;
  operation: string;
  inputFilename: string;
  outputFilename?: string | undefined;
  arguments: Record<string, number | string | boolean>;
}

export interface AssetRecipePlan {
  recipeId: string;
  schemaVersion: 1;
  algorithmVersion: string;
  assetId: string;
  inputFilename: string;
  outputPrefix: string;
  format: AssetRecipeFormat;
  seed: number;
  steps: AssetRecipeStepPlan[];
  sourcePreserved: true;
  deterministic: true;
}
