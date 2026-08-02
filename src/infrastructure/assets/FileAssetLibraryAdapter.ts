import fs from "node:fs/promises";
import path from "node:path";
import type { AssetLibraryCatalog } from "../../domain/asset-library.js";
import type { AssetLibraryPort } from "../../application/ports/AssetLibraryPort.js";

export class FileAssetLibraryAdapter implements AssetLibraryPort {
  public constructor(private readonly catalogPath = path.resolve("assets/folders/catalog.json")) {}

  public async load(): Promise<AssetLibraryCatalog> {
    const parsed = JSON.parse(await fs.readFile(this.catalogPath, "utf8")) as AssetLibraryCatalog;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.items) || !Array.isArray(parsed.presets)) throw new Error("Asset library catalog is invalid");
    return parsed;
  }
}
