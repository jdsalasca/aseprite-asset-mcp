import path from "node:path";
import { resizeRasterFrame } from "./PixelArtPipeline.js";
import type { AssetLibraryPort } from "../ports/AssetLibraryPort.js";
import type { RasterBufferDecoderPort } from "../ports/RasterBufferDecoderPort.js";
import type { AssetManifestWriter, RasterCodec } from "../../domain/image-assets.js";
import type { RasterFrame } from "../../domain/pixel-art.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetSceneCompositionInput, AssetSceneCompositionResult } from "../../domain/asset-library.js";
import { buildAssetSceneLayers, resolveAssetSelection } from "../../domain/asset-scene.js";

function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function resolved(filename: string): string { return path.resolve(filename).toLocaleLowerCase(); }
function validate(input: AssetSceneCompositionInput): void {
  if (!input.outputFilename.trim() || !input.manifestFilename.trim() || input.outputFilename.includes("\0") || input.manifestFilename.includes("\0")) throw new Error("Scene output and manifest filenames are required");
  if (resolved(input.outputFilename) === resolved(input.manifestFilename)) throw new Error("Scene output and manifest must differ");
  if (!Number.isInteger(input.width) || input.width < 16 || input.width > 2048 || !Number.isInteger(input.height) || input.height < 16 || input.height > 2048) throw new Error("Scene dimensions must be integers from 16 to 2048 pixels");
  if (!Number.isInteger(input.padding ?? 0) || (input.padding ?? 0) < 0 || (input.padding ?? 0) > 64) throw new Error("Scene padding must be an integer from 0 to 64 pixels");
  if (input.width <= (input.padding ?? 0) * 2 || input.height <= (input.padding ?? 0) * 2) throw new Error("Scene padding leaves no drawable area");
}
function fit(frame: RasterFrame, maxWidth: number, maxHeight: number): RasterFrame {
  const scale = Math.min(1, maxWidth / frame.width, maxHeight / frame.height);
  if (scale === 1) return { ...frame, pixels: new Uint8ClampedArray(frame.pixels) };
  return resizeRasterFrame(frame, Math.max(1, Math.round(frame.width * scale)), Math.max(1, Math.round(frame.height * scale)), "nearest");
}
function composite(target: Uint8ClampedArray, targetWidth: number, source: RasterFrame, x: number, y: number): void {
  for (let sourceY = 0; sourceY < source.height; sourceY += 1) for (let sourceX = 0; sourceX < source.width; sourceX += 1) {
    const targetX = x + sourceX; const targetY = y + sourceY;
    if (targetX < 0 || targetY < 0 || targetX >= targetWidth) continue;
    const sourceOffset = (sourceY * source.width + sourceX) * 4; const targetOffset = (targetY * targetWidth + targetX) * 4;
    const sourceAlpha = (source.pixels[sourceOffset + 3] ?? 0) / 255; if (sourceAlpha === 0) continue;
    const targetAlpha = (target[targetOffset + 3] ?? 0) / 255; const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
    for (let channel = 0; channel < 3; channel += 1) target[targetOffset + channel] = Math.round(((source.pixels[sourceOffset + channel] ?? 0) * sourceAlpha + (target[targetOffset + channel] ?? 0) * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
    target[targetOffset + 3] = Math.round(outputAlpha * 255);
  }
}

export class AssetSceneComposerService {
  public constructor(private readonly library: AssetLibraryPort, private readonly decoder: RasterBufferDecoderPort, private readonly codec: RasterCodec, private readonly manifestWriter: AssetManifestWriter) {}

  public async compose(input: AssetSceneCompositionInput): Promise<AssetOperationResult> {
    try {
      validate(input);
      const catalog = await this.library.load();
      const items = resolveAssetSelection(catalog, input.itemIds);
      const layers = buildAssetSceneLayers(items);
      const padding = input.padding ?? 0; const canvasWidth = input.width - padding * 2; const canvasHeight = input.height - padding * 2; const pixels = new Uint8ClampedArray(input.width * input.height * 4);
      const placements: AssetSceneCompositionResult["layers"] = [];
      for (const layer of layers) {
        const item = items[layer.order]!; const binary = await this.library.read(item, "preview"); const frame = (await this.decoder.decodeBuffer(binary.data))[0];
        if (!frame) throw new Error(`Asset preview has no renderable frame: ${item.id}`);
        const fitted = fit(frame, canvasWidth, canvasHeight); const x = padding + Math.floor((canvasWidth - fitted.width) / 2); const y = padding + Math.floor((canvasHeight - fitted.height) / 2); composite(pixels, input.width, fitted, x, y); placements.push({ ...layer, x, y, width: fitted.width, height: fitted.height });
      }
      await this.codec.encode([{ width: input.width, height: input.height, pixels }], input.outputFilename, "png");
      await this.manifestWriter.write(input.manifestFilename, { schemaVersion: 1, kind: "asset_scene", output: input.outputFilename, libraryVersion: catalog.libraryVersion, width: input.width, height: input.height, padding, layers: placements, deterministic: true, sourcePreserved: true });
      const payload: AssetSceneCompositionResult = { operation: "compose_asset_scene", output: input.outputFilename, manifest: input.manifestFilename, libraryVersion: catalog.libraryVersion, itemIds: items.map((item) => item.id), width: input.width, height: input.height, padding, layers: placements, deterministic: true, sourcePreserved: true };
      return { ok: true, message: JSON.stringify(payload) };
    } catch (error) { return fail(error); }
  }
}
