import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AssetVariantPackGateway } from "../../domain/asset-variant-pack.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";

const VARIANTS = ["rain", "fire", "earthquake", "birds", "night", "day_night", "walk", "water_reflection", "water_caustics"] as const;

export class AssetVariantPackToolController {
  public constructor(private readonly variants: AssetVariantPackGateway) {}
  public register(server: McpServer): void {
    server.registerTool("generate_variant_pack", { description: "Generate a deterministic multi-output environmental variant pack for one asset: rain, fire, earthquake, birds, night, movement, and water effects.", inputSchema: { input_filename: z.string().min(1), output_prefix: z.string().min(1), variants: z.array(z.enum(VARIANTS)).min(1).max(9), frames: z.number().int().min(2).max(24).default(8), seed: z.number().int().default(1), delay_ms: z.number().int().positive().default(90) } }, async ({ input_filename, output_prefix, variants, frames, seed, delay_ms }) => this.result(await this.variants.generateVariantPack({ inputFilename: input_filename, outputPrefix: output_prefix, variants: [...variants], frames, seed, delayMs: delay_ms })));
  }
  private result(operation: AssetOperationResult): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] }; }
}
