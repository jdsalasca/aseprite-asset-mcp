import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AssetManifestAuditService } from "../../application/services/AssetManifestAuditService.js";

export class AssetManifestAuditToolController {
  public constructor(private readonly service: AssetManifestAuditService) {}

  public register(server: McpServer): void {
    server.registerTool("audit_asset_manifest", { description: "Audit files referenced by a generated manifest, including missing, empty, format, and SHA-256 metadata.", inputSchema: { manifest_filename: z.string().min(1) } }, async ({ manifest_filename }) => {
      const result = await this.service.audit({ manifestFilename: manifest_filename });
      return { isError: !result.ok, content: [{ type: "text" as const, text: result.message }] };
    });
  }
}
