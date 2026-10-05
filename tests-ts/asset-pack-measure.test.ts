import assert from "node:assert/strict";
import test from "node:test";
import type { AssetManifestWriter, RasterCodec } from "../src/domain/image-assets.js";
import type { RasterFrame } from "../src/domain/pixel-art.js";
import { PixelArtAssetService } from "../src/application/services/PixelArtAssetService.js";

function asset(size = 2, color = 10): RasterFrame {
  const pixels = new Uint8ClampedArray(size * size * 4);
  pixels.set([color, 20, 40, 255], 0);
  return { width: size, height: size, pixels };
}

/**
 * Ronda 45: `export_asset_pack` escribia su manifest CON la medida completa (`width`, `height`,
 * `cellWidth`, `cellHeight`, `columns`, `rows`, `padding`) y devolvia solo `assets`. El panel no tenia
 * ni idea del tamano del atlas que acababa de generar.
 *
 * Y el padding del atlas NO es como el de la hoja de sprites: `atlasFrame` (linea 56-57) pone padding
 * **entre** celdas, `columns * celda + (columns - 1) * padding`, o sea 2x2 celdas de 2 px con 1 de
 * padding son 5x5 y no 7x7 como en `AnimationSheetService` (que lo pone en los bordes tambien). Mi
 * primera version del testmultiplicaba por la formula de la hoja y fallo con 5 !== 7: el unico que
 * puede decir como se mide es el codigo que mide.
 */
test("el atlas devuelve la medida que ya estaba escribiendo en su manifest", async () => {
  const codec: RasterCodec = { decode: async () => [asset()], encode: async () => undefined };
  const writer: AssetManifestWriter = { write: async () => undefined };
  const service = new PixelArtAssetService(codec, writer);

  const result = await service.exportPack({
    inputFilenames: ["a.png", "b.png", "c.png", "d.png"],
    outputFilename: "atlas.png",
    manifestFilename: "atlas.json",
    columns: 2,
    padding: 1,
  });

  assert.equal(result.ok, true);
  const payload = JSON.parse(result.message) as Record<string, unknown>;
  assert.equal(payload.operation, "export_asset_pack");
  assert.equal(payload.assets, 4);
  assert.equal(payload.columns, 2);
  assert.equal(payload.rows, 2);
  assert.equal(payload.width, 5);
  assert.equal(payload.height, 5);
  assert.equal(payload.cellWidth, 2);
  assert.equal(payload.cellHeight, 2);
  assert.equal(payload.padding, 1);
});

// El MCP no puede inventar una medida si no sabe empaquetar: sin atlas escrito no hay payload que medir.
test("un atlas que no se puede escribir no devuelve medidas partiales", async () => {
  const codec: RasterCodec = { decode: async () => [asset()], encode: async () => undefined };
  const writer: AssetManifestWriter = { write: async () => undefined };
  const service = new PixelArtAssetService(codec, writer);

  // La salida pisa una entrada: el servicio lo rechaza antes de escribir nada.
  const result = await service.exportPack({ inputFilenames: ["a.png", "b.png"], outputFilename: "a.png", manifestFilename: "atlas.json" });

  assert.equal(result.ok, false);
  assert.doesNotMatch(result.message, /columns/);
});