import fs from "node:fs/promises";
import path from "node:path";
import { SpriteEffectsService } from "../src/application/services/SpriteEffectsService.js";
import { SharpRasterCodec } from "../src/infrastructure/image/SharpRasterCodec.js";
import type { RasterFrame } from "../src/domain/pixel-art.js";

const outputDirectory = path.resolve("examples/effects");
const codec = new SharpRasterCodec();
const effects = new SpriteEffectsService(codec);

function createHeroFrame(): RasterFrame {
  const width = 32;
  const height = 32;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const set = (x: number, y: number, color: [number, number, number, number]) => { if (x >= 0 && y >= 0 && x < width && y < height) pixels.set(color, (y * width + x) * 4); };
  const ink: [number, number, number, number] = [23, 32, 51, 255];
  const body: [number, number, number, number] = [78, 145, 180, 255];
  const light: [number, number, number, number] = [226, 194, 119, 255];
  for (let y = 8; y < 25; y += 1) for (let x = 9; x < 23; x += 1) if ((x - 16) ** 2 / 55 + (y - 16) ** 2 / 90 < 1) set(x, y, body);
  for (let x = 11; x < 22; x += 1) { set(x, 8, ink); set(x, 24, ink); }
  for (let y = 8; y < 25; y += 1) { set(9, y, ink); set(22, y, ink); }
  for (let x = 12; x < 20; x += 1) set(x, 10, light);
  set(13, 15, ink); set(19, 15, ink); set(16, 19, light);
  for (let x = 11; x < 22; x += 1) { set(x, 26, ink); set(x, 27, ink); }
  return { width, height, pixels, delayMs: 120 };
}

async function run(): Promise<void> {
  await fs.mkdir(outputDirectory, { recursive: true });
  const base = path.join(outputDirectory, "hero-base.png");
  const outline = path.join(outputDirectory, "hero-outline.png");
  const graded = path.join(outputDirectory, "hero-color-grade.png");
  const shadow = path.join(outputDirectory, "hero-shadow.png");
  const normalMap = path.join(outputDirectory, "hero-normal-map.png");
  const particles = path.join(outputDirectory, "hero-particles.gif");
  await codec.encode([createHeroFrame()], base, "png");
  const operations = [
    await effects.applyPixelOutline({ inputFilename: base, outputFilename: outline, color: "#172033", thickness: 1, format: "png" }),
    await effects.applyColorGrade({ inputFilename: base, outputFilename: graded, brightness: 0.04, contrast: 1.08, saturation: 1.12, format: "png" }),
    await effects.generateSpriteShadow({ inputFilename: base, outputFilename: shadow, offsetX: 2, offsetY: 2, color: "#000000", opacity: 0.45, format: "png" }),
    await effects.generateNormalMap({ inputFilename: base, outputFilename: normalMap, strength: 2, format: "png" }),
    await effects.generateParticleBurst({ outputFilename: particles, width: 32, height: 32, frames: 8, particleCount: 18, seed: 4217, color: "#FFD166", delayMs: 80 }),
  ];
  if (operations.some((operation) => !operation.ok)) throw new Error(operations.find((operation) => !operation.ok)?.message ?? "Effects showcase generation failed");
  const portableOperations = operations.map((operation) => { const parsed = JSON.parse(operation.message) as Record<string, unknown>; for (const key of ["input", "output"]) { if (typeof parsed[key] === "string") parsed[key] = path.relative(outputDirectory, String(parsed[key])).replaceAll(path.sep, "/"); } return parsed; });
  await fs.writeFile(path.join(outputDirectory, "manifest.json"), JSON.stringify({ schemaVersion: 1, seed: 4217, source: "hero-base.png", outputs: ["hero-outline.png", "hero-color-grade.png", "hero-shadow.png", "hero-normal-map.png", "hero-particles.gif"], operations: portableOperations }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ outputDirectory, files: [base, outline, graded, shadow, normalMap, particles] }, null, 2));
}

run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
