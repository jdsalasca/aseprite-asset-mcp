import type { AssetOperationResult } from "./asset-operations.js";

export interface AnimationQualityInput { filename: string; }

export interface AnimationQualityPort {
  inspect(input: AnimationQualityInput): Promise<AssetOperationResult>;
}

export interface AnimationTransitionView {
  fromFrame: number;
  toFrame: number;
  changedPixels: number;
  changedRatio: number;
  changedBounds: { x: number; y: number; width: number; height: number } | null;
}

export interface AnimationQualityView {
  operation: "inspect_animation_quality";
  filename: string;
  frameCount: number;
  width: number;
  height: number;
  delaysMs: number[];
  transitions: AnimationTransitionView[];
  duplicateFrames: number[];
  loop: { changedPixels: number; closed: boolean };
  palette: { colorsPerFrame: number[]; driftFrames: number[]; stable: boolean };
  timing: { consistent: boolean; positive: boolean };
  quality: { valid: boolean; violations: string[] };
  recommendations: string[];
  deterministic: true;
  sourcePreserved: true;
}
