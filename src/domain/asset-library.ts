export type AssetLibraryFormat = "png" | "gif" | "svg" | "json";

export interface AssetLibraryItem {
  id: string;
  title: string;
  category: string;
  folder: string;
  kind: "sprite" | "tileset" | "scene" | "effect" | "character" | "prop";
  description: string;
  tags: string[];
  variants: string[];
  formats: AssetLibraryFormat[];
  readmePath: string;
  previewPath: string;
  spritePath: string;
  deterministic: true;
}

export interface AssetLibraryCategory { id: string; title: string; description: string; itemCount: number; }
export interface AssetLibraryPreset { id: string; title: string; description: string; category: string; itemIds: string[]; recommendedTools: string[]; deterministic: true; }
export interface AssetLibraryCatalog { schemaVersion: 1; libraryVersion: string; categories: AssetLibraryCategory[]; items: AssetLibraryItem[]; presets: AssetLibraryPreset[]; }
export interface AssetLibraryQuery { query?: string; category?: string; limit?: number; }
export interface AssetLibrarySearchResult { query: AssetLibraryQuery; total: number; categories: AssetLibraryCategory[]; items: AssetLibraryItem[]; presets: AssetLibraryPreset[]; }
