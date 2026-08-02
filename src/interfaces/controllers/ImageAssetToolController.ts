import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ExportAnimationPort } from "../../application/ports/AssetCapabilityPorts.js";
import { PixelArtAssetService } from "../../application/services/PixelArtAssetService.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { ContactSheetService } from "../../application/services/ContactSheetService.js";
import type { AssetBatchQualityService } from "../../application/services/AssetBatchQualityService.js";
import type { AnimationQualityService } from "../../application/services/AnimationQualityService.js";

export class ImageAssetToolController {
  public constructor(private readonly assets: ExportAnimationPort, private readonly imageAssets: PixelArtAssetService, private readonly contactSheets: ContactSheetService, private readonly batchQuality: AssetBatchQualityService, private readonly animationQuality: AnimationQualityService) {}

  public register(server: McpServer): void {
    server.registerTool("convert_image_to_pixel_art", {
      description: "Convert one image to pixel art with a deterministic shared palette.",
      inputSchema: {
        input_filename: z.string().min(1), output_filename: z.string().min(1), width: z.number().int().positive(), height: z.number().int().positive(),
        max_colors: z.number().int().min(2).max(256).default(32), resize_mode: z.enum(["box", "nearest"]).default("box"), dither: z.enum(["none", "bayer4x4"]).default("none"), alpha_threshold: z.number().int().min(0).max(255).default(1),
      },
    }, async ({ input_filename, output_filename, width, height, max_colors, resize_mode, dither, alpha_threshold }) => this.result(await this.imageAssets.convertImage({ inputFilename: input_filename, outputFilename: output_filename, width, height, maxColors: max_colors, resizeMode: resize_mode, dither, alphaThreshold: alpha_threshold }, false)));

    server.registerTool("convert_animation_to_pixel_art", {
      description: "Convert all image frames to pixel art and preserve animation delays.",
      inputSchema: {
        input_filename: z.string().min(1), output_filename: z.string().min(1), width: z.number().int().positive(), height: z.number().int().positive(),
        max_colors: z.number().int().min(2).max(256).default(32), resize_mode: z.enum(["box", "nearest"]).default("box"), dither: z.enum(["none", "bayer4x4"]).default("none"), alpha_threshold: z.number().int().min(0).max(255).default(1),
      },
    }, async ({ input_filename, output_filename, width, height, max_colors, resize_mode, dither, alpha_threshold }) => this.result(await this.imageAssets.convertImage({ inputFilename: input_filename, outputFilename: output_filename, width, height, maxColors: max_colors, resizeMode: resize_mode, dither, alphaThreshold: alpha_threshold, format: "gif" }, true)));

    server.registerTool("upscale_pixel_art", {
      description: "Upscale one image or animation with deterministic nearest-neighbor pixels and preserved transparency.",
      inputSchema: { input_filename: z.string().min(1), output_filename: z.string().min(1), scale: z.number().int().min(2).max(16), format: z.enum(["png", "gif"]).optional() },
    }, async ({ input_filename, output_filename, scale, format }) => this.result(await this.imageAssets.upscalePixelArt({ inputFilename: input_filename, outputFilename: output_filename, scale, ...(format ? { format } : {}) })));

    server.registerTool("harmonize_asset_palette", {
      description: "Apply a deterministic accent palette to a PNG or GIF, preserve transparency and timing, and cap output colors without overwriting the source.",
      inputSchema: { input_filename: z.string().min(1), output_filename: z.string().min(1), accent_color: z.string().regex(/^#?(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/), strength: z.number().min(0).max(1).default(0.65), max_colors: z.number().int().min(2).max(64).default(16), format: z.enum(["png", "gif"]).optional() },
    }, async ({ input_filename, output_filename, accent_color, strength, max_colors, format }) => this.result(await this.imageAssets.harmonizePalette({ inputFilename: input_filename, outputFilename: output_filename, accentColor: accent_color, strength, maxColors: max_colors, ...(format ? { format } : {}) })));

    server.registerTool("build_contact_sheet", {
      description: "Fit heterogeneous sprite previews into a deterministic nearest-neighbor contact sheet and write a navigable JSON manifest.",
      inputSchema: { input_filenames: z.array(z.string().min(1)).min(1).max(64), output_filename: z.string().min(1), manifest_filename: z.string().min(1), cell_width: z.number().int().min(8).max(512), cell_height: z.number().int().min(8).max(512), columns: z.number().int().min(1).max(16).optional(), padding: z.number().int().min(0).max(64).default(0) },
    }, async ({ input_filenames, output_filename, manifest_filename, cell_width, cell_height, columns, padding }) => this.result(await this.contactSheets.build({ inputFilenames: [...input_filenames], outputFilename: output_filename, manifestFilename: manifest_filename, cellWidth: cell_width, cellHeight: cell_height, ...(columns === undefined ? {} : { columns }), padding })));

    server.registerTool("export_animation_gif", {
      description: "Convert a PNG, GIF, or animated image into a GIF while preserving frames.",
      inputSchema: { input_filename: z.string().min(1), output_filename: z.string().min(1) },
    }, async ({ input_filename, output_filename }) => input_filename.toLowerCase().endsWith(".aseprite")
      ? this.result(await this.assets.exportSprite(input_filename, output_filename, "gif"))
      : this.result(await this.imageAssets.exportGif(input_filename, output_filename)));

    server.registerTool("inspect_asset", {
      description: "Return compact dimensions, frame, palette, transparency, and delay statistics.",
      inputSchema: { filename: z.string().min(1) },
    }, async ({ filename }) => this.result(await this.imageAssets.inspect(filename)));

    server.registerTool("validate_asset_quality", {
      description: "Check palette size and isolated pixels before an asset enters a game build.",
      inputSchema: { filename: z.string().min(1), max_colors: z.number().int().min(1).max(256).default(256), max_isolated_pixels: z.number().int().nonnegative().default(9007199254740991) },
    }, async ({ filename, max_colors, max_isolated_pixels }) => this.result(await this.imageAssets.validate({ filename, maxColors: max_colors, maxIsolatedPixels: max_isolated_pixels })));

    server.registerTool("inspect_asset_bundle", {
      description: "Inspect one asset and return compact quality violations and deterministic recommendations in one call.",
      inputSchema: { filename: z.string().min(1), max_colors: z.number().int().min(1).max(256).default(256), max_isolated_pixels: z.number().int().nonnegative().default(9007199254740991) },
    }, async ({ filename, max_colors, max_isolated_pixels }) => this.result(await this.imageAssets.qualityBundle({ filename, maxColors: max_colors, maxIsolatedPixels: max_isolated_pixels })));

    server.registerTool("inspect_asset_batch", {
      description: "Inspect up to 32 sprites in one deterministic quality pass and return a compact collection summary.",
      inputSchema: { filenames: z.array(z.string().min(1)).min(1).max(32), max_colors: z.number().int().min(1).max(256).default(256), max_isolated_pixels: z.number().int().nonnegative().default(9007199254740991) },
    }, async ({ filenames, max_colors, max_isolated_pixels }) => this.result(await this.batchQuality.inspect({ filenames: [...filenames], maxColors: max_colors, maxIsolatedPixels: max_isolated_pixels })));

    server.registerTool("inspect_animation_quality", {
      description: "Audit an animation for duplicate frames, timing, palette drift, movement bounds, and loop seam issues.",
      inputSchema: { filename: z.string().min(1) },
    }, async ({ filename }) => this.result(await this.animationQuality.inspect({ filename })));

    server.registerTool("build_texture_atlas", {
      description: "Pack equal-size image frames into one PNG texture atlas.",
      inputSchema: { input_filenames: z.array(z.string().min(1)).min(1), output_filename: z.string().min(1), columns: z.number().int().positive().optional(), padding: z.number().int().nonnegative().default(0) },
    }, async ({ input_filenames, output_filename, columns, padding }) => this.result(await this.imageAssets.buildAtlas({ inputFilenames: input_filenames, outputFilename: output_filename, ...(columns === undefined ? {} : { columns }), padding })));

    server.registerTool("export_asset_pack", {
      description: "Export an atlas PNG and a compact JSON manifest in one call.",
      inputSchema: { input_filenames: z.array(z.string().min(1)).min(1), output_filename: z.string().min(1), manifest_filename: z.string().min(1), columns: z.number().int().positive().optional(), padding: z.number().int().nonnegative().default(0) },
    }, async ({ input_filenames, output_filename, manifest_filename, columns, padding }) => this.result(await this.imageAssets.exportPack({ inputFilenames: input_filenames, outputFilename: output_filename, manifestFilename: manifest_filename, ...(columns === undefined ? {} : { columns }), padding })));

    server.registerTool("run_asset_recipe", {
      description: "Run one compact asset recipe or return its dry-run plan.",
      inputSchema: { recipe: z.enum(["pixel_art", "animation_pixel_art", "gif", "atlas"]), input_filenames: z.array(z.string().min(1)).min(1), output_filename: z.string().min(1).optional(), width: z.number().int().positive().optional(), height: z.number().int().positive().optional(), max_colors: z.number().int().min(2).max(256).default(32), dry_run: z.boolean().default(true) },
    }, async ({ recipe, input_filenames, output_filename, width, height, max_colors, dry_run }) => this.result(await this.imageAssets.runRecipe({ recipe, inputFilenames: input_filenames, ...(output_filename ? { outputFilename: output_filename } : {}), ...(width === undefined ? {} : { width }), ...(height === undefined ? {} : { height }), maxColors: max_colors, dryRun: dry_run })));

    server.registerTool("batch_asset_job", {
      description: "Run several compact asset recipes in order or return one batch plan.",
      inputSchema: {
        jobs: z.array(z.object({ recipe: z.enum(["pixel_art", "animation_pixel_art", "gif", "atlas"]), input_filenames: z.array(z.string().min(1)).min(1), output_filename: z.string().min(1).optional(), width: z.number().int().positive().optional(), height: z.number().int().positive().optional(), max_colors: z.number().int().min(2).max(256).default(32) })).min(1),
        dry_run: z.boolean().default(true),
      },
    }, async ({ jobs, dry_run }) => this.result(await this.imageAssets.runBatch({ jobs: jobs.map((job) => ({ recipe: job.recipe, inputFilenames: job.input_filenames, ...(job.output_filename ? { outputFilename: job.output_filename } : {}), ...(job.width === undefined ? {} : { width: job.width }), ...(job.height === undefined ? {} : { height: job.height }), maxColors: job.max_colors })), dryRun: dry_run })));
  }

  private result(operation: AssetOperationResult): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] }; }
}
