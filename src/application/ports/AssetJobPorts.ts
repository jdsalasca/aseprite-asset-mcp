import type { AssetJobInput, AssetJobOutcome, AssetJobRecord } from "../../domain/asset-jobs.js";

export interface AssetJobRunnerPort {
  run(input: AssetJobInput): Promise<AssetJobOutcome>;
}

export interface AssetJobStorePort {
  get(id: string): Promise<AssetJobRecord | undefined>;
  save(record: AssetJobRecord): Promise<void>;
}

export interface JobIdPort { next(): string; }
