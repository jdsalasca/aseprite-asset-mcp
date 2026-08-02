import type { AssetOperationResult } from "./asset-operations.js";

export interface AssetQualityBatchInput {
  filenames: string[];
  maxColors?: number | undefined;
  maxIsolatedPixels?: number | undefined;
}

export interface AssetQualityBundlePort {
  qualityBundle(input: { filename: string; maxColors?: number | undefined; maxIsolatedPixels?: number | undefined }): Promise<AssetOperationResult>;
}

export interface AssetQualityBatchItem {
  filename: string;
  valid: boolean;
  frameCount?: number;
  width?: number;
  height?: number;
  totalColors?: number;
  violations: string[];
  recommendations: string[];
  error?: string;
}

export interface AssetQualityBatchView {
  operation: "inspect_asset_batch";
  assets: AssetQualityBatchItem[];
  summary: { total: number; valid: number; invalid: number; failed: number };
  maxColors: number;
  maxIsolatedPixels: number;
  deterministic: true;
  sourcePreserved: true;
}
