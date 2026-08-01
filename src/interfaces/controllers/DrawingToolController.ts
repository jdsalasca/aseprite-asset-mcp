import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { AsepriteAssetService } from "../../application/services/AsepriteAssetService.js";
import type { AsepriteResult } from "../../domain/aseprite.js";

const HEX_COLOR = /^#?(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export class DrawingToolController {
  public constructor(private readonly assets: AsepriteAssetService) {}

  public register(server: McpServer): void {
    server.registerTool("draw_pixels", {
      description: "Draw explicit pixels on the active cel.",
      inputSchema: { filename: z.string().min(1), pixels: z.array(z.object({ x: z.number().int(), y: z.number().int(), color: z.string().regex(HEX_COLOR) })).min(1) },
    }, async ({ filename, pixels }) => this.result(await this.assets.drawPixels(filename, pixels)));

    server.registerTool("draw_line", {
      description: "Draw a Bresenham line with optional pixel thickness.",
      inputSchema: { filename: z.string().min(1), x1: z.number().int(), y1: z.number().int(), x2: z.number().int(), y2: z.number().int(), color: z.string().regex(HEX_COLOR).default("#000000"), thickness: z.number().int().positive().default(1) },
    }, async ({ filename, x1, y1, x2, y2, color, thickness }) => this.result(await this.assets.drawLine(filename, x1, y1, x2, y2, color, thickness)));

    server.registerTool("draw_rectangle", {
      description: "Draw a filled or outlined pixel-art rectangle on the active Aseprite layer.",
      inputSchema: { filename: z.string().min(1), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive(), color: z.string().regex(HEX_COLOR), fill: z.boolean().default(false) },
    }, async ({ filename, x, y, width, height, color, fill }) => this.result(await this.assets.drawRectangle(filename, x, y, width, height, color, fill)));

    server.registerTool("fill_area", {
      description: "Fill a contiguous area from a seed pixel.",
      inputSchema: { filename: z.string().min(1), x: z.number().int(), y: z.number().int(), color: z.string().regex(HEX_COLOR).default("#000000") },
    }, async ({ filename, x, y, color }) => this.result(await this.assets.fillArea(filename, x, y, color)));

    server.registerTool("draw_circle", {
      description: "Draw an ellipse-bounded circle.",
      inputSchema: { filename: z.string().min(1), center_x: z.number().int(), center_y: z.number().int(), radius: z.number().int().positive(), color: z.string().regex(HEX_COLOR).default("#000000"), fill: z.boolean().default(false) },
    }, async ({ filename, center_x, center_y, radius, color, fill }) => this.result(await this.assets.drawCircle(filename, center_x, center_y, radius, color, fill)));

    server.registerTool("draw_pixels_at", {
      description: "Draw explicit pixels on a named layer and animation frame, creating the cel when requested.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), pixels: z.array(z.object({ x: z.number().int(), y: z.number().int(), color: z.string().regex(HEX_COLOR) })).min(1), create_if_missing: z.boolean().default(true) },
    }, async ({ filename, layer_name, frame_index, pixels, create_if_missing }) => this.result(await this.assets.drawPixelsAt(filename, layer_name, frame_index, pixels, create_if_missing)));

    server.registerTool("draw_line_at", {
      description: "Draw a Bresenham line on a named layer and animation frame.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x1: z.number().int(), y1: z.number().int(), x2: z.number().int(), y2: z.number().int(), color: z.string().regex(HEX_COLOR).default("#000000"), thickness: z.number().int().positive().default(1), create_if_missing: z.boolean().default(true) },
    }, async ({ filename, layer_name, frame_index, x1, y1, x2, y2, color, thickness, create_if_missing }) => this.result(await this.assets.drawLineAt(filename, layer_name, frame_index, x1, y1, x2, y2, color, thickness, create_if_missing)));

    server.registerTool("draw_rectangle_at", {
      description: "Draw a filled or outlined rectangle on a named layer and animation frame.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive(), color: z.string().regex(HEX_COLOR).default("#000000"), fill: z.boolean().default(false), create_if_missing: z.boolean().default(true) },
    }, async ({ filename, layer_name, frame_index, x, y, width, height, color, fill, create_if_missing }) => this.result(await this.assets.drawRectangleAt(filename, layer_name, frame_index, x, y, width, height, color, fill, create_if_missing)));

    server.registerTool("fill_area_at", {
      description: "Fill a contiguous area on a named layer and animation frame.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x: z.number().int(), y: z.number().int(), color: z.string().regex(HEX_COLOR).default("#000000"), create_if_missing: z.boolean().default(true) },
    }, async ({ filename, layer_name, frame_index, x, y, color, create_if_missing }) => this.result(await this.assets.fillAreaAt(filename, layer_name, frame_index, x, y, color, create_if_missing)));

    server.registerTool("draw_circle_at", {
      description: "Draw an ellipse-bounded circle on a named layer and animation frame.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), center_x: z.number().int(), center_y: z.number().int(), radius: z.number().int().positive(), color: z.string().regex(HEX_COLOR).default("#000000"), fill: z.boolean().default(false), create_if_missing: z.boolean().default(true) },
    }, async ({ filename, layer_name, frame_index, center_x, center_y, radius, color, fill, create_if_missing }) => this.result(await this.assets.drawCircleAt(filename, layer_name, frame_index, center_x, center_y, radius, color, fill, create_if_missing)));

    server.registerTool("draw_polygon", {
      description: "Draw a filled or outlined polygon on a named layer and animation frame.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), points: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(3), color: z.string().regex(HEX_COLOR).default("#000000"), fill: z.boolean().default(false), create_if_missing: z.boolean().default(true) },
    }, async ({ filename, layer_name, frame_index, points, color, fill, create_if_missing }) => this.result(await this.assets.drawPolygon(filename, layer_name, frame_index, points, color, fill, create_if_missing)));

    server.registerTool("draw_path", {
      description: "Draw a polyline on a named layer and animation frame.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), points: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(2), color: z.string().regex(HEX_COLOR).default("#000000"), thickness: z.number().int().positive().default(1), create_if_missing: z.boolean().default(true) },
    }, async ({ filename, layer_name, frame_index, points, color, thickness, create_if_missing }) => this.result(await this.assets.drawPath(filename, layer_name, frame_index, points, color, thickness, create_if_missing)));

    server.registerTool("apply_gradient_rect", {
      description: "Apply a horizontal or vertical linear gradient to a rectangle on a named layer and animation frame.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), x: z.number().int(), y: z.number().int(), width: z.number().int().positive(), height: z.number().int().positive(), color_start: z.string().regex(HEX_COLOR), color_end: z.string().regex(HEX_COLOR), horizontal: z.boolean().default(true), create_if_missing: z.boolean().default(true) },
    }, async ({ filename, layer_name, frame_index, x, y, width, height, color_start, color_end, horizontal, create_if_missing }) => this.result(await this.assets.applyGradientRect(filename, layer_name, frame_index, x, y, width, height, color_start, color_end, horizontal, create_if_missing)));

    server.registerTool("draw_ellipse_at", {
      description: "Draw a filled or outlined ellipse on a named layer and animation frame.",
      inputSchema: { filename: z.string().min(1), layer_name: z.string().min(1), frame_index: z.number().int().positive(), center_x: z.number().int(), center_y: z.number().int(), radius_x: z.number().int().positive(), radius_y: z.number().int().positive(), color: z.string().regex(HEX_COLOR).default("#000000"), fill: z.boolean().default(false), create_if_missing: z.boolean().default(true) },
    }, async ({ filename, layer_name, frame_index, center_x, center_y, radius_x, radius_y, color, fill, create_if_missing }) => this.result(await this.assets.drawEllipseAt(filename, layer_name, frame_index, center_x, center_y, radius_x, radius_y, color, fill, create_if_missing)));
  }

  private result(operation: AsepriteResult): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] }; }
}
