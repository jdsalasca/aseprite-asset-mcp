import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetRecipeCreateInput, AssetRecipePlan } from "../../domain/asset-recipe.js";
import type { AssetRecipeExecutionResult } from "../services/AssetRecipeExecutionService.js";
import type { ColorGradeInput, NormalMapInput, ParticleBurstInput, PixelOutlineInput, SpriteEffectsGateway, SpriteShadowInput } from "../../domain/sprite-effects.js";
import type { DepthLightingInput, MaterialTextureInput } from "../../domain/visual-assets.js";
import type { AssetLibraryService } from "../services/AssetLibraryService.js";
import type { VisualAssetGateway } from "../../domain/visual-assets.js";
import type { PixelArtAssetService } from "../services/PixelArtAssetService.js";
import type { AssetVariantPackGateway } from "../../domain/asset-variant-pack.js";
import type { AssetPresetGenerationGateway } from "../../domain/asset-preset-generation.js";
import type { SceneEffectStackGateway } from "../../domain/scene-effect-stack.js";
import type { ContactSheetService } from "../services/ContactSheetService.js";
import type { AssetBatchQualityService } from "../services/AssetBatchQualityService.js";

export interface AssetRestUseCases {
  createRecipe(input: AssetRecipeCreateInput): AssetRecipePlan;
  executeRecipe(input: AssetRecipeCreateInput): Promise<AssetRecipeExecutionResult>;
  spriteEffects: SpriteEffectsGateway;
  variantPack: AssetVariantPackGateway;
  presetGeneration: AssetPresetGenerationGateway;
  sceneEffectStack: SceneEffectStackGateway;
  applyMaterialTexture(input: MaterialTextureInput): Promise<AssetOperationResult>;
  applyDepthLighting(input: DepthLightingInput): Promise<AssetOperationResult>;
  assetLibrary: AssetLibraryService;
  imageAssets: Pick<PixelArtAssetService, "upscalePixelArt" | "qualityBundle" | "harmonizePalette">;
  batchQuality: Pick<AssetBatchQualityService, "inspect">;
  contactSheet: Pick<ContactSheetService, "build">;
  visualAssets: Pick<VisualAssetGateway, "extendScene" | "generateBiomeTransition">;
}

export type AssetRestEffectInput = PixelOutlineInput | ColorGradeInput | SpriteShadowInput | ParticleBurstInput | NormalMapInput;
