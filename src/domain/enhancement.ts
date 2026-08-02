import type { ReferenceAnalysis } from "./visual-assets.js";
import type { ImageOutputFormat } from "./image-assets.js";
import type { AssetOperationResult } from "./asset-operations.js";

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

export interface EnhancementBundleInput {
  filename: string;
  outputFilename: string;
  format: ImageOutputFormat;
  goals?: readonly EnhancementGoal[] | undefined;
  maxColors?: number | undefined;
  seed?: number | undefined;
}

export interface EnhancementBundleResult {
  operation: "apply_enhancement_bundle";
  plan: EnhancementPlan;
  applied: EnhancementApplyReport;
  quality: { valid: boolean; violations: string[] };
  deterministic: true;
  sourcePreserved: true;
}

export interface EnhancementBundleGateway {
  apply(input: EnhancementBundleInput): Promise<AssetOperationResult>;
}

export interface EnhancementBatchItemInput {
  filename: string;
  outputFilename: string;
  format: ImageOutputFormat;
}

export interface EnhancementBatchInput {
  items: readonly EnhancementBatchItemInput[];
  goals?: readonly EnhancementGoal[] | undefined;
  maxColors?: number | undefined;
  seed?: number | undefined;
}

export interface EnhancementBatchItemResult {
  filename: string;
  outputFilename: string;
  ok: boolean;
  planId?: string;
  frames?: number;
  passesApplied?: string[];
  quality?: { valid: boolean; violations: string[] };
  error?: string;
}

export interface EnhancementBatchResult {
  operation: "apply_enhancement_batch";
  items: EnhancementBatchItemResult[];
  summary: { total: number; succeeded: number; failed: number };
  deterministic: true;
  sourcePreserved: true;
}

export interface EnhancementBatchGateway {
  apply(input: EnhancementBatchInput): Promise<AssetOperationResult>;
}
