import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { EnhancementPlanGateway, EnhancementPlanInput, EnhancementPlanResult } from "../../domain/enhancement.js";
import type { QualityGateInput, QualityGateResult, ReferenceAnalysis } from "../../domain/visual-assets.js";
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
      const thresholds = { maxColors: input.maxColors, maxIsolatedPixels: 4, minContrast: 0.08 } as const;
      // El ANTES se mide antes de escribir, con los mismos umbrales que el despues: si no, la
      // comparacion no significaria nada.
      const sourceQuality = await this.gate({ filename: input.filename, ...thresholds });
      const applied = await this.enhancements.apply(plan, { outputFilename: input.outputFilename, format: input.format });
      const quality = await this.gate({ filename: input.outputFilename, ...thresholds });
      const payload: EnhancementPlanResult = { operation: "apply_enhancement_plan", plan, applied, quality, sourceQuality, deterministic: true, sourcePreserved: true };
      return { ok: true, message: JSON.stringify(payload) };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * `runQualityGate` responde `ok: false` tambien cuando el resultado TIENE infracciones, asi que el
   * mensaje se parsea siempre. Si no viene JSON (un fichero ilegible, p. ej.) se devuelve el texto
   * como unica infraccion y sin informes: `reports: []` no es una medida de cero colores.
   */
  private async gate(input: QualityGateInput): Promise<QualityGateResult> {
    const result = await this.visualAssets.runQualityGate(input);
    try {
      return parseJson<QualityGateResult>(result.message);
    } catch {
      return { filename: input.filename, valid: false, frames: 0, reports: [], violations: [result.message] };
    }
  }
}
