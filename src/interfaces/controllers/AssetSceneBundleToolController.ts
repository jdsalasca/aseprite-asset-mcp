import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AssetSceneBundleService } from "../../application/services/AssetSceneBundleService.js";

export class AssetSceneBundleToolController {
  public constructor(private readonly service: AssetSceneBundleService) {}

  public register(server: McpServer): void {
    server.registerTool("build_scene_bundle", { description: "Build a static PNG scene, animated GIF scene, and both navigation manifests through one deterministic operation.", inputSchema: { item_ids: z.array(z.string().min(1)).min(1).max(24), output_prefix: z.string().min(1), width: z.number().int().min(16).max(2048), height: z.number().int().min(16).max(2048), padding: z.number().int().min(0).max(64).default(0), frames: z.number().int().min(2).max(24).default(8), delay_ms: z.number().int().min(1).max(2000).default(90) } }, async ({ item_ids, output_prefix, width, height, padding, frames, delay_ms }) => {
      const result = await this.service.build({ itemIds: [...item_ids], outputPrefix: output_prefix, width, height, padding, frames, delayMs: delay_ms });
      return { isError: !result.ok, content: [{ type: "text" as const, text: result.message }] };
    });
  }
}
