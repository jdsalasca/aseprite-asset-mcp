export interface AssetManifestAuditInput {
  manifestFilename: string;
}

export type AssetManifestArtifactStatus = "ok" | "missing" | "empty";

export interface AssetManifestArtifactInspection {
  filename: string;
  status: AssetManifestArtifactStatus;
  sizeBytes: number;
  format: string;
  sha256: string | null;
}

export interface AssetManifestAuditResult {
  operation: "audit_asset_manifest";
  manifest: string;
  artifacts: AssetManifestArtifactInspection[];
  totalArtifacts: number;
  missingArtifacts: number;
  emptyArtifacts: number;
  valid: boolean;
  deterministic: true;
  sourcePreserved: true;
}

export interface AssetManifestAuditGateway {
  audit(input: AssetManifestAuditInput): Promise<{ ok: boolean; message: string }>;
}
