import assert from "node:assert/strict";
import test from "node:test";
import type { RasterCodec } from "../src/domain/image-assets.js";
import type { RasterFrame } from "../src/domain/pixel-art.js";
import { SpriteGeometryService } from "../src/application/services/SpriteGeometryService.js";

function frame(points: Array<[number, number]>): RasterFrame {
  const pixels = new Uint8ClampedArray(5 * 4 * 4);
  for (const [x, y] of points) pixels[(y * 5 + x) * 4 + 3] = 255;
  return { width: 5, height: 4, pixels };
}

test("reports per-frame bounds, connected components, baseline and bottom-center pivot", async () => {
  const codec: RasterCodec = { decode: async () => [frame([[1, 1], [1, 2], [4, 3]]), frame([[1, 1], [2, 1]])], encode: async () => undefined };
  const result = await new SpriteGeometryService(codec).inspect({ filename: "hero.gif" });
  assert.equal(result.ok, true);
  const payload = JSON.parse(result.message) as { operation: string; frameCount: number; frames: Array<{ opaquePixels: number; bounds: unknown; baselineY: number | null; pivot: { x: number; y: number; mode: string }; components: Array<{ pixels: number }> }>; animation: { stableBounds: boolean; baselineDrift: number }; quality: { valid: boolean }; deterministic: true; sourcePreserved: true };
  assert.equal(payload.operation, "inspect_sprite_geometry");
  assert.equal(payload.frameCount, 2);
  assert.deepEqual(payload.frames[0], { index: 0, opaquePixels: 3, bounds: { x: 1, y: 1, width: 4, height: 3 }, baselineY: 3, pivot: { x: 2, y: 3, mode: "bottom_center" }, components: [{ x: 1, y: 1, width: 1, height: 2, pixels: 2 }, { x: 4, y: 3, width: 1, height: 1, pixels: 1 }] });
  assert.equal(payload.frames[1]?.components[0]?.pixels, 2);
  assert.equal(payload.animation.stableBounds, false);
  assert.equal(payload.animation.baselineDrift, 2);
  assert.equal(payload.quality.valid, true);
  assert.equal(payload.deterministic, true);
  assert.equal(payload.sourcePreserved, true);
});

test("rejects unsafe filenames and invalid component thresholds", async () => {
  const codec: RasterCodec = { decode: async () => [frame([])], encode: async () => undefined };
  const service = new SpriteGeometryService(codec);
  const unsafe = await service.inspect({ filename: "bad\0.gif" });
  assert.equal(unsafe.ok, false);
  assert.match(unsafe.message, /null/i);
  const threshold = await service.inspect({ filename: "hero.png", minComponentPixels: 0 });
  assert.equal(threshold.ok, false);
  assert.match(threshold.message, /component/i);
});

// El contrato que consumen SpriteHitboxService y SpriteAnchorsService exige
// `width` y `height` enteros EN EL PAYLOAD (los usan para recortar los hitboxes
// y se escriben en el manifest). El servicio no los emitia, asi que la
// comprobacion `Number.isInteger(payload.width)` era insatisfacible y
// generate_sprite_hitboxes, generate_sprite_anchors y
// build_sprite_runtime_bundle fallaban SIEMPRE. Lo destapo la verificacion de F2
// del Asset Studio contra el MCP real ("Geometry service returned an invalid
// geometry contract"). aqui no se cubria porque cada servicio se testeaba con
// su propio doble, no encadenados.
test("emite width y height enteros del frame para que el contrato de hitboxes se pueda satisfacer", async () => {
  const codec: RasterCodec = { decode: async () => [frame([[1, 1]])], encode: async () => undefined };
  const result = await new SpriteGeometryService(codec).inspect({ filename: "hero.gif" });
  assert.equal(result.ok, true);
  const payload = JSON.parse(result.message) as { width: unknown; height: unknown; quality: { valid: boolean; violations?: string[] } };
  assert.equal(Number.isInteger(payload.width), true, `width debe ser entero, llegó ${JSON.stringify(payload.width)}`);
  assert.equal(Number.isInteger(payload.height), true, `height debe ser entero, llegó ${JSON.stringify(payload.height)}`);
  assert.equal(payload.width, 5);
  assert.equal(payload.height, 4);
  // El tipo `GeometryPayload` de los consumidores declara `violations`.
  assert.deepEqual(payload.quality.violations, []);
});
