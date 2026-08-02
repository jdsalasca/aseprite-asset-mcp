import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AssetLibraryService } from "../../application/services/AssetLibraryService.js";
import type { AssetLibraryAuditService } from "../../application/services/AssetLibraryAuditService.js";
import type { AssetLibrarySummaryService } from "../../application/services/AssetLibrarySummaryService.js";
import type { AssetScenePlannerService } from "../../application/services/AssetScenePlannerService.js";
import type { AssetSceneComposerService } from "../../application/services/AssetSceneComposerService.js";

export class AssetLibraryToolController {
  public constructor(private readonly library: AssetLibraryService, private readonly auditService: AssetLibraryAuditService, private readonly summaryService: AssetLibrarySummaryService, private readonly scenePlanner: AssetScenePlannerService, private readonly sceneComposer: AssetSceneComposerService) {}

  public register(server: McpServer): void {
    server.registerTool("get_asset_library", { description: "Search the deterministic asset/preset library with compact results for humans and agents.", inputSchema: { query: z.string().optional(), category: z.string().optional(), limit: z.number().int().min(1).max(100).default(24) } }, async ({ query, category, limit }) => this.text(await this.library.search({ ...(query === undefined ? {} : { query }), ...(category === undefined ? {} : { category }), limit })));
    server.registerTool("get_asset_library_item", { description: "Resolve one library item and its README, preview, sprite sheet, and variants.", inputSchema: { id: z.string().min(1) } }, async ({ id }) => this.text(await this.library.get(id)));
    server.registerTool("get_asset_preset", { description: "Resolve a ready-to-compose scene preset and its recommended MCP tools.", inputSchema: { id: z.string().min(1) } }, async ({ id }) => this.text(await this.library.preset(id)));
    server.registerTool("compose_asset_preset", { description: "Compose one scene preset into compact assets and ordered layers for a single low-token request.", inputSchema: { id: z.string().min(1) } }, async ({ id }) => this.text(await this.library.composePreset(id)));
    server.registerTool("audit_asset_library", { description: "Audit library ids, preset references, categories, folders, and navigable asset paths before composing a scene.", inputSchema: {} }, async () => this.result(await this.auditService.audit()));
    server.registerTool("summarize_asset_library", { description: "Return compact category and preset navigation metadata for the asset library with minimal tokens.", inputSchema: {} }, async () => this.result(await this.summaryService.summarize()));
    server.registerTool("plan_asset_scene", { description: "Plan ordered scene layers from selected asset library ids without generating files or loading full asset details.", inputSchema: { item_ids: z.array(z.string().min(1)).min(1).max(24) } }, async ({ item_ids }) => { try { return this.result(await this.scenePlanner.plan(item_ids)); } catch (error) { return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }] }; } });
    server.registerTool("compose_asset_scene", { description: "Compose selected library previews into a deterministic PNG and navigable manifest.", inputSchema: { item_ids: z.array(z.string().min(1)).min(1).max(24), output_filename: z.string().min(1), manifest_filename: z.string().min(1), width: z.number().int().min(16).max(2048), height: z.number().int().min(16).max(2048), padding: z.number().int().min(0).max(64).default(0) } }, async ({ item_ids, output_filename, manifest_filename, width, height, padding }) => this.result(await this.sceneComposer.compose({ itemIds: item_ids, outputFilename: output_filename, manifestFilename: manifest_filename, width, height, padding })));
  }

  private text(value: unknown): { content: [{ type: "text"; text: string }] } { return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] }; }
  private result(result: { ok: boolean; message: string }): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !result.ok, content: [{ type: "text", text: result.message }] }; }
}
