import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AssetSceneRecommendationService } from "../../application/services/AssetSceneRecommendationService.js";

const kind = z.enum(["sprite", "tileset", "scene", "effect", "character", "prop"]);

export class AssetSceneRecommendationToolController {
  public constructor(private readonly service: AssetSceneRecommendationService) {}

  public register(server: McpServer): void {
    server.registerTool("recommend_asset_scene", { description: "Recommend a compact, deterministic set of compatible library assets for a scene, with explainable reasons and covered tags/effects.", inputSchema: { prompt: z.string().optional(), category: z.string().optional(), required_kinds: z.array(kind).max(6).optional(), required_tags: z.array(z.string().min(1)).max(12).optional(), required_variants: z.array(z.string().min(1)).max(10).optional(), limit: z.number().int().min(1).max(24).default(8), seed: z.number().int().default(1) } }, async ({ prompt, category, required_kinds, required_tags, required_variants, limit, seed }) => {
      const result = await this.service.recommend({ ...(prompt === undefined ? {} : { prompt }), ...(category === undefined ? {} : { category }), ...(required_kinds === undefined ? {} : { requiredKinds: [...required_kinds] }), ...(required_tags === undefined ? {} : { requiredTags: [...required_tags] }), ...(required_variants === undefined ? {} : { requiredVariants: [...required_variants] }), limit, seed });
      return { isError: !result.ok, content: [{ type: "text" as const, text: result.message }] };
    });
  }
}
