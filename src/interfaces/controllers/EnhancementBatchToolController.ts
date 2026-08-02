import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { EnhancementGoal } from "../../domain/enhancement.js";
import type { EnhancementBatchService } from "../../application/services/EnhancementBatchService.js";

const GOALS = ["cleanup", "terrain_grain", "water_flow", "directional_lighting", "particles", "time_of_day", "animation"] as const;

export class EnhancementBatchToolController {
  public constructor(private readonly batch: EnhancementBatchService) {}

  public register(server: McpServer): void {
    server.registerTool("apply_enhancement_batch", {
      description: "Enhance up to 24 assets in one deterministic batch, isolating per-file failures and preserving every source.",
      inputSchema: {
        items: z.array(z.object({ filename: z.string().min(1), output_filename: z.string().min(1), format: z.enum(["png", "gif"]) })).min(1).max(24),
        goals: z.array(z.enum(GOALS)).max(GOALS.length).optional(),
        max_colors: z.number().int().min(2).max(256).default(64),
        seed: z.number().int().default(1),
      },
    }, async ({ items, goals, max_colors, seed }) => {
      const result = await this.batch.apply({ items: items.map((item) => ({ filename: item.filename, outputFilename: item.output_filename, format: item.format })), ...(goals ? { goals: goals as EnhancementGoal[] } : {}), maxColors: max_colors, seed });
      return { isError: !result.ok, content: [{ type: "text" as const, text: result.message }] };
    });
  }
}
