import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { LayerFramePort } from "../../application/ports/AssetCapabilityPorts.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";

const HEX_COLOR = /^#?(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export class LayerFrameToolController {
  public constructor(private readonly assets: LayerFramePort) {}

  public register(server: McpServer): void {
    server.registerTool("create_canvas", {
      description: "Create a new Aseprite canvas.",
      inputSchema: { width: z.number().int().positive(), height: z.number().int().positive(), filename: z.string().min(1) },
    }, async ({ width, height, filename }) => this.result(await this.assets.createCanvas(width, height, filename)));

    server.registerTool("add_group", {
      description: "Add a named layer group to an Aseprite document.",
      inputSchema: { filename: z.string().min(1), group_name: z.string().min(1), parent_group: z.string().default("") },
    }, async ({ filename, group_name, parent_group }) => this.result(await this.assets.addGroup(filename, group_name, parent_group)));

    server.registerTool("add_layer", {
      description: "Add a named layer, optionally inside a group.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), group: z.string().default("") },
    }, async ({ filename, layer_name, group }) => this.result(await this.assets.addLayer(filename, layer_name, group)));

    server.registerTool("delete_layer", {
      description: "Delete a named layer from an Aseprite document.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1) },
    }, async ({ filename, layer_name }) => this.result(await this.assets.deleteLayer(filename, layer_name)));

    server.registerTool("rename_layer", {
      description: "Rename a named layer.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), new_name: z.string().min(1) },
    }, async ({ filename, layer_name, new_name }) => this.result(await this.assets.renameLayer(filename, layer_name, new_name)));

    server.registerTool("duplicate_layer", {
      description: "Duplicate a layer and its cels across all frames.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), new_name: z.string().default(""), group: z.string().default("") },
    }, async ({ filename, layer_name, new_name, group }) => this.result(await this.assets.duplicateLayer(filename, layer_name, new_name, group)));

    server.registerTool("reorder_layer", {
      description: "Move a layer to a one-based stack position.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), position: z.number().int().positive() },
    }, async ({ filename, layer_name, position }) => this.result(await this.assets.reorderLayer(filename, layer_name, position)));

    server.registerTool("set_layer_blend_mode", {
      description: "Set a layer blend mode supported by Aseprite.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), mode: z.string().min(1) },
    }, async ({ filename, layer_name, mode }) => this.result(await this.assets.setLayerBlendMode(filename, layer_name, mode)));

    server.registerTool("merge_layer_down", {
      description: "Merge a layer into the layer below it.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1) },
    }, async ({ filename, layer_name }) => this.result(await this.assets.mergeLayerDown(filename, layer_name)));

    server.registerTool("flatten_sprite", {
      description: "Flatten all layers into one layer.",
      inputSchema: { filename: z.string().min(1) },
    }, async ({ filename }) => this.result(await this.assets.flattenSprite(filename)));

    server.registerTool("add_frame", {
      description: "Add one animation frame.",
      inputSchema: { filename: z.string().min(1) },
    }, async ({ filename }) => this.result(await this.assets.addFrame(filename)));

    server.registerTool("add_frames", {
      description: "Add a deterministic number of animation frames.",
      inputSchema: { filename: z.string().min(1), count: z.number().int().positive(), duration_ms: z.number().int().positive().optional() },
    }, async ({ filename, count, duration_ms }) => this.result(await this.assets.addFrames(filename, count, duration_ms)));

    server.registerTool("set_frame", {
      description: "Set the active animation frame by one-based index.",
      inputSchema: { filename: z.string().min(1), frame_index: z.number().int().positive() },
    }, async ({ filename, frame_index }) => this.result(await this.assets.setFrame(filename, frame_index)));

    server.registerTool("set_frame_duration", {
      description: "Set one animation frame duration in milliseconds.",
      inputSchema: { filename: z.string().min(1), frame_index: z.number().int().positive(), duration_ms: z.number().int().positive() },
    }, async ({ filename, frame_index, duration_ms }) => this.result(await this.assets.setFrameDuration(filename, frame_index, duration_ms)));

    server.registerTool("set_frame_duration_all", {
      description: "Set all animation frame durations in milliseconds.",
      inputSchema: { filename: z.string().min(1), duration_ms: z.number().int().positive() },
    }, async ({ filename, duration_ms }) => this.result(await this.assets.setFrameDurationAll(filename, duration_ms)));

    server.registerTool("set_layer_visibility", {
      description: "Set a named layer visibility.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), visible: z.boolean().default(true) },
    }, async ({ filename, layer_name, visible }) => this.result(await this.assets.setLayerVisibility(filename, layer_name, visible)));

    server.registerTool("set_layer_opacity", {
      description: "Set a named layer opacity from 0 to 255.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), opacity: z.number().int().min(0).max(255) },
    }, async ({ filename, layer_name, opacity }) => this.result(await this.assets.setLayerOpacity(filename, layer_name, opacity)));

    server.registerTool("set_palette", {
      description: "Apply a controlled hexadecimal palette to a document.",
      inputSchema: { filename: z.string().min(1), colors: z.array(z.string().regex(HEX_COLOR)).min(1) },
    }, async ({ filename, colors }) => this.result(await this.assets.setPalette(filename, colors)));
  }

  private result(operation: AssetOperationResult): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] }; }
}
