import path from "node:path";
import type { AssetLibraryCatalog, AssetLibraryItem } from "./asset-library.js";

export interface AssetSceneLayer { id: string; assetId: string; title: string; category: string; kind: AssetLibraryItem["kind"]; role: "background" | "midground" | "foreground" | "effect"; order: number; previewPath: string; spritePath: string; }
export function assetIdKey(value: string): string { return value.trim().toLocaleLowerCase(); }
export function assertAssetSelection(itemIds: string[]): void {
  if (!Array.isArray(itemIds) || itemIds.length === 0) throw new Error("Scene selection must contain at least one asset id");
  if (itemIds.length > 24) throw new Error("Scene selection cannot contain more than 24 asset ids");
  const unsafe = itemIds.some((value) => { const normalized = value.replaceAll("\\", "/"); return !assetIdKey(value) || value.includes("\0") || path.posix.isAbsolute(normalized) || normalized.split("/").some((part) => part === ".."); });
  if (unsafe) throw new Error("Scene selection contains an unsafe asset id");
  const normalized = itemIds.map(assetIdKey);
  if (new Set(normalized).size !== normalized.length) throw new Error("Scene selection contains duplicate asset ids");
}
export function resolveAssetSelection(catalog: AssetLibraryCatalog, itemIds: string[]): AssetLibraryItem[] {
  assertAssetSelection(itemIds);
  const normalizedIds = itemIds.map(assetIdKey);
  const items = normalizedIds.map((id) => catalog.items.find((entry) => assetIdKey(entry.id) === id));
  if (items.some((item) => !item)) throw new Error(`Scene selection references missing asset: ${normalizedIds.find((id, index) => !items[index]) ?? "unknown"}`);
  return items as AssetLibraryItem[];
}
export function buildAssetSceneLayers(items: AssetLibraryItem[]): AssetSceneLayer[] {
  return items.map((item, index) => ({ id: `scene-${item.id}`, assetId: item.id, title: item.title, category: item.category, kind: item.kind, role: item.kind === "effect" ? "effect" as const : index === 0 ? "background" as const : index === items.length - 1 ? "foreground" as const : "midground" as const, order: index, previewPath: item.previewPath, spritePath: item.spritePath }));
}
