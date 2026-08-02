import type { ToolCatalogList, ToolDescriptor, ToolFolderSummary } from "../../domain/tool-catalog.js";

const DESCRIPTION_OVERRIDES: Record<string, string> = {
  server_capabilities: "Return server version and architecture.",
  create_character_plan: "Build a deterministic character asset plan.",
  create_scene_plan: "Build a deterministic scene asset plan.",
  export_sprite: "Export one sprite to an image format.",
  export_spritesheet: "Export frames to a spritesheet and metadata.",
  get_sprite_info: "Read compact sprite metadata as JSON.",
  get_pixel_color: "Read one pixel from a layer or composite.",
  get_pixels_rect: "Read pixels from a bounded rectangle.",
  run_lua_script: "Run a bounded trusted Aseprite script.",
  convert_image_to_pixel_art: "Convert one image to pixel art with a bounded palette.",
  convert_animation_to_pixel_art: "Convert all frames to pixel art and preserve delays.",
  upscale_pixel_art: "Upscale sprites with deterministic nearest-neighbor pixels and preserved transparency.",
  harmonize_asset_palette: "Harmonize a sprite palette toward an accent color with bounded deterministic output.",
  build_contact_sheet: "Fit heterogeneous sprites into a deterministic preview sheet and navigable manifest.",
  export_animation_gif: "Export a raster animation or Aseprite sprite as GIF.",
  inspect_asset: "Inspect dimensions, frames, colors, transparency, and delays.",
  inspect_asset_bundle: "Inspect one asset and return quality violations and recommendations in one compact response.",
  inspect_asset_batch: "Inspect up to 32 assets in one compact quality report.",
  inspect_animation_quality: "Audit animation frames, timing, palette drift, and loop seams.",
  normalize_sprite: "Crop raster frames to shared alpha bounds and write deterministic pivot metadata.",
  build_animation_sheet: "Assemble animation frames into a PNG spritesheet with timing and pivot metadata.",
  inspect_sprite_geometry: "Inspect alpha bounds, connected components, baseline, and pivots per animation frame.",
  generate_sprite_hitboxes: "Generate component or union hitboxes from deterministic sprite geometry.",
  build_sprite_runtime_bundle: "Build one runtime bundle with an animation sheet, timing manifest, and hitboxes.",
  generate_sprite_anchors: "Generate deterministic placement anchors from sprite geometry.",
  audit_asset_library: "Audit library ids, references, categories, and asset paths.",
  summarize_asset_library: "Return compact library categories and preset navigation metadata.",
  plan_asset_scene: "Plan ordered scene layers from selected library assets.",
  validate_asset_quality: "Validate palette size and isolated-pixel limits.",
  build_texture_atlas: "Pack equal-size images into one texture atlas.",
  run_asset_recipe: "Run or preview one compact asset recipe.",
  batch_asset_job: "Run or preview several compact asset recipes.",
  export_asset_pack: "Export an atlas PNG and compact JSON manifest.",
  create_style_bible: "Create a deterministic style contract for assets.",
  inspect_reference: "Analyze colors, contrast, edges, and transparency.",
  run_asset_quality_gate: "Check pixel-art quality before export.",
  build_terrain_tileset: "Build terrain variants and adjacency metadata.",
  generate_world_map: "Generate a seeded multi-biome map manifest.",
  generate_beach_scene: "Generate a beach map with animated waves.",
  extend_scene: "Extend a scene deterministically while preserving layers and landmarks.",
  generate_biome_transition: "Generate deterministic transition metadata and a preview overlay between adjacent map biomes.",
  generate_time_of_day_pack: "Generate day, sunset, night, and sunrise frames.",
  generate_environment_pack: "Generate a complete themed environment pack.",
  apply_material_texture: "Add deterministic material grain and highlights while preserving transparency.",
  apply_depth_lighting: "Add deterministic depth-aware directional lighting while preserving transparency.",
  apply_pixel_outline: "Add a deterministic pixel outline around opaque sprite edges.",
  apply_color_grade: "Apply deterministic brightness, contrast, and saturation grading.",
  generate_sprite_shadow: "Generate a deterministic clipped shadow from sprite alpha.",
  generate_particle_burst: "Generate a deterministic animated particle burst GIF.",
  generate_normal_map: "Generate a deterministic normal map from sprite alpha depth.",
  generate_rain_overlay: "Generate a seeded rain overlay while preserving sprite dimensions and timing.",
  generate_motion_pack: "Generate a deterministic movement cycle from a static or animated sprite.",
  generate_seamless_texture: "Make opposite texture borders match for repeatable pixel-art backgrounds.",
  generate_water_reflection: "Generate deterministic animated reflections for oceans, beaches, and wave scenes.",
  generate_water_caustics: "Generate deterministic animated light caustics for water surfaces and flooded interiors.",
  generate_day_night_cycle: "Generate deterministic day, sunset, night, and sunrise frames while preserving transparency.",
  generate_variant_pack: "Generate several deterministic environmental variants from one source asset.",
  generate_asset_preset: "Generate a complete deterministic scene from a library preset.",
  generate_scene_effect_stack: "Generate selected scene effects in one deterministic response while preserving the source.",
  create_asset_recipe: "Compose a deterministic multi-effect asset recipe without executing it.",
  execute_asset_recipe: "Execute a composed recipe through shared visual services and return every step.",
  get_asset_library: "Search 339 deterministic prebuilt assets and scene presets.",
  get_asset_library_item: "Resolve one asset folder, manifest, README, preview, and sprite sheet.",
  get_asset_preset: "Resolve a ready-to-compose world preset and recommended tools.",
  compose_asset_preset: "Compose one preset into ordered assets and layers in a single compact response.",
};

function folderFor(name: string): string {
  if (name === "get_asset_library" || name === "get_asset_library_item" || name === "get_asset_preset" || name === "compose_asset_preset" || name === "generate_asset_preset") return "meta/asset-library";
  if (name === "audit_asset_library") return "meta/asset-library";
  if (name === "summarize_asset_library") return "meta/asset-library";
  if (name === "plan_asset_scene") return "scene/composition";
  if (name === "build_contact_sheet") return "asset/preview";
  if (name === "build_sprite_runtime_bundle") return "asset/runtime";
  if (name === "generate_sprite_anchors") return "asset/runtime";
  if (name === "server_capabilities" || name.startsWith("get_tools_")) return "meta/catalog";
  if (name === "create_style_bible") return "asset/style";
  if (name === "generate_scene_effect_stack") return "asset/effects";
  if (name.includes("material_texture")) return "asset/material";
  if (name.includes("depth_lighting")) return "asset/lighting";
  if (name.includes("color_grade") || name.includes("outline") || name.includes("shadow") || name.includes("normal_map") || name.includes("rain") || name.includes("motion") || name.includes("seamless") || name.includes("reflection") || name.includes("caustics") || name.includes("day_night") || name.includes("variant_pack")) return "asset/effects";
  if (name.includes("particle")) return "asset/particles";
  if (name === "create_asset_recipe" || name === "execute_asset_recipe") return "asset/recipes";
  if (name === "inspect_reference" || name === "run_asset_quality_gate") return "asset/quality";
  if (name.includes("terrain") || name.includes("tilemap")) return "asset/tilemap";
  if (name === "extend_scene" || name === "generate_biome_transition" || name.includes("world") || name.includes("beach") || name.includes("environment") || name.includes("map")) return "asset/world";
  if (name.includes("time_of_day") || name.includes("weather") || name.includes("wave")) return "asset/environment";
  if (name.endsWith("_plan") || name.includes("recipe") || name.includes("asset_pack")) return "asset/recipes";
  if (name.includes("preview")) return "asset/preview";
  if (name.includes("export") || name === "copy_sprite") return "asset/export";
  if (name.includes("import") || name.includes("convert")) return "asset/import";
  if (name.includes("tile")) return "asset/tilemap";
  if (name.includes("slice")) return "asset/slices";
  if (name.includes("text") || name.includes("font")) return "asset/text";
  if (name.includes("palette") || name.includes("color") || name.includes("ramp")) return "asset/palette";
  if (name.includes("pixel") || name.includes("line") || name.includes("rectangle") || name.includes("circle") || name.includes("polygon") || name.includes("path") || name.includes("gradient") || name.includes("fill") || name.includes("draw")) return "asset/drawing";
  if (name.includes("frame") || name.includes("cel") || name.includes("animation") || name.includes("tag") || name.includes("onion") || name.includes("tween") || name.includes("oscillate") || name.includes("propagate")) return "asset/animation";
  if (name.includes("layer") || name.includes("group") || name.includes("sprite_info")) return "asset/layers";
  if (name.includes("region") || name.includes("selection") || name.includes("erase")) return "asset/selection";
  if (name.includes("flip") || name.includes("rotate") || name.includes("resize") || name.includes("crop") || name.includes("move")) return "asset/transform";
  if (name.includes("audit") || name.includes("validate") || name.includes("compare") || name.includes("stats") || name.includes("quality") || name === "inspect_asset") return "asset/quality";
  if (name.includes("outline") || name.includes("hsl") || name.includes("brightness") || name.includes("invert") || name.includes("convolution") || name.includes("dither") || name.includes("replace")) return "asset/effects";
  if (name === "run_lua_script") return "developer/script";
  return "asset/core";
}

function descriptionFor(name: string): string {
  return DESCRIPTION_OVERRIDES[name] ?? name.replaceAll("_", " ").replace(/^[a-z]/, (letter) => letter.toUpperCase()) + ".";
}

function folderSummary(descriptors: ToolDescriptor[]): ToolFolderSummary[] {
  const counts = new Map<string, number>();
  for (const descriptor of descriptors) counts.set(descriptor.folder, (counts.get(descriptor.folder) ?? 0) + 1);
  const folders = [...counts.keys()].sort();
  return folders.map((folder) => ({
    folder,
    toolCount: counts.get(folder) ?? 0,
    children: folders.filter((candidate) => candidate !== folder && candidate.startsWith(`${folder}/`) && !candidate.slice(folder.length + 1).includes("/")),
  }));
}

export class ToolCatalogService {
  private readonly descriptors: ToolDescriptor[];

  public constructor(toolNames: readonly string[]) {
    this.descriptors = [...new Set(toolNames)].sort().map((name) => ({ name, folder: folderFor(name), description: descriptionFor(name) }));
  }

  public list(includeTools = false): ToolCatalogList {
    return { toolCount: this.descriptors.length, folders: folderSummary(this.descriptors), ...(includeTools ? { tools: this.descriptors.map(({ name }) => name) } : {}) };
  }

  public byFolder(folder: string): ToolDescriptor[] {
    const normalized = folder.trim().toLowerCase().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    return this.descriptors.filter((descriptor) => descriptor.folder === normalized || descriptor.folder.startsWith(`${normalized}/`));
  }

  public search(query: string, limit = 20): ToolDescriptor[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const boundedLimit = Number.isInteger(limit) ? Math.max(1, Math.min(100, limit)) : 20;
    return this.descriptors.filter((descriptor) => `${descriptor.name} ${descriptor.description} ${descriptor.folder}`.toLowerCase().includes(normalized)).slice(0, boundedLimit);
  }
}
