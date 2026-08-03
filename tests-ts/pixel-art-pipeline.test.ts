import assert from "node:assert/strict";
import test from "node:test";
import { convertRasterFrames, inspectPixelArtSubject, inspectRasterFrame, resizeRasterFrame, runPixelArtQualityGate } from "../src/application/services/PixelArtPipeline.js";
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

test("reference conversion primitives are byte-for-byte deterministic", () => {
  const source = frame(4, 4, [
    23, 21, 46, 255, 23, 21, 46, 255, 0, 0, 0, 0, 0, 0, 0, 0,
    23, 21, 46, 255, 111, 73, 55, 255, 111, 73, 55, 255, 0, 0, 0, 0,
    0, 0, 0, 0, 111, 73, 55, 255, 211, 178, 103, 255, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 23, 21, 46, 255,
  ]);
  const options = { width: 8, height: 8, maxColors: 8, resizeMode: "box" as const, dither: "none" as const, alphaThreshold: 1 };
  assert.deepEqual([...convertRasterFrames([source], options)[0]!.pixels], [...convertRasterFrames([source], options)[0]!.pixels]);
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

test("subject inspection distinguishes an anatomical silhouette from a filled placeholder", () => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  const paint = (x: number, y: number) => { const offset = (y * 8 + x) * 4; pixels[offset] = 120; pixels[offset + 1] = 80; pixels[offset + 2] = 40; pixels[offset + 3] = 255; };
  for (let y = 2; y <= 5; y += 1) for (let x = 2; x <= 5 - Math.abs(y - 3); x += 1) paint(x, y);
  const silhouette = frame(8, 8, [...pixels]);
  const placeholder = frame(8, 8, new Array(8 * 8 * 4).fill(255));
  const subject = inspectPixelArtSubject(silhouette);
  assert.equal(subject.transparentBorder, true);
  assert.ok(subject.distinctRowSpans >= 3);
  assert.equal(runPixelArtQualityGate(placeholder).valid, false);
  assert.ok(runPixelArtQualityGate(placeholder).violations.some((violation) => violation.includes("transparent border")));
});
