import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AssetRecipeComposerService } from "../../application/services/AssetRecipeComposerService.js";
import type { AssetRecipeExecutionService } from "../../application/services/AssetRecipeExecutionService.js";
import { ASSET_RECIPE_STEPS } from "../../domain/asset-recipe.js";

export class AssetRecipeToolController {
  public constructor(private readonly composer: AssetRecipeComposerService, private readonly executor?: AssetRecipeExecutionService) {}
  public register(server: McpServer): void {
    server.registerTool("create_asset_recipe", {
      description: "Compose a deterministic, reviewable multi-effect asset recipe without executing it.",
      inputSchema: {
        asset_id: z.string().min(1), input_filename: z.string().min(1), output_prefix: z.string().min(1), format: z.enum(["png", "gif"]).default("png"),
        steps: z.array(z.enum(ASSET_RECIPE_STEPS)).min(1).max(8), seed: z.number().int().default(1), material: z.enum(["water", "earth", "grass", "stone", "snow"]).default("earth"),
        direction: z.enum(["north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west"]).default("south_east"),
      },
    }, async ({ asset_id, input_filename, output_prefix, format, steps, seed, material, direction }) => this.text(this.composer.compose({ assetId: asset_id, inputFilename: input_filename, outputPrefix: output_prefix, format, steps, seed, material, direction })));
    if (this.executor) {
      server.registerTool("execute_asset_recipe", {
        description: "Execute a deterministic composed asset recipe through the shared visual services.",
        inputSchema: {
          asset_id: z.string().min(1), input_filename: z.string().min(1), output_prefix: z.string().min(1), format: z.enum(["png", "gif"]).default("png"),
          steps: z.array(z.enum(ASSET_RECIPE_STEPS)).min(1).max(8), seed: z.number().int().default(1), material: z.enum(["water", "earth", "grass", "stone", "snow"]).default("earth"),
          direction: z.enum(["north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west"]).default("south_east"),
        },
      }, async ({ asset_id, input_filename, output_prefix, format, steps, seed, material, direction }) => this.text(await this.executor!.execute(this.composer.compose({ assetId: asset_id, inputFilename: input_filename, outputPrefix: output_prefix, format, steps, seed, material, direction }))));
    }
  }
  private text(value: unknown): { content: [{ type: "text"; text: string }] } { return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] }; }
}
