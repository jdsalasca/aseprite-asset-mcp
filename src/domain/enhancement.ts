import type { ReferenceAnalysis } from "./visual-assets.js";
import type { ImageOutputFormat } from "./image-assets.js";

export type EnhancementGoal = "cleanup" | "terrain_grain" | "water_flow" | "directional_lighting" | "particles" | "time_of_day" | "animation";

export interface EnhancementPlanInput {
  filename: string;
  analysis: ReferenceAnalysis;
  goals?: readonly EnhancementGoal[] | undefined;
  maxColors?: number | undefined;
  seed?: number | undefined;
}

export interface EnhancementPass {
  id: EnhancementGoal | "quality_gate";
  reason: string;
  parameters: Record<string, number | string | boolean>;
}

export interface EnhancementPlan {
  planId: string;
  algorithmVersion: string;
  filename: string;
  seed: number;
  detectedSignals: string[];
  warnings: string[];
  passes: EnhancementPass[];
  destructive: false;
}

export interface EnhancementApplyInput {
  outputFilename: string;
  format: ImageOutputFormat;
}

export interface EnhancementApplyReport {
  planId: string;
  outputFilename: string;
  format: ImageOutputFormat;
  frames: number;
  passesApplied: string[];
  sourcePreserved: true;
}
