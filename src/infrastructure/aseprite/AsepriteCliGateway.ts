import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { AsepriteGateway, AsepriteResult, PixelInput } from "../../domain/aseprite.js";

const execFileAsync = promisify(execFile);

interface CommandResult {
  ok: boolean;
  output: string;
}

type PathValidation = string | AsepriteResult;

const SHEET_TYPES = new Set(["horizontal", "vertical", "rows", "columns", "packed"]);
const DATA_FORMATS = new Set(["json-array", "json-hash"]);

function luaEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n").replaceAll("\r", "\\r").replaceAll("\0", "\\0");
}

function safePath(value: string): string {
  const segments = value.replaceAll("\\", "/").split("/");
  if (segments.includes("..")) throw new Error("Parent directory traversal is not allowed");
  if (value.includes("\0")) throw new Error("Null bytes are not allowed in paths");
  return value;
}

function validatePath(value: string): PathValidation {
  if (typeof value !== "string" || !value.trim()) return { ok: false, message: "Path cannot be empty" };
  try {
    return safePath(value);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function validateFrameRange(fromFrame: number, toFrame: number): string | undefined {
  if (!Number.isInteger(fromFrame) || !Number.isInteger(toFrame) || fromFrame < 1 || toFrame < fromFrame) {
    return "Frame range must start at 1 and end at or after the start";
  }
  return undefined;
}

function isHexColor(value: string): boolean {
  return typeof value === "string" && /^#?(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim());
}

function validateName(value: string, label: string): string | AsepriteResult {
  if (typeof value !== "string" || !value.trim()) return { ok: false, message: `${label} cannot be empty` };
  return value;
}

function result(command: CommandResult, successMessage: string): AsepriteResult {
  if (command.ok) return { ok: true, message: successMessage };
  return { ok: false, message: command.output || "Aseprite command failed" };
}

export interface AsepriteCliGatewayOptions {
  executable?: string;
  tempDirectory?: string;
  commandRunner?: (args: string[]) => Promise<CommandResult>;
}

export class AsepriteCliGateway implements AsepriteGateway {
  private readonly executable: string;
  private readonly tempDirectory: string;
  private readonly commandRunner: (args: string[]) => Promise<CommandResult>;

  public constructor(options: AsepriteCliGatewayOptions = {}) {
    this.executable = options.executable ?? process.env.ASEPRITE_PATH ?? "aseprite";
    this.tempDirectory = options.tempDirectory ?? os.tmpdir();
    this.commandRunner = options.commandRunner ?? ((args) => this.run(args));
  }

  public async createCanvas(width: number, height: number, filename: string): Promise<AsepriteResult> {
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const target = validatePath(filename);
    if (typeof target !== "string") return target;
    const script = `local spr = Sprite(${width}, ${height})\nspr:saveAs("${luaEscape(target.replaceAll("\\", "/"))}")\nprint("OK")`;
    return result(await this.runLua(script), `Canvas created successfully: ${filename}`);
  }

  public async addGroup(filename: string, groupName: string, parentGroup = ""): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
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
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
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

  public async addFrame(filename: string): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const script = this.openScript(filename, "spr:newFrame()");
    return result(await this.runLua(script, filename), `New frame added to ${filename}`);
  }

  public async addFrames(filename: string, count: number, durationMs?: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(count)) return { ok: false, message: "Count must be a positive integer" };
    if (durationMs !== undefined && !isPositiveInteger(durationMs)) return { ok: false, message: "Duration must be a positive integer" };
    const duration = durationMs && durationMs > 0 ? `spr.frames[#spr.frames].duration = ${durationMs} / 1000.0` : "";
    const script = this.openScript(filename, `
      for i = 1, ${count} do
        spr:newFrame()
        ${duration}
      end
    `);
    return result(await this.runLua(script, filename), `Added ${count} frames to ${filename}`);
  }

  public async setFrame(filename: string, frameIndex: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const script = this.openScript(filename, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      app.activeFrame = spr.frames[${frameIndex}]
    `);
    return result(await this.runLua(script, filename), `Active frame set to ${frameIndex} in ${filename}`);
  }

  public async setFrameDuration(filename: string, frameIndex: number, durationMs: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!isPositiveInteger(durationMs)) return { ok: false, message: "Duration must be a positive integer" };
    const script = this.openScript(filename, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      spr.frames[${frameIndex}].duration = ${durationMs} / 1000.0
    `);
    return result(await this.runLua(script, filename), `Frame ${frameIndex} duration set to ${durationMs}ms in ${filename}`);
  }

  public async setFrameDurationAll(filename: string, durationMs: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(durationMs)) return { ok: false, message: "Duration must be a positive integer" };
    const script = this.openScript(filename, `
      for i = 1, #spr.frames do
        spr.frames[i].duration = ${durationMs} / 1000.0
      end
    `);
    return result(await this.runLua(script, filename), `All frame durations set to ${durationMs}ms in ${filename}`);
  }

  public async setLayerVisibility(filename: string, layerName: string, visible = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const script = this.openScript(filename, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      target.isVisible = ${visible ? "true" : "false"}
    `);
    return result(await this.runLua(script, filename), `Layer '${name}' visibility set to ${visible} in ${filename}`);
  }

  public async setLayerOpacity(filename: string, layerName: string, opacity: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!Number.isInteger(opacity) || opacity < 0 || opacity > 255) return { ok: false, message: "Opacity must be between 0 and 255" };
    const script = this.openScript(filename, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      target.opacity = ${opacity}
    `);
    return result(await this.runLua(script, filename), `Layer '${name}' opacity set to ${opacity} in ${filename}`);
  }

  public async setPalette(filename: string, colors: string[]): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!colors.length) return { ok: false, message: "Colors list cannot be empty" };
    if (colors.some((color) => !isHexColor(color))) return { ok: false, message: "Colors must use hexadecimal values" };
    const luaColors = colors.map((color) => `Color("${luaEscape(color)}")`).join(", ");
    const script = this.openScript(filename, `
      local palette = Palette(0, ${colors.length})
      local colors = {${luaColors}}
      for i, color in ipairs(colors) do palette:setColor(i - 1, color) end
      spr:setPalette(palette)
    `);
    return result(await this.runLua(script, filename), `Palette applied to ${filename}`);
  }

  public async drawPixels(filename: string, pixels: PixelInput[]): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!Array.isArray(pixels) || pixels.length === 0) return { ok: false, message: "Pixels list cannot be empty" };
    const commands: string[] = [];
    for (const pixel of pixels) {
      if (!Number.isInteger(pixel.x) || !Number.isInteger(pixel.y)) return { ok: false, message: "Pixel coordinates must be integers" };
      const rgba = this.parseHexColor(pixel.color);
      if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
      const [red, green, blue, alpha] = rgba;
      commands.push(`img:putPixel(${pixel.x} - cox, ${pixel.y} - coy, Color(${red}, ${green}, ${blue}, ${alpha}))`);
    }
    const script = this.openScript(source, `
      local cel = app.activeCel
      if not cel then
        app.activeLayer = spr.layers[1]
        app.activeFrame = spr.frames[1]
        cel = app.activeCel
        if not cel then print("ERROR:No active cel and couldn't create one") return end
      end
      local img = cel.image
      local cox = cel.position.x
      local coy = cel.position.y
      ${commands.join("\n      ")}
    `);
    return result(await this.runLua(script, source), `Pixels drawn successfully in ${source}`);
  }

  public async drawLine(filename: string, x1: number, y1: number, x2: number, y2: number, color: string, thickness = 1): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (![x1, y1, x2, y2].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(thickness)) return { ok: false, message: "Thickness must be a positive integer" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const script = this.openScript(source, `
      local cel = app.activeCel
      if not cel then
        app.activeLayer = spr.layers[1]
        app.activeFrame = spr.frames[1]
        cel = app.activeCel
        if not cel then print("ERROR:No active cel and couldn't create one") return end
      end
      local img = cel.image
      local cox = cel.position.x
      local coy = cel.position.y
      local color = Color(${red}, ${green}, ${blue}, ${alpha})
      local function put_thick(image, px, py, paint, size)
        local radius = math.max(0, math.floor(size / 2))
        for offsetY = -radius, radius do
          for offsetX = -radius, radius do
            image:putPixel(px + offsetX, py + offsetY, paint)
          end
        end
      end
      local px0 = ${x1} - cox
      local py0 = ${y1} - coy
      local px1 = ${x2} - cox
      local py1 = ${y2} - coy
      local dx = math.abs(px1 - px0)
      local stepX = px0 < px1 and 1 or -1
      local dy = -math.abs(py1 - py0)
      local stepY = py0 < py1 and 1 or -1
      local errorValue = dx + dy
      while true do
        if ${thickness} > 1 then put_thick(img, px0, py0, color, ${thickness}) else img:putPixel(px0, py0, color) end
        if px0 == px1 and py0 == py1 then break end
        local doubleError = 2 * errorValue
        if doubleError >= dy then errorValue = errorValue + dy; px0 = px0 + stepX end
        if doubleError <= dx then errorValue = errorValue + dx; py0 = py0 + stepY end
      end
    `);
    return result(await this.runLua(script, source), `Line drawn successfully in ${source}`);
  }

  public async drawRectangle(filename: string, x: number, y: number, width: number, height: number, color: string, fill = false): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !isPositiveInteger(width) || !isPositiveInteger(height)) {
      return { ok: false, message: "Width and height must be positive integers" };
    }
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const x2 = x + width - 1;
    const y2 = y + height - 1;
    const tool = fill ? "filled_rectangle" : "rectangle";
    const script = this.openScript(filename, `
      local cel = app.activeCel
      if not cel then print("ERROR:No active cel") return end
      app.useTool({
        tool="${tool}",
        color=Color(${red}, ${green}, ${blue}, ${alpha}),
        points={Point(${x}, ${y}), Point(${x2}, ${y2})}
      })
    `);
    return result(await this.runLua(script, filename), `Rectangle drawn in ${filename}`);
  }

  public async fillArea(filename: string, x: number, y: number, color: string): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return { ok: false, message: "Coordinates must be integers" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const script = this.openScript(source, `
      local cel = app.activeCel
      if not cel then
        app.activeLayer = spr.layers[1]
        app.activeFrame = spr.frames[1]
        cel = app.activeCel
        if not cel then print("ERROR:No active cel and couldn't create one") return end
      end
      app.useTool({
        tool = "paint_bucket",
        color = Color(${red}, ${green}, ${blue}, ${alpha}),
        points = { Point(${x}, ${y}) }
      })
    `);
    return result(await this.runLua(script, source), `Area filled successfully in ${source}`);
  }

  public async drawCircle(filename: string, centerX: number, centerY: number, radius: number, color: string, fill = false): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!Number.isInteger(centerX) || !Number.isInteger(centerY)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(radius)) return { ok: false, message: "Radius must be a positive integer" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const tool = fill ? "filled_ellipse" : "ellipse";
    const script = this.openScript(source, `
      local cel = app.activeCel
      if not cel then
        app.activeLayer = spr.layers[1]
        app.activeFrame = spr.frames[1]
        cel = app.activeCel
        if not cel then print("ERROR:No active cel and couldn't create one") return end
      end
      app.useTool({
        tool = "${tool}",
        color = Color(${red}, ${green}, ${blue}, ${alpha}),
        points = { Point(${centerX - radius}, ${centerY - radius}), Point(${centerX + radius}, ${centerY + radius}) }
      })
    `);
    return result(await this.runLua(script, source), `Circle drawn successfully in ${source}`);
  }

  public async drawPixelsAt(filename: string, layerName: string, frameIndex: number, pixels: PixelInput[], createIfMissing = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Array.isArray(pixels) || pixels.length === 0) return { ok: false, message: "Pixels list cannot be empty" };
    const commands: string[] = [];
    for (const pixel of pixels) {
      if (!Number.isInteger(pixel.x) || !Number.isInteger(pixel.y)) return { ok: false, message: "Pixel coordinates must be integers" };
      const rgba = this.parseHexColor(pixel.color);
      if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
      const [red, green, blue, alpha] = rgba;
      commands.push(`img:putPixel(${pixel.x} - cox, ${pixel.y} - coy, Color(${red}, ${green}, ${blue}, ${alpha}))`);
    }
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      local img = cel.image
      local cox = cel.position.x
      local coy = cel.position.y
      ${commands.join("\n      ")}
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Pixels drawn on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async drawLineAt(filename: string, layerName: string, frameIndex: number, x1: number, y1: number, x2: number, y2: number, color: string, thickness = 1, createIfMissing = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x1, y1, x2, y2].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(thickness)) return { ok: false, message: "Thickness must be a positive integer" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      local img = cel.image
      local cox = cel.position.x
      local coy = cel.position.y
      local paint = Color(${red}, ${green}, ${blue}, ${alpha})
      local function put_thick(image, px, py, colorValue, size)
        local radius = math.max(0, math.floor(size / 2))
        for offsetY = -radius, radius do
          for offsetX = -radius, radius do image:putPixel(px + offsetX, py + offsetY, colorValue) end
        end
      end
      local px0 = ${x1} - cox
      local py0 = ${y1} - coy
      local px1 = ${x2} - cox
      local py1 = ${y2} - coy
      local dx = math.abs(px1 - px0)
      local stepX = px0 < px1 and 1 or -1
      local dy = -math.abs(py1 - py0)
      local stepY = py0 < py1 and 1 or -1
      local errorValue = dx + dy
      while true do
        if ${thickness} > 1 then put_thick(img, px0, py0, paint, ${thickness}) else img:putPixel(px0, py0, paint) end
        if px0 == px1 and py0 == py1 then break end
        local doubleError = 2 * errorValue
        if doubleError >= dy then errorValue = errorValue + dy; px0 = px0 + stepX end
        if doubleError <= dx then errorValue = errorValue + dx; py0 = py0 + stepY end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Line drawn on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async drawRectangleAt(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, color: string, fill = false, createIfMissing = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const tool = fill ? "filled_rectangle" : "rectangle";
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      app.useTool({
        tool = "${tool}",
        color = Color(${red}, ${green}, ${blue}, ${alpha}),
        points = { Point(${x}, ${y}), Point(${x + width - 1}, ${y + height - 1}) }
      })
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Rectangle drawn on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async drawCircleAt(filename: string, layerName: string, frameIndex: number, centerX: number, centerY: number, radius: number, color: string, fill = false, createIfMissing = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![centerX, centerY].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(radius)) return { ok: false, message: "Radius must be a positive integer" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const tool = fill ? "filled_ellipse" : "ellipse";
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      app.useTool({
        tool = "${tool}",
        color = Color(${red}, ${green}, ${blue}, ${alpha}),
        points = { Point(${centerX - radius}, ${centerY - radius}), Point(${centerX + radius}, ${centerY + radius}) }
      })
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Circle drawn on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async fillAreaAt(filename: string, layerName: string, frameIndex: number, x: number, y: number, color: string, createIfMissing = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      app.useTool({
        tool = "paint_bucket",
        color = Color(${red}, ${green}, ${blue}, ${alpha}),
        points = { Point(${x}, ${y}) }
      })
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Area filled on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async setTag(filename: string, name: string, fromFrame: number, toFrame: number, direction = "forward"): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const rangeError = validateFrameRange(fromFrame, toFrame);
    if (rangeError) return { ok: false, message: rangeError };
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
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(tileWidth) || !isPositiveInteger(tileHeight)) return { ok: false, message: "Tile dimensions must be positive integers" };
    const script = this.openScript(filename, `
      spr.gridBounds = Rectangle(0, 0, ${tileWidth}, ${tileHeight})
      app.command.NewLayer { tilemap = true }
      app.activeLayer.name = "${luaEscape(layerName)}"
    `);
    return result(await this.runLua(script, filename), `Tilemap layer '${layerName}' created in ${filename}`);
  }

  public async validateScene(filename: string, requiredLayers: string[], startFrame = 1, endFrame?: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!requiredLayers.length) return { ok: false, message: "Required layers list cannot be empty" };
    if (!Number.isInteger(startFrame) || startFrame < 1 || (endFrame !== undefined && (!Number.isInteger(endFrame) || endFrame < startFrame))) {
      return { ok: false, message: "Frame range must start at 1 and end at or after the start" };
    }
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
    const source = validatePath(input.filename);
    if (typeof source !== "string") return source;
    const output = validatePath(input.outputFilename);
    if (typeof output !== "string") return output;
    if (!SHEET_TYPES.has(input.sheetType ?? "horizontal")) return { ok: false, message: `Unsupported spritesheet type: ${input.sheetType}` };
    if (!Number.isInteger(input.scale ?? 1) || (input.scale ?? 1) < 1 || (input.scale ?? 1) > 64) return { ok: false, message: "Scale must be between 1 and 64" };
    if (!Number.isInteger(input.padding ?? 0) || (input.padding ?? 0) < 0) return { ok: false, message: "Padding must be a non-negative integer" };
    if (!DATA_FORMATS.has(input.dataFormat ?? "json-array")) return { ok: false, message: `Unsupported data format: ${input.dataFormat}` };
    const data = input.dataFilename ? validatePath(input.dataFilename) : undefined;
    if (data !== undefined && typeof data !== "string") return data;
    const args = ["--batch"];
    if (input.tagName) {
      const range = await this.resolveTagRange(input.filename, input.tagName);
      if (!range.ok) return { ok: false, message: range.output };
      args.push("--frame-range", range.output);
    }
    args.push(source, "--sheet-type", input.sheetType ?? "horizontal");
    if ((input.scale ?? 1) > 1) args.push("--scale", String(input.scale));
    if ((input.padding ?? 0) > 0) args.push("--shape-padding", String(input.padding));
    if (data) args.push("--data", data, "--format", input.dataFormat ?? "json-array");
    if (input.listTags) args.push("--list-tags");
    args.push("--sheet", output);
    const command = await this.commandRunner(args);
    if (command.ok) {
      try {
        await fs.access(output);
      } catch {
        return { ok: false, message: "Aseprite exited successfully but did not create the spritesheet" };
      }
      if (data) {
        try {
          await fs.access(data);
        } catch {
          return { ok: false, message: "Aseprite exited successfully but did not create the metadata file" };
        }
      }
    }
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

  private layerFrameScript(layerName: string, frameIndex: number, createIfMissing: boolean, body: string): string {
    return `
      local idx = ${frameIndex}
      if idx > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(layerName)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      app.activeLayer = target
      app.activeFrame = spr.frames[idx]
      local cel = target:cel(spr.frames[idx])
      if not cel and ${createIfMissing ? "true" : "false"} then
        local img = Image(spr.width, spr.height, spr.colorMode)
        cel = spr:newCel(target, spr.frames[idx], img, Point(0, 0))
      end
      if not cel then print("ERROR:Cel not found") return end
      app.transaction(function() ${body} end)
    `;
  }

  private parseHexColor(value: string): [number, number, number, number] | undefined {
    if (typeof value !== "string") return undefined;
    let normalized = value.trim().replace("#", "");
    if (!/^[0-9a-fA-F]{3,4}$|^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(normalized)) return undefined;
    if (normalized.length === 3 || normalized.length === 4) normalized = [...normalized].map((component) => component + component).join("");
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
      normalized.length === 8 ? Number.parseInt(normalized.slice(6, 8), 16) : 255,
    ];
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
      return await this.commandRunner(args);
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
