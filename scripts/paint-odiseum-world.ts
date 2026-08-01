import path from "node:path";
import { AsepriteMcpClient } from "../src/workflows/mcp-client.js";
import { buildOdiseumStyleManifest } from "../src/workflows/odiseum-style.js";
import type { ToolCall, WorkflowPlan } from "../src/workflows/types.js";

const gameRoot = "C:/Users/jdsal/Documents/Programming-personal/odiseum";
const worldRoot = path.join(gameRoot, "art/world");
const style = buildOdiseumStyleManifest();
const asepritePath = process.env.ASEPRITE_PATH ?? "C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe";

function call(name: string, args: Record<string, unknown>, purpose: string): ToolCall {
  return { name, arguments: args, purpose };
}

function rect(filename: string, frame: number, x: number, y: number, width: number, height: number, color: string): ToolCall {
  return call("draw_rectangle_at", { filename, layer_name: "Layer 1", frame_index: frame, x, y, width, height, color, fill: true, create_if_missing: true }, "Paint a clean pixel-art block");
}

function polygon(filename: string, frame: number, points: Array<[number, number]>, color: string): ToolCall {
  return call("draw_polygon", { filename, layer_name: "Layer 1", frame_index: frame, points: points.map(([x, y]) => ({ x, y })), color, fill: true, create_if_missing: true }, "Paint a readable pixel-art silhouette");
}

function circle(filename: string, frame: number, x: number, y: number, radius: number, color: string): ToolCall {
  return call("draw_circle", { filename, center_x: x, center_y: y, radius, color, fill: true }, "Paint a soft pixel-art glow");
}

function pixels(filename: string, frame: number, points: Array<[number, number, string]>): ToolCall {
  return call("draw_pixels_at", { filename, layer_name: "Layer 1", frame_index: frame, pixels: points.map(([x, y, color]) => ({ x, y, color })), create_if_missing: true }, "Add one-pixel texture and highlights");
}

function propFrame(filename: string, frame: number): ToolCall[] {
  const ink = "#17152E";
  const cream = "#F7F2E5";
  switch (frame) {
    case 1:
      return [
        rect(filename, frame, 15, 18, 2, 11, "#3C8D68"),
        rect(filename, frame, 10, 25, 12, 2, "#27335F"),
        polygon(filename, frame, [[16, 18], [9, 13], [10, 8], [15, 12], [16, 5], [18, 12], [23, 8], [23, 14]], ink),
        polygon(filename, frame, [[16, 17], [11, 13], [12, 9], [16, 13], [17, 8], [18, 13], [21, 10], [21, 14]], "#D3A7E8"),
        pixels(filename, frame, [[15, 13, "#F5D76E"], [17, 13, "#F5D76E"], [16, 11, cream]]),
      ];
    case 2:
      return [
        rect(filename, frame, 15, 10, 3, 20, ink),
        polygon(filename, frame, [[5, 6], [27, 6], [24, 17], [8, 17]], ink),
        polygon(filename, frame, [[7, 8], [25, 8], [22, 15], [10, 15]], "#F0C98E"),
        rect(filename, frame, 10, 10, 12, 2, "#D86C74"),
        pixels(filename, frame, [[12, 13, "#27335F"], [14, 13, "#27335F"], [18, 13, "#27335F"], [20, 13, "#27335F"], [14, 26, "#6CE1D2"], [19, 26, "#6CE1D2"]]),
      ];
    case 3:
      return [
        rect(filename, frame, 13, 20, 7, 10, "#8A5B48"),
        polygon(filename, frame, [[16, 2], [7, 9], [5, 18], [10, 23], [23, 23], [28, 17], [25, 8]], ink),
        polygon(filename, frame, [[16, 4], [9, 10], [8, 17], [12, 20], [21, 20], [25, 16], [23, 10]], "#6EAA6D"),
        pixels(filename, frame, [[11, 11, "#8FD694"], [15, 7, "#8FD694"], [20, 11, "#BCE8D2"], [18, 17, "#3C8D68"]]),
      ];
    case 4:
      return [
        rect(filename, frame, 15, 12, 3, 17, ink),
        rect(filename, frame, 10, 27, 13, 3, ink),
        polygon(filename, frame, [[9, 7], [11, 3], [21, 3], [23, 7], [21, 20], [11, 20]], ink),
        rect(filename, frame, 12, 8, 8, 10, "#F5D76E"),
        rect(filename, frame, 14, 10, 4, 6, "#FFF0CF"),
        pixels(filename, frame, [[12, 5, "#6CE1D2"], [20, 5, "#6CE1D2"], [16, 2, "#F7F2E5"]]),
      ];
    case 5:
      return [
        circle(filename, frame, 16, 19, 10, ink),
        polygon(filename, frame, [[16, 18], [9, 14], [5, 17], [10, 21], [7, 26], [16, 23], [25, 26], [22, 21], [27, 17], [23, 14]], "#6CE1D2"),
        circle(filename, frame, 16, 18, 5, "#D3A7E8"),
        circle(filename, frame, 16, 18, 2, "#F5D76E"),
        pixels(filename, frame, [[9, 18, "#BCE8D2"], [23, 18, "#BCE8D2"], [16, 26, "#BCE8D2"]]),
      ];
    default:
      return [
        polygon(filename, frame, [[16, 1], [19, 12], [30, 16], [19, 20], [16, 31], [13, 20], [2, 16], [13, 12]], ink),
        polygon(filename, frame, [[16, 5], [18, 13], [25, 16], [18, 18], [16, 27], [14, 18], [7, 16], [14, 13]], "#F5D76E"),
        pixels(filename, frame, [[16, 12, "#F7F2E5"], [16, 13, "#F7F2E5"], [16, 19, "#D3A7E8"]]),
      ];
  }
}

function portalFrame(filename: string, frame: number): ToolCall[] {
  const rings = [7, 10, 13, 15];
  const radius = rings[frame - 1] ?? rings[0]!;
  return [
    circle(filename, frame, 16, 16, radius + 3, "#17152E"),
    circle(filename, frame, 16, 16, radius, frame % 2 === 0 ? "#6CE1D2" : "#D3A7E8"),
    circle(filename, frame, 16, 16, Math.max(radius - 4, 2), "#27335F"),
    pixels(filename, frame, [[16, 16, "#F5D76E"], [16, 15, "#F7F2E5"], [15, 16, "#F7F2E5"]]),
  ];
}

function crystalFrame(filename: string, frame: number): ToolCall[] {
  const glow = ["#6CE1D2", "#D3A7E8", "#F5D76E", "#F7F2E5"][frame - 1] ?? "#6CE1D2";
  const height = 12 + frame * 2;
  return [
    polygon(filename, frame, [[16, 2], [25, 13], [21, 29], [11, 29], [7, 13]], "#17152E"),
    polygon(filename, frame, [[16, 5], [22, 14], [19, height + 12], [13, height + 12], [10, 14]], glow),
    polygon(filename, frame, [[16, 6], [19, 14], [17, height + 8], [14, height + 8], [12, 14]], "#C9F4FF"),
    rect(filename, frame, 8, 29, 16, 2, "#27335F"),
    pixels(filename, frame, [[16, 1, "#F7F2E5"], [8, 13, glow], [24, 13, glow], [16, 31, "#F5D76E"]]),
  ];
}

async function run(): Promise<void> {
  const client = new AsepriteMcpClient({ cwd: process.cwd(), environment: { ASEPRITE_PATH: asepritePath } });
  try {
    const executeChecked = async (plan: WorkflowPlan): Promise<void> => {
      const results = await client.execute(plan);
      const failures = results.filter((result) => result.includes('"isError":true'));
      if (failures.length > 0) throw new Error(`Aseprite MCP rejected ${plan.assetId}:\n${failures.join("\n")}`);
    };

    const propsFile = path.join(worldRoot, "world-props.aseprite");
    const propCalls: ToolCall[] = [
      call("create_canvas", { filename: propsFile, width: 32, height: 32 }, "Create the world prop sheet"),
      call("set_palette", { filename: propsFile, colors: [...style.palette, "#8A5B48", "#F0C98E"] }, "Lock the shared cozy palette"),
      call("add_frames", { filename: propsFile, count: 5, duration_ms: 180 }, "Create six reusable prop frames"),
      call("set_tag", { filename: propsFile, name: "props", from_frame: 1, to_frame: 6, direction: "forward" }, "Expose the prop sheet to Godot"),
    ];
    for (let frame = 1; frame <= style.worldProps.frameCount; frame += 1) {
      propCalls.push(call("set_frame", { filename: propsFile, frame_index: frame }, `Select prop frame ${frame}`), ...propFrame(propsFile, frame));
    }
    propCalls.push(call("export_spritesheet", { filename: propsFile, output_filename: path.join(worldRoot, "world-props.png"), sheet_type: "horizontal", scale: style.worldProps.exportScale, padding: 0, tag_name: "props" }, "Export the six world props for Godot"));
    await executeChecked({ schemaVersion: 1, kind: "scene", assetId: "world-props", sourceFile: propsFile, calls: propCalls, exports: [], godotManifest: { schemaVersion: 1, assetId: "world-props", assetType: "scene", texture: path.join(worldRoot, "world-props.png"), frameWidth: 96, frameHeight: 96, animations: [] } });

    const portalFile = path.join(worldRoot, "portal-glyph.aseprite");
    const portalCalls: ToolCall[] = [
      call("create_canvas", { filename: portalFile, width: 32, height: 32 }, "Create the portal glyph sheet"),
      call("set_palette", { filename: portalFile, colors: [...style.palette] }, "Reuse the shared portal palette"),
      call("add_frames", { filename: portalFile, count: 3, duration_ms: 110 }, "Create a four-frame portal pulse"),
      call("set_tag", { filename: portalFile, name: "portal", from_frame: 1, to_frame: 4, direction: "pingpong" }, "Expose the portal animation to Godot"),
    ];
    for (let frame = 1; frame <= 4; frame += 1) {
      portalCalls.push(call("set_frame", { filename: portalFile, frame_index: frame }, `Select portal frame ${frame}`), ...portalFrame(portalFile, frame));
    }
    portalCalls.push(call("export_spritesheet", { filename: portalFile, output_filename: path.join(worldRoot, "portal-glyph.png"), sheet_type: "horizontal", scale: 3, padding: 0, tag_name: "portal" }, "Export the animated portal glyph for Godot"));
    await executeChecked({ schemaVersion: 1, kind: "scene", assetId: "portal-glyph", sourceFile: portalFile, calls: portalCalls, exports: [], godotManifest: { schemaVersion: 1, assetId: "portal-glyph", assetType: "scene", texture: path.join(worldRoot, "portal-glyph.png"), frameWidth: 96, frameHeight: 96, animations: [{ name: "portal", fromFrame: 1, toFrame: 4, loop: true }] } });

    const crystalFile = path.join(worldRoot, "starfall-crystal.aseprite");
    const crystalCalls: ToolCall[] = [
      call("create_canvas", { filename: crystalFile, width: 32, height: 32 }, "Create the Starfall Grove crystal source"),
      call("set_palette", { filename: crystalFile, colors: [...style.palette, "#C9F4FF"] }, "Reuse the shared cozy palette for the crystal"),
      call("add_frames", { filename: crystalFile, count: 3, duration_ms: 140 }, "Create the four-frame crystal shimmer"),
      call("set_tag", { filename: crystalFile, name: "shimmer", from_frame: 1, to_frame: 4, direction: "pingpong" }, "Expose the crystal shimmer to Godot"),
    ];
    for (let frame = 1; frame <= style.starfallCrystal.frameCount; frame += 1) {
      crystalCalls.push(call("set_frame", { filename: crystalFile, frame_index: frame }, `Select crystal frame ${frame}`), ...crystalFrame(crystalFile, frame));
    }
    crystalCalls.push(call("export_spritesheet", { filename: crystalFile, output_filename: path.join(worldRoot, "starfall-crystal.png"), sheet_type: "horizontal", scale: style.starfallCrystal.exportScale, padding: 0, tag_name: "shimmer" }, "Export the Starfall Grove crystal for Godot"));
    await executeChecked({ schemaVersion: 1, kind: "scene", assetId: "starfall-crystal", sourceFile: crystalFile, calls: crystalCalls, exports: [], godotManifest: { schemaVersion: 1, assetId: "starfall-crystal", assetType: "scene", texture: path.join(worldRoot, "starfall-crystal.png"), frameWidth: 96, frameHeight: 96, animations: [{ name: "shimmer", fromFrame: 1, toFrame: 4, loop: true }] } });
    console.log(JSON.stringify({ style: "odiseum-cozy-world-boost", assets: ["world-props", "portal-glyph", "starfall-crystal"], palette: style.palette }, null, 2));
  } finally {
    await client.close();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
