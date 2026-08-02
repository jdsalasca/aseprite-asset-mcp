import fs from "node:fs/promises";
import path from "node:path";
import type { AssetLibraryBinary, AssetLibraryBinaryKind, AssetLibraryCatalog, AssetLibraryItem } from "../../domain/asset-library.js";
import type { AssetLibraryPort } from "../../application/ports/AssetLibraryPort.js";

export class FileAssetLibraryAdapter implements AssetLibraryPort {
  private readonly root: string;
  public constructor(private readonly catalogPath = path.resolve("assets/folders/catalog.json")) { this.root = path.dirname(this.catalogPath); }

  public async load(): Promise<AssetLibraryCatalog> {
    const parsed = JSON.parse(await fs.readFile(this.catalogPath, "utf8")) as AssetLibraryCatalog;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.items) || !Array.isArray(parsed.presets)) throw new Error("Asset library catalog is invalid");
    return parsed;
  }

  public async read(item: AssetLibraryItem, kind: AssetLibraryBinaryKind): Promise<AssetLibraryBinary> {
    const relative = kind === "preview" ? item.previewPath : kind === "animation" ? item.animationPath : item.spritePath;
    if (!relative) throw new Error("Asset library animation is not available");
    const filename = path.resolve(this.root, relative);
    const rootPrefix = this.root.endsWith(path.sep) ? this.root : `${this.root}${path.sep}`;
    if (!filename.startsWith(rootPrefix)) throw new Error("Asset library path escapes the asset root");
    const extension = path.extname(filename).toLowerCase();
    const contentType = extension === ".gif" ? "image/gif" : extension === ".svg" ? "image/svg+xml" : "image/png";
    return { data: new Uint8Array(await fs.readFile(filename)), contentType };
  }
}
