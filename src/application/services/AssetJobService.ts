import { randomUUID } from "node:crypto";
import type { AssetJobInput, AssetJobRecord } from "../../domain/asset-jobs.js";
import type { AssetJobRunnerPort, AssetJobStorePort, JobIdPort } from "../ports/AssetJobPorts.js";

class RandomJobId implements JobIdPort { public next(): string { return `job_${randomUUID().replaceAll("-", "").slice(0, 16)}`; } }

export class AssetJobService {
  public constructor(private readonly runner: AssetJobRunnerPort, private readonly store: AssetJobStorePort, private readonly ids: JobIdPort = new RandomJobId()) {}

  public async start(input: AssetJobInput): Promise<AssetJobRecord> {
    const now = new Date().toISOString();
    const record: AssetJobRecord = { id: this.ids.next(), status: "queued", jobs: input.jobs, createdAt: now, updatedAt: now };
    await this.store.save(record);
    void this.execute(record, input);
    return record;
  }

  public get(id: string): Promise<AssetJobRecord | undefined> { return this.store.get(id); }

  public async cancel(id: string): Promise<AssetJobRecord | undefined> {
    const record = await this.store.get(id);
    if (!record || ["completed", "failed", "cancelled"].includes(record.status)) return record;
    const cancelled: AssetJobRecord = { ...record, status: "cancelled", updatedAt: new Date().toISOString() };
    await this.store.save(cancelled);
    return cancelled;
  }

  private async execute(record: AssetJobRecord, input: AssetJobInput): Promise<void> {
    const current = await this.store.get(record.id);
    if (!current || current.status === "cancelled") return;
    await this.store.save({ ...current, status: "running", updatedAt: new Date().toISOString() });
    try {
      const outcome = await this.runner.run(input);
      const latest = await this.store.get(record.id);
      if (!latest || latest.status === "cancelled") return;
      await this.store.save({ ...latest, status: outcome.ok ? "completed" : "failed", outcome, updatedAt: new Date().toISOString() });
    } catch (error) {
      const latest = await this.store.get(record.id);
      if (!latest || latest.status === "cancelled") return;
      await this.store.save({ ...latest, status: "failed", outcome: { ok: false, message: error instanceof Error ? error.message : String(error) }, updatedAt: new Date().toISOString() });
    }
  }
}
