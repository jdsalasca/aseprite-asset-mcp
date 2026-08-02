import type { AssetRecipeInput, BatchAssetJobInput } from "./image-assets.js";

export type AssetJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface AssetJobOutcome { ok: boolean; message: string; }

export interface AssetArtifact {
  id: string;
  jobId: string;
  filename: string;
  format: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

export interface AssetJobRecord {
  id: string;
  status: AssetJobStatus;
  jobs: AssetRecipeInput[];
  createdAt: string;
  updatedAt: string;
  outcome?: AssetJobOutcome | undefined;
  artifacts?: AssetArtifact[] | undefined;
}

export type AssetJobInput = BatchAssetJobInput;
