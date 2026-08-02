import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { AssetManifestAuditPort } from "../../application/ports/AssetManifestAuditPort.js";

export class FileAssetManifestAuditAdapter implements AssetManifestAuditPort {
  public constructor(private readonly allowedRoots: readonly string[] = []) {}

  public async readManifest(filename: string): Promise<unknown> {
    this.assertAllowed(filename);
    return JSON.parse(await fs.readFile(filename, "utf8"));
  }

  public async inspectArtifact(filename: string): Promise<{ exists: boolean; sizeBytes: number; format: string; sha256: string | null }> {
    this.assertAllowed(filename);
    try {
      const data = await fs.readFile(filename);
      return { exists: true, sizeBytes: data.byteLength, format: path.extname(filename).replace(/^\./, "").toLowerCase() || "bin", sha256: createHash("sha256").update(data).digest("hex") };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { exists: false, sizeBytes: 0, format: path.extname(filename).replace(/^\./, "").toLowerCase() || "bin", sha256: null };
      throw error;
    }
  }

  private assertAllowed(filename: string): void {
    if (filename.includes("\0")) throw new Error("Artifact filename contains an invalid null byte");
    if (this.allowedRoots.length === 0) return;
    const resolved = path.resolve(filename);
    if (!this.allowedRoots.some((root) => { const normalized = path.resolve(root); return resolved === normalized || resolved.startsWith(`${normalized}${path.sep}`); })) throw new Error(`Artifact filename is outside allowed roots: ${filename}`);
  }
}
