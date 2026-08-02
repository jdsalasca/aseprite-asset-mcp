import type { AssetRecipePlan, AssetRecipeStepPlan } from "../../domain/asset-recipe.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetRecipeOperationPort } from "../ports/AssetRecipeExecutionPort.js";

export interface AssetRecipeExecutionStep {
  id: import("../../domain/asset-recipe.js").AssetRecipeStep;
  operation: string;
  ok: boolean;
  message: string;
}

export interface AssetRecipeExecutionResult {
  ok: boolean;
  recipeId: string;
  outputFilename: string;
  steps: AssetRecipeExecutionStep[];
  failedStep?: import("../../domain/asset-recipe.js").AssetRecipeStep;
  error?: string;
  sourcePreserved: true;
  deterministic: true;
}

function stringArg(args: Record<string, number | string | boolean>, name: string): string {
  const value = args[name];
  if (typeof value !== "string" || !value.trim()) throw new Error("Recipe argument " + name + " must be a non-empty string");
  return value;
}

function numberArg(args: Record<string, number | string | boolean>, name: string): number {
  const value = args[name];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Recipe argument " + name + " must be a finite number");
  return value;
}

function outputFor(step: AssetRecipeStepPlan): string {
  if (!step.outputFilename?.trim()) throw new Error("Recipe step " + step.id + " needs an output filename");
  return step.outputFilename;
}

function failedResult(plan: AssetRecipePlan, outputFilename: string, steps: AssetRecipeExecutionStep[], step: import("../../domain/asset-recipe.js").AssetRecipeStep, error: string): AssetRecipeExecutionResult {
  return { ok: false, recipeId: plan.recipeId, outputFilename, steps, failedStep: step, error, sourcePreserved: true, deterministic: true };
}

export class AssetRecipeExecutionService {
  public constructor(private readonly operations: AssetRecipeOperationPort) {}

  public async execute(plan: AssetRecipePlan): Promise<AssetRecipeExecutionResult> {
    let current = plan.inputFilename;
    const steps: AssetRecipeExecutionStep[] = [];
    for (const step of plan.steps) {
      if (step.inputFilename !== current) return failedResult(plan, current, steps, step.id, "Recipe step " + step.id + " does not consume the previous output");
      try {
        const outcome = await this.dispatch(step, current);
        steps.push({ id: step.id, operation: step.operation, ok: outcome.ok, message: outcome.message });
        if (!outcome.ok) return failedResult(plan, current, steps, step.id, outcome.message);
        if (step.outputFilename) current = step.outputFilename;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        steps.push({ id: step.id, operation: step.operation, ok: false, message });
        return failedResult(plan, current, steps, step.id, message);
      }
    }
    return { ok: true, recipeId: plan.recipeId, outputFilename: current, steps, sourcePreserved: true, deterministic: true };
  }

  private async dispatch(step: AssetRecipeStepPlan, inputFilename: string): Promise<AssetOperationResult> {
    const args = step.arguments;
    if (step.id === "outline") return this.operations.applyPixelOutline({ inputFilename, outputFilename: outputFor(step), color: stringArg(args, "color"), thickness: numberArg(args, "thickness"), format: this.formatArg(args) });
    if (step.id === "color_grade") return this.operations.applyColorGrade({ inputFilename, outputFilename: outputFor(step), brightness: numberArg(args, "brightness"), contrast: numberArg(args, "contrast"), saturation: numberArg(args, "saturation"), format: this.formatArg(args) });
    if (step.id === "material_texture") return this.operations.applyMaterialTexture({ inputFilename, outputFilename: outputFor(step), material: stringArg(args, "material") as "water" | "earth" | "grass" | "stone" | "snow", seed: numberArg(args, "seed"), intensity: numberArg(args, "intensity"), format: this.formatArg(args) });
    if (step.id === "depth_lighting") return this.operations.applyDepthLighting({ inputFilename, outputFilename: outputFor(step), direction: stringArg(args, "direction") as "north" | "south" | "east" | "west" | "north_east" | "north_west" | "south_east" | "south_west", strength: numberArg(args, "strength"), ambient: numberArg(args, "ambient"), format: this.formatArg(args) });
    if (step.id === "shadow") return this.operations.generateSpriteShadow({ inputFilename, outputFilename: outputFor(step), offsetX: numberArg(args, "offset_x"), offsetY: numberArg(args, "offset_y"), color: stringArg(args, "color"), opacity: numberArg(args, "opacity"), format: this.formatArg(args) });
    if (step.id === "particles") return this.operations.generateParticleBurst({ outputFilename: outputFor(step), width: numberArg(args, "width"), height: numberArg(args, "height"), frames: numberArg(args, "frames"), particleCount: numberArg(args, "particle_count"), seed: numberArg(args, "seed"), color: stringArg(args, "color"), delayMs: numberArg(args, "delay_ms") });
    if (step.id === "normal_map") return this.operations.generateNormalMap({ inputFilename, outputFilename: outputFor(step), strength: numberArg(args, "strength"), format: this.formatArg(args) });
    return this.operations.runQualityGate({ filename: inputFilename, maxColors: numberArg(args, "max_colors"), maxIsolatedPixels: numberArg(args, "max_isolated_pixels"), minContrast: numberArg(args, "min_contrast") });
  }

  private formatArg(args: Record<string, number | string | boolean>): "png" | "gif" | undefined {
    const value = args.format;
    return value === "png" || value === "gif" ? value : undefined;
  }
}
