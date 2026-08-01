import fs from "node:fs/promises";
import path from "node:path";
import { AsepriteMcpClient } from "../src/workflows/mcp-client.js";
import { buildOdiseumStyleManifest } from "../src/workflows/odiseum-style.js";
import type { ToolCall, WorkflowPlan } from "../src/workflows/types.js";

const gameRoot = "C:/Users/jdsal/Documents/Programming-personal/odiseum";
const libraryRoot = path.join(gameRoot, "art/library");
const sourceFile = path.join(libraryRoot, "odiseum-cozy-kit.aseprite");
const outputFile = path.join(libraryRoot, "odiseum-cozy-kit.png");
const manifestFile = path.join(libraryRoot, "asset-library.json");
const style = buildOdiseumStyleManifest();
const asepritePath = process.env.ASEPRITE_PATH ?? "C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe";
let activeFrame = 1;

const ink = "#17152E";
const deepShadow = "#0D1026";
const night = "#27335F";
const moss = "#3C8D68";
const leaf = "#6EAA6D";
const leafLight = "#8FD694";
const water = "#6CE1D2";
const waterLight = "#BCE8D2";
const cream = "#F7F2E5";
const gold = "#F5D76E";
const wood = "#8A5B48";

function call(name: string, args: Record<string, unknown>, purpose: string): ToolCall {
  return { name, arguments: args, purpose };
}

function rect(x: number, y: number, width: number, height: number, color: string): ToolCall {
  return call("draw_rectangle_at", { filename: sourceFile, layer_name: "Layer 1", frame_index: activeFrame, x, y, width, height, color, fill: true, create_if_missing: true }, "Paint a reusable pixel-art shape");
}

function polygon(points: Array<[number, number]>, color: string): ToolCall {
  return call("draw_polygon", { filename: sourceFile, layer_name: "Layer 1", frame_index: activeFrame, points: points.map(([x, y]) => ({ x, y })), color, fill: true, create_if_missing: true }, "Paint a layered pixel-art silhouette");
}

function circle(centerX: number, centerY: number, radius: number, color: string): ToolCall {
  return call("draw_circle", { filename: sourceFile, center_x: centerX, center_y: centerY, radius, color, fill: true }, "Paint a soft pixel-art volume");
}

function pixels(points: Array<[number, number, string]>): ToolCall {
  return call("draw_pixels_at", { filename: sourceFile, layer_name: "Layer 1", frame_index: activeFrame, pixels: points.map(([x, y, color]) => ({ x, y, color })), create_if_missing: true }, "Add pixel highlights and material texture");
}

function shadow(): ToolCall[] {
  return [polygon([[6, 40], [12, 36], [36, 36], [43, 40], [36, 44], [12, 44]], deepShadow)];
}

function tree(): ToolCall[] {
  return [
    ...shadow(),
    rect(21, 27, 7, 14, wood),
    rect(23, 28, 3, 11, "#B2775B"),
    polygon([[7, 23], [8, 14], [14, 13], [12, 7], [20, 9], [24, 3], [29, 9], [37, 7], [34, 14], [41, 16], [39, 25], [32, 29], [15, 29]], ink),
    polygon([[11, 22], [12, 15], [17, 14], [15, 10], [21, 12], [24, 6], [28, 12], [35, 10], [32, 16], [37, 17], [35, 23], [29, 26], [17, 26]], moss),
    polygon([[16, 17], [18, 12], [23, 14], [25, 9], [28, 14], [33, 13], [30, 19], [24, 18], [21, 22]], leaf),
    pixels([[14, 20, leafLight], [20, 13, leafLight], [27, 11, waterLight], [31, 19, leafLight], [24, 23, moss], [24, 31, gold]]),
  ];
}

function bush(): ToolCall[] {
  return [
    ...shadow(),
    circle(15, 26, 10, ink), circle(25, 22, 12, ink), circle(34, 27, 10, ink),
    circle(15, 24, 8, moss), circle(25, 20, 10, leaf), circle(34, 25, 8, moss),
    circle(20, 18, 5, leafLight), circle(30, 16, 5, leafLight),
    circle(15, 22, 2, gold), circle(29, 25, 2, "#D86C74"), circle(35, 22, 2, gold),
    pixels([[12, 29, "#2A6B54"], [23, 26, leafLight], [32, 29, "#2A6B54"], [26, 13, cream]]),
  ];
}

function flowers(): ToolCall[] {
  return [
    ...shadow(),
    rect(15, 23, 2, 16, moss), rect(24, 20, 2, 19, moss), rect(33, 24, 2, 15, moss),
    circle(16, 20, 6, ink), circle(25, 17, 7, ink), circle(34, 21, 6, ink),
    circle(16, 19, 4, "#D3A7E8"), circle(25, 16, 5, "#F6C3A2"), circle(34, 20, 4, water),
    circle(16, 19, 2, gold), circle(25, 16, 2, gold), circle(34, 20, 2, gold),
    pixels([[12, 24, leafLight], [21, 25, leafLight], [28, 25, leafLight], [37, 25, leafLight], [25, 10, cream]]),
  ];
}

function rock(): ToolCall[] {
  return [
    ...shadow(),
    polygon([[7, 34], [10, 23], [18, 17], [30, 18], [39, 26], [37, 36], [28, 40], [13, 39]], ink),
    polygon([[11, 33], [13, 25], [19, 21], [28, 22], [35, 27], [33, 34], [27, 37], [15, 36]], "#65758C"),
    polygon([[16, 25], [20, 22], [28, 23], [31, 27], [22, 28]], "#AFC2C7"),
    pixels([[14, 31, "#8B9DA8"], [19, 34, "#526477"], [29, 29, cream], [33, 32, "#526477"]]),
  ];
}

function lantern(): ToolCall[] {
  return [
    ...shadow(),
    rect(23, 25, 3, 16, ink), rect(19, 39, 11, 3, ink),
    rect(17, 12, 15, 16, ink), rect(20, 15, 9, 10, gold), rect(22, 16, 5, 8, "#FFF0CF"),
    polygon([[19, 12], [21, 7], [28, 7], [31, 12]], ink),
    pixels([[21, 10, water], [28, 10, water], [18, 18, "#D86C74"], [31, 18, "#D86C74"], [24, 29, waterLight]]),
  ];
}

function sign(): ToolCall[] {
  return [
    ...shadow(),
    rect(23, 24, 4, 17, wood), rect(25, 26, 2, 14, "#B2775B"),
    polygon([[8, 11], [40, 11], [37, 26], [11, 26]], ink),
    polygon([[11, 14], [37, 14], [35, 23], [13, 23]], "#F0C98E"),
    rect(15, 17, 17, 2, wood), rect(17, 21, 11, 2, wood),
    pixels([[13, 15, cream], [35, 16, gold], [25, 29, gold]]),
  ];
}

function bridge(): ToolCall[] {
  return [
    ...shadow(),
    rect(5, 17, 38, 20, ink),
    rect(8, 19, 32, 15, wood),
    rect(8, 20, 32, 3, "#B2775B"), rect(8, 27, 32, 3, "#6E483D"),
    rect(12, 18, 3, 17, "#F0C98E"), rect(22, 18, 3, 17, "#F0C98E"), rect(32, 18, 3, 17, "#F0C98E"),
    pixels([[9, 24, gold], [18, 24, gold], [28, 24, gold], [37, 24, gold]]),
  ];
}

function well(): ToolCall[] {
  return [
    ...shadow(),
    circle(24, 29, 13, ink), circle(24, 28, 10, "#65758C"), circle(24, 28, 6, water),
    rect(11, 19, 5, 17, wood), rect(32, 19, 5, 17, wood), rect(14, 16, 20, 4, wood),
    rect(18, 13, 12, 3, ink), polygon([[17, 12], [20, 7], [28, 7], [31, 12]], ink),
    pixels([[16, 25, "#AFC2C7"], [32, 27, "#AFC2C7"], [24, 26, waterLight], [24, 8, gold]]),
  ];
}

const painters = [tree, bush, flowers, rock, lantern, sign, bridge, well] as const;
const frames = [
  { id: "willow_tree", category: "nature", painter: tree },
  { id: "berry_bush", category: "nature", painter: bush },
  { id: "flower_patch", category: "nature", painter: flowers },
  { id: "mossy_rock", category: "nature", painter: rock },
  { id: "wayfinding_lantern", category: "navigation", painter: lantern },
  { id: "wooden_sign", category: "navigation", painter: sign },
  { id: "small_bridge", category: "architecture", painter: bridge },
  { id: "cozy_well", category: "architecture", painter: well },
] as const;

async function run(): Promise<void> {
  await fs.mkdir(libraryRoot, { recursive: true });
  const client = new AsepriteMcpClient({ cwd: process.cwd(), environment: { ASEPRITE_PATH: asepritePath } });
  try {
    const calls: ToolCall[] = [
      call("create_canvas", { filename: sourceFile, width: style.reusableLibrary.frameSize, height: style.reusableLibrary.frameSize }, "Create the reusable 48px asset atlas"),
      call("set_palette", { filename: sourceFile, colors: [...style.palette, deepShadow, wood, "#B2775B", "#65758C", "#AFC2C7", "#FFF0CF"] }, "Lock the high-contrast cozy palette and shadow colors"),
      call("add_frames", { filename: sourceFile, count: style.reusableLibrary.frameCount - 1, duration_ms: 120 }, "Create the reusable atlas frames"),
      call("set_tag", { filename: sourceFile, name: "kit", from_frame: 1, to_frame: style.reusableLibrary.frameCount, direction: "forward" }, "Tag the complete reusable asset kit"),
    ];
    for (let frame = 1; frame <= frames.length; frame += 1) {
      activeFrame = frame;
      calls.push(call("set_frame", { filename: sourceFile, frame_index: frame }, `Select reusable frame ${frame}`));
      calls.push(...painters[frame - 1]!());
    }
    calls.push(call("export_spritesheet", { filename: sourceFile, output_filename: outputFile, sheet_type: "horizontal", scale: style.reusableLibrary.exportScale, padding: 0, tag_name: "kit" }, "Export the reusable nearest-filter atlas"));
    const plan: WorkflowPlan = {
      schemaVersion: 1,
      kind: "scene",
      assetId: style.reusableLibrary.name,
      sourceFile,
      calls,
      exports: [],
      godotManifest: {
        schemaVersion: 1,
        assetId: style.reusableLibrary.name,
        assetType: "scene",
        texture: outputFile,
        frameWidth: style.reusableLibrary.frameSize * style.reusableLibrary.exportScale,
        frameHeight: style.reusableLibrary.frameSize * style.reusableLibrary.exportScale,
        animations: [],
      },
    };
    const results = await client.execute(plan);
    const failures = results.filter((result) => result.includes('"isError":true'));
    if (failures.length > 0) throw new Error(`Aseprite MCP rejected ${plan.assetId}:\n${failures.join("\n")}`);
    await fs.writeFile(manifestFile, JSON.stringify({
      schemaVersion: 1,
      name: style.reusableLibrary.name,
      description: "Reusable cozy pixel-art environment kit with integrated contact shadows.",
      source: "odiseum-cozy-kit.aseprite",
      texture: "odiseum-cozy-kit.png",
      rendering: { filter: "nearest", frameSize: style.reusableLibrary.frameSize, exportScale: style.reusableLibrary.exportScale },
      palette: [...style.palette, deepShadow, wood, "#B2775B", "#65758C", "#AFC2C7", "#FFF0CF"],
      frames: frames.map(({ id, category }, index) => ({ index: index + 1, id, category, hasContactShadow: true })),
      reuse: "Suitable for Odiseum and other original games. Keep the palette and nearest filter for visual consistency.",
    }, null, 2) + "\n", "utf8");
    console.log(JSON.stringify({ pack: style.reusableLibrary.name, atlas: outputFile, manifest: manifestFile, frames: frames.map(({ id }) => id) }, null, 2));
  } finally {
    await client.close();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
