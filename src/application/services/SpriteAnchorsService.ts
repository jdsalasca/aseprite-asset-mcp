import path from "node:path";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetManifestWriter } from "../../domain/image-assets.js";
import type { SpriteGeometryPort } from "../../domain/sprite-geometry.js";
import type { SpriteAnchorsInput, SpriteAnchorsPort } from "../../domain/sprite-anchors.js";

interface Bounds { x: number; y: number; width: number; height: number; }
interface Point { x: number; y: number; }
interface GeometryFrame { index: number; bounds: Bounds | null; baselineY: number | null; pivot: Point; }
interface GeometryPayload { operation: string; filename: string; frameCount: number; width: number; height: number; frames: GeometryFrame[]; animation: { baselineDrift: number }; quality: { valid: boolean; violations?: string[] }; }

function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function resolved(filename: string): string { return path.resolve(filename).toLowerCase(); }
function assertFilename(filename: string, label: string): void { if (!filename.trim()) throw new Error(`${label} is required`); if (filename.includes("\0")) throw new Error(`${label} cannot contain null bytes`); }
function center(start: number, size: number): number { return start + Math.floor((size - 1) / 2); }

export class SpriteAnchorsService implements SpriteAnchorsPort {
  public constructor(private readonly geometry: SpriteGeometryPort, private readonly manifestWriter: AssetManifestWriter) {}

  public async generate(input: SpriteAnchorsInput): Promise<AssetOperationResult> {
    try {
      assertFilename(input.filename, "Sprite filename");
      assertFilename(input.outputFilename, "Anchor manifest filename");
      if (resolved(input.filename) === resolved(input.outputFilename)) throw new Error("Sprite and anchor manifest filenames must be different");
      const minComponentPixels = input.minComponentPixels ?? 1;
      if (!Number.isInteger(minComponentPixels) || minComponentPixels < 1 || minComponentPixels > 4096) throw new Error("Minimum component pixels must be an integer between 1 and 4096");
      const geometryResult = await this.geometry.inspect({ filename: input.filename, minComponentPixels });
      if (!geometryResult.ok) return geometryResult;
      let payload: GeometryPayload;
      try { payload = JSON.parse(geometryResult.message) as GeometryPayload; } catch { throw new Error("Geometry service returned malformed geometry JSON"); }
      if (payload.operation !== "inspect_sprite_geometry" || !Array.isArray(payload.frames) || !Number.isInteger(payload.width) || !Number.isInteger(payload.height)) throw new Error("Geometry service returned an invalid geometry contract");
      const frames = payload.frames.map((frame) => {
        const bounds = frame.bounds;
        const anchors = bounds ? {
          bottom_center: { x: frame.pivot.x, y: frame.pivot.y },
          center: { x: center(bounds.x, bounds.width), y: center(bounds.y, bounds.height) },
          top_center: { x: center(bounds.x, bounds.width), y: bounds.y },
          left_center: { x: bounds.x, y: center(bounds.y, bounds.height) },
          right_center: { x: bounds.x + bounds.width - 1, y: center(bounds.y, bounds.height) },
          baseline: frame.baselineY === null ? null : { x: frame.pivot.x, y: frame.baselineY },
        } : { bottom_center: null, center: null, top_center: null, left_center: null, right_center: null, baseline: null };
        return { index: frame.index, bounds, anchors };
      });
      await this.manifestWriter.write(input.outputFilename, { schemaVersion: 1, kind: "sprite_anchors", source: input.filename, width: payload.width, height: payload.height, minComponentPixels, anchorTypes: ["bottom_center", "center", "top_center", "left_center", "right_center", "baseline"], frames, animation: payload.animation, quality: payload.quality, deterministic: true, sourcePreserved: true });
      return { ok: true, message: JSON.stringify({ operation: "generate_sprite_anchors", manifest: input.outputFilename, filename: input.filename, frames: frames.length, anchorTypes: 6, baselineDrift: payload.animation.baselineDrift, deterministic: true, sourcePreserved: true }) };
    } catch (error) { return fail(error); }
  }
}
