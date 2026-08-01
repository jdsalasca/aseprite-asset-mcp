import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ExportAnimationPort } from "../../application/ports/AssetCapabilityPorts.js";
import type { AsepriteResult } from "../../domain/aseprite.js";

export class ExportAnimationToolController {
  public constructor(private readonly assets: ExportAnimationPort) {}

  public register(server: McpServer): void {
    server.registerTool("export_sprite", {
      description: "Export a sprite to a selected image format and confirm that Aseprite wrote an output file.",
      inputSchema: { filename: z.string().min(1), output_filename: z.string().min(1), format: z.string().regex(/^[a-z0-9]+$/i).default("png") },
    }, async ({ filename, output_filename, format }) => this.result(await this.assets.exportSprite(filename, output_filename, format)));

    server.registerTool("copy_sprite", {
      description: "Copy a sprite to another Aseprite document, refusing to overwrite by default.",
      inputSchema: { filename: z.string().min(1), output_filename: z.string().min(1), overwrite: z.boolean().default(false) },
    }, async ({ filename, output_filename, overwrite }) => this.result(await this.assets.copySprite(filename, output_filename, overwrite)));

    server.registerTool("export_frame", {
      description: "Export one animation frame as a PNG with nearest-neighbor integer scaling.",
      inputSchema: { filename: z.string().min(1), frame_index: z.number().int().positive(), output_filename: z.string().min(1), scale: z.number().int().min(1).max(64).default(1) },
    }, async ({ filename, frame_index, output_filename, scale }) => this.result(await this.assets.exportFrame(filename, frame_index, output_filename, scale)));

    server.registerTool("export_layers", {
      description: "Export each layer as a PNG and confirm that at least one new layer file was written.",
      inputSchema: { filename: z.string().min(1), output_directory: z.string().min(1), include_hidden: z.boolean().default(false) },
    }, async ({ filename, output_directory, include_hidden }) => this.result(await this.assets.exportLayers(filename, output_directory, include_hidden)));

    server.registerTool("export_tag", {
      description: "Export an animation tag as an image or animation file after validating that the tag exists.",
      inputSchema: { filename: z.string().min(1), tag_name: z.string().min(1), output_filename: z.string().min(1), scale: z.number().int().min(1).max(64).default(1) },
    }, async ({ filename, tag_name, output_filename, scale }) => this.result(await this.assets.exportTag(filename, tag_name, output_filename, scale)));

    server.registerTool("import_image_as_layer", {
      description: "Import an image into a named layer and frame, creating the layer when it does not exist.",
      inputSchema: { filename: z.string().min(1), image_path: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive().default(1), x: z.number().int().default(0), y: z.number().int().default(0) },
    }, async ({ filename, image_path, layer_name, frame_index, x, y }) => this.result(await this.assets.importImageAsLayer(filename, image_path, layer_name, frame_index, x, y)));

    server.registerTool("create_cel", {
      description: "Create an empty cel at a layer and frame when one does not already exist.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x: z.number().int().default(0), y: z.number().int().default(0) },
    }, async ({ filename, layer_name, frame_index, x, y }) => this.result(await this.assets.createCel(filename, layer_name, frame_index, x, y)));

    server.registerTool("clear_cel", {
      description: "Delete a cel from a named layer and frame.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive() },
    }, async ({ filename, layer_name, frame_index }) => this.result(await this.assets.clearCel(filename, layer_name, frame_index)));

    server.registerTool("copy_cel", {
      description: "Copy one layer cel to another frame, replacing the destination by default.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), source_frame: z.number().int().positive(), target_frame: z.number().int().positive(), replace: z.boolean().default(true) },
    }, async ({ filename, layer_name, source_frame, target_frame, replace }) => this.result(await this.assets.copyCel(filename, layer_name, source_frame, target_frame, replace)));

    server.registerTool("copy_frame", {
      description: "Copy all cels from one frame to another frame or append a new frame.",
      inputSchema: { filename: z.string().min(1), source_frame: z.number().int().positive(), target_frame: z.number().int().positive().optional(), overwrite: z.boolean().default(true) },
    }, async ({ filename, source_frame, target_frame, overwrite }) => this.result(await this.assets.copyFrame(filename, source_frame, target_frame, overwrite)));

    server.registerTool("set_cel_position", {
      description: "Set one cel position, optionally creating it from a source cel.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x: z.number().int(), y: z.number().int(), create_if_missing: z.boolean().default(false), source_frame_index: z.number().int().positive().optional() },
    }, async ({ filename, layer_name, frame_index, x, y, create_if_missing, source_frame_index }) => this.result(await this.assets.setCelPosition(filename, layer_name, frame_index, x, y, create_if_missing, source_frame_index)));

    server.registerTool("tween_cel_positions", {
      description: "Tween cel positions linearly across a frame range.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), start_x: z.number().int(), start_y: z.number().int(), end_x: z.number().int(), end_y: z.number().int(), create_missing_cels: z.boolean().default(false), source_frame_index: z.number().int().positive().optional() },
    }, async ({ filename, layer_name, start_frame, end_frame, start_x, start_y, end_x, end_y, create_missing_cels, source_frame_index }) => this.result(await this.assets.tweenCelPositions(filename, layer_name, start_frame, end_frame, start_x, start_y, end_x, end_y, create_missing_cels, source_frame_index)));

    server.registerTool("offset_cel_positions", {
      description: "Offset cel positions across a frame range.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), dx: z.number().int(), dy: z.number().int() },
    }, async ({ filename, layer_name, start_frame, end_frame, dx, dy }) => this.result(await this.assets.offsetCelPositions(filename, layer_name, start_frame, end_frame, dx, dy)));

    server.registerTool("propagate_frame_to_range", {
      description: "Propagate all source-frame cels to a frame range.",
      inputSchema: { filename: z.string().min(1), source_frame: z.number().int().positive(), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), overwrite: z.boolean().default(true) },
    }, async ({ filename, source_frame, start_frame, end_frame, overwrite }) => this.result(await this.assets.propagateFrameToRange(filename, source_frame, start_frame, end_frame, overwrite)));

    server.registerTool("delete_frame", {
      description: "Delete one animation frame while keeping at least one frame in the sprite.",
      inputSchema: { filename: z.string().min(1), frame_index: z.number().int().positive() },
    }, async ({ filename, frame_index }) => this.result(await this.assets.deleteFrame(filename, frame_index)));

    server.registerTool("delete_tag", {
      description: "Delete an existing animation tag.",
      inputSchema: { filename: z.string().min(1), name: z.string().min(1) },
    }, async ({ filename, name }) => this.result(await this.assets.deleteTag(filename, name)));

    server.registerTool("set_onion_skin", {
      description: "Validate onion-skin settings for batch workflows; Aseprite UI-only settings are reported explicitly.",
      inputSchema: { filename: z.string().min(1), enabled: z.boolean().default(true), before: z.number().int().nonnegative().default(2), after: z.number().int().nonnegative().default(2), opacity: z.number().int().min(0).max(255).default(128) },
    }, async ({ filename, enabled, before, after, opacity }) => this.result(await this.assets.setOnionSkin(filename, enabled, before, after, opacity)));

    server.registerTool("render_onion_skin", {
      description: "Render neighboring animation frames as translucent onion-skin ghosts into a PNG.",
      inputSchema: { filename: z.string().min(1), frame_index: z.number().int().positive(), output_filename: z.string().min(1), before: z.number().int().nonnegative().default(1), after: z.number().int().nonnegative().default(1), scale: z.number().int().min(1).max(64).default(4), ghost_opacity: z.number().int().min(0).max(255).default(100) },
    }, async ({ filename, frame_index, output_filename, before, after, scale, ghost_opacity }) => this.result(await this.assets.renderOnionSkin(filename, frame_index, output_filename, before, after, scale, ghost_opacity)));

    server.registerTool("compare_frames", {
      description: "Compare two flattened animation frames and return changed-pixel metrics as JSON.",
      inputSchema: { filename: z.string().min(1), frame_a: z.number().int().positive(), frame_b: z.number().int().positive() },
    }, async ({ filename, frame_a, frame_b }) => this.result(await this.assets.compareFrames(filename, frame_a, frame_b)));

    server.registerTool("set_cel_opacity", {
      description: "Set one cel opacity from 0 to 255.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), opacity: z.number().int().min(0).max(255) },
    }, async ({ filename, layer_name, frame_index, opacity }) => this.result(await this.assets.setCelOpacity(filename, layer_name, frame_index, opacity)));
  }

  private result(operation: AsepriteResult): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] }; }
}
