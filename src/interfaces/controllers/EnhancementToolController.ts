import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { EnhancementPlannerService } from "../../application/services/EnhancementPlannerService.js";
import type { EnhancementGoal, EnhancementPlanGateway } from "../../domain/enhancement.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { ReferenceAnalysis } from "../../domain/visual-assets.js";
import type { VisualAssetService } from "../../application/services/VisualAssetService.js";

const ENHANCEMENT_GOALS = ["cleanup", "terrain_grain", "water_flow", "directional_lighting", "particles", "time_of_day", "animation"] as const;

export class EnhancementToolController {
  public constructor(private readonly visualAssets: Pick<VisualAssetService, "inspectReference">, private readonly enhancementPlan: EnhancementPlanGateway, private readonly plans = new EnhancementPlannerService()) {}

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
      // Aplicar un plan y medirlo tiene UNA sola implementacion (EnhancementPlanService). La tool solo
      // traduce el sobre a texto: si vuelve a copiar el flujo, las dos copias se separan.
      const applied = await this.enhancementPlan.apply({ filename, outputFilename: output_filename, format, ...(goals ? { goals: goals as EnhancementGoal[] } : {}), maxColors: max_colors, seed });
      return applied.ok ? this.text(applied.message) : this.result(applied);
    });
  }

  private result(operation: AssetOperationResult): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] }; }
  private text(value: unknown): { content: [{ type: "text"; text: string }] } { return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] }; }
}
