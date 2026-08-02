import path from "node:path";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetLibraryAuditResult, AssetLibraryCatalog } from "../../domain/asset-library.js";
import type { AssetLibraryPort } from "../ports/AssetLibraryPort.js";

function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function key(value: string): string { return value.trim().toLocaleLowerCase(); }
function duplicateKeys(values: string[], label: string): string[] { const seen = new Set<string>(); const duplicates = new Set<string>(); for (const value of values) { const normalized = key(value); if (seen.has(normalized)) duplicates.add(`${label}: ${value}`); seen.add(normalized); } return [...duplicates]; }
function unsafeRelative(value: string): boolean { return !value.trim() || value.includes("\0") || path.isAbsolute(value) || value.split(/[\\/]+/).includes(".."); }

export class AssetLibraryAuditService {
  public constructor(private readonly port: AssetLibraryPort) {}

  public async audit(): Promise<AssetOperationResult> {
    try {
      const catalog = await this.port.load();
      const violations: string[] = [];
      violations.push(...duplicateKeys(catalog.items.map((item) => item.id), "duplicate item id"));
      violations.push(...duplicateKeys(catalog.categories.map((category) => category.id), "duplicate category id"));
      violations.push(...duplicateKeys(catalog.presets.map((preset) => preset.id), "duplicate preset id"));
      const categoryIds = new Set(catalog.categories.map((category) => key(category.id)));
      const itemIds = new Set(catalog.items.map((item) => item.id));
      for (const item of catalog.items) {
        if (!categoryIds.has(key(item.category))) violations.push(`unknown category: ${item.id} -> ${item.category}`);
        if (unsafeRelative(item.folder)) violations.push(`unsafe folder path: ${item.id}`);
        if (unsafeRelative(item.readmePath)) violations.push(`unsafe readme path: ${item.id}`);
        if (unsafeRelative(item.previewPath)) violations.push(`unsafe preview path: ${item.id}`);
        if (unsafeRelative(item.spritePath)) violations.push(`unsafe sprite path: ${item.id}`);
        if (item.animationPath && unsafeRelative(item.animationPath)) violations.push(`unsafe animation path: ${item.id}`);
        if (item.formats.includes("gif") && !item.animationPath) violations.push(`missing animation path: ${item.id}`);
      }
      for (const preset of catalog.presets) for (const itemId of preset.itemIds) if (!itemIds.has(itemId)) violations.push(`missing preset item: ${preset.id} -> ${itemId}`);
      const payload: AssetLibraryAuditResult = { operation: "audit_asset_library", libraryVersion: catalog.libraryVersion, totalItems: catalog.items.length, totalCategories: catalog.categories.length, totalPresets: catalog.presets.length, totalFolders: new Set(catalog.items.map((item) => item.folder)).size, readmePaths: catalog.items.filter((item) => Boolean(item.readmePath)).length, previewPaths: catalog.items.filter((item) => Boolean(item.previewPath)).length, spritePaths: catalog.items.filter((item) => Boolean(item.spritePath)).length, animationPaths: catalog.items.filter((item) => Boolean(item.animationPath)).length, valid: violations.length === 0, violations: violations.slice(0, 100), deterministic: true, sourcePreserved: true };
      return { ok: true, message: JSON.stringify(payload) };
    } catch (error) { return fail(error); }
  }
}
