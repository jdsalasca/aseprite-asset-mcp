import { createHash } from "node:crypto";
import type { EnhancementGoal, EnhancementPass, EnhancementPlan, EnhancementPlanInput } from "../../domain/enhancement.js";

const VERSION = "enhancement-plan-v1";

export class EnhancementPlanService {
  public suggest(input: EnhancementPlanInput): EnhancementPlan {
    const seed = input.seed ?? 1;
    const maxColors = input.maxColors ?? 64;
    const goals = input.goals?.length ? [...new Set(input.goals)] : this.inferGoals(input);
    const warnings: string[] = [];
    const signals: string[] = [];
    if (input.analysis.contrast < 0.08) { warnings.push("low_contrast"); signals.push("low_contrast"); }
    if (input.analysis.dominantColors.length > maxColors) { warnings.push("palette_exceeds_target"); signals.push("large_palette"); }
    if (input.analysis.edgeDensity > 0.35) signals.push("high_edge_density");
    if (input.analysis.transparencyRatio > 0.5) signals.push("transparent_subject");
    const passes = goals.map((goal) => this.passFor(goal, input.analysis, maxColors, seed));
    passes.push({ id: "quality_gate", reason: "Every enhancement must be measured before export.", parameters: { maxColors, minContrast: 0.08 } });
    const planSeed = JSON.stringify({ filename: input.filename, goals, seed, maxColors, analysis: [input.analysis.width, input.analysis.height, input.analysis.frames, input.analysis.contrast] });
    const planId = createHash("sha256").update(planSeed).digest("hex").slice(0, 12);
    return { planId, algorithmVersion: VERSION, filename: input.filename, seed, detectedSignals: [...new Set(signals)], warnings, passes, destructive: false };
  }

  private inferGoals(input: EnhancementPlanInput): EnhancementGoal[] {
    const inferred: EnhancementGoal[] = ["cleanup"];
    if (input.analysis.contrast < 0.12) inferred.push("directional_lighting");
    if (input.analysis.edgeDensity > 0.18) inferred.push("terrain_grain");
    return inferred;
  }

  private passFor(goal: EnhancementGoal, analysis: EnhancementPlanInput["analysis"], maxColors: number, seed: number): EnhancementPass {
    const reasons: Record<EnhancementGoal, string> = {
      cleanup: "Remove isolated pixels and alpha fringes without changing the source.",
      terrain_grain: "Add seeded clustered material variation instead of uniform random noise.",
      water_flow: "Create directional wave bands and shoreline foam from masks.",
      directional_lighting: "Build palette-constrained light and shadow ramps from image gradients.",
      particles: "Generate a deterministic particle layer and export its frame manifest.",
      time_of_day: "Create a deterministic palette transition across time-of-day frames.",
      animation: "Preserve frame dimensions and produce a reviewable animation pack.",
    };
    const parameters: Record<string, number | string | boolean> = { seed, intensity: analysis.contrast < 0.12 ? 0.35 : 0.2, maxColors };
    if (goal === "terrain_grain") parameters.clusterSize = 2;
    if (goal === "water_flow") { parameters.direction = "coastal"; parameters.foam = true; }
    if (goal === "particles") { parameters.frames = Math.max(4, Math.min(12, analysis.frames * 2)); parameters.deterministic = true; }
    return { id: goal, reason: reasons[goal], parameters };
  }
}
