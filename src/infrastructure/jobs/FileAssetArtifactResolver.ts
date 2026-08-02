import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AssetArtifactResolverPort } from "../../application/ports/AssetJobPorts.js";
import type { AssetArtifact, AssetJobInput } from "../../domain/asset-jobs.js";

export class FileAssetArtifactResolver implements AssetArtifactResolverPort {
  public constructor(private readonly clock: () => string = () => new Date().toISOString()) {}

  public async resolve(jobId: string, input: AssetJobInput): Promise<AssetArtifact[]> {
    const filenames = [...new Set(input.jobs.flatMap((job) => job.outputFilename ? [job.outputFilename] : []))];
    const createdAt = this.clock();
    const artifacts: AssetArtifact[] = [];
    for (const filename of filenames) {
      const data = await readFile(filename);
      const sha256 = createHash("sha256").update(data).digest("hex");
      const extension = path.extname(filename).replace(/^\./, "").toLowerCase() || "bin";
      artifacts.push({
        id: `artifact_${jobId}_${sha256.slice(0, 16)}`,
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
