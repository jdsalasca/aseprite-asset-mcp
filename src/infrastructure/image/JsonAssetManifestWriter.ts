import { promises as fs } from "node:fs";
import path from "node:path";
import type { AssetManifestReader, AssetManifestWriter } from "../../domain/image-assets.js";

export class JsonAssetManifestWriter implements AssetManifestWriter, AssetManifestReader {
  public async write(filename: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(path.resolve(filename)), { recursive: true });
    await fs.writeFile(filename, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  public async read<T>(filename: string): Promise<T> {
    return JSON.parse(await fs.readFile(filename, "utf8")) as T;
  }
}
