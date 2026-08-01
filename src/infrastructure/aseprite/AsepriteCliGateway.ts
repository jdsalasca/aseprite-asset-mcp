import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { AsepriteGateway, AsepriteResult } from "../../domain/aseprite.js";

const execFileAsync = promisify(execFile);

interface CommandResult {
  ok: boolean;
  output: string;
}

function luaEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n").replaceAll("\r", "\\r").replaceAll("\0", "\\0");
}

function safePath(value: string): string {
  const normalized = path.normalize(value).replaceAll("\\", "/");
  if (normalized.split("/").includes("..")) throw new Error("Parent directory traversal is not allowed");
  return value;
}

function result(command: CommandResult, successMessage: string): AsepriteResult {
  if (command.ok) return { ok: true, message: successMessage };
  return { ok: false, message: command.output || "Aseprite command failed" };
}

export interface AsepriteCliGatewayOptions {
  executable?: string;
  tempDirectory?: string;
}

export class AsepriteCliGateway implements AsepriteGateway {
  private readonly executable: string;
  private readonly tempDirectory: string;

  public constructor(options: AsepriteCliGatewayOptions = {}) {
    this.executable = options.executable ?? process.env.ASEPRITE_PATH ?? "aseprite";
    this.tempDirectory = options.tempDirectory ?? os.tmpdir();
  }

  public async createCanvas(width: number, height: number, filename: string): Promise<AsepriteResult> {
    if (width <= 0 || height <= 0) return { ok: false, message: "Width and height must be > 0" };
    const target = safePath(filename);
    const script = `local spr = Sprite(${width}, ${height})\nspr:saveAs("${luaEscape(target.replaceAll("\\", "/"))}")\nprint("OK")`;
    return result(await this.runLua(script), `Canvas created successfully: ${filename}`);
  }

  public async addGroup(filename: string, groupName: string, parentGroup = ""): Promise<AsepriteResult> {
    const script = this.layerScript(filename, `
      local group = spr:newGroup()
      group.name = "${luaEscape(groupName)}"
      if "${luaEscape(parentGroup)}" ~= "" then
        local parent = find_layer(spr, "${luaEscape(parentGroup)}")
        if not parent or not parent.isGroup then print("ERROR:Parent group not found") return end
        group.parent = parent
      end
    `);
    return result(await this.runLua(script, filename), `Group '${groupName}' created in ${filename}`);
  }

  public async addLayer(filename: string, layerName: string, group = ""): Promise<AsepriteResult> {
    const script = this.layerScript(filename, `
      local parent = nil
      if "${luaEscape(group)}" ~= "" then
        parent = find_layer(spr, "${luaEscape(group)}")
        if not parent or not parent.isGroup then print("ERROR:Group not found") return end
      end
      local layer = spr:newLayer()
      layer.name = "${luaEscape(layerName)}"
      if parent then layer.parent = parent end
    `);
    return result(await this.runLua(script, filename), `Layer '${layerName}' added to ${filename}`);
  }

  public async addFrames(filename: string, count: number, durationMs?: number): Promise<AsepriteResult> {
    if (count < 1) return { ok: false, message: "Count must be >= 1" };
    const duration = durationMs && durationMs > 0 ? `spr.frames[#spr.frames].duration = ${durationMs} / 1000.0` : "";
    const script = this.openScript(filename, `
      for i = 1, ${count} do
        spr:newFrame()
        ${duration}
      end
    `);
    return result(await this.runLua(script, filename), `Added ${count} frames to ${filename}`);
  }

  public async setPalette(filename: string, colors: string[]): Promise<AsepriteResult> {
    if (!colors.length) return { ok: false, message: "Colors list cannot be empty" };
    const luaColors = colors.map((color) => `Color("${luaEscape(color)}")`).join(", ");
    const script = this.openScript(filename, `
      local palette = Palette(0, ${colors.length})
      local colors = {${luaColors}}
      for i, color in ipairs(colors) do palette:setColor(i - 1, color) end
      spr:setPalette(palette)
    `);
    return result(await this.runLua(script, filename), `Palette applied to ${filename}`);
  }

  public async setTag(filename: string, name: string, fromFrame: number, toFrame: number, direction = "forward"): Promise<AsepriteResult> {
    const directions: Record<string, string> = { forward: "AniDir.FORWARD", reverse: "AniDir.REVERSE", pingpong: "AniDir.PING_PONG", pingpong_reverse: "AniDir.PING_PONG_REVERSE" };
    const luaDirection = directions[direction];
    if (!luaDirection) return { ok: false, message: `Unsupported direction: ${direction}` };
    const script = this.openScript(filename, `
      if ${fromFrame} < 1 or ${toFrame} > #spr.frames or ${fromFrame} > ${toFrame} then print("ERROR:Frame range out of bounds") return end
      local tag = nil
      for _, current in ipairs(spr.tags) do if current.name == "${luaEscape(name)}" then tag = current break end end
      if not tag then tag = spr:newTag(${fromFrame}, ${toFrame}) end
      tag.name = "${luaEscape(name)}"
      tag.fromFrame = spr.frames[${fromFrame}]
      tag.toFrame = spr.frames[${toFrame}]
      tag.aniDir = ${luaDirection}
    `);
    return result(await this.runLua(script, filename), `Tag '${name}' set in ${filename}`);
  }

  public async createTilemapLayer(filename: string, layerName: string, tileWidth: number, tileHeight: number): Promise<AsepriteResult> {
    if (tileWidth <= 0 || tileHeight <= 0) return { ok: false, message: "Tile dimensions must be > 0" };
    const script = this.openScript(filename, `
      spr.gridBounds = Rectangle(0, 0, ${tileWidth}, ${tileHeight})
      app.command.NewLayer { tilemap = true }
      app.activeLayer.name = "${luaEscape(layerName)}"
    `);
    return result(await this.runLua(script, filename), `Tilemap layer '${layerName}' created in ${filename}`);
  }

  public async validateScene(filename: string, requiredLayers: string[], startFrame = 1, endFrame?: number): Promise<AsepriteResult> {
    if (!requiredLayers.length) return { ok: false, message: "Required layers list cannot be empty" };
    const layerList = `{${requiredLayers.map((layer) => `"${luaEscape(layer)}"`).join(",")}}`;
    const lastFrame = endFrame ?? "#spr.frames";
    const script = this.openScript(filename, `
      local missing = {}
      for _, name in ipairs(${layerList}) do if not find_layer(spr, name) then table.insert(missing, name) end end
      if #missing > 0 then print("ERROR:Missing layers: " .. table.concat(missing, ", ")) return end
      if ${startFrame} < 1 or ${lastFrame} > #spr.frames or ${startFrame} > ${lastFrame} then print("ERROR:Frame range out of bounds") return end
      print("VALID")
    `);
    return result(await this.runLua(script, filename), `Scene validation passed for ${filename}`);
  }

  public async exportSpritesheet(input: Parameters<AsepriteGateway["exportSpritesheet"]>[0]): Promise<AsepriteResult> {
    const output = safePath(input.outputFilename);
    const args = ["--batch"];
    if (input.tagName) {
      const range = await this.resolveTagRange(input.filename, input.tagName);
      if (!range.ok) return { ok: false, message: range.output };
      args.push("--frame-range", range.output);
    }
    args.push(input.filename, "--sheet-type", input.sheetType ?? "horizontal");
    if ((input.scale ?? 1) > 1) args.push("--scale", String(input.scale));
    if ((input.padding ?? 0) > 0) args.push("--shape-padding", String(input.padding));
    if (input.dataFilename) args.push("--data", safePath(input.dataFilename), "--format", input.dataFormat ?? "json-array");
    if (input.listTags) args.push("--list-tags");
    args.push("--sheet", output);
    const command = await this.run(args);
    return result(command, `Sprite sheet exported to ${output}`);
  }

  private async resolveTagRange(filename: string, tagName: string): Promise<CommandResult> {
    const script = `
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      for _, tag in ipairs(spr.tags) do
        if tag.name == "${luaEscape(tagName)}" then
          print("RANGE:" .. (tag.fromFrame.frameNumber - 1) .. "," .. (tag.toFrame.frameNumber - 1))
          return
        end
      end
      print("ERROR:Tag not found")
    `;
    const command = await this.runLua(script, filename);
    if (!command.ok) return command;
    const line = command.output.split(/\r?\n/).find((entry) => entry.startsWith("RANGE:"));
    return line ? { ok: true, output: line.slice("RANGE:".length) } : { ok: false, output: "Tag range was not returned by Aseprite" };
  }

  private layerScript(filename: string, body: string): string {
    return this.openScript(filename, body);
  }

  private openScript(filename: string, body: string): string {
    return `
      local function find_layer(parent, name)
        for _, layer in ipairs(parent.layers) do
          if layer.name == name then return layer end
          if layer.isGroup then local nested = find_layer(layer, name) if nested then return nested end end
        end
        return nil
      end
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      app.transaction(function() ${body} end)
      spr:saveAs(spr.filename)
      print("OK")
    `;
  }

  private async runLua(script: string, filename?: string): Promise<CommandResult> {
    const temporary = path.join(this.tempDirectory, `aseprite-mcp-${Date.now()}-${Math.random().toString(16).slice(2)}.lua`);
    await fs.writeFile(temporary, script, "utf8");
    try {
      const args = ["--batch"];
      if (filename) args.push(filename);
      args.push("--script", temporary);
      return await this.run(args);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }

  private async run(args: string[]): Promise<CommandResult> {
    try {
      const output = await execFileAsync(this.executable, args, { windowsHide: true, maxBuffer: 1024 * 1024 });
      const text = `${output.stdout ?? ""}${output.stderr ?? ""}`;
      const error = text.split(/\r?\n/).find((line) => line.startsWith("ERROR:"));
      return error ? { ok: false, output: error.slice("ERROR:".length) } : { ok: true, output: text };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, output: message };
    }
  }
}
