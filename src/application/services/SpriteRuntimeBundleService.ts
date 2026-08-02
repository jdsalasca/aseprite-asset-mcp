import path from "node:path";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetManifestWriter } from "../../domain/image-assets.js";
import type { AnimationSheetPort } from "../../domain/animation-sheet.js";
import type { SpriteHitboxMode, SpriteHitboxPort } from "../../domain/sprite-hitbox.js";
import type { SpriteRuntimeBundleInput, SpriteRuntimeBundlePort } from "../../domain/sprite-runtime-bundle.js";

interface AnimationSheetPayload { operation: "build_animation_sheet"; output: string; manifest: string; frames: number; columns: number; rows: number; width: number; height: number; cellWidth: number; cellHeight: number; padding: number; }
interface HitboxPayload { operation: "generate_sprite_hitboxes"; manifest: string; frames: number; mode: SpriteHitboxMode; padding: number; hitboxes: number; }

function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function resolved(filename: string): string { return path.resolve(filename).toLowerCase(); }
function assertFilename(filename: string, label: string): void { if (!filename.trim()) throw new Error(`${label} is required`); if (filename.includes("\0")) throw new Error(`${label} cannot contain null bytes`); }
function parsePayload<T>(result: AssetOperationResult, operation: string): T {
  if (!result.ok) throw new Error(result.message);
  let payload: unknown;
  try { payload = JSON.parse(result.message); } catch { throw new Error(`${operation} returned malformed JSON`); }
  if (!payload || typeof payload !== "object" || (payload as { operation?: unknown }).operation !== operation) throw new Error(`${operation} returned an invalid contract`);
  return payload as T;
}

export class SpriteRuntimeBundleService implements SpriteRuntimeBundlePort {
  public constructor(private readonly animationSheet: AnimationSheetPort, private readonly hitboxes: SpriteHitboxPort, private readonly manifestWriter: AssetManifestWriter) {}

  public async build(input: SpriteRuntimeBundleInput): Promise<AssetOperationResult> {
    try {
      assertFilename(input.inputFilename, "Input filename");
      assertFilename(input.sheetFilename, "Sheet filename");
      assertFilename(input.sheetManifestFilename, "Sheet manifest filename");
      assertFilename(input.hitboxManifestFilename, "Hitbox manifest filename");
      assertFilename(input.bundleManifestFilename, "Bundle manifest filename");
      const names = [input.inputFilename, input.sheetFilename, input.sheetManifestFilename, input.hitboxManifestFilename, input.bundleManifestFilename].map(resolved);
      if (new Set(names).size !== names.length) throw new Error("Input, sheet, hitbox, and bundle filenames must be different");
      if (input.columns !== undefined && (!Number.isInteger(input.columns) || input.columns < 1 || input.columns > 16)) throw new Error("Bundle columns must be an integer between 1 and 16");
      const sheetPadding = input.sheetPadding ?? 0;
      if (!Number.isInteger(sheetPadding) || sheetPadding < 0 || sheetPadding > 64) throw new Error("Bundle sheet padding must be an integer between 0 and 64");
      const hitboxPadding = input.hitboxPadding ?? 0;
      if (!Number.isInteger(hitboxPadding) || hitboxPadding < 0 || hitboxPadding > 16) throw new Error("Bundle hitbox padding must be an integer between 0 and 16");
      const mode = input.hitboxMode ?? "components";
      if (mode !== "components" && mode !== "union") throw new Error("Bundle hitbox mode must be components or union");
      const minComponentPixels = input.minComponentPixels ?? 1;
      if (!Number.isInteger(minComponentPixels) || minComponentPixels < 1 || minComponentPixels > 4096) throw new Error("Bundle minimum component pixels must be an integer between 1 and 4096");

      const sheetResult = await this.animationSheet.build({ inputFilename: input.inputFilename, outputFilename: input.sheetFilename, manifestFilename: input.sheetManifestFilename, ...(input.columns === undefined ? {} : { columns: input.columns }), padding: sheetPadding });
      const sheet = parsePayload<AnimationSheetPayload>(sheetResult, "build_animation_sheet");
      const hitboxResult = await this.hitboxes.generate({ filename: input.inputFilename, outputFilename: input.hitboxManifestFilename, mode, padding: hitboxPadding, minComponentPixels });
      const hitboxes = parsePayload<HitboxPayload>(hitboxResult, "generate_sprite_hitboxes");
      await this.manifestWriter.write(input.bundleManifestFilename, { schemaVersion: 1, kind: "sprite_runtime_bundle", source: input.inputFilename, artifacts: { animationSheet: { output: sheet.output, manifest: sheet.manifest, frames: sheet.frames, columns: sheet.columns, rows: sheet.rows, width: sheet.width, height: sheet.height, cellWidth: sheet.cellWidth, cellHeight: sheet.cellHeight, padding: sheet.padding }, hitboxes: { manifest: hitboxes.manifest, mode: hitboxes.mode, padding: hitboxes.padding, hitboxes: hitboxes.hitboxes } }, deterministic: true, sourcePreserved: true });
      return { ok: true, message: JSON.stringify({ operation: "build_sprite_runtime_bundle", manifest: input.bundleManifestFilename, filename: input.inputFilename, frames: sheet.frames, artifacts: 2, deterministic: true, sourcePreserved: true }) };
    } catch (error) { return fail(error); }
  }
}
