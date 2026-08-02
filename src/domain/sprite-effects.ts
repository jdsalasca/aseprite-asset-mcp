import type { AssetOperationResult } from "./asset-operations.js";

export type SpriteEffectFormat = "png" | "gif";
export interface SpriteEffectBaseInput { inputFilename: string; outputFilename: string; format?: SpriteEffectFormat | undefined; }
export interface PixelOutlineInput extends SpriteEffectBaseInput { color: string; thickness?: number | undefined; }
export interface RemoveBackgroundInput extends SpriteEffectBaseInput { backgroundColor: string; tolerance?: number | undefined; connectedOnly?: boolean | undefined; }
export interface CleanupIsolatedPixelsInput extends SpriteEffectBaseInput { minNeighbors?: number | undefined; iterations?: number | undefined; }
export interface SpriteGlowInput extends SpriteEffectBaseInput { color: string; radius?: number | undefined; opacity?: number | undefined; }
export type SpriteRimLightDirection = "north" | "north_east" | "east" | "south_east" | "south" | "south_west" | "west" | "north_west";
export interface SpriteRimLightInput extends SpriteEffectBaseInput { color: string; direction: SpriteRimLightDirection; strength?: number | undefined; }
export interface SpriteAmbientOcclusionInput extends SpriteEffectBaseInput { color: string; radius?: number | undefined; strength?: number | undefined; }
export interface ColorGradeInput extends SpriteEffectBaseInput { brightness?: number | undefined; contrast?: number | undefined; saturation?: number | undefined; }
export interface SpriteShadowInput extends SpriteEffectBaseInput { offsetX: number; offsetY: number; color: string; opacity?: number | undefined; }
export interface ParticleBurstInput { outputFilename: string; width: number; height: number; frames: number; particleCount: number; seed: number; color: string; delayMs?: number | undefined; }
export interface NormalMapInput extends SpriteEffectBaseInput { strength?: number | undefined; }
export interface RainOverlayInput extends SpriteEffectBaseInput { seed: number; intensity?: number | undefined; wind?: number | undefined; color: string; frames?: number | undefined; delayMs?: number | undefined; }
export type MotionKind = "idle" | "walk" | "run" | "jump" | "attack";
export interface MotionPackInput extends SpriteEffectBaseInput { motion: MotionKind; frames: number; seed: number; amplitude?: number | undefined; delayMs?: number | undefined; }
export interface SeamlessTextureInput extends SpriteEffectBaseInput { seamWidth?: number | undefined; }
export interface WaterReflectionInput extends SpriteEffectBaseInput { waterline: number; frames: number; seed: number; amplitude?: number | undefined; opacity?: number | undefined; delayMs?: number | undefined; }
export interface WaterCausticsInput extends SpriteEffectBaseInput { frames: number; seed: number; intensity?: number | undefined; scale?: number | undefined; color: string; delayMs?: number | undefined; }
export interface DayNightCycleInput extends SpriteEffectBaseInput { frames: number; seed: number; intensity?: number | undefined; delayMs?: number | undefined; }

export interface SpriteEffectsGateway {
  applyPixelOutline(input: PixelOutlineInput): Promise<AssetOperationResult>;
  removeBackground(input: RemoveBackgroundInput): Promise<AssetOperationResult>;
  cleanupIsolatedPixels(input: CleanupIsolatedPixelsInput): Promise<AssetOperationResult>;
  generateSpriteGlow(input: SpriteGlowInput): Promise<AssetOperationResult>;
  applySpriteRimLight(input: SpriteRimLightInput): Promise<AssetOperationResult>;
  applySpriteAmbientOcclusion(input: SpriteAmbientOcclusionInput): Promise<AssetOperationResult>;
  applyColorGrade(input: ColorGradeInput): Promise<AssetOperationResult>;
  generateSpriteShadow(input: SpriteShadowInput): Promise<AssetOperationResult>;
  generateParticleBurst(input: ParticleBurstInput): Promise<AssetOperationResult>;
  generateNormalMap(input: NormalMapInput): Promise<AssetOperationResult>;
  generateRainOverlay(input: RainOverlayInput): Promise<AssetOperationResult>;
  generateMotionPack(input: MotionPackInput): Promise<AssetOperationResult>;
  generateSeamlessTexture(input: SeamlessTextureInput): Promise<AssetOperationResult>;
  generateWaterReflection(input: WaterReflectionInput): Promise<AssetOperationResult>;
  generateWaterCaustics(input: WaterCausticsInput): Promise<AssetOperationResult>;
  generateDayNightCycle(input: DayNightCycleInput): Promise<AssetOperationResult>;
}
