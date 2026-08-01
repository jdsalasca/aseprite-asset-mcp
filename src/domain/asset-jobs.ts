import type { AssetRecipeInput, BatchAssetJobInput } from "./image-assets.js";

export type AssetJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface AssetJobOutcome { ok: boolean; message: string; }

export interface AssetJobRecord {
  id: string;
  status: AssetJobStatus;
  jobs: AssetRecipeInput[];
  createdAt: string;
  updatedAt: string;
  outcome?: AssetJobOutcome | undefined;
}

export type AssetJobInput = BatchAssetJobInput;
