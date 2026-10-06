import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AssetLibraryBinary, AssetLibraryBinaryKind, AssetLibraryCatalog, AssetLibraryItem } from "../../domain/asset-library.js";
import type { AssetLibraryPort } from "../../application/ports/AssetLibraryPort.js";

/**
 * Raíz del paquete, no del directorio de trabajo. El Studio lanza este proceso con el CWD en su propio
 * directorio, y `path.resolve("assets/folders/catalog.json")` lo busca alli: el catálogo existe (290 KB,
 * más de 250 assets) pero nunca aparece donde se le pregunta, y toda la biblioteca falla con ENOENT.
 *
 * `outDir` es `dist` con `rootDir` `src`, así que desde `src/infrastructure/assets/` y desde
 * `dist/infrastructure/assets/` hay tres niveles hasta la raíz: el mismo `import.meta.url` vale en los
 * dos. Es el mismo truco que usa `domain/server-version.ts` para leer su `package.json`.
 */
const PACKAGE_CATALOG = fileURLToPath(new URL("../../../assets/folders/catalog.json", import.meta.url));

export class FileAssetLibraryAdapter implements AssetLibraryPort {
  private readonly root: string;
  public constructor(private readonly catalogPath = PACKAGE_CATALOG) { this.root = path.dirname(this.catalogPath); }

  public async load(): Promise<AssetLibraryCatalog> {
    const parsed = JSON.parse(await fs.readFile(this.catalogPath, "utf8")) as AssetLibraryCatalog;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.items) || !Array.isArray(parsed.presets)) throw new Error("Asset library catalog is invalid");
    return parsed;
  }

  public async read(item: AssetLibraryItem, kind: AssetLibraryBinaryKind): Promise<AssetLibraryBinary> {
    const relative = kind === "preview" ? item.previewPath : kind === "sprite" ? item.spritePath : item.animationPath;
    if (!relative) throw new Error(`Asset library item has no ${kind} binary: ${item.id}`);
    const filename = path.resolve(this.root, relative);
    const rootPrefix = this.root.endsWith(path.sep) ? this.root : `${this.root}${path.sep}`;
    if (!filename.startsWith(rootPrefix)) throw new Error("Asset library path escapes the asset root");
    const extension = path.extname(filename).toLowerCase();
    const contentType = extension === ".gif" ? "image/gif" : extension === ".svg" ? "image/svg+xml" : "image/png";
    return { data: new Uint8Array(await fs.readFile(filename)), contentType };
  }
}
