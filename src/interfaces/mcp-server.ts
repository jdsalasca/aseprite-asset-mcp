import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { AsepriteAssetService } from "../application/services/AsepriteAssetService.js";
import { AsepriteCliGateway } from "../infrastructure/aseprite/AsepriteCliGateway.js";
import { buildCharacterPlan, buildScenePlan } from "../workflows/plans.js";
import type { AsepriteResult } from "../domain/aseprite.js";

const SERVER_VERSION = "1.0.0";
const TYPESCRIPT_VERSION = "6.0.3";
const HEX_COLOR = /^#?(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const TOOL_NAMES = [
  "server_capabilities",
  "create_canvas",
  "add_group",
  "add_layer",
  "add_frame",
  "add_frames",
  "set_frame",
  "set_frame_duration",
  "set_frame_duration_all",
  "set_layer_visibility",
  "set_layer_opacity",
  "set_palette",
  "draw_pixels",
  "draw_line",
  "draw_rectangle",
  "fill_area",
  "draw_circle",
  "draw_pixels_at",
  "draw_line_at",
  "draw_rectangle_at",
  "fill_area_at",
  "draw_circle_at",
  "draw_polygon",
  "draw_path",
  "apply_gradient_rect",
  "draw_ellipse_at",
  "export_sprite",
  "copy_sprite",
  "export_frame",
  "export_layers",
  "export_tag",
  "set_tag",
  "create_tilemap_layer",
  "validate_scene",
  "export_spritesheet",
  "create_character_plan",
  "create_scene_plan",
];

export class AsepriteMcpServerAdapter {
  public readonly server: McpServer;

  public constructor(private readonly assets: AsepriteAssetService) {
    this.server = new McpServer({ name: "aseprite-mcp-typescript", version: SERVER_VERSION });
    this.registerTools();
  }

  private registerTools(): void {
    this.server.registerTool("server_capabilities", {
      title: "Server capabilities",
      description: "List the typed TypeScript MCP capabilities available to the current server.",
    }, async () => this.text({
      serverVersion: SERVER_VERSION,
      typescriptVersion: TYPESCRIPT_VERSION,
      nodeVersion: process.version,
      architecture: "hexagonal",
      toolCount: TOOL_NAMES.length,
      tools: TOOL_NAMES,
      upstreamCommit: process.env.UPSTREAM_COMMIT ?? "90d1696a7e41edff89bbd0823ae6a5f86c114bcc",
      migrationStatus: "partial",
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

    this.server.registerTool("add_frame", {
      description: "Add one animation frame.",
      inputSchema: { filename: z.string().min(1) },
    }, async ({ filename }) => this.result(await this.assets.addFrame(filename)));

    this.server.registerTool("add_frames", {
      description: "Add a deterministic number of animation frames.",
      inputSchema: { filename: z.string().min(1), count: z.number().int().positive(), duration_ms: z.number().int().positive().optional() },
    }, async ({ filename, count, duration_ms }) => this.result(await this.assets.addFrames(filename, count, duration_ms)));

    this.server.registerTool("set_frame", {
      description: "Set the active animation frame by one-based index.",
      inputSchema: { filename: z.string().min(1), frame_index: z.number().int().positive() },
    }, async ({ filename, frame_index }) => this.result(await this.assets.setFrame(filename, frame_index)));

    this.server.registerTool("set_frame_duration", {
      description: "Set one animation frame duration in milliseconds.",
      inputSchema: { filename: z.string().min(1), frame_index: z.number().int().positive(), duration_ms: z.number().int().positive() },
    }, async ({ filename, frame_index, duration_ms }) => this.result(await this.assets.setFrameDuration(filename, frame_index, duration_ms)));

    this.server.registerTool("set_frame_duration_all", {
      description: "Set all animation frame durations in milliseconds.",
      inputSchema: { filename: z.string().min(1), duration_ms: z.number().int().positive() },
    }, async ({ filename, duration_ms }) => this.result(await this.assets.setFrameDurationAll(filename, duration_ms)));

    this.server.registerTool("set_layer_visibility", {
      description: "Set a named layer visibility.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), visible: z.boolean().default(true) },
    }, async ({ filename, layer_name, visible }) => this.result(await this.assets.setLayerVisibility(filename, layer_name, visible)));

    this.server.registerTool("set_layer_opacity", {
      description: "Set a named layer opacity from 0 to 255.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), opacity: z.number().int().min(0).max(255) },
    }, async ({ filename, layer_name, opacity }) => this.result(await this.assets.setLayerOpacity(filename, layer_name, opacity)));

    this.server.registerTool("set_palette", {
      description: "Apply a controlled hexadecimal palette to a document.",
      inputSchema: { filename: z.string().min(1), colors: z.array(z.string().regex(HEX_COLOR)).min(1) },
    }, async ({ filename, colors }) => this.result(await this.assets.setPalette(filename, colors)));

    this.server.registerTool("draw_pixels", {
      description: "Draw explicit pixels on the active cel.",
      inputSchema: {
        filename: z.string().min(1),
        pixels: z.array(z.object({ x: z.number().int(), y: z.number().int(), color: z.string().regex(HEX_COLOR) })).min(1),
      },
    }, async ({ filename, pixels }) => this.result(await this.assets.drawPixels(filename, pixels)));

    this.server.registerTool("draw_line", {
      description: "Draw a Bresenham line with optional pixel thickness.",
      inputSchema: {
        filename: z.string().min(1),
        x1: z.number().int(),
        y1: z.number().int(),
        x2: z.number().int(),
        y2: z.number().int(),
        color: z.string().regex(HEX_COLOR).default("#000000"),
        thickness: z.number().int().positive().default(1),
      },
    }, async ({ filename, x1, y1, x2, y2, color, thickness }) => this.result(await this.assets.drawLine(filename, x1, y1, x2, y2, color, thickness)));

    this.server.registerTool("draw_rectangle", {
      description: "Draw a filled or outlined pixel-art rectangle on the active Aseprite layer.",
      inputSchema: {
        filename: z.string().min(1), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive(),
        color: z.string().regex(HEX_COLOR), fill: z.boolean().default(false),
      },
    }, async ({ filename, x, y, width, height, color, fill }) => this.result(await this.assets.drawRectangle(filename, x, y, width, height, color, fill)));

    this.server.registerTool("fill_area", {
      description: "Fill a contiguous area from a seed pixel.",
      inputSchema: { filename: z.string().min(1), x: z.number().int(), y: z.number().int(), color: z.string().regex(HEX_COLOR).default("#000000") },
    }, async ({ filename, x, y, color }) => this.result(await this.assets.fillArea(filename, x, y, color)));

    this.server.registerTool("draw_circle", {
      description: "Draw an ellipse-bounded circle.",
      inputSchema: {
        filename: z.string().min(1),
        center_x: z.number().int(),
        center_y: z.number().int(),
        radius: z.number().int().positive(),
        color: z.string().regex(HEX_COLOR).default("#000000"),
        fill: z.boolean().default(false),
      },
    }, async ({ filename, center_x, center_y, radius, color, fill }) => this.result(await this.assets.drawCircle(filename, center_x, center_y, radius, color, fill)));

    this.server.registerTool("draw_pixels_at", {
      description: "Draw explicit pixels on a named layer and animation frame, creating the cel when requested.",
      inputSchema: {
        filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(),
        pixels: z.array(z.object({ x: z.number().int(), y: z.number().int(), color: z.string().regex(HEX_COLOR) })).min(1),
        create_if_missing: z.boolean().default(true),
      },
    }, async ({ filename, layer_name, frame_index, pixels, create_if_missing }) => this.result(await this.assets.drawPixelsAt(filename, layer_name, frame_index, pixels, create_if_missing)));

    this.server.registerTool("draw_line_at", {
      description: "Draw a Bresenham line on a named layer and animation frame.",
      inputSchema: {
        filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(),
        x1: z.number().int(), y1: z.number().int(), x2: z.number().int(), y2: z.number().int(),
        color: z.string().regex(HEX_COLOR).default("#000000"), thickness: z.number().int().positive().default(1), create_if_missing: z.boolean().default(true),
      },
    }, async ({ filename, layer_name, frame_index, x1, y1, x2, y2, color, thickness, create_if_missing }) => this.result(await this.assets.drawLineAt(filename, layer_name, frame_index, x1, y1, x2, y2, color, thickness, create_if_missing)));

    this.server.registerTool("draw_rectangle_at", {
      description: "Draw a filled or outlined rectangle on a named layer and animation frame.",
      inputSchema: {
        filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(),
        x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive(),
        color: z.string().regex(HEX_COLOR).default("#000000"), fill: z.boolean().default(false), create_if_missing: z.boolean().default(true),
      },
    }, async ({ filename, layer_name, frame_index, x, y, width, height, color, fill, create_if_missing }) => this.result(await this.assets.drawRectangleAt(filename, layer_name, frame_index, x, y, width, height, color, fill, create_if_missing)));

    this.server.registerTool("fill_area_at", {
      description: "Fill a contiguous area on a named layer and animation frame.",
      inputSchema: {
        filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(),
        x: z.number().int(), y: z.number().int(), color: z.string().regex(HEX_COLOR).default("#000000"), create_if_missing: z.boolean().default(true),
      },
    }, async ({ filename, layer_name, frame_index, x, y, color, create_if_missing }) => this.result(await this.assets.fillAreaAt(filename, layer_name, frame_index, x, y, color, create_if_missing)));

    this.server.registerTool("draw_circle_at", {
      description: "Draw an ellipse-bounded circle on a named layer and animation frame.",
      inputSchema: {
        filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(),
        center_x: z.number().int(), center_y: z.number().int(), radius: z.number().int().positive(),
        color: z.string().regex(HEX_COLOR).default("#000000"), fill: z.boolean().default(false), create_if_missing: z.boolean().default(true),
      },
    }, async ({ filename, layer_name, frame_index, center_x, center_y, radius, color, fill, create_if_missing }) => this.result(await this.assets.drawCircleAt(filename, layer_name, frame_index, center_x, center_y, radius, color, fill, create_if_missing)));

    this.server.registerTool("draw_polygon", {
      description: "Draw a filled or outlined polygon on a named layer and animation frame.",
      inputSchema: {
        filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(),
        points: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(3),
        color: z.string().regex(HEX_COLOR).default("#000000"), fill: z.boolean().default(false), create_if_missing: z.boolean().default(true),
      },
    }, async ({ filename, layer_name, frame_index, points, color, fill, create_if_missing }) => this.result(await this.assets.drawPolygon(filename, layer_name, frame_index, points, color, fill, create_if_missing)));

    this.server.registerTool("draw_path", {
      description: "Draw a polyline on a named layer and animation frame.",
      inputSchema: {
        filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(),
        points: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(2),
        color: z.string().regex(HEX_COLOR).default("#000000"), thickness: z.number().int().positive().default(1), create_if_missing: z.boolean().default(true),
      },
    }, async ({ filename, layer_name, frame_index, points, color, thickness, create_if_missing }) => this.result(await this.assets.drawPath(filename, layer_name, frame_index, points, color, thickness, create_if_missing)));

    this.server.registerTool("apply_gradient_rect", {
      description: "Apply a horizontal or vertical linear gradient to a rectangle on a named layer and animation frame.",
      inputSchema: {
        filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(),
        x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive(),
        color_start: z.string().regex(HEX_COLOR), color_end: z.string().regex(HEX_COLOR), horizontal: z.boolean().default(true), create_if_missing: z.boolean().default(true),
      },
    }, async ({ filename, layer_name, frame_index, x, y, width, height, color_start, color_end, horizontal, create_if_missing }) => this.result(await this.assets.applyGradientRect(filename, layer_name, frame_index, x, y, width, height, color_start, color_end, horizontal, create_if_missing)));

    this.server.registerTool("draw_ellipse_at", {
      description: "Draw a filled or outlined ellipse on a named layer and animation frame.",
      inputSchema: {
        filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(),
        center_x: z.number().int(), center_y: z.number().int(), radius_x: z.number().int().positive(), radius_y: z.number().int().positive(),
        color: z.string().regex(HEX_COLOR).default("#000000"), fill: z.boolean().default(false), create_if_missing: z.boolean().default(true),
      },
    }, async ({ filename, layer_name, frame_index, center_x, center_y, radius_x, radius_y, color, fill, create_if_missing }) => this.result(await this.assets.drawEllipseAt(filename, layer_name, frame_index, center_x, center_y, radius_x, radius_y, color, fill, create_if_missing)));

    this.server.registerTool("export_sprite", {
      description: "Export a sprite to a selected image format and confirm that Aseprite wrote an output file.",
      inputSchema: { filename: z.string().min(1), output_filename: z.string().min(1), format: z.string().regex(/^[a-z0-9]+$/i).default("png") },
    }, async ({ filename, output_filename, format }) => this.result(await this.assets.exportSprite(filename, output_filename, format)));

    this.server.registerTool("copy_sprite", {
      description: "Copy a sprite to another Aseprite document, refusing to overwrite by default.",
      inputSchema: { filename: z.string().min(1), output_filename: z.string().min(1), overwrite: z.boolean().default(false) },
    }, async ({ filename, output_filename, overwrite }) => this.result(await this.assets.copySprite(filename, output_filename, overwrite)));

    this.server.registerTool("export_frame", {
      description: "Export one animation frame as a PNG with nearest-neighbor integer scaling.",
      inputSchema: { filename: z.string().min(1), frame_index: z.number().int().positive(), output_filename: z.string().min(1), scale: z.number().int().min(1).max(64).default(1) },
    }, async ({ filename, frame_index, output_filename, scale }) => this.result(await this.assets.exportFrame(filename, frame_index, output_filename, scale)));

    this.server.registerTool("export_layers", {
      description: "Export each layer as a PNG and confirm that at least one new layer file was written.",
      inputSchema: { filename: z.string().min(1), output_directory: z.string().min(1), include_hidden: z.boolean().default(false) },
    }, async ({ filename, output_directory, include_hidden }) => this.result(await this.assets.exportLayers(filename, output_directory, include_hidden)));

    this.server.registerTool("export_tag", {
      description: "Export an animation tag as an image or animation file after validating that the tag exists.",
      inputSchema: { filename: z.string().min(1), tag_name: z.string().min(1), output_filename: z.string().min(1), scale: z.number().int().min(1).max(64).default(1) },
    }, async ({ filename, tag_name, output_filename, scale }) => this.result(await this.assets.exportTag(filename, tag_name, output_filename, scale)));

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
