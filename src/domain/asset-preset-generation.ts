import type { AssetOperationResult } from "./asset-operations.js";
import type { DetailLevel, EnvironmentKind, VisualAssetGateway } from "./visual-assets.js";

export interface AssetPresetGenerationInput {
  presetId: string;
  outputPrefix: string;
  width: number;
  height: number;
  seed: number;
  tileSize?: number | undefined;
  detailLevel?: DetailLevel | undefined;
}

export interface AssetPresetGenerationGateway {
  generate(input: AssetPresetGenerationInput): Promise<AssetOperationResult>;
}

export type PresetEnvironmentResolver = (presetId: string) => EnvironmentKind | null;
export type EnvironmentGenerationPort = Pick<VisualAssetGateway, "generateEnvironmentPack">;
