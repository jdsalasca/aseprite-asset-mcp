import path from "node:path";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetLibraryItem, AssetScenePlanResult } from "../../domain/asset-library.js";
import type { AssetLibraryPort } from "../ports/AssetLibraryPort.js";

function key(value: string): string { return value.trim().toLocaleLowerCase(); }
function unsafe(value: string): boolean { const normalized = value.replaceAll("\\", "/"); return !key(value) || value.includes("\0") || path.posix.isAbsolute(normalized) || normalized.split("/").some((part) => part === ".."); }

export class AssetScenePlannerService {
  public constructor(private readonly port: AssetLibraryPort) {}

  public async plan(itemIds: string[]): Promise<AssetOperationResult> {
    if (!Array.isArray(itemIds) || itemIds.length === 0) throw new Error("Scene selection must contain at least one asset id");
    if (itemIds.length > 24) throw new Error("Scene selection cannot contain more than 24 asset ids");
    if (itemIds.some(unsafe)) throw new Error("Scene selection contains an unsafe asset id");
    const normalizedIds = itemIds.map(key);
    if (new Set(normalizedIds).size !== normalizedIds.length) throw new Error("Scene selection contains duplicate asset ids");
    const catalog = await this.port.load();
    const items = normalizedIds.map((id) => catalog.items.find((entry) => key(entry.id) === id));
    if (items.some((item) => !item)) throw new Error(`Scene selection references missing asset: ${normalizedIds.find((id, index) => !items[index] ) ?? "unknown"}`);
    const resolvedItems = items as AssetLibraryItem[];
    const layers = resolvedItems.map((item, index) => ({ id: `scene-${item.id}`, assetId: item.id, title: item.title, category: item.category, kind: item.kind, role: item.kind === "effect" ? "effect" as const : index === 0 ? "background" as const : index === resolvedItems.length - 1 ? "foreground" as const : "midground" as const, order: index, previewPath: item.previewPath, spritePath: item.spritePath }));
    const payload: AssetScenePlanResult = { operation: "plan_asset_scene", libraryVersion: catalog.libraryVersion, itemIds: resolvedItems.map((item) => item.id), layers, deterministic: true, sourcePreserved: true };
    return { ok: true, message: JSON.stringify(payload) };
  }
}
