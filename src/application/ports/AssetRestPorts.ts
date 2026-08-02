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
import type { AnimationQualityService } from "../services/AnimationQualityService.js";
import type { SpriteNormalizationService } from "../services/SpriteNormalizationService.js";
import type { AnimationSheetService } from "../services/AnimationSheetService.js";
import type { SpriteGeometryService } from "../services/SpriteGeometryService.js";
import type { SpriteHitboxService } from "../services/SpriteHitboxService.js";
import type { SpriteRuntimeBundleService } from "../services/SpriteRuntimeBundleService.js";
import type { SpriteAnchorsService } from "../services/SpriteAnchorsService.js";
import type { AssetLibraryAuditService } from "../services/AssetLibraryAuditService.js";
import type { AssetLibrarySummaryService } from "../services/AssetLibrarySummaryService.js";

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
  assetLibraryAudit: Pick<AssetLibraryAuditService, "audit">;
  assetLibrarySummary: Pick<AssetLibrarySummaryService, "summarize">;
  imageAssets: Pick<PixelArtAssetService, "upscalePixelArt" | "qualityBundle" | "harmonizePalette">;
  batchQuality: Pick<AssetBatchQualityService, "inspect">;
  animationQuality: Pick<AnimationQualityService, "inspect">;
  spriteNormalization: Pick<SpriteNormalizationService, "normalize">;
  animationSheet: Pick<AnimationSheetService, "build">;
  spriteGeometry: Pick<SpriteGeometryService, "inspect">;
  spriteHitbox: Pick<SpriteHitboxService, "generate">;
  spriteRuntimeBundle: Pick<SpriteRuntimeBundleService, "build">;
  spriteAnchors: Pick<SpriteAnchorsService, "generate">;
  contactSheet: Pick<ContactSheetService, "build">;
  visualAssets: Pick<VisualAssetGateway, "extendScene" | "generateBiomeTransition">;
}

export type AssetRestEffectInput = PixelOutlineInput | ColorGradeInput | SpriteShadowInput | ParticleBurstInput | NormalMapInput;
