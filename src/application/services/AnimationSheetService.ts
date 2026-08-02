import path from "node:path";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AnimationSheetInput, AnimationSheetPort } from "../../domain/animation-sheet.js";
import type { AssetManifestWriter, RasterCodec } from "../../domain/image-assets.js";
import type { RasterFrame } from "../../domain/pixel-art.js";

interface SheetFrame { index: number; x: number; y: number; width: number; height: number; delayMs: number; pivot: { x: number; y: number; mode: "bottom_center" }; }

function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function resolved(filename: string): string { return path.resolve(filename).toLowerCase(); }
function assertFilename(filename: string, label: string): void {
  if (!filename.trim()) throw new Error(`${label} is required`);
  if (filename.includes("\0")) throw new Error(`${label} cannot contain null bytes`);
}

function copyFrame(source: RasterFrame, target: RasterFrame, x: number, y: number): void {
  for (let row = 0; row < source.height; row += 1) {
    const from = row * source.width * 4;
    const to = ((y + row) * target.width + x) * 4;
    target.pixels.set(source.pixels.slice(from, from + source.width * 4), to);
  }
}

export class AnimationSheetService implements AnimationSheetPort {
  public constructor(private readonly codec: RasterCodec, private readonly manifestWriter: AssetManifestWriter) {}

  public async build(input: AnimationSheetInput): Promise<AssetOperationResult> {
    try {
      assertFilename(input.inputFilename, "Input filename");
      assertFilename(input.outputFilename, "Output filename");
      assertFilename(input.manifestFilename, "Manifest filename");
      const inputPath = resolved(input.inputFilename);
      const outputPath = resolved(input.outputFilename);
      const manifestPath = resolved(input.manifestFilename);
      if (inputPath === outputPath || inputPath === manifestPath || outputPath === manifestPath) throw new Error("Input, output, and manifest filenames must be different");

      const columns = input.columns ?? 0;
      const padding = input.padding ?? 0;
      if (input.columns !== undefined && (!Number.isInteger(columns) || columns < 1 || columns > 16)) throw new Error("Columns must be an integer between 1 and 16");
      if (!Number.isInteger(padding) || padding < 0 || padding > 64) throw new Error("Padding must be an integer between 0 and 64");

      const frames = await this.codec.decode(input.inputFilename);
      if (frames.length === 0) throw new Error("Animation sheet requires at least one frame");
      const first = frames[0]!;
      if (first.width <= 0 || first.height <= 0) throw new Error("Animation frames must have positive dimensions");
      if (frames.some((frame) => frame.width !== first.width || frame.height !== first.height)) throw new Error("Animation frames must share dimensions");
      if (frames.some((frame) => frame.pixels.length !== frame.width * frame.height * 4)) throw new Error("Animation frames have invalid RGBA pixel data");

      const resolvedColumns = input.columns ?? Math.max(1, Math.ceil(Math.sqrt(frames.length)));
      const rows = Math.ceil(frames.length / resolvedColumns);
      const width = resolvedColumns * first.width + (resolvedColumns + 1) * padding;
      const height = rows * first.height + (rows + 1) * padding;
      if (width > 4096 || height > 4096) throw new Error("Animation sheet dimensions cannot exceed 4096 pixels");
      const sheet: RasterFrame = { width, height, pixels: new Uint8ClampedArray(width * height * 4) };
      const manifestFrames: SheetFrame[] = frames.map((frame, index) => {
        const column = index % resolvedColumns;
        const row = Math.floor(index / resolvedColumns);
        const x = padding + column * (first.width + padding);
        const y = padding + row * (first.height + padding);
        copyFrame(frame, sheet, x, y);
        return { index, x, y, width: first.width, height: first.height, delayMs: frame.delayMs ?? 0, pivot: { x: x + Math.floor(first.width / 2), y: y + first.height - 1, mode: "bottom_center" } };
      });
      const delaysMs = frames.map((frame) => frame.delayMs ?? 0);
      await this.codec.encode([sheet], input.outputFilename, "png");
      await this.manifestWriter.write(input.manifestFilename, {
        schemaVersion: 1,
        kind: "animation_sheet",
        source: input.inputFilename,
        sheet: input.outputFilename,
        width,
        height,
        cellWidth: first.width,
        cellHeight: first.height,
        columns: resolvedColumns,
        rows,
        padding,
        frames: manifestFrames,
        timing: { delaysMs, totalDurationMs: delaysMs.reduce((sum, delay) => sum + delay, 0), loopDurationMs: delaysMs.reduce((sum, delay) => sum + delay, 0) },
        deterministic: true,
        sourcePreserved: true,
      });
      return { ok: true, message: JSON.stringify({ operation: "build_animation_sheet", output: input.outputFilename, manifest: input.manifestFilename, frames: frames.length, columns: resolvedColumns, rows, width, height, cellWidth: first.width, cellHeight: first.height, padding, deterministic: true, sourcePreserved: true }) };
    } catch (error) { return fail(error); }
  }
}
