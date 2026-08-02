import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetScenePlanResult } from "../../domain/asset-library.js";
import { buildAssetSceneLayers, resolveAssetSelection } from "../../domain/asset-scene.js";
import type { AssetLibraryPort } from "../ports/AssetLibraryPort.js";

export class AssetScenePlannerService {
  public constructor(private readonly port: AssetLibraryPort) {}

  public async plan(itemIds: string[]): Promise<AssetOperationResult> {
    const catalog = await this.port.load();
    const resolvedItems = resolveAssetSelection(catalog, itemIds);
    const payload: AssetScenePlanResult = { operation: "plan_asset_scene", libraryVersion: catalog.libraryVersion, itemIds: resolvedItems.map((item) => item.id), layers: buildAssetSceneLayers(resolvedItems), deterministic: true, sourcePreserved: true };
    return { ok: true, message: JSON.stringify(payload) };
  }
}
