import assert from "node:assert/strict";
import test from "node:test";
import type { RasterCodec } from "../src/domain/image-assets.js";
import type { RasterFrame } from "../src/domain/pixel-art.js";
import { PixelArtAssetService } from "../src/application/services/PixelArtAssetService.js";

/** Degradado horizontal: 64 colores de verdad, para que la cuantizacion a 4 tenga que decidir algo. */
function gradient(width: number, height: number): RasterFrame {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      pixels.set([Math.round((x * 255) / Math.max(1, width - 1)), 120, 200, 255], offset);
    }
  }
  return { width, height, pixels };
}

/**
 * Ronda 46: `convertImage` devolvia `width`, `height` y `maxColors`, que son **lo que se pidio**, y nada
 * de lo que salio. Los frames cuantizados estaban en la mano una linea antes del return.
 * El informe se mide sobre el frame que el codec recibio para codificar, asi que no puede ser otro.
 */
test("la conversion devuelve el informe del frame que escribe", async () => {
  let encoded: RasterFrame[] | undefined;
  const codec: RasterCodec = {
    decode: async () => [gradient(32, 16)],
    encode: async (frames) => { encoded = frames; },
  };
  const service = new PixelArtAssetService(codec);

  const result = await service.convertImage({
    inputFilename: "photo.png",
    outputFilename: "photo-pixel.png",
    width: 32,
    height: 16,
    maxColors: 4,
    resizeMode: "nearest",
    dither: "none",
  });

  assert.equal(result.ok, true);
  const payload = JSON.parse(result.message) as { operation: string; reports: { width: number; height: number; colors: number; opaquePixels: number; transparentPixels: number; isolatedPixels: number }[] };
  assert.equal(payload.operation, "convert_image_to_pixel_art");
  assert.equal(payload.reports.length, 1);
  assert.equal(payload.reports[0]?.width, 32);
  assert.equal(payload.reports[0]?.height, 16);
  // 32x16 opacos, sin transparencia, y como mucho 4 colores: se pidieron 64 y se queda con 4.
  assert.equal(payload.reports[0]?.opaquePixels, 512);
  assert.equal(payload.reports[0]?.transparentPixels, 0);
  assert.ok(payload.reports[0]!.colors <= 4, `la cuantizacion dejo ${payload.reports[0]?.colors} colores de un maximo de 4`);
  // Y el informe es del MISMO frame que se escribio, no una cuenta aparte.
  const colores = new Set<string>();
  for (let i = 0; i < encoded![0]!.pixels.length; i += 4) colores.add(`${encoded![0]!.pixels[i]},${encoded![0]!.pixels[i + 1]},${encoded![0]!.pixels[i + 2]},${encoded![0]!.pixels[i + 3]}`);
  assert.equal(payload.reports[0]?.colors, colores.size);
});

// Un solo color de entrada: el informe tiene que decirlo, no suponer el maximo pedido.
test("una imagen de un solo color reporta un color, no el maximo pedido", async () => {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([10, 20, 30, 255], i);
  const codec: RasterCodec = {
    decode: async () => [{ width: 4, height: 4, pixels }],
    encode: async () => undefined,
  };

  const result = await new PixelArtAssetService(codec).convertImage({
    inputFilename: "flat.png", outputFilename: "flat-pixel.png", width: 4, height: 4, maxColors: 16, resizeMode: "nearest", dither: "none",
  });

  const payload = JSON.parse(result.message) as { reports: { colors: number }[] };
  assert.equal(payload.reports[0]?.colors, 1);
});