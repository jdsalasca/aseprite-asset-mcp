import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AsepriteMcpClient } from "../src/workflows/mcp-client.js";

const defaultAsepritePath = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Aseprite\\Aseprite.exe";
const asepritePath = process.env.ASEPRITE_PATH ?? defaultAsepritePath;

test("TypeScript MCP server completes a real stdio handshake", async () => {
  const client = new AsepriteMcpClient({ cwd: process.cwd() });
  try {
    const tools = await client.listTools();
    assert.ok(tools.includes("create_canvas"));
    assert.ok(tools.includes("delete_layer"));
    assert.ok(tools.includes("rename_layer"));
    assert.ok(tools.includes("duplicate_layer"));
    assert.ok(tools.includes("reorder_layer"));
    assert.ok(tools.includes("set_layer_blend_mode"));
    assert.ok(tools.includes("merge_layer_down"));
    assert.ok(tools.includes("flatten_sprite"));
    assert.ok(tools.includes("draw_pixels"));
    assert.ok(tools.includes("draw_line"));
    assert.ok(tools.includes("fill_area"));
    assert.ok(tools.includes("draw_circle"));
    assert.ok(tools.includes("draw_pixels_at"));
    assert.ok(tools.includes("draw_line_at"));
    assert.ok(tools.includes("draw_rectangle_at"));
    assert.ok(tools.includes("fill_area_at"));
    assert.ok(tools.includes("draw_circle_at"));
    assert.ok(tools.includes("draw_polygon"));
    assert.ok(tools.includes("draw_path"));
    assert.ok(tools.includes("apply_gradient_rect"));
    assert.ok(tools.includes("draw_ellipse_at"));
    assert.ok(tools.includes("export_sprite"));
    assert.ok(tools.includes("copy_sprite"));
    assert.ok(tools.includes("export_frame"));
    assert.ok(tools.includes("export_layers"));
    assert.ok(tools.includes("export_tag"));
    assert.ok(tools.includes("import_image_as_layer"));
    assert.ok(tools.includes("create_cel"));
    assert.ok(tools.includes("clear_cel"));
    assert.ok(tools.includes("copy_cel"));
    assert.ok(tools.includes("copy_frame"));
    assert.ok(tools.includes("set_cel_position"));
    assert.ok(tools.includes("tween_cel_positions"));
    assert.ok(tools.includes("offset_cel_positions"));
    assert.ok(tools.includes("propagate_frame_to_range"));
    assert.ok(tools.includes("delete_frame"));
    assert.ok(tools.includes("delete_tag"));
    assert.ok(tools.includes("set_onion_skin"));
    assert.ok(tools.includes("render_onion_skin"));
    assert.ok(tools.includes("compare_frames"));
    assert.ok(tools.includes("set_cel_opacity"));
    assert.ok(tools.includes("get_color_stats"));
    assert.ok(tools.includes("get_palette"));
    assert.ok(tools.includes("extract_palette"));
    assert.ok(tools.includes("outline_native"));
    assert.ok(tools.includes("adjust_hsl_native"));
    assert.ok(tools.includes("adjust_brightness_contrast"));
    assert.ok(tools.includes("invert_colors"));
    assert.ok(tools.includes("outline_cel"));
    assert.ok(tools.includes("replace_color"));
    assert.ok(tools.includes("adjust_hsl"));
    assert.ok(tools.includes("apply_convolution"));
    assert.ok(tools.includes("list_convolution_matrices"));
    assert.ok(tools.includes("apply_dither_gradient"));
    assert.ok(tools.includes("apply_dither_pattern"));
    assert.ok(tools.includes("set_frame"));
    assert.ok(tools.includes("draw_rectangle"));
    assert.ok(tools.includes("create_character_plan"));
    assert.ok(tools.includes("create_scene_plan"));
    assert.ok(!tools.includes("legacy_server"));
  } finally {
    await client.close();
  }
});

test("server capabilities report the current typed runtime and complete tool count", async () => {
  const client = new AsepriteMcpClient({ cwd: process.cwd() });
  try {
    const response = await client.callTool("server_capabilities") as {
      content: Array<{ type: "text"; text: string } | { type: string }>;
    };
    const block = response.content.find((item) => item.type === "text");
    assert.ok(block && block.type === "text" && "text" in block);
    const capabilities = JSON.parse(block.text) as {
      typescriptVersion?: string;
      nodeVersion?: string;
      toolCount?: number;
      tools?: string[];
      migrationStatus?: string;
    };

    const registeredTools = await client.listTools();
    assert.equal(capabilities.typescriptVersion, "6.0.3");
    assert.match(capabilities.nodeVersion ?? "", /^v?24\./);
    assert.equal(capabilities.toolCount, capabilities.tools?.length);
    assert.deepEqual([...capabilities.tools ?? []].sort(), [...registeredTools].sort());
    assert.equal(capabilities.migrationStatus, "partial");
  } finally {
    await client.close();
  }
});

test("MCP stdio executes drawing primitives against real Aseprite", { skip: !existsSync(asepritePath) }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-mcp-e2e-"));
  const source = path.join(directory, "primitive.aseprite");
  const sheet = path.join(directory, "primitive.png");
  const metadata = path.join(directory, "primitive.json");
  const exportedSprite = path.join(directory, "primitive-copy.png");
  const copiedSprite = path.join(directory, "primitive-copy.aseprite");
  const exportedFrame = path.join(directory, "primitive-frame.png");
  const exportedLayers = path.join(directory, "layers");
  const exportedTag = path.join(directory, "primitive-idle.gif");
  const onionRender = path.join(directory, "primitive-onion.png");
  const client = new AsepriteMcpClient({
    cwd: process.cwd(),
    environment: { ASEPRITE_PATH: asepritePath },
  });

  const call = async (name: string, arguments_: Record<string, unknown>) => {
    const result = await client.callTool(name, arguments_) as { isError?: boolean; content?: Array<{ type: string; text?: string }> };
    assert.notEqual(result.isError, true, result.content?.map((item) => item.text ?? item.type).join(" "));
  };

  try {
    await call("create_canvas", { width: 16, height: 16, filename: source });
    await call("add_layer", { filename: source, layer_name: "body" });
    await call("add_frames", { filename: source, count: 1, duration_ms: 120 });
    await call("draw_pixels", { filename: source, pixels: [{ x: 1, y: 1, color: "#ffffff" }] });
    await call("draw_line", { filename: source, x1: 0, y1: 0, x2: 8, y2: 8, color: "#123456", thickness: 1 });
    await call("fill_area", { filename: source, x: 15, y: 15, color: "#222222" });
    await call("draw_circle", { filename: source, center_x: 8, center_y: 8, radius: 3, color: "#abcdef", fill: true });
    await call("draw_pixels_at", { filename: source, layer_name: "body", frame_index: 2, pixels: [{ x: 2, y: 2, color: "#ffffff" }] });
    await call("draw_line_at", { filename: source, layer_name: "body", frame_index: 2, x1: 1, y1: 1, x2: 10, y2: 10, color: "#123456" });
    await call("draw_rectangle_at", { filename: source, layer_name: "body", frame_index: 2, x: 4, y: 4, width: 5, height: 5, color: "#654321", fill: true });
    await call("fill_area_at", { filename: source, layer_name: "body", frame_index: 2, x: 0, y: 0, color: "#222222" });
    await call("draw_circle_at", { filename: source, layer_name: "body", frame_index: 2, center_x: 8, center_y: 8, radius: 2, color: "#fed" });
    await call("draw_polygon", { filename: source, layer_name: "body", frame_index: 2, points: [{ x: 2, y: 12 }, { x: 6, y: 8 }, { x: 10, y: 12 }], color: "#ff8800", fill: true });
    await call("draw_path", { filename: source, layer_name: "body", frame_index: 2, points: [{ x: 1, y: 14 }, { x: 8, y: 10 }, { x: 14, y: 14 }], color: "#00ff00", thickness: 1 });
    await call("apply_gradient_rect", { filename: source, layer_name: "body", frame_index: 2, x: 2, y: 2, width: 8, height: 4, color_start: "#0000ff", color_end: "#ff00ff", horizontal: true });
    await call("draw_ellipse_at", { filename: source, layer_name: "body", frame_index: 2, center_x: 8, center_y: 8, radius_x: 4, radius_y: 2, color: "#ffffff", fill: false });
    await call("export_sprite", { filename: source, output_filename: exportedSprite, format: "png" });
    await call("copy_sprite", { filename: source, output_filename: copiedSprite });
    await call("export_frame", { filename: source, frame_index: 2, output_filename: exportedFrame, scale: 2 });
    await call("set_tag", { filename: source, name: "idle", from_frame: 1, to_frame: 2 });
    await call("export_layers", { filename: source, output_directory: exportedLayers });
    await call("export_tag", { filename: source, tag_name: "idle", output_filename: exportedTag, scale: 1 });
    await call("import_image_as_layer", { filename: source, image_path: exportedFrame, layer_name: "reference", frame_index: 1, x: 0, y: 0 });
    await call("create_cel", { filename: source, layer_name: "reference", frame_index: 2, x: 1, y: 1 });
    await call("copy_cel", { filename: source, layer_name: "body", source_frame: 2, target_frame: 1, replace: true });
    await call("copy_frame", { filename: source, source_frame: 2, target_frame: 1, overwrite: true });
    await call("clear_cel", { filename: source, layer_name: "reference", frame_index: 2 });
    await call("set_cel_position", { filename: source, layer_name: "body", frame_index: 2, x: 5, y: 5, create_if_missing: true });
    await call("tween_cel_positions", { filename: source, layer_name: "body", start_frame: 1, end_frame: 2, start_x: 1, start_y: 1, end_x: 4, end_y: 4, create_missing_cels: false });
    await call("offset_cel_positions", { filename: source, layer_name: "body", start_frame: 1, end_frame: 2, dx: 1, dy: -1 });
    await call("propagate_frame_to_range", { filename: source, source_frame: 2, start_frame: 1, end_frame: 2, overwrite: true });
    await call("render_onion_skin", { filename: source, frame_index: 2, output_filename: onionRender, before: 1, after: 1, scale: 2, ghost_opacity: 100 });
    await call("compare_frames", { filename: source, frame_a: 1, frame_b: 2 });
    await call("set_cel_opacity", { filename: source, layer_name: "body", frame_index: 2, opacity: 200 });
    await call("get_color_stats", { filename: source, frame_index: 2, top: 4 });
    await call("get_palette", { filename: source });
    await call("extract_palette", { filename: source, max_colors: 8, with_alpha: false });
    await call("outline_native", { filename: source, layer_name: "body", frame_index: 2, color: "#00ff00", place: "outside", matrix: "circle" });
    await call("adjust_hsl_native", { filename: source, layer_name: "body", frame_index: 2, hue: 5, saturation: 0, lightness: 0 });
    await call("adjust_brightness_contrast", { filename: source, layer_name: "body", frame_index: 2, brightness: 0, contrast: 0 });
    await call("invert_colors", { filename: source, layer_name: "body", frame_index: 2 });
    await call("outline_cel", { filename: source, layer_name: "body", frame_index: 2, color: "#00ff00", include_diagonals: true });
    await call("replace_color", { filename: source, layer_name: "body", frame_index: 2, from_color: "#00ff00", to_color: "#ff00ff", tolerance: 0 });
    await call("adjust_hsl", { filename: source, layer_name: "body", frame_index: 2, hue_shift: 5, saturation_shift: 0, lightness_shift: 0 });
    await call("list_convolution_matrices", {});
    await call("apply_convolution", { filename: source, matrix: "blur-3x3", layer_name: "body", frame_index: 2 });
    await call("apply_dither_gradient", { filename: source, layer_name: "body", frame_index: 2, x: 2, y: 2, width: 6, height: 4, color_start: "#000000", color_end: "#ffffff", horizontal: true });
    await call("apply_dither_pattern", { filename: source, layer_name: "body", frame_index: 2, x: 8, y: 8, width: 4, height: 4, color_a: "#112233", color_b: "#abcdef", density: 0.5 });
    await call("delete_tag", { filename: source, name: "idle" });
    await call("delete_frame", { filename: source, frame_index: 2 });
    await call("set_onion_skin", { filename: source, enabled: true, before: 2, after: 2, opacity: 128 });
    await call("add_layer", { filename: source, layer_name: "scratch" });
    await call("rename_layer", { filename: source, layer_name: "scratch", new_name: "scratch-renamed" });
    await call("duplicate_layer", { filename: source, layer_name: "body", new_name: "body-copy" });
    await call("set_layer_blend_mode", { filename: source, layer_name: "body-copy", mode: "multiply" });
    await call("merge_layer_down", { filename: source, layer_name: "body-copy" });
    await call("duplicate_layer", { filename: source, layer_name: "body", new_name: "body-copy-reordered" });
    await call("reorder_layer", { filename: source, layer_name: "body-copy-reordered", position: 1 });
    await call("delete_layer", { filename: source, layer_name: "scratch-renamed" });
    await call("remap_colors_in_cel_range", { filename: source, layer_name: "body", start_frame: 1, end_frame: 1, mappings: [{ from: "#112233", to: "#abcdef" }], create_missing_cels: true, source_frame_index: 1 });
    await call("list_palette_presets", {});
    await call("apply_palette_preset", { filename: source, preset: "gameboy" });
    await call("generate_color_ramp", { base_color: "#D04648", steps: 5 });
    await call("quantize_to_palette", { filename: source, layer_name: "body", start_frame: 1, end_frame: 1 });
    await call("set_color_mode", { filename: source, mode: "grayscale" });
    await call("set_color_mode", { filename: source, mode: "rgb" });
    await call("flatten_sprite", { filename: source });
    await call("export_spritesheet", {
      filename: source,
      output_filename: sheet,
      data_filename: metadata,
      data_format: "json-array",
    });
    assert.equal(existsSync(source), true);
    assert.equal(existsSync(sheet), true);
    assert.equal(existsSync(metadata), true);
    assert.equal(existsSync(exportedSprite), true);
    assert.equal(existsSync(copiedSprite), true);
    assert.equal(existsSync(exportedFrame), true);
    assert.ok(existsSync(exportedLayers));
    assert.equal(existsSync(exportedTag), true);
    assert.equal(existsSync(onionRender), true);
  } finally {
    await client.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
