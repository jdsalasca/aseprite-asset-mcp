import { promises as fs } from "node:fs";
import path from "node:path";
import type { AssetManifestWriter } from "../../domain/image-assets.js";

export class JsonAssetManifestWriter implements AssetManifestWriter {
  public async write(filename: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(path.resolve(filename)), { recursive: true });
    await fs.writeFile(filename, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
}
