import path from "node:path";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetManifestWriter } from "../../domain/image-assets.js";
import type { SpriteGeometryPort } from "../../domain/sprite-geometry.js";
import type { SpriteHitboxInput, SpriteHitboxMode, SpriteHitboxPort } from "../../domain/sprite-hitbox.js";

interface Bounds { x: number; y: number; width: number; height: number; }
interface GeometryComponent extends Bounds { pixels: number; }
interface GeometryFrame { index: number; bounds: Bounds | null; pivot: { x: number; y: number; mode: "bottom_center" }; components: GeometryComponent[]; }
interface GeometryPayload { operation: string; filename: string; frameCount: number; width: number; height: number; minComponentPixels: number; frames: GeometryFrame[]; animation: { stableBounds: boolean; baselineDrift: number }; quality: { valid: boolean; violations: string[] }; deterministic: true; sourcePreserved: true; }
interface Hitbox extends Bounds { pixels?: number; }

function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function resolved(filename: string): string { return path.resolve(filename).toLowerCase(); }
function assertFilename(filename: string, label: string): void { if (!filename.trim()) throw new Error(`${label} is required`); if (filename.includes("\0")) throw new Error(`${label} cannot contain null bytes`); }
function padded(bounds: Bounds, padding: number, width: number, height: number): Bounds {
  const left = Math.max(0, bounds.x - padding);
  const top = Math.max(0, bounds.y - padding);
  const right = Math.min(width, bounds.x + bounds.width + padding);
  const bottom = Math.min(height, bounds.y + bounds.height + padding);
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

export class SpriteHitboxService implements SpriteHitboxPort {
  public constructor(private readonly geometry: SpriteGeometryPort, private readonly manifestWriter: AssetManifestWriter) {}

  public async generate(input: SpriteHitboxInput): Promise<AssetOperationResult> {
    try {
      assertFilename(input.filename, "Sprite filename");
      assertFilename(input.outputFilename, "Hitbox manifest filename");
      if (resolved(input.filename) === resolved(input.outputFilename)) throw new Error("Sprite and hitbox manifest filenames must be different");
      const mode: SpriteHitboxMode = input.mode ?? "components";
      if (mode !== "components" && mode !== "union") throw new Error("Hitbox mode must be components or union");
      const padding = input.padding ?? 0;
      if (!Number.isInteger(padding) || padding < 0 || padding > 16) throw new Error("Hitbox padding must be an integer between 0 and 16");
      const minComponentPixels = input.minComponentPixels ?? 1;
      if (!Number.isInteger(minComponentPixels) || minComponentPixels < 1 || minComponentPixels > 4096) throw new Error("Minimum component pixels must be an integer between 1 and 4096");

      const geometryResult = await this.geometry.inspect({ filename: input.filename, minComponentPixels });
      if (!geometryResult.ok) return geometryResult;
      let payload: GeometryPayload;
      try { payload = JSON.parse(geometryResult.message) as GeometryPayload; } catch { throw new Error("Geometry service returned malformed geometry JSON"); }
      if (payload.operation !== "inspect_sprite_geometry" || !Array.isArray(payload.frames) || !Number.isInteger(payload.width) || !Number.isInteger(payload.height)) throw new Error("Geometry service returned an invalid geometry contract");
      const frames = payload.frames.map((frame) => ({ index: frame.index, pivot: frame.pivot, hitboxes: (mode === "union" ? (frame.bounds ? [padded(frame.bounds, padding, payload.width, payload.height)] : []) : frame.components.map((component) => ({ ...padded(component, padding, payload.width, payload.height), pixels: component.pixels }))) }));
      await this.manifestWriter.write(input.outputFilename, { schemaVersion: 1, kind: "sprite_hitboxes", source: input.filename, width: payload.width, height: payload.height, mode, padding, minComponentPixels, frames, animation: payload.animation, geometryQuality: payload.quality, deterministic: true, sourcePreserved: true });
      return { ok: true, message: JSON.stringify({ operation: "generate_sprite_hitboxes", manifest: input.outputFilename, filename: input.filename, frames: frames.length, mode, padding, deterministic: true, sourcePreserved: true }) };
    } catch (error) { return fail(error); }
  }
}
