import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AssetRecipeInput, BatchAssetJobInput } from "../../domain/image-assets.js";
import type { AsepriteResult } from "../../domain/aseprite.js";
import { AssetJobService } from "../../application/services/AssetJobService.js";

const recipe = z.enum(["pixel_art", "animation_pixel_art", "gif", "atlas"]);
const jobSchema = z.object({ recipe, input_filenames: z.array(z.string().min(1)).min(1), output_filename: z.string().min(1).optional(), width: z.number().int().positive().optional(), height: z.number().int().positive().optional(), max_colors: z.number().int().min(2).max(256).default(32) });

export class AssetJobToolController {
  public constructor(private readonly jobs: AssetJobService) {}

  public register(server: McpServer): void {
    server.registerTool("start_asset_job", { description: "Start a compact asynchronous batch asset job and return its job id.", inputSchema: { jobs: z.array(jobSchema).min(1) } }, async ({ jobs }) => this.text(await this.jobs.start({ jobs: jobs.map((job) => this.toRecipe(job)), dryRun: false })));
    server.registerTool("get_asset_job_status", { description: "Read one asynchronous asset job without returning raw pixels.", inputSchema: { job_id: z.string().min(1) } }, async ({ job_id }) => { const record = await this.jobs.get(job_id); return record ? this.text(record) : this.result({ ok: false, message: "Asset job not found" }); });
    server.registerTool("cancel_asset_job", { description: "Request cancellation of a queued or running asset job.", inputSchema: { job_id: z.string().min(1) } }, async ({ job_id }) => { const record = await this.jobs.cancel(job_id); return record ? this.text(record) : this.result({ ok: false, message: "Asset job not found" }); });
  }

  private toRecipe(job: z.infer<typeof jobSchema>): AssetRecipeInput { return { recipe: job.recipe, inputFilenames: job.input_filenames, ...(job.output_filename ? { outputFilename: job.output_filename } : {}), ...(job.width === undefined ? {} : { width: job.width }), ...(job.height === undefined ? {} : { height: job.height }), maxColors: job.max_colors }; }
  private result(operation: AsepriteResult): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] }; }
  private text(value: unknown): { content: [{ type: "text"; text: string }] } { return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] }; }
}
