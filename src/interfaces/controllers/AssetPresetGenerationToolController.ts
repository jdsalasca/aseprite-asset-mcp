import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetPresetGenerationGateway } from "../../domain/asset-preset-generation.js";

export class AssetPresetGenerationToolController {
  public constructor(private readonly presets: AssetPresetGenerationGateway) {}
  public register(server: McpServer): void {
    server.registerTool("generate_asset_preset", { description: "Generate one executable world preset with terrain, map, preview, and deterministic time-of-day artifacts.", inputSchema: { preset_id: z.string().min(1), output_prefix: z.string().min(1), width: z.number().int().positive().max(2048), height: z.number().int().positive().max(2048), seed: z.number().int(), tile_size: z.number().int().min(4).max(128).default(16), detail_level: z.enum(["low", "medium", "high"]).default("high") } }, async ({ preset_id, output_prefix, width, height, seed, tile_size, detail_level }) => this.result(await this.presets.generate({ presetId: preset_id, outputPrefix: output_prefix, width, height, seed, tileSize: tile_size, detailLevel: detail_level })));
  }
  private result(operation: AssetOperationResult): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] }; }
}
