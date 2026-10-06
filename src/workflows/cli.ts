import fs from "node:fs/promises";
import path from "node:path";
import { AsepriteMcpClient } from "./mcp-client.js";
import type { WorkflowPlan } from "./types.js";

export interface CliOptions {
  execute: boolean;
  outputDirectory: string;
  root: string;
}

function optionValue(args: string[], name: string): string | undefined {
  const exactIndex = args.indexOf(name);
  if (exactIndex >= 0) return args[exactIndex + 1];
  const prefix = `${name}=`;
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

export function parseCliOptions(args: string[]): CliOptions {
  const execute = args.includes("--execute");
  const outputArgument = optionValue(args, "--output");
  const root = optionValue(args, "--root") || process.cwd();
  return {
    execute,
    // `--root` y `--output` tienen que decir lo mismo sobre "aqui". Con el output por defecto siendo
    // relativo, el plan y el manifiesto de un proyecto acababan escritos en el directorio desde el que
    // se lanzo el comando, no dentro del proyecto. `resolve` y no `join`: si el `--output` es absoluto
    // y explicito se respeta tal cual, que es una instruccion del usuario y no un fallo.
    outputDirectory: path.resolve(root, outputArgument || path.join("artifacts", "aseprite")),
    root,
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
