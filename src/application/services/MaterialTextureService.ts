import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { RasterCodec } from "../../domain/image-assets.js";
import type { MaterialTextureInput } from "../../domain/visual-assets.js";

function ok(value: unknown): AssetOperationResult { return { ok: true, message: JSON.stringify(value) }; }
function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function hashNoise(seed: number, x: number, y: number): number {
  let value = Math.imul(x + seed * 31, 374761393) ^ Math.imul(y + seed * 17, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}
function channel(value: number, delta: number): number { return Math.max(0, Math.min(255, value + delta)); }
function assertDistinctFiles(inputFilename: string, outputFilename: string): void {
  if (inputFilename.trim().toLowerCase() === outputFilename.trim().toLowerCase()) throw new Error("Input and output filenames must be different");
}

export class MaterialTextureService {
  public constructor(private readonly codec: RasterCodec) {}

  public async apply(input: MaterialTextureInput): Promise<AssetOperationResult> {
    try {
      assertDistinctFiles(input.inputFilename, input.outputFilename);
      const intensity = input.intensity ?? 0.6;
      if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) throw new Error("Texture intensity must be between 0 and 1");
      const source = await this.codec.decode(input.inputFilename);
      if (source.length === 0) throw new Error("Input has no frames");
      const frames = source.map((frame, frameIndex) => {
        const pixels = new Uint8ClampedArray(frame.pixels);
        const strength = Math.round(intensity * 42);
        for (let y = 0; y < frame.height; y += 1) {
          for (let x = 0; x < frame.width; x += 1) {
            const offset = (y * frame.width + x) * 4;
            if ((pixels[offset + 3] ?? 0) === 0) continue;
            const noise = hashNoise(input.seed + frameIndex * 101, x, y);
            const delta = Math.round((noise - 0.5) * strength);
            const wave = input.material === "water" && ((x + y + frameIndex * 2) % 7 === 0) ? Math.round(strength * 0.45) : 0;
            const channelDelta = delta + wave;
            if (input.material === "water") {
              pixels[offset] = channel(pixels[offset] ?? 0, Math.round(channelDelta * 0.45));
              pixels[offset + 1] = channel(pixels[offset + 1] ?? 0, Math.round(channelDelta * 0.8));
              pixels[offset + 2] = channel(pixels[offset + 2] ?? 0, channelDelta);
            } else if (input.material === "grass") {
              pixels[offset] = channel(pixels[offset] ?? 0, Math.round(channelDelta * 0.35));
              pixels[offset + 1] = channel(pixels[offset + 1] ?? 0, channelDelta);
              pixels[offset + 2] = channel(pixels[offset + 2] ?? 0, Math.round(channelDelta * 0.3));
            } else if (input.material === "earth") {
              pixels[offset] = channel(pixels[offset] ?? 0, Math.round(channelDelta * 0.9));
              pixels[offset + 1] = channel(pixels[offset + 1] ?? 0, Math.round(channelDelta * 0.65));
              pixels[offset + 2] = channel(pixels[offset + 2] ?? 0, Math.round(channelDelta * 0.35));
            } else {
              pixels[offset] = channel(pixels[offset] ?? 0, channelDelta);
              pixels[offset + 1] = channel(pixels[offset + 1] ?? 0, channelDelta);
              pixels[offset + 2] = channel(pixels[offset + 2] ?? 0, channelDelta);
            }
          }
        }
        return { ...frame, pixels };
      });
      const format = input.format ?? (source.length > 1 ? "gif" : "png");
      await this.codec.encode(frames, input.outputFilename, format);
      return ok({ operation: "apply_material_texture", input: input.inputFilename, output: input.outputFilename, material: input.material, seed: input.seed, intensity, frames: frames.length, format, deterministic: true, sourcePreserved: true });
    } catch (error) { return fail(error); }
  }
}
