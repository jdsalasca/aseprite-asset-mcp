export interface AssetManifestAuditPort {
  readManifest(filename: string): Promise<unknown>;
  inspectArtifact(filename: string): Promise<{ exists: boolean; sizeBytes: number; format: string; sha256: string | null }>;
}
