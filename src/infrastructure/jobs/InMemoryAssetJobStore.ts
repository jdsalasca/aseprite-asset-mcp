import type { AssetJobRecord } from "../../domain/asset-jobs.js";
import type { AssetJobStorePort } from "../../application/ports/AssetJobPorts.js";

export class InMemoryAssetJobStore implements AssetJobStorePort {
  private readonly records = new Map<string, AssetJobRecord>();
  public async get(id: string): Promise<AssetJobRecord | undefined> { return this.records.get(id); }
  public async save(record: AssetJobRecord): Promise<void> { this.records.set(record.id, record); }
}
