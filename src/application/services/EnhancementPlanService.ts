import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { EnhancementPlanGateway, EnhancementPlanInput, EnhancementPlanResult } from "../../domain/enhancement.js";
import type { ReferenceAnalysis } from "../../domain/visual-assets.js";
import { EnhancementPlannerService } from "./EnhancementPlannerService.js";
import type { DeterministicEnhancementService } from "./DeterministicEnhancementService.js";
import type { VisualAssetService } from "./VisualAssetService.js";

function parseJson<T>(message: string): T {
  return JSON.parse(message) as T;
}

export class EnhancementPlanService implements EnhancementPlanGateway {
  public constructor(
    private readonly visualAssets: Pick<VisualAssetService, "inspectReference" | "runQualityGate">,
    private readonly enhancements: Pick<DeterministicEnhancementService, "apply">,
    private readonly plans = new EnhancementPlannerService(),
  ) {}

  public async apply(input: EnhancementPlanInput): Promise<AssetOperationResult> {
    const analysisResult = await this.visualAssets.inspectReference(input.filename);
    if (!analysisResult.ok) return analysisResult;
    try {
      const analysis = parseJson<ReferenceAnalysis>(analysisResult.message);
      const plan = this.plans.suggest({ filename: input.filename, analysis, ...(input.goals ? { goals: input.goals } : {}), maxColors: input.maxColors, seed: input.seed });
      const applied = await this.enhancements.apply(plan, { outputFilename: input.outputFilename, format: input.format });
      const qualityResult = await this.visualAssets.runQualityGate({ filename: input.outputFilename, maxColors: input.maxColors, maxIsolatedPixels: 4, minContrast: 0.08 });
      const quality = qualityResult.ok
        ? parseJson<{ valid: boolean; violations?: string[] }>(qualityResult.message)
        : { valid: false, violations: [qualityResult.message] };
      const payload: EnhancementPlanResult = { operation: "apply_enhancement_plan", plan, applied, quality: { valid: quality.valid, violations: quality.violations ?? [] }, deterministic: true, sourcePreserved: true };
      return { ok: true, message: JSON.stringify(payload) };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }
}
