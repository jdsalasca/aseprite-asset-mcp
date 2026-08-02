import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AssetLibraryPort } from "../../application/ports/AssetLibraryPort.js";
import type { AssetLibrarySourcePort, MaterializedAssetSource } from "../../application/ports/AssetLibrarySourcePort.js";
import type { AssetLibraryItem } from "../../domain/asset-library.js";

function extension(contentType: string, previewPath: string): string {
  if (contentType === "image/gif" || /\.gif$/i.test(previewPath)) return ".gif";
  if (contentType === "image/webp" || /\.webp$/i.test(previewPath)) return ".webp";
  return ".png";
}

export class FileAssetLibrarySourceAdapter implements AssetLibrarySourcePort {
  public constructor(private readonly library: AssetLibraryPort, private readonly tempRoot = os.tmpdir()) {}

  public async materialize(item: AssetLibraryItem): Promise<MaterializedAssetSource> {
    const binary = await this.library.read(item, "preview");
    if (binary.data.byteLength === 0) throw new Error(`Asset preview is empty: ${item.id}`);
    const directory = await fs.mkdtemp(path.join(this.tempRoot, "aseprite-library-source-"));
    const filename = path.join(directory, `source${extension(binary.contentType, item.previewPath)}`);
    try {
      await fs.writeFile(filename, binary.data);
    } catch (error) {
      await fs.rm(directory, { recursive: true, force: true });
      throw error;
    }
    return { filename, release: async () => { await fs.rm(directory, { recursive: true, force: true }); } };
  }
}
