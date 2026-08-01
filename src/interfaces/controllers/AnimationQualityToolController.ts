import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AnimationQualityPort } from "../../application/ports/AssetCapabilityPorts.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";

export class AnimationQualityToolController {
  public constructor(private readonly assets: AnimationQualityPort) {}

  public register(server: McpServer): void {
    server.registerTool("ensure_layers_present", {
      description: "Ensure cels exist for named layers across a frame range.",
      inputSchema: { filename: z.string().min(1), layer_names: z.array(z.string().min(1)).min(1), start_frame: z.number().int().positive().default(1), end_frame: z.number().int().positive().optional() },
    }, async ({ filename, layer_names, start_frame, end_frame }) => this.result(await this.assets.ensureLayersPresent(filename, layer_names, start_frame, end_frame)));

    server.registerTool("audit_animation", {
      description: "Audit animation cels, overlaps, and declared frame ranges.",
      inputSchema: { filename: z.string().min(1), start_frame: z.number().int().positive().default(1), end_frame: z.number().int().positive().optional(), layer_names: z.array(z.string().min(1)).optional(), overlap_pairs: z.array(z.string().min(1)).optional(), layer_frame_ranges: z.array(z.string().min(1)).optional(), report_cels: z.boolean().default(false), report_bounds: z.boolean().default(false), max_overlaps: z.number().int().nonnegative().default(200), max_out_of_range: z.number().int().nonnegative().default(200) },
    }, async ({ filename, start_frame, end_frame, layer_names, overlap_pairs, layer_frame_ranges, report_cels, report_bounds, max_overlaps, max_out_of_range }) => this.result(await this.assets.auditAnimation({ filename, startFrame: start_frame, endFrame: end_frame, layerNames: layer_names, overlapPairs: overlap_pairs, layerFrameRanges: layer_frame_ranges, reportCels: report_cels, reportBounds: report_bounds, maxOverlaps: max_overlaps, maxOutOfRange: max_out_of_range })));

    server.registerTool("animation_sanitize", {
      description: "Normalize animation cels and optionally repair out-of-range activity.",
      inputSchema: { filename: z.string().min(1), start_frame: z.number().int().positive().default(1), end_frame: z.number().int().positive().optional(), layer_names: z.array(z.string().min(1)).optional(), layer_order: z.array(z.string().min(1)).optional(), layer_frame_ranges: z.array(z.string().min(1)).optional(), ensure_layers: z.array(z.string().min(1)).optional(), out_of_range_action: z.enum(["set_opacity_zero", "delete_cels", "none"]).default("set_opacity_zero"), out_of_range_opacity: z.number().int().min(0).max(255).default(0), report_only: z.boolean().default(false), include_stats: z.boolean().default(true), ignore_full_canvas_overlaps: z.boolean().default(true), max_overlaps: z.number().int().nonnegative().default(200), overlap_pairs: z.array(z.string().min(1)).optional(), report_cels: z.boolean().default(false), report_bounds: z.boolean().default(false), max_out_of_range: z.number().int().nonnegative().default(200) },
    }, async ({ filename, start_frame, end_frame, layer_names, layer_order, layer_frame_ranges, ensure_layers, out_of_range_action, out_of_range_opacity, report_only, include_stats, ignore_full_canvas_overlaps, max_overlaps, overlap_pairs, report_cels, report_bounds, max_out_of_range }) => this.result(await this.assets.animationSanitize({ filename, startFrame: start_frame, endFrame: end_frame, layerNames: layer_names, layerOrder: layer_order, layerFrameRanges: layer_frame_ranges, ensureLayers: ensure_layers, outOfRangeAction: out_of_range_action, outOfRangeOpacity: out_of_range_opacity, reportOnly: report_only, includeStats: include_stats, ignoreFullCanvasOverlaps: ignore_full_canvas_overlaps, maxOverlaps: max_overlaps, overlapPairs: overlap_pairs, reportCels: report_cels, reportBounds: report_bounds, maxOutOfRange: max_out_of_range })));

    server.registerTool("start_preview_server", {
      description: "Serve a validated local directory over HTTP for visual asset preview.",
      inputSchema: { directory: z.string().min(1), port: z.number().int().min(1024).max(65535).default(8000) },
    }, async ({ directory, port }) => this.result(await this.assets.startPreviewServer(directory, port)));

    server.registerTool("stop_preview_server", {
      description: "Stop a preview server started by this MCP process.",
      inputSchema: { port: z.number().int().min(1024).max(65535).default(8000) },
    }, async ({ port }) => this.result(await this.assets.stopPreviewServer(port)));

    server.registerTool("copy_layers_between_sprites", {
      description: "Copy selected animation layers and cels from one Aseprite document into another.",
      inputSchema: {
        source_filename: z.string().min(1), target_filename: z.string().min(1),
        layer_names: z.array(z.string().min(1)).min(1), replace: z.boolean().default(true), create_missing_frames: z.boolean().default(true),
      },
    }, async ({ source_filename, target_filename, layer_names, replace, create_missing_frames }) => this.result(await this.assets.copyLayersBetweenSprites({ sourceFilename: source_filename, targetFilename: target_filename, layerNames: layer_names, replace, createMissingFrames: create_missing_frames })));

    server.registerTool("get_sprite_info", {
      description: "Read sprite dimensions, color mode, frame durations, layers, and tags as JSON.",
      inputSchema: { filename: z.string().min(1) },
    }, async ({ filename }) => this.result(await this.assets.getSpriteInfo(filename)));

    server.registerTool("duplicate_frame_range", {
      description: "Append one or more copies of an inclusive animation frame range.",
      inputSchema: { filename: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), times: z.number().int().positive().default(1) },
    }, async ({ filename, start_frame, end_frame, times }) => this.result(await this.assets.duplicateFrameRange(filename, start_frame, end_frame, times)));

    server.registerTool("propagate_cels", {
      description: "Copy selected layer cels from one source frame across a frame range.",
      inputSchema: { filename: z.string().min(1), layer_names: z.array(z.string().min(1)).min(1), source_frame: z.number().int().positive(), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), replace: z.boolean().default(true) },
    }, async ({ filename, layer_names, source_frame, start_frame, end_frame, replace }) => this.result(await this.assets.propagateCels(filename, layer_names, source_frame, start_frame, end_frame, replace)));

    server.registerTool("tween_cel_positions_eased", {
      description: "Tween cel positions across frames with deterministic easing.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), start_x: z.number().int(), start_y: z.number().int(), end_x: z.number().int(), end_y: z.number().int(), easing: z.enum(["linear", "ease_in", "ease_out", "ease_in_out", "smoothstep"]).default("smoothstep"), create_missing_cels: z.boolean().default(false), source_frame_index: z.number().int().positive().optional() },
    }, async ({ filename, layer_name, start_frame, end_frame, start_x, start_y, end_x, end_y, easing, create_missing_cels, source_frame_index }) => this.result(await this.assets.tweenCelPositionsEased(filename, layer_name, start_frame, end_frame, start_x, start_y, end_x, end_y, easing, create_missing_cels, source_frame_index)));

    server.registerTool("oscillate_cel_positions", {
      description: "Apply sine-wave position offsets to cels across frames.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), amplitude_x: z.number().int().default(0), amplitude_y: z.number().int().default(0), cycles: z.number().finite().default(1), phase_deg: z.number().finite().default(0), create_missing_cels: z.boolean().default(false), source_frame_index: z.number().int().positive().optional() },
    }, async ({ filename, layer_name, start_frame, end_frame, amplitude_x, amplitude_y, cycles, phase_deg, create_missing_cels, source_frame_index }) => this.result(await this.assets.oscillateCelPositions(filename, layer_name, start_frame, end_frame, amplitude_x, amplitude_y, cycles, phase_deg, create_missing_cels, source_frame_index)));

    server.registerTool("tween_cel_opacity_eased", {
      description: "Tween cel opacity from 0 to 255 across frames with easing.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), start_opacity: z.number().int().min(0).max(255), end_opacity: z.number().int().min(0).max(255), easing: z.enum(["linear", "ease_in", "ease_out", "ease_in_out", "smoothstep"]).default("smoothstep"), create_missing_cels: z.boolean().default(false), source_frame_index: z.number().int().positive().optional() },
    }, async ({ filename, layer_name, start_frame, end_frame, start_opacity, end_opacity, easing, create_missing_cels, source_frame_index }) => this.result(await this.assets.tweenCelOpacityEased(filename, layer_name, start_frame, end_frame, start_opacity, end_opacity, easing, create_missing_cels, source_frame_index)));

    server.registerTool("tween_cel_scale_eased", {
      description: "Scale a source cel across frames with easing and a stable anchor.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), start_frame: z.number().int().positive(), end_frame: z.number().int().positive(), start_scale: z.number().positive(), end_scale: z.number().positive(), easing: z.enum(["linear", "ease_in", "ease_out", "ease_in_out", "smoothstep"]).default("smoothstep"), anchor: z.enum(["center", "topleft"]).default("center"), replace: z.boolean().default(true), create_missing_cels: z.boolean().default(true), source_frame_index: z.number().int().positive().optional() },
    }, async ({ filename, layer_name, start_frame, end_frame, start_scale, end_scale, easing, anchor, replace, create_missing_cels, source_frame_index }) => this.result(await this.assets.tweenCelScaleEased(filename, layer_name, start_frame, end_frame, start_scale, end_scale, easing, anchor, replace, create_missing_cels, source_frame_index)));

    server.registerTool("set_layer", {
      description: "Set the active layer by name, optionally creating it.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), create_if_missing: z.boolean().default(false) },
    }, async ({ filename, layer_name, create_if_missing }) => this.result(await this.assets.setLayer(filename, layer_name, create_if_missing)));

  }

  private result(operation: AssetOperationResult): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] }; }
}
