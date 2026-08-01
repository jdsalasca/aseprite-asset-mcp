import type { AssetJobRecord, AssetJobStatus } from "../../domain/asset-jobs.js";
import type { AssetJobStorePort } from "../../application/ports/AssetJobPorts.js";

export class InMemoryAssetJobStore implements AssetJobStorePort {
  private readonly records = new Map<string, AssetJobRecord>();
  public async get(id: string): Promise<AssetJobRecord | undefined> { return this.records.get(id); }
  public async save(record: AssetJobRecord): Promise<void> { this.records.set(record.id, record); }
  public async updateIfStatus(id: string, expected: AssetJobStatus | readonly AssetJobStatus[], patch: Partial<Omit<AssetJobRecord, "id" | "jobs" | "createdAt">>): Promise<boolean> {
    const current = this.records.get(id);
    const expectedStatuses = Array.isArray(expected) ? expected : [expected];
    if (!current || !expectedStatuses.includes(current.status)) return false;
    this.records.set(id, { ...current, ...patch });
    return true;
  }
}
