import type { AssetLibraryCatalog } from "../../domain/asset-library.js";

export interface AssetLibraryPort { load(): Promise<AssetLibraryCatalog>; }
