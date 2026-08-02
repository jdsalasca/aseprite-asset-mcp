import assert from "node:assert/strict";
import test from "node:test";
import { ToolCatalogService } from "../src/application/services/ToolCatalogService.js";

test("tool catalog returns folder summaries without loading every tool", () => {
  const catalog = new ToolCatalogService(["create_canvas", "draw_pixels", "export_sprite", "animation_workflow_guide", "extend_scene", "server_capabilities"]);
  const result = catalog.list();

  assert.equal(result.toolCount, 6);
  assert.equal(result.tools, undefined);
  assert.ok(result.folders.some((folder) => folder.folder === "asset/drawing"));
  assert.ok(result.folders.some((folder) => folder.folder === "asset/world"));
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

test("tool catalog searches compact descriptors with a bounded result set", () => {
  const catalog = new ToolCatalogService(["apply_pixel_outline", "apply_color_grade", "generate_sprite_shadow", "generate_particle_burst", "get_tools_by_folder"]);

  assert.deepEqual(catalog.search("shadow"), [{
    name: "generate_sprite_shadow",
    folder: "asset/effects",
    description: "Generate a deterministic clipped shadow from sprite alpha.",
  }]);
  assert.equal(catalog.search("asset", 2).length, 2);
  assert.deepEqual(catalog.search("   "), []);
});
