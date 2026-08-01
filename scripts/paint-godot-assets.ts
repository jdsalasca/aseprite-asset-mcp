import path from "node:path";
import { AsepriteMcpClient } from "../src/workflows/mcp-client.js";
import type { ToolCall, WorkflowPlan } from "../src/workflows/types.js";

const outputRoot = "C:/Users/jdsal/Documents/Programming-personal/odiseum/art/generated";

function call(name: string, args: Record<string, unknown>, purpose: string): ToolCall {
  return { name, arguments: args, purpose };
}

function plan(assetId: string, sourceFile: string, calls: ToolCall[]): WorkflowPlan {
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
      texture: sourceFile.replace(/\.aseprite$/i, ".png"),
      frameWidth: 48,
      frameHeight: 48,
      animations: [],
    },
  };
}

function assertSuccessful(results: string[]): void {
  const failures = results.filter((result) => result.includes('"isError":true'));
  if (failures.length) throw new Error(`Aseprite painting failed:\n${failures.join("\n")}`);
}

const client = new AsepriteMcpClient({ cwd: process.cwd() });
try {
  const heroFile = path.join(outputRoot, "moonbound-hero", "moonbound-hero.aseprite");
  const heroCalls = [
    call("draw_rectangle", { filename: heroFile, x: 18, y: 22, width: 12, height: 16, color: "#6CE1D2", fill: true }, "Paint the hero body"),
    call("draw_rectangle", { filename: heroFile, x: 16, y: 10, width: 16, height: 16, color: "#F6C3A2", fill: true }, "Paint the hero face"),
    call("draw_rectangle", { filename: heroFile, x: 13, y: 6, width: 22, height: 5, color: "#27335F", fill: true }, "Paint the hero cap"),
    call("draw_rectangle", { filename: heroFile, x: 19, y: 16, width: 2, height: 2, color: "#27335F", fill: true }, "Paint the left eye"),
    call("draw_rectangle", { filename: heroFile, x: 27, y: 16, width: 2, height: 2, color: "#27335F", fill: true }, "Paint the right eye"),
    call("draw_rectangle", { filename: heroFile, x: 15, y: 38, width: 7, height: 4, color: "#394C82", fill: true }, "Paint the left boot"),
    call("draw_rectangle", { filename: heroFile, x: 26, y: 38, width: 7, height: 4, color: "#394C82", fill: true }, "Paint the right boot"),
    call("export_spritesheet", { filename: heroFile, output_filename: heroFile.replace(/\.aseprite$/i, ".png"), sheet_type: "horizontal", scale: 1, padding: 0, list_tags: true }, "Export the painted hero sprite"),
  ];

  const shardFile = path.join(outputRoot, "moon-shard", "moon-shard.aseprite");
  const shardCalls = [
    call("create_canvas", { width: 16, height: 16, filename: shardFile }, "Create the moon shard canvas"),
    call("set_palette", { filename: shardFile, colors: ["#101820", "#F5D76E", "#FFF4B0"] }, "Apply the moon shard palette"),
    call("draw_rectangle", { filename: shardFile, x: 6, y: 2, width: 4, height: 12, color: "#F5D76E", fill: true }, "Paint the shard vertical body"),
    call("draw_rectangle", { filename: shardFile, x: 2, y: 6, width: 12, height: 4, color: "#F5D76E", fill: true }, "Paint the shard horizontal body"),
    call("draw_rectangle", { filename: shardFile, x: 6, y: 5, width: 4, height: 5, color: "#FFF4B0", fill: true }, "Paint the shard highlight"),
    call("export_spritesheet", { filename: shardFile, output_filename: shardFile.replace(/\.aseprite$/i, ".png"), sheet_type: "horizontal", scale: 2 }, "Export the moon shard sprite"),
  ];

  const sceneFile = path.join(outputRoot, "moonbound-heights", "moonbound-heights.aseprite");
  const sceneCalls = [
    call("draw_rectangle", { filename: sceneFile, x: 0, y: 0, width: 320, height: 180, color: "#171B4A", fill: true }, "Paint the scene sky layer"),
    call("draw_rectangle", { filename: sceneFile, x: 0, y: 112, width: 320, height: 68, color: "#394C82", fill: true }, "Paint the distant terrain"),
    call("draw_rectangle", { filename: sceneFile, x: 32, y: 96, width: 64, height: 8, color: "#6D78B0", fill: true }, "Paint a scene platform"),
    call("draw_rectangle", { filename: sceneFile, x: 192, y: 72, width: 64, height: 8, color: "#8B6BA8", fill: true }, "Paint a high scene platform"),
    call("export_spritesheet", { filename: sceneFile, output_filename: sceneFile.replace(/\.aseprite$/i, ".png"), sheet_type: "horizontal", scale: 2 }, "Export the painted scene texture"),
  ];

  const heroResults = await client.execute(plan("moonbound-hero", heroFile, heroCalls));
  assertSuccessful(heroResults);
  const shardResults = await client.execute(plan("moon-shard", shardFile, shardCalls));
  assertSuccessful(shardResults);
  const sceneResults = await client.execute(plan("moonbound-heights", sceneFile, sceneCalls));
  assertSuccessful(sceneResults);
  console.log(JSON.stringify({ hero: heroResults.length, shard: shardResults.length, scene: sceneResults.length, outputRoot }, null, 2));
} finally {
  await client.close();
}
