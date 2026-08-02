import path from "node:path";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { EnhancementBatchGateway, EnhancementBatchInput, EnhancementBatchItemResult, EnhancementBatchResult, EnhancementBundleGateway } from "../../domain/enhancement.js";

function failure(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function key(filename: string): string { return path.resolve(filename).toLowerCase(); }
function validName(filename: unknown): filename is string { return typeof filename === "string" && filename.trim().length > 0 && !filename.includes("\0"); }

export class EnhancementBatchService implements EnhancementBatchGateway {
  public constructor(private readonly bundle: EnhancementBundleGateway) {}

  public async apply(input: EnhancementBatchInput): Promise<AssetOperationResult> {
    try {
      this.validate(input);
      const items: EnhancementBatchItemResult[] = [];
      for (const item of input.items) {
        const result = await this.bundle.apply({ filename: item.filename, outputFilename: item.outputFilename, format: item.format, ...(input.goals ? { goals: input.goals } : {}), maxColors: input.maxColors, seed: input.seed });
        items.push(this.itemResult(item.filename, item.outputFilename, result));
      }
      const succeeded = items.filter((item) => item.ok).length;
      const payload: EnhancementBatchResult = { operation: "apply_enhancement_batch", items, summary: { total: items.length, succeeded, failed: items.length - succeeded }, deterministic: true, sourcePreserved: true };
      return { ok: succeeded === items.length, message: JSON.stringify(payload) };
    } catch (error) {
      return { ok: false, message: failure(error) };
    }
  }

  private validate(input: EnhancementBatchInput): void {
    if (!Array.isArray(input.items) || input.items.length === 0) throw new Error("At least one enhancement batch item is required");
    if (input.items.length > 24) throw new Error("An enhancement batch cannot contain more than 24 assets");
    const sources = new Set<string>();
    const outputs = new Set<string>();
    for (const item of input.items) {
      if (!validName(item.filename) || !validName(item.outputFilename)) throw new Error("Enhancement batch filenames cannot be empty or contain null bytes");
      if (item.format !== "png" && item.format !== "gif") throw new Error("Enhancement batch format must be png or gif");
      const source = key(item.filename); const output = key(item.outputFilename);
      if (source === output) throw new Error(`Enhancement output must differ from source: ${item.filename}`);
      if (sources.has(source)) throw new Error(`Duplicate enhancement source: ${item.filename}`);
      if (outputs.has(output)) throw new Error(`Duplicate enhancement output: ${item.outputFilename}`);
      sources.add(source); outputs.add(output);
    }
    for (const output of outputs) if (sources.has(output)) throw new Error("Enhancement batch outputs cannot overwrite any source asset");
    if (input.goals && new Set(input.goals).size !== input.goals.length) throw new Error("Enhancement batch goals must be unique");
  }

  private itemResult(filename: string, outputFilename: string, result: AssetOperationResult): EnhancementBatchItemResult {
    if (!result.ok) return { filename, outputFilename, ok: false, error: result.message };
    try {
      const payload = JSON.parse(result.message) as { operation?: string; applied?: { plan?: never; planId?: string; frames?: number; passesApplied?: string[] }; quality?: { valid?: boolean; violations?: string[] }; plan?: { planId?: string } };
      if (payload.operation !== "apply_enhancement_bundle" || !payload.applied || !payload.quality || typeof payload.quality.valid !== "boolean") throw new Error("Enhancement bundle returned an invalid payload");
      return { filename, outputFilename, ok: true, ...(payload.plan?.planId ? { planId: payload.plan.planId } : payload.applied.planId ? { planId: payload.applied.planId } : {}), ...(payload.applied.frames === undefined ? {} : { frames: payload.applied.frames }), ...(payload.applied.passesApplied ? { passesApplied: payload.applied.passesApplied.map(String) } : {}), quality: { valid: payload.quality.valid, violations: Array.isArray(payload.quality.violations) ? payload.quality.violations.map(String) : [] } };
    } catch (error) {
      return { filename, outputFilename, ok: false, error: failure(error) };
    }
  }
}
