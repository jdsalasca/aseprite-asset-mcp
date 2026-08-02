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
  export_animation_gif: "Export a raster animation or Aseprite sprite as GIF.",
  inspect_asset: "Inspect dimensions, frames, colors, transparency, and delays.",
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
  generate_time_of_day_pack: "Generate day, sunset, night, and sunrise frames.",
  generate_environment_pack: "Generate a complete themed environment pack.",
  apply_material_texture: "Add deterministic material grain and highlights while preserving transparency.",
};

function folderFor(name: string): string {
  if (name === "server_capabilities" || name.startsWith("get_tools_")) return "meta/catalog";
  if (name === "create_style_bible") return "asset/style";
  if (name.includes("material_texture")) return "asset/material";
  if (name === "inspect_reference" || name === "run_asset_quality_gate") return "asset/quality";
  if (name.includes("terrain") || name.includes("tilemap")) return "asset/tilemap";
  if (name.includes("world") || name.includes("beach") || name.includes("environment") || name.includes("map")) return "asset/world";
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
}
