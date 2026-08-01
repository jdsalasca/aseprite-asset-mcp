import assert from "node:assert/strict";
import test from "node:test";
import { convertRasterFrames, inspectRasterFrame, resizeRasterFrame } from "../src/application/services/PixelArtPipeline.js";
import type { RasterFrame } from "../src/domain/pixel-art.js";

function frame(width: number, height: number, values: number[]): RasterFrame {
  return { width, height, pixels: new Uint8ClampedArray(values) };
}

test("box resize preserves alpha and reduces a high-resolution frame", () => {
  const source = frame(2, 2, [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 0]);
  const result = resizeRasterFrame(source, 1, 1, "box");

  assert.deepEqual([...result.pixels], [85, 85, 85, 191]);
});

test("conversion uses one bounded palette across all animation frames", () => {
  const first = frame(2, 1, [255, 0, 0, 255, 0, 255, 0, 255]);
  const second = frame(2, 1, [0, 0, 255, 255, 255, 255, 255, 255]);
  const result = convertRasterFrames([first, second], { width: 2, height: 1, maxColors: 2, dither: "none" });
  const colors = new Set<string>();
  for (const output of result) for (let index = 0; index < output.pixels.length; index += 4) colors.add([...output.pixels.slice(index, index + 3)].join(","));

  assert.equal(result.length, 2);
  assert.ok(colors.size <= 2);
});

test("transparent pixels remain transparent and quality inspection finds isolated pixels", () => {
  const source = frame(3, 1, [255, 0, 0, 255, 0, 0, 0, 0, 0, 255, 0, 255]);
  const [result] = convertRasterFrames([source], { width: 3, height: 1, maxColors: 2, dither: "bayer4x4" });
  assert.equal(result?.pixels[7], 0);
  const report = inspectRasterFrame(result as RasterFrame);
  assert.equal(report.transparentPixels, 1);
  assert.equal(report.isolatedPixels, 2);
});

test("invalid conversion contracts fail before raster work", () => {
  const source = frame(1, 1, [0, 0, 0, 255]);
  assert.throws(() => convertRasterFrames([], { width: 1, height: 1, maxColors: 2 }), /At least one frame/);
  assert.throws(() => convertRasterFrames([source], { width: 1, height: 1, maxColors: 1 }), /maxColors/);
  assert.throws(() => resizeRasterFrame(source, 0, 1), /Target dimensions/);
});
