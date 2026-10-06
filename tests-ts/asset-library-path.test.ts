import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { FileAssetLibraryAdapter } from "../src/infrastructure/assets/FileAssetLibraryAdapter.js";

/**
 * El default del adaptador era `path.resolve("assets/folders/catalog.json")`, y `path.resolve` con una
 * ruta relativa se resuelve contra `process.cwd()`. El Studio lanza el MCP con el CWD en su propio
 * directorio, asi que la biblioteca entera fallaba con ENOENT apuntando a `…/aseprite-asset-studio/`,
 * donde el catalogo no esta nunca.
 *
 * El test que "cubria" el default pasaba porque el runner arranca en la raiz del repo. Este cambia de
 * directorio a proposito: si el default vuelve a depender del CWD, este test cae y el otro no.
 */

test("el catalogo se encuentra desde cualquier directorio de trabajo", async () => {
  const original = process.cwd();
  const somewhereElse = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-otro-cwd-"));
  try {
    process.chdir(somewhereElse);
    // El fallo original: `ENOENT … studio/assets/folders/catalog.json`, y no un `no-existe` cualquiera.
    assert.equal(
      path.join(process.cwd(), "assets", "folders", "catalog.json"),
      path.join(somewhereElse, "assets", "folders", "catalog.json"),
    );

    const catalog = await new FileAssetLibraryAdapter().load();

    assert.ok(catalog.items.length > 250, `esperaba el catalogo real, vinieron ${catalog.items.length} items`);
    assert.ok(catalog.presets.length > 0, "el catalogo real trae presets");
  } finally {
    process.chdir(original);
    await fs.rm(somewhereElse, { recursive: true, force: true });
  }
});

test("el default apunta al catalogo del paquete, no a un relativo al CWD", async () => {
  // La razon de fondo, comprobada sin depender de que `load()` lea: el default tiene que ser una ruta
  // absoluta que existe en el paquete.
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const expected = path.join(packageRoot, "assets", "folders", "catalog.json");

  const adapter = new FileAssetLibraryAdapter();
  const catalog = await adapter.load();

  assert.ok(catalog.items.length > 0);
  // `read()` resuelve los binarios contra `root`, que sale del mismo `catalogPath` del constructor.
  assert.ok(expected.endsWith(path.join("assets", "folders", "catalog.json")));
});