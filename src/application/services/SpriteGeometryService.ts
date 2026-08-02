import path from "node:path";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { RasterCodec } from "../../domain/image-assets.js";
import type { RasterFrame } from "../../domain/pixel-art.js";
import type { SpriteGeometryInput, SpriteGeometryPort } from "../../domain/sprite-geometry.js";

type Bounds = { x: number; y: number; width: number; height: number };
type Component = Bounds & { pixels: number };

function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }

function inspectFrame(frame: RasterFrame, index: number, minComponentPixels: number): Record<string, unknown> {
  const opaque = new Set<string>();
  let minX = frame.width; let minY = frame.height; let maxX = -1; let maxY = -1; let opaquePixels = 0;
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if ((frame.pixels[(y * frame.width + x) * 4 + 3] ?? 0) <= 0) continue;
    opaque.add(`${x},${y}`); opaquePixels += 1; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const components: Component[] = [];
  while (opaque.size > 0) {
    const seed = opaque.values().next().value as string;
    const queue = [seed]; opaque.delete(seed); const pixels: Array<[number, number]> = [];
    while (queue.length > 0) {
      const current = queue.shift()!; const [x, y] = current.split(",").map(Number) as [number, number]; pixels.push([x, y]);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        const key = `${nx},${ny}`;
        if (opaque.has(key)) { opaque.delete(key); queue.push(key); }
      }
    }
    if (pixels.length < minComponentPixels) continue;
    const xs = pixels.map(([x]) => x); const ys = pixels.map(([, y]) => y);
    components.push({ x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) + 1, height: Math.max(...ys) - Math.min(...ys) + 1, pixels: pixels.length });
  }
  const bounds: Bounds | null = maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  return { index, opaquePixels, bounds, baselineY: maxY < 0 ? null : maxY, pivot: { x: bounds ? Math.floor((bounds.x + maxX) / 2) : Math.floor(frame.width / 2), y: maxY < 0 ? frame.height - 1 : maxY, mode: "bottom_center" }, components };
}

export class SpriteGeometryService implements SpriteGeometryPort {
  public constructor(private readonly codec: RasterCodec) {}

  public async inspect(input: SpriteGeometryInput): Promise<AssetOperationResult> {
    try {
      if (!input.filename.trim()) throw new Error("Sprite filename is required");
      if (input.filename.includes("\0")) throw new Error("Sprite filename cannot contain null bytes");
      if (input.minComponentPixels !== undefined && input.minComponentPixels < 1) throw new Error("Minimum component pixels must be at least 1");
      path.resolve(input.filename);
      const frames = await this.codec.decode(input.filename);
      if (frames.length === 0) throw new Error("Sprite must contain at least one frame");
      const threshold = input.minComponentPixels ?? 1;
      const frameViews = frames.map((frame, index) => inspectFrame(frame, index, threshold));
      const bounds = frameViews.map((frame) => frame.bounds);
      const baselines = frameViews.map((frame) => frame.baselineY).filter((value): value is number => value !== null);
      const baselineDrift = baselines.length > 1 ? Math.max(...baselines) - Math.min(...baselines) : 0;
      const stableBounds = bounds.every((value) => JSON.stringify(value) === JSON.stringify(bounds[0]));
      const payload = { operation: "inspect_sprite_geometry", filename: input.filename, frameCount: frames.length, frames: frameViews, animation: { stableBounds, baselineDrift }, quality: { valid: true }, deterministic: true, sourcePreserved: true };
      return { ok: true, message: JSON.stringify(payload) };
    } catch (error) { return fail(error); }
  }
}
