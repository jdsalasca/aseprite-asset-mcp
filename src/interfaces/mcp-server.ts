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
import type { EnhancementGoal } from "../domain/enhancement.js";
import type { ReferenceAnalysis } from "../domain/visual-assets.js";
import { EnhancementPlanService } from "../application/services/EnhancementPlanService.js";

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
  "convert_image_to_pixel_art",
  "convert_animation_to_pixel_art",
  "export_animation_gif",
  "inspect_asset",
  "validate_asset_quality",
  "build_texture_atlas",
  "run_asset_recipe",
  "batch_asset_job",
  "export_asset_pack",
  "create_style_bible",
  "inspect_reference",
  "suggest_enhancement_plan",
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
  private readonly enhancementPlans = new EnhancementPlanService();

  public constructor(private readonly assets: AsepriteAssetService, imageAssets?: PixelArtAssetService) {
    this.imageAssets = imageAssets ?? new PixelArtAssetService(new SharpRasterCodec(), new JsonAssetManifestWriter());
    this.visualAssets = new VisualAssetService(new SharpRasterCodec(), new JsonAssetManifestWriter());
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

    this.server.registerTool("convert_image_to_pixel_art", {
      description: "Convert one image to pixel art with a deterministic shared palette.",
      inputSchema: {
        input_filename: z.string().min(1), output_filename: z.string().min(1), width: z.number().int().positive(), height: z.number().int().positive(),
        max_colors: z.number().int().min(2).max(256).default(32), resize_mode: z.enum(["box", "nearest"]).default("box"), dither: z.enum(["none", "bayer4x4"]).default("none"), alpha_threshold: z.number().int().min(0).max(255).default(1),
      },
    }, async ({ input_filename, output_filename, width, height, max_colors, resize_mode, dither, alpha_threshold }) => this.result(await this.imageAssets.convertImage({ inputFilename: input_filename, outputFilename: output_filename, width, height, maxColors: max_colors, resizeMode: resize_mode, dither, alphaThreshold: alpha_threshold }, false)));

    this.server.registerTool("convert_animation_to_pixel_art", {
      description: "Convert all image frames to pixel art and preserve animation delays.",
      inputSchema: {
        input_filename: z.string().min(1), output_filename: z.string().min(1), width: z.number().int().positive(), height: z.number().int().positive(),
        max_colors: z.number().int().min(2).max(256).default(32), resize_mode: z.enum(["box", "nearest"]).default("box"), dither: z.enum(["none", "bayer4x4"]).default("none"), alpha_threshold: z.number().int().min(0).max(255).default(1),
      },
    }, async ({ input_filename, output_filename, width, height, max_colors, resize_mode, dither, alpha_threshold }) => this.result(await this.imageAssets.convertImage({ inputFilename: input_filename, outputFilename: output_filename, width, height, maxColors: max_colors, resizeMode: resize_mode, dither, alphaThreshold: alpha_threshold, format: "gif" }, true)));

    this.server.registerTool("export_animation_gif", {
      description: "Convert a PNG, GIF, or animated image into a GIF while preserving frames.",
      inputSchema: { input_filename: z.string().min(1), output_filename: z.string().min(1) },
    }, async ({ input_filename, output_filename }) => input_filename.toLowerCase().endsWith(".aseprite")
      ? this.result(await this.assets.exportSprite(input_filename, output_filename, "gif"))
      : this.result(await this.imageAssets.exportGif(input_filename, output_filename)));

    this.server.registerTool("inspect_asset", {
      description: "Return compact dimensions, frame, palette, transparency, and delay statistics.",
      inputSchema: { filename: z.string().min(1) },
    }, async ({ filename }) => this.result(await this.imageAssets.inspect(filename)));

    this.server.registerTool("validate_asset_quality", {
      description: "Check palette size and isolated pixels before an asset enters a game build.",
      inputSchema: { filename: z.string().min(1), max_colors: z.number().int().min(1).max(256).default(256), max_isolated_pixels: z.number().int().nonnegative().default(9007199254740991) },
    }, async ({ filename, max_colors, max_isolated_pixels }) => this.result(await this.imageAssets.validate({ filename, maxColors: max_colors, maxIsolatedPixels: max_isolated_pixels })));

    this.server.registerTool("build_texture_atlas", {
      description: "Pack equal-size image frames into one PNG texture atlas.",
      inputSchema: { input_filenames: z.array(z.string().min(1)).min(1), output_filename: z.string().min(1), columns: z.number().int().positive().optional(), padding: z.number().int().nonnegative().default(0) },
    }, async ({ input_filenames, output_filename, columns, padding }) => this.result(await this.imageAssets.buildAtlas({ inputFilenames: input_filenames, outputFilename: output_filename, ...(columns === undefined ? {} : { columns }), padding })));

    this.server.registerTool("export_asset_pack", {
      description: "Export an atlas PNG and a compact JSON manifest in one call.",
      inputSchema: { input_filenames: z.array(z.string().min(1)).min(1), output_filename: z.string().min(1), manifest_filename: z.string().min(1), columns: z.number().int().positive().optional(), padding: z.number().int().nonnegative().default(0) },
    }, async ({ input_filenames, output_filename, manifest_filename, columns, padding }) => this.result(await this.imageAssets.exportPack({ inputFilenames: input_filenames, outputFilename: output_filename, manifestFilename: manifest_filename, ...(columns === undefined ? {} : { columns }), padding })));

    this.server.registerTool("create_style_bible", {
      description: "Create a deterministic visual style contract for sprites and maps.",
      inputSchema: {
        filename: z.string().min(1), id: z.string().min(1), base_size: z.number().int().min(4).max(256), palette: z.array(z.string().regex(HEX_COLOR)).min(2).max(256), outline_color: z.string().regex(HEX_COLOR).default("#12243A"), light_direction: z.enum(["north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west"]).default("south_east"), detail_level: z.enum(["low", "medium", "high"]).default("medium"), seed: z.number().int().default(1), materials: z.record(z.string(), z.array(z.string().regex(HEX_COLOR))).default({}),
      },
    }, async ({ filename, id, base_size, palette, outline_color, light_direction, detail_level, seed, materials }) => this.result(await this.visualAssets.createStyleBible({ filename, style: { id, baseSize: base_size, palette, outlineColor: outline_color, lightDirection: light_direction, detailLevel: detail_level, seed, materials } })));

    this.server.registerTool("inspect_reference", {
      description: "Analyze reference dimensions, dominant colors, contrast, edges, and transparency.",
      inputSchema: { filename: z.string().min(1) },
    }, async ({ filename }) => this.result(await this.visualAssets.inspectReference(filename)));

    this.server.registerTool("suggest_enhancement_plan", {
      description: "Inspect one image and return a deterministic, non-destructive enhancement plan for an agent or human review.",
      inputSchema: {
        filename: z.string().min(1),
        goals: z.array(z.enum(["cleanup", "terrain_grain", "water_flow", "directional_lighting", "particles", "time_of_day", "animation"])).optional(),
        max_colors: z.number().int().min(2).max(256).default(64),
        seed: z.number().int().default(1),
      },
    }, async ({ filename, goals, max_colors, seed }) => {
      const analysisResult = await this.visualAssets.inspectReference(filename);
      if (!analysisResult.ok) return this.result(analysisResult);
      try {
        const analysis = JSON.parse(analysisResult.message) as ReferenceAnalysis;
        return this.text(this.enhancementPlans.suggest({ filename, analysis, ...(goals ? { goals: goals as EnhancementGoal[] } : {}), maxColors: max_colors, seed }));
      } catch {
        return this.result({ ok: false, message: "Reference analysis did not return a valid enhancement contract" });
      }
    });

    this.server.registerTool("run_asset_quality_gate", {
      description: "Run compact pixel-art quality checks before export.",
      inputSchema: { filename: z.string().min(1), max_colors: z.number().int().min(1).max(256).default(64), max_isolated_pixels: z.number().int().nonnegative().default(4), min_contrast: z.number().min(0).max(1).default(0.08), max_banding_runs: z.number().int().nonnegative().default(9007199254740991) },
    }, async ({ filename, max_colors, max_isolated_pixels, min_contrast, max_banding_runs }) => this.result(await this.visualAssets.runQualityGate({ filename, maxColors: max_colors, maxIsolatedPixels: max_isolated_pixels, minContrast: min_contrast, maxBandingRuns: max_banding_runs })));

    this.server.registerTool("build_terrain_tileset", {
      description: "Build a deterministic terrain tileset with adjacency variants and metadata.",
      inputSchema: { output_filename: z.string().min(1), manifest_filename: z.string().min(1), tile_size: z.number().int().min(4).max(128), terrains: z.array(z.enum(["water", "sand", "grass", "rock", "snow", "mud"])).min(2), seed: z.number().int().default(1), palette: z.array(z.string().regex(HEX_COLOR)).min(2).max(256).optional(), outline_color: z.string().regex(HEX_COLOR).optional() },
    }, async ({ output_filename, manifest_filename, tile_size, terrains, seed, palette, outline_color }) => this.result(await this.visualAssets.buildTerrainTileset({ outputFilename: output_filename, manifestFilename: manifest_filename, tileSize: tile_size, terrains, seed, ...(palette || outline_color ? { style: { ...(palette ? { palette } : {}), ...(outline_color ? { outlineColor: outline_color } : {}) } } : {}) })));

    this.server.registerTool("generate_world_map", {
      description: "Generate a seeded multi-biome map manifest and optional preview.",
      inputSchema: { map_filename: z.string().min(1), preview_filename: z.string().min(1).optional(), width: z.number().int().positive().max(2048), height: z.number().int().positive().max(2048), seed: z.number().int(), biomes: z.array(z.enum(["water", "sand", "grass", "rock", "snow", "mud"])).min(2), detail_level: z.enum(["low", "medium", "high"]).default("medium"), landmark_count: z.number().int().nonnegative().optional() },
    }, async ({ map_filename, preview_filename, width, height, seed, biomes, detail_level, landmark_count }) => this.result(await this.visualAssets.generateWorldMap({ mapFilename: map_filename, ...(preview_filename ? { previewFilename: preview_filename } : {}), width, height, seed, biomes, detailLevel: detail_level, ...(landmark_count === undefined ? {} : { landmarkCount: landmark_count }) })));

    this.server.registerTool("generate_beach_scene", {
      description: "Generate a seeded beach map, preview, and animated wave GIF.",
      inputSchema: { map_filename: z.string().min(1), preview_filename: z.string().min(1).optional(), wave_filename: z.string().min(1), width: z.number().int().positive().max(2048), height: z.number().int().positive().max(2048), seed: z.number().int(), detail_level: z.enum(["low", "medium", "high"]).default("high"), landmark_count: z.number().int().nonnegative().optional(), wave_frames: z.number().int().min(2).max(24).default(8), wave_delay_ms: z.number().int().positive().default(140) },
    }, async ({ map_filename, preview_filename, wave_filename, width, height, seed, detail_level, landmark_count, wave_frames, wave_delay_ms }) => this.result(await this.visualAssets.generateBeachScene({ mapFilename: map_filename, ...(preview_filename ? { previewFilename: preview_filename } : {}), waveFilename: wave_filename, width, height, seed, biomes: ["water", "sand", "grass", "rock"], detailLevel: detail_level, ...(landmark_count === undefined ? {} : { landmarkCount: landmark_count }), waveFrames: wave_frames, waveDelayMs: wave_delay_ms })));

    this.server.registerTool("generate_time_of_day_pack", {
      description: "Generate a deterministic day, sunset, night, and sunrise GIF pack.",
      inputSchema: { input_filename: z.string().min(1), output_filename: z.string().min(1), manifest_filename: z.string().min(1).optional(), steps: z.number().int().min(2).max(24).default(8), delay_ms: z.number().int().positive().default(180) },
    }, async ({ input_filename, output_filename, manifest_filename, steps, delay_ms }) => this.result(await this.visualAssets.generateTimeOfDayPack({ inputFilename: input_filename, outputFilename: output_filename, ...(manifest_filename ? { manifestFilename: manifest_filename } : {}), steps, delayMs: delay_ms })));

    this.server.registerTool("generate_environment_pack", {
      description: "Generate a complete beach, forest, village, or cave asset pack.",
      inputSchema: { kind: z.enum(["beach", "forest", "village", "cave"]), output_prefix: z.string().min(1), width: z.number().int().positive().max(2048), height: z.number().int().positive().max(2048), seed: z.number().int(), tile_size: z.number().int().min(4).max(128).default(16), detail_level: z.enum(["low", "medium", "high"]).default("high") },
    }, async ({ kind, output_prefix, width, height, seed, tile_size, detail_level }) => this.result(await this.visualAssets.generateEnvironmentPack({ kind, outputPrefix: output_prefix, width, height, seed, tileSize: tile_size, detailLevel: detail_level })));

    this.server.registerTool("run_asset_recipe", {
      description: "Run one compact asset recipe or return its dry-run plan.",
      inputSchema: { recipe: z.enum(["pixel_art", "animation_pixel_art", "gif", "atlas"]), input_filenames: z.array(z.string().min(1)).min(1), output_filename: z.string().min(1).optional(), width: z.number().int().positive().optional(), height: z.number().int().positive().optional(), max_colors: z.number().int().min(2).max(256).default(32), dry_run: z.boolean().default(true) },
    }, async ({ recipe, input_filenames, output_filename, width, height, max_colors, dry_run }) => this.result(await this.imageAssets.runRecipe({ recipe, inputFilenames: input_filenames, ...(output_filename ? { outputFilename: output_filename } : {}), ...(width === undefined ? {} : { width }), ...(height === undefined ? {} : { height }), maxColors: max_colors, dryRun: dry_run })));

    this.server.registerTool("batch_asset_job", {
      description: "Run several compact asset recipes in order or return one batch plan.",
      inputSchema: {
        jobs: z.array(z.object({ recipe: z.enum(["pixel_art", "animation_pixel_art", "gif", "atlas"]), input_filenames: z.array(z.string().min(1)).min(1), output_filename: z.string().min(1).optional(), width: z.number().int().positive().optional(), height: z.number().int().positive().optional(), max_colors: z.number().int().min(2).max(256).default(32) })).min(1),
        dry_run: z.boolean().default(true),
      },
    }, async ({ jobs, dry_run }) => this.result(await this.imageAssets.runBatch({ jobs: jobs.map((job) => ({ recipe: job.recipe, inputFilenames: job.input_filenames, ...(job.output_filename ? { outputFilename: job.output_filename } : {}), ...(job.width === undefined ? {} : { width: job.width }), ...(job.height === undefined ? {} : { height: job.height }), maxColors: job.max_colors })), dryRun: dry_run })));

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
