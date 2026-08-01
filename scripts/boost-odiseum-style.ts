import path from "node:path";
import { AsepriteMcpClient } from "../src/workflows/mcp-client.js";
import { buildOdiseumStyleManifest } from "../src/workflows/odiseum-style.js";
import type { ToolCall, WorkflowPlan } from "../src/workflows/types.js";

const gameRoot = "C:/Users/jdsal/Documents/Programming-personal/odiseum";
const creatureRoot = path.join(gameRoot, "art/creatures");
const uiRoot = path.join(gameRoot, "art/ui");
const style = buildOdiseumStyleManifest();
const asepritePath = process.env.ASEPRITE_PATH ?? "C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe";
let activeFrame = 1;

function call(name: string, args: Record<string, unknown>, purpose: string): ToolCall {
  return { name, arguments: args, purpose };
}

function rect(filename: string, x: number, y: number, width: number, height: number, color: string): ToolCall {
  return call("draw_rectangle_at", { filename, layer_name: "Layer 1", frame_index: activeFrame, x, y, width, height, color, fill: true, create_if_missing: true }, "Paint a crisp pixel-art block");
}

function polygon(filename: string, points: Array<[number, number]>, color: string): ToolCall {
  return call("draw_polygon", { filename, layer_name: "Layer 1", frame_index: activeFrame, points: points.map(([x, y]) => ({ x, y })), color, fill: true, create_if_missing: true }, "Paint a hand-shaped pixel-art silhouette");
}

function circle(filename: string, centerX: number, centerY: number, radius: number, color: string): ToolCall {
  return call("draw_circle", { filename, center_x: centerX, center_y: centerY, radius, color, fill: true }, "Paint a soft pixel-art highlight");
}

function pixels(filename: string, points: Array<[number, number, string]>): ToolCall {
  return call("draw_pixels_at", { filename, layer_name: "Layer 1", frame_index: activeFrame, pixels: points.map(([x, y, color]) => ({ x, y, color })), create_if_missing: true }, "Add readable one-pixel character details");
}

type FramePainter = (filename: string, bob: number) => ToolCall[];

function characterPlan(assetId: string, width: number, height: number, palette: readonly string[], painter: FramePainter): WorkflowPlan {
  const sourceFile = path.join(creatureRoot, assetId, `${assetId}.aseprite`);
  const output = sourceFile.replace(/\.aseprite$/i, ".png");
  const calls: ToolCall[] = [
    call("create_canvas", { filename: sourceFile, width, height }, "Create the polished pixel-art source"),
    call("set_palette", { filename: sourceFile, colors: [...palette] }, "Lock the shared Odiseum cozy palette"),
    call("add_frames", { filename: sourceFile, count: 3, duration_ms: 150 }, "Create four gentle idle frames"),
    call("set_tag", { filename: sourceFile, name: "idle", from_frame: 1, to_frame: 4, direction: "pingpong" }, "Expose the idle loop to Godot"),
  ];
  for (let frame = 1; frame <= 4; frame += 1) {
    activeFrame = frame;
    const bob = [0, -1, -2, -1][frame - 1] ?? 0;
    calls.push(call("set_frame", { filename: sourceFile, frame_index: frame }, `Select idle frame ${frame}`));
    calls.push(...painter(sourceFile, bob));
  }
  calls.push(call("export_spritesheet", {
    filename: sourceFile,
    output_filename: output,
    sheet_type: "horizontal",
    scale: style.pixelScale,
    padding: 1,
    tag_name: "idle",
    list_tags: true,
  }, "Export a Godot-ready nearest-filter spritesheet"));
  return {
    schemaVersion: 1,
    kind: "character",
    assetId,
    sourceFile,
    calls,
    exports: [],
    godotManifest: {
      schemaVersion: 1,
      assetId,
      assetType: "character",
      texture: output,
      frameWidth: width,
      frameHeight: height,
      animations: [{ name: "idle", fromFrame: 1, toFrame: 4, loop: true }],
    },
  };
}

const ink = "#17152E";
const cream = "#F7F2E5";

function embercub(filename: string, bob: number): ToolCall[] {
  return [
    polygon(filename, [[8, 13 + bob], [10, 8 + bob], [12, 7 + bob], [11, 3 + bob], [15, 6 + bob], [18, 6 + bob], [21, 3 + bob], [21, 9 + bob], [24, 13 + bob], [23, 23 + bob], [19, 27 + bob], [11, 27 + bob], [7, 22 + bob]], ink),
    polygon(filename, [[10, 14 + bob], [11, 10 + bob], [13, 9 + bob], [12, 7 + bob], [15, 9 + bob], [18, 9 + bob], [20, 7 + bob], [20, 11 + bob], [22, 14 + bob], [21, 22 + bob], [18, 25 + bob], [12, 25 + bob], [9, 21 + bob]], "#D86C74"),
    rect(filename, 11, 10 + bob, 10, 6, "#F6C3A2"),
    rect(filename, 12, 17 + bob, 8, 5, "#F26A4F"),
    rect(filename, 12, 12 + bob, 2, 2, ink), rect(filename, 18, 12 + bob, 2, 2, ink),
    rect(filename, 13, 15 + bob, 1, 1, cream), rect(filename, 18, 15 + bob, 1, 1, cream),
    polygon(filename, [[22, 18 + bob], [28, 16 + bob], [25, 21 + bob], [29, 23 + bob], [22, 23 + bob]], "#F5D76E"),
    rect(filename, 10, 24 + bob, 4, 3, "#F26A4F"), rect(filename, 19, 24 + bob, 4, 3, "#F26A4F"),
  ];
}

function mossprout(filename: string, bob: number): ToolCall[] {
  return [
    polygon(filename, [[8, 14 + bob], [10, 10 + bob], [12, 9 + bob], [11, 4 + bob], [15, 7 + bob], [18, 3 + bob], [19, 8 + bob], [23, 5 + bob], [22, 11 + bob], [25, 15 + bob], [23, 25 + bob], [10, 25 + bob]], ink),
    polygon(filename, [[10, 15 + bob], [12, 11 + bob], [22, 11 + bob], [23, 15 + bob], [21, 23 + bob], [12, 23 + bob]], "#3C8D68"),
    polygon(filename, [[12, 10 + bob], [12, 6 + bob], [15, 9 + bob], [18, 5 + bob], [18, 10 + bob], [21, 7 + bob], [21, 11 + bob]], "#8FD694"),
    rect(filename, 11, 12 + bob, 12, 6, "#BCE8D2"),
    rect(filename, 13, 14 + bob, 2, 2, ink), rect(filename, 19, 14 + bob, 2, 2, ink),
    rect(filename, 15, 18 + bob, 4, 2, "#D8F3DC"),
    rect(filename, 11, 23 + bob, 5, 3, "#3C8D68"), rect(filename, 18, 23 + bob, 5, 3, "#3C8D68"),
  ];
}

function tidefin(filename: string, bob: number): ToolCall[] {
  return [
    polygon(filename, [[7, 14 + bob], [10, 9 + bob], [14, 8 + bob], [18, 9 + bob], [22, 7 + bob], [23, 12 + bob], [28, 10 + bob], [24, 16 + bob], [23, 23 + bob], [18, 26 + bob], [11, 25 + bob], [7, 21 + bob]], ink),
    polygon(filename, [[9, 14 + bob], [11, 11 + bob], [18, 11 + bob], [21, 10 + bob], [21, 15 + bob], [25, 13 + bob], [22, 18 + bob], [21, 22 + bob], [18, 24 + bob], [12, 23 + bob], [9, 20 + bob]], "#3977B8"),
    polygon(filename, [[12, 11 + bob], [15, 8 + bob], [18, 11 + bob], [21, 9 + bob], [20, 14 + bob], [11, 15 + bob]], "#6ED0E8"),
    rect(filename, 12, 13 + bob, 10, 5, "#C9F4FF"),
    rect(filename, 14, 15 + bob, 2, 2, ink), rect(filename, 20, 14 + bob, 2, 2, ink),
    pixels(filename, [[10, 19 + bob, "#C9F4FF"], [12, 20 + bob, "#C9F4FF"], [24, 19 + bob, "#6ED0E8"], [26, 17 + bob, "#6ED0E8"]]),
  ];
}

function lunabun(filename: string, bob: number): ToolCall[] {
  return [
    polygon(filename, [[8, 13 + bob], [8, 3 + bob], [12, 7 + bob], [20, 7 + bob], [24, 3 + bob], [24, 14 + bob], [22, 23 + bob], [18, 27 + bob], [12, 27 + bob], [8, 23 + bob]], ink),
    polygon(filename, [[10, 13 + bob], [10, 6 + bob], [13, 9 + bob], [19, 9 + bob], [22, 6 + bob], [22, 14 + bob], [20, 22 + bob], [17, 25 + bob], [13, 25 + bob], [10, 21 + bob]], "#8066B5"),
    rect(filename, 11, 11 + bob, 10, 7, "#D3A7E8"),
    rect(filename, 13, 13 + bob, 2, 2, ink), rect(filename, 19, 13 + bob, 2, 2, ink),
    polygon(filename, [[15, 18 + bob], [18, 16 + bob], [20, 19 + bob], [18, 21 + bob]], "#FFF0CF"),
    rect(filename, 11, 24 + bob, 5, 3, "#8066B5"), rect(filename, 18, 24 + bob, 5, 3, "#8066B5"),
  ];
}

function pebblit(filename: string, bob: number): ToolCall[] {
  return [
    polygon(filename, [[7, 15 + bob], [10, 9 + bob], [14, 7 + bob], [19, 8 + bob], [24, 11 + bob], [26, 18 + bob], [22, 25 + bob], [12, 26 + bob], [7, 21 + bob]], ink),
    polygon(filename, [[9, 15 + bob], [11, 11 + bob], [15, 9 + bob], [19, 10 + bob], [23, 12 + bob], [24, 18 + bob], [21, 23 + bob], [13, 24 + bob], [9, 20 + bob]], "#65758C"),
    polygon(filename, [[11, 12 + bob], [15, 10 + bob], [19, 11 + bob], [16, 16 + bob], [12, 16 + bob]], "#AFC2C7"),
    rect(filename, 12, 15 + bob, 11, 6, "#AFC2C7"),
    rect(filename, 14, 17 + bob, 2, 2, ink), rect(filename, 20, 17 + bob, 2, 2, ink),
    rect(filename, 16, 20 + bob, 4, 2, "#F0C98E"),
    pixels(filename, [[10, 20 + bob, "#F0C98E"], [23, 20 + bob, "#F0C98E"], [19, 12 + bob, "#F0C98E"]]),
  ];
}

function paintTrainer(filename: string, bob: number): ToolCall[] {
  return [
    polygon(filename, [[6, 11 + bob], [8, 5 + bob], [16, 5 + bob], [19, 11 + bob], [18, 23 + bob], [15, 27 + bob], [9, 27 + bob], [6, 23 + bob]], ink),
    rect(filename, 8, 11 + bob, 10, 12, "#6CE1D2"),
    rect(filename, 8, 6 + bob, 10, 8, "#F6C3A2"),
    rect(filename, 6, 3 + bob, 14, 4, "#27335F"), rect(filename, 8, 1 + bob, 8, 3, "#3D5A80"),
    rect(filename, 10, 10 + bob, 2, 2, ink), rect(filename, 15, 10 + bob, 2, 2, ink),
    rect(filename, 8, 23 + bob, 4, 5, "#27335F"), rect(filename, 15, 23 + bob, 4, 5, "#27335F"),
    pixels(filename, [[9, 15 + bob, "#F7F2E5"], [16, 15 + bob, "#F7F2E5"]]),
  ];
}

function paintTransitionFrame(filename: string, frame: number): ToolCall[] {
  activeFrame = frame;
  const shapes: ToolCall[] = [call("set_frame", { filename, frame_index: frame }, `Select transition frame ${frame}`)];
  const points = [
    [[15, 1], [17, 7], [23, 9], [18, 12], [19, 18], [15, 14], [10, 18], [11, 12], [6, 9], [12, 7]],
    [[11, 0], [19, 0], [19, 5], [24, 5], [24, 13], [19, 13], [19, 18], [11, 18], [11, 13], [6, 13], [6, 5], [11, 5]],
    [[4, 0], [28, 0], [28, 18], [4, 18]],
    [[0, 0], [32, 0], [32, 18], [0, 18]],
  ] as Array<Array<[number, number]>>;
  shapes.push(polygon(filename, points[frame - 1] ?? points[0]!, frame === 4 ? "#17152E" : "#27335F"));
  if (frame < 4) shapes.push(pixels(filename, [[15, 8, "#F5D76E"], [16, 8, "#F5D76E"], [15, 9, "#F7F2E5"], [16, 9, "#F7F2E5"]]));
  return shapes;
}

async function run(): Promise<void> {
  const client = new AsepriteMcpClient({ cwd: process.cwd(), environment: { ASEPRITE_PATH: asepritePath } });
  try {
    const executeChecked = async (plan: WorkflowPlan): Promise<void> => {
      const results = await client.execute(plan);
      const failures = results.filter((result) => result.includes('"isError":true'));
      if (failures.length > 0) throw new Error(`Aseprite MCP rejected ${plan.assetId}:\n${failures.join("\n")}`);
    };
    const assets: Array<[string, number, number, readonly string[], FramePainter]> = [
      ["embercub", 32, 32, [ink, "#D86C74", "#F26A4F", "#F6C3A2", "#F5D76E", cream], embercub],
      ["mossprout", 32, 32, [ink, "#3C8D68", "#8FD694", "#BCE8D2", "#D8F3DC", cream], mossprout],
      ["tidefin", 32, 32, [ink, "#3977B8", "#6ED0E8", "#C9F4FF", "#3D5A80", cream], tidefin],
      ["lunabun", 32, 32, [ink, "#8066B5", "#D3A7E8", "#FFF0CF", "#F5D76E", cream], lunabun],
      ["pebblit", 32, 32, [ink, "#65758C", "#AFC2C7", "#F0C98E", "#3D5A80", cream], pebblit],
      ["trail-runner", 24, 32, [ink, "#6CE1D2", "#F6C3A2", "#27335F", "#3D5A80", cream], paintTrainer],
    ];
    for (const [assetId, width, height, palette, painter] of assets) await executeChecked(characterPlan(assetId, width, height, palette, painter));

    const transitionFile = path.join(uiRoot, "travel-spark.aseprite");
    const transitionCalls: ToolCall[] = [
      call("create_canvas", { filename: transitionFile, width: 32, height: 18 }, "Create the pixel travel transition source"),
      call("set_palette", { filename: transitionFile, colors: [...style.palette] }, "Use the shared Odiseum palette for transitions"),
      call("add_frames", { filename: transitionFile, count: 3, duration_ms: 90 }, "Create the four-frame travel wipe"),
      call("set_tag", { filename: transitionFile, name: "travel", from_frame: 1, to_frame: 4, direction: "forward" }, "Expose the travel animation to Godot"),
      ...[1, 2, 3, 4].flatMap((frame) => paintTransitionFrame(transitionFile, frame)),
      call("export_spritesheet", { filename: transitionFile, output_filename: transitionFile.replace(/\.aseprite$/i, ".png"), sheet_type: "horizontal", scale: 3, padding: 0, tag_name: "travel" }, "Export the pixel travel transition"),
    ];
    await executeChecked({
      schemaVersion: 1,
      kind: "character",
      assetId: "travel-spark",
      sourceFile: transitionFile,
      calls: transitionCalls,
      exports: [],
      godotManifest: { schemaVersion: 1, assetId: "travel-spark", assetType: "character", texture: transitionFile.replace(/\.aseprite$/i, ".png"), frameWidth: 32, frameHeight: 18, animations: [{ name: "travel", fromFrame: 1, toFrame: 4, loop: false }] },
    });
    console.log(JSON.stringify({ style: "odiseum-cozy-pixel", assets: assets.map(([id]) => id), transition: "travel-spark", palette: style.palette }, null, 2));
  } finally {
    await client.close();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
