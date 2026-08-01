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
  } finally {
    await client.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
