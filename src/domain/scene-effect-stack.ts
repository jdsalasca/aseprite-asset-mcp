import type { AssetOperationResult } from "./asset-operations.js";
import type { LightDirection, MaterialTextureKind } from "./visual-assets.js";

export type SceneEffectKind = "rain" | "water_reflection" | "water_caustics" | "wind_sway" | "sprite_shadow" | "sprite_glow" | "day_night" | "material_texture" | "depth_lighting" | "particles";

export interface SceneEffectStackInput {
  inputFilename: string;
  outputPrefix: string;
  effects: SceneEffectKind[];
  frames: number;
  seed: number;
  delayMs?: number | undefined;
  material?: MaterialTextureKind | undefined;
  direction?: LightDirection | undefined;
  particleCount?: number | undefined;
  particleColor?: string | undefined;
  format?: "png" | "gif" | undefined;
}

export interface SceneEffectArtifact {
  effect: SceneEffectKind;
  outputFilename: string;
  operation: string;
  frames: number;
  format: "png" | "gif";
  deterministic: true;
  sourcePreserved: true;
}

export interface SceneEffectStackGateway {
  generateSceneEffectStack(input: SceneEffectStackInput): Promise<AssetOperationResult>;
}
