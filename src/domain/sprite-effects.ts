import type { AssetOperationResult } from "./asset-operations.js";

export type SpriteEffectFormat = "png" | "gif";
export interface SpriteEffectBaseInput { inputFilename: string; outputFilename: string; format?: SpriteEffectFormat | undefined; }
export interface PixelOutlineInput extends SpriteEffectBaseInput { color: string; thickness?: number | undefined; }
export interface ColorGradeInput extends SpriteEffectBaseInput { brightness?: number | undefined; contrast?: number | undefined; saturation?: number | undefined; }
export interface SpriteShadowInput extends SpriteEffectBaseInput { offsetX: number; offsetY: number; color: string; opacity?: number | undefined; }
export interface ParticleBurstInput { outputFilename: string; width: number; height: number; frames: number; particleCount: number; seed: number; color: string; delayMs?: number | undefined; }
export interface NormalMapInput extends SpriteEffectBaseInput { strength?: number | undefined; }
export interface RainOverlayInput extends SpriteEffectBaseInput { seed: number; intensity?: number | undefined; wind?: number | undefined; color: string; delayMs?: number | undefined; }

export interface SpriteEffectsGateway {
  applyPixelOutline(input: PixelOutlineInput): Promise<AssetOperationResult>;
  applyColorGrade(input: ColorGradeInput): Promise<AssetOperationResult>;
  generateSpriteShadow(input: SpriteShadowInput): Promise<AssetOperationResult>;
  generateParticleBurst(input: ParticleBurstInput): Promise<AssetOperationResult>;
  generateNormalMap(input: NormalMapInput): Promise<AssetOperationResult>;
  generateRainOverlay(input: RainOverlayInput): Promise<AssetOperationResult>;
}
