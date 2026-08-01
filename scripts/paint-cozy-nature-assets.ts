import path from "node:path";
import { AsepriteMcpClient } from "../src/workflows/mcp-client.js";
import type { ToolCall, WorkflowPlan } from "../src/workflows/types.js";

const gameRoot = "C:/Users/jdsal/Documents/Programming-personal/odiseum";
const worldRoot = path.join(gameRoot, "art/world");
const asepritePath = process.env.ASEPRITE_PATH ?? "C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe";

type Painter = (filename: string, frame: number) => ToolCall[];

function call(name: string, args: Record<string, unknown>, purpose: string): ToolCall {
  return { name, arguments: args, purpose };
}

function rect(filename: string, frame: number, x: number, y: number, width: number, height: number, color: string): ToolCall {
  return call("draw_rectangle_at", { filename, layer_name: "Layer 1", frame_index: frame, x, y, width, height, color, fill: true, create_if_missing: true }, "Paint a crisp pixel-art block");
}

function polygon(filename: string, frame: number, points: Array<[number, number]>, color: string): ToolCall {
  return call("draw_polygon", { filename, layer_name: "Layer 1", frame_index: frame, points: points.map(([x, y]) => ({ x, y })), color, fill: true, create_if_missing: true }, "Paint a layered pixel-art silhouette");
}

function circle(filename: string, frame: number, x: number, y: number, radius: number, color: string): ToolCall {
  return call("draw_circle", { filename, center_x: x, center_y: y, radius, color, fill: true }, "Paint a soft pixel-art shape");
}

function pixels(filename: string, frame: number, points: Array<[number, number, string]>): ToolCall {
  return call("draw_pixels_at", { filename, layer_name: "Layer 1", frame_index: frame, pixels: points.map(([x, y, color]) => ({ x, y, color })), create_if_missing: true }, "Add hand-placed pixel highlights");
}

const ink = "#17152E";
const shadow = "#0D1026";
const deepLeaf = "#2A6B54";
const moss = "#3C8D68";
const leaf = "#6EAA6D";
const leafLight = "#8FD694";
const breeze = "#BCE8D2";
const gold = "#F5D76E";
const cream = "#F7F2E5";
const wood = "#8A5B48";

function willowTree(filename: string, frame: number): ToolCall[] {
  const sway = [0, 1, 2, 1][frame - 1] ?? 0;
  return [
    polygon(filename, frame, [[6, 58], [13, 53], [35, 53], [43, 58], [35, 62], [13, 62]], shadow),
    rect(filename, frame, 21 + sway, 32, 8, 28, wood),
    rect(filename, frame, 23 + sway, 34, 3, 24, "#B2775B"),
    polygon(filename, frame, [[7 + sway, 38], [8 + sway, 24], [15 + sway, 19], [12 + sway, 11], [21 + sway, 14], [26 + sway, 4], [31 + sway, 14], [40 + sway, 10], [36 + sway, 20], [44 + sway, 24], [40 + sway, 38], [31 + sway, 44], [16 + sway, 44]], ink),
    polygon(filename, frame, [[11 + sway, 35], [12 + sway, 25], [18 + sway, 21], [16 + sway, 15], [23 + sway, 18], [27 + sway, 8], [31 + sway, 18], [37 + sway, 14], [34 + sway, 23], [40 + sway, 26], [36 + sway, 34], [29 + sway, 40], [18 + sway, 40]], deepLeaf),
    polygon(filename, frame, [[16 + sway, 30], [18 + sway, 23], [24 + sway, 25], [28 + sway, 15], [32 + sway, 24], [36 + sway, 22], [33 + sway, 31], [27 + sway, 29], [24 + sway, 36]], leaf),
    pixels(filename, frame, [[14 + sway, 27, leafLight], [20 + sway, 19, leafLight], [27 + sway, 13, breeze], [32 + sway, 24, leafLight], [36 + sway, 30, leafLight], [25 + sway, 42, moss], [25 + sway, 31, gold]]),
  ];
}

function leafBreeze(filename: string, frame: number): ToolCall[] {
  const offsets: Array<[number, number]> = [[0, 2], [2, 0], [4, 2], [2, 4]];
  const offset = offsets[frame - 1] ?? [0, 2];
  const x = offset[0];
  const y = offset[1];
  return [
    polygon(filename, frame, [[3 + x, 15 + y], [9 + x, 8 + y], [16 + x, 5 + y], [22 + x, 8 + y], [27 + x, 15 + y], [20 + x, 16 + y], [14 + x, 22 + y], [8 + x, 20 + y]], ink),
    polygon(filename, frame, [[7 + x, 15 + y], [11 + x, 10 + y], [16 + x, 8 + y], [21 + x, 10 + y], [24 + x, 14 + y], [18 + x, 15 + y], [14 + x, 19 + y], [10 + x, 18 + y]], leafLight),
    pixels(filename, frame, [[12 + x, 13 + y, breeze], [16 + x, 10 + y, cream], [20 + x, 13 + y, leaf], [14 + x, 17 + y, gold]]),
  ];
}

function grassWind(filename: string, frame: number): ToolCall[] {
  const sway = [-2, 0, 2, 0][frame - 1] ?? 0;
  return [
    polygon(filename, frame, [[4, 28], [8, 12 + sway], [10, 28]], deepLeaf),
    polygon(filename, frame, [[10, 28], [15, 8 + sway], [16, 28]], leaf),
    polygon(filename, frame, [[16, 28], [22, 13 + sway], [22, 28]], moss),
    polygon(filename, frame, [[22, 28], [27, 6 + sway], [28, 28]], leafLight),
    polygon(filename, frame, [[28, 28], [32, 12 + sway], [31, 28]], deepLeaf),
    pixels(filename, frame, [[8, 25, leafLight], [16, 22, breeze], [24, 24, leafLight], [30, 21, breeze]]),
  ];
}

function fireflyGlow(filename: string, frame: number): ToolCall[] {
  const positions: Array<[number, number]> = [[7, 9], [16, 6], [23, 15], [12, 20]];
  const position = positions[frame - 1] ?? [7, 9];
  const x = position[0];
  const y = position[1];
  return [
    circle(filename, frame, x, y, 5, "#27335F"),
    circle(filename, frame, x, y, 3, "#F5D76E"),
    pixels(filename, frame, [[x, y, cream], [x + 6, y - 2, gold], [x - 5, y + 4, breeze]]),
  ];
}

const assets: Array<{ id: string; width: number; height: number; frames: number; frameDuration: number; tag: string; palette: string[]; painter: Painter }> = [
  { id: "willow-tree", width: 48, height: 64, frames: 4, frameDuration: 180, tag: "sway", palette: [ink, shadow, deepLeaf, moss, leaf, leafLight, breeze, gold, cream, wood, "#B2775B"], painter: willowTree },
  { id: "leaf-breeze", width: 32, height: 32, frames: 4, frameDuration: 120, tag: "float", palette: [ink, deepLeaf, leaf, leafLight, breeze, gold, cream], painter: leafBreeze },
  { id: "grass-wind", width: 32, height: 32, frames: 4, frameDuration: 100, tag: "sway", palette: [deepLeaf, moss, leaf, leafLight, breeze], painter: grassWind },
  { id: "firefly-glow", width: 32, height: 32, frames: 4, frameDuration: 160, tag: "blink", palette: ["#27335F", gold, cream, breeze], painter: fireflyGlow },
];

async function run(): Promise<void> {
  const client = new AsepriteMcpClient({ cwd: process.cwd(), environment: { ASEPRITE_PATH: asepritePath } });
  try {
    const completed: string[] = [];
    for (const asset of assets) {
      const sourceFile = path.join(worldRoot, `${asset.id}.aseprite`);
      const outputFile = path.join(worldRoot, `${asset.id}.png`);
      const calls: ToolCall[] = [
        call("create_canvas", { filename: sourceFile, width: asset.width, height: asset.height }, `Create the ${asset.id} pixel canvas`),
        call("set_palette", { filename: sourceFile, colors: asset.palette }, `Lock the ${asset.id} cozy palette`),
        call("add_frames", { filename: sourceFile, count: asset.frames - 1, duration_ms: asset.frameDuration }, `Create the ${asset.frames}-frame animation`),
        call("set_tag", { filename: sourceFile, name: asset.tag, from_frame: 1, to_frame: asset.frames, direction: "pingpong" }, `Tag the ${asset.tag} animation`),
      ];
      for (let frame = 1; frame <= asset.frames; frame += 1) {
        calls.push(call("set_frame", { filename: sourceFile, frame_index: frame }, `Select ${asset.id} frame ${frame}`));
        calls.push(...asset.painter(sourceFile, frame));
      }
      calls.push(call("export_spritesheet", { filename: sourceFile, output_filename: outputFile, sheet_type: "horizontal", scale: 2, padding: 0, tag_name: asset.tag }, `Export ${asset.id} for Godot`));
      const plan: WorkflowPlan = {
        schemaVersion: 1,
        kind: "scene",
        assetId: asset.id,
        sourceFile,
        calls,
        exports: [],
        godotManifest: {
          schemaVersion: 1,
          assetId: asset.id,
          assetType: "scene",
          texture: outputFile,
          frameWidth: asset.width * 2,
          frameHeight: asset.height * 2,
          animations: [{ name: asset.tag, fromFrame: 1, toFrame: asset.frames, loop: true }],
        },
      };
      const results = await client.execute(plan);
      const failures = results.filter((result) => result.includes('"isError":true'));
      if (failures.length > 0) throw new Error(`Aseprite MCP rejected ${asset.id}:\n${failures.join("\n")}`);
      completed.push(asset.id);
    }
    console.log(JSON.stringify({ style: "odiseum-cozy-nature", assets: completed, source: "Aseprite MCP TypeScript workflow" }, null, 2));
  } finally {
    await client.close();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
