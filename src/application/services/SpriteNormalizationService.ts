import path from "node:path";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { SpriteNormalizationInput, SpriteNormalizationPort, SpritePivotMode } from "../../domain/sprite-normalization.js";
import type { AssetManifestWriter, ImageOutputFormat, RasterCodec } from "../../domain/image-assets.js";
import type { RasterFrame } from "../../domain/pixel-art.js";

interface Bounds { x: number; y: number; width: number; height: number; }
interface Pivot { mode: SpritePivotMode; x: number; y: number; }

function fail(error: unknown): AssetOperationResult {
  return { ok: false, message: error instanceof Error ? error.message : String(error) };
}

function normalizedPath(filename: string): string {
  return path.resolve(filename).toLowerCase();
}

function assertSafeFilename(filename: string, label: string): void {
  if (!filename.trim()) throw new Error(`${label} is required`);
  if (filename.includes("\0")) throw new Error(`${label} cannot contain null bytes`);
}

function frameBounds(frame: RasterFrame): Bounds | null {
  let minX = frame.width;
  let minY = frame.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if ((frame.pixels[(y * frame.width + x) * 4 + 3] ?? 0) <= 0) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function unionBounds(frames: RasterFrame[]): Bounds {
  const visible = frames.map(frameBounds).filter((value): value is Bounds => value !== null);
  if (visible.length === 0) throw new Error("Sprite normalization requires at least one opaque pixel");
  const minX = Math.min(...visible.map((value) => value.x));
  const minY = Math.min(...visible.map((value) => value.y));
  const maxX = Math.max(...visible.map((value) => value.x + value.width - 1));
  const maxY = Math.max(...visible.map((value) => value.y + value.height - 1));
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function cropFrame(frame: RasterFrame, bounds: Bounds, padding: number, width: number, height: number): RasterFrame {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = bounds.y; y < bounds.y + bounds.height; y += 1) for (let x = bounds.x; x < bounds.x + bounds.width; x += 1) {
    const sourceOffset = (y * frame.width + x) * 4;
    const targetOffset = ((y - bounds.y + padding) * width + (x - bounds.x + padding)) * 4;
    pixels.set(frame.pixels.slice(sourceOffset, sourceOffset + 4), targetOffset);
  }
  return { width, height, pixels, delayMs: frame.delayMs };
}

function pivotFor(mode: SpritePivotMode, width: number, height: number, bounds: Bounds, padding: number): Pivot {
  if (mode === "center") return { mode, x: Math.floor(width / 2), y: Math.floor(height / 2) };
  return { mode, x: Math.floor(width / 2), y: padding + bounds.height - 1 };
}

export class SpriteNormalizationService implements SpriteNormalizationPort {
  public constructor(private readonly codec: RasterCodec, private readonly manifestWriter: AssetManifestWriter) {}

  public async normalize(input: SpriteNormalizationInput): Promise<AssetOperationResult> {
    try {
      assertSafeFilename(input.inputFilename, "Input filename");
      assertSafeFilename(input.outputFilename, "Output filename");
      assertSafeFilename(input.manifestFilename, "Manifest filename");
      const inputPath = normalizedPath(input.inputFilename);
      const outputPath = normalizedPath(input.outputFilename);
      const manifestPath = normalizedPath(input.manifestFilename);
      if (inputPath === outputPath || inputPath === manifestPath || outputPath === manifestPath) throw new Error("Input, output, and manifest filenames must be different");

      const padding = input.padding ?? 0;
      if (!Number.isInteger(padding) || padding < 0 || padding > 16) throw new Error("Padding must be an integer between 0 and 16");
      const pivot = input.pivot ?? "bottom_center";
      if (pivot !== "center" && pivot !== "bottom_center") throw new Error("Pivot must be center or bottom_center");

      const frames = await this.codec.decode(input.inputFilename);
      if (frames.length === 0) throw new Error("Sprite normalization requires at least one frame");
      const first = frames[0]!;
      if (first.width <= 0 || first.height <= 0) throw new Error("Sprite frames must have positive dimensions");
      if (frames.some((frame) => frame.width !== first.width || frame.height !== first.height)) throw new Error("Sprite frames must share dimensions");
      if (frames.some((frame) => frame.pixels.length !== frame.width * frame.height * 4)) throw new Error("Sprite frames have invalid RGBA pixel data");

      const bounds = unionBounds(frames);
      const width = bounds.width + padding * 2;
      const height = bounds.height + padding * 2;
      if (width > 4096 || height > 4096) throw new Error("Normalized sprite dimensions cannot exceed 4096 pixels");
      const format: ImageOutputFormat = input.format ?? (frames.length > 1 ? "gif" : "png");
      if (frames.length > 1 && format === "png") throw new Error("Multiple frames require GIF output");
      const normalizedFrames = frames.map((frame) => cropFrame(frame, bounds, padding, width, height));
      const pivotValue = pivotFor(pivot, width, height, bounds, padding);
      await this.codec.encode(normalizedFrames, input.outputFilename, format);
      await this.manifestWriter.write(input.manifestFilename, {
        schemaVersion: 1,
        kind: "sprite_normalization",
        source: input.inputFilename,
        output: input.outputFilename,
        format,
        width,
        height,
        frames: normalizedFrames.length,
        padding,
        bounds,
        pivot: pivotValue,
        frameBounds: frames.map(frameBounds),
        deterministic: true,
        sourcePreserved: true,
      });
      return { ok: true, message: JSON.stringify({ operation: "normalize_sprite", input: input.inputFilename, output: input.outputFilename, manifest: input.manifestFilename, format, width, height, frames: normalizedFrames.length, padding, bounds, pivot: pivotValue, deterministic: true, sourcePreserved: true }) };
    } catch (error) {
      return fail(error);
    }
  }
}
