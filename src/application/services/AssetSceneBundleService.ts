import path from "node:path";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetSceneBundleGateway, AssetSceneBundleInput, AssetSceneBundleResult } from "../../domain/asset-scene-bundle.js";

function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function ok(value: unknown): AssetOperationResult { return { ok: true, message: JSON.stringify(value) }; }
function validate(input: AssetSceneBundleInput): void {
  if (!input.outputPrefix.trim() || input.outputPrefix.includes("\0") || input.outputPrefix.split(/[\\/]+/).includes("..")) throw new Error("Scene bundle output prefix is unsafe");
  if (!Array.isArray(input.itemIds) || input.itemIds.length < 1 || input.itemIds.length > 24 || new Set(input.itemIds.map((id) => id.toLocaleLowerCase())).size !== input.itemIds.length) throw new Error("Scene bundle requires 1 to 24 unique asset ids");
  if (!Number.isInteger(input.width) || input.width < 16 || input.width > 2048 || !Number.isInteger(input.height) || input.height < 16 || input.height > 2048) throw new Error("Scene bundle dimensions must be integers from 16 to 2048");
  if (input.padding !== undefined && (!Number.isInteger(input.padding) || input.padding < 0 || input.padding > 64)) throw new Error("Scene bundle padding must be an integer from 0 to 64");
  if (!Number.isInteger(input.frames) || input.frames < 2 || input.frames > 24) throw new Error("Scene bundle frames must be an integer from 2 to 24");
  if (input.delayMs !== undefined && (!Number.isInteger(input.delayMs) || input.delayMs < 1 || input.delayMs > 2000)) throw new Error("Scene bundle delay must be an integer from 1 to 2000");
}

export class AssetSceneBundleService implements AssetSceneBundleGateway {
  public constructor(private readonly staticComposer: { compose(input: { itemIds: string[]; outputFilename: string; manifestFilename: string; width: number; height: number; padding?: number }): Promise<AssetOperationResult> }, private readonly animationComposer: { compose(input: { itemIds: string[]; outputFilename: string; manifestFilename: string; width: number; height: number; padding?: number; frames: number; delayMs?: number }): Promise<AssetOperationResult> }) {}

  public async build(input: AssetSceneBundleInput): Promise<AssetOperationResult> {
    try {
      validate(input);
      const outputPrefix = input.outputPrefix;
      const staticResult = await this.staticComposer.compose({ itemIds: input.itemIds, outputFilename: path.join(outputPrefix, "scene.png"), manifestFilename: path.join(outputPrefix, "scene.json"), width: input.width, height: input.height, ...(input.padding === undefined ? {} : { padding: input.padding }) });
      if (!staticResult.ok) throw new Error(`Static scene composition failed: ${staticResult.message}`);
      const animationResult = await this.animationComposer.compose({ itemIds: input.itemIds, outputFilename: path.join(outputPrefix, "scene.gif"), manifestFilename: path.join(outputPrefix, "scene-animation.json"), width: input.width, height: input.height, frames: input.frames, ...(input.padding === undefined ? {} : { padding: input.padding }), ...(input.delayMs === undefined ? {} : { delayMs: input.delayMs }) });
      if (!animationResult.ok) throw new Error(`Animated scene composition failed: ${animationResult.message}`);
      const staticPayload = JSON.parse(staticResult.message) as AssetSceneBundleResult["static"];
      const animationPayload = JSON.parse(animationResult.message) as AssetSceneBundleResult["animation"];
      if (staticPayload.operation !== "compose_asset_scene" || animationPayload.operation !== "compose_asset_scene_animation") throw new Error("Scene composers returned an invalid bundle payload");
      return ok({ operation: "build_scene_bundle", outputPrefix, itemIds: input.itemIds, static: staticPayload, animation: animationPayload, deterministic: true, sourcePreserved: true } satisfies AssetSceneBundleResult);
    } catch (error) { return fail(error); }
  }
}
