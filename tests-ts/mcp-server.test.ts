import assert from "node:assert/strict";
import test from "node:test";
import { AsepriteMcpClient } from "../src/workflows/mcp-client.js";

test("TypeScript MCP server completes a real stdio handshake", async () => {
  const client = new AsepriteMcpClient({ cwd: process.cwd() });
  try {
    const tools = await client.listTools();
    assert.ok(tools.includes("create_canvas"));
    assert.ok(tools.includes("draw_rectangle"));
    assert.ok(tools.includes("create_character_plan"));
    assert.ok(tools.includes("create_scene_plan"));
    assert.ok(!tools.includes("legacy_server"));
  } finally {
    await client.close();
  }
});

test("server capabilities report the current typed runtime and complete tool count", async () => {
  const client = new AsepriteMcpClient({ cwd: process.cwd() });
  try {
    const response = await client.callTool("server_capabilities") as {
      content: Array<{ type: "text"; text: string } | { type: string }>;
    };
    const block = response.content.find((item) => item.type === "text");
    assert.ok(block && block.type === "text" && "text" in block);
    const capabilities = JSON.parse(block.text) as {
      typescriptVersion?: string;
      nodeVersion?: string;
      toolCount?: number;
      tools?: string[];
      migrationStatus?: string;
    };

    const registeredTools = await client.listTools();
    assert.equal(capabilities.typescriptVersion, "6.0.3");
    assert.match(capabilities.nodeVersion ?? "", /^v?24\./);
    assert.equal(capabilities.toolCount, capabilities.tools?.length);
    assert.deepEqual([...capabilities.tools ?? []].sort(), [...registeredTools].sort());
    assert.equal(capabilities.migrationStatus, "partial");
  } finally {
    await client.close();
  }
});
