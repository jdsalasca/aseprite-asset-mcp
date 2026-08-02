import type { AssetLibraryBinary, AssetLibraryBinaryKind, AssetLibraryItem, AssetLibraryPreset, AssetLibraryPresetComposition, AssetLibraryQuery, AssetLibrarySearchResult } from "../../domain/asset-library.js";
import type { AssetLibraryPort } from "../ports/AssetLibraryPort.js";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

function normalize(value: string | undefined): string { return (value ?? "").trim().toLocaleLowerCase(); }
function matches(item: AssetLibraryItem, query: string, category: string): boolean {
  if (category && item.category !== category) return false;
  if (!query) return true;
  return [item.id, item.title, item.category, item.description, ...item.tags, ...item.variants].join(" ").toLocaleLowerCase().includes(query);
}

export class AssetLibraryService {
  public constructor(private readonly port: AssetLibraryPort) {}

  public async search(input: AssetLibraryQuery = {}): Promise<AssetLibrarySearchResult> {
    const catalog = await this.port.load();
    const query = normalize(input.query);
    const category = normalize(input.category);
    const limit = Number.isInteger(input.limit) ? Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT) : DEFAULT_LIMIT;
    const filtered = catalog.items.filter((item) => matches(item, query, category));
    const items = filtered.slice(0, limit);
    const categoryIds = new Set(filtered.map((item) => item.category));
    return { query: { ...(query ? { query } : {}), ...(category ? { category } : {}), limit }, total: filtered.length, categories: catalog.categories.filter((entry) => categoryIds.has(entry.id)), items, presets: catalog.presets.filter((preset) => !category || preset.category === category).slice(0, limit) };
  }

  public async get(id: string): Promise<AssetLibraryItem | null> {
    const catalog = await this.port.load();
    const wanted = normalize(id);
    return catalog.items.find((item) => item.id.toLocaleLowerCase() === wanted) ?? null;
  }

  public async preset(id: string): Promise<AssetLibraryPreset | null> {
    const catalog = await this.port.load();
    const wanted = normalize(id);
    return catalog.presets.find((item) => item.id.toLocaleLowerCase() === wanted) ?? null;
  }

  public async binary(id: string, kind: AssetLibraryBinaryKind): Promise<AssetLibraryBinary | null> {
    const catalog = await this.port.load();
    const item = catalog.items.find((entry) => entry.id.toLocaleLowerCase() === normalize(id));
    if (kind === "animation" && !item?.animationPath) return null;
    return item ? this.port.read(item, kind) : null;
  }

  public async composePreset(id: string): Promise<AssetLibraryPresetComposition | null> {
    const catalog = await this.port.load();
    const preset = catalog.presets.find((entry) => entry.id.toLocaleLowerCase() === normalize(id));
    if (!preset) return null;
    const items = preset.itemIds.map((itemId) => catalog.items.find((entry) => entry.id === itemId));
    if (items.some((item) => !item)) return null;
    const resolvedItems = items as AssetLibraryItem[];
    const layers = resolvedItems.map((item, index) => ({ id: `${preset.id}-${item.id}`, assetId: item.id, role: item.kind === "effect" ? "effect" as const : index === 0 ? "background" as const : index === resolvedItems.length - 1 ? "foreground" as const : "midground" as const, order: index }));
    return { preset, items: resolvedItems, layers, deterministic: true };
  }
}
