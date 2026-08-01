import { promises as fs, createWriteStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as PImage from "pureimage";

export interface TextMetrics {
  width: number;
  height: number;
  advanceWidth: number;
  aboveBaseline: number;
  belowBaseline: number;
  leftBearing: number;
}

export interface RasterTextOptions {
  text: string;
  font: string;
  size?: number | undefined;
  color?: string | undefined;
  letterSpacing?: number | undefined;
  bold?: number | undefined;
  outlineColor?: string | undefined;
  outlineWidth?: number | undefined;
  shadowColor?: string | undefined;
  shadowDx?: number | undefined;
  shadowDy?: number | undefined;
  antialias?: boolean | undefined;
}

export interface RasterTextResult {
  filename: string;
  width: number;
  height: number;
  blitX: number;
  blitY: number;
  metrics: TextMetrics;
}

const FONT_EXTENSIONS = new Set([".ttf", ".otf", ".ttc"]);
const registered = new Map<string, string>();

function systemFontDirectories(): string[] {
  const home = os.homedir();
  return [
    path.join(home, ".aseprite-mcp", "fonts"),
    path.join(home, ".fonts"),
    "C:\\Windows\\Fonts",
    "/usr/share/fonts",
    "/usr/local/share/fonts",
    "/System/Library/Fonts",
    "/Library/Fonts",
  ];
}

async function walkFontFiles(directory: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await walkFontFiles(full));
      else if (FONT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(full);
    }
    return files;
  } catch {
    return [];
  }
}

export async function availableTextFonts(): Promise<Array<{ name: string; path: string; source: "user" | "system" }>> {
  const directories = systemFontDirectories();
  const userDirectory = directories[0];
  const result: Array<{ name: string; path: string; source: "user" | "system" }> = [];
  const seen = new Set<string>();
  for (const [index, directory] of directories.entries()) {
    for (const filename of (await walkFontFiles(directory)).sort()) {
      const name = path.basename(filename, path.extname(filename));
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ name, path: filename, source: directory === userDirectory || index === 1 ? "user" : "system" });
    }
  }
  return result;
}

async function resolveFont(spec: string): Promise<{ family: string; filename: string }> {
  if (typeof spec !== "string" || !spec.trim()) throw new Error("Font cannot be empty");
  const direct = path.resolve(spec.replace(/^~(?=$|[\\/])/, os.homedir()));
  try {
    const stats = await fs.stat(direct);
    if (stats.isFile() && FONT_EXTENSIONS.has(path.extname(direct).toLowerCase())) return register(direct);
  } catch {
    // Resolve by discovered font name below.
  }
  const fonts = await availableTextFonts();
  const match = fonts.find((font) => font.name.toLowerCase() === spec.trim().toLowerCase());
  if (!match) throw new Error(`Font '${spec}' not found. Call list_text_fonts or pass a .ttf/.otf path`);
  return register(match.path);
}

function register(filename: string): { family: string; filename: string } {
  const existing = registered.get(filename);
  if (existing) return { family: existing, filename };
  const family = `AsepriteMcpFont_${Buffer.from(filename).toString("base64url").slice(0, 32)}`;
  const font = PImage.registerFont(filename, family);
  font.loadSync();
  registered.set(filename, family);
  return { family, filename };
}

function assertInteger(value: number, label: string, minimum?: number): void {
  if (!Number.isInteger(value) || (minimum !== undefined && value < minimum)) throw new Error(`${label} must be an integer${minimum === undefined ? "" : ` >= ${minimum}`}`);
}

function parseColor(value: string, label: string): string {
  if (typeof value !== "string" || !/^#?(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim())) throw new Error(`${label} must be a hexadecimal color`);
  let hex = value.trim().replace(/^#/, "");
  if (hex.length === 3 || hex.length === 4) hex = [...hex].map((component) => component + component).join("");
  if (hex.length === 6) hex += "ff";
  return `#${hex}`;
}

function setupContext(context: ReturnType<ReturnType<typeof PImage.make>["getContext"]>, family: string, size: number): void {
  context.font = `${size}px ${family}`;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
}

export async function measureText(text: string, font: string, size = 1, letterSpacing = 0, bold = 0, antialias = false): Promise<TextMetrics> {
  if (typeof text !== "string") throw new Error("Text must be a string");
  assertInteger(size, "Size", 1);
  assertInteger(letterSpacing, "Letter spacing", 0);
  assertInteger(bold, "Bold", 0);
  if (typeof antialias !== "boolean") throw new Error("Antialias must be a boolean");
  const resolved = await resolveFont(font);
  const image = PImage.make(1, 1);
  const context = image.getContext("2d");
  setupContext(context, resolved.family, size);
  const base = context.measureText(text);
  const spacing = Math.max(0, text.length - 1) * letterSpacing;
  const width = Math.max(0, Math.ceil(base.width + spacing + bold));
  const aboveBaseline = Math.max(0, Math.ceil(base.emHeightAscent));
  const belowBaseline = Math.max(0, Math.ceil(base.emHeightDescent));
  return {
    width,
    height: text ? aboveBaseline + belowBaseline : 0,
    advanceWidth: Math.max(0, Math.ceil(base.width + spacing + bold)),
    aboveBaseline,
    belowBaseline,
    leftBearing: 0,
  };
}

export async function rasterizeText(options: RasterTextOptions, blitX: number, blitY: number, temporaryDirectory = os.tmpdir()): Promise<RasterTextResult> {
  const text = options.text;
  if (typeof text !== "string" || !text) throw new Error("Text cannot be empty");
  const size = options.size ?? 1;
  const letterSpacing = options.letterSpacing ?? 0;
  const bold = options.bold ?? 0;
  const outlineWidth = options.outlineWidth ?? 1;
  const shadowDx = options.shadowDx ?? 1;
  const shadowDy = options.shadowDy ?? 1;
  assertInteger(size, "Size", 1);
  assertInteger(letterSpacing, "Letter spacing", 0);
  assertInteger(bold, "Bold", 0);
  assertInteger(outlineWidth, "Outline width", 1);
  if (![shadowDx, shadowDy].every(Number.isInteger)) throw new Error("Shadow offsets must be integers");
  const fill = parseColor(options.color ?? "#FFFFFF", "Color");
  const outline = options.outlineColor ? parseColor(options.outlineColor, "Outline color") : undefined;
  const shadow = options.shadowColor ? parseColor(options.shadowColor, "Shadow color") : undefined;
  const metrics = await measureText(text, options.font, size, letterSpacing, bold, options.antialias ?? false);
  const pad = Math.max(2, outline ? outlineWidth + 2 : 0, shadow ? Math.max(Math.abs(shadowDx), Math.abs(shadowDy)) + 2 : 0);
  const width = Math.max(1, metrics.width + pad * 2 + (outline ? outlineWidth * 2 : 0) + Math.abs(shadowDx));
  const height = Math.max(1, metrics.height + pad * 2 + (outline ? outlineWidth * 2 : 0) + Math.abs(shadowDy));
  const image = PImage.make(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) image.setPixelRGBA(x, y, 0);
  }
  const context = image.getContext("2d");
  setupContext(context, (await resolveFont(options.font)).family, size);
  context.imageSmoothingEnabled = options.antialias ?? false;
  const baseline = pad + metrics.aboveBaseline;
  const draw = (color: string, x: number, y: number, stroke = false) => {
    if (stroke) {
      context.fillStyle = color;
      for (let offsetY = -outlineWidth; offsetY <= outlineWidth; offsetY += 1) {
        for (let offsetX = -outlineWidth; offsetX <= outlineWidth; offsetX += 1) {
          if (offsetX !== 0 || offsetY !== 0) context.fillText(text, x + offsetX, y + offsetY);
        }
      }
    } else {
      context.fillStyle = color;
      context.fillText(text, x, y);
      for (let pass = 1; pass <= bold; pass += 1) context.fillText(text, x + pass, y + pass);
    }
  };
  if (shadow) draw(shadow, pad + shadowDx, baseline + shadowDy, Boolean(outline));
  if (outline) draw(outline, pad, baseline, true);
  draw(fill, pad, baseline);
  const filename = path.join(temporaryDirectory, `aseprite-mcp-text-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);
  await PImage.encodePNGToStream(image, createWriteStream(filename));
  return { filename, width, height, blitX: blitX - pad, blitY: blitY - pad, metrics };
}
