import type { AssetOperationResult } from "./asset-operations.js";

export type AssetVariantKind = "rain" | "fire" | "earthquake" | "birds" | "night" | "day_night" | "walk" | "water_reflection" | "water_caustics";

export interface AssetVariantPackInput {
  inputFilename: string;
  outputPrefix: string;
  variants: AssetVariantKind[];
  frames: number;
  seed: number;
  delayMs?: number | undefined;
}

export interface AssetVariantArtifact {
  variant: AssetVariantKind;
  outputFilename: string;
  operation: string;
  frames: number;
  format: "png" | "gif";
  deterministic: true;
  sourcePreserved: true;
}

export interface AssetVariantPackGateway {
  generateVariantPack(input: AssetVariantPackInput): Promise<AssetOperationResult>;
}
