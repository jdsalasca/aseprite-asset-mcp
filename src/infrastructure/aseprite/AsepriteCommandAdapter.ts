import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { AnimationAuditInput, AnimationEasing, AnimationSanitizeInput, AssetRuntimePort, AssetOperationResult, CopyLayersInput, PixelInput, PointInput, ScaleAnchor, TextDrawInput, TilePixelInput, TilePlacementInput } from "../../domain/asset-operations.js";
import { availableTextFonts, measureText as rasterMeasureText, rasterizeText } from "../text/TextRasterizer.js";

const execFileAsync = promisify(execFile);
const previewServers = new Map<number, ReturnType<typeof spawn>>();

export interface CommandResult {
  ok: boolean;
  output: string;
}

type PathValidation = string | AssetOperationResult;

const SHEET_TYPES = new Set(["horizontal", "vertical", "rows", "columns", "packed"]);
const DATA_FORMATS = new Set(["json-array", "json-hash"]);
const ANIMATION_EASINGS = new Set(["linear", "ease_in", "ease_out", "ease_in_out", "smoothstep"]);
const SCALE_ANCHORS = new Set(["center", "topleft"]);
const UNSAFE_LUA_PATTERNS = /\b(?:os\.(?:execute|remove|rename|exit)|io\.(?:open|popen|output)|dofile|loadfile|load)\b/;
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

function validateName(value: string, label: string): string | AssetOperationResult {
  if (typeof value !== "string" || !value.trim()) return { ok: false, message: `${label} cannot be empty` };
  return value;
}

function validateNativeRegion(x: number, y: number, width: number, height: number): AssetOperationResult | undefined {
  if (![x, y, width, height].every((value) => Number.isInteger(value))) return { ok: false, message: "Region values must be integers" };
  if (width < 0 || height < 0 || (width === 0) !== (height === 0)) return { ok: false, message: "Region width and height must both be zero or positive integers" };
  return undefined;
}

function result(command: CommandResult, successMessage: string): AssetOperationResult {
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

export {
  execFileAsync,
  previewServers,
  SHEET_TYPES,
  DATA_FORMATS,
  ANIMATION_EASINGS,
  SCALE_ANCHORS,
  UNSAFE_LUA_PATTERNS,
  BLEND_MODES,
  PALETTE_PRESETS,
  rgbToHsl,
  hslToHex,
  CONVOLUTION_MATRICES,
  luaEscape,
  safePath,
  validatePath,
  isPositiveInteger,
  validateFrameRange,
  isHexColor,
  validateName,
  validateNativeRegion,
  result,
  parsePixelFields,
};

export class AsepriteCommandAdapter {
  protected readonly executable: string;
  protected readonly tempDirectory: string;
  protected readonly commandRunner: (args: string[]) => Promise<CommandResult>;

public constructor(options: AsepriteCliGatewayOptions = {}) {
    this.executable = options.executable ?? process.env.ASEPRITE_PATH ?? "aseprite";
    this.tempDirectory = options.tempDirectory ?? os.tmpdir();
    this.commandRunner = options.commandRunner ?? ((args) => this.run(args));
  }

protected nativeScript(layerName: string, frameIndex: number, command: string, region?: [number, number, number, number]): string {
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

protected async resolveTagRange(filename: string, tagName: string): Promise<CommandResult> {
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

protected async findProducedOutput(target: string): Promise<string | undefined> {
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

protected layerScript(filename: string, body: string): string {
    return this.openScript(filename, body);
  }

protected layerFrameScript(layerName: string, frameIndex: number, createIfMissing: boolean, body: string): string {
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

protected parseHexColor(value: string): [number, number, number, number] | undefined {
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

protected openScript(filename: string, body: string): string {
    return `
      local function find_layer(parent, name)
        for _, layer in ipairs(parent.layers) do
          if layer.name == name then return layer end
          if layer.isGroup then local nested = find_layer(layer, name) if nested then return nested end end
        end
        return nil
      end
      local function find_slice(sprite, name)
        for _, slice in ipairs(sprite.slices) do if slice.name == name then return slice end end
        return nil
      end
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      app.transaction(function() ${body} end)
      spr:saveAs(spr.filename)
      print("OK")
    `;
  }

protected readOnlyScript(body: string): string {
    return `
      local function find_layer(parent, name)
        for _, layer in ipairs(parent.layers) do
          if layer.name == name then return layer end
          if layer.isGroup then local nested = find_layer(layer, name) if nested then return nested end end
        end
        return nil
      end
      local function find_slice(sprite, name)
        for _, slice in ipairs(sprite.slices) do if slice.name == name then return slice end end
        return nil
      end
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      ${body}
    `;
  }

protected async runLua(script: string, filename?: string): Promise<CommandResult> {
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

protected async run(args: string[]): Promise<CommandResult> {
    try {
      const output = await execFileAsync(this.executable, args, { windowsHide: true, maxBuffer: 1024 * 1024 });
      const text = `${output.stdout ?? ""}${output.stderr ?? ""}`;
      const error = text.split(/\r?\n/).find((line) => line.startsWith("ERROR:"));
      return error ? { ok: false, output: error.slice("ERROR:".length) } : { ok: true, output: text };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const details = typeof error === "object" && error !== null ? `${String((error as { stdout?: unknown }).stdout ?? "")} ${String((error as { stderr?: unknown }).stderr ?? "")}`.trim() : "";
      return { ok: false, output: details || message };
    }
  }
}
