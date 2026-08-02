import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { AsepriteCliGateway } from "../infrastructure/aseprite/AsepriteCliGateway.js";
import type { AssetGatewayPort } from "../application/ports/AssetGatewayPort.js";
import { ToolCatalogService } from "../application/services/ToolCatalogService.js";
import { PixelArtAssetService } from "../application/services/PixelArtAssetService.js";
import { SharpRasterCodec } from "../infrastructure/image/SharpRasterCodec.js";
import { JsonAssetManifestWriter } from "../infrastructure/image/JsonAssetManifestWriter.js";
import { VisualAssetService } from "../application/services/VisualAssetService.js";
import { EnhancementToolController } from "./controllers/EnhancementToolController.js";
import { AssetJobToolController } from "./controllers/AssetJobToolController.js";
import { ImageAssetToolController } from "./controllers/ImageAssetToolController.js";
import { AssetBatchQualityService } from "../application/services/AssetBatchQualityService.js";
import { AnimationQualityService } from "../application/services/AnimationQualityService.js";
import { VisualAssetToolController } from "./controllers/VisualAssetToolController.js";
import { LayerFrameToolController } from "./controllers/LayerFrameToolController.js";
import { DrawingToolController } from "./controllers/DrawingToolController.js";
import { ExportAnimationToolController } from "./controllers/ExportAnimationToolController.js";
import { PaletteTransformToolController } from "./controllers/PaletteTransformToolController.js";
import { TextTileSliceToolController } from "./controllers/TextTileSliceToolController.js";
import { AnimationQualityToolController } from "./controllers/AnimationQualityToolController.js";
import { EffectsToolController } from "./controllers/EffectsToolController.js";
import { SceneExportToolController } from "./controllers/SceneExportToolController.js";
import { WorkflowPlanToolController } from "./controllers/WorkflowPlanToolController.js";
import { SpriteEffectsToolController } from "./controllers/SpriteEffectsToolController.js";
import { AssetVariantPackToolController } from "./controllers/AssetVariantPackToolController.js";
import { AssetPresetGenerationToolController } from "./controllers/AssetPresetGenerationToolController.js";
import { SceneEffectStackToolController } from "./controllers/SceneEffectStackToolController.js";
import { AssetVariantPackService } from "../application/services/AssetVariantPackService.js";
import { AssetPresetGenerationService } from "../application/services/AssetPresetGenerationService.js";
import { SceneEffectStackService } from "../application/services/SceneEffectStackService.js";
import { AssetJobService } from "../application/services/AssetJobService.js";
import { InMemoryAssetJobStore } from "../infrastructure/jobs/InMemoryAssetJobStore.js";
import { JsonAssetJobStore } from "../infrastructure/jobs/JsonAssetJobStore.js";
import { FileAssetArtifactResolver } from "../infrastructure/jobs/FileAssetArtifactResolver.js";
import type { AssetJobStorePort } from "../application/ports/AssetJobPorts.js";
import path from "node:path";
import { DeterministicEnhancementService } from "../application/services/DeterministicEnhancementService.js";
import { SpriteEffectsService } from "../application/services/SpriteEffectsService.js";
import { AssetRecipeComposerService } from "../application/services/AssetRecipeComposerService.js";
import { AssetRecipeExecutionService } from "../application/services/AssetRecipeExecutionService.js";
import { AssetRecipeToolController } from "./controllers/AssetRecipeToolController.js";
import { AssetRestController } from "./rest/AssetRestController.js";
import { AssetLibraryService } from "../application/services/AssetLibraryService.js";
import { FileAssetLibraryAdapter } from "../infrastructure/assets/FileAssetLibraryAdapter.js";
import { AssetLibraryToolController } from "./controllers/AssetLibraryToolController.js";
import { ContactSheetService } from "../application/services/ContactSheetService.js";
import { SpriteNormalizationService } from "../application/services/SpriteNormalizationService.js";
import { AnimationSheetService } from "../application/services/AnimationSheetService.js";

const SERVER_VERSION = "1.0.0";
const TYPESCRIPT_VERSION = "6.0.3";
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
  "get_tools_search",
  "suggest_enhancement_plan",
  "apply_enhancement_plan",
  "convert_image_to_pixel_art",
  "convert_animation_to_pixel_art",
  "upscale_pixel_art",
  "harmonize_asset_palette",
  "build_contact_sheet",
  "export_animation_gif",
  "inspect_asset",
  "inspect_asset_bundle",
  "inspect_asset_batch",
  "inspect_animation_quality",
  "normalize_sprite",
  "build_animation_sheet",
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
  "extend_scene",
  "generate_biome_transition",
  "generate_time_of_day_pack",
  "generate_environment_pack",
  "apply_material_texture",
  "apply_depth_lighting",
  "apply_pixel_outline",
  "apply_color_grade",
  "generate_sprite_shadow",
  "generate_particle_burst",
  "generate_normal_map",
  "generate_rain_overlay",
  "generate_motion_pack",
  "generate_seamless_texture",
  "generate_water_reflection",
  "generate_water_caustics",
  "generate_day_night_cycle",
  "generate_variant_pack",
  "generate_asset_preset",
  "generate_scene_effect_stack",
  "create_asset_recipe",
  "execute_asset_recipe",
  "get_asset_library",
  "get_asset_library_item",
  "get_asset_preset",
  "compose_asset_preset",
];

export class AsepriteMcpServerAdapter {
  public readonly server: McpServer;
  private readonly catalog = new ToolCatalogService(TOOL_NAMES);

  private readonly imageAssets: PixelArtAssetService;
  private readonly contactSheets: ContactSheetService;
  private readonly batchQuality: AssetBatchQualityService;
  private readonly animationQuality: AnimationQualityService;
  private readonly spriteNormalization: SpriteNormalizationService;
  private readonly animationSheet: AnimationSheetService;
  private readonly visualAssets: VisualAssetService;
  private readonly enhancements: DeterministicEnhancementService;
  private readonly assetJobs: AssetJobService;
  private readonly spriteEffects: SpriteEffectsService;
  private readonly variantPack: AssetVariantPackService;
  private readonly presetGeneration: AssetPresetGenerationService;
  private readonly sceneEffectStack: SceneEffectStackService;
  private readonly recipeExecutor: AssetRecipeExecutionService;
  private readonly recipes: AssetRecipeComposerService;
  private readonly assetLibrary: AssetLibraryService;
  public readonly restController: AssetRestController;

  public constructor(private readonly assets: AssetGatewayPort, imageAssets?: PixelArtAssetService, jobStore?: AssetJobStorePort) {
    const rasterCodec = new SharpRasterCodec();
    const manifestWriter = new JsonAssetManifestWriter();
    this.imageAssets = imageAssets ?? new PixelArtAssetService(rasterCodec, manifestWriter);
    this.contactSheets = new ContactSheetService(rasterCodec, manifestWriter);
    this.batchQuality = new AssetBatchQualityService(this.imageAssets);
    this.animationQuality = new AnimationQualityService(rasterCodec);
    this.spriteNormalization = new SpriteNormalizationService(rasterCodec, manifestWriter);
    this.animationSheet = new AnimationSheetService(rasterCodec, manifestWriter);
    this.visualAssets = new VisualAssetService(rasterCodec, manifestWriter, undefined, undefined, manifestWriter);
    this.spriteEffects = new SpriteEffectsService(rasterCodec);
    this.variantPack = new AssetVariantPackService(rasterCodec, this.spriteEffects);
    this.recipes = new AssetRecipeComposerService();
    this.assetLibrary = new AssetLibraryService(new FileAssetLibraryAdapter());
    this.presetGeneration = new AssetPresetGenerationService(this.assetLibrary, this.visualAssets);
    this.sceneEffectStack = new SceneEffectStackService(rasterCodec, this.spriteEffects, this.visualAssets);
    this.recipeExecutor = new AssetRecipeExecutionService({
      applyPixelOutline: (input) => this.spriteEffects.applyPixelOutline(input),
      applyColorGrade: (input) => this.spriteEffects.applyColorGrade(input),
      applyMaterialTexture: (input) => this.visualAssets.applyMaterialTexture(input),
      applyDepthLighting: (input) => this.visualAssets.applyDepthLighting(input),
      generateSpriteShadow: (input) => this.spriteEffects.generateSpriteShadow(input),
      generateParticleBurst: (input) => this.spriteEffects.generateParticleBurst(input),
      generateNormalMap: (input) => this.spriteEffects.generateNormalMap(input),
      runQualityGate: (input) => this.visualAssets.runQualityGate(input),
    });
    this.restController = new AssetRestController({ createRecipe: (input) => this.recipes.compose(input), executeRecipe: (input) => this.recipeExecutor.execute(this.recipes.compose(input)), spriteEffects: this.spriteEffects, variantPack: this.variantPack, presetGeneration: this.presetGeneration, sceneEffectStack: this.sceneEffectStack, applyMaterialTexture: (input) => this.visualAssets.applyMaterialTexture(input), applyDepthLighting: (input) => this.visualAssets.applyDepthLighting(input), assetLibrary: this.assetLibrary, imageAssets: this.imageAssets, batchQuality: this.batchQuality, animationQuality: this.animationQuality, spriteNormalization: this.spriteNormalization, animationSheet: this.animationSheet, contactSheet: this.contactSheets, visualAssets: { extendScene: (input) => this.visualAssets.extendScene(input), generateBiomeTransition: (input) => this.visualAssets.generateBiomeTransition(input) } }, SERVER_VERSION);
    this.enhancements = new DeterministicEnhancementService(rasterCodec);
    this.assetJobs = new AssetJobService({ run: (input) => this.imageAssets.runBatch(input) }, jobStore ?? new InMemoryAssetJobStore(), { artifactResolver: new FileAssetArtifactResolver(() => new Date().toISOString(), process.env.ASSET_ARTIFACT_ROOT ? [process.env.ASSET_ARTIFACT_ROOT] : []), timeoutMs: 5 * 60 * 1000 });
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
      controllerRegistration: "complete",
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

    this.server.registerTool("get_tools_search", {
      description: "Search a compact subset of tools by name, description, or folder to reduce context usage.",
      inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(100).default(20) },
    }, async ({ query, limit }) => this.text({ query, tools: this.catalog.search(query, limit) }));

    new ImageAssetToolController(this.assets, this.imageAssets, this.contactSheets, this.batchQuality, this.animationQuality, this.spriteNormalization, this.animationSheet).register(this.server);
    new VisualAssetToolController(this.visualAssets).register(this.server);
    new SpriteEffectsToolController(this.spriteEffects).register(this.server);
    new AssetVariantPackToolController(this.variantPack).register(this.server);
    new AssetPresetGenerationToolController(this.presetGeneration).register(this.server);
    new SceneEffectStackToolController(this.sceneEffectStack).register(this.server);
    new AssetRecipeToolController(this.recipes, this.recipeExecutor).register(this.server);
    new AssetLibraryToolController(this.assetLibrary).register(this.server);
    new EnhancementToolController(this.visualAssets, this.enhancements).register(this.server);
    new AssetJobToolController(this.assetJobs).register(this.server);
    new LayerFrameToolController(this.assets).register(this.server);

    new DrawingToolController(this.assets).register(this.server);
    new ExportAnimationToolController(this.assets).register(this.server);
    new PaletteTransformToolController(this.assets).register(this.server);
    new TextTileSliceToolController(this.assets).register(this.server);
    new AnimationQualityToolController(this.assets).register(this.server);
    new WorkflowPlanToolController(this.assets).register(this.server);
    new EffectsToolController(this.assets).register(this.server);
    new SceneExportToolController(this.assets).register(this.server);
  }

  private text(value: unknown): { content: [{ type: "text"; text: string }] } {
    return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
  }
}

async function main(): Promise<void> {
  const gateway = new AsepriteCliGateway();
  const jobStore = new JsonAssetJobStore(process.env.ASSET_JOB_STORE_PATH ?? path.join(process.cwd(), ".asset-studio", "jobs.json"));
  const adapter = new AsepriteMcpServerAdapter(gateway, undefined, jobStore);
  const restPort = Number(process.env.MCP_REST_PORT ?? 0);
  let restServer: import("node:http").Server | undefined;
  if (Number.isInteger(restPort) && restPort > 0) {
    const { createServer } = await import("node:http");
    restServer = createServer((request, response) => { void adapter.restController.handle(request, response); });
    await new Promise<void>((resolve, reject) => { restServer!.once("error", reject); restServer!.listen(restPort, "127.0.0.1", () => { restServer!.removeAllListeners("error"); console.error(`Aseprite MCP REST controls listening on http://127.0.0.1:${restPort}`); resolve(); }); });
  }
  const closeRest = () => { restServer?.close(); };
  process.once("SIGTERM", closeRest);
  process.once("SIGINT", closeRest);
  process.stdin.once("end", closeRest);
  await adapter.server.connect(new StdioServerTransport());
  console.error("Aseprite MCP TypeScript server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Aseprite MCP TypeScript server error", error);
  process.exitCode = 1;
});
