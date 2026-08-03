import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { RasterCodec } from "../../domain/image-assets.js";
import type { RasterFrame } from "../../domain/pixel-art.js";
import type { SpriteEffectsGateway } from "../../domain/sprite-effects.js";
import type { AssetVariantArtifact, AssetVariantKind, AssetVariantPackGateway, AssetVariantPackInput } from "../../domain/asset-variant-pack.js";

function ok(value: unknown): AssetOperationResult { return { ok: true, message: JSON.stringify(value) }; }
function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function hash(seed: number, index: number): number { let value = Math.imul(seed + index * 374761393, 668265263); value = Math.imul(value ^ (value >>> 13), 1274126177); return ((value ^ (value >>> 16)) >>> 0) / 4294967295; }
function setPixel(pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number, color: [number, number, number, number]): boolean { if (x < 0 || y < 0 || x >= width || y >= height) return false; pixels.set(color, (y * width + x) * 4); return true; }
function blendPixel(pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number, color: [number, number, number, number], mix: number): boolean { if (x < 0 || y < 0 || x >= width || y >= height) return false; const offset = (y * width + x) * 4; const factor = clamp(mix * color[3] / 255, 0, 1); for (let channel = 0; channel < 3; channel += 1) pixels[offset + channel] = Math.round((pixels[offset + channel] ?? 0) * (1 - factor) + color[channel]! * factor); return true; }

export class AssetVariantPackService implements AssetVariantPackGateway {
  public constructor(private readonly codec: RasterCodec, private readonly effects: SpriteEffectsGateway) {}

  public async generateVariantPack(input: AssetVariantPackInput): Promise<AssetOperationResult> {
    try {
      this.validate(input);
      const source = await this.codec.decode(input.inputFilename);
      const firstFrame = source[0];
      if (!firstFrame) throw new Error("Variant pack requires at least one source frame");
      const prefix = input.outputPrefix.replace(/\.(?:png|gif|webp|aseprite)$/i, "");
      const artifacts: AssetVariantArtifact[] = [];
      for (const variant of input.variants) {
        const outputFilename = `${prefix}-${variant}.gif`;
        const result = await this.generateOne(variant, input, source, firstFrame, outputFilename);
        if (!result.ok) throw new Error(result.message);
        const value = JSON.parse(result.message) as { operation: string; frames: number; format: "png" | "gif" };
        artifacts.push({ variant, outputFilename, operation: value.operation, frames: value.frames, format: value.format, deterministic: true, sourcePreserved: true });
      }
      return ok({ operation: "generate_variant_pack", input: input.inputFilename, outputPrefix: prefix, seed: input.seed, artifacts, deterministic: true, sourcePreserved: true });
    } catch (error) { return fail(error); }
  }

  private async generateOne(variant: AssetVariantKind, input: AssetVariantPackInput, source: RasterFrame[], firstFrame: RasterFrame, outputFilename: string): Promise<AssetOperationResult> {
    if (variant === "rain") return this.effects.generateRainOverlay({ inputFilename: input.inputFilename, outputFilename, seed: input.seed, intensity: 0.7, wind: 0.12, color: "#B7D7FF", frames: input.frames, delayMs: input.delayMs ?? 90, format: "gif" });
    if (variant === "night") return this.effects.applyColorGrade({ inputFilename: input.inputFilename, outputFilename, brightness: -0.22, contrast: 1.08, saturation: 0.9, format: "gif" });
    if (variant === "day_night") return this.effects.generateDayNightCycle({ inputFilename: input.inputFilename, outputFilename, frames: input.frames, seed: input.seed, intensity: 0.8, delayMs: input.delayMs ?? 90, format: "gif" });
    if (variant === "walk") return this.effects.generateMotionPack({ inputFilename: input.inputFilename, outputFilename, motion: "walk", frames: input.frames, seed: input.seed, amplitude: 2, delayMs: input.delayMs ?? 90, format: "gif" });
    if (variant === "water_reflection") return this.effects.generateWaterReflection({ inputFilename: input.inputFilename, outputFilename, waterline: Math.max(1, Math.floor(firstFrame.height * 0.55)), frames: input.frames, seed: input.seed, amplitude: 1, opacity: 0.6, delayMs: input.delayMs ?? 90, format: "gif" });
    if (variant === "water_caustics") return this.effects.generateWaterCaustics({ inputFilename: input.inputFilename, outputFilename, frames: input.frames, seed: input.seed, intensity: 0.7, scale: 4, color: "#DFF6FF", delayMs: input.delayMs ?? 90, format: "gif" });
    if (variant === "wind_sway" || variant === "wind") return this.effects.generateWindSway({ inputFilename: input.inputFilename, outputFilename, frames: input.frames, seed: input.seed, amplitude: 2, direction: "right", delayMs: input.delayMs ?? 90, format: "gif" });
    const frames = Array.from({ length: input.frames }, (_, frameIndex) => {
      const sourceFrame = source[frameIndex % source.length] ?? firstFrame;
      if (variant === "fire") return this.fireFrame(sourceFrame, frameIndex, input.seed, input.delayMs);
      if (variant === "earthquake") return this.earthquakeFrame(sourceFrame, frameIndex, input.seed, input.delayMs);
      return this.birdsFrame(sourceFrame, frameIndex, input.seed, input.delayMs);
    });
    await this.codec.encode(frames, outputFilename, "gif");
    return ok({ operation: `generate_${variant}_variant`, input: input.inputFilename, output: outputFilename, frames: frames.length, format: "gif", deterministic: true, sourcePreserved: true });
  }

  private fireFrame(source: RasterFrame, frameIndex: number, seed: number, delayMs?: number): RasterFrame {
    const pixels = new Uint8ClampedArray(source.pixels);
    let firstOpaque: [number, number] | null = null;
    for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
      const offset = (y * source.width + x) * 4;
      if ((source.pixels[offset + 3] ?? 0) === 0) continue;
      firstOpaque ??= [x, y];
      const heat = clamp(1 - y / Math.max(1, source.height - 1) + (hash(seed + frameIndex * 97, x + y * source.width) - 0.5) * 0.18, 0, 1);
      const color: [number, number, number, number] = heat > 0.66 ? [255, 214, 91, 255] : heat > 0.36 ? [247, 116, 54, 255] : [164, 48, 48, 255];
      blendPixel(pixels, source.width, source.height, x, y, color, 0.18 + heat * 0.32);
    }
    if (firstOpaque) blendPixel(pixels, source.width, source.height, firstOpaque[0], firstOpaque[1], [255, 214, 91, 255], 0.08 + (frameIndex % 3) * 0.05);
    return { ...source, pixels, delayMs: delayMs ?? source.delayMs ?? 90 };
  }

  private earthquakeFrame(source: RasterFrame, frameIndex: number, seed: number, delayMs?: number): RasterFrame {
    const pixels = new Uint8ClampedArray(source.width * source.height * 4);
    const offset = ((frameIndex + Math.abs(seed)) % 4) - 2;
    for (let y = 0; y < source.height; y += 1) for (let x = 0; x < source.width; x += 1) {
      const sourceOffset = (y * source.width + x) * 4;
      if ((source.pixels[sourceOffset + 3] ?? 0) === 0) continue;
      setPixel(pixels, source.width, source.height, clamp(x + offset, 0, source.width - 1), y, [source.pixels[sourceOffset] ?? 0, source.pixels[sourceOffset + 1] ?? 0, source.pixels[sourceOffset + 2] ?? 0, source.pixels[sourceOffset + 3] ?? 0]);
    }
    return { ...source, pixels, delayMs: delayMs ?? source.delayMs ?? 90 };
  }

  private birdsFrame(source: RasterFrame, frameIndex: number, seed: number, delayMs?: number): RasterFrame {
    const pixels = new Uint8ClampedArray(source.pixels); let changed = false;
    const birds = Math.max(1, Math.min(6, Math.floor(source.width / 5)));
    const drawBirdPixel = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= source.width || y >= source.height) return false;
      const offset = (y * source.width + x) * 4;
      return (pixels[offset + 3] ?? 0) === 0 ? setPixel(pixels, source.width, source.height, x, y, [25, 31, 55, 230]) : blendPixel(pixels, source.width, source.height, x, y, [25, 31, 55, 230], 0.9);
    };
    for (let bird = 0; bird < birds; bird += 1) {
      const x = Math.floor(hash(seed + frameIndex * 31, bird) * Math.max(1, source.width - 3));
      const y = Math.floor(hash(seed + 193, bird) * Math.max(1, Math.floor(source.height / 3)));
      changed = drawBirdPixel(x, y) || changed;
      changed = drawBirdPixel(x + 1, y - 1) || changed;
      changed = drawBirdPixel(x + 2, y) || changed;
    }
    if (!changed && source.width > 0 && source.height > 0) drawBirdPixel((Math.abs(seed) + frameIndex) % source.width, 0);
    return { ...source, pixels, delayMs: delayMs ?? source.delayMs ?? 90 };
  }

  private validate(input: AssetVariantPackInput): void {
    if (!input.inputFilename.trim() || !input.outputPrefix.trim()) throw new Error("Variant pack filenames are required");
    if (input.inputFilename.includes("\0") || input.outputPrefix.includes("\0")) throw new Error("Variant pack filenames cannot contain null bytes");
    if (input.inputFilename.trim().toLowerCase() === input.outputPrefix.trim().toLowerCase()) throw new Error("Variant pack input and output prefix must be different");
    if (!Array.isArray(input.variants) || input.variants.length < 1 || input.variants.length > 11) throw new Error("Variant pack requires between 1 and 11 variants");
    if (new Set(input.variants).size !== input.variants.length) throw new Error("Variant pack variants must be unique");
    if (!Number.isInteger(input.frames) || input.frames < 2 || input.frames > 24) throw new Error("Variant pack frames must be an integer from 2 to 24");
    if (!Number.isInteger(input.seed)) throw new Error("Variant pack seed must be an integer");
    if (input.delayMs !== undefined && (!Number.isInteger(input.delayMs) || input.delayMs <= 0)) throw new Error("Variant pack delay must be a positive integer");
  }
}
