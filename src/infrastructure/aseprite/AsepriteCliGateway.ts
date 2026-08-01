import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { AsepriteGateway, AsepriteResult, PixelInput, PointInput } from "../../domain/aseprite.js";

const execFileAsync = promisify(execFile);

interface CommandResult {
  ok: boolean;
  output: string;
}

type PathValidation = string | AsepriteResult;

const SHEET_TYPES = new Set(["horizontal", "vertical", "rows", "columns", "packed"]);
const DATA_FORMATS = new Set(["json-array", "json-hash"]);
const BLEND_MODES: Record<string, string> = {
  normal: "BlendMode.NORMAL",
  darken: "BlendMode.DARKEN",
  multiply: "BlendMode.MULTIPLY",
  color_burn: "BlendMode.COLOR_BURN",
  lighten: "BlendMode.LIGHTEN",
  screen: "BlendMode.SCREEN",
  color_dodge: "BlendMode.COLOR_DODGE",
  addition: "BlendMode.ADDITION",
  overlay: "BlendMode.OVERLAY",
  soft_light: "BlendMode.SOFT_LIGHT",
  hard_light: "BlendMode.HARD_LIGHT",
  difference: "BlendMode.DIFFERENCE",
  exclusion: "BlendMode.EXCLUSION",
  subtract: "BlendMode.SUBTRACT",
  divide: "BlendMode.DIVIDE",
  hue: "BlendMode.HSL_HUE",
  saturation: "BlendMode.HSL_SATURATION",
  color: "BlendMode.HSL_COLOR",
  luminosity: "BlendMode.HSL_LUMINOSITY",
};
const PALETTE_PRESETS: Record<string, string[]> = {
  gameboy: ["#0F380F", "#306230", "#8BAC0F", "#9BBC0F"],
  monochrome: ["#000000", "#FFFFFF"],
  grayscale_4: ["#000000", "#555555", "#AAAAAA", "#FFFFFF"],
  cga: ["#000000", "#55FFFF", "#FF55FF", "#FFFFFF"],
  pico8: ["#000000", "#1D2B53", "#7E2553", "#008751", "#AB5236", "#5F574F", "#C2C3C7", "#FFF1E8", "#FF004D", "#FFA300", "#FFEC27", "#00E436", "#29ADFF", "#83769C", "#FF77A8", "#FFCCAA"],
  c64: ["#000000", "#FFFFFF", "#880000", "#AAFFEE", "#CC44CC", "#00CC55", "#0000AA", "#EEEE77", "#DD8855", "#664400", "#FF7777", "#333333", "#777777", "#AAFF66", "#0088FF", "#BBBBBB"],
  dawnbringer16: ["#140C1C", "#442434", "#30346D", "#4E4A4E", "#854C30", "#346524", "#D04648", "#757161", "#597DCE", "#D27D2C", "#8595A1", "#6DAA2C", "#D2AA99", "#6DC2CA", "#DAD45E", "#DEEED6"],
  dawnbringer32: ["#000000", "#222034", "#45283C", "#663931", "#8F563B", "#DF7126", "#D9A066", "#EEC39A", "#FBF236", "#99E550", "#6ABE30", "#37946E", "#4B692F", "#524B24", "#323C39", "#3F3F74", "#306082", "#5B6EE1", "#639BFF", "#5FCDE4", "#CBDBFC", "#FFFFFF", "#9BADB7", "#847E87", "#696A6A", "#595652", "#76428A", "#AC3232", "#D95763", "#D77BBA", "#8F974A", "#8A6F30"],
};

function rgbToHsl(red: number, green: number, blue: number): [number, number, number] {
  red /= 255; green /= 255; blue /= 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;
  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return [hue / 6, saturation, lightness];
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  if (saturation === 0) {
    const value = Math.floor(lightness * 255 + 0.5);
    return `#${value.toString(16).padStart(2, "0")}${value.toString(16).padStart(2, "0")}${value.toString(16).padStart(2, "0")}`.toUpperCase();
  }
  const hueToRgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const red = Math.floor(hueToRgb(p, q, hue + 1 / 3) * 255 + 0.5);
  const green = Math.floor(hueToRgb(p, q, hue) * 255 + 0.5);
  const blue = Math.floor(hueToRgb(p, q, hue - 1 / 3) * 255 + 0.5);
  return `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`.toUpperCase();
}
const CONVOLUTION_MATRICES = new Set([
  "brightness", "contrast", "negative",
  "blur-3x3", "blur-3x3-hard", "blur-5x5", "blur-7x7", "blur-9x9", "blur-17x17",
  "blur-5x3-left", "blur-17x3-left", "blur-3x17-top",
  "blur-5x5-diagonal(\\)", "blur-5x5-diagonal(/)",
  "sharpen-3x3", "sharpen-5x5", "sharpen-7x7",
  "edges-find", "edges-find-horizontal", "edges-find-vertical",
  "misc-contour", "misc-texturize", "misc-emboss", "misc-marmolize",
  "misc-rock", "misc-rock-edges",
  "drunk-3x3_x", "drunk-3x3_+", "drunk-5x5_x", "drunk-5x5_+",
  "drunk-7x7_x", "drunk-7x7_+", "drunk-9x9_x", "drunk-9x9_+",
  "drunk-17x17_x", "drunk-17x17_+", "drunk-17x17_o",
  "outline-transparent-layer-(cross)", "outline-transparent-layer-(square)",
]);

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

function validateNativeRegion(x: number, y: number, width: number, height: number): AsepriteResult | undefined {
  if (![x, y, width, height].every((value) => Number.isInteger(value))) return { ok: false, message: "Region values must be integers" };
  if (width < 0 || height < 0 || (width === 0) !== (height === 0)) return { ok: false, message: "Region width and height must both be zero or positive integers" };
  return undefined;
}

function result(command: CommandResult, successMessage: string): AsepriteResult {
  if (command.ok) return { ok: true, message: successMessage };
  return { ok: false, message: command.output || "Aseprite command failed" };
}

function parsePixelFields(value: string, expected: number): number[] | undefined {
  const fields = value.split(",").map(Number);
  return fields.length === expected && fields.every(Number.isInteger) ? fields : undefined;
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

  public async deleteLayer(filename: string, layerName: string): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const script = this.layerScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      if #spr.layers <= 1 then print("ERROR:Cannot delete the only layer") return end
      spr:deleteLayer(target)
    `);
    return result(await this.runLua(script, source), `Layer '${name}' deleted from ${source}`);
  }

  public async renameLayer(filename: string, layerName: string, newName: string): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const replacement = validateName(newName, "New layer name");
    if (typeof replacement !== "string") return replacement;
    const script = this.layerScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      target.name = "${luaEscape(replacement)}"
    `);
    return result(await this.runLua(script, source), `Layer '${name}' renamed to '${replacement}' in ${source}`);
  }

  public async duplicateLayer(filename: string, layerName: string, newName = "", group = ""): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const finalName = newName.trim() || `${name} copy`;
    const targetGroup = group.trim();
    const script = this.layerScript(source, `
      local src = find_layer(spr, "${luaEscape(name)}")
      if not src then print("ERROR:Layer not found") return end
      if src.isGroup then print("ERROR:Source group cannot be duplicated") return end
      local parent = nil
      if "${luaEscape(targetGroup)}" ~= "" then
        parent = find_layer(spr, "${luaEscape(targetGroup)}")
        if not parent then print("ERROR:Group not found") return end
        if not parent.isGroup then print("ERROR:Target is not a group") return end
      end
      local copy = spr:newLayer()
      copy.name = "${luaEscape(finalName)}"
      copy.opacity = src.opacity
      copy.blendMode = src.blendMode
      if parent then copy.parent = parent else copy.stackIndex = src.stackIndex + 1 end
      for _, frame in ipairs(spr.frames) do
        local cel = src:cel(frame)
        if cel then
          local copiedCel = spr:newCel(copy, frame, cel.image:clone(), cel.position)
          copiedCel.opacity = cel.opacity
        end
      end
    `);
    const location = targetGroup ? ` inside group '${targetGroup}'` : "";
    return result(await this.runLua(script, source), `Layer '${name}' duplicated as '${finalName}'${location} in ${source}`);
  }

  public async reorderLayer(filename: string, layerName: string, position: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(position)) return { ok: false, message: "Position must be a positive integer" };
    const script = this.layerScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      if ${position} > #spr.layers then print("ERROR:Position out of range") return end
      target.stackIndex = ${position}
    `);
    return result(await this.runLua(script, source), `Layer '${name}' moved to position ${position} in ${source}`);
  }

  public async setLayerBlendMode(filename: string, layerName: string, mode: string): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const normalizedMode = mode.trim().toLowerCase();
    const blend = BLEND_MODES[normalizedMode];
    if (!blend) return { ok: false, message: `Unsupported blend mode: ${mode}` };
    const script = this.layerScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      target.blendMode = ${blend}
    `);
    return result(await this.runLua(script, source), `Layer '${name}' blend mode set to ${normalizedMode} in ${source}`);
  }

  public async mergeLayerDown(filename: string, layerName: string): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const script = this.layerScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      if target.stackIndex <= 1 then print("ERROR:Layer is the bottom layer; nothing to merge into") return end
      app.activeLayer = target
      app.command.MergeDownLayer()
    `);
    return result(await this.runLua(script, source), `Layer '${name}' merged down in ${source}`);
  }

  public async flattenSprite(filename: string): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const script = this.openScript(source, "spr:flatten()");
    return result(await this.runLua(script, source), `Sprite flattened in ${source}`);
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

  public async drawPolygon(filename: string, layerName: string, frameIndex: number, points: PointInput[], color = "#000000", fill = false, createIfMissing = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Array.isArray(points) || points.length < 3) return { ok: false, message: "Polygon requires at least 3 points" };
    if (points.some((point) => !Number.isInteger(point.x) || !Number.isInteger(point.y))) return { ok: false, message: "Point coordinates must be integers" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const luaPoints = points.map((point) => `{ x = ${point.x}, y = ${point.y} }`).join(", ");
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      local img = cel.image
      local function pset(image, px, py, value)
        if px >= 0 and py >= 0 and px < image.width and py < image.height then image:putPixel(px, py, value) end
      end
      local function draw_line(image, x0, y0, x1, y1, value)
        local dx = math.abs(x1 - x0)
        local sx = x0 < x1 and 1 or -1
        local dy = -math.abs(y1 - y0)
        local sy = y0 < y1 and 1 or -1
        local errorValue = dx + dy
        while true do
          pset(image, x0, y0, value)
          if x0 == x1 and y0 == y1 then break end
          local doubleError = 2 * errorValue
          if doubleError >= dy then errorValue = errorValue + dy; x0 = x0 + sx end
          if doubleError <= dx then errorValue = errorValue + dx; y0 = y0 + sy end
        end
      end
      local function fill_polygon(image, polygon, value)
        local minY = polygon[1].y
        local maxY = polygon[1].y
        for index = 2, #polygon do
          if polygon[index].y < minY then minY = polygon[index].y end
          if polygon[index].y > maxY then maxY = polygon[index].y end
        end
        for scanY = minY, maxY do
          local nodes = {}
          local previous = #polygon
          for index = 1, #polygon do
            local current = polygon[index]
            local prior = polygon[previous]
            if (current.y < scanY and prior.y >= scanY) or (prior.y < scanY and current.y >= scanY) then
              table.insert(nodes, current.x + (scanY - current.y) * (prior.x - current.x) / (prior.y - current.y))
            end
            previous = index
          end
          table.sort(nodes)
          for index = 1, #nodes, 2 do
            if nodes[index + 1] then
              for scanX = math.floor(nodes[index] + 0.5), math.floor(nodes[index + 1] + 0.5) do pset(image, scanX, scanY, value) end
            end
          end
        end
      end
      local polygon = { ${luaPoints} }
      local paint = Color(${red}, ${green}, ${blue}, ${alpha})
      if ${fill ? "true" : "false"} then fill_polygon(img, polygon, paint) end
      for index = 1, #polygon do
        local nextIndex = index + 1
        if nextIndex > #polygon then nextIndex = 1 end
        draw_line(img, polygon[index].x, polygon[index].y, polygon[nextIndex].x, polygon[nextIndex].y, paint)
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Polygon drawn on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async drawPath(filename: string, layerName: string, frameIndex: number, points: PointInput[], color = "#000000", thickness = 1, createIfMissing = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Array.isArray(points) || points.length < 2) return { ok: false, message: "Path requires at least 2 points" };
    if (points.some((point) => !Number.isInteger(point.x) || !Number.isInteger(point.y))) return { ok: false, message: "Point coordinates must be integers" };
    if (!isPositiveInteger(thickness)) return { ok: false, message: "Thickness must be a positive integer" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const luaPoints = points.map((point) => `{ x = ${point.x}, y = ${point.y} }`).join(", ");
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      local img = cel.image
      local function pset(image, px, py, value)
        if px >= 0 and py >= 0 and px < image.width and py < image.height then image:putPixel(px, py, value) end
      end
      local function put_thick(image, px, py, value, size)
        local radius = math.max(0, math.floor(size / 2))
        for offsetY = -radius, radius do
          for offsetX = -radius, radius do pset(image, px + offsetX, py + offsetY, value) end
        end
      end
      local function draw_line(image, x0, y0, x1, y1, value, size)
        local dx = math.abs(x1 - x0)
        local sx = x0 < x1 and 1 or -1
        local dy = -math.abs(y1 - y0)
        local sy = y0 < y1 and 1 or -1
        local errorValue = dx + dy
        while true do
          if size > 1 then put_thick(image, x0, y0, value, size) else pset(image, x0, y0, value) end
          if x0 == x1 and y0 == y1 then break end
          local doubleError = 2 * errorValue
          if doubleError >= dy then errorValue = errorValue + dy; x0 = x0 + sx end
          if doubleError <= dx then errorValue = errorValue + dx; y0 = y0 + sy end
        end
      end
      local points = { ${luaPoints} }
      local paint = Color(${red}, ${green}, ${blue}, ${alpha})
      for index = 1, #points - 1 do draw_line(img, points[index].x, points[index].y, points[index + 1].x, points[index + 1].y, paint, ${thickness}) end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Path drawn on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async applyGradientRect(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorStart: string, colorEnd: string, horizontal = true, createIfMissing = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const start = this.parseHexColor(colorStart);
    const end = this.parseHexColor(colorEnd);
    if (!start || !end) return { ok: false, message: "Colors must use hexadecimal values" };
    const [startRed, startGreen, startBlue, startAlpha] = start;
    const [endRed, endGreen, endBlue, endAlpha] = end;
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      local img = cel.image
      local function pset(image, px, py, value)
        if px >= 0 and py >= 0 and px < image.width and py < image.height then image:putPixel(px, py, value) end
      end
      for offsetY = 0, ${height - 1} do
        for offsetX = 0, ${width - 1} do
          local t = ${horizontal ? `((${width} > 1) and (offsetX / (${width} - 1)) or 0)` : `((${height} > 1) and (offsetY / (${height} - 1)) or 0)`}
          local red = math.floor(${startRed} + (${endRed} - ${startRed}) * t + 0.5)
          local green = math.floor(${startGreen} + (${endGreen} - ${startGreen}) * t + 0.5)
          local blue = math.floor(${startBlue} + (${endBlue} - ${startBlue}) * t + 0.5)
          local alpha = math.floor(${startAlpha} + (${endAlpha} - ${startAlpha}) * t + 0.5)
          pset(img, ${x} + offsetX, ${y} + offsetY, Color(red, green, blue, alpha))
        end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Gradient applied on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async drawEllipseAt(filename: string, layerName: string, frameIndex: number, centerX: number, centerY: number, radiusX: number, radiusY: number, color = "#000000", fill = false, createIfMissing = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![centerX, centerY].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(radiusX) || !isPositiveInteger(radiusY)) return { ok: false, message: "Radius X and radius Y must be positive integers" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const tool = fill ? "filled_ellipse" : "ellipse";
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      app.useTool({
        tool = "${tool}",
        color = Color(${red}, ${green}, ${blue}, ${alpha}),
        points = { Point(${centerX - radiusX}, ${centerY - radiusY}), Point(${centerX + radiusX}, ${centerY + radiusY}) }
      })
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Ellipse drawn on '${name}' frame ${frameIndex} in ${source}`);
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

  public async exportSprite(filename: string, outputFilename: string, format = "png"): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const output = validatePath(outputFilename);
    if (typeof output !== "string") return output;
    const normalizedFormat = format.trim().toLowerCase();
    if (!/^[a-z0-9]+$/.test(normalizedFormat)) return { ok: false, message: "Format must contain only letters and numbers" };
    const target = output.toLowerCase().endsWith(`.${normalizedFormat}`) ? output : `${output}.${normalizedFormat}`;
    const command = await this.commandRunner(["--batch", source, "--save-as", target]);
    if (!command.ok) return result(command, `Sprite exported to ${target}`);
    const produced = await this.findProducedOutput(target);
    if (!produced) return { ok: false, message: "Aseprite exited successfully but did not create the exported sprite" };
    if (produced !== target) await fs.rename(produced, target);
    return { ok: true, message: `Sprite exported successfully to ${target}` };
  }

  public async copySprite(filename: string, outputFilename: string, overwrite = false): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const output = validatePath(outputFilename);
    if (typeof output !== "string") return output;
    const target = output.toLowerCase().endsWith(".aseprite") ? output : `${output}.aseprite`;
    if (!overwrite && await this.findProducedOutput(target)) return { ok: false, message: `Output file ${target} already exists` };
    const script = `
      if not app.activeSprite then print("ERROR:No active sprite") return end
      app.activeSprite:saveAs("${luaEscape(target.replaceAll("\\", "/"))}")
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return result(command, `Sprite copied to ${target}`);
    if (!(await this.findProducedOutput(target))) return { ok: false, message: "Aseprite exited successfully but did not create the copied sprite" };
    return { ok: true, message: `Sprite copied to ${target}` };
  }

  public async exportFrame(filename: string, frameIndex: number, outputFilename: string, scale = 1): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const output = validatePath(outputFilename);
    if (typeof output !== "string") return output;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Number.isInteger(scale) || scale < 1 || scale > 64) return { ok: false, message: "Scale must be between 1 and 64" };
    const target = output.toLowerCase().endsWith(".png") ? output : `${output}.png`;
    const command = await this.commandRunner(["--batch", source, "--frame-range", `${frameIndex - 1},${frameIndex - 1}`, "--scale", String(scale), "--save-as", target]);
    if (!command.ok) return result(command, `Frame ${frameIndex} exported to ${target}`);
    const produced = await this.findProducedOutput(target);
    if (!produced) return { ok: false, message: `Export reported success but ${target} was not created` };
    if (produced !== target) await fs.rename(produced, target);
    return { ok: true, message: `Frame ${frameIndex} exported to ${target} at ${scale}x` };
  }

  public async exportLayers(filename: string, outputDirectory: string, includeHidden = false): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const directory = validatePath(outputDirectory);
    if (typeof directory !== "string") return directory;
    await fs.mkdir(directory, { recursive: true });
    const before = new Set((await fs.readdir(directory)).filter((entry) => entry.toLowerCase().endsWith(".png")));
    const args = ["--batch"];
    if (includeHidden) args.push("--all-layers");
    args.push("--split-layers", source, "--save-as", path.join(directory, "{layer}.png"));
    const command = await this.commandRunner(args);
    if (!command.ok) return result(command, `Layers exported to ${directory}`);
    const produced = (await fs.readdir(directory)).filter((entry) => entry.toLowerCase().endsWith(".png") && !before.has(entry)).sort();
    if (produced.length === 0) return { ok: false, message: "Aseprite exited successfully but did not create layer PNG files" };
    return { ok: true, message: `Layers exported to ${directory}: ${produced.join(", ")}` };
  }

  public async exportTag(filename: string, tagName: string, outputFilename: string, scale = 1): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(tagName, "Tag name");
    if (typeof name !== "string") return name;
    const output = validatePath(outputFilename);
    if (typeof output !== "string") return output;
    if (!isPositiveInteger(scale) || scale > 64) return { ok: false, message: "Scale must be between 1 and 64" };
    const tagCheck = await this.resolveTagRange(source, name);
    if (!tagCheck.ok) return { ok: false, message: `Tag not found: ${tagCheck.output}` };
    const target = path.extname(output) ? output : `${output}.png`;
    const args = ["--batch", source, "--tag", name];
    if (scale > 1) args.push("--scale", String(scale));
    args.push("--save-as", target);
    const command = await this.commandRunner(args);
    if (!command.ok) return result(command, `Tag '${name}' exported to ${target}`);
    const produced = await this.findProducedOutput(target);
    if (!produced) return { ok: false, message: "Aseprite exited successfully but did not create the tag export" };
    if (produced !== target) await fs.rename(produced, target);
    return { ok: true, message: `Tag '${name}' exported to ${target}` };
  }

  public async importImageAsLayer(filename: string, imagePath: string, layerName: string, frameIndex = 1, x = 0, y = 0): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const image = validatePath(imagePath);
    if (typeof image !== "string") return image;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    try {
      await fs.access(image);
    } catch {
      return { ok: false, message: `Image file not found: ${image}` };
    }
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local imported = Image { fromFile = "${luaEscape(image.replaceAll("\\", "/"))}" }
      if not imported then print("ERROR:Could not load image") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then target = spr:newLayer() target.name = "${luaEscape(name)}" end
      local frame = spr.frames[${frameIndex}]
      local cel = target:cel(frame)
      if not cel then cel = spr:newCel(target, frame, Image(spr.width, spr.height, spr.colorMode), Point(0, 0)) end
      cel.image:drawImage(imported, Point(${x}, ${y}))
    `);
    return result(await this.runLua(script, source), `Image imported into '${name}' frame ${frameIndex} in ${source}`);
  }

  public async createCel(filename: string, layerName: string, frameIndex: number, x = 0, y = 0): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local frame = spr.frames[${frameIndex}]
      if not target:cel(frame) then spr:newCel(target, frame, Image(spr.width, spr.height, spr.colorMode), Point(${x}, ${y})) end
    `);
    return result(await this.runLua(script, source), `Cel created on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async clearCel(filename: string, layerName: string, frameIndex: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local cel = target:cel(spr.frames[${frameIndex}])
      if cel then spr:deleteCel(cel) end
    `);
    return result(await this.runLua(script, source), `Cel cleared on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async copyCel(filename: string, layerName: string, sourceFrame: number, targetFrame: number, replace = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(sourceFrame)) return { ok: false, message: "Source frame must be a positive integer" };
    if (!isPositiveInteger(targetFrame)) return { ok: false, message: "Target frame must be a positive integer" };
    const script = this.openScript(source, `
      if ${sourceFrame} > #spr.frames then print("ERROR:Source frame out of range") return end
      if ${targetFrame} > #spr.frames then print("ERROR:Target frame out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local sourceCel = target:cel(spr.frames[${sourceFrame}])
      if not sourceCel then print("ERROR:Source cel not found") return end
      local targetCel = target:cel(spr.frames[${targetFrame}])
      if targetCel and ${replace ? "true" : "false"} then spr:deleteCel(targetCel) targetCel = nil end
      if not targetCel then spr:newCel(target, spr.frames[${targetFrame}], sourceCel.image:clone(), sourceCel.position) end
    `);
    return result(await this.runLua(script, source), `Cel copied on '${name}' from frame ${sourceFrame} to ${targetFrame} in ${source}`);
  }

  public async copyFrame(filename: string, sourceFrame: number, targetFrame?: number, overwrite = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(sourceFrame)) return { ok: false, message: "Source frame must be a positive integer" };
    if (targetFrame !== undefined && !isPositiveInteger(targetFrame)) return { ok: false, message: "Target frame must be a positive integer" };
    const destination = targetFrame === undefined ? "nil" : String(targetFrame);
    const message = targetFrame === undefined ? `Frame ${sourceFrame} copied to new frame in ${source}` : `Frame ${sourceFrame} copied to frame ${targetFrame} in ${source}`;
    const script = this.openScript(source, `
      if ${sourceFrame} > #spr.frames then print("ERROR:Source frame out of range") return end
      local destinationIndex = ${destination}
      if destinationIndex ~= nil and destinationIndex > #spr.frames then print("ERROR:Target frame out of range") return end
      local destinationFrame = destinationIndex == nil and spr:newFrame() or spr.frames[destinationIndex]
      local function visit(layer)
        if layer.isGroup then
          for _, child in ipairs(layer.layers) do visit(child) end
          return
        end
        if ${overwrite ? "true" : "false"} then
          local old = layer:cel(destinationFrame)
          if old then spr:deleteCel(old) end
        end
        local sourceCel = layer:cel(spr.frames[${sourceFrame}])
        if sourceCel and not layer:cel(destinationFrame) then spr:newCel(layer, destinationFrame, sourceCel.image:clone(), sourceCel.position) end
      end
      for _, layer in ipairs(spr.layers) do visit(layer) end
    `);
    return result(await this.runLua(script, source), message);
  }

  public async setCelPosition(filename: string, layerName: string, frameIndex: number, x: number, y: number, createIfMissing = false, sourceFrameIndex?: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (sourceFrameIndex !== undefined && !isPositiveInteger(sourceFrameIndex)) return { ok: false, message: "Source frame must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    const sourceIndex = sourceFrameIndex === undefined ? "nil" : String(sourceFrameIndex);
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local frame = spr.frames[${frameIndex}]
      local cel = target:cel(frame)
      if not cel and ${createIfMissing ? "true" : "false"} then
        local sourceIndex = ${sourceIndex}
        if sourceIndex == nil then sourceIndex = ${frameIndex} end
        if sourceIndex < 1 or sourceIndex > #spr.frames then print("ERROR:Source frame out of range") return end
        local sourceCel = target:cel(spr.frames[sourceIndex])
        cel = sourceCel and spr:newCel(target, frame, sourceCel.image:clone(), sourceCel.position) or spr:newCel(target, frame, Image(spr.width, spr.height, spr.colorMode), Point(0, 0))
      end
      if not cel then print("ERROR:Cel not found") return end
      cel.position = Point(${x}, ${y})
    `);
    return result(await this.runLua(script, source), `Cel position set to (${x}, ${y}) on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async tweenCelPositions(filename: string, layerName: string, startFrame: number, endFrame: number, startX: number, startY: number, endX: number, endY: number, createMissingCels = false, sourceFrameIndex?: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const rangeError = validateFrameRange(startFrame, endFrame);
    if (rangeError) return { ok: false, message: rangeError };
    if (sourceFrameIndex !== undefined && !isPositiveInteger(sourceFrameIndex)) return { ok: false, message: "Source frame must be a positive integer" };
    if (![startX, startY, endX, endY].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    const sourceIndex = sourceFrameIndex === undefined ? "nil" : String(sourceFrameIndex);
    const script = this.openScript(source, `
      if ${startFrame} < 1 or ${endFrame} > #spr.frames or ${startFrame} > ${endFrame} then print("ERROR:Frame range out of bounds") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local span = ${endFrame} - ${startFrame}
      for index = ${startFrame}, ${endFrame} do
        local t = span > 0 and ((index - ${startFrame}) / span) or 0
        local positionX = math.floor(${startX} + (${endX} - ${startX}) * t + 0.5)
        local positionY = math.floor(${startY} + (${endY} - ${startY}) * t + 0.5)
        local cel = target:cel(spr.frames[index])
        if not cel and ${createMissingCels ? "true" : "false"} then
          local sourceIndex = ${sourceIndex}
          if sourceIndex == nil then sourceIndex = ${startFrame} end
          if sourceIndex < 1 or sourceIndex > #spr.frames then print("ERROR:Source frame out of range") return end
          local sourceCel = target:cel(spr.frames[sourceIndex])
          cel = sourceCel and spr:newCel(target, spr.frames[index], sourceCel.image:clone(), sourceCel.position) or spr:newCel(target, spr.frames[index], Image(spr.width, spr.height, spr.colorMode), Point(0, 0))
        end
        if cel then cel.position = Point(positionX, positionY) end
      end
    `);
    return result(await this.runLua(script, source), `Tweened cel positions on '${name}' frames ${startFrame}-${endFrame} in ${source}`);
  }

  public async offsetCelPositions(filename: string, layerName: string, startFrame: number, endFrame: number, dx: number, dy: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const rangeError = validateFrameRange(startFrame, endFrame);
    if (rangeError) return { ok: false, message: rangeError };
    if (![dx, dy].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Offset values must be integers" };
    const script = this.openScript(source, `
      if ${startFrame} < 1 or ${endFrame} > #spr.frames or ${startFrame} > ${endFrame} then print("ERROR:Frame range out of bounds") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      for index = ${startFrame}, ${endFrame} do
        local cel = target:cel(spr.frames[index])
        if cel then cel.position = Point(cel.position.x + ${dx}, cel.position.y + ${dy}) end
      end
    `);
    return result(await this.runLua(script, source), `Offset cel positions by (${dx}, ${dy}) on '${name}' frames ${startFrame}-${endFrame} in ${source}`);
  }

  public async propagateFrameToRange(filename: string, sourceFrame: number, startFrame: number, endFrame: number, overwrite = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(sourceFrame)) return { ok: false, message: "Source frame must be a positive integer" };
    const rangeError = validateFrameRange(startFrame, endFrame);
    if (rangeError) return { ok: false, message: rangeError };
    const script = this.openScript(source, `
      if ${sourceFrame} > #spr.frames or ${startFrame} < 1 or ${endFrame} > #spr.frames then print("ERROR:Frame range out of bounds") return end
      local function visit(layer, destinationFrame)
        if layer.isGroup then
          for _, child in ipairs(layer.layers) do visit(child, destinationFrame) end
          return
        end
        if ${overwrite ? "true" : "false"} then
          local old = layer:cel(destinationFrame)
          if old then spr:deleteCel(old) end
        end
        local sourceCel = layer:cel(spr.frames[${sourceFrame}])
        if sourceCel and not layer:cel(destinationFrame) then spr:newCel(layer, destinationFrame, sourceCel.image:clone(), sourceCel.position) end
      end
      for index = ${startFrame}, ${endFrame} do
        if index ~= ${sourceFrame} then
          for _, layer in ipairs(spr.layers) do visit(layer, spr.frames[index]) end
        end
      end
    `);
    return result(await this.runLua(script, source), `Frame ${sourceFrame} propagated to frames ${startFrame}-${endFrame} in ${source}`);
  }

  public async deleteFrame(filename: string, frameIndex: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      if #spr.frames <= 1 then print("ERROR:Cannot delete the only frame") return end
      spr:deleteFrame(spr.frames[${frameIndex}])
    `);
    return result(await this.runLua(script, source), `Frame ${frameIndex} deleted from ${source}`);
  }

  public async deleteTag(filename: string, name: string): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const tagName = validateName(name, "Tag name");
    if (typeof tagName !== "string") return tagName;
    const script = this.openScript(source, `
      local target = nil
      for _, tag in ipairs(spr.tags) do if tag.name == "${luaEscape(tagName)}" then target = tag break end end
      if not target then print("ERROR:Tag not found") return end
      spr:deleteTag(target)
    `);
    return result(await this.runLua(script, source), `Tag '${tagName}' deleted from ${source}`);
  }

  public async setOnionSkin(filename: string, enabled = true, before = 2, after = 2, opacity = 128): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!Number.isInteger(before) || !Number.isInteger(after) || before < 0 || after < 0) return { ok: false, message: "Before and after must be non-negative integers" };
    if (!Number.isInteger(opacity) || opacity < 0 || opacity > 255) return { ok: false, message: "Opacity must be between 0 and 255" };
    return { ok: true, message: `Onion skin settings are UI-only in batch mode; no changes applied (enabled=${enabled}, before=${before}, after=${after}, opacity=${opacity})` };
  }

  public async renderOnionSkin(filename: string, frameIndex: number, outputFilename: string, before = 1, after = 1, scale = 4, ghostOpacity = 100): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const output = validatePath(outputFilename);
    if (typeof output !== "string") return output;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Number.isInteger(before) || !Number.isInteger(after) || before < 0 || after < 0) return { ok: false, message: "Before and after must be non-negative integers" };
    if (!Number.isInteger(scale) || scale < 1 || scale > 64) return { ok: false, message: "Scale must be between 1 and 64" };
    if (!Number.isInteger(ghostOpacity) || ghostOpacity < 0 || ghostOpacity > 255) return { ok: false, message: "Ghost opacity must be between 0 and 255" };
    const target = output.toLowerCase().endsWith(".png") ? output : `${output}.png`;
    const script = `
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local clone = Sprite(spr)
      clone:flatten()
      local layer = clone.layers[#clone.layers]
      local function frame_image(index)
        local image = Image(clone.width, clone.height, ColorMode.RGB)
        local cel = layer:cel(clone.frames[index])
        if cel then image:drawImage(cel.image, cel.position) end
        return image
      end
      local composite = Image(clone.width, clone.height, ColorMode.RGB)
      local white = Color(255, 255, 255, 255)
      for py = 0, composite.height - 1 do for px = 0, composite.width - 1 do composite:putPixel(px, py, white) end end
      for offset = ${before}, 1, -1 do
        local index = ${frameIndex} - offset
        if index >= 1 then composite:drawImage(frame_image(index), Point(0, 0), ${ghostOpacity}, BlendMode.NORMAL) end
      end
      for offset = ${after}, 1, -1 do
        local index = ${frameIndex} + offset
        if index <= #clone.frames then composite:drawImage(frame_image(index), Point(0, 0), ${ghostOpacity}, BlendMode.NORMAL) end
      end
      composite:drawImage(frame_image(${frameIndex}), Point(0, 0), 255, BlendMode.NORMAL)
      local large = Image(composite.width * ${scale}, composite.height * ${scale}, ColorMode.RGB)
      for py = 0, composite.height - 1 do
        for px = 0, composite.width - 1 do
          local value = composite:getPixel(px, py)
          for oy = 0, ${scale - 1} do for ox = 0, ${scale - 1} do large:putPixel(px * ${scale} + ox, py * ${scale} + oy, value) end end
        end
      end
      large:saveAs("${luaEscape(target.replaceAll("\\", "/"))}")
      print("OK")
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return result(command, `Onion-skin render saved to ${target}`);
    const produced = await this.findProducedOutput(target);
    if (!produced) return { ok: false, message: `Aseprite exited successfully but did not create ${target}` };
    if (produced !== target) await fs.rename(produced, target);
    return { ok: true, message: `Onion-skin render of frame ${frameIndex} saved to ${target} at ${scale}x` };
  }

  public async compareFrames(filename: string, frameA: number, frameB: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameA) || !isPositiveInteger(frameB)) return { ok: false, message: "Frame A and frame B must be positive integers" };
    const script = `
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      if ${frameA} > #spr.frames or ${frameB} > #spr.frames then print("ERROR:Frame index out of range") return end
      local clone = Sprite(spr)
      clone:flatten()
      local layer = clone.layers[#clone.layers]
      local function frame_image(index)
        local image = Image(clone.width, clone.height, ColorMode.RGB)
        local cel = layer:cel(clone.frames[index])
        if cel then image:drawImage(cel.image, cel.position) end
        return image
      end
      local first = frame_image(${frameA})
      local second = frame_image(${frameB})
      local changed = 0
      local minX, minY = math.huge, math.huge
      local maxX, maxY = -1, -1
      for py = 0, first.height - 1 do
        for px = 0, first.width - 1 do
          local left = first:getPixel(px, py)
          local right = second:getPixel(px, py)
          local different = app.pixelColor.rgbaR(left) ~= app.pixelColor.rgbaR(right) or app.pixelColor.rgbaG(left) ~= app.pixelColor.rgbaG(right) or app.pixelColor.rgbaB(left) ~= app.pixelColor.rgbaB(right) or app.pixelColor.rgbaA(left) ~= app.pixelColor.rgbaA(right)
          if different then
            changed = changed + 1
            if px < minX then minX = px end
            if py < minY then minY = py end
            if px > maxX then maxX = px end
            if py > maxY then maxY = py end
          end
        end
      end
      local total = first.width * first.height
      local percent = total > 0 and (changed * 100.0 / total) or 0
      local bounds = changed > 0 and string.format("{\\"minX\\":%d,\\"minY\\":%d,\\"maxX\\":%d,\\"maxY\\":%d}", minX, minY, maxX, maxY) or "null"
      print(string.format("COMPARE:{\\"frameA\\":%d,\\"frameB\\":%d,\\"changedPixels\\":%d,\\"totalPixels\\":%d,\\"percentChanged\\":%.2f,\\"bounds\\":%s}", ${frameA}, ${frameB}, changed, total, percent, bounds))
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return result(command, "Frame comparison failed");
    const line = command.output.split(/\r?\n/).find((entry) => entry.startsWith("COMPARE:"));
    return line ? { ok: true, message: line.slice("COMPARE:".length) } : { ok: false, message: "Frame comparison returned no metrics" };
  }

  public async setCelOpacity(filename: string, layerName: string, frameIndex: number, opacity: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Number.isInteger(opacity) || opacity < 0 || opacity > 255) return { ok: false, message: "Opacity must be between 0 and 255" };
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local cel = target:cel(spr.frames[${frameIndex}])
      if not cel then print("ERROR:No cel at that layer/frame") return end
      cel.opacity = ${opacity}
    `);
    return result(await this.runLua(script, source), `Cel opacity set to ${opacity} on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async getColorStats(filename: string, frameIndex = 1, top = 16): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!isPositiveInteger(top)) return { ok: false, message: "Top must be a positive integer" };
    const script = `
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local clone = Sprite(spr)
      clone:flatten()
      local layer = clone.layers[#clone.layers]
      local image = Image(clone.width, clone.height, ColorMode.RGB)
      local cel = layer:cel(clone.frames[${frameIndex}])
      if cel then image:drawImage(cel.image, cel.position) end
      local counts = {}
      local opaque = 0
      for py = 0, image.height - 1 do
        for px = 0, image.width - 1 do
          local value = image:getPixel(px, py)
          if app.pixelColor.rgbaA(value) > 0 then
            opaque = opaque + 1
            local hex = string.format("#%02X%02X%02X", app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value))
            counts[hex] = (counts[hex] or 0) + 1
          end
        end
      end
      local unique = 0
      for hex, count in pairs(counts) do unique = unique + 1 print("COLOR:" .. hex .. "," .. count) end
      print("OPAQUE:" .. opaque)
      print("UNIQUE:" .. unique)
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return result(command, "Color stats failed");
    const colors: Array<{ color: string; count: number }> = [];
    let opaque = 0;
    let unique = 0;
    for (const line of command.output.split(/\r?\n/)) {
      if (line.startsWith("COLOR:")) {
        const [color, count] = line.slice(6).split(",");
        if (color && count) colors.push({ color, count: Number.parseInt(count, 10) });
      } else if (line.startsWith("OPAQUE:")) opaque = Number.parseInt(line.slice(7), 10);
      else if (line.startsWith("UNIQUE:")) unique = Number.parseInt(line.slice(7), 10);
    }
    colors.sort((left, right) => right.count - left.count);
    return { ok: true, message: JSON.stringify({ frame: frameIndex, uniqueColors: unique, opaquePixels: opaque, colors: colors.slice(0, top) }) };
  }

  public async getPalette(filename: string): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const script = `
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      local palette = spr.palettes[1]
      if not palette then print("ERROR:No palette") return end
      for index = 0, #palette - 1 do
        local color = palette:getColor(index)
        print(string.format("PALETTE:#%02X%02X%02X", color.red, color.green, color.blue))
      end
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return result(command, "Palette read failed");
    const colors = command.output.split(/\r?\n/).filter((line) => line.startsWith("PALETTE:")).map((line) => line.slice(8));
    return colors.length ? { ok: true, message: JSON.stringify(colors) } : { ok: false, message: "Palette read returned no colors" };
  }

  public async extractPalette(filename: string, maxColors = 16, withAlpha = false): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!Number.isInteger(maxColors) || maxColors < 1 || maxColors > 256) return { ok: false, message: "Max colors must be between 1 and 256" };
    const script = this.openScript(source, `
      app.command.ColorQuantization { ui = false, maxColors = ${maxColors}, withAlpha = ${withAlpha ? "true" : "false"} }
      local palette = spr.palettes[1]
      if not palette then print("ERROR:No palette") return end
      for index = 0, #palette - 1 do
        local color = palette:getColor(index)
        print(string.format("PALETTE:#%02X%02X%02X", color.red, color.green, color.blue))
      end
    `);
    const command = await this.runLua(script, source);
    if (!command.ok) return result(command, "Palette extraction failed");
    const colors = command.output.split(/\r?\n/).filter((line) => line.startsWith("PALETTE:")).map((line) => line.slice(8));
    return colors.length ? { ok: true, message: JSON.stringify({ colors, count: colors.length }) } : { ok: false, message: "Palette extraction returned no colors" };
  }

  public async remapColorsInCelRange(filename: string, layerName: string, startFrame: number, endFrame: number, mappings: Array<{ from: string; to: string }>, createMissingCels = false, sourceFrameIndex?: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const rangeError = validateFrameRange(startFrame, endFrame);
    if (rangeError) return { ok: false, message: rangeError };
    if (!Array.isArray(mappings) || mappings.length === 0) return { ok: false, message: "Mappings list cannot be empty" };
    if (sourceFrameIndex !== undefined && !isPositiveInteger(sourceFrameIndex)) return { ok: false, message: "Source frame index must be a positive integer" };
    const parsedMappings: number[][] = [];
    for (const mapping of mappings) {
      const from = this.parseHexColor(mapping.from);
      const to = this.parseHexColor(mapping.to);
      if (!from || !to) return { ok: false, message: "Mappings must use hexadecimal values" };
      parsedMappings.push([from[0], from[1], from[2], to[0], to[1], to[2]]);
    }
    const map = parsedMappings.map((mapping) => `{${mapping.join(",")}}`).join(", ");
    const sourceIndex = sourceFrameIndex ?? startFrame;
    const script = this.openScript(source, `
      if ${endFrame} > #spr.frames then print("ERROR:Frame range out of bounds") return end
      if ${sourceIndex} < 1 or ${sourceIndex} > #spr.frames then print("ERROR:Source frame out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local mappings = { ${map} }
      for frameIndex = ${startFrame}, ${endFrame} do
        local cel = target:cel(spr.frames[frameIndex])
        if not cel and ${createMissingCels ? "true" : "false"} then
          local sourceCel = target:cel(spr.frames[${sourceIndex}])
          if sourceCel then cel = spr:newCel(target, spr.frames[frameIndex], sourceCel.image:clone(), sourceCel.position)
          else cel = spr:newCel(target, spr.frames[frameIndex], Image(spr.width, spr.height, spr.colorMode), Point(0, 0)) end
        end
        if cel then
          local img = cel.image
          for py = 0, img.height - 1 do
            for px = 0, img.width - 1 do
              local value = img:getPixel(px, py)
              local alpha = app.pixelColor.rgbaA(value)
              if alpha > 0 then
                local red, green, blue = app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value)
                for _, mapping in ipairs(mappings) do
                  if red == mapping[1] and green == mapping[2] and blue == mapping[3] then
                    img:putPixel(px, py, app.pixelColor.rgba(mapping[4], mapping[5], mapping[6], alpha))
                    break
                  end
                end
              end
            end
          end
        end
      end
    `);
    return result(await this.runLua(script, source), `Remapped colors on '${name}' frames ${startFrame}-${endFrame} in ${source}`);
  }

  public async listPalettePresets(): Promise<AsepriteResult> {
    return { ok: true, message: JSON.stringify(PALETTE_PRESETS) };
  }

  public async applyPalettePreset(filename: string, preset: string): Promise<AsepriteResult> {
    const colors = PALETTE_PRESETS[preset.trim().toLowerCase()];
    if (!colors) return { ok: false, message: `Unknown palette preset: ${preset}` };
    const applied = await this.setPalette(filename, colors);
    return applied.ok ? { ok: true, message: `Palette preset '${preset}' (${colors.length} colors) applied to ${filename}` } : applied;
  }

  public async generateColorRamp(baseColor: string, steps = 5, hueShiftDegrees = 20, lightnessRange = 0.5): Promise<AsepriteResult> {
    const rgb = this.parseHexColor(baseColor);
    if (!rgb) return { ok: false, message: "Colors must use hexadecimal values" };
    if (!Number.isInteger(steps) || steps < 2 || steps > 16) return { ok: false, message: "Steps must be between 2 and 16" };
    if (!Number.isFinite(hueShiftDegrees)) return { ok: false, message: "Hue shift must be a finite number" };
    if (!Number.isFinite(lightnessRange) || lightnessRange < 0 || lightnessRange > 1) return { ok: false, message: "Lightness range must be between 0 and 1" };
    const [hue, saturation, lightness] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    const middle = (steps - 1) / 2;
    const ramp = Array.from({ length: steps }, (_, index) => {
      const t = (index - middle) / (steps - 1);
      const shiftedHue = ((hue - t * (hueShiftDegrees / 360)) % 1 + 1) % 1;
      const shiftedLightness = Math.min(1, Math.max(0, lightness + t * lightnessRange));
      const shiftedSaturation = Math.min(1, Math.max(0, saturation - t * 0.15));
      return hslToHex(shiftedHue, shiftedSaturation, shiftedLightness);
    });
    return { ok: true, message: JSON.stringify(ramp) };
  }

  public async quantizeToPalette(filename: string, layerName = "", startFrame = 1, endFrame = 0): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(startFrame) || !Number.isInteger(endFrame) || endFrame < 0 || (endFrame > 0 && endFrame < startFrame)) return { ok: false, message: "Frame range must start at 1 and end at or after the start" };
    const lastFrame = endFrame > 0 ? endFrame : "#spr.frames";
    const escapedLayer = luaEscape(layerName);
    const script = this.openScript(source, `
      local palette = spr.palettes[1]
      if not palette or #palette == 0 then print("ERROR:No palette") return end
      if ${startFrame} < 1 or ${lastFrame} > #spr.frames then print("ERROR:Frame range out of bounds") return end
      local layers = {}
      if "${escapedLayer}" ~= "" then
        local target = find_layer(spr, "${escapedLayer}")
        if not target or target.isGroup then print("ERROR:Layer not found") return end
        table.insert(layers, target)
      else
        for _, layer in ipairs(spr.layers) do if layer.isImage then table.insert(layers, layer) end end
      end
      local colors = {}
      for index = 0, #palette - 1 do local color = palette:getColor(index) table.insert(colors, {color.red, color.green, color.blue}) end
      local cache = {}
      local function nearest(red, green, blue)
        local key = red * 65536 + green * 256 + blue
        if cache[key] then return cache[key] end
        local best, bestDistance = colors[1], math.huge
        for _, color in ipairs(colors) do
          local dr, dg, db = red - color[1], green - color[2], blue - color[3]
          local distance = dr * dr + dg * dg + db * db
          if distance < bestDistance then best, bestDistance = color, distance end
        end
        cache[key] = best
        return best
      end
      local count = 0
      for _, layer in ipairs(layers) do
        for frameIndex = ${startFrame}, ${lastFrame} do
          local cel = layer:cel(spr.frames[frameIndex])
          if cel then
            local img = cel.image
            for py = 0, img.height - 1 do
              for px = 0, img.width - 1 do
                local value = img:getPixel(px, py)
                local alpha = app.pixelColor.rgbaA(value)
                if alpha > 0 then
                  local red, green, blue = app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value)
                  local nearestColor = nearest(red, green, blue)
                  if nearestColor[1] ~= red or nearestColor[2] ~= green or nearestColor[3] ~= blue then
                    img:putPixel(px, py, app.pixelColor.rgba(nearestColor[1], nearestColor[2], nearestColor[3], alpha))
                    count = count + 1
                  end
                end
              end
            end
          end
        end
      end
      print("COUNT:" .. count)
    `);
    const command = await this.runLua(script, source);
    if (!command.ok) return { ok: false, message: command.output };
    const count = command.output.split(/\r?\n/).find((line) => line.startsWith("COUNT:"))?.slice(6) ?? "?";
    return { ok: true, message: `Quantized ${count} pixels to the palette in ${source}` };
  }

  public async setColorMode(filename: string, mode: string): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const normalizedMode = mode.trim().toLowerCase();
    if (!["rgb", "grayscale", "indexed"].includes(normalizedMode)) return { ok: false, message: "Mode must be 'rgb', 'grayscale', or 'indexed'" };
    const script = this.openScript(source, `app.command.ChangePixelFormat { format = "${normalizedMode}" }`);
    return result(await this.runLua(script, source), `Color mode set to ${normalizedMode} in ${source}`);
  }

  public async getPixelColor(filename: string, x: number, y: number, layerName = "", frameIndex = 1): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const name = layerName.trim();
    const script = `
      local function find_layer(parent, wanted)
        for _, layer in ipairs(parent.layers) do
          if layer.name == wanted then return layer end
          if layer.isGroup then local nested = find_layer(layer, wanted) if nested then return nested end end
        end
        return nil
      end
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      if ${frameIndex} < 1 or ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local cel = nil
      if "${luaEscape(name)}" ~= "" then
        local target = find_layer(spr, "${luaEscape(name)}")
        if not target or target.isGroup then print("ERROR:Layer not found") return end
        cel = target:cel(spr.frames[${frameIndex}])
        if not cel then print("ERROR:No cel at that layer/frame") return end
      else
        app.activeFrame = spr.frames[${frameIndex}]
        cel = app.activeCel
        if not cel then print("ERROR:No active cel") return end
      end
      local img = cel.image
      local cx, cy = ${x} - cel.position.x, ${y} - cel.position.y
      local red, green, blue, alpha = 0, 0, 0, 0
      if cx >= 0 and cy >= 0 and cx < img.width and cy < img.height then
        local value = img:getPixel(cx, cy)
        red, green, blue, alpha = app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value), app.pixelColor.rgbaA(value)
      end
      print(string.format("PIXEL:%d,%d,%d,%d", red, green, blue, alpha))
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return { ok: false, message: `Failed to read pixel: ${command.output}` };
    const line = command.output.split(/\r?\n/).find((entry) => entry.startsWith("PIXEL:"));
    if (!line) return { ok: false, message: "No pixel data returned" };
    const fields = parsePixelFields(line.slice(6), 4);
    if (!fields) return { ok: false, message: "Invalid pixel data returned" };
    const [red, green, blue, alpha] = fields as [number, number, number, number];
    const hex = `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
    return { ok: true, message: `${hex} (r=${red}, g=${green}, b=${blue}, a=${alpha})` };
  }

  public async getPixelsRect(filename: string, x: number, y: number, width: number, height: number, layerName = "", frameIndex = 1): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const name = layerName.trim();
    const script = `
      local function find_layer(parent, wanted)
        for _, layer in ipairs(parent.layers) do
          if layer.name == wanted then return layer end
          if layer.isGroup then local nested = find_layer(layer, wanted) if nested then return nested end end
        end
        return nil
      end
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      if ${frameIndex} < 1 or ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local cel = nil
      if "${luaEscape(name)}" ~= "" then
        local target = find_layer(spr, "${luaEscape(name)}")
        if not target or target.isGroup then print("ERROR:Layer not found") return end
        cel = target:cel(spr.frames[${frameIndex}])
        if not cel then print("ERROR:No cel at that layer/frame") return end
      else
        app.activeFrame = spr.frames[${frameIndex}]
        cel = app.activeCel
        if not cel then print("ERROR:No active cel") return end
      end
      local img, offsetX, offsetY = cel.image, cel.position.x, cel.position.y
      for py = ${y}, ${y + height - 1} do
        for px = ${x}, ${x + width - 1} do
          local cx, cy = px - offsetX, py - offsetY
          local red, green, blue, alpha = 0, 0, 0, 0
          if cx >= 0 and cy >= 0 and cx < img.width and cy < img.height then
            local value = img:getPixel(cx, cy)
            red, green, blue, alpha = app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value), app.pixelColor.rgbaA(value)
          end
          print(string.format("PIXEL:%d,%d,%d,%d,%d,%d", px, py, red, green, blue, alpha))
        end
      end
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return { ok: false, message: `Failed to read pixels: ${command.output}` };
    const pixels = command.output.split(/\r?\n/).filter((entry) => entry.startsWith("PIXEL:")).map((entry) => {
      const fields = parsePixelFields(entry.slice(6), 6);
      if (!fields) return undefined;
      const [px, py, red, green, blue, alpha] = fields as [number, number, number, number, number, number];
      return { x: px, y: py, hex: `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`, r: red, g: green, b: blue, a: alpha };
    }).filter((pixel): pixel is { x: number; y: number; hex: string; r: number; g: number; b: number; a: number } => pixel !== undefined);
    return pixels.length ? { ok: true, message: JSON.stringify(pixels) } : { ok: false, message: "No pixel data returned" };
  }

  public async getCompositePixel(filename: string, x: number, y: number, frameIndex = 1): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const script = `
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      if ${frameIndex} < 1 or ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local clone = Sprite(spr)
      clone:flatten()
      local cel = clone.layers[1]:cel(clone.frames[${frameIndex}])
      if not cel then print("ERROR:No composite cel") return end
      local img = cel.image
      local red, green, blue, alpha = 0, 0, 0, 0
      if ${x} >= 0 and ${y} >= 0 and ${x} < img.width and ${y} < img.height then
        local value = img:getPixel(${x}, ${y})
        red, green, blue, alpha = app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value), app.pixelColor.rgbaA(value)
      end
      print(string.format("PIXEL:%d,%d,%d,%d", red, green, blue, alpha))
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return { ok: false, message: `Failed to read composite pixel: ${command.output}` };
    const line = command.output.split(/\r?\n/).find((entry) => entry.startsWith("PIXEL:"));
    if (!line) return { ok: false, message: "No pixel data returned" };
    const fields = parsePixelFields(line.slice(6), 4);
    if (!fields) return { ok: false, message: "Invalid pixel data returned" };
    const [red, green, blue, alpha] = fields as [number, number, number, number];
    const hex = `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
    return { ok: true, message: `${hex} (r=${red}, g=${green}, b=${blue}, a=${alpha})` };
  }

  public async getCompositeRect(filename: string, x: number, y: number, width: number, height: number, frameIndex = 1): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const script = `
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      if ${frameIndex} < 1 or ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local clone = Sprite(spr)
      clone:flatten()
      local cel = clone.layers[1]:cel(clone.frames[${frameIndex}])
      if not cel then print("ERROR:No composite cel") return end
      local img = cel.image
      for py = ${y}, ${y + height - 1} do
        for px = ${x}, ${x + width - 1} do
          local red, green, blue, alpha = 0, 0, 0, 0
          if px >= 0 and py >= 0 and px < img.width and py < img.height then
            local value = img:getPixel(px, py)
            red, green, blue, alpha = app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value), app.pixelColor.rgbaA(value)
          end
          print(string.format("PIXEL:%d,%d,%d,%d,%d,%d", px, py, red, green, blue, alpha))
        end
      end
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return { ok: false, message: `Failed to read composite pixels: ${command.output}` };
    const pixels = command.output.split(/\r?\n/).filter((entry) => entry.startsWith("PIXEL:")).map((entry) => {
      const fields = parsePixelFields(entry.slice(6), 6);
      if (!fields) return undefined;
      const [px, py, red, green, blue, alpha] = fields as [number, number, number, number, number, number];
      return { x: px, y: py, hex: `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`, r: red, g: green, b: blue, a: alpha };
    }).filter((pixel): pixel is { x: number; y: number; hex: string; r: number; g: number; b: number; a: number } => pixel !== undefined);
    return pixels.length ? { ok: true, message: JSON.stringify(pixels) } : { ok: false, message: "No pixel data returned" };
  }

  public async moveRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, destX: number, destY: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y, destX, destY].every(Number.isInteger)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const body = this.layerFrameScript(name, frameIndex, false, `
      local img = cel.image
      local function pset(px, py, value)
        if px >= 0 and py >= 0 and px < img.width and py < img.height then img:putPixel(px, py, value) end
      end
      local buffer = {}
      for row = 0, ${height - 1} do
        buffer[row] = {}
        for column = 0, ${width - 1} do
          local sx, sy = ${x} + column, ${y} + row
          if sx >= 0 and sy >= 0 and sx < img.width and sy < img.height then buffer[row][column] = img:getPixel(sx, sy) else buffer[row][column] = 0 end
          if sx >= 0 and sy >= 0 and sx < img.width and sy < img.height then img:putPixel(sx, sy, 0) end
        end
      end
      for row = 0, ${height - 1} do
        for column = 0, ${width - 1} do
          local value = buffer[row][column]
          if app.pixelColor.rgbaA(value) > 0 then pset(${destX} + column, ${destY} + row, value) end
        end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Moved ${width}x${height} region from (${x},${y}) to (${destX},${destY}) on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async copyRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, destX: number, destY: number, targetLayerName = "", targetFrameIndex = 0): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const targetName = validateName(targetLayerName.trim() || name, "Target layer name");
    if (typeof targetName !== "string") return targetName;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (targetFrameIndex < 0 || !Number.isInteger(targetFrameIndex)) return { ok: false, message: "Target frame index must be a positive integer or zero" };
    const resolvedTargetFrame = targetFrameIndex > 0 ? targetFrameIndex : frameIndex;
    if (![x, y, destX, destY].every(Number.isInteger)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Source frame index out of range") return end
      if ${resolvedTargetFrame} > #spr.frames then print("ERROR:Target frame index out of range") return end
      local function normalize_cel(layer, frame, create)
        local current = layer:cel(frame)
        if not current and create then current = spr:newCel(layer, frame, Image(spr.width, spr.height, spr.colorMode), Point(0, 0)) end
        if not current then return nil end
        if current.position.x ~= 0 or current.position.y ~= 0 or current.image.width ~= spr.width or current.image.height ~= spr.height then
          local normalized = Image(spr.width, spr.height, spr.colorMode)
          normalized:drawImage(current.image, current.position)
          current.image, current.position = normalized, Point(0, 0)
        end
        return current
      end
      local sourceLayer = find_layer(spr, "${luaEscape(name)}")
      local targetLayer = find_layer(spr, "${luaEscape(targetName)}")
      if not sourceLayer then print("ERROR:Source layer not found") return end
      if not targetLayer then print("ERROR:Target layer not found") return end
      local sourceCel = normalize_cel(sourceLayer, spr.frames[${frameIndex}], false)
      if not sourceCel then print("ERROR:No cel at source layer/frame") return end
      local targetCel = normalize_cel(targetLayer, spr.frames[${resolvedTargetFrame}], true)
      local sourceImage, targetImage = sourceCel.image, targetCel.image
      local buffer = {}
      for row = 0, ${height - 1} do
        buffer[row] = {}
        for column = 0, ${width - 1} do
          local sx, sy = ${x} + column, ${y} + row
          if sx >= 0 and sy >= 0 and sx < sourceImage.width and sy < sourceImage.height then buffer[row][column] = sourceImage:getPixel(sx, sy) else buffer[row][column] = 0 end
        end
      end
      for row = 0, ${height - 1} do
        for column = 0, ${width - 1} do
          local value = buffer[row][column]
          if app.pixelColor.rgbaA(value) > 0 and ${destX} + column >= 0 and ${destY} + row >= 0 and ${destX} + column < targetImage.width and ${destY} + row < targetImage.height then targetImage:putPixel(${destX} + column, ${destY} + row, value) end
        end
      end
    `);
    return result(await this.runLua(script, source), `Copied ${width}x${height} region from (${x},${y}) to (${destX},${destY}) in ${source}`);
  }

  public async eraseRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const body = this.layerFrameScript(name, frameIndex, false, `
      local img = cel.image
      for py = math.max(0, ${y}), math.min(img.height - 1, ${y + height - 1}) do
        for px = math.max(0, ${x}), math.min(img.width - 1, ${x + width - 1}) do img:putPixel(px, py, 0) end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Erased ${width}x${height} region at (${x},${y}) on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async eraseColor(filename: string, layerName: string, frameIndex: number, color: string, tolerance = 0): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255) return { ok: false, message: "Tolerance must be between 0 and 255" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue] = rgba;
    const body = this.layerFrameScript(name, frameIndex, false, `
      local count = 0
      local img = cel.image
      for py = 0, img.height - 1 do
        for px = 0, img.width - 1 do
          local value = img:getPixel(px, py)
          if app.pixelColor.rgbaA(value) > 0 and math.abs(app.pixelColor.rgbaR(value) - ${red}) <= ${tolerance} and math.abs(app.pixelColor.rgbaG(value) - ${green}) <= ${tolerance} and math.abs(app.pixelColor.rgbaB(value) - ${blue}) <= ${tolerance} then
            img:putPixel(px, py, 0)
            count = count + 1
          end
        end
      end
      print("COUNT:" .. count)
    `);
    const command = await this.runLua(this.openScript(source, body), source);
    if (!command.ok) return { ok: false, message: command.output };
    const count = command.output.split(/\r?\n/).find((line) => line.startsWith("COUNT:"))?.slice(6) ?? "?";
    return { ok: true, message: `Erased ${count} pixels of ${color} on '${name}' frame ${frameIndex} in ${source}` };
  }

  public async flipLayer(filename: string, layerName: string, frameIndex: number, direction: "horizontal" | "vertical" = "horizontal"): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (direction !== "horizontal" && direction !== "vertical") return { ok: false, message: "Direction must be 'horizontal' or 'vertical'" };
    const body = `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local cel = target:cel(spr.frames[${frameIndex}])
      if not cel then print("ERROR:No cel at that layer/frame") return end
      local img = cel.image
      local pixels = {}
      for py = 0, img.height - 1 do
        pixels[py] = {}
        for px = 0, img.width - 1 do pixels[py][px] = img:getPixel(px, py) end
      end
      for py = 0, img.height - 1 do
        for px = 0, img.width - 1 do
          ${direction === "horizontal" ? "img:putPixel(px, py, pixels[py][img.width - 1 - px])" : "img:putPixel(px, py, pixels[img.height - 1 - py][px])"}
        end
      end
    `;
    return result(await this.runLua(this.openScript(source, body), source), `Layer '${name}' flipped ${direction}ly in ${source}`);
  }

  public async rotateLayer(filename: string, layerName: string, frameIndex: number, angle: 90 | 180 | 270 = 90): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (angle !== 90 && angle !== 180 && angle !== 270) return { ok: false, message: "Angle must be 90, 180, or 270" };
    const rotateBody = angle === 180 ? `
      local img = cel.image
      local pixels = {}
      for py = 0, img.height - 1 do
        pixels[py] = {}
        for px = 0, img.width - 1 do pixels[py][px] = img:getPixel(px, py) end
      end
      for py = 0, img.height - 1 do
        for px = 0, img.width - 1 do img:putPixel(px, py, pixels[img.height - 1 - py][img.width - 1 - px]) end
      end
    ` : `
      local img = cel.image
      local new_img = Image(img.height, img.width, img.colorMode)
      for py = 0, img.height - 1 do
        for px = 0, img.width - 1 do
          ${angle === 90 ? "new_img:putPixel(img.height - 1 - py, px, img:getPixel(px, py))" : "new_img:putPixel(py, img.width - 1 - px, img:getPixel(px, py))"}
        end
      end
      cel.image = new_img
    `;
    const body = `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local cel = target:cel(spr.frames[${frameIndex}])
      if not cel then print("ERROR:No cel at that layer/frame") return end
      ${rotateBody}
    `;
    return result(await this.runLua(this.openScript(source, body), source), `Layer '${name}' rotated ${angle}° clockwise in ${source}`);
  }

  public async resizeCanvas(filename: string, width: number, height: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const script = this.openScript(source, `spr:resize(${width}, ${height})`);
    return result(await this.runLua(script, source), `Canvas resized to ${width}x${height} in ${source}`);
  }

  public async cropCanvas(filename: string, x: number, y: number, width: number, height: number): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Crop coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const script = this.openScript(source, `
      if ${x} >= spr.width or ${y} >= spr.height or ${x + width} <= 0 or ${y + height} <= 0 then print("ERROR:Crop rect is fully outside the canvas") return end
      spr:crop(${x}, ${y}, ${width}, ${height})
    `);
    return result(await this.runLua(script, source), `Canvas cropped to (${x},${y}) ${width}x${height} in ${source}`);
  }

  public async outlineNative(filename: string, layerName = "", frameIndex = 1, color = "#000000", place = "outside", matrix = "circle"): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (place !== "outside" && place !== "inside") return { ok: false, message: "Place must be 'outside' or 'inside'" };
    if (matrix !== "circle" && matrix !== "square") return { ok: false, message: "Matrix must be 'circle' or 'square'" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue] = rgba;
    const script = this.nativeScript(layerName, frameIndex, `app.command.Outline { ui = false, color = Color { r = ${red}, g = ${green}, b = ${blue}, a = 255 }, place = "${place}", matrix = "${matrix}" }`);
    return result(await this.runLua(script, source), `Outlined (${place}, ${matrix}) ${layerName || "active layer"} in ${source}`);
  }

  public async adjustHslNative(filename: string, layerName = "", frameIndex = 1, hue = 0, saturation = 0, lightness = 0, x = 0, y = 0, width = 0, height = 0): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Number.isInteger(hue) || hue < -180 || hue > 180) return { ok: false, message: "Hue must be between -180 and 180" };
    if (![saturation, lightness].every((value) => Number.isInteger(value) && value >= -100 && value <= 100)) return { ok: false, message: "Saturation and lightness must be between -100 and 100" };
    const regionError = validateNativeRegion(x, y, width, height);
    if (regionError) return regionError;
    const region = width > 0 ? [x, y, width, height] as [number, number, number, number] : undefined;
    const script = this.nativeScript(layerName, frameIndex, `app.command.HueSaturation { ui = false, hue = ${hue}, saturation = ${saturation}, lightness = ${lightness}, alpha = 0 }`, region);
    return result(await this.runLua(script, source), `Adjusted HSL on ${layerName || "active layer"} in ${source}`);
  }

  public async adjustBrightnessContrast(filename: string, layerName = "", frameIndex = 1, brightness = 0, contrast = 0, x = 0, y = 0, width = 0, height = 0): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![brightness, contrast].every((value) => Number.isInteger(value) && value >= -100 && value <= 100)) return { ok: false, message: "Brightness and contrast must be between -100 and 100" };
    const regionError = validateNativeRegion(x, y, width, height);
    if (regionError) return regionError;
    const region = width > 0 ? [x, y, width, height] as [number, number, number, number] : undefined;
    const script = this.nativeScript(layerName, frameIndex, `app.command.BrightnessContrast { ui = false, brightness = ${brightness}, contrast = ${contrast} }`, region);
    return result(await this.runLua(script, source), `Adjusted brightness/contrast on ${layerName || "active layer"} in ${source}`);
  }

  public async invertColors(filename: string, layerName = "", frameIndex = 1, x = 0, y = 0, width = 0, height = 0): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const regionError = validateNativeRegion(x, y, width, height);
    if (regionError) return regionError;
    const region = width > 0 ? [x, y, width, height] as [number, number, number, number] : undefined;
    const script = this.nativeScript(layerName, frameIndex, "app.command.InvertColor { ui = false }", region);
    return result(await this.runLua(script, source), `Inverted colours on ${layerName || "active layer"} in ${source}`);
  }

  public async outlineCel(filename: string, layerName: string, frameIndex: number, color = "#000000", includeDiagonals = false): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue] = rgba;
    const body = this.layerFrameScript(name, frameIndex, false, `
      local img = cel.image
      local src = img:clone()
      local outline = Color(${red}, ${green}, ${blue}, 255)
      local function opaque(px, py)
        if px < 0 or py < 0 or px >= src.width or py >= src.height then return false end
        return app.pixelColor.rgbaA(src:getPixel(px, py)) > 0
      end
      for py = 0, img.height - 1 do
        for px = 0, img.width - 1 do
          if app.pixelColor.rgbaA(src:getPixel(px, py)) == 0 then
            local touch = opaque(px - 1, py) or opaque(px + 1, py) or opaque(px, py - 1) or opaque(px, py + 1)
            if not touch and ${includeDiagonals ? "true" : "false"} then
              touch = opaque(px - 1, py - 1) or opaque(px + 1, py - 1) or opaque(px - 1, py + 1) or opaque(px + 1, py + 1)
            end
            if touch then img:putPixel(px, py, outline) end
          end
        end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Outline added to '${name}' frame ${frameIndex} in ${source}`);
  }

  public async replaceColor(filename: string, layerName: string, frameIndex: number, fromColor: string, toColor: string, tolerance = 0): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255) return { ok: false, message: "Tolerance must be between 0 and 255" };
    const from = this.parseHexColor(fromColor);
    const to = this.parseHexColor(toColor);
    if (!from || !to) return { ok: false, message: "Colors must use hexadecimal values" };
    const [fromRed, fromGreen, fromBlue] = from;
    const [toRed, toGreen, toBlue] = to;
    const body = this.layerFrameScript(name, frameIndex, false, `
      local count = 0
      local img = cel.image
      for py = 0, img.height - 1 do
        for px = 0, img.width - 1 do
          local value = img:getPixel(px, py)
          local alpha = app.pixelColor.rgbaA(value)
          if alpha > 0 then
            local redDistance = math.abs(app.pixelColor.rgbaR(value) - ${fromRed})
            local greenDistance = math.abs(app.pixelColor.rgbaG(value) - ${fromGreen})
            local blueDistance = math.abs(app.pixelColor.rgbaB(value) - ${fromBlue})
            if redDistance <= ${tolerance} and greenDistance <= ${tolerance} and blueDistance <= ${tolerance} then
              img:putPixel(px, py, app.pixelColor.rgba(${toRed}, ${toGreen}, ${toBlue}, alpha))
              count = count + 1
            end
          end
        end
      end
      print("COUNT:" .. count)
    `);
    const command = await this.runLua(this.openScript(source, body), source);
    if (!command.ok) return { ok: false, message: command.output };
    const count = command.output.split(/\r?\n/).find((line) => line.startsWith("COUNT:"))?.slice(6) ?? "?";
    return { ok: true, message: `Replaced ${count} pixels ${fromColor} -> ${toColor} on '${name}' frame ${frameIndex} in ${source}` };
  }

  public async adjustHsl(filename: string, layerName: string, frameIndex: number, hueShift = 0, saturationShift = 0, lightnessShift = 0): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![hueShift, saturationShift, lightnessShift].every(Number.isFinite)) return { ok: false, message: "HSL shifts must be finite numbers" };
    if (hueShift < -360 || hueShift > 360) return { ok: false, message: "Hue shift must be between -360 and 360" };
    if (saturationShift < -100 || saturationShift > 100) return { ok: false, message: "Saturation shift must be between -100 and 100" };
    if (lightnessShift < -100 || lightnessShift > 100) return { ok: false, message: "Lightness shift must be between -100 and 100" };
    const body = this.layerFrameScript(name, frameIndex, false, `
      local function rgb_to_hsl(red, green, blue)
        red, green, blue = red / 255, green / 255, blue / 255
        local maxc = math.max(red, green, blue)
        local minc = math.min(red, green, blue)
        local lightness = (maxc + minc) / 2
        if maxc == minc then return 0, 0, lightness end
        local delta = maxc - minc
        local saturation
        if lightness > 0.5 then saturation = delta / (2 - maxc - minc) else saturation = delta / (maxc + minc) end
        local hue
        if maxc == red then
          hue = (green - blue) / delta
          if green < blue then hue = hue + 6 end
        elseif maxc == green then hue = (blue - red) / delta + 2
        else hue = (red - green) / delta + 4 end
        return hue * 60, saturation, lightness
      end
      local function hsl_to_rgb(hue, saturation, lightness)
        hue = hue % 360
        if saturation <= 0 then
          local value = math.floor(lightness * 255 + 0.5)
          return value, value, value
        end
        local chroma = (1 - math.abs(2 * lightness - 1)) * saturation
        local sector = hue / 60
        local secondary = chroma * (1 - math.abs(sector % 2 - 1))
        local red1, green1, blue1 = 0, 0, 0
        if sector < 1 then red1, green1, blue1 = chroma, secondary, 0
        elseif sector < 2 then red1, green1, blue1 = secondary, chroma, 0
        elseif sector < 3 then red1, green1, blue1 = 0, chroma, secondary
        elseif sector < 4 then red1, green1, blue1 = 0, secondary, chroma
        elseif sector < 5 then red1, green1, blue1 = secondary, 0, chroma
        else red1, green1, blue1 = chroma, 0, secondary end
        local match = lightness - chroma / 2
        return math.floor((red1 + match) * 255 + 0.5), math.floor((green1 + match) * 255 + 0.5), math.floor((blue1 + match) * 255 + 0.5)
      end
      local img = cel.image
      for py = 0, img.height - 1 do
        for px = 0, img.width - 1 do
          local value = img:getPixel(px, py)
          local alpha = app.pixelColor.rgbaA(value)
          if alpha > 0 then
            local hue, saturation, lightness = rgb_to_hsl(app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value))
            local red, green, blue = hsl_to_rgb(hue + ${hueShift}, math.min(1, math.max(0, saturation + (${saturationShift}) / 100)), math.min(1, math.max(0, lightness + (${lightnessShift}) / 100)))
            img:putPixel(px, py, app.pixelColor.rgba(red, green, blue, alpha))
          end
        end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Adjusted HSL (h${hueShift >= 0 ? "+" : ""}${hueShift}, s${saturationShift >= 0 ? "+" : ""}${saturationShift}, l${lightnessShift >= 0 ? "+" : ""}${lightnessShift}) on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async applyConvolution(filename: string, matrix: string, layerName = "", frameIndex = 1, x = 0, y = 0, width = 0, height = 0): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!CONVOLUTION_MATRICES.has(matrix)) return { ok: false, message: `Unknown convolution matrix: ${matrix}` };
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const regionError = validateNativeRegion(x, y, width, height);
    if (regionError) return regionError;
    const region = width > 0 ? [x, y, width, height] as [number, number, number, number] : undefined;
    const script = this.nativeScript(layerName, frameIndex, `app.command.ConvolutionMatrix { ui = false, fromResource = "${luaEscape(matrix)}" }`, region);
    return result(await this.runLua(script, source), `Applied convolution '${matrix}' on ${layerName || "active layer"} in ${source}`);
  }

  public async listConvolutionMatrices(): Promise<AsepriteResult> {
    return { ok: true, message: JSON.stringify([...CONVOLUTION_MATRICES].sort()) };
  }

  public async applyDitherGradient(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorStart: string, colorEnd: string, horizontal = false, createIfMissing = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const start = this.parseHexColor(colorStart);
    const end = this.parseHexColor(colorEnd);
    if (!start || !end) return { ok: false, message: "Colors must use hexadecimal values" };
    const [startRed, startGreen, startBlue, startAlpha] = start;
    const [endRed, endGreen, endBlue, endAlpha] = end;
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      local img = cel.image
      local function pset(image, px, py, value)
        if px >= 0 and py >= 0 and px < image.width and py < image.height then image:putPixel(px, py, value) end
      end
      local bayer = {
        { 0, 8, 2, 10 },
        { 12, 4, 14, 6 },
        { 3, 11, 1, 9 },
        { 15, 7, 13, 5 },
      }
      for offsetY = 0, ${height - 1} do
        for offsetX = 0, ${width - 1} do
          local progress = ${horizontal ? `((${width} > 1) and (offsetX / (${width} - 1)) or 0)` : `((${height} > 1) and (offsetY / (${height} - 1)) or 0)`}
          local threshold = (bayer[(${y} + offsetY) % 4 + 1][(${x} + offsetX) % 4 + 1] + 0.5) / 16
          local color = progress >= threshold and Color(${endRed}, ${endGreen}, ${endBlue}, ${endAlpha}) or Color(${startRed}, ${startGreen}, ${startBlue}, ${startAlpha})
          pset(img, ${x} + offsetX, ${y} + offsetY, color)
        end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Dithered gradient applied on '${name}' frame ${frameIndex} in ${source}`);
  }

  public async applyDitherPattern(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorA: string, colorB: string, density = 0.5, createIfMissing = true): Promise<AsepriteResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    if (!Number.isFinite(density) || density < 0 || density > 1) return { ok: false, message: "Density must be between 0 and 1" };
    const first = this.parseHexColor(colorA);
    const second = this.parseHexColor(colorB);
    if (!first || !second) return { ok: false, message: "Colors must use hexadecimal values" };
    const [firstRed, firstGreen, firstBlue, firstAlpha] = first;
    const [secondRed, secondGreen, secondBlue, secondAlpha] = second;
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      local img = cel.image
      local function pset(image, px, py, value)
        if px >= 0 and py >= 0 and px < image.width and py < image.height then image:putPixel(px, py, value) end
      end
      local bayer = {
        { 0, 8, 2, 10 },
        { 12, 4, 14, 6 },
        { 3, 11, 1, 9 },
        { 15, 7, 13, 5 },
      }
      for offsetY = 0, ${height - 1} do
        for offsetX = 0, ${width - 1} do
          local threshold = (bayer[(${y} + offsetY) % 4 + 1][(${x} + offsetX) % 4 + 1] + 0.5) / 16
          local color = ${density} > threshold and Color(${secondRed}, ${secondGreen}, ${secondBlue}, ${secondAlpha}) or Color(${firstRed}, ${firstGreen}, ${firstBlue}, ${firstAlpha})
          pset(img, ${x} + offsetX, ${y} + offsetY, color)
        end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Dither pattern applied on '${name}' frame ${frameIndex} in ${source}`);
  }

  private nativeScript(layerName: string, frameIndex: number, command: string, region?: [number, number, number, number]): string {
    const escapedLayer = luaEscape(layerName);
    const selection = region ? `spr.selection = Selection(Rectangle(${region[0]}, ${region[1]}, ${region[2]}, ${region[3]}))` : "";
    const clearSelection = region ? "spr.selection:deselect()" : "";
    return this.openScript("", `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      app.activeFrame = spr.frames[${frameIndex}]
      if "${escapedLayer}" ~= "" then
        local target = find_layer(spr, "${escapedLayer}")
        if not target or target.isGroup then print("ERROR:Layer not found") return end
        app.activeLayer = target
      end
      ${selection}
      ${command}
      ${clearSelection}
    `);
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

  private async findProducedOutput(target: string): Promise<string | undefined> {
    try {
      await fs.access(target);
      return target;
    } catch {
      const directory = path.dirname(target);
      const extension = path.extname(target).toLowerCase();
      const base = path.basename(target, path.extname(target));
      try {
        const entries = await fs.readdir(directory);
        const sibling = entries.find((entry) => entry.toLowerCase().startsWith(base.toLowerCase()) && path.extname(entry).toLowerCase() === extension);
        return sibling ? path.join(directory, sibling) : undefined;
      } catch {
        return undefined;
      }
    }
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
      if cel.position.x ~= 0 or cel.position.y ~= 0 or cel.image.width ~= spr.width or cel.image.height ~= spr.height then
        local normalized = Image(spr.width, spr.height, spr.colorMode)
        normalized:drawImage(cel.image, cel.position)
        cel.image = normalized
        cel.position = Point(0, 0)
      end
      ${body}
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
