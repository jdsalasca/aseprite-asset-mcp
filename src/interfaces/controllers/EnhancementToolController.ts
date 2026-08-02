import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { EnhancementPlanService } from "../../application/services/EnhancementPlanService.js";
import type { EnhancementGoal } from "../../domain/enhancement.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { ReferenceAnalysis } from "../../domain/visual-assets.js";
import { VisualAssetService } from "../../application/services/VisualAssetService.js";
import { DeterministicEnhancementService } from "../../application/services/DeterministicEnhancementService.js";
import { EnhancementBundleService } from "../../application/services/EnhancementBundleService.js";

const ENHANCEMENT_GOALS = ["cleanup", "terrain_grain", "water_flow", "directional_lighting", "particles", "time_of_day", "animation"] as const;

export class EnhancementToolController {
  private readonly bundle: EnhancementBundleService;

  public constructor(private readonly visualAssets: VisualAssetService, private readonly enhancements: DeterministicEnhancementService, private readonly plans = new EnhancementPlanService(), bundle?: EnhancementBundleService) {
    this.bundle = bundle ?? new EnhancementBundleService(visualAssets, enhancements, plans);
  }

  public register(server: McpServer): void {
    server.registerTool("suggest_enhancement_plan", {
      description: "Inspect one image and return a deterministic, non-destructive enhancement plan for an agent or human review.",
      inputSchema: {
        filename: z.string().min(1),
        goals: z.array(z.enum(ENHANCEMENT_GOALS)).optional(),
        max_colors: z.number().int().min(2).max(256).default(64),
        seed: z.number().int().default(1),
      },
    }, async ({ filename, goals, max_colors, seed }) => {
      const analysisResult = await this.visualAssets.inspectReference(filename);
      if (!analysisResult.ok) return this.result(analysisResult);
      try {
        const analysis = JSON.parse(analysisResult.message) as ReferenceAnalysis;
        return this.text(this.plans.suggest({ filename, analysis, ...(goals ? { goals: goals as EnhancementGoal[] } : {}), maxColors: max_colors, seed }));
      } catch {
        return this.result({ ok: false, message: "Reference analysis did not return a valid enhancement contract" });
      }
    });
    server.registerTool("apply_enhancement_plan", {
      description: "Apply a deterministic enhancement plan to a new output file while preserving the source asset.",
      inputSchema: {
        filename: z.string().min(1),
        output_filename: z.string().min(1),
        format: z.enum(["png", "gif"]).default("png"),
        goals: z.array(z.enum(ENHANCEMENT_GOALS)).optional(),
        max_colors: z.number().int().min(2).max(256).default(64),
        seed: z.number().int().default(1),
      },
    }, async ({ filename, output_filename, format, goals, max_colors, seed }) => {
      const analysisResult = await this.visualAssets.inspectReference(filename);
      if (!analysisResult.ok) return this.result(analysisResult);
      try {
        const analysis = JSON.parse(analysisResult.message) as ReferenceAnalysis;
        const plan = this.plans.suggest({ filename, analysis, ...(goals ? { goals: goals as EnhancementGoal[] } : {}), maxColors: max_colors, seed });
        const applied = await this.enhancements.apply(plan, { outputFilename: output_filename, format });
        const qualityResult = await this.visualAssets.runQualityGate({ filename: output_filename, maxColors: max_colors, maxIsolatedPixels: 4, minContrast: 0.08 });
        let quality: unknown;
        try { quality = JSON.parse(qualityResult.message); } catch { quality = { valid: qualityResult.ok, violations: qualityResult.ok ? [] : [qualityResult.message] }; }
        return this.text({ plan, applied, quality });
      } catch (error) {
        return this.result({ ok: false, message: error instanceof Error ? error.message : String(error) });
      }
    });
    server.registerTool("apply_enhancement_bundle", {
      description: "Inspect, plan, enhance, and quality-gate one asset in a single deterministic non-destructive call.",
      inputSchema: {
        filename: z.string().min(1),
        output_filename: z.string().min(1),
        format: z.enum(["png", "gif"]).default("png"),
        goals: z.array(z.enum(ENHANCEMENT_GOALS)).optional(),
        max_colors: z.number().int().min(2).max(256).default(64),
        seed: z.number().int().default(1),
      },
    }, async ({ filename, output_filename, format, goals, max_colors, seed }) => this.result(await this.bundle.apply({ filename, outputFilename: output_filename, format, ...(goals ? { goals: goals as EnhancementGoal[] } : {}), maxColors: max_colors, seed })));
  }

  private result(operation: AssetOperationResult): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] }; }
  private text(value: unknown): { content: [{ type: "text"; text: string }] } { return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] }; }
}
