import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { RasterCodec } from "../../domain/image-assets.js";
import type { DepthLightingInput } from "../../domain/visual-assets.js";

function ok(value: unknown): AssetOperationResult { return { ok: true, message: JSON.stringify(value) }; }
function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function channel(value: number, factor: number): number { return Math.max(0, Math.min(255, Math.round(value * factor))); }
function assertDistinctFiles(inputFilename: string, outputFilename: string): void {
  if (inputFilename.trim().toLowerCase() === outputFilename.trim().toLowerCase()) throw new Error("Input and output filenames must be different");
}
function directionVector(direction: DepthLightingInput["direction"]): [number, number] {
  if (direction === "north") return [0, -1];
  if (direction === "south") return [0, 1];
  if (direction === "east") return [1, 0];
  if (direction === "west") return [-1, 0];
  if (direction === "north_east") return [1, -1];
  if (direction === "north_west") return [-1, -1];
  if (direction === "south_west") return [-1, 1];
  return [1, 1];
}
function alphaAt(pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;
  return pixels[(y * width + x) * 4 + 3] ?? 0;
}

export class DepthLightingService {
  public constructor(private readonly codec: RasterCodec) {}

  public async apply(input: DepthLightingInput): Promise<AssetOperationResult> {
    try {
      assertDistinctFiles(input.inputFilename, input.outputFilename);
      const strength = input.strength ?? 0.7;
      const ambient = input.ambient ?? 0.35;
      if (!Number.isFinite(strength) || strength < 0 || strength > 1) throw new Error("Lighting strength must be between 0 and 1");
      if (!Number.isFinite(ambient) || ambient < 0 || ambient > 1) throw new Error("Lighting ambient must be between 0 and 1");
      const source = await this.codec.decode(input.inputFilename);
      if (source.length === 0) throw new Error("Input has no frames");
      const [dx, dy] = directionVector(input.direction);
      const frames = source.map((frame) => {
        const pixels = new Uint8ClampedArray(frame.pixels);
        for (let y = 0; y < frame.height; y += 1) {
          for (let x = 0; x < frame.width; x += 1) {
            const offset = (y * frame.width + x) * 4;
            if ((pixels[offset + 3] ?? 0) === 0) continue;
            const towardLight = alphaAt(frame.pixels, frame.width, frame.height, x + dx, y + dy) === 0 ? 1 : 0;
            const awayFromLight = alphaAt(frame.pixels, frame.width, frame.height, x - dx, y - dy) === 0 ? 1 : 0;
            const directional = ((dx * (frame.width <= 1 ? 0 : x / (frame.width - 1)) + dy * (frame.height <= 1 ? 0 : y / (frame.height - 1))) + 1) / 2;
            const factor = Math.max(0.18, ambient + strength * (0.38 * directional + 0.48 * towardLight - 0.2 * awayFromLight));
            pixels[offset] = channel(pixels[offset] ?? 0, factor * (towardLight ? 1.04 : 1));
            pixels[offset + 1] = channel(pixels[offset + 1] ?? 0, factor * (towardLight ? 1.02 : 1));
            pixels[offset + 2] = channel(pixels[offset + 2] ?? 0, factor * (towardLight ? 0.96 : 1));
          }
        }
        return { ...frame, pixels };
      });
      const format = input.format ?? (source.length > 1 ? "gif" : "png");
      await this.codec.encode(frames, input.outputFilename, format);
      return ok({ operation: "apply_depth_lighting", input: input.inputFilename, output: input.outputFilename, direction: input.direction, strength, ambient, frames: frames.length, format, deterministic: true, sourcePreserved: true });
    } catch (error) { return fail(error); }
  }
}
