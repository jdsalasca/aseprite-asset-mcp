import { createHash } from "node:crypto";
import type { AssetRecipeCreateInput, AssetRecipePlan, AssetRecipeStep, AssetRecipeStepPlan } from "../../domain/asset-recipe.js";

const VERSION = "asset-recipe-v1";
const DEFAULT_DIRECTION = "south_east";
const DEFAULT_MATERIAL = "earth";

function outputName(prefix: string, step: AssetRecipeStep, format: "png" | "gif"): string { return `${prefix}-${step}.${step === "particles" ? "gif" : format}`; }

export class AssetRecipeComposerService {
  public compose(input: AssetRecipeCreateInput): AssetRecipePlan {
    this.validate(input);
    const seed = input.seed ?? 1;
    const format = input.format ?? "png";
    const steps = [...new Set(input.steps)];
    const plans = steps.map((step) => this.stepFor(step, input, seed, format));
    const recipeId = createHash("sha256").update(JSON.stringify({ assetId: input.assetId, inputFilename: input.inputFilename, outputPrefix: input.outputPrefix, format, steps, seed, material: input.material ?? DEFAULT_MATERIAL, direction: input.direction ?? DEFAULT_DIRECTION })).digest("hex").slice(0, 16);
    return { recipeId, schemaVersion: 1, algorithmVersion: VERSION, assetId: input.assetId, inputFilename: input.inputFilename, outputPrefix: input.outputPrefix, format, seed, steps: plans, sourcePreserved: true, deterministic: true };
  }

  private validate(input: AssetRecipeCreateInput): void {
    if (!input.assetId.trim() || !input.inputFilename.trim() || !input.outputPrefix.trim()) throw new Error("Asset id, input filename, and output prefix are required");
    if (input.inputFilename.includes("\0") || input.outputPrefix.includes("\0") || input.outputPrefix.split(/[\\/]/).includes("..")) throw new Error("Recipe paths contain an invalid traversal segment");
    if (!input.steps.length || input.steps.length > 8) throw new Error("A recipe must contain between 1 and 8 steps");
    if (input.seed !== undefined && !Number.isInteger(input.seed)) throw new Error("Recipe seed must be an integer");
  }

  private stepFor(step: AssetRecipeStep, input: AssetRecipeCreateInput, seed: number, format: "png" | "gif"): AssetRecipeStepPlan {
    const outputFilename = step === "quality_gate" ? undefined : outputName(input.outputPrefix, step, format);
    const base = { id: step, inputFilename: input.inputFilename, ...(outputFilename ? { outputFilename } : {}) };
    if (step === "outline") return { ...base, operation: "apply_pixel_outline", arguments: { color: "#172033", thickness: 1, format } };
    if (step === "color_grade") return { ...base, operation: "apply_color_grade", arguments: { brightness: 0, contrast: 1.05, saturation: 1.08, format } };
    if (step === "material_texture") return { ...base, operation: "apply_material_texture", arguments: { material: input.material ?? DEFAULT_MATERIAL, seed, intensity: 0.6, format } };
    if (step === "depth_lighting") return { ...base, operation: "apply_depth_lighting", arguments: { direction: input.direction ?? DEFAULT_DIRECTION, strength: 0.7, ambient: 0.35, format } };
    if (step === "shadow") return { ...base, operation: "generate_sprite_shadow", arguments: { offset_x: 2, offset_y: 2, color: "#000000", opacity: 0.45, format } };
    if (step === "particles") return { ...base, operation: "generate_particle_burst", inputFilename: input.inputFilename, arguments: { width: 64, height: 64, frames: 8, particle_count: 24, seed, color: "#FFD166", delay_ms: 80 } };
    if (step === "normal_map") return { ...base, operation: "generate_normal_map", arguments: { strength: 2, format } };
    return { ...base, operation: "run_asset_quality_gate", arguments: { max_colors: 64, max_isolated_pixels: 4, min_contrast: 0.08 } };
  }
}
