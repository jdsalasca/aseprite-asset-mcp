import { inspectRasterFrame, convertRasterFrames, harmonizeRasterFrames } from "./PixelArtPipeline.js";
import path from "node:path";
import type {
  AssetInspection,
  AssetManifestWriter,
  AssetPackInput,
  PaletteHarmonizeInput,
  AssetQualityBundleInput,
  AssetQualityInput,
  AssetRecipeInput,
  BatchAssetJobInput,
  ConvertImageInput,
  ImageOutputFormat,
  RasterCodec,
  TextureAtlasInput,
  UpscalePixelArtInput,
} from "../../domain/image-assets.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { PixelArtQualityReport, RasterFrame } from "../../domain/pixel-art.js";

function ok(message: unknown): AssetOperationResult { return { ok: true, message: JSON.stringify(message) }; }
function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function assertPathPair(inputFilename: string, outputFilename: string): void {
  if (!inputFilename.trim() || !outputFilename.trim()) throw new Error("Input and output filenames are required");
  if (inputFilename.includes("\0") || outputFilename.includes("\0")) throw new Error("Input and output filenames cannot contain null bytes");
  if (path.resolve(inputFilename).toLowerCase() === path.resolve(outputFilename).toLowerCase()) throw new Error("Input and output filenames must differ");
}

function assertOutputDiffersFromInputs(inputFilenames: string[], outputFilename: string): void {
  const output = path.resolve(outputFilename).toLowerCase();
  if (inputFilenames.some((filename) => path.resolve(filename).toLowerCase() === output)) throw new Error("Output filename must be different from an input asset");
}

function upscaleFrame(frame: RasterFrame, scale: number): RasterFrame {
  const width = frame.width * scale;
  const height = frame.height * scale;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let sourceY = 0; sourceY < frame.height; sourceY += 1) {
    for (let sourceX = 0; sourceX < frame.width; sourceX += 1) {
      const sourceOffset = (sourceY * frame.width + sourceX) * 4;
      for (let offsetY = 0; offsetY < scale; offsetY += 1) {
        const targetRow = (sourceY * scale + offsetY) * width;
        for (let offsetX = 0; offsetX < scale; offsetX += 1) {
          const targetOffset = (targetRow + sourceX * scale + offsetX) * 4;
          pixels.set(frame.pixels.subarray(sourceOffset, sourceOffset + 4), targetOffset);
        }
      }
    }
  }
  return { width, height, pixels, ...(frame.delayMs === undefined ? {} : { delayMs: frame.delayMs }) };
}

function atlasFrame(frames: RasterFrame[], columns: number, padding: number): RasterFrame {
  const first = frames[0];
  if (!first) throw new Error("At least one frame is required");
  const rows = Math.ceil(frames.length / columns);
  const width = columns * first.width + Math.max(0, columns - 1) * padding;
  const height = rows * first.height + Math.max(0, rows - 1) * padding;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    if (!frame) continue;
    const cellX = (index % columns) * (first.width + padding);
    const cellY = Math.floor(index / columns) * (first.height + padding);
    for (let y = 0; y < first.height; y += 1) {
      const sourceStart = y * first.width * 4;
      const targetStart = ((cellY + y) * width + cellX) * 4;
      pixels.set(frame.pixels.subarray(sourceStart, sourceStart + first.width * 4), targetStart);
    }
  }
  return { width, height, pixels };
}

export class PixelArtAssetService {
  public constructor(private readonly codec: RasterCodec, private readonly manifestWriter?: AssetManifestWriter) {}

  public async convertImage(input: ConvertImageInput, animation = false): Promise<AssetOperationResult> {
    try {
      assertPathPair(input.inputFilename, input.outputFilename);
      const source = await this.codec.decode(input.inputFilename);
      if (!animation && source.length > 1) throw new Error("Input is animated; use convert_animation_to_pixel_art");
      const frames = convertRasterFrames(animation ? source : [source[0]!], input);
      await this.codec.encode(frames, input.outputFilename, input.format ?? (animation ? "gif" : "png"));
      return ok({ operation: animation ? "convert_animation_to_pixel_art" : "convert_image_to_pixel_art", input: input.inputFilename, output: input.outputFilename, frames: frames.length, width: input.width, height: input.height, maxColors: input.maxColors });
    } catch (error) { return fail(error); }
  }

  public async exportGif(inputFilename: string, outputFilename: string): Promise<AssetOperationResult> {
    try {
      assertPathPair(inputFilename, outputFilename);
      const frames = await this.codec.decode(inputFilename);
      await this.codec.encode(frames, outputFilename, "gif");
      return ok({ operation: "export_animation_gif", input: inputFilename, output: outputFilename, frames: frames.length });
    } catch (error) { return fail(error); }
  }

  public async upscalePixelArt(input: UpscalePixelArtInput): Promise<AssetOperationResult> {
    try {
      assertPathPair(input.inputFilename, input.outputFilename);
      if (!Number.isInteger(input.scale) || input.scale < 2 || input.scale > 16) throw new Error("Scale must be an integer between 2 and 16");
      const source = await this.codec.decode(input.inputFilename);
      const first = source[0];
      if (!first) throw new Error("Input asset has no frames");
      if (first.width * input.scale > 4096 || first.height * input.scale > 4096) throw new Error("Upscaled dimensions must not exceed 4096 pixels");
      const frames = source.map((frame) => upscaleFrame(frame, input.scale));
      const format = input.format ?? (frames.length > 1 ? "gif" : "png");
      await this.codec.encode(frames, input.outputFilename, format);
      return ok({ operation: "upscale_pixel_art", input: input.inputFilename, output: input.outputFilename, scale: input.scale, frames: frames.length, width: first.width * input.scale, height: first.height * input.scale, format, deterministic: true, sourcePreserved: true });
    } catch (error) { return fail(error); }
  }

  public async harmonizePalette(input: PaletteHarmonizeInput): Promise<AssetOperationResult> {
    try {
      assertPathPair(input.inputFilename, input.outputFilename);
      if (!/^#?(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(input.accentColor.trim())) throw new Error("Accent color must be a 6 or 8 digit hexadecimal color");
      if (!Number.isFinite(input.strength) || input.strength < 0 || input.strength > 1) throw new Error("Strength must be between 0 and 1");
      if (!Number.isInteger(input.maxColors) || input.maxColors < 2 || input.maxColors > 64) throw new Error("Maximum colors must be an integer from 2 to 64");
      const source = await this.codec.decode(input.inputFilename);
      const harmonized = harmonizeRasterFrames(source, input.accentColor, input.strength, input.maxColors);
      const format = input.format ?? (harmonized.frames.length > 1 ? "gif" : "png");
      await this.codec.encode(harmonized.frames, input.outputFilename, format);
      const accentColor = input.accentColor.startsWith("#") ? input.accentColor.toUpperCase() : `#${input.accentColor.toUpperCase()}`;
      return ok({ operation: "harmonize_asset_palette", input: input.inputFilename, output: input.outputFilename, frames: harmonized.frames.length, format, accentColor, strength: input.strength, maxColors: input.maxColors, palette: harmonized.palette, deterministic: true, sourcePreserved: true });
    } catch (error) { return fail(error); }
  }

  public async inspect(filename: string): Promise<AssetOperationResult> {
    try {
      const frames = await this.codec.decode(filename);
      const reports = frames.map((frame) => inspectRasterFrame(frame));
      const uniqueColors = new Set<string>();
      for (const frame of frames) {
        for (let offset = 0; offset < frame.pixels.length; offset += 4) {
          if ((frame.pixels[offset + 3] ?? 0) > 0) uniqueColors.add(`${frame.pixels[offset]},${frame.pixels[offset + 1]},${frame.pixels[offset + 2]},${frame.pixels[offset + 3]}`);
        }
      }
      const inspection: AssetInspection = {
        filename,
        frameCount: frames.length,
        width: frames[0]?.width ?? 0,
        height: frames[0]?.height ?? 0,
        totalColors: uniqueColors.size,
        reports,
        delaysMs: frames.map((frame) => frame.delayMs ?? 0),
      };
      return ok(inspection);
    } catch (error) { return fail(error); }
  }

  public async validate(input: AssetQualityInput): Promise<AssetOperationResult> {
    try {
      const frames = await this.codec.decode(input.filename);
      const reports = frames.map((frame) => inspectRasterFrame(frame));
      const maxColors = input.maxColors ?? 256;
      const maxIsolatedPixels = input.maxIsolatedPixels ?? Number.MAX_SAFE_INTEGER;
      const violations = reports.flatMap((report, index) => [
        ...(report.colors > maxColors ? [`frame ${index + 1}: ${report.colors} colors > ${maxColors}`] : []),
        ...(report.isolatedPixels > maxIsolatedPixels ? [`frame ${index + 1}: ${report.isolatedPixels} isolated pixels > ${maxIsolatedPixels}`] : []),
      ]);
      const result = { filename: input.filename, valid: violations.length === 0, frameCount: frames.length, reports, violations };
      return { ok: violations.length === 0, message: JSON.stringify(result) };
    } catch (error) { return fail(error); }
  }

  public async qualityBundle(input: AssetQualityBundleInput): Promise<AssetOperationResult> {
    try {
      if (!input.filename.trim()) throw new Error("Asset filename is required");
      const maxColors = input.maxColors ?? 256;
      const maxIsolatedPixels = input.maxIsolatedPixels ?? Number.MAX_SAFE_INTEGER;
      if (!Number.isInteger(maxColors) || maxColors < 1 || maxColors > 256) throw new Error("Maximum colors must be an integer from 1 to 256");
      if (!Number.isInteger(maxIsolatedPixels) || maxIsolatedPixels < 0) throw new Error("Maximum isolated pixels must be a non-negative integer");
      const frames = await this.codec.decode(input.filename);
      const reports = frames.map((frame) => inspectRasterFrame(frame));
      const uniqueColors = new Set<string>();
      for (const frame of frames) for (let offset = 0; offset < frame.pixels.length; offset += 4) if ((frame.pixels[offset + 3] ?? 0) > 0) uniqueColors.add(`${frame.pixels[offset]},${frame.pixels[offset + 1]},${frame.pixels[offset + 2]},${frame.pixels[offset + 3]}`);
      const violations = reports.flatMap((report, index) => [
        ...(report.colors > maxColors ? [`frame ${index + 1}: ${report.colors} colors > ${maxColors}`] : []),
        ...(report.isolatedPixels > maxIsolatedPixels ? [`frame ${index + 1}: ${report.isolatedPixels} isolated pixels > ${maxIsolatedPixels}`] : []),
      ]);
      const recommendations = new Set<string>();
      if (reports.some((report) => report.isolatedPixels > maxIsolatedPixels)) recommendations.add("Apply a 1px outline or connect isolated pixels before export.");
      if (uniqueColors.size > maxColors) recommendations.add("Reduce the palette or run convert_image_to_pixel_art with a bounded max_colors value.");
      if (frames.length > 1 && new Set(frames.map((frame) => frame.delayMs ?? 0)).size > 1) recommendations.add("Review frame timing before exporting to the target engine.");
      if (recommendations.size === 0) recommendations.add("Asset passes the requested compact quality checks.");
      const result = {
        operation: "inspect_asset_bundle",
        filename: input.filename,
        inspection: { filename: input.filename, frameCount: frames.length, width: frames[0]?.width ?? 0, height: frames[0]?.height ?? 0, totalColors: uniqueColors.size, reports, delaysMs: frames.map((frame) => frame.delayMs ?? 0) },
        quality: { valid: violations.length === 0, maxColors, maxIsolatedPixels, violations },
        recommendations: [...recommendations],
        deterministic: true,
        sourcePreserved: true,
      };
      return { ok: violations.length === 0, message: JSON.stringify(result) };
    } catch (error) { return fail(error); }
  }

  public async buildAtlas(input: TextureAtlasInput): Promise<AssetOperationResult> {
    try {
      if (input.inputFilenames.length === 0) throw new Error("At least one input filename is required");
      if (!input.outputFilename.trim()) throw new Error("Output filename is required");
      assertOutputDiffersFromInputs(input.inputFilenames, input.outputFilename);
      const decoded = await Promise.all(input.inputFilenames.map(async (filename) => (await this.codec.decode(filename))[0]!));
      const first = decoded[0];
      if (!first || decoded.some((frame) => frame.width !== first.width || frame.height !== first.height)) throw new Error("Atlas inputs must have equal dimensions");
      const columns = input.columns ?? Math.max(1, Math.ceil(Math.sqrt(decoded.length)));
      const padding = input.padding ?? 0;
      if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(padding) || padding < 0) throw new Error("Columns and padding must be valid non-negative integers");
      const atlas = atlasFrame(decoded, columns, padding);
      await this.codec.encode([atlas], input.outputFilename, "png");
      return ok({ operation: "build_texture_atlas", output: input.outputFilename, sources: input.inputFilenames.length, columns, rows: Math.ceil(decoded.length / columns), width: atlas.width, height: atlas.height, padding });
    } catch (error) { return fail(error); }
  }

  public async exportPack(input: AssetPackInput): Promise<AssetOperationResult> {
    try {
      if (!this.manifestWriter) throw new Error("An asset manifest writer is required");
      if (input.inputFilenames.length === 0) throw new Error("At least one input filename is required");
      if (!input.outputFilename.trim() || !input.manifestFilename.trim()) throw new Error("Atlas and manifest filenames are required");
      assertOutputDiffersFromInputs(input.inputFilenames, input.outputFilename);
      const decoded = await Promise.all(input.inputFilenames.map(async (filename) => (await this.codec.decode(filename))[0]!));
      const first = decoded[0];
      if (!first || decoded.some((frame) => frame.width !== first.width || frame.height !== first.height)) throw new Error("Asset pack inputs must have equal dimensions");
      const columns = input.columns ?? Math.max(1, Math.ceil(Math.sqrt(decoded.length)));
      const padding = input.padding ?? 0;
      if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(padding) || padding < 0) throw new Error("Columns and padding must be valid non-negative integers");
      const atlas = atlasFrame(decoded, columns, padding);
      await this.codec.encode([atlas], input.outputFilename, "png");
      await this.manifestWriter.write(input.manifestFilename, {
        schemaVersion: 1,
        atlas: input.outputFilename,
        width: atlas.width,
        height: atlas.height,
        cellWidth: first.width,
        cellHeight: first.height,
        columns,
        rows: Math.ceil(decoded.length / columns),
        padding,
        assets: input.inputFilenames.map((filename, index) => ({ filename, index, column: index % columns, row: Math.floor(index / columns) })),
      });
      return ok({ operation: "export_asset_pack", atlas: input.outputFilename, manifest: input.manifestFilename, assets: decoded.length });
    } catch (error) { return fail(error); }
  }

  public async runRecipe(input: AssetRecipeInput): Promise<AssetOperationResult> {
    try {
      if (input.inputFilenames.length === 0) throw new Error("At least one input filename is required");
      const plan = { recipe: input.recipe, inputs: input.inputFilenames, output: input.outputFilename ?? null, steps: this.recipeSteps(input.recipe) };
      if (input.dryRun ?? true) return ok({ dryRun: true, ...plan });
      const outputFilename = input.outputFilename;
      if (!outputFilename) throw new Error("outputFilename is required when dryRun is false");
      if (input.recipe === "gif") return this.exportGif(input.inputFilenames[0]!, outputFilename);
      if (input.recipe === "atlas") return this.buildAtlas({ inputFilenames: input.inputFilenames, outputFilename });
      const options = { inputFilename: input.inputFilenames[0]!, outputFilename, width: input.width ?? 64, height: input.height ?? 64, maxColors: input.maxColors ?? 32, format: input.recipe === "animation_pixel_art" ? "gif" as ImageOutputFormat : "png" as ImageOutputFormat };
      return this.convertImage(options, input.recipe === "animation_pixel_art");
    } catch (error) { return fail(error); }
  }

  public async runBatch(input: BatchAssetJobInput): Promise<AssetOperationResult> {
    try {
      if (input.jobs.length === 0) throw new Error("At least one asset job is required");
      if (input.dryRun ?? true) return ok({ dryRun: true, jobs: input.jobs.map((job) => ({ recipe: job.recipe, inputs: job.inputFilenames, output: job.outputFilename ?? null, steps: this.recipeSteps(job.recipe) })) });
      const results: Array<{ recipe: string; ok: boolean; message: string }> = [];
      for (const job of input.jobs) {
        const result = await this.runRecipe({ ...job, dryRun: false });
        results.push({ recipe: job.recipe, ok: result.ok, message: result.message });
        if (!result.ok) return { ok: false, message: JSON.stringify({ failedJob: job.recipe, results }) };
      }
      return ok({ dryRun: false, completed: results.length, results });
    } catch (error) { return fail(error); }
  }

  private recipeSteps(recipe: AssetRecipeInput["recipe"]): string[] {
    if (recipe === "pixel_art") return ["decode image", "resize with box filter", "build deterministic palette", "encode PNG"];
    if (recipe === "animation_pixel_art") return ["decode all frames", "resize with shared palette", "preserve delays", "encode GIF"];
    if (recipe === "gif") return ["decode image or animation", "preserve frame order and delays", "encode GIF"];
    return ["decode first frame of each source", "pack equal-size frames", "encode PNG atlas"];
  }
}
