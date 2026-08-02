import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { VisualAssetService } from "../../application/services/VisualAssetService.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";

const HEX_COLOR = /^#?(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export class VisualAssetToolController {
  public constructor(private readonly visualAssets: VisualAssetService) {}

  public register(server: McpServer): void {
    server.registerTool("create_style_bible", {
      description: "Create a deterministic visual style contract for sprites and maps.",
      inputSchema: { filename: z.string().min(1), id: z.string().min(1), base_size: z.number().int().min(4).max(256), palette: z.array(z.string().regex(HEX_COLOR)).min(2).max(256), outline_color: z.string().regex(HEX_COLOR).default("#12243A"), light_direction: z.enum(["north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west"]).default("south_east"), detail_level: z.enum(["low", "medium", "high"]).default("medium"), seed: z.number().int().default(1), materials: z.record(z.string(), z.array(z.string().regex(HEX_COLOR))).default({}) },
    }, async ({ filename, id, base_size, palette, outline_color, light_direction, detail_level, seed, materials }) => this.result(await this.visualAssets.createStyleBible({ filename, style: { id, baseSize: base_size, palette, outlineColor: outline_color, lightDirection: light_direction, detailLevel: detail_level, seed, materials } })));

    server.registerTool("inspect_reference", {
      description: "Analyze reference dimensions, dominant colors, contrast, edges, and transparency.",
      inputSchema: { filename: z.string().min(1) },
    }, async ({ filename }) => this.result(await this.visualAssets.inspectReference(filename)));

    server.registerTool("run_asset_quality_gate", {
      description: "Run compact pixel-art quality checks before export.",
      inputSchema: { filename: z.string().min(1), max_colors: z.number().int().min(1).max(256).default(64), max_isolated_pixels: z.number().int().nonnegative().default(4), min_contrast: z.number().min(0).max(1).default(0.08), max_banding_runs: z.number().int().nonnegative().default(9007199254740991) },
    }, async ({ filename, max_colors, max_isolated_pixels, min_contrast, max_banding_runs }) => this.result(await this.visualAssets.runQualityGate({ filename, maxColors: max_colors, maxIsolatedPixels: max_isolated_pixels, minContrast: min_contrast, maxBandingRuns: max_banding_runs })));

    server.registerTool("build_terrain_tileset", {
      description: "Build a deterministic terrain tileset with adjacency variants and metadata.",
      inputSchema: { output_filename: z.string().min(1), manifest_filename: z.string().min(1), tile_size: z.number().int().min(4).max(128), terrains: z.array(z.enum(["water", "sand", "grass", "rock", "snow", "mud"])).min(2), seed: z.number().int().default(1), palette: z.array(z.string().regex(HEX_COLOR)).min(2).max(256).optional(), outline_color: z.string().regex(HEX_COLOR).optional() },
    }, async ({ output_filename, manifest_filename, tile_size, terrains, seed, palette, outline_color }) => this.result(await this.visualAssets.buildTerrainTileset({ outputFilename: output_filename, manifestFilename: manifest_filename, tileSize: tile_size, terrains, seed, ...(palette || outline_color ? { style: { ...(palette ? { palette } : {}), ...(outline_color ? { outlineColor: outline_color } : {}) } } : {}) })));

    server.registerTool("generate_world_map", {
      description: "Generate a seeded multi-biome map manifest and optional preview.",
      inputSchema: { map_filename: z.string().min(1), preview_filename: z.string().min(1).optional(), width: z.number().int().positive().max(2048), height: z.number().int().positive().max(2048), seed: z.number().int(), biomes: z.array(z.enum(["water", "sand", "grass", "rock", "snow", "mud"])).min(2), detail_level: z.enum(["low", "medium", "high"]).default("medium"), landmark_count: z.number().int().nonnegative().optional() },
    }, async ({ map_filename, preview_filename, width, height, seed, biomes, detail_level, landmark_count }) => this.result(await this.visualAssets.generateWorldMap({ mapFilename: map_filename, ...(preview_filename ? { previewFilename: preview_filename } : {}), width, height, seed, biomes, detailLevel: detail_level, ...(landmark_count === undefined ? {} : { landmarkCount: landmark_count }) })));

    server.registerTool("generate_beach_scene", {
      description: "Generate a seeded beach map, preview, and animated wave GIF.",
      inputSchema: { map_filename: z.string().min(1), preview_filename: z.string().min(1).optional(), wave_filename: z.string().min(1), width: z.number().int().positive().max(2048), height: z.number().int().positive().max(2048), seed: z.number().int(), detail_level: z.enum(["low", "medium", "high"]).default("high"), landmark_count: z.number().int().nonnegative().optional(), wave_frames: z.number().int().min(2).max(24).default(8), wave_delay_ms: z.number().int().positive().default(140) },
    }, async ({ map_filename, preview_filename, wave_filename, width, height, seed, detail_level, landmark_count, wave_frames, wave_delay_ms }) => this.result(await this.visualAssets.generateBeachScene({ mapFilename: map_filename, ...(preview_filename ? { previewFilename: preview_filename } : {}), waveFilename: wave_filename, width, height, seed, biomes: ["water", "sand", "grass", "rock"], detailLevel: detail_level, ...(landmark_count === undefined ? {} : { landmarkCount: landmark_count }), waveFrames: wave_frames, waveDelayMs: wave_delay_ms })));

    server.registerTool("generate_time_of_day_pack", {
      description: "Generate a deterministic day, sunset, night, and sunrise GIF pack.",
      inputSchema: { input_filename: z.string().min(1), output_filename: z.string().min(1), manifest_filename: z.string().min(1).optional(), steps: z.number().int().min(2).max(24).default(8), delay_ms: z.number().int().positive().default(180) },
    }, async ({ input_filename, output_filename, manifest_filename, steps, delay_ms }) => this.result(await this.visualAssets.generateTimeOfDayPack({ inputFilename: input_filename, outputFilename: output_filename, ...(manifest_filename ? { manifestFilename: manifest_filename } : {}), steps, delayMs: delay_ms })));

    server.registerTool("apply_material_texture", {
      description: "Apply deterministic water, earth, grass, stone, or snow granularity while preserving transparency and source data.",
      inputSchema: { input_filename: z.string().min(1), output_filename: z.string().min(1), material: z.enum(["water", "earth", "grass", "stone", "snow"]), seed: z.number().int(), intensity: z.number().min(0).max(1).default(0.6), format: z.enum(["png", "gif"]).optional() },
    }, async ({ input_filename, output_filename, material, seed, intensity, format }) => this.result(await this.visualAssets.applyMaterialTexture({ inputFilename: input_filename, outputFilename: output_filename, material, seed, intensity, ...(format ? { format } : {}) })));

    server.registerTool("generate_environment_pack", {
      description: "Generate a complete beach, forest, village, or cave asset pack.",
      inputSchema: { kind: z.enum(["beach", "forest", "village", "cave"]), output_prefix: z.string().min(1), width: z.number().int().positive().max(2048), height: z.number().int().positive().max(2048), seed: z.number().int(), tile_size: z.number().int().min(4).max(128).default(16), detail_level: z.enum(["low", "medium", "high"]).default("high") },
    }, async ({ kind, output_prefix, width, height, seed, tile_size, detail_level }) => this.result(await this.visualAssets.generateEnvironmentPack({ kind, outputPrefix: output_prefix, width, height, seed, tileSize: tile_size, detailLevel: detail_level })));
  }

  private result(operation: AssetOperationResult): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] }; }
}
