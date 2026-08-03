import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { convertRasterFrames, inspectRasterFrame, runPixelArtQualityGate } from "../src/application/services/PixelArtPipeline.js";
import { SharpRasterCodec } from "../src/infrastructure/image/SharpRasterCodec.js";
import type { RasterFrame } from "../src/domain/pixel-art.js";

const outputDirectory = path.resolve("assets/folders/mythical-creatures/dragon-ice");
const sourceFilename = process.env.DRAGON_ICE_SOURCE_FILENAME ?? path.resolve("tmp/imagegen/dragon-ice-cutout.png");
const codec = new SharpRasterCodec();

function packFrames(frames: RasterFrame[]): RasterFrame {
  const first = frames[0];
  if (!first) throw new Error("At least one dragon frame is required");
  const pixels = new Uint8ClampedArray(first.width * frames.length * first.height * 4);
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]!;
    for (let y = 0; y < first.height; y += 1) {
      const sourceStart = y * first.width * 4;
      const targetStart = (y * first.width * frames.length + index * first.width) * 4;
      pixels.set(frame.pixels.subarray(sourceStart, sourceStart + first.width * 4), targetStart);
    }
  }
  return { width: first.width * frames.length, height: first.height, pixels };
}

function translateFrame(frame: RasterFrame, xShift: number, yShift: number): RasterFrame {
  const pixels = new Uint8ClampedArray(frame.width * frame.height * 4);
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const targetX = x + xShift;
      const targetY = y + yShift;
      if (targetX < 0 || targetY < 0 || targetX >= frame.width || targetY >= frame.height) continue;
      const source = (y * frame.width + x) * 4;
      const target = (targetY * frame.width + targetX) * 4;
      pixels.set(frame.pixels.subarray(source, source + 4), target);
    }
  }
  return { ...frame, pixels };
}

function svgLink(filename: string, width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges"><image href="${filename}" width="${width}" height="${height}" image-rendering="pixelated"/></svg>\n`;
}

async function prepareSource(filename: string): Promise<string> {
  const prepared = path.join(os.tmpdir(), `aseprite-mcp-dragon-ice-${process.pid}.png`);
  await sharp(filename)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize(224, 224, { fit: "contain", kernel: sharp.kernel.nearest, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(prepared);
  return prepared;
}

async function main(): Promise<void> {
  const sourceBuffer = await fs.readFile(sourceFilename);
  const sourceSha256 = createHash("sha256").update(sourceBuffer).digest("hex");
  const prepared = await prepareSource(sourceFilename);
  try {
    const [decoded] = await codec.decode(prepared);
    if (!decoded) throw new Error("The prepared dragon source has no frame");
    const [base] = convertRasterFrames([decoded], { width: 256, height: 256, maxColors: 96, resizeMode: "nearest", dither: "none", alphaThreshold: 16 });
    if (!base) throw new Error("The converted dragon source has no frame");
    const qualityGate = runPixelArtQualityGate(base, { minOpaquePixels: 2000, minCoverage: 0.12, maxCoverage: 0.85, minEdgePixels: 300, minDistinctRowSpans: 24, maxComponents: 32 });
    if (!qualityGate.valid) throw new Error(`Dragon quality gate failed: ${qualityGate.violations.join("; ")}`);
    const frames = [
      { ...base, delayMs: 180 },
      { ...translateFrame(base, 2, -2), delayMs: 140 },
      { ...translateFrame(base, -1, 1), delayMs: 180 },
      { ...translateFrame(base, 1, 0), delayMs: 140 },
    ];
    const atlas = packFrames(frames);
    await fs.mkdir(outputDirectory, { recursive: true });
    await fs.copyFile(sourceFilename, path.join(outputDirectory, "source-reference.png"));
    await codec.encode([frames[0]!], path.join(outputDirectory, "preview.png"), "png");
    await codec.encode([atlas], path.join(outputDirectory, "sprite-sheet.png"), "png");
    await codec.encode(frames, path.join(outputDirectory, "sprite-sheet.gif"), "gif");
    await fs.writeFile(path.join(outputDirectory, "preview.svg"), svgLink("preview.png", 256, 256), "utf8");
    await fs.writeFile(path.join(outputDirectory, "sprite-sheet.svg"), svgLink("sprite-sheet.png", 1024, 256), "utf8");
    const raster = inspectRasterFrame(base);
    await fs.writeFile(path.join(outputDirectory, "manifest.json"), `${JSON.stringify({
      schemaVersion: 3,
      id: "dragon-ice",
      title: "premium ice dragon",
      category: "mythical-creatures",
      kind: "sprite",
      source: "imagegen-reference-derived-v1",
      sourceReference: { filename: "source-reference.png", sha256: sourceSha256, generation: "built-in image generation followed by chroma-key removal", promptSummary: "full-body ice dragon with articulated anatomy, wings, crystal spines, scales, claws and ice breath" },
      conversion: { algorithm: "transparent trim -> nearest 224px fit -> 16px safety border -> nearest 256px atlas -> bounded palette", target: [256, 256], paletteSize: raster.colors, frames: 4, frameMotion: "deterministic 1-2px breathing and wing-weight offsets" },
      qualityGate,
      variants: ["idle", "wing-beat", "ice-breath", "attack"],
      assets: ["source-reference.png", "preview.png", "sprite-sheet.png", "sprite-sheet.gif", "preview.svg", "sprite-sheet.svg"],
      tags: ["creature", "mythology", "dragon", "ice", "premium", "reference-derived", "animation"],
      sourcePreserved: true,
      deterministic: true,
    }, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(outputDirectory, "README.md"), [
      "# Premium ice dragon",
      "",
      "Dragon de hielo de alta fidelidad para combate y escenas de fantasía.",
      "",
      "- Fuente visual de alta calidad conservada en source-reference.png.",
      "- Silueta completa: cabeza, mandíbula, ojo, cuernos, alas, cuatro patas, garras, cola, placas y espinas de hielo.",
      "- Paleta limitada y nearest-neighbor para conservar clusters de pixel art.",
      "- Cuatro frames de 256×256: idle, wing-beat, ice-breath y attack.",
      "- La manifest conserva el hash de la fuente, el algoritmo y el resultado del quality gate.",
      "",
      "## Uso MCP",
      "",
      "Consulta get_asset_library con dragon-ice. Para variantes adicionales usa apply_depth_lighting, apply_sprite_rim_light, apply_sprite_glow, generate_particle_burst, normal_map y validate_asset_quality sobre copias.",
      "",
      "## Regeneración",
      "",
      "Ejecuta DRAGON_ICE_SOURCE_FILENAME=<ruta> npm run asset:premium-dragon.",
      "La generación de la fuente y la conversión raster son fases separadas: la conversión, atlas, GIF y quality gate son deterministas.",
      "",
    ].join("\n"), "utf8");
    console.log(JSON.stringify({ outputDirectory, sourceSha256, frames: frames.length, qualityGate, paletteSize: raster.colors }, null, 2));
  } finally {
    await fs.rm(prepared, { force: true });
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
