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
  "delete_layer",
  "rename_layer",
  "duplicate_layer",
  "reorder_layer",
  "set_layer_blend_mode",
  "merge_layer_down",
  "flatten_sprite",
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
  "import_image_as_layer",
  "create_cel",
  "clear_cel",
  "copy_cel",
  "copy_frame",
  "set_cel_position",
  "tween_cel_positions",
  "offset_cel_positions",
  "propagate_frame_to_range",
  "delete_frame",
  "delete_tag",
  "set_onion_skin",
  "render_onion_skin",
  "compare_frames",
  "set_cel_opacity",
  "get_color_stats",
  "get_palette",
  "extract_palette",
  "remap_colors_in_cel_range",
  "list_palette_presets",
  "apply_palette_preset",
  "generate_color_ramp",
  "quantize_to_palette",
  "set_color_mode",
  "get_pixel_color",
  "get_pixels_rect",
  "get_composite_pixel",
  "get_composite_rect",
  "move_region",
  "copy_region",
  "erase_region",
  "erase_color",
  "flip_layer",
  "rotate_layer",
  "resize_canvas",
  "crop_canvas",
  "list_text_fonts",
  "measure_text",
  "draw_text",
  "draw_on_tile",
  "set_tiles",
  "get_tile_at",
  "get_tilemap_info",
  "outline_native",
  "adjust_hsl_native",
  "adjust_brightness_contrast",
  "invert_colors",
  "outline_cel",
  "replace_color",
  "adjust_hsl",
  "apply_convolution",
  "list_convolution_matrices",
  "apply_dither_gradient",
  "apply_dither_pattern",
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

    this.server.registerTool("delete_layer", {
      description: "Delete a named layer from an Aseprite document.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1) },
    }, async ({ filename, layer_name }) => this.result(await this.assets.deleteLayer(filename, layer_name)));

    this.server.registerTool("rename_layer", {
      description: "Rename a named layer.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), new_name: z.string().min(1) },
    }, async ({ filename, layer_name, new_name }) => this.result(await this.assets.renameLayer(filename, layer_name, new_name)));

    this.server.registerTool("duplicate_layer", {
      description: "Duplicate a layer and its cels across all frames.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), new_name: z.string().default(""), group: z.string().default("") },
    }, async ({ filename, layer_name, new_name, group }) => this.result(await this.assets.duplicateLayer(filename, layer_name, new_name, group)));

    this.server.registerTool("reorder_layer", {
      description: "Move a layer to a one-based stack position.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), position: z.number().int().positive() },
    }, async ({ filename, layer_name, position }) => this.result(await this.assets.reorderLayer(filename, layer_name, position)));

    this.server.registerTool("set_layer_blend_mode", {
      description: "Set a layer blend mode supported by Aseprite.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), mode: z.string().min(1) },
    }, async ({ filename, layer_name, mode }) => this.result(await this.assets.setLayerBlendMode(filename, layer_name, mode)));

    this.server.registerTool("merge_layer_down", {
      description: "Merge a layer into the layer below it.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1) },
    }, async ({ filename, layer_name }) => this.result(await this.assets.mergeLayerDown(filename, layer_name)));

    this.server.registerTool("flatten_sprite", {
      description: "Flatten all layers into one layer.",
      inputSchema: { filename: z.string().min(1) },
    }, async ({ filename }) => this.result(await this.assets.flattenSprite(filename)));

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

    this.server.registerTool("import_image_as_layer", {
      description: "Import an image into a named layer and frame, creating the layer when it does not exist.",
      inputSchema: { filename: z.string().min(1), image_path: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive().default(1), x: z.number().int().default(0), y: z.number().int().default(0) },
    }, async ({ filename, image_path, layer_name, frame_index, x, y }) => this.result(await this.assets.importImageAsLayer(filename, image_path, layer_name, frame_index, x, y)));

    this.server.registerTool("create_cel", {
      description: "Create an empty cel at a layer and frame when one does not already exist.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x: z.number().int().default(0), y: z.number().int().default(0) },
    }, async ({ filename, layer_name, frame_index, x, y }) => this.result(await this.assets.createCel(filename, layer_name, frame_index, x, y)));

    this.server.registerTool("clear_cel", {
      description: "Delete a cel from a named layer and frame.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive() },
    }, async ({ filename, layer_name, frame_index }) => this.result(await this.assets.clearCel(filename, layer_name, frame_index)));

    this.server.registerTool("copy_cel", {
      description: "Copy one layer cel to another frame, replacing the destination by default.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), source_frame: z.number().int().positive(), target_frame: z.number().int().positive(), replace: z.boolean().default(true) },
    }, async ({ filename, layer_name, source_frame, target_frame, replace }) => this.result(await this.assets.copyCel(filename, layer_name, source_frame, target_frame, replace)));

    this.server.registerTool("copy_frame", {
      description: "Copy all cels from one frame to another frame or append a new frame.",
      inputSchema: { filename: z.string().min(1), source_frame: z.number().int().positive(), target_frame: z.number().int().positive().optional(), overwrite: z.boolean().default(true) },
    }, async ({ filename, source_frame, target_frame, overwrite }) => this.result(await this.assets.copyFrame(filename, source_frame, target_frame, overwrite)));

    this.server.registerTool("set_cel_position", {
      description: "Set one cel position, optionally creating it from a source cel.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x: z.number().int(), y: z.number().int(), create_if_missing: z.boolean().default(false), source_frame_index: z.number().int().positive().optional() },
    }, async ({ filename, layer_name, frame_index, x, y, create_if_missing, source_frame_index }) => this.result(await this.assets.setCelPosition(filename, layer_name, frame_index, x, y, create_if_missing, source_frame_index)));

    this.server.registerTool("tween_cel_positions", {
      description: "Tween cel positions linearly across a frame range.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), start_x: z.number().int(), start_y: z.number().int(), end_x: z.number().int(), end_y: z.number().int(), create_missing_cels: z.boolean().default(false), source_frame_index: z.number().int().positive().optional() },
    }, async ({ filename, layer_name, start_frame, end_frame, start_x, start_y, end_x, end_y, create_missing_cels, source_frame_index }) => this.result(await this.assets.tweenCelPositions(filename, layer_name, start_frame, end_frame, start_x, start_y, end_x, end_y, create_missing_cels, source_frame_index)));

    this.server.registerTool("offset_cel_positions", {
      description: "Offset cel positions across a frame range.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), dx: z.number().int(), dy: z.number().int() },
    }, async ({ filename, layer_name, start_frame, end_frame, dx, dy }) => this.result(await this.assets.offsetCelPositions(filename, layer_name, start_frame, end_frame, dx, dy)));

    this.server.registerTool("propagate_frame_to_range", {
      description: "Propagate all source-frame cels to a frame range.",
      inputSchema: { filename: z.string().min(1), source_frame: z.number().int().positive(), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), overwrite: z.boolean().default(true) },
    }, async ({ filename, source_frame, start_frame, end_frame, overwrite }) => this.result(await this.assets.propagateFrameToRange(filename, source_frame, start_frame, end_frame, overwrite)));

    this.server.registerTool("delete_frame", {
      description: "Delete one animation frame while keeping at least one frame in the sprite.",
      inputSchema: { filename: z.string().min(1), frame_index: z.number().int().positive() },
    }, async ({ filename, frame_index }) => this.result(await this.assets.deleteFrame(filename, frame_index)));

    this.server.registerTool("delete_tag", {
      description: "Delete an existing animation tag.",
      inputSchema: { filename: z.string().min(1), name: z.string().min(1) },
    }, async ({ filename, name }) => this.result(await this.assets.deleteTag(filename, name)));

    this.server.registerTool("set_onion_skin", {
      description: "Validate onion-skin settings for batch workflows; Aseprite UI-only settings are reported explicitly.",
      inputSchema: { filename: z.string().min(1), enabled: z.boolean().default(true), before: z.number().int().nonnegative().default(2), after: z.number().int().nonnegative().default(2), opacity: z.number().int().min(0).max(255).default(128) },
    }, async ({ filename, enabled, before, after, opacity }) => this.result(await this.assets.setOnionSkin(filename, enabled, before, after, opacity)));

    this.server.registerTool("render_onion_skin", {
      description: "Render neighboring animation frames as translucent onion-skin ghosts into a PNG.",
      inputSchema: { filename: z.string().min(1), frame_index: z.number().int().positive(), output_filename: z.string().min(1), before: z.number().int().nonnegative().default(1), after: z.number().int().nonnegative().default(1), scale: z.number().int().min(1).max(64).default(4), ghost_opacity: z.number().int().min(0).max(255).default(100) },
    }, async ({ filename, frame_index, output_filename, before, after, scale, ghost_opacity }) => this.result(await this.assets.renderOnionSkin(filename, frame_index, output_filename, before, after, scale, ghost_opacity)));

    this.server.registerTool("compare_frames", {
      description: "Compare two flattened animation frames and return changed-pixel metrics as JSON.",
      inputSchema: { filename: z.string().min(1), frame_a: z.number().int().positive(), frame_b: z.number().int().positive() },
    }, async ({ filename, frame_a, frame_b }) => this.result(await this.assets.compareFrames(filename, frame_a, frame_b)));

    this.server.registerTool("set_cel_opacity", {
      description: "Set one cel opacity from 0 to 255.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), opacity: z.number().int().min(0).max(255) },
    }, async ({ filename, layer_name, frame_index, opacity }) => this.result(await this.assets.setCelOpacity(filename, layer_name, frame_index, opacity)));

    this.server.registerTool("get_color_stats", {
      description: "Return JSON color usage statistics for one flattened frame.",
      inputSchema: { filename: z.string().min(1), frame_index: z.number().int().positive().default(1), top: z.number().int().positive().default(16) },
    }, async ({ filename, frame_index, top }) => this.result(await this.assets.getColorStats(filename, frame_index, top)));

    this.server.registerTool("get_palette", {
      description: "Return the active sprite palette as a JSON color array.",
      inputSchema: { filename: z.string().min(1) },
    }, async ({ filename }) => this.result(await this.assets.getPalette(filename)));

    this.server.registerTool("extract_palette", {
      description: "Extract and persist an optimized palette with a bounded color count.",
      inputSchema: { filename: z.string().min(1), max_colors: z.number().int().min(1).max(256).default(16), with_alpha: z.boolean().default(false) },
    }, async ({ filename, max_colors, with_alpha }) => this.result(await this.assets.extractPalette(filename, max_colors, with_alpha)));

    this.server.registerTool("remap_colors_in_cel_range", {
      description: "Remap explicit RGB colors across a layer frame range while preserving alpha.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), mappings: z.array(z.object({ from: z.string().regex(HEX_COLOR), to: z.string().regex(HEX_COLOR) })).min(1), create_missing_cels: z.boolean().default(false), source_frame_index: z.number().int().positive().optional() },
    }, async ({ filename, layer_name, start_frame, end_frame, mappings, create_missing_cels, source_frame_index }) => this.result(await this.assets.remapColorsInCelRange(filename, layer_name, start_frame, end_frame, mappings, create_missing_cels, source_frame_index)));

    this.server.registerTool("list_palette_presets", {
      description: "List built-in retro palette presets.",
      inputSchema: {},
    }, async () => this.result(await this.assets.listPalettePresets()));

    this.server.registerTool("apply_palette_preset", {
      description: "Apply a built-in retro palette preset to the sprite.",
      inputSchema: { filename: z.string().min(1), preset: z.string().min(1) },
    }, async ({ filename, preset }) => this.result(await this.assets.applyPalettePreset(filename, preset)));

    this.server.registerTool("generate_color_ramp", {
      description: "Generate a hue-shifted dark-to-light pixel-art color ramp.",
      inputSchema: { base_color: z.string().regex(HEX_COLOR), steps: z.number().int().min(2).max(16).default(5), hue_shift_degrees: z.number().default(20), lightness_range: z.number().min(0).max(1).default(0.5) },
    }, async ({ base_color, steps, hue_shift_degrees, lightness_range }) => this.result(await this.assets.generateColorRamp(base_color, steps, hue_shift_degrees, lightness_range)));

    this.server.registerTool("quantize_to_palette", {
      description: "Snap opaque pixels to the nearest color in the active palette.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().default(""), start_frame: z.number().int().positive().default(1), end_frame: z.number().int().nonnegative().default(0) },
    }, async ({ filename, layer_name, start_frame, end_frame }) => this.result(await this.assets.quantizeToPalette(filename, layer_name, start_frame, end_frame)));

    this.server.registerTool("set_color_mode", {
      description: "Convert a sprite to RGB, grayscale, or indexed color mode.",
      inputSchema: { filename: z.string().min(1), mode: z.enum(["rgb", "grayscale", "indexed"]) },
    }, async ({ filename, mode }) => this.result(await this.assets.setColorMode(filename, mode)));

    this.server.registerTool("get_pixel_color", {
      description: "Read one RGBA pixel from a cel.",
      inputSchema: { filename: z.string().min(1), x: z.number().int(), y: z.number().int(), layer_name: z.string().default(""), frame_index: z.number().int().positive().default(1) },
    }, async ({ filename, x, y, layer_name, frame_index }) => this.result(await this.assets.getPixelColor(filename, x, y, layer_name, frame_index)));

    this.server.registerTool("get_pixels_rect", {
      description: "Read a rectangular RGBA region from a cel as JSON.",
      inputSchema: { filename: z.string().min(1), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive(), layer_name: z.string().default(""), frame_index: z.number().int().positive().default(1) },
    }, async ({ filename, x, y, width, height, layer_name, frame_index }) => this.result(await this.assets.getPixelsRect(filename, x, y, width, height, layer_name, frame_index)));

    this.server.registerTool("get_composite_pixel", {
      description: "Read one RGBA pixel from the visible flattened composite.",
      inputSchema: { filename: z.string().min(1), x: z.number().int(), y: z.number().int(), frame_index: z.number().int().positive().default(1) },
    }, async ({ filename, x, y, frame_index }) => this.result(await this.assets.getCompositePixel(filename, x, y, frame_index)));

    this.server.registerTool("get_composite_rect", {
      description: "Read a visible flattened composite region as JSON.",
      inputSchema: { filename: z.string().min(1), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive(), frame_index: z.number().int().positive().default(1) },
    }, async ({ filename, x, y, width, height, frame_index }) => this.result(await this.assets.getCompositeRect(filename, x, y, width, height, frame_index)));

    this.server.registerTool("move_region", {
      description: "Move a rectangular region within a cel, clearing its source.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive(), dest_x: z.number().int(), dest_y: z.number().int() },
    }, async ({ filename, layer_name, frame_index, x, y, width, height, dest_x, dest_y }) => this.result(await this.assets.moveRegion(filename, layer_name, frame_index, x, y, width, height, dest_x, dest_y)));

    this.server.registerTool("copy_region", {
      description: "Copy a rectangular region to a layer and frame destination.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive(), dest_x: z.number().int(), dest_y: z.number().int(), target_layer_name: z.string().default(""), target_frame_index: z.number().int().nonnegative().default(0) },
    }, async ({ filename, layer_name, frame_index, x, y, width, height, dest_x, dest_y, target_layer_name, target_frame_index }) => this.result(await this.assets.copyRegion(filename, layer_name, frame_index, x, y, width, height, dest_x, dest_y, target_layer_name, target_frame_index)));

    this.server.registerTool("erase_region", {
      description: "Erase a rectangular region to transparency.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive() },
    }, async ({ filename, layer_name, frame_index, x, y, width, height }) => this.result(await this.assets.eraseRegion(filename, layer_name, frame_index, x, y, width, height)));

    this.server.registerTool("erase_color", {
      description: "Erase opaque pixels matching a color within channel tolerance.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), color: z.string().regex(HEX_COLOR), tolerance: z.number().int().min(0).max(255).default(0) },
    }, async ({ filename, layer_name, frame_index, color, tolerance }) => this.result(await this.assets.eraseColor(filename, layer_name, frame_index, color, tolerance)));

    this.server.registerTool("flip_layer", {
      description: "Flip a layer cel horizontally or vertically.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), direction: z.enum(["horizontal", "vertical"]).default("horizontal") },
    }, async ({ filename, layer_name, frame_index, direction }) => this.result(await this.assets.flipLayer(filename, layer_name, frame_index, direction)));

    this.server.registerTool("rotate_layer", {
      description: "Rotate a layer cel 90, 180, or 270 degrees clockwise.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), angle: z.union([z.literal(90), z.literal(180), z.literal(270)]).default(90) },
    }, async ({ filename, layer_name, frame_index, angle }) => this.result(await this.assets.rotateLayer(filename, layer_name, frame_index, angle)));

    this.server.registerTool("resize_canvas", {
      description: "Resize the sprite canvas and its content.",
      inputSchema: { filename: z.string().min(1), width: z.number().int().positive(), height: z.number().int().positive() },
    }, async ({ filename, width, height }) => this.result(await this.assets.resizeCanvas(filename, width, height)));

    this.server.registerTool("crop_canvas", {
      description: "Crop the sprite canvas to a rectangle.",
      inputSchema: { filename: z.string().min(1), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive() },
    }, async ({ filename, x, y, width, height }) => this.result(await this.assets.cropCanvas(filename, x, y, width, height)));

    this.server.registerTool("list_text_fonts", {
      description: "List discoverable TrueType and OpenType fonts.",
      inputSchema: {},
    }, async () => this.result(await this.assets.listTextFonts()));

    this.server.registerTool("measure_text", {
      description: "Measure a text run without changing a sprite.",
      inputSchema: { text: z.string(), font: z.string().min(1), size: z.number().int().positive().default(1), letter_spacing: z.number().int().nonnegative().default(0), bold: z.number().int().nonnegative().default(0), antialias: z.boolean().default(false) },
    }, async ({ text, font, size, letter_spacing, bold, antialias }) => this.result(await this.assets.measureText(text, font, size, letter_spacing, bold, antialias)));

    this.server.registerTool("draw_text", {
      description: "Rasterize and draw text into a sprite layer and frame.",
      inputSchema: {
        filename: z.string().min(1), text: z.string().min(1), x: z.number().int(), y: z.number().int(), font: z.string().min(1), size: z.number().int().positive().default(1), color: z.string().regex(HEX_COLOR).default("#FFFFFF"), layer_name: z.string().default(""), frame_index: z.number().int().positive().default(1),
        anchor: z.enum(["topleft", "top", "topright", "left", "center", "right", "bottomleft", "bottom", "bottomright", "baselineleft", "baseline", "baselineright"]).default("topleft"), letter_spacing: z.number().int().nonnegative().default(0), bold: z.number().int().nonnegative().default(0), outline_color: z.string().regex(HEX_COLOR).optional(), outline_width: z.number().int().positive().default(1), outline_diagonal: z.boolean().default(true), shadow_color: z.string().regex(HEX_COLOR).optional(), shadow_dx: z.number().int().default(1), shadow_dy: z.number().int().default(1), antialias: z.boolean().default(false), create_if_missing: z.boolean().default(true),
      },
    }, async ({ filename, text, x, y, font, size, color, layer_name, frame_index, anchor, letter_spacing, bold, outline_color, outline_width, outline_diagonal, shadow_color, shadow_dx, shadow_dy, antialias, create_if_missing }) => this.result(await this.assets.drawText({ filename, text, x, y, font, size, color, layerName: layer_name, frameIndex: frame_index, anchor, letterSpacing: letter_spacing, bold, outlineColor: outline_color, outlineWidth: outline_width, outlineDiagonal: outline_diagonal, shadowColor: shadow_color, shadowDx: shadow_dx, shadowDy: shadow_dy, antialias, createIfMissing: create_if_missing })));

    this.server.registerTool("draw_on_tile", {
      description: "Draw pixels onto a tilemap tileset tile.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), tile_index: z.number().int().min(1), pixels: z.array(z.object({ x: z.number().int(), y: z.number().int(), color: z.string().regex(HEX_COLOR) })).min(1) },
    }, async ({ filename, layer_name, tile_index, pixels }) => this.result(await this.assets.drawOnTile(filename, layer_name, tile_index, pixels)));

    this.server.registerTool("set_tiles", {
      description: "Place tile indices on a tilemap frame by grid coordinates.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), tiles: z.array(z.object({ col: z.number().int().nonnegative(), row: z.number().int().nonnegative(), tile_index: z.number().int().nonnegative() })).min(1) },
    }, async ({ filename, layer_name, frame_index, tiles }) => this.result(await this.assets.setTiles(filename, layer_name, frame_index, tiles.map(({ col, row, tile_index }) => ({ col, row, tileIndex: tile_index })))));

    this.server.registerTool("get_tile_at", {
      description: "Read the tile index at a tilemap grid coordinate.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), col: z.number().int().nonnegative(), row: z.number().int().nonnegative() },
    }, async ({ filename, layer_name, frame_index, col, row }) => this.result(await this.assets.getTileAt(filename, layer_name, frame_index, col, row)));

    this.server.registerTool("get_tilemap_info", {
      description: "Read tile size, tileset count, and map dimensions.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1) },
    }, async ({ filename, layer_name }) => this.result(await this.assets.getTilemapInfo(filename, layer_name)));

    this.server.registerTool("outline_native", {
      description: "Apply Aseprite native outline to a selected layer and frame.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().default(""), frame_index: z.number().int().positive().default(1), color: z.string().regex(HEX_COLOR).default("#000000"), place: z.enum(["outside", "inside"]).default("outside"), matrix: z.enum(["circle", "square"]).default("circle") },
    }, async ({ filename, layer_name, frame_index, color, place, matrix }) => this.result(await this.assets.outlineNative(filename, layer_name, frame_index, color, place, matrix)));

    this.server.registerTool("adjust_hsl_native", {
      description: "Apply Aseprite native hue, saturation, and lightness adjustment.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().default(""), frame_index: z.number().int().positive().default(1), hue: z.number().int().min(-180).max(180).default(0), saturation: z.number().int().min(-100).max(100).default(0), lightness: z.number().int().min(-100).max(100).default(0), x: z.number().int().default(0), y: z.number().int().default(0), width: z.number().int().nonnegative().default(0), height: z.number().int().nonnegative().default(0) },
    }, async ({ filename, layer_name, frame_index, hue, saturation, lightness, x, y, width, height }) => this.result(await this.assets.adjustHslNative(filename, layer_name, frame_index, hue, saturation, lightness, x, y, width, height)));

    this.server.registerTool("adjust_brightness_contrast", {
      description: "Apply Aseprite native brightness and contrast adjustment.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().default(""), frame_index: z.number().int().positive().default(1), brightness: z.number().int().min(-100).max(100).default(0), contrast: z.number().int().min(-100).max(100).default(0), x: z.number().int().default(0), y: z.number().int().default(0), width: z.number().int().nonnegative().default(0), height: z.number().int().nonnegative().default(0) },
    }, async ({ filename, layer_name, frame_index, brightness, contrast, x, y, width, height }) => this.result(await this.assets.adjustBrightnessContrast(filename, layer_name, frame_index, brightness, contrast, x, y, width, height)));

    this.server.registerTool("invert_colors", {
      description: "Apply Aseprite native color inversion.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().default(""), frame_index: z.number().int().positive().default(1), x: z.number().int().default(0), y: z.number().int().default(0), width: z.number().int().nonnegative().default(0), height: z.number().int().nonnegative().default(0) },
    }, async ({ filename, layer_name, frame_index, x, y, width, height }) => this.result(await this.assets.invertColors(filename, layer_name, frame_index, x, y, width, height)));

    this.server.registerTool("outline_cel", {
      description: "Add a one-pixel outline around opaque cel pixels.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), color: z.string().regex(HEX_COLOR).default("#000000"), include_diagonals: z.boolean().default(false) },
    }, async ({ filename, layer_name, frame_index, color, include_diagonals }) => this.result(await this.assets.outlineCel(filename, layer_name, frame_index, color, include_diagonals)));

    this.server.registerTool("replace_color", {
      description: "Replace a cel color while preserving alpha and allowing channel tolerance.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), from_color: z.string().regex(HEX_COLOR), to_color: z.string().regex(HEX_COLOR), tolerance: z.number().int().min(0).max(255).default(0) },
    }, async ({ filename, layer_name, frame_index, from_color, to_color, tolerance }) => this.result(await this.assets.replaceColor(filename, layer_name, frame_index, from_color, to_color, tolerance)));

    this.server.registerTool("adjust_hsl", {
      description: "Shift hue, saturation, and lightness on an opaque cel while preserving alpha.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), hue_shift: z.number().min(-360).max(360).default(0), saturation_shift: z.number().min(-100).max(100).default(0), lightness_shift: z.number().min(-100).max(100).default(0) },
    }, async ({ filename, layer_name, frame_index, hue_shift, saturation_shift, lightness_shift }) => this.result(await this.assets.adjustHsl(filename, layer_name, frame_index, hue_shift, saturation_shift, lightness_shift)));

    this.server.registerTool("apply_convolution", {
      description: "Apply a built-in Aseprite convolution matrix to a layer and frame.",
      inputSchema: { filename: z.string().min(1), matrix: z.string().min(1), layer_name: z.string().default(""), frame_index: z.number().int().positive().default(1), x: z.number().int().default(0), y: z.number().int().default(0), width: z.number().int().nonnegative().default(0), height: z.number().int().nonnegative().default(0) },
    }, async ({ filename, matrix, layer_name, frame_index, x, y, width, height }) => this.result(await this.assets.applyConvolution(filename, matrix, layer_name, frame_index, x, y, width, height)));

    this.server.registerTool("list_convolution_matrices", {
      description: "List the built-in convolution matrices supported by Aseprite.",
      inputSchema: {},
    }, async () => this.result(await this.assets.listConvolutionMatrices()));

    this.server.registerTool("apply_dither_gradient", {
      description: "Fill a rectangle with a two-color Bayer-dithered gradient.",
      inputSchema: {
        filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive(),
        color_start: z.string().regex(HEX_COLOR), color_end: z.string().regex(HEX_COLOR), horizontal: z.boolean().default(false), create_if_missing: z.boolean().default(true),
      },
    }, async ({ filename, layer_name, frame_index, x, y, width, height, color_start, color_end, horizontal, create_if_missing }) => this.result(await this.assets.applyDitherGradient(filename, layer_name, frame_index, x, y, width, height, color_start, color_end, horizontal, create_if_missing)));

    this.server.registerTool("apply_dither_pattern", {
      description: "Fill a rectangle with a uniform Bayer-dithered mix of two colors.",
      inputSchema: {
        filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive(),
        color_a: z.string().regex(HEX_COLOR), color_b: z.string().regex(HEX_COLOR), density: z.number().min(0).max(1).default(0.5), create_if_missing: z.boolean().default(true),
      },
    }, async ({ filename, layer_name, frame_index, x, y, width, height, color_a, color_b, density, create_if_missing }) => this.result(await this.assets.applyDitherPattern(filename, layer_name, frame_index, x, y, width, height, color_a, color_b, density, create_if_missing)));

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
