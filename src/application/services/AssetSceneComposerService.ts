import path from "node:path";
import type { AssetLibraryPort } from "../ports/AssetLibraryPort.js";
import type { RasterBufferDecoderPort } from "../ports/RasterBufferDecoderPort.js";
import type { AssetManifestWriter, RasterCodec } from "../../domain/image-assets.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetSceneCompositionInput, AssetSceneCompositionResult } from "../../domain/asset-library.js";
import { buildAssetSceneLayers, resolveAssetSelection } from "../../domain/asset-scene.js";

function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function resolved(filename: string): string { return path.resolve(filename).toLocaleLowerCase(); }
function validate(input: AssetSceneCompositionInput): void {
  if (!input.outputFilename.trim() || !input.manifestFilename.trim() || input.outputFilename.includes("\0") || input.manifestFilename.includes("\0")) throw new Error("Scene output and manifest filenames are required");
  if (!/\.png$/i.test(input.outputFilename)) throw new Error("Scene PNG output must use a .png extension");
  if (!/\.json$/i.test(input.manifestFilename)) throw new Error("Scene manifest must use a .json extension");
  if (resolved(input.outputFilename) === resolved(input.manifestFilename)) throw new Error("Scene output and manifest must differ");
  if (!Number.isInteger(input.width) || input.width < 16 || input.width > 2048 || !Number.isInteger(input.height) || input.height < 16 || input.height > 2048) throw new Error("Scene dimensions must be integers from 16 to 2048 pixels");
  if (!Number.isInteger(input.padding ?? 0) || (input.padding ?? 0) < 0 || (input.padding ?? 0) > 64) throw new Error("Scene padding must be an integer from 0 to 64 pixels");
  if (input.width <= (input.padding ?? 0) * 2 || input.height <= (input.padding ?? 0) * 2) throw new Error("Scene padding leaves no drawable area");
}
import { composeRasterSceneFrame } from "./RasterSceneComposition.js";

export class AssetSceneComposerService {
  public constructor(private readonly library: AssetLibraryPort, private readonly decoder: RasterBufferDecoderPort, private readonly codec: RasterCodec, private readonly manifestWriter: AssetManifestWriter) {}

  public async compose(input: AssetSceneCompositionInput): Promise<AssetOperationResult> {
    try {
      validate(input);
      const catalog = await this.library.load();
      const items = resolveAssetSelection(catalog, input.itemIds);
      const layers = buildAssetSceneLayers(items);
      const padding = input.padding ?? 0;
      const frameSets = await Promise.all(layers.map(async (layer) => {
        const binary = await this.library.read(items[layer.order]!, "preview");
        return this.decoder.decodeBuffer(binary.data);
      }));
      const composed = composeRasterSceneFrame({ width: input.width, height: input.height, padding, layers, frames: frameSets });
      await this.codec.encode([composed.frame], input.outputFilename, "png");
      const placements: AssetSceneCompositionResult["layers"] = composed.placements;
      await this.manifestWriter.write(input.manifestFilename, { schemaVersion: 1, kind: "asset_scene", output: input.outputFilename, libraryVersion: catalog.libraryVersion, width: input.width, height: input.height, padding, layers: placements, deterministic: true, sourcePreserved: true });
      const payload: AssetSceneCompositionResult = { operation: "compose_asset_scene", output: input.outputFilename, manifest: input.manifestFilename, libraryVersion: catalog.libraryVersion, itemIds: items.map((item) => item.id), width: input.width, height: input.height, padding, layers: placements, deterministic: true, sourcePreserved: true };
      return { ok: true, message: JSON.stringify(payload) };
    } catch (error) { return fail(error); }
  }
}
