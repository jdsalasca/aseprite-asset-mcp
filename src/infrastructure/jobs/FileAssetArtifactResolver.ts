import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AssetArtifactResolverPort } from "../../application/ports/AssetJobPorts.js";
import type { AssetArtifact, AssetJobInput } from "../../domain/asset-jobs.js";

export class FileAssetArtifactResolver implements AssetArtifactResolverPort {
  public constructor(private readonly clock: () => string = () => new Date().toISOString(), private readonly allowedRoots: readonly string[] = []) {}

  public async resolve(jobId: string, input: AssetJobInput): Promise<AssetArtifact[]> {
    const filenames = [...new Set(input.jobs.flatMap((job) => job.outputFilename ? [job.outputFilename] : []))];
    const createdAt = this.clock();
    const artifacts: AssetArtifact[] = [];
    for (const filename of filenames) {
      const resolved = path.resolve(filename);
      if (filename.includes("\0")) throw new Error("Artifact filename contains an invalid null byte");
      if (this.allowedRoots.length > 0 && !this.allowedRoots.some((root) => { const normalizedRoot = path.resolve(root); return resolved === normalizedRoot || resolved.startsWith(`${normalizedRoot}${path.sep}`); })) throw new Error(`Artifact filename is outside allowed roots: ${filename}`);
      const data = await readFile(filename);
      const sha256 = createHash("sha256").update(data).digest("hex");
      const filenameHash = createHash("sha256").update(filename).digest("hex").slice(0, 8);
      const extension = path.extname(filename).replace(/^\./, "").toLowerCase() || "bin";
      artifacts.push({
        id: `artifact_${jobId}_${sha256.slice(0, 16)}_${filenameHash}`,
        jobId,
        filename,
        format: extension,
        sizeBytes: data.byteLength,
        sha256,
        createdAt,
      });
    }
    return artifacts;
  }
}
