import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { ColorGradeInput, NormalMapInput, ParticleBurstInput, PixelOutlineInput, SpriteShadowInput } from "../../domain/sprite-effects.js";
import type { DepthLightingInput, MaterialTextureInput, QualityGateInput } from "../../domain/visual-assets.js";

export interface AssetRecipeOperationPort {
  applyPixelOutline(input: PixelOutlineInput): Promise<AssetOperationResult>;
  applyColorGrade(input: ColorGradeInput): Promise<AssetOperationResult>;
  applyMaterialTexture(input: MaterialTextureInput): Promise<AssetOperationResult>;
  applyDepthLighting(input: DepthLightingInput): Promise<AssetOperationResult>;
  generateSpriteShadow(input: SpriteShadowInput): Promise<AssetOperationResult>;
  generateParticleBurst(input: ParticleBurstInput): Promise<AssetOperationResult>;
  generateNormalMap(input: NormalMapInput): Promise<AssetOperationResult>;
  runQualityGate(input: QualityGateInput): Promise<AssetOperationResult>;
}
