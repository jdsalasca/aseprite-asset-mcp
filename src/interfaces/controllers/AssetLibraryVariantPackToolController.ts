import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AssetLibraryVariantPackService } from "../../application/services/AssetLibraryVariantPackService.js";

const variants = z.enum(["rain", "fire", "earthquake", "birds", "night", "day_night", "walk", "water_reflection", "water_caustics", "wind_sway", "wind"]);

export class AssetLibraryVariantPackToolController {
  public constructor(private readonly service: AssetLibraryVariantPackService) {}

  public register(server: McpServer): void {
    server.registerTool("generate_library_variant_pack", { description: "Generate deterministic environmental variants for multiple asset library ids with one compact request, including wind sway for foliage and flags. The legacy wind name is accepted as an alias.", inputSchema: { item_ids: z.array(z.string().min(1)).min(1).max(24), output_prefix: z.string().min(1), variants: z.array(variants).min(1).max(11), frames: z.number().int().min(2).max(24).default(8), seed: z.number().int().default(1), delay_ms: z.number().int().min(1).max(2000).default(90) } }, async ({ item_ids, output_prefix, variants: selectedVariants, frames, seed, delay_ms }) => {
      const result = await this.service.generate({ itemIds: [...item_ids], outputPrefix: output_prefix, variants: [...selectedVariants], frames, seed, delayMs: delay_ms });
      return { isError: !result.ok, content: [{ type: "text" as const, text: result.message }] };
    });
  }
}
