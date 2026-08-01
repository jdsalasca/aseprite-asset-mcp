import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { WorkflowPort } from "../../application/ports/AssetCapabilityPorts.js";
import { buildCharacterPlan, buildScenePlan } from "../../workflows/plans.js";
import type { AsepriteResult } from "../../domain/aseprite.js";

export class WorkflowPlanToolController {
  public constructor(private readonly assets: WorkflowPort) {}

  public register(server: McpServer): void {
    server.registerTool("animation_workflow_guide", { description: "Return a concise deterministic guide for character, environment, or general animation workflows.", inputSchema: { use_case: z.string().default("character") } }, async ({ use_case }) => this.result(await this.assets.animationWorkflowGuide(use_case)));
    server.registerTool("run_lua_script", { description: "Run a bounded, trusted Aseprite Lua script as an escape hatch; dedicated tools are preferred.", inputSchema: { script: z.string().min(1).max(200000), filename: z.string().default("") } }, async ({ script, filename }) => this.result(await this.assets.runLuaScript(script, filename)));
    server.registerTool("create_character_plan", { description: "Create a deterministic, auditable TypeScript plan for a layered character and its Godot exports.", inputSchema: { asset_id: z.string().min(1), output_directory: z.string().min(1).optional() } }, async ({ asset_id, output_directory }) => this.text(buildCharacterPlan(output_directory ? { assetId: asset_id, outputDirectory: output_directory } : { assetId: asset_id })));
    server.registerTool("create_scene_plan", { description: "Create a deterministic, auditable TypeScript plan for a tilemap scene and its Godot exports.", inputSchema: { asset_id: z.string().min(1), output_directory: z.string().min(1).optional() } }, async ({ asset_id, output_directory }) => this.text(buildScenePlan(output_directory ? { assetId: asset_id, outputDirectory: output_directory } : { assetId: asset_id })));
  }

  private result(operation: AsepriteResult): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] }; }
  private text(value: unknown): { content: [{ type: "text"; text: string }] } { return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] }; }
}
