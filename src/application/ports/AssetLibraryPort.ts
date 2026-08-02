import type { AssetLibraryBinary, AssetLibraryBinaryKind, AssetLibraryCatalog, AssetLibraryItem } from "../../domain/asset-library.js";

export interface AssetLibraryPort { load(): Promise<AssetLibraryCatalog>; read(item: AssetLibraryItem, kind: AssetLibraryBinaryKind): Promise<AssetLibraryBinary>; }
