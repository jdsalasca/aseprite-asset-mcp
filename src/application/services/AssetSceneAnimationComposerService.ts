import path from "node:path";
import type { AssetLibraryPort } from "../ports/AssetLibraryPort.js";
import type { RasterBufferDecoderPort } from "../ports/RasterBufferDecoderPort.js";
import type { AssetManifestWriter, RasterCodec } from "../../domain/image-assets.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetSceneAnimationCompositionInput, AssetSceneAnimationCompositionResult } from "../../domain/asset-library.js";
import { buildAssetSceneLayers, resolveAssetSelection } from "../../domain/asset-scene.js";
import { composeRasterSceneFrame } from "./RasterSceneComposition.js";

function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function resolved(filename: string): string { return path.resolve(filename).toLocaleLowerCase(); }
function validate(input: AssetSceneAnimationCompositionInput): void {
  if (!input.outputFilename.trim() || !input.manifestFilename.trim() || input.outputFilename.includes("\0") || input.manifestFilename.includes("\0")) throw new Error("Animated scene output and manifest filenames are required");
  if (!/\.gif$/i.test(input.outputFilename)) throw new Error("Animated scene GIF output must use a .gif extension");
  if (!/\.json$/i.test(input.manifestFilename)) throw new Error("Animated scene manifest must use a .json extension");
  if (resolved(input.outputFilename) === resolved(input.manifestFilename)) throw new Error("Animated scene output and manifest must differ");
  if (!Number.isInteger(input.width) || input.width < 16 || input.width > 2048 || !Number.isInteger(input.height) || input.height < 16 || input.height > 2048) throw new Error("Animated scene dimensions must be integers from 16 to 2048 pixels");
  if (!Number.isInteger(input.padding ?? 0) || (input.padding ?? 0) < 0 || (input.padding ?? 0) > 64) throw new Error("Animated scene padding must be an integer from 0 to 64 pixels");
  if (input.width <= (input.padding ?? 0) * 2 || input.height <= (input.padding ?? 0) * 2) throw new Error("Animated scene padding leaves no drawable area");
  if (!Number.isInteger(input.frames) || input.frames < 2 || input.frames > 24) throw new Error("Animated scene frames must be an integer from 2 to 24");
  if (input.delayMs !== undefined && (!Number.isInteger(input.delayMs) || input.delayMs <= 0 || input.delayMs > 2000)) throw new Error("Animated scene delay must be an integer from 1 to 2000 milliseconds");
}

export class AssetSceneAnimationComposerService {
  public constructor(private readonly library: AssetLibraryPort, private readonly decoder: RasterBufferDecoderPort, private readonly codec: RasterCodec, private readonly manifestWriter: AssetManifestWriter) {}

  public async compose(input: AssetSceneAnimationCompositionInput): Promise<AssetOperationResult> {
    try {
      validate(input);
      const catalog = await this.library.load();
      const items = resolveAssetSelection(catalog, input.itemIds);
      const layers = buildAssetSceneLayers(items);
      const frameSets = await Promise.all(layers.map(async (layer) => {
        const binary = await this.library.read(items[layer.order]!, "preview");
        const frames = await this.decoder.decodeBuffer(binary.data);
        if (frames.length === 0) throw new Error(`Asset preview has no renderable frames: ${items[layer.order]!.id}`);
        return frames;
      }));
      const delayMs = input.delayMs ?? 90;
      const composedFrames = Array.from({ length: input.frames }, (_, index) => composeRasterSceneFrame({ width: input.width, height: input.height, padding: input.padding ?? 0, layers, frames: frameSets, frameIndex: index }));
      await this.codec.encode(composedFrames.map(({ frame }) => ({ ...frame, delayMs })), input.outputFilename, "gif");
      const frameLayers = composedFrames.map(({ placements }, index) => ({ index, layers: placements }));
      await this.manifestWriter.write(input.manifestFilename, { schemaVersion: 1, kind: "asset_scene_animation", output: input.outputFilename, libraryVersion: catalog.libraryVersion, width: input.width, height: input.height, padding: input.padding ?? 0, frames: input.frames, delayMs, frameLayers, deterministic: true, sourcePreserved: true });
      const payload: AssetSceneAnimationCompositionResult = { operation: "compose_asset_scene_animation", output: input.outputFilename, manifest: input.manifestFilename, libraryVersion: catalog.libraryVersion, itemIds: items.map((item) => item.id), width: input.width, height: input.height, padding: input.padding ?? 0, frames: input.frames, delayMs, frameLayers, deterministic: true, sourcePreserved: true };
      return { ok: true, message: JSON.stringify(payload) };
    } catch (error) { return fail(error); }
  }
}
