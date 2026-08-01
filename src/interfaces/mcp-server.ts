import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { AsepriteAssetService } from "../application/services/AsepriteAssetService.js";
import { AsepriteCliGateway } from "../infrastructure/aseprite/AsepriteCliGateway.js";
import { buildCharacterPlan, buildScenePlan } from "../workflows/plans.js";
import type { AsepriteResult } from "../domain/aseprite.js";

export class AsepriteMcpServerAdapter {
  public readonly server: McpServer;

  public constructor(private readonly assets: AsepriteAssetService) {
    this.server = new McpServer({ name: "aseprite-mcp-typescript", version: "1.0.0" });
    this.registerTools();
  }

  private registerTools(): void {
    this.server.registerTool("server_capabilities", {
      title: "Server capabilities",
      description: "List the typed TypeScript MCP capabilities available to the current server.",
    }, async () => this.text({
      runtime: "Node.js + TypeScript",
      architecture: "hexagonal",
      tools: ["create_canvas", "add_group", "add_layer", "add_frames", "set_palette", "set_tag", "create_tilemap_layer", "validate_scene", "export_spritesheet", "create_character_plan", "create_scene_plan"],
      legacyRuntime: false,
    }));

    this.server.registerTool("create_canvas", {
      description: "Create a new Aseprite canvas.",
      inputSchema: { width: z.number().int().positive(), height: z.number().int().positive(), filename: z.string().min(1) },
    }, async ({ width, height, filename }) => this.result(await this.assets.createCanvas(width, height, filename)));

    this.server.registerTool("add_group", {
      description: "Add a named layer group to an Aseprite document.",
      inputSchema: { filename: z.string().min(1), group_name: z.string().min(1), parent_group: z.string().default("") },
    }, async ({ filename, group_name, parent_group }) => this.result(await this.assets.addGroup(filename, group_name, parent_group)));

    this.server.registerTool("add_layer", {
      description: "Add a named layer, optionally inside a group.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), group: z.string().default("") },
    }, async ({ filename, layer_name, group }) => this.result(await this.assets.addLayer(filename, layer_name, group)));

    this.server.registerTool("add_frames", {
      description: "Add a deterministic number of animation frames.",
      inputSchema: { filename: z.string().min(1), count: z.number().int().positive(), duration_ms: z.number().int().positive().optional() },
    }, async ({ filename, count, duration_ms }) => this.result(await this.assets.addFrames(filename, count, duration_ms)));

    this.server.registerTool("set_palette", {
      description: "Apply a controlled hexadecimal palette to a document.",
      inputSchema: { filename: z.string().min(1), colors: z.array(z.string().min(4)).min(1) },
    }, async ({ filename, colors }) => this.result(await this.assets.setPalette(filename, colors)));

    this.server.registerTool("set_tag", {
      description: "Create or update an animation tag.",
      inputSchema: {
        filename: z.string().min(1), name: z.string().min(1), from_frame: z.number().int().positive(), to_frame: z.number().int().positive(),
        direction: z.enum(["forward", "reverse", "pingpong", "pingpong_reverse"]).default("forward"),
      },
    }, async ({ filename, name, from_frame, to_frame, direction }) => this.result(await this.assets.setTag(filename, name, from_frame, to_frame, direction)));

    this.server.registerTool("create_tilemap_layer", {
      description: "Create a tilemap layer and set the Aseprite grid.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), tile_width: z.number().int().positive(), tile_height: z.number().int().positive() },
    }, async ({ filename, layer_name, tile_width, tile_height }) => this.result(await this.assets.createTilemapLayer(filename, layer_name, tile_width, tile_height)));

    this.server.registerTool("validate_scene", {
      description: "Validate required layers and the requested frame range before export.",
      inputSchema: { filename: z.string().min(1), required_layers: z.array(z.string().min(1)).min(1), start_frame: z.number().int().positive().default(1), end_frame: z.number().int().positive().optional() },
    }, async ({ filename, required_layers, start_frame, end_frame }) => this.result(await this.assets.validateScene(filename, required_layers, start_frame, end_frame)));

    this.server.registerTool("export_spritesheet", {
      description: "Export a spritesheet and optional frame metadata for Godot.",
      inputSchema: {
        filename: z.string().min(1), output_filename: z.string().min(1), sheet_type: z.enum(["horizontal", "vertical", "rows", "columns", "packed"]).default("horizontal"),
        data_filename: z.string().min(1).optional(), scale: z.number().int().positive().default(1), padding: z.number().int().nonnegative().default(0), tag_name: z.string().min(1).optional(),
        data_format: z.enum(["json-array", "json-hash"]).default("json-array"), list_tags: z.boolean().default(false),
      },
    }, async (input) => this.result(await this.assets.exportSpritesheet({
      filename: input.filename,
      outputFilename: input.output_filename,
      sheetType: input.sheet_type,
      ...(input.data_filename ? { dataFilename: input.data_filename } : {}),
      scale: input.scale,
      padding: input.padding,
      ...(input.tag_name ? { tagName: input.tag_name } : {}),
      dataFormat: input.data_format,
      listTags: input.list_tags,
    })));

    this.server.registerTool("create_character_plan", {
      description: "Create a deterministic, auditable TypeScript plan for a layered character and its Godot exports.",
      inputSchema: { asset_id: z.string().min(1), output_directory: z.string().min(1).optional() },
    }, async ({ asset_id, output_directory }) => this.text(buildCharacterPlan(output_directory ? { assetId: asset_id, outputDirectory: output_directory } : { assetId: asset_id })));

    this.server.registerTool("create_scene_plan", {
      description: "Create a deterministic, auditable TypeScript plan for a tilemap scene and its Godot exports.",
      inputSchema: { asset_id: z.string().min(1), output_directory: z.string().min(1).optional() },
    }, async ({ asset_id, output_directory }) => this.text(buildScenePlan(output_directory ? { assetId: asset_id, outputDirectory: output_directory } : { assetId: asset_id })));
  }

  private result(operation: AsepriteResult): { isError?: boolean; content: [{ type: "text"; text: string }] } {
    return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] };
  }

  private text(value: unknown): { content: [{ type: "text"; text: string }] } {
    return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
  }
}

async function main(): Promise<void> {
  const gateway = new AsepriteCliGateway();
  const adapter = new AsepriteMcpServerAdapter(new AsepriteAssetService(gateway));
  await adapter.server.connect(new StdioServerTransport());
  console.error("Aseprite MCP TypeScript server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Aseprite MCP TypeScript server error", error);
  process.exitCode = 1;
});
