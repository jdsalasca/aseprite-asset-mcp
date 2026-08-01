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
