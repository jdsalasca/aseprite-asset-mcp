import type { AssetLibraryItem } from "../../domain/asset-library.js";

export interface MaterializedAssetSource {
  filename: string;
  release(): Promise<void>;
}

export interface AssetLibrarySourcePort {
  materialize(item: AssetLibraryItem): Promise<MaterializedAssetSource>;
}
