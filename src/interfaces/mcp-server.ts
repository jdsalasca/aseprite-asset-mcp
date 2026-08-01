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
import { TextTileSliceToolController } from "./controllers/TextTileSliceToolController.js";
import { AnimationQualityToolController } from "./controllers/AnimationQualityToolController.js";
import { EffectsToolController } from "./controllers/EffectsToolController.js";
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
      migrationStatus: "in_progress",
      controllerRegistration: "partial",
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
    new TextTileSliceToolController(this.assets).register(this.server);
    new AnimationQualityToolController(this.assets).register(this.server);
    this.server.registerTool("animation_workflow_guide", {
      description: "Return a concise deterministic guide for character, environment, or general animation workflows.",
      inputSchema: { use_case: z.string().default("character") },
    }, async ({ use_case }) => this.result(await this.assets.animationWorkflowGuide(use_case)));

    this.server.registerTool("run_lua_script", {
      description: "Run a bounded, trusted Aseprite Lua script as an escape hatch; dedicated tools are preferred.",
      inputSchema: { script: z.string().min(1).max(200000), filename: z.string().default("") },
    }, async ({ script, filename }) => this.result(await this.assets.runLuaScript(script, filename)));

    new EffectsToolController(this.assets).register(this.server);
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
