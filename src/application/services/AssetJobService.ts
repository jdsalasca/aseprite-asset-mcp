import { randomUUID } from "node:crypto";
import type { AssetJobInput, AssetJobRecord } from "../../domain/asset-jobs.js";
import type { AssetArtifactResolverPort, AssetJobRunnerPort, AssetJobStorePort, JobIdPort } from "../ports/AssetJobPorts.js";

export interface AssetJobServiceDependencies {
  ids?: JobIdPort;
  artifactResolver?: AssetArtifactResolverPort;
  timeoutMs?: number;
}

class RandomJobId implements JobIdPort { public next(): string { return `job_${randomUUID().replaceAll("-", "").slice(0, 16)}`; } }

export class AssetJobService {
  private readonly ids: JobIdPort;

  public constructor(
    private readonly runner: AssetJobRunnerPort,
    private readonly store: AssetJobStorePort,
    private readonly dependencies: AssetJobServiceDependencies = {},
  ) {
    this.ids = dependencies.ids ?? new RandomJobId();
  }

  public async start(input: AssetJobInput): Promise<AssetJobRecord> {
    if (!Array.isArray(input.jobs) || input.jobs.length === 0) throw new Error("At least one asset job is required");
    if (input.jobs.length > 32) throw new Error("A batch cannot contain more than 32 asset jobs");
    if (input.jobs.some((job) => !Array.isArray(job.inputFilenames) || job.inputFilenames.length === 0)) throw new Error("Every asset job needs at least one input filename");
    const isolatedInput = structuredClone(input);
    const now = new Date().toISOString();
    const record: AssetJobRecord = { id: this.ids.next(), status: "queued", jobs: isolatedInput.jobs, progress: { completed: 0, total: isolatedInput.jobs.length }, createdAt: now, updatedAt: now };
    await this.store.save(record);
    void this.execute(record, isolatedInput);
    return structuredClone(record);
  }

  public get(id: string): Promise<AssetJobRecord | undefined> { return this.store.get(id); }

  public async cancel(id: string): Promise<AssetJobRecord | undefined> {
    const record = await this.store.get(id);
    if (!record || ["completed", "failed", "cancelled"].includes(record.status)) return record;
    await this.store.updateIfStatus(id, ["queued", "running"], { status: "cancelled", updatedAt: new Date().toISOString() });
    return this.store.get(id);
  }

  private async execute(record: AssetJobRecord, input: AssetJobInput): Promise<void> {
    const started = await this.store.updateIfStatus(record.id, "queued", { status: "running", updatedAt: new Date().toISOString() });
    if (!started) return;
    try {
      const outcome = await this.runWithTimeout(input);
      const artifacts = outcome.ok && this.dependencies.artifactResolver ? await this.dependencies.artifactResolver.resolve(record.id, input) : undefined;
      await this.store.updateIfStatus(record.id, "running", { status: outcome.ok ? "completed" : "failed", outcome, progress: { completed: input.jobs.length, total: input.jobs.length }, ...(artifacts ? { artifacts } : {}), updatedAt: new Date().toISOString() });
    } catch (error) {
      await this.store.updateIfStatus(record.id, "running", { status: "failed", outcome: { ok: false, message: error instanceof Error ? error.message : String(error) }, updatedAt: new Date().toISOString() });
    }
  }

  private async runWithTimeout(input: AssetJobInput): Promise<Awaited<ReturnType<AssetJobRunnerPort["run"]>>> {
    const timeoutMs = this.dependencies.timeoutMs;
    if (!timeoutMs || timeoutMs <= 0) return this.runner.run(input);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([this.runner.run(input), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Asset job exceeded timeout of ${timeoutMs}ms`)), timeoutMs); })]);
    } finally { if (timer) clearTimeout(timer); }
  }
}
