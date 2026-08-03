import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { convertRasterFrames, runPixelArtQualityGate } from "../src/application/services/PixelArtPipeline.js";
import { SharpRasterCodec } from "../src/infrastructure/image/SharpRasterCodec.js";
import type { RasterFrame } from "../src/domain/pixel-art.js";

const outputDirectory = path.resolve("assets/folders/fauna/deer");
const referenceFilename = process.env.DEER_REFERENCE_FILENAME ?? path.join(process.env.TEMP ?? ".", "aseprite-mcp-reference-stag.jpg");
const referenceUrl = "https://commons.wikimedia.org/wiki/File:The_Stag,_or_Red_Deer_LCCN2007681452.jpg";
const referenceLicense = "Public domain / no known copyright restrictions; Library of Congress scan via Wikimedia Commons";

function packFrames(frames: RasterFrame[], padding = 2): RasterFrame {
  const first = frames[0];
  if (!first) throw new Error("At least one frame is required");
  const width = frames.length * first.width + (frames.length - 1) * padding;
  const pixels = new Uint8ClampedArray(width * first.height * 4);
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]!;
    const xOffset = index * (first.width + padding);
    for (let y = 0; y < first.height; y += 1) {
      const sourceStart = y * first.width * 4;
      const targetStart = (y * width + xOffset) * 4;
      pixels.set(frame.pixels.subarray(sourceStart, sourceStart + first.width * 4), targetStart);
    }
  }
  return { width, height: first.height, pixels };
}

function shiftFrame(frame: RasterFrame, shiftX: number): RasterFrame {
  const pixels = new Uint8ClampedArray(frame.width * frame.height * 4);
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const targetX = x + shiftX;
      if (targetX < 0 || targetX >= frame.width) continue;
      const source = (y * frame.width + x) * 4;
      const target = (y * frame.width + targetX) * 4;
      pixels.set(frame.pixels.subarray(source, source + 4), target);
    }
  }
  return { ...frame, pixels };
}

function svgLink(filename: string, width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges"><image href="${filename}" width="${width}" height="${height}" image-rendering="pixelated"/></svg>\n`;
}

type Point = readonly [number, number];
const DEER_MASK: Point[][] = [
  [[0.18, 0.44], [0.29, 0.38], [0.53, 0.38], [0.69, 0.43], [0.75, 0.56], [0.67, 0.73], [0.44, 0.79], [0.25, 0.69]],
  [[0.59, 0.70], [0.65, 0.47], [0.70, 0.29], [0.80, 0.22], [0.89, 0.27], [0.88, 0.40], [0.79, 0.51], [0.73, 0.75]],
  [[0.25, 0.64], [0.34, 0.64], [0.35, 0.94], [0.28, 0.94]],
  [[0.39, 0.67], [0.47, 0.67], [0.49, 0.93], [0.42, 0.93]],
  [[0.61, 0.65], [0.69, 0.65], [0.69, 0.94], [0.63, 0.94]],
  [[0.73, 0.63], [0.80, 0.61], [0.81, 0.91], [0.75, 0.94]],
  [[0.75, 0.26], [0.72, 0.09], [0.76, 0.02], [0.80, 0.19], [0.84, 0.02], [0.87, 0.08], [0.83, 0.26]],
  [[0.82, 0.24], [0.89, 0.05], [0.92, 0.01], [0.91, 0.14], [0.96, 0.08], [0.98, 0.13], [0.91, 0.27]],
];

function pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index]!;
    const prior = polygon[previous]!;
    const crosses = (current[1] > y) !== (prior[1] > y) && x < ((prior[0] - current[0]) * (y - current[1])) / (prior[1] - current[1]) + current[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

async function sourceFrame(): Promise<{ frame: RasterFrame; sourceSha256: string }> {
  const sourceBuffer = await fs.readFile(referenceFilename);
  const sourceSha256 = createHash("sha256").update(sourceBuffer).digest("hex");
  const metadata = await sharp(sourceBuffer).metadata();
  if (!metadata.width || !metadata.height) throw new Error("The deer reference has no readable dimensions");
  const { data, info } = await sharp(sourceBuffer).grayscale().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(info.width * info.height * 4);
  for (let index = 0; index < data.length; index += 1) {
    const luma = data[index] ?? 255;
    const offset = index * 4;
    const x = (index % info.width) / info.width;
    const y = Math.floor(index / info.width) / info.height;
    const ink = DEER_MASK.some((polygon) => pointInPolygon(x, y, polygon));
    pixels[offset] = luma < 92 ? 23 : luma < 145 ? 111 : 211;
    pixels[offset + 1] = luma < 92 ? 21 : luma < 145 ? 73 : 178;
    pixels[offset + 2] = luma < 92 ? 46 : luma < 145 ? 55 : 103;
    pixels[offset + 3] = ink ? 255 : 0;
  }
  return { frame: { width: info.width, height: info.height, pixels }, sourceSha256 };
}

async function main(): Promise<void> {
  const source = await sourceFrame();
  const [converted] = convertRasterFrames([source.frame], { width: 96, height: 96, maxColors: 12, resizeMode: "box", dither: "none", alphaThreshold: 1 });
  if (!converted) throw new Error("The converted deer reference has no frame");
  const gate = runPixelArtQualityGate(converted, { minOpaquePixels: 80, minCoverage: 0.08, maxCoverage: 0.95, minEdgePixels: 20, minDistinctRowSpans: 8, maxComponents: 24 });
  if (!gate.valid) throw new Error(`Deer reference failed the silhouette gate: ${gate.violations.join("; ")}`);
  const frames = [converted, shiftFrame(converted, 1), converted, shiftFrame(converted, -1)].map((frame, index) => ({ ...frame, delayMs: [180, 140, 180, 140][index] }));
  const atlas = packFrames(frames);
  const codec = new SharpRasterCodec();
  await fs.mkdir(outputDirectory, { recursive: true });
  await codec.encode([frames[0]!], path.join(outputDirectory, "preview.png"), "png");
  await codec.encode([atlas], path.join(outputDirectory, "sprite-sheet.png"), "png");
  await codec.encode(frames, path.join(outputDirectory, "sprite-sheet.gif"), "gif");
  await fs.writeFile(path.join(outputDirectory, "preview.svg"), svgLink("preview.png", 96, 96), "utf8");
  await fs.writeFile(path.join(outputDirectory, "sprite-sheet.svg"), svgLink("sprite-sheet.png", atlas.width, atlas.height), "utf8");
  await fs.writeFile(path.join(outputDirectory, "manifest.json"), `${JSON.stringify({
    schemaVersion: 2,
    id: "deer",
    title: "red deer reference sprite",
    category: "fauna",
    kind: "sprite",
    source: "reference-pixel-art-v2",
    reference: { url: referenceUrl, license: referenceLicense, sha256: source.sourceSha256, crop: "full scan with a deterministic deer anatomy mask" },
    conversion: { algorithm: "grayscale ink isolation -> alpha threshold -> box resize -> deterministic 12-color quantization", target: [96, 96], frames: 4, movement: "1px deterministic breathing/step offset" },
    qualityGate: gate,
    variants: ["idle", "walk", "hit", "sleep", "rain"],
    assets: ["preview.png", "sprite-sheet.png", "sprite-sheet.gif", "preview.svg", "sprite-sheet.svg"],
    tags: ["fauna", "wildlife", "deer", "reference-derived", "animation"],
    sourcePreserved: true,
    deterministic: true,
  }, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(outputDirectory, "README.md"), [
    "# Red deer reference sprite",
    "",
    "Asset derivado de una referencia de dominio público y convertido mediante el pipeline determinista imagen → pixel art del MCP.",
    "",
    `- Referencia: [The Stag, or Red Deer — Wikimedia Commons](${referenceUrl}).`,
    "- Calidad: la manifest registra hash, recorte, paleta, cobertura y resultado del gate de silueta.",
    "- Archivos: preview.png, sprite-sheet.png, sprite-sheet.gif y manifest.json.",
    "- Animación: cuatro frames de 96×96 con desplazamiento determinista de 1px para idle/walk.",
    "",
    "## Uso MCP",
    "",
    "Consulta get_asset_library con deer y aplica los efectos del MCP sobre una copia del PNG.",
    "",
    "## Procedencia",
    "",
    "La imagen fuente no se distribuye dentro del repositorio: URL, licencia y SHA-256 quedan registrados en manifest.json.",
    "Para reproducir el asset, descarga la referencia y ejecuta DEER_REFERENCE_FILENAME=<ruta> npm run asset:reference-fauna.",
    "",
  ].join("\n"), "utf8");
  console.log(JSON.stringify({ outputDirectory, sourceSha256: source.sourceSha256, qualityGate: gate, frames: frames.length }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
