import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetRecipeCreateInput, AssetRecipePlan } from "../../domain/asset-recipe.js";
import type { AssetRecipeExecutionResult } from "../services/AssetRecipeExecutionService.js";
import type { ColorGradeInput, NormalMapInput, ParticleBurstInput, PixelOutlineInput, SpriteEffectsGateway, SpriteShadowInput } from "../../domain/sprite-effects.js";
import type { DepthLightingInput, MaterialTextureInput } from "../../domain/visual-assets.js";
import type { AssetLibraryService } from "../services/AssetLibraryService.js";
import type { VisualAssetGateway } from "../../domain/visual-assets.js";
import type { PixelArtAssetService } from "../services/PixelArtAssetService.js";
import type { AssetVariantPackGateway } from "../../domain/asset-variant-pack.js";

export interface AssetRestUseCases {
  createRecipe(input: AssetRecipeCreateInput): AssetRecipePlan;
  executeRecipe(input: AssetRecipeCreateInput): Promise<AssetRecipeExecutionResult>;
  spriteEffects: SpriteEffectsGateway;
  variantPack: AssetVariantPackGateway;
  applyMaterialTexture(input: MaterialTextureInput): Promise<AssetOperationResult>;
  applyDepthLighting(input: DepthLightingInput): Promise<AssetOperationResult>;
  assetLibrary: AssetLibraryService;
  imageAssets: Pick<PixelArtAssetService, "upscalePixelArt">;
  visualAssets: Pick<VisualAssetGateway, "extendScene">;
}

export type AssetRestEffectInput = PixelOutlineInput | ColorGradeInput | SpriteShadowInput | ParticleBurstInput | NormalMapInput;
