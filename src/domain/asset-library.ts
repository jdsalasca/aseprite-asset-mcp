export type AssetLibraryFormat = "png" | "gif" | "svg" | "json";
export type AssetLibraryBinaryKind = "preview" | "sprite";
export interface AssetLibraryBinary { data: Uint8Array; contentType: string; }

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
export interface AssetLibraryPresetComposition { preset: AssetLibraryPreset; items: AssetLibraryItem[]; layers: Array<{ id: string; assetId: string; role: "background" | "midground" | "foreground" | "effect"; order: number }>; deterministic: true; }
export interface AssetLibraryAuditResult { operation: "audit_asset_library"; libraryVersion: string; totalItems: number; totalCategories: number; totalPresets: number; totalFolders: number; readmePaths: number; previewPaths: number; spritePaths: number; valid: boolean; violations: string[]; deterministic: true; sourcePreserved: true; }
