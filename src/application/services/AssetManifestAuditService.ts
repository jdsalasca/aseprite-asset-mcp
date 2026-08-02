import path from "node:path";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetManifestArtifactInspection, AssetManifestAuditGateway, AssetManifestAuditInput, AssetManifestAuditResult } from "../../domain/asset-manifest-audit.js";
import type { AssetManifestAuditPort } from "../ports/AssetManifestAuditPort.js";

const outputKeys = new Set(["output", "outputFilename", "output_filename", "preview", "previewPng", "timeGif", "waveGif", "sheet", "sheetFilename", "sheet_filename", "hitboxManifest", "hitbox_manifest", "bundleManifest", "bundle_manifest", "manifest", "outputs", "artifacts", "files"]);

function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function unsafe(filename: string): boolean { return !filename.trim() || filename.includes("\0") || filename.split(/[\\/]+/).includes(".."); }
function collect(value: unknown, key: string | undefined, found: Set<string>): void {
  if (typeof value === "string") {
    if (key && outputKeys.has(key) && value.trim()) found.add(value.trim());
    return;
  }
  if (Array.isArray(value)) { for (const item of value) collect(item, key, found); return; }
  if (!value || typeof value !== "object") return;
  for (const [childKey, childValue] of Object.entries(value)) collect(childValue, childKey, found);
}

export class AssetManifestAuditService implements AssetManifestAuditGateway {
  public constructor(private readonly port: AssetManifestAuditPort) {}

  public async audit(input: AssetManifestAuditInput): Promise<AssetOperationResult> {
    try {
      if (unsafe(input.manifestFilename)) throw new Error("Manifest filename is unsafe");
      const manifest = await this.port.readManifest(input.manifestFilename);
      const filenames = new Set<string>();
      collect(manifest, undefined, filenames);
      filenames.delete(input.manifestFilename);
      if (filenames.size === 0) throw new Error("Manifest contains no auditable artifact paths");
      const artifacts: AssetManifestArtifactInspection[] = [];
      for (const filename of [...filenames].sort((left, right) => left.localeCompare(right))) {
        if (unsafe(filename)) throw new Error(`Manifest contains an unsafe artifact path: ${filename}`);
        const inspected = await this.port.inspectArtifact(filename);
        artifacts.push({ filename, status: !inspected.exists ? "missing" : inspected.sizeBytes === 0 ? "empty" : "ok", sizeBytes: inspected.sizeBytes, format: inspected.format, sha256: inspected.sha256 });
      }
      const missingArtifacts = artifacts.filter((artifact) => artifact.status === "missing").length;
      const emptyArtifacts = artifacts.filter((artifact) => artifact.status === "empty").length;
      const payload: AssetManifestAuditResult = { operation: "audit_asset_manifest", manifest: input.manifestFilename, artifacts, totalArtifacts: artifacts.length, missingArtifacts, emptyArtifacts, valid: missingArtifacts === 0 && emptyArtifacts === 0, deterministic: true, sourcePreserved: true };
      return { ok: true, message: JSON.stringify(payload) };
    } catch (error) { return fail(error); }
  }
}
