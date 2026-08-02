import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetRecipeCreateInput, AssetRecipePlan } from "../../domain/asset-recipe.js";
import type { ColorGradeInput, NormalMapInput, ParticleBurstInput, PixelOutlineInput, SpriteEffectsGateway, SpriteShadowInput } from "../../domain/sprite-effects.js";
import type { DepthLightingInput, MaterialTextureInput } from "../../domain/visual-assets.js";

export interface AssetRestUseCases {
  createRecipe(input: AssetRecipeCreateInput): AssetRecipePlan;
  spriteEffects: SpriteEffectsGateway;
  applyMaterialTexture(input: MaterialTextureInput): Promise<AssetOperationResult>;
  applyDepthLighting(input: DepthLightingInput): Promise<AssetOperationResult>;
}

export type AssetRestEffectInput = PixelOutlineInput | ColorGradeInput | SpriteShadowInput | ParticleBurstInput | NormalMapInput;
