export type AssetLibraryFormat = "png" | "gif" | "svg" | "json";
export type AssetLibraryBinaryKind = "preview" | "sprite" | "animation";
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
  qualityPath?: string;
  previewPath: string;
  spritePath: string;
  animationPath?: string;
  deterministic: true;
}

export interface AssetLibraryCategory { id: string; title: string; description: string; itemCount: number; }
export interface AssetLibraryPreset { id: string; title: string; description: string; category: string; itemIds: string[]; recommendedTools: string[]; deterministic: true; }
export interface AssetLibraryCatalog { schemaVersion: 1; libraryVersion: string; categories: AssetLibraryCategory[]; items: AssetLibraryItem[]; presets: AssetLibraryPreset[]; qualityReportPath?: string; }
export interface AssetLibraryQuery { query?: string; category?: string; limit?: number; }
export interface AssetLibrarySearchResult { query: AssetLibraryQuery; total: number; categories: AssetLibraryCategory[]; items: AssetLibraryItem[]; presets: AssetLibraryPreset[]; }
export interface AssetLibraryPresetComposition { preset: AssetLibraryPreset; items: AssetLibraryItem[]; layers: Array<{ id: string; assetId: string; role: "background" | "midground" | "foreground" | "effect"; order: number }>; deterministic: true; }
export interface AssetLibraryAuditResult { operation: "audit_asset_library"; libraryVersion: string; totalItems: number; totalCategories: number; totalPresets: number; totalFolders: number; readmePaths: number; previewPaths: number; spritePaths: number; animationPaths: number; valid: boolean; violations: string[]; deterministic: true; sourcePreserved: true; }
export interface AssetLibrarySummaryResult { operation: "summarize_asset_library"; libraryVersion: string; totalItems: number; totalCategories: number; totalPresets: number; categories: Array<{ id: string; title: string; itemCount: number; examples: string[] }>; presets: Array<{ id: string; title: string; category: string; itemCount: number }>; deterministic: true; sourcePreserved: true; }
import type { AssetSceneLayer } from "./asset-scene.js";
export interface AssetScenePlanResult { operation: "plan_asset_scene"; libraryVersion: string; itemIds: string[]; layers: AssetSceneLayer[]; deterministic: true; sourcePreserved: true; }
export interface AssetSceneCompositionInput { itemIds: string[]; outputFilename: string; manifestFilename: string; width: number; height: number; padding?: number; }
export interface AssetSceneCompositionResult { operation: "compose_asset_scene"; output: string; manifest: string; libraryVersion: string; itemIds: string[]; width: number; height: number; padding: number; layers: Array<AssetSceneLayer & { x: number; y: number; width: number; height: number }>; deterministic: true; sourcePreserved: true; }
export interface AssetSceneAnimationCompositionInput extends AssetSceneCompositionInput { frames: number; delayMs?: number; }
export interface AssetSceneAnimationCompositionResult { operation: "compose_asset_scene_animation"; output: string; manifest: string; libraryVersion: string; itemIds: string[]; width: number; height: number; padding: number; frames: number; delayMs: number; frameLayers: Array<{ index: number; layers: Array<AssetSceneLayer & { x: number; y: number; width: number; height: number }> }>; deterministic: true; sourcePreserved: true; }
