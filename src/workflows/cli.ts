import fs from "node:fs/promises";
import path from "node:path";
import { AsepriteMcpClient } from "./mcp-client.js";
import type { WorkflowPlan } from "./types.js";

export interface CliOptions {
  execute: boolean;
  outputDirectory: string;
  root: string;
}

export function parseCliOptions(args: string[]): CliOptions {
  const execute = args.includes("--execute");
  const outputIndex = args.indexOf("--output");
  const rootIndex = args.indexOf("--root");
  const outputArgument = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const rootArgument = rootIndex >= 0 ? args[rootIndex + 1] : undefined;
  return {
    execute,
    outputDirectory: outputArgument || path.join("artifacts", "aseprite"),
    root: rootArgument || process.cwd(),
  };
}

export async function writePlanArtifacts(plan: WorkflowPlan, outputDirectory: string): Promise<{ planPath: string; manifestPath: string }> {
  await fs.mkdir(outputDirectory, { recursive: true });
  const planPath = path.join(outputDirectory, `${plan.assetId}.${plan.kind}.plan.json`);
  const manifestPath = path.join(outputDirectory, `${plan.assetId}.godot.json`);
  await fs.writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  await fs.writeFile(manifestPath, `${JSON.stringify(plan.godotManifest, null, 2)}\n`, "utf8");
  return { planPath, manifestPath };
}

export async function optionallyExecute(plan: WorkflowPlan, options: CliOptions): Promise<string[]> {
  if (!options.execute) return ["Plan mode only: no Aseprite process was started."];
  const client = new AsepriteMcpClient({ cwd: options.root });
  try {
    return await client.execute(plan);
  } finally {
    await client.close();
  }
}
