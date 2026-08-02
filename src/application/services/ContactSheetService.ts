import path from "node:path";
import { resizeRasterFrame } from "./PixelArtPipeline.js";
import type { AssetManifestWriter, ContactSheetInput, RasterCodec } from "../../domain/image-assets.js";
import type { RasterFrame } from "../../domain/pixel-art.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";

function ok(value: unknown): AssetOperationResult { return { ok: true, message: JSON.stringify(value) }; }
function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function resolved(filename: string): string { return path.resolve(filename).toLowerCase(); }
function ensureSafePaths(input: ContactSheetInput): void {
  const paths = [input.outputFilename, input.manifestFilename, ...input.inputFilenames];
  if (paths.some((filename) => !filename.trim() || filename.includes("\0"))) throw new Error("Contact sheet filenames must be non-empty and cannot contain null bytes");
  const output = resolved(input.outputFilename);
  const manifest = resolved(input.manifestFilename);
  if (output === manifest) throw new Error("Contact sheet output and manifest must differ");
  if (input.inputFilenames.some((filename) => resolved(filename) === output || resolved(filename) === manifest)) throw new Error("Contact sheet outputs must differ from input assets");
}
function ensureOptions(input: ContactSheetInput): void {
  if (input.inputFilenames.length < 1 || input.inputFilenames.length > 64) throw new Error("Contact sheet requires between 1 and 64 input assets");
  if (!Number.isInteger(input.cellWidth) || input.cellWidth < 8 || input.cellWidth > 512 || !Number.isInteger(input.cellHeight) || input.cellHeight < 8 || input.cellHeight > 512) throw new Error("Contact sheet cells must be integers from 8 to 512 pixels");
  if (!Number.isInteger(input.columns) || (input.columns ?? 0) < 1 || (input.columns ?? 0) > 16) throw new Error("Contact sheet columns must be an integer from 1 to 16");
  if (!Number.isInteger(input.padding) || (input.padding ?? 0) < 0 || (input.padding ?? 0) > 64) throw new Error("Contact sheet padding must be an integer from 0 to 64 pixels");
}
function fitFrame(source: RasterFrame, cellWidth: number, cellHeight: number): { frame: RasterFrame; offsetX: number; offsetY: number } {
  const scale = Math.min(1, cellWidth / source.width, cellHeight / source.height);
  const width = Math.max(1, Math.min(cellWidth, Math.round(source.width * scale)));
  const height = Math.max(1, Math.min(cellHeight, Math.round(source.height * scale)));
  return { frame: resizeRasterFrame(source, width, height, "nearest"), offsetX: Math.floor((cellWidth - width) / 2), offsetY: Math.floor((cellHeight - height) / 2) };
}
function copyToSheet(target: Uint8ClampedArray, sheetWidth: number, cell: { frame: RasterFrame; offsetX: number; offsetY: number }, cellX: number, cellY: number, cellWidth: number): void {
  for (let y = 0; y < cell.frame.height; y += 1) {
    const sourceStart = y * cell.frame.width * 4;
    const targetStart = ((cellY + cell.offsetY + y) * sheetWidth + cellX + cell.offsetX) * 4;
    target.set(cell.frame.pixels.subarray(sourceStart, sourceStart + cell.frame.width * 4), targetStart);
  }
}

export class ContactSheetService {
  public constructor(private readonly codec: RasterCodec, private readonly manifestWriter: AssetManifestWriter) {}

  public async build(input: ContactSheetInput): Promise<AssetOperationResult> {
    try {
      ensureSafePaths(input);
      const columns = input.columns ?? Math.max(1, Math.ceil(Math.sqrt(input.inputFilenames.length)));
      const padding = input.padding ?? 0;
      ensureOptions({ ...input, columns, padding });
      const sources = await Promise.all(input.inputFilenames.map(async (filename) => {
        const frame = (await this.codec.decode(filename))[0];
        if (!frame) throw new Error(`Input asset has no renderable frame: ${filename}`);
        return frame;
      }));
      const rows = Math.ceil(sources.length / columns);
      const width = columns * input.cellWidth + Math.max(0, columns - 1) * padding;
      const height = rows * input.cellHeight + Math.max(0, rows - 1) * padding;
      if (width > 8192 || height > 8192) throw new Error("Contact sheet dimensions must not exceed 8192 pixels");
      const pixels = new Uint8ClampedArray(width * height * 4);
      const assets = input.inputFilenames.map((filename, index) => {
        const source = sources[index]!;
        const fitted = fitFrame(source, input.cellWidth, input.cellHeight);
        const cellX = (index % columns) * (input.cellWidth + padding);
        const cellY = Math.floor(index / columns) * (input.cellHeight + padding);
        copyToSheet(pixels, width, fitted, cellX, cellY, input.cellWidth);
        return { filename, index, sourceWidth: source.width, sourceHeight: source.height, renderWidth: fitted.frame.width, renderHeight: fitted.frame.height, cellX, cellY };
      });
      await this.codec.encode([{ width, height, pixels }], input.outputFilename, "png");
      await this.manifestWriter.write(input.manifestFilename, { schemaVersion: 1, kind: "contact_sheet", sheet: input.outputFilename, width, height, cellWidth: input.cellWidth, cellHeight: input.cellHeight, columns, rows, padding, assets });
      return ok({ operation: "build_contact_sheet", output: input.outputFilename, manifest: input.manifestFilename, assets: assets.length, columns, rows, width, height, cellWidth: input.cellWidth, cellHeight: input.cellHeight, padding, deterministic: true, sourcePreserved: true });
    } catch (error) { return fail(error); }
  }
}
