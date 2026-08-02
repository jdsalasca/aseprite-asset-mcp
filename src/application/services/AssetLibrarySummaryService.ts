import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetLibraryPort } from "../ports/AssetLibraryPort.js";
import type { AssetLibrarySummaryResult } from "../../domain/asset-library.js";

export class AssetLibrarySummaryService {
  public constructor(private readonly port: AssetLibraryPort) {}

  public async summarize(): Promise<AssetOperationResult> {
    try {
      const catalog = await this.port.load();
      const categories = catalog.categories.map((category) => ({ id: category.id, title: category.title, itemCount: catalog.items.filter((item) => item.category === category.id).length, examples: catalog.items.filter((item) => item.category === category.id).map((item) => item.id).sort((left, right) => left.localeCompare(right)).slice(0, 3) })).sort((left, right) => left.id.localeCompare(right.id));
      const presets = catalog.presets.map((preset) => ({ id: preset.id, title: preset.title, category: preset.category, itemCount: preset.itemIds.length })).sort((left, right) => left.id.localeCompare(right.id));
      const payload: AssetLibrarySummaryResult = { operation: "summarize_asset_library", libraryVersion: catalog.libraryVersion, totalItems: catalog.items.length, totalCategories: catalog.categories.length, totalPresets: catalog.presets.length, categories, presets, deterministic: true, sourcePreserved: true };
      return { ok: true, message: JSON.stringify(payload) };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }
}
