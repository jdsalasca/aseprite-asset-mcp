import assert from "node:assert/strict";
import test from "node:test";
import { ToolCatalogService } from "../src/application/services/ToolCatalogService.js";

test("tool catalog returns folder summaries without loading every tool", () => {
  const catalog = new ToolCatalogService(["create_canvas", "draw_pixels", "export_sprite", "animation_workflow_guide", "server_capabilities"]);
  const result = catalog.list();

  assert.equal(result.toolCount, 5);
  assert.equal(result.tools, undefined);
  assert.ok(result.folders.some((folder) => folder.folder === "asset/drawing"));
});

test("tool catalog resolves a parent folder and returns concise descriptors", () => {
  const catalog = new ToolCatalogService(["create_canvas", "draw_pixels", "export_sprite", "get_pixel_color"]);
  const result = catalog.byFolder("asset");

  assert.equal(result.length, 4);
  assert.ok(result.every((tool) => tool.folder.startsWith("asset/")));
  assert.ok(result.some((tool) => tool.name === "get_pixel_color"));
  assert.ok(result.every((tool) => tool.description.length < 120));
});

test("tool catalog normalizes slash variants and rejects unknown folders with no matches", () => {
  const catalog = new ToolCatalogService(["draw_pixels"]);

  assert.equal(catalog.byFolder("\\asset\\drawing\\").length, 1);
  assert.deepEqual(catalog.byFolder("missing"), []);
});
