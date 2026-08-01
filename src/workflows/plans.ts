import path from "node:path";
import type {
  AnimationTagSpec,
  CharacterSpec,
  GodotAssetManifest,
  SceneSpec,
  ToolCall,
  WorkflowPlan,
} from "./types.js";

const DEFAULT_PALETTE = ["#101820", "#263238", "#607d8b", "#f5f5dc", "#e0a458", "#d1495b", "#4f772d"];

const DEFAULT_CHARACTER_ANIMATIONS: AnimationTagSpec[] = [
  { name: "idle", fromFrame: 1, toFrame: 4, direction: "pingpong" },
  { name: "walk", fromFrame: 5, toFrame: 10, direction: "forward" },
  { name: "attack", fromFrame: 11, toFrame: 14, direction: "forward" },
];

const DEFAULT_SCENE_ANIMATIONS: AnimationTagSpec[] = [
  { name: "day", fromFrame: 1, toFrame: 1, direction: "forward" },
];

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("assetId must contain at least one letter or number");
  return slug;
}

function positiveInteger(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return resolved;
}

function validateLayerNames(layers: string[], workflow: string): void {
  for (const layer of layers) {
    if (typeof layer !== "string" || !layer.trim()) throw new Error(`${workflow} layer name cannot be empty`);
  }
}

function normalizeAnimations(
  animations: AnimationTagSpec[] | undefined,
  defaults: AnimationTagSpec[],
): AnimationTagSpec[] {
  const resolved = animations?.length ? animations : defaults;
  const names = new Set<string>();
  for (const animation of resolved) {
    if (names.has(animation.name)) throw new Error(`Duplicate animation tag: ${animation.name}`);
    if (!animation.name.trim()) throw new Error("Animation tag name cannot be empty");
    if (!Number.isInteger(animation.fromFrame) || !Number.isInteger(animation.toFrame)) {
      throw new Error(`Animation ${animation.name} must use integer frame indexes`);
    }
    if (animation.fromFrame < 1 || animation.fromFrame > animation.toFrame) {
      throw new Error(`Animation ${animation.name} has an invalid frame range`);
    }
    names.add(animation.name);
  }
  return resolved.map((animation) => ({ ...animation, direction: animation.direction ?? "forward" }));
}

function call(name: string, arguments_: Record<string, unknown>, purpose: string): ToolCall {
  return { name, arguments: arguments_, purpose };
}

function sourcePath(assetId: string, outputDirectory: string | undefined, sourceFile: string | undefined): string {
  return sourceFile ?? path.join(outputDirectory ?? path.join("artifacts", "aseprite"), `${assetId}.aseprite`);
}

function animationManifest(animations: AnimationTagSpec[]): GodotAssetManifest["animations"] {
  return animations.map((animation) => ({
    name: animation.name,
    fromFrame: animation.fromFrame,
    toFrame: animation.toFrame,
    loop: animation.name !== "attack",
  }));
}

function exportCalls(
  sourceFile: string,
  outputDirectory: string,
  assetId: string,
  animations: AnimationTagSpec[],
  scale: number,
): { calls: ToolCall[]; exports: WorkflowPlan["exports"]; texture: string } {
  const calls: ToolCall[] = [];
  const exports_: WorkflowPlan["exports"] = [];
  const texture = path.join(outputDirectory, `${assetId}.png`);
  const metadata = path.join(outputDirectory, `${assetId}.json`);
  calls.push(call("export_spritesheet", {
    filename: sourceFile,
    output_filename: texture,
    sheet_type: "horizontal",
    data_filename: metadata,
    scale,
    padding: 1,
    data_format: "json-array",
    list_tags: true,
  }, "Export one Godot-friendly spritesheet with frame and tag metadata"));
  exports_.push({ name: assetId, imagePath: texture, dataPath: metadata });

  for (const animation of animations) {
    const imagePath = path.join(outputDirectory, `${assetId}_${animation.name}.png`);
    const dataPath = path.join(outputDirectory, `${assetId}_${animation.name}.json`);
    calls.push(call("export_spritesheet", {
      filename: sourceFile,
      output_filename: imagePath,
      sheet_type: "horizontal",
      data_filename: dataPath,
      scale,
      padding: 1,
      tag_name: animation.name,
      data_format: "json-array",
      list_tags: true,
    }, `Export the ${animation.name} animation as an isolated review artifact`));
    exports_.push({ name: animation.name, imagePath, dataPath, tagName: animation.name });
  }
  return { calls, exports: exports_, texture };
}

function commonAnimationCalls(sourceFile: string, animations: AnimationTagSpec[]): ToolCall[] {
  const lastFrame = Math.max(...animations.map((animation) => animation.toFrame));
  const calls: ToolCall[] = [];
  if (lastFrame > 1) {
    calls.push(call("add_frames", { filename: sourceFile, count: lastFrame - 1, duration_ms: 120 }, "Create the deterministic frame budget before drawing"));
  }
  for (const animation of animations) {
    calls.push(call("set_tag", {
      filename: sourceFile,
      name: animation.name,
      from_frame: animation.fromFrame,
      to_frame: animation.toFrame,
      direction: animation.direction,
    }, `Name the ${animation.name} animation for Godot and review tooling`));
  }
  return calls;
}

export function buildCharacterPlan(spec: CharacterSpec): WorkflowPlan {
  const assetId = slugify(spec.assetId);
  const width = positiveInteger(spec.width, 48, "width");
  const height = positiveInteger(spec.height, 48, "height");
  const scale = positiveInteger(spec.scale, 2, "scale");
  const outputDirectory = spec.outputDirectory ?? path.join("artifacts", "aseprite", assetId);
  const sourceFile = sourcePath(assetId, outputDirectory, spec.sourceFile);
  const layers = spec.layers ?? ["silhouette", "body", "details", "fx"];
  const animations = normalizeAnimations(spec.animations, DEFAULT_CHARACTER_ANIMATIONS);
  if (!layers.length) throw new Error("Character layers cannot be empty");
  validateLayerNames(layers, "Character");

  const calls: ToolCall[] = [
    call("create_canvas", { width, height, filename: sourceFile }, "Create a reproducible pixel-art canvas"),
    call("add_group", { filename: sourceFile, group_name: "Character" }, "Keep character art isolated in a named group"),
    ...layers.map((layer) => call("add_layer", { filename: sourceFile, layer_name: layer, group: "Character" }, `Add the ${layer} authoring layer`)),
    call("set_palette", { filename: sourceFile, colors: spec.palette ?? DEFAULT_PALETTE }, "Apply one controlled palette before detail work"),
    ...commonAnimationCalls(sourceFile, animations),
    call("validate_scene", { filename: sourceFile, required_layers: layers, start_frame: 1, end_frame: Math.max(...animations.map((animation) => animation.toFrame)) }, "Fail fast when an expected layer or cel is missing"),
  ];
  const exported = exportCalls(sourceFile, outputDirectory, assetId, animations, scale);
  calls.push(...exported.calls);

  return {
    schemaVersion: 1,
    kind: "character",
    assetId,
    sourceFile,
    calls,
    exports: exported.exports,
    godotManifest: {
      schemaVersion: 1,
      assetId,
      assetType: "character",
      texture: exported.texture,
      frameWidth: width,
      frameHeight: height,
      animations: animationManifest(animations),
    },
  };
}

export function buildScenePlan(spec: SceneSpec): WorkflowPlan {
  const assetId = slugify(spec.assetId);
  const width = positiveInteger(spec.width, 320, "width");
  const height = positiveInteger(spec.height, 180, "height");
  const tileWidth = positiveInteger(spec.tileWidth, 16, "tileWidth");
  const tileHeight = positiveInteger(spec.tileHeight, 16, "tileHeight");
  const scale = positiveInteger(spec.scale, 1, "scale");
  const outputDirectory = spec.outputDirectory ?? path.join("artifacts", "aseprite", assetId);
  const sourceFile = sourcePath(assetId, outputDirectory, spec.sourceFile);
  const layers = spec.layers ?? ["background", "terrain", "props", "collision", "foreground"];
  const animations = normalizeAnimations(spec.animations, DEFAULT_SCENE_ANIMATIONS);
  if (!layers.length) throw new Error("Scene layers cannot be empty");
  validateLayerNames(layers, "Scene");

  const calls: ToolCall[] = [
    call("create_canvas", { width, height, filename: sourceFile }, "Create the scene canvas"),
    ...layers.slice(0, 4).map((layer) => call("add_layer", { filename: sourceFile, layer_name: layer }, `Add the ${layer} scene layer`)),
    call("create_tilemap_layer", { filename: sourceFile, layer_name: "terrain_tiles", tile_width: tileWidth, tile_height: tileHeight }, "Create a tilemap-ready terrain layer"),
    call("add_layer", { filename: sourceFile, layer_name: layers[4] ?? "foreground" }, "Add a readable foreground depth layer"),
    call("set_palette", { filename: sourceFile, colors: spec.palette ?? DEFAULT_PALETTE }, "Apply a consistent environment palette"),
    ...commonAnimationCalls(sourceFile, animations),
    call("validate_scene", { filename: sourceFile, required_layers: [...layers.slice(0, 4), "terrain_tiles", layers[4] ?? "foreground"], start_frame: 1, end_frame: Math.max(...animations.map((animation) => animation.toFrame)) }, "Verify required scene layers before export"),
  ];
  const exported = exportCalls(sourceFile, outputDirectory, assetId, animations, scale);
  calls.push(...exported.calls);

  return {
    schemaVersion: 1,
    kind: "scene",
    assetId,
    sourceFile,
    calls,
    exports: exported.exports,
    godotManifest: {
      schemaVersion: 1,
      assetId,
      assetType: "scene",
      texture: exported.texture,
      frameWidth: width,
      frameHeight: height,
      animations: animationManifest(animations),
    },
  };
}
