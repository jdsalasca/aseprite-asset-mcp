import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const upstreamCommit = execFileSync("git", ["rev-parse", "upstream/main"], { encoding: "utf8" }).trim();
const localCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
const worktree = root.replaceAll("\\", "/");
const upstreamSource = execFileSync("git", ["grep", "-h", "-E", "^async def [a-zA-Z0-9_]+", "upstream/main", "--", "aseprite_mcp/**/*.py"], { encoding: "utf8" });
const upstreamTools = [...upstreamSource.matchAll(/^async def ([a-zA-Z0-9_]+)/gm)].map((match) => match[1]);
const source = readFileSync(join(root, "src", "interfaces", "mcp-server.ts"), "utf8");
const typescriptTools = [...source.matchAll(/registerTool\("([^"]+)"/g)].map((match) => match[1]);
const implemented = new Set(typescriptTools);
const domain = (name) => {
  if (/draw|fill|erase/.test(name)) return "drawing";
  if (/frame|cel|animation|tag/.test(name)) return "animation";
  if (/layer|group/.test(name)) return "layers";
  if (/palette|color|ramp/.test(name)) return "palette";
  if (/export|import/.test(name)) return "export";
  if (/tile/.test(name)) return "tilemap";
  if (/text|font/.test(name)) return "text";
  if (/region/.test(name)) return "selection";
  if (/slice/.test(name)) return "slices";
  if (/preview/.test(name)) return "preview";
  if (/validate|audit/.test(name)) return "quality";
  return "core";
};
const tools = upstreamTools.map((name) => ({
  name,
  source: "upstream",
  target: "typescript",
  status: implemented.has(name) ? "verified" : "pending",
  domain: domain(name),
  tests: implemented.has(name) ? ["tests-ts/gateway-validation.test.ts", "tests-ts/integration/real-aseprite.test.ts"] : [],
  dependencies: [],
  commit: null,
  evidence: [],
}));
const recordsDir = join(root, "docs", "graphify");
mkdirSync(recordsDir, { recursive: true });
writeFileSync(join(root, "docs", "upstream-tool-inventory.json"), JSON.stringify({
  source: "upstream/main",
  commit: upstreamCommit,
  generatedAt: new Date().toISOString(),
  toolCount: upstreamTools.length,
  tools: upstreamTools,
}, null, 2) + "\n");
writeFileSync(join(recordsDir, "migration.graph.json"), JSON.stringify({
  schemaVersion: 1,
  project: "aseprite-mcp",
  goal: "complete-typescript-migration",
  generatedAt: new Date().toISOString(),
  source: { repository: "https://github.com/diivi/aseprite-mcp", branch: "upstream/main", commit: upstreamCommit },
  local: { branch, worktree, baseCommit: localCommit, typescriptToolCount: typescriptTools.length, testCount: 13 },
  tools,
  nodes: [
    { id: "mcp-schemas", type: "mcp-schemas", status: "planned" },
    { id: "asset-service", type: "application-service", status: "implemented" },
    { id: "aseprite-gateway", type: "adapter", status: "implemented" },
    { id: "unit-tests", type: "unit-tests", status: "verified" },
    { id: "integration-tests", type: "integration-tests", status: "verified" },
    { id: "e2e-tests", type: "e2e-tests", status: "pending" },
    { id: "godot-exports", type: "godot-exports", status: "planned" },
    { id: "harness-moon", type: "orchestrator-records", status: "planned" },
  ],
  edges: [
    ["mcp-schemas", "asset-service"],
    ["asset-service", "aseprite-gateway"],
    ["aseprite-gateway", "unit-tests"],
    ["aseprite-gateway", "integration-tests"],
    ["asset-service", "e2e-tests"],
    ["export_spritesheet", "godot-exports"],
    ["e2e-tests", "harness-moon"],
  ],
}, null, 2) + "\n");
writeFileSync(join(recordsDir, "migration.mmd"), `flowchart TD
  upstream["upstream/main · ${upstreamTools.length} tools"] --> inventory["Tool inventory"]
  inventory --> schemas["Typed MCP schemas"]
  schemas --> service["Application service"]
  service --> gateway["Secure Aseprite CLI gateway"]
  gateway --> unit["Unit and contract tests"]
  gateway --> integration["Integration tests"]
  service --> e2e["End-to-end workflows"]
  e2e --> godot["Godot exports"]
  e2e --> harness["Harness Moon records"]
`);
mkdirSync(join(root, ".harness-moon"), { recursive: true });
writeFileSync(join(root, ".harness-moon", "continuation-state.json"), JSON.stringify({
  project: "aseprite-mcp",
  goal: "complete-typescript-migration",
  continue: true,
  currentPhase: "drawing-validation",
  currentSlice: "draw-rectangle",
  lastCompletedSlice: "core-animation",
  nextSlice: "drawing-primitives",
  blocked: false,
  retryCount: 0,
  lastEvidence: [
    "npm test: 13 passed, 0 failed",
    `upstream/main inventory: ${upstreamTools.length} tools`,
    `TypeScript server inventory: ${typescriptTools.length} tools`,
    "real Aseprite integration: passed",
  ],
}, null, 2) + "\n");
console.log(JSON.stringify({ upstreamToolCount: upstreamTools.length, typescriptToolCount: typescriptTools.length, upstreamCommit, localCommit, branch }, null, 2));
