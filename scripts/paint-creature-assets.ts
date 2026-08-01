import path from "node:path";
import { AsepriteMcpClient } from "../src/workflows/mcp-client.js";
import type { ToolCall, WorkflowPlan } from "../src/workflows/types.js";

const root = "C:/Users/jdsal/Documents/Programming-personal/odiseum/art/creatures";
const uiRoot = "C:/Users/jdsal/Documents/Programming-personal/odiseum/art/ui";

function call(name: string, args: Record<string, unknown>, purpose: string): ToolCall {
  return { name, arguments: args, purpose };
}

function workflow(assetId: string, sourceFile: string, calls: ToolCall[], width = 32, height = 32): WorkflowPlan {
  return {
    schemaVersion: 1,
    kind: "character",
    assetId,
    sourceFile,
    calls,
    exports: [],
    godotManifest: { schemaVersion: 1, assetId, assetType: "character", texture: sourceFile.replace(/\.aseprite$/i, ".png"), frameWidth: width, frameHeight: height, animations: [{ name: "idle", fromFrame: 1, toFrame: 3, loop: true }] },
  };
}

function paintCreature(client: AsepriteMcpClient, input: {
  id: string;
  palette: string[];
  frameOne: ToolCall[];
  frameTwo: ToolCall[];
  frameThree: ToolCall[];
}): Promise<string[]> {
  const sourceFile = path.join(root, input.id, `${input.id}.aseprite`);
  const frameCalls = (frame: number, calls: ToolCall[]): ToolCall[] => [
    call("set_frame", { filename: sourceFile, frame_index: frame }, `Select idle frame ${frame}`),
    ...calls.map((item) => ({ ...item, arguments: { ...item.arguments, filename: sourceFile } })),
  ];
  const calls = [
    call("create_canvas", { width: 32, height: 32, filename: sourceFile }, "Create the creature canvas"),
    call("set_palette", { filename: sourceFile, colors: input.palette }, "Apply the creature palette"),
    call("add_frames", { filename: sourceFile, count: 2, duration_ms: 220 }, "Create three idle animation frames"),
    call("set_tag", { filename: sourceFile, name: "idle", from_frame: 1, to_frame: 3, direction: "pingpong" }, "Create the idle animation tag"),
    ...frameCalls(1, input.frameOne),
    ...frameCalls(2, input.frameTwo),
    ...frameCalls(3, input.frameThree),
    call("export_spritesheet", { filename: sourceFile, output_filename: sourceFile.replace(/\.aseprite$/i, ".png"), sheet_type: "horizontal", scale: 2, padding: 1, tag_name: "idle", list_tags: true }, "Export the animated creature sprite"),
  ];
  return client.execute(workflow(input.id, sourceFile, calls));
}

function box(x: number, y: number, width: number, height: number, color: string): ToolCall {
  return call("draw_rectangle", { x, y, width, height, color, fill: true }, "Paint creature pixel block");
}

const client = new AsepriteMcpClient({ cwd: process.cwd() });
try {
  const creatures = [
    {
      id: "embercub",
      palette: ["#17152E", "#F26A4F", "#FFB45B", "#FFE4A3"],
      frameOne: [box(10, 10, 12, 12, "#F26A4F"), box(8, 6, 16, 9, "#FFB45B"), box(11, 4, 4, 4, "#F26A4F"), box(17, 4, 4, 4, "#F26A4F"), box(12, 10, 2, 2, "#17152E"), box(20, 10, 2, 2, "#17152E"), box(12, 22, 3, 4, "#F26A4F"), box(18, 22, 3, 4, "#F26A4F")],
      frameTwo: [box(10, 9, 12, 13, "#F26A4F"), box(8, 5, 16, 9, "#FFB45B"), box(11, 3, 4, 4, "#F26A4F"), box(17, 3, 4, 4, "#F26A4F"), box(12, 9, 2, 2, "#17152E"), box(20, 9, 2, 2, "#17152E"), box(11, 22, 3, 4, "#F26A4F"), box(19, 22, 3, 4, "#F26A4F")],
      frameThree: [box(10, 10, 12, 12, "#F26A4F"), box(8, 6, 16, 9, "#FFB45B"), box(11, 4, 4, 4, "#F26A4F"), box(17, 4, 4, 4, "#F26A4F"), box(12, 10, 2, 2, "#17152E"), box(20, 10, 2, 2, "#17152E"), box(12, 23, 3, 3, "#F26A4F"), box(18, 23, 3, 3, "#F26A4F")],
    },
    {
      id: "mossprout",
      palette: ["#17152E", "#3C8D68", "#8FD694", "#D8F3DC"],
      frameOne: [box(10, 13, 12, 12, "#3C8D68"), box(8, 9, 16, 8, "#8FD694"), box(12, 5, 3, 6, "#3C8D68"), box(17, 4, 3, 7, "#3C8D68"), box(12, 13, 2, 2, "#17152E"), box(20, 13, 2, 2, "#17152E"), box(11, 24, 4, 3, "#3C8D68"), box(17, 24, 4, 3, "#3C8D68")],
      frameTwo: [box(10, 12, 12, 13, "#3C8D68"), box(8, 8, 16, 8, "#8FD694"), box(11, 4, 3, 7, "#3C8D68"), box(18, 5, 3, 6, "#3C8D68"), box(12, 12, 2, 2, "#17152E"), box(20, 12, 2, 2, "#17152E"), box(10, 24, 4, 3, "#3C8D68"), box(18, 24, 4, 3, "#3C8D68")],
      frameThree: [box(10, 13, 12, 12, "#3C8D68"), box(8, 9, 16, 8, "#8FD694"), box(12, 5, 3, 6, "#3C8D68"), box(17, 4, 3, 7, "#3C8D68"), box(12, 13, 2, 2, "#17152E"), box(20, 13, 2, 2, "#17152E"), box(11, 24, 4, 3, "#3C8D68"), box(17, 24, 4, 3, "#3C8D68")],
    },
    {
      id: "tidefin",
      palette: ["#17152E", "#3977B8", "#6ED0E8", "#C9F4FF"],
      frameOne: [box(10, 12, 12, 12, "#3977B8"), box(8, 8, 16, 8, "#6ED0E8"), box(12, 5, 3, 5, "#3977B8"), box(18, 4, 3, 6, "#3977B8"), box(12, 12, 2, 2, "#17152E"), box(20, 12, 2, 2, "#17152E"), box(8, 18, 4, 3, "#6ED0E8"), box(21, 18, 5, 3, "#6ED0E8")],
      frameTwo: [box(10, 11, 12, 13, "#3977B8"), box(8, 7, 16, 8, "#6ED0E8"), box(11, 4, 3, 5, "#3977B8"), box(18, 5, 3, 5, "#3977B8"), box(12, 11, 2, 2, "#17152E"), box(20, 11, 2, 2, "#17152E"), box(7, 18, 5, 3, "#6ED0E8"), box(21, 18, 6, 3, "#6ED0E8")],
      frameThree: [box(10, 12, 12, 12, "#3977B8"), box(8, 8, 16, 8, "#6ED0E8"), box(12, 5, 3, 5, "#3977B8"), box(18, 4, 3, 6, "#3977B8"), box(12, 12, 2, 2, "#17152E"), box(20, 12, 2, 2, "#17152E"), box(8, 18, 4, 3, "#6ED0E8"), box(21, 18, 5, 3, "#6ED0E8")],
    },
    {
      id: "lunabun",
      palette: ["#17152E", "#8066B5", "#D3A7E8", "#FFF0CF"],
      frameOne: [box(10, 12, 12, 12, "#8066B5"), box(8, 7, 16, 9, "#D3A7E8"), box(9, 2, 4, 8, "#8066B5"), box(19, 2, 4, 8, "#8066B5"), box(12, 11, 2, 2, "#17152E"), box(20, 11, 2, 2, "#17152E"), box(12, 17, 8, 3, "#FFF0CF"), box(11, 23, 4, 3, "#8066B5"), box(17, 23, 4, 3, "#8066B5")],
      frameTwo: [box(10, 11, 12, 13, "#8066B5"), box(8, 6, 16, 9, "#D3A7E8"), box(8, 1, 4, 8, "#8066B5"), box(20, 1, 4, 8, "#8066B5"), box(12, 10, 2, 2, "#17152E"), box(20, 10, 2, 2, "#17152E"), box(12, 16, 8, 3, "#FFF0CF"), box(11, 23, 4, 3, "#8066B5"), box(17, 23, 4, 3, "#8066B5")],
      frameThree: [box(10, 12, 12, 12, "#8066B5"), box(8, 7, 16, 9, "#D3A7E8"), box(9, 2, 4, 8, "#8066B5"), box(19, 2, 4, 8, "#8066B5"), box(12, 11, 2, 2, "#17152E"), box(20, 11, 2, 2, "#17152E"), box(12, 17, 8, 3, "#FFF0CF"), box(11, 23, 4, 3, "#8066B5"), box(17, 23, 4, 3, "#8066B5")],
    },
    {
      id: "pebblit",
      palette: ["#17152E", "#65758C", "#AFC2C7", "#F0C98E"],
      frameOne: [box(9, 12, 14, 12, "#65758C"), box(7, 8, 18, 8, "#AFC2C7"), box(10, 5, 4, 5, "#65758C"), box(18, 5, 4, 5, "#65758C"), box(11, 12, 2, 2, "#17152E"), box(21, 12, 2, 2, "#17152E"), box(12, 19, 3, 4, "#F0C98E"), box(18, 19, 3, 4, "#F0C98E")],
      frameTwo: [box(9, 11, 14, 13, "#65758C"), box(7, 7, 18, 8, "#AFC2C7"), box(9, 4, 4, 5, "#65758C"), box(19, 4, 4, 5, "#65758C"), box(11, 11, 2, 2, "#17152E"), box(21, 11, 2, 2, "#17152E"), box(11, 19, 3, 4, "#F0C98E"), box(19, 19, 3, 4, "#F0C98E")],
      frameThree: [box(9, 12, 14, 12, "#65758C"), box(7, 8, 18, 8, "#AFC2C7"), box(10, 5, 4, 5, "#65758C"), box(18, 5, 4, 5, "#65758C"), box(11, 12, 2, 2, "#17152E"), box(21, 12, 2, 2, "#17152E"), box(12, 19, 3, 4, "#F0C98E"), box(18, 19, 3, 4, "#F0C98E")],
    },
  ];

  for (const creature of creatures) {
    const results = await paintCreature(client, creature);
    if (results.some((result) => result.includes('"isError":true'))) throw new Error(`Failed to paint ${creature.id}`);
  }

  const trainerFile = path.join(root, "trail-runner", "trail-runner.aseprite");
  const trainerCalls = [
    call("create_canvas", { width: 24, height: 32, filename: trainerFile }, "Create the trail runner canvas"),
    call("set_palette", { filename: trainerFile, colors: ["#17152E", "#6CE1D2", "#F6C3A2", "#27335F"] }, "Apply the trainer palette"),
    call("add_frames", { filename: trainerFile, count: 1, duration_ms: 180 }, "Create the walking animation frame"),
    call("set_tag", { filename: trainerFile, name: "walk", from_frame: 1, to_frame: 2, direction: "pingpong" }, "Create the walking tag"),
    call("set_frame", { filename: trainerFile, frame_index: 1 }, "Select trainer frame one"),
    box(7, 12, 10, 13, "#6CE1D2"), box(5, 5, 14, 10, "#F6C3A2"), box(4, 2, 16, 4, "#27335F"), box(7, 25, 4, 5, "#27335F"), box(13, 25, 4, 5, "#27335F"),
    call("set_frame", { filename: trainerFile, frame_index: 2 }, "Select trainer frame two"),
    box(7, 12, 10, 13, "#6CE1D2"), box(5, 5, 14, 10, "#F6C3A2"), box(4, 2, 16, 4, "#27335F"), box(6, 25, 4, 5, "#27335F"), box(14, 25, 4, 5, "#27335F"),
    call("export_spritesheet", { filename: trainerFile, output_filename: trainerFile.replace(/\.aseprite$/i, ".png"), sheet_type: "horizontal", scale: 2, padding: 1, tag_name: "walk" }, "Export the trail runner sprite"),
  ];
  const normalizedTrainerCalls = trainerCalls.map((item) => item.name === "draw_rectangle"
    ? { ...item, arguments: { ...item.arguments, filename: trainerFile } }
    : item);
  const trainerResults = await client.execute(workflow("trail-runner", trainerFile, normalizedTrainerCalls, 24, 32));
  if (trainerResults.some((result) => result.includes('"isError":true'))) throw new Error("Failed to paint trail runner");

  const orbFile = path.join(uiRoot, "capture-orb.aseprite");
  const orbCalls = [
    call("create_canvas", { width: 16, height: 16, filename: orbFile }, "Create the capture orb icon"),
    call("set_palette", { filename: orbFile, colors: ["#17152E", "#F5D76E", "#F7F2E5", "#7F76C2"] }, "Apply the cozy UI palette"),
    box(3, 2, 10, 12, "#17152E"),
    box(4, 3, 8, 5, "#F7F2E5"),
    box(4, 8, 8, 5, "#7F76C2"),
    box(7, 7, 2, 2, "#F5D76E"),
    call("export_spritesheet", { filename: orbFile, output_filename: orbFile.replace(/\.aseprite$/i, ".png"), sheet_type: "horizontal", scale: 3, padding: 1 }, "Export the capture orb icon"),
  ].map((item) => item.name === "draw_rectangle" ? { ...item, arguments: { ...item.arguments, filename: orbFile } } : item);
  const orbResults = await client.execute({
    schemaVersion: 1,
    kind: "character",
    assetId: "capture-orb",
    sourceFile: orbFile,
    calls: orbCalls,
    exports: [],
    godotManifest: { schemaVersion: 1, assetId: "capture-orb", assetType: "character", texture: orbFile.replace(/\.aseprite$/i, ".png"), frameWidth: 16, frameHeight: 16, animations: [] },
  });
  if (orbResults.some((result) => result.includes('"isError":true'))) throw new Error("Failed to paint capture orb");
  console.log(JSON.stringify({ creatures: creatures.map((creature) => creature.id), trainer: "trail-runner", ui: ["capture-orb"], root, uiRoot }, null, 2));
} finally {
  await client.close();
}
