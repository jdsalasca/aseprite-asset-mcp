import type { AssetJobInput, AssetJobOutcome, AssetJobRecord, AssetJobStatus } from "../../domain/asset-jobs.js";

export interface AssetJobRunnerPort {
  run(input: AssetJobInput): Promise<AssetJobOutcome>;
}

export interface AssetJobStorePort {
  get(id: string): Promise<AssetJobRecord | undefined>;
  save(record: AssetJobRecord): Promise<void>;
  updateIfStatus(id: string, expected: AssetJobStatus | readonly AssetJobStatus[], patch: Partial<Omit<AssetJobRecord, "id" | "jobs" | "createdAt">>): Promise<boolean>;
}

export interface JobIdPort { next(): string; }
