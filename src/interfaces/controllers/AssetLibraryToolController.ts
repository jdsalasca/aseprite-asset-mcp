import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AssetLibraryService } from "../../application/services/AssetLibraryService.js";

export class AssetLibraryToolController {
  public constructor(private readonly library: AssetLibraryService) {}

  public register(server: McpServer): void {
    server.registerTool("get_asset_library", { description: "Search the deterministic asset/preset library with compact results for humans and agents.", inputSchema: { query: z.string().optional(), category: z.string().optional(), limit: z.number().int().min(1).max(100).default(24) } }, async ({ query, category, limit }) => this.text(await this.library.search({ ...(query === undefined ? {} : { query }), ...(category === undefined ? {} : { category }), limit })));
    server.registerTool("get_asset_library_item", { description: "Resolve one library item and its README, preview, sprite sheet, and variants.", inputSchema: { id: z.string().min(1) } }, async ({ id }) => this.text(await this.library.get(id)));
    server.registerTool("get_asset_preset", { description: "Resolve a ready-to-compose scene preset and its recommended MCP tools.", inputSchema: { id: z.string().min(1) } }, async ({ id }) => this.text(await this.library.preset(id)));
    server.registerTool("compose_asset_preset", { description: "Compose one scene preset into compact assets and ordered layers for a single low-token request.", inputSchema: { id: z.string().min(1) } }, async ({ id }) => this.text(await this.library.composePreset(id)));
  }

  private text(value: unknown): { content: [{ type: "text"; text: string }] } { return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] }; }
}
