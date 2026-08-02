import path from "node:path";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetQualityBatchInput, AssetQualityBatchItem, AssetQualityBatchView, AssetQualityBundlePort } from "../../domain/asset-quality.js";

function fail(error: unknown): AssetOperationResult {
  return { ok: false, message: error instanceof Error ? error.message : String(error) };
}

function parseBundle(filename: string, result: AssetOperationResult): AssetQualityBatchItem {
  try {
    const parsed = JSON.parse(result.message) as {
      inspection?: { frameCount?: number; width?: number; height?: number; totalColors?: number };
      quality?: { valid?: boolean; violations?: string[] };
      recommendations?: string[];
    };
    if (!parsed.quality || typeof parsed.quality.valid !== "boolean") throw new Error("quality bundle has no valid quality payload");
    return {
      filename,
      valid: parsed.quality.valid,
      ...(parsed.inspection?.frameCount === undefined ? {} : { frameCount: parsed.inspection.frameCount }),
      ...(parsed.inspection?.width === undefined ? {} : { width: parsed.inspection.width }),
      ...(parsed.inspection?.height === undefined ? {} : { height: parsed.inspection.height }),
      ...(parsed.inspection?.totalColors === undefined ? {} : { totalColors: parsed.inspection.totalColors }),
      violations: Array.isArray(parsed.quality.violations) ? parsed.quality.violations.map(String) : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
    };
  } catch (error) {
    return { filename, valid: false, violations: [], recommendations: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export class AssetBatchQualityService {
  public constructor(private readonly quality: AssetQualityBundlePort) {}

  public async inspect(input: AssetQualityBatchInput): Promise<AssetOperationResult> {
    try {
      if (!Array.isArray(input.filenames) || input.filenames.length === 0) throw new Error("At least one asset filename is required");
      if (input.filenames.length > 32) throw new Error("A quality batch cannot contain more than 32 assets");
      const maxColors = input.maxColors ?? 256;
      const maxIsolatedPixels = input.maxIsolatedPixels ?? Number.MAX_SAFE_INTEGER;
      if (!Number.isInteger(maxColors) || maxColors < 1 || maxColors > 256) throw new Error("Maximum colors must be an integer from 1 to 256");
      if (!Number.isInteger(maxIsolatedPixels) || maxIsolatedPixels < 0) throw new Error("Maximum isolated pixels must be a non-negative integer");

      const normalized = new Set<string>();
      for (const filename of input.filenames) {
        if (typeof filename !== "string" || !filename.trim()) throw new Error("Asset filenames cannot be empty");
        if (filename.includes("\0")) throw new Error("Asset filenames cannot contain null bytes");
        const key = path.resolve(filename).toLowerCase();
        if (normalized.has(key)) throw new Error(`Duplicate asset filename: ${filename}`);
        normalized.add(key);
      }

      const assets: AssetQualityBatchItem[] = [];
      for (const filename of input.filenames) {
        const result = await this.quality.qualityBundle({ filename, maxColors, maxIsolatedPixels });
        if (!result.ok && !result.message.trim().startsWith("{")) {
          assets.push({ filename, valid: false, violations: [], recommendations: [], error: result.message });
          continue;
        }
        assets.push(parseBundle(filename, result));
      }
      const failed = assets.filter((asset) => Boolean(asset.error)).length;
      const valid = assets.filter((asset) => asset.valid && !asset.error).length;
      const invalid = assets.length - valid - failed;
      const payload: AssetQualityBatchView = { operation: "inspect_asset_batch", assets, summary: { total: assets.length, valid, invalid, failed }, maxColors, maxIsolatedPixels, deterministic: true, sourcePreserved: true };
      return { ok: failed === 0 && invalid === 0, message: JSON.stringify(payload) };
    } catch (error) { return fail(error); }
  }
}
