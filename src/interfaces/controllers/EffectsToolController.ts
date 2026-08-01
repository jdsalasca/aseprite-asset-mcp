import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { AsepriteAssetService } from "../../application/services/AsepriteAssetService.js";
import type { AsepriteResult } from "../../domain/aseprite.js";

const HEX_COLOR = /^#?(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export class EffectsToolController {
  public constructor(private readonly assets: AsepriteAssetService) {}

  public register(server: McpServer): void {
    server.registerTool("outline_native", {
      description: "Apply Aseprite native outline to a selected layer and frame.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().default(""), frame_index: z.number().int().positive().default(1), color: z.string().regex(HEX_COLOR).default("#000000"), place: z.enum(["outside", "inside"]).default("outside"), matrix: z.enum(["circle", "square"]).default("circle") },
    }, async ({ filename, layer_name, frame_index, color, place, matrix }) => this.result(await this.assets.outlineNative(filename, layer_name, frame_index, color, place, matrix)));

    server.registerTool("adjust_hsl_native", {
      description: "Apply Aseprite native hue, saturation, and lightness adjustment.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().default(""), frame_index: z.number().int().positive().default(1), hue: z.number().int().min(-180).max(180).default(0), saturation: z.number().int().min(-100).max(100).default(0), lightness: z.number().int().min(-100).max(100).default(0), x: z.number().int().default(0), y: z.number().int().default(0), width: z.number().int().nonnegative().default(0), height: z.number().int().nonnegative().default(0) },
    }, async ({ filename, layer_name, frame_index, hue, saturation, lightness, x, y, width, height }) => this.result(await this.assets.adjustHslNative(filename, layer_name, frame_index, hue, saturation, lightness, x, y, width, height)));

    server.registerTool("adjust_brightness_contrast", {
      description: "Apply Aseprite native brightness and contrast adjustment.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().default(""), frame_index: z.number().int().positive().default(1), brightness: z.number().int().min(-100).max(100).default(0), contrast: z.number().int().min(-100).max(100).default(0), x: z.number().int().default(0), y: z.number().int().default(0), width: z.number().int().nonnegative().default(0), height: z.number().int().nonnegative().default(0) },
    }, async ({ filename, layer_name, frame_index, brightness, contrast, x, y, width, height }) => this.result(await this.assets.adjustBrightnessContrast(filename, layer_name, frame_index, brightness, contrast, x, y, width, height)));

    server.registerTool("invert_colors", {
      description: "Apply Aseprite native color inversion.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().default(""), frame_index: z.number().int().positive().default(1), x: z.number().int().default(0), y: z.number().int().default(0), width: z.number().int().nonnegative().default(0), height: z.number().int().nonnegative().default(0) },
    }, async ({ filename, layer_name, frame_index, x, y, width, height }) => this.result(await this.assets.invertColors(filename, layer_name, frame_index, x, y, width, height)));

    server.registerTool("outline_cel", {
      description: "Add a one-pixel outline around opaque cel pixels.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), color: z.string().regex(HEX_COLOR).default("#000000"), include_diagonals: z.boolean().default(false) },
    }, async ({ filename, layer_name, frame_index, color, include_diagonals }) => this.result(await this.assets.outlineCel(filename, layer_name, frame_index, color, include_diagonals)));

    server.registerTool("replace_color", {
      description: "Replace a cel color while preserving alpha and allowing channel tolerance.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), from_color: z.string().regex(HEX_COLOR), to_color: z.string().regex(HEX_COLOR), tolerance: z.number().int().min(0).max(255).default(0) },
    }, async ({ filename, layer_name, frame_index, from_color, to_color, tolerance }) => this.result(await this.assets.replaceColor(filename, layer_name, frame_index, from_color, to_color, tolerance)));

    server.registerTool("adjust_hsl", {
      description: "Shift hue, saturation, and lightness on an opaque cel while preserving alpha.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), hue_shift: z.number().min(-360).max(360).default(0), saturation_shift: z.number().min(-100).max(100).default(0), lightness_shift: z.number().min(-100).max(100).default(0) },
    }, async ({ filename, layer_name, frame_index, hue_shift, saturation_shift, lightness_shift }) => this.result(await this.assets.adjustHsl(filename, layer_name, frame_index, hue_shift, saturation_shift, lightness_shift)));

    server.registerTool("apply_convolution", {
      description: "Apply a built-in Aseprite convolution matrix to a layer and frame.",
      inputSchema: { filename: z.string().min(1), matrix: z.string().min(1), layer_name: z.string().default(""), frame_index: z.number().int().positive().default(1), x: z.number().int().default(0), y: z.number().int().default(0), width: z.number().int().nonnegative().default(0), height: z.number().int().nonnegative().default(0) },
    }, async ({ filename, matrix, layer_name, frame_index, x, y, width, height }) => this.result(await this.assets.applyConvolution(filename, matrix, layer_name, frame_index, x, y, width, height)));

    server.registerTool("list_convolution_matrices", {
      description: "List the built-in convolution matrices supported by Aseprite.",
      inputSchema: {},
    }, async () => this.result(await this.assets.listConvolutionMatrices()));

    server.registerTool("apply_dither_gradient", {
      description: "Fill a rectangle with a two-color Bayer-dithered gradient.",
      inputSchema: {
        filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive(),
        color_start: z.string().regex(HEX_COLOR), color_end: z.string().regex(HEX_COLOR), horizontal: z.boolean().default(false), create_if_missing: z.boolean().default(true),
      },
    }, async ({ filename, layer_name, frame_index, x, y, width, height, color_start, color_end, horizontal, create_if_missing }) => this.result(await this.assets.applyDitherGradient(filename, layer_name, frame_index, x, y, width, height, color_start, color_end, horizontal, create_if_missing)));

    server.registerTool("apply_dither_pattern", {
      description: "Fill a rectangle with a uniform Bayer-dithered mix of two colors.",
      inputSchema: {
        filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive(),
        color_a: z.string().regex(HEX_COLOR), color_b: z.string().regex(HEX_COLOR), density: z.number().min(0).max(1).default(0.5), create_if_missing: z.boolean().default(true),
      },
    }, async ({ filename, layer_name, frame_index, x, y, width, height, color_a, color_b, density, create_if_missing }) => this.result(await this.assets.applyDitherPattern(filename, layer_name, frame_index, x, y, width, height, color_a, color_b, density, create_if_missing)));

    server.registerTool("set_tag", {
      description: "Create or update an animation tag.",
      inputSchema: {
        filename: z.string().min(1), name: z.string().min(1), from_frame: z.number().int().positive(), to_frame: z.number().int().positive(),
        direction: z.enum(["forward", "reverse", "pingpong", "pingpong_reverse"]).default("forward"),
      },
    }, async ({ filename, name, from_frame, to_frame, direction }) => this.result(await this.assets.setTag(filename, name, from_frame, to_frame, direction)));

  }

  private result(operation: AsepriteResult): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] }; }
}
