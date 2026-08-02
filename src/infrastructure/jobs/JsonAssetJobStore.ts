import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AssetJobRecord, AssetJobStatus } from "../../domain/asset-jobs.js";
import type { AssetJobStorePort } from "../../application/ports/AssetJobPorts.js";

export class JsonAssetJobStore implements AssetJobStorePort {
  private readonly records = new Map<string, AssetJobRecord>();
  private readonly ready: Promise<void>;
  private writeQueue: Promise<void> = Promise.resolve();

  public constructor(private readonly filename: string) {
    this.ready = this.load();
  }

  public async get(id: string): Promise<AssetJobRecord | undefined> {
    await this.ready;
    const record = this.records.get(id);
    return record ? structuredClone(record) : undefined;
  }

  public async save(record: AssetJobRecord): Promise<void> {
    await this.ready;
    this.records.set(record.id, structuredClone(record));
    await this.flush();
  }

  public async updateIfStatus(id: string, expected: AssetJobStatus | readonly AssetJobStatus[], patch: Partial<Omit<AssetJobRecord, "id" | "jobs" | "createdAt">>): Promise<boolean> {
    await this.ready;
    const current = this.records.get(id);
    const expectedStatuses = Array.isArray(expected) ? expected : [expected];
    if (!current || !expectedStatuses.includes(current.status)) return false;
    this.records.set(id, { ...current, ...structuredClone(patch) });
    await this.flush();
    return true;
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.filename, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) throw new Error("Asset job store must contain an array");
      for (const value of parsed) {
        if (!value || typeof value !== "object" || typeof (value as { id?: unknown }).id !== "string") throw new Error("Asset job store contains an invalid record");
        const record = value as AssetJobRecord;
        this.records.set(record.id, record);
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw new Error(`Could not load asset job store: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async flush(): Promise<void> {
    const snapshot = JSON.stringify([...this.records.values()], null, 2) + "\n";
    const write = async () => {
      await mkdir(dirname(this.filename), { recursive: true });
      await writeFile(this.filename, snapshot, "utf8");
    };
    this.writeQueue = this.writeQueue.catch(() => undefined).then(write);
    await this.writeQueue;
  }
}
