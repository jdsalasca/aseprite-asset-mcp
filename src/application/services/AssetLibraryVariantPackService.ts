import path from "node:path";
import type { AssetLibraryPort } from "../ports/AssetLibraryPort.js";
import type { AssetLibrarySourcePort } from "../ports/AssetLibrarySourcePort.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetLibraryVariantPackGateway, AssetLibraryVariantPackInput, AssetLibraryVariantPackResult } from "../../domain/asset-library-variants.js";
import { resolveAssetSelection } from "../../domain/asset-scene.js";

function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function ok(value: unknown): AssetOperationResult { return { ok: true, message: JSON.stringify(value) }; }
function validate(input: AssetLibraryVariantPackInput): void {
  if (!input.outputPrefix.trim() || input.outputPrefix.includes("\0") || /(^|[\\/])\.\.([\\/]|$)/.test(input.outputPrefix)) throw new Error("Library variant output prefix is unsafe");
  if (!Array.isArray(input.itemIds) || input.itemIds.length < 1 || input.itemIds.length > 24) throw new Error("Library variant pack requires between 1 and 24 asset ids");
  if (!Array.isArray(input.variants) || input.variants.length < 1 || input.variants.length > 11 || new Set(input.variants).size !== input.variants.length) throw new Error("Library variant pack variants must be unique and contain between 1 and 11 variants");
  if (!Number.isInteger(input.frames) || input.frames < 2 || input.frames > 24) throw new Error("Library variant pack frames must be an integer from 2 to 24");
  if (!Number.isInteger(input.seed)) throw new Error("Library variant pack seed must be an integer");
  if (input.delayMs !== undefined && (!Number.isInteger(input.delayMs) || input.delayMs <= 0 || input.delayMs > 2000)) throw new Error("Library variant pack delay must be an integer from 1 to 2000 milliseconds");
}

export class AssetLibraryVariantPackService implements AssetLibraryVariantPackGateway {
  public constructor(private readonly library: AssetLibraryPort, private readonly source: AssetLibrarySourcePort, private readonly variants: { generateVariantPack(input: { inputFilename: string; outputPrefix: string; variants: AssetLibraryVariantPackInput["variants"]; frames: number; seed: number; delayMs?: number }): Promise<AssetOperationResult> }, private readonly manifestWriter?: { write(filename: string, value: unknown): Promise<void> }) {}

  public async generate(input: AssetLibraryVariantPackInput): Promise<AssetOperationResult> {
    const sources: Array<{ release(): Promise<void> }> = [];
    try {
      validate(input);
      const catalog = await this.library.load();
      const items = resolveAssetSelection(catalog, input.itemIds);
      const assets: AssetLibraryVariantPackResult["assets"] = [];
      for (const [index, item] of items.entries()) {
        const materialized = await this.source.materialize(item);
        sources.push(materialized);
        const outputPrefix = path.join(input.outputPrefix, item.id);
        const result = await this.variants.generateVariantPack({ inputFilename: materialized.filename, outputPrefix, variants: input.variants, frames: input.frames, seed: input.seed + index, ...(input.delayMs === undefined ? {} : { delayMs: input.delayMs }) });
        if (!result.ok) throw new Error(result.message);
        const payload = JSON.parse(result.message) as { artifacts?: AssetLibraryVariantPackResult["assets"][number]["artifacts"] };
        if (!Array.isArray(payload.artifacts) || payload.artifacts.some((artifact) => !artifact || typeof artifact.variant !== "string" || typeof artifact.outputFilename !== "string")) throw new Error(`Variant pack returned malformed artifacts for ${item.id}`);
        assets.push({ assetId: item.id, title: item.title, outputPrefix, artifacts: payload.artifacts });
      }
      const manifest = `${input.outputPrefix}.json`;
      const payload: AssetLibraryVariantPackResult = { operation: "generate_library_variant_pack", manifest, libraryVersion: catalog.libraryVersion, itemIds: items.map((item) => item.id), outputPrefix: input.outputPrefix, variants: input.variants, frames: input.frames, seed: input.seed, assets, deterministic: true, sourcePreserved: true };
      if (this.manifestWriter) await this.manifestWriter.write(manifest, payload);
      return ok(payload);
    } catch (error) { return fail(error); }
    finally { await Promise.allSettled(sources.map((source) => source.release())); }
  }
}
