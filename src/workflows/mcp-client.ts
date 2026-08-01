import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ToolCall, WorkflowPlan } from "./types.js";

export interface AsepriteMcpClientOptions {
  cwd: string;
  serverCommand?: string;
  serverArgs?: string[];
  environment?: Record<string, string>;
}

function processEnvironment(overrides: Record<string, string> = {}): Record<string, string> {
  const current = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  return { ...current, ...overrides };
}

export class AsepriteMcpClient {
  private readonly client: Client;
  private transport: StdioClientTransport | undefined;

  public constructor(private readonly options: AsepriteMcpClientOptions) {
    this.client = new Client({ name: "aseprite-asset-mcp-workflows", version: "0.1.0" });
  }

  public async connect(): Promise<void> {
    this.transport = new StdioClientTransport({
      command: this.options.serverCommand ?? (process.platform === "win32" ? "npm.cmd" : "npm"),
      args: this.options.serverArgs ?? ["run", "mcp", "--silent"],
      cwd: this.options.cwd,
      env: processEnvironment(this.options.environment),
    });
    await this.client.connect(this.transport);
  }

  public async execute(plan: WorkflowPlan): Promise<string[]> {
    if (!this.transport) await this.connect();
    const names = new Set(await this.listTools());
    const results: string[] = [];
    for (const toolCall of plan.calls) {
      this.assertToolExists(toolCall, names);
      const result = await this.client.callTool({ name: toolCall.name, arguments: toolCall.arguments });
      results.push(`${toolCall.name}: ${JSON.stringify(result)}`);
    }
    return results;
  }

  public async listTools(): Promise<string[]> {
    if (!this.transport) await this.connect();
    const available = await this.client.listTools();
    return available.tools.map((tool) => tool.name);
  }

  public async callTool(name: string, arguments_: Record<string, unknown> = {}) {
    if (!this.transport) await this.connect();
    return this.client.callTool({ name, arguments: arguments_ });
  }

  public async close(): Promise<void> {
    await this.client.close();
    this.transport = undefined;
  }

  private assertToolExists(toolCall: ToolCall, names: Set<string>): void {
    if (!names.has(toolCall.name)) {
      throw new Error(`The Aseprite MCP server does not expose '${toolCall.name}'. Refresh the asset MCP before executing this plan.`);
    }
  }
}
