import path from "node:path";
import { buildScenePlan } from "../src/workflows/plans.js";
import { optionallyExecute, parseCliOptions, writePlanArtifacts } from "../src/workflows/cli.js";

const options = parseCliOptions(process.argv.slice(2));
const assetId = process.argv.find((argument) => argument.startsWith("--asset="))?.slice("--asset=".length) ?? "village-square";
const plan = buildScenePlan({
  assetId,
  outputDirectory: path.join(options.outputDirectory, assetId),
});
const artifacts = await writePlanArtifacts(plan, path.join(options.outputDirectory, assetId));
const results = await optionallyExecute(plan, options);
console.log(JSON.stringify({ plan: artifacts.planPath, manifest: artifacts.manifestPath, executed: options.execute, results }, null, 2));
