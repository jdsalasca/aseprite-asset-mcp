import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { AsepriteAssetService } from "../application/services/AsepriteAssetService.js";
import { AsepriteCliGateway } from "../infrastructure/aseprite/AsepriteCliGateway.js";
import { ToolCatalogService } from "../application/services/ToolCatalogService.js";
import { PixelArtAssetService } from "../application/services/PixelArtAssetService.js";
import { SharpRasterCodec } from "../infrastructure/image/SharpRasterCodec.js";
import { JsonAssetManifestWriter } from "../infrastructure/image/JsonAssetManifestWriter.js";
import { VisualAssetService } from "../application/services/VisualAssetService.js";
import { buildCharacterPlan, buildScenePlan } from "../workflows/plans.js";
import type { AsepriteResult } from "../domain/aseprite.js";
import { EnhancementToolController } from "./controllers/EnhancementToolController.js";
import { AssetJobToolController } from "./controllers/AssetJobToolController.js";
import { ImageAssetToolController } from "./controllers/ImageAssetToolController.js";
import { VisualAssetToolController } from "./controllers/VisualAssetToolController.js";
import { LayerFrameToolController } from "./controllers/LayerFrameToolController.js";
import { DrawingToolController } from "./controllers/DrawingToolController.js";
import { ExportAnimationToolController } from "./controllers/ExportAnimationToolController.js";
import { PaletteTransformToolController } from "./controllers/PaletteTransformToolController.js";
import { AssetJobService } from "../application/services/AssetJobService.js";
import { InMemoryAssetJobStore } from "../infrastructure/jobs/InMemoryAssetJobStore.js";
import { DeterministicEnhancementService } from "../application/services/DeterministicEnhancementService.js";

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
  "create_slice",
  "set_slice_center",
  "set_slice_pivot",
  "list_slices",
  "delete_slice",
  "ensure_layers_present",
  "audit_animation",
  "animation_sanitize",
  "start_preview_server",
  "stop_preview_server",
  "copy_layers_between_sprites",
  "get_sprite_info",
  "duplicate_frame_range",
  "propagate_cels",
  "tween_cel_positions_eased",
  "oscillate_cel_positions",
  "tween_cel_opacity_eased",
  "tween_cel_scale_eased",
  "set_layer",
  "animation_workflow_guide",
  "run_lua_script",
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
  "get_tools_list",
  "get_tools_by_folder",
  "suggest_enhancement_plan",
  "apply_enhancement_plan",
  "convert_image_to_pixel_art",
  "convert_animation_to_pixel_art",
  "export_animation_gif",
  "inspect_asset",
  "validate_asset_quality",
  "build_texture_atlas",
  "run_asset_recipe",
  "batch_asset_job",
  "start_asset_job",
  "get_asset_job_status",
  "cancel_asset_job",
  "export_asset_pack",
  "create_style_bible",
  "inspect_reference",
  "run_asset_quality_gate",
  "build_terrain_tileset",
  "generate_world_map",
  "generate_beach_scene",
  "generate_time_of_day_pack",
  "generate_environment_pack",
];

export class AsepriteMcpServerAdapter {
  public readonly server: McpServer;
  private readonly catalog = new ToolCatalogService(TOOL_NAMES);

  private readonly imageAssets: PixelArtAssetService;
  private readonly visualAssets: VisualAssetService;
  private readonly enhancements: DeterministicEnhancementService;
  private readonly assetJobs: AssetJobService;

  public constructor(private readonly assets: AsepriteAssetService, imageAssets?: PixelArtAssetService) {
    const rasterCodec = new SharpRasterCodec();
    const manifestWriter = new JsonAssetManifestWriter();
    this.imageAssets = imageAssets ?? new PixelArtAssetService(rasterCodec, manifestWriter);
    this.visualAssets = new VisualAssetService(rasterCodec, manifestWriter);
    this.enhancements = new DeterministicEnhancementService(rasterCodec);
    this.assetJobs = new AssetJobService({ run: (input) => this.imageAssets.runBatch(input) }, new InMemoryAssetJobStore());
    this.server = new McpServer({ name: "aseprite-asset-mcp", version: SERVER_VERSION });
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
      projectRepository: "https://github.com/jdsalasca/aseprite-asset-mcp",
      migrationStatus: "complete",
      legacyRuntime: false,
    }));

    this.server.registerTool("get_tools_list", {
      description: "List tool folders and counts. Use this before loading a tool folder.",
      inputSchema: { include_tools: z.boolean().default(false) },
    }, async ({ include_tools }) => this.text(this.catalog.list(include_tools)));

    this.server.registerTool("get_tools_by_folder", {
      description: "List concise tools in one folder. Use a parent folder to inspect its subfolders.",
      inputSchema: { folder: z.string().min(1) },
    }, async ({ folder }) => this.text({ folder, tools: this.catalog.byFolder(folder) }));

    new ImageAssetToolController(this.assets, this.imageAssets).register(this.server);
    new VisualAssetToolController(this.visualAssets).register(this.server);
    new EnhancementToolController(this.visualAssets, this.enhancements).register(this.server);
    new AssetJobToolController(this.assetJobs).register(this.server);
    new LayerFrameToolController(this.assets).register(this.server);

    new DrawingToolController(this.assets).register(this.server);
    new ExportAnimationToolController(this.assets).register(this.server);
    new PaletteTransformToolController(this.assets).register(this.server);
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

    this.server.registerTool("create_slice", {
      description: "Create a named rectangular slice.",
      inputSchema: { filename: z.string().min(1), name: z.string().min(1), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive() },
    }, async ({ filename, name, x, y, width, height }) => this.result(await this.assets.createSlice(filename, name, x, y, width, height)));

    this.server.registerTool("set_slice_center", {
      description: "Set a slice 9-patch center rectangle.",
      inputSchema: { filename: z.string().min(1), name: z.string().min(1), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive() },
    }, async ({ filename, name, x, y, width, height }) => this.result(await this.assets.setSliceCenter(filename, name, x, y, width, height)));

    this.server.registerTool("set_slice_pivot", {
      description: "Set a slice pivot point.",
      inputSchema: { filename: z.string().min(1), name: z.string().min(1), x: z.number().int(), y: z.number().int() },
    }, async ({ filename, name, x, y }) => this.result(await this.assets.setSlicePivot(filename, name, x, y)));

    this.server.registerTool("list_slices", {
      description: "List slice bounds, centers, and pivots as JSON.",
      inputSchema: { filename: z.string().min(1) },
    }, async ({ filename }) => this.result(await this.assets.listSlices(filename)));

    this.server.registerTool("delete_slice", {
      description: "Delete a named slice.",
      inputSchema: { filename: z.string().min(1), name: z.string().min(1) },
    }, async ({ filename, name }) => this.result(await this.assets.deleteSlice(filename, name)));

    this.server.registerTool("ensure_layers_present", {
      description: "Ensure cels exist for named layers across a frame range.",
      inputSchema: { filename: z.string().min(1), layer_names: z.array(z.string().min(1)).min(1), start_frame: z.number().int().positive().default(1), end_frame: z.number().int().positive().optional() },
    }, async ({ filename, layer_names, start_frame, end_frame }) => this.result(await this.assets.ensureLayersPresent(filename, layer_names, start_frame, end_frame)));

    this.server.registerTool("audit_animation", {
      description: "Audit animation cels, overlaps, and declared frame ranges.",
      inputSchema: { filename: z.string().min(1), start_frame: z.number().int().positive().default(1), end_frame: z.number().int().positive().optional(), layer_names: z.array(z.string().min(1)).optional(), overlap_pairs: z.array(z.string().min(1)).optional(), layer_frame_ranges: z.array(z.string().min(1)).optional(), report_cels: z.boolean().default(false), report_bounds: z.boolean().default(false), max_overlaps: z.number().int().nonnegative().default(200), max_out_of_range: z.number().int().nonnegative().default(200) },
    }, async ({ filename, start_frame, end_frame, layer_names, overlap_pairs, layer_frame_ranges, report_cels, report_bounds, max_overlaps, max_out_of_range }) => this.result(await this.assets.auditAnimation({ filename, startFrame: start_frame, endFrame: end_frame, layerNames: layer_names, overlapPairs: overlap_pairs, layerFrameRanges: layer_frame_ranges, reportCels: report_cels, reportBounds: report_bounds, maxOverlaps: max_overlaps, maxOutOfRange: max_out_of_range })));

    this.server.registerTool("animation_sanitize", {
      description: "Normalize animation cels and optionally repair out-of-range activity.",
      inputSchema: { filename: z.string().min(1), start_frame: z.number().int().positive().default(1), end_frame: z.number().int().positive().optional(), layer_names: z.array(z.string().min(1)).optional(), layer_order: z.array(z.string().min(1)).optional(), layer_frame_ranges: z.array(z.string().min(1)).optional(), ensure_layers: z.array(z.string().min(1)).optional(), out_of_range_action: z.enum(["set_opacity_zero", "delete_cels", "none"]).default("set_opacity_zero"), out_of_range_opacity: z.number().int().min(0).max(255).default(0), report_only: z.boolean().default(false), include_stats: z.boolean().default(true), ignore_full_canvas_overlaps: z.boolean().default(true), max_overlaps: z.number().int().nonnegative().default(200), overlap_pairs: z.array(z.string().min(1)).optional(), report_cels: z.boolean().default(false), report_bounds: z.boolean().default(false), max_out_of_range: z.number().int().nonnegative().default(200) },
    }, async ({ filename, start_frame, end_frame, layer_names, layer_order, layer_frame_ranges, ensure_layers, out_of_range_action, out_of_range_opacity, report_only, include_stats, ignore_full_canvas_overlaps, max_overlaps, overlap_pairs, report_cels, report_bounds, max_out_of_range }) => this.result(await this.assets.animationSanitize({ filename, startFrame: start_frame, endFrame: end_frame, layerNames: layer_names, layerOrder: layer_order, layerFrameRanges: layer_frame_ranges, ensureLayers: ensure_layers, outOfRangeAction: out_of_range_action, outOfRangeOpacity: out_of_range_opacity, reportOnly: report_only, includeStats: include_stats, ignoreFullCanvasOverlaps: ignore_full_canvas_overlaps, maxOverlaps: max_overlaps, overlapPairs: overlap_pairs, reportCels: report_cels, reportBounds: report_bounds, maxOutOfRange: max_out_of_range })));

    this.server.registerTool("start_preview_server", {
      description: "Serve a validated local directory over HTTP for visual asset preview.",
      inputSchema: { directory: z.string().min(1), port: z.number().int().min(1024).max(65535).default(8000) },
    }, async ({ directory, port }) => this.result(await this.assets.startPreviewServer(directory, port)));

    this.server.registerTool("stop_preview_server", {
      description: "Stop a preview server started by this MCP process.",
      inputSchema: { port: z.number().int().min(1024).max(65535).default(8000) },
    }, async ({ port }) => this.result(await this.assets.stopPreviewServer(port)));

    this.server.registerTool("copy_layers_between_sprites", {
      description: "Copy selected animation layers and cels from one Aseprite document into another.",
      inputSchema: {
        source_filename: z.string().min(1), target_filename: z.string().min(1),
        layer_names: z.array(z.string().min(1)).min(1), replace: z.boolean().default(true), create_missing_frames: z.boolean().default(true),
      },
    }, async ({ source_filename, target_filename, layer_names, replace, create_missing_frames }) => this.result(await this.assets.copyLayersBetweenSprites({ sourceFilename: source_filename, targetFilename: target_filename, layerNames: layer_names, replace, createMissingFrames: create_missing_frames })));

    this.server.registerTool("get_sprite_info", {
      description: "Read sprite dimensions, color mode, frame durations, layers, and tags as JSON.",
      inputSchema: { filename: z.string().min(1) },
    }, async ({ filename }) => this.result(await this.assets.getSpriteInfo(filename)));

    this.server.registerTool("duplicate_frame_range", {
      description: "Append one or more copies of an inclusive animation frame range.",
      inputSchema: { filename: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), times: z.number().int().positive().default(1) },
    }, async ({ filename, start_frame, end_frame, times }) => this.result(await this.assets.duplicateFrameRange(filename, start_frame, end_frame, times)));

    this.server.registerTool("propagate_cels", {
      description: "Copy selected layer cels from one source frame across a frame range.",
      inputSchema: { filename: z.string().min(1), layer_names: z.array(z.string().min(1)).min(1), source_frame: z.number().int().positive(), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), replace: z.boolean().default(true) },
    }, async ({ filename, layer_names, source_frame, start_frame, end_frame, replace }) => this.result(await this.assets.propagateCels(filename, layer_names, source_frame, start_frame, end_frame, replace)));

    this.server.registerTool("tween_cel_positions_eased", {
      description: "Tween cel positions across frames with deterministic easing.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), start_x: z.number().int(), start_y: z.number().int(), end_x: z.number().int(), end_y: z.number().int(), easing: z.enum(["linear", "ease_in", "ease_out", "ease_in_out", "smoothstep"]).default("smoothstep"), create_missing_cels: z.boolean().default(false), source_frame_index: z.number().int().positive().optional() },
    }, async ({ filename, layer_name, start_frame, end_frame, start_x, start_y, end_x, end_y, easing, create_missing_cels, source_frame_index }) => this.result(await this.assets.tweenCelPositionsEased(filename, layer_name, start_frame, end_frame, start_x, start_y, end_x, end_y, easing, create_missing_cels, source_frame_index)));

    this.server.registerTool("oscillate_cel_positions", {
      description: "Apply sine-wave position offsets to cels across frames.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), amplitude_x: z.number().int().default(0), amplitude_y: z.number().int().default(0), cycles: z.number().finite().default(1), phase_deg: z.number().finite().default(0), create_missing_cels: z.boolean().default(false), source_frame_index: z.number().int().positive().optional() },
    }, async ({ filename, layer_name, start_frame, end_frame, amplitude_x, amplitude_y, cycles, phase_deg, create_missing_cels, source_frame_index }) => this.result(await this.assets.oscillateCelPositions(filename, layer_name, start_frame, end_frame, amplitude_x, amplitude_y, cycles, phase_deg, create_missing_cels, source_frame_index)));

    this.server.registerTool("tween_cel_opacity_eased", {
      description: "Tween cel opacity from 0 to 255 across frames with easing.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), start_opacity: z.number().int().min(0).max(255), end_opacity: z.number().int().min(0).max(255), easing: z.enum(["linear", "ease_in", "ease_out", "ease_in_out", "smoothstep"]).default("smoothstep"), create_missing_cels: z.boolean().default(false), source_frame_index: z.number().int().positive().optional() },
    }, async ({ filename, layer_name, start_frame, end_frame, start_opacity, end_opacity, easing, create_missing_cels, source_frame_index }) => this.result(await this.assets.tweenCelOpacityEased(filename, layer_name, start_frame, end_frame, start_opacity, end_opacity, easing, create_missing_cels, source_frame_index)));

    this.server.registerTool("tween_cel_scale_eased", {
      description: "Scale a source cel across frames with easing and a stable anchor.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), start_scale: z.number().positive(), end_scale: z.number().positive(), easing: z.enum(["linear", "ease_in", "ease_out", "ease_in_out", "smoothstep"]).default("smoothstep"), anchor: z.enum(["center", "topleft"]).default("center"), replace: z.boolean().default(true), create_missing_cels: z.boolean().default(true), source_frame_index: z.number().int().positive().optional() },
    }, async ({ filename, layer_name, start_frame, end_frame, start_scale, end_scale, easing, anchor, replace, create_missing_cels, source_frame_index }) => this.result(await this.assets.tweenCelScaleEased(filename, layer_name, start_frame, end_frame, start_scale, end_scale, easing, anchor, replace, create_missing_cels, source_frame_index)));

    this.server.registerTool("set_layer", {
      description: "Set the active layer by name, optionally creating it.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), create_if_missing: z.boolean().default(false) },
    }, async ({ filename, layer_name, create_if_missing }) => this.result(await this.assets.setLayer(filename, layer_name, create_if_missing)));

    this.server.registerTool("animation_workflow_guide", {
      description: "Return a concise deterministic guide for character, environment, or general animation workflows.",
      inputSchema: { use_case: z.string().default("character") },
    }, async ({ use_case }) => this.result(await this.assets.animationWorkflowGuide(use_case)));

    this.server.registerTool("run_lua_script", {
      description: "Run a bounded, trusted Aseprite Lua script as an escape hatch; dedicated tools are preferred.",
      inputSchema: { script: z.string().min(1).max(200000), filename: z.string().default("") },
    }, async ({ script, filename }) => this.result(await this.assets.runLuaScript(script, filename)));

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
