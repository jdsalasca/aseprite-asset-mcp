import { inspectRasterFrame } from "./PixelArtPipeline.js";
import type { AssetManifestReader, AssetManifestWriter, RasterCodec } from "../../domain/image-assets.js";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { RasterFrame } from "../../domain/pixel-art.js";
import type {
  BeachSceneInput,
  EnvironmentKind,
  EnvironmentPackInput,
  MaterialTextureInput,
  DepthLightingInput,
  QualityGateInput,
  ReferenceAnalysis,
  StyleBibleInput,
  SceneExtensionInput,
  BiomeTransitionInput,
  TerrainKind,
  TerrainTilesetInput,
  TimeOfDayInput,
  VisualAssetGateway,
  WorldMapInput,
} from "../../domain/visual-assets.js";
import { MaterialTextureService } from "./MaterialTextureService.js";
import { DepthLightingService } from "./DepthLightingService.js";

const TERRAIN_COLORS: Record<TerrainKind, [number, number, number, number]> = {
  water: [48, 129, 173, 255],
  sand: [226, 194, 119, 255],
  grass: [87, 151, 91, 255],
  rock: [104, 104, 112, 255],
  snow: [224, 235, 235, 255],
  mud: [128, 91, 62, 255],
};

const DEFAULT_PALETTE = ["#12243A", "#28577A", "#3081AD", "#E2C277", "#57975B", "#686870", "#F2E9C9"];

class SeededRandom {
  private state: number;
  public constructor(seed: number) { this.state = (seed | 0) || 1; }
  public next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value | 0;
    return ((value >>> 0) % 100000) / 100000;
  }
}

function ok(value: unknown): AssetOperationResult { return { ok: true, message: JSON.stringify(value) }; }
function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function hexToRgba(value: string): [number, number, number, number] {
  const normalized = value.replace(/^#/, "");
  const expanded = normalized.length === 3 ? normalized.split("").map((part) => `${part}${part}`).join("") : normalized;
  if (!/^[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(expanded)) throw new Error(`Invalid palette color: ${value}`);
  return [Number.parseInt(expanded.slice(0, 2), 16), Number.parseInt(expanded.slice(2, 4), 16), Number.parseInt(expanded.slice(4, 6), 16), expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) : 255];
}
function colorKey(pixels: Uint8ClampedArray, offset: number): string { return `${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]},${pixels[offset + 3]}`; }
function luminance(red: number, green: number, blue: number): number { return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255; }
function frameFromColors(width: number, height: number, colors: Uint8ClampedArray): RasterFrame { return { width, height, pixels: colors }; }
function fillRect(pixels: Uint8ClampedArray, width: number, x: number, y: number, rectWidth: number, rectHeight: number, color: [number, number, number, number]): void {
  for (let row = Math.max(0, y); row < y + rectHeight; row += 1) {
    for (let column = Math.max(0, x); column < x + rectWidth; column += 1) {
      if (row < 0 || column < 0 || row * width + column >= pixels.length / 4) continue;
      const offset = (row * width + column) * 4;
      pixels.set(color, offset);
    }
  }
}

function bandingRuns(frame: RasterFrame): number {
  let runs = 0;
  for (let y = 0; y < frame.height; y += 1) {
    let run = 1;
    for (let x = 1; x < frame.width; x += 1) {
      const previous = colorKey(frame.pixels, ((y * frame.width) + x - 1) * 4);
      const current = colorKey(frame.pixels, ((y * frame.width) + x) * 4);
      if (current === previous) run += 1;
      else { if (run >= 4) runs += 1; run = 1; }
    }
    if (run >= 4) runs += 1;
  }
  return runs;
}

function validateDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || width < 1 || width > 2048 || !Number.isInteger(height) || height < 1 || height > 2048) throw new Error("Map dimensions must be integers from 1 to 2048");
}

function validatePathPair(inputFilename: string, outputFilename: string): void {
  if (!inputFilename.trim() || !outputFilename.trim()) throw new Error("Input and output map filenames are required");
  if (inputFilename.toLowerCase() === outputFilename.toLowerCase()) throw new Error("Input and output map filenames must differ");
}

function validatePadding(padding: SceneExtensionInput["padding"]): void {
  const values = [padding.top, padding.right, padding.bottom, padding.left];
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 512) || values.every((value) => value === 0)) throw new Error("Scene padding must use integers from 0 to 512 and extend at least one side");
}

interface BiomeTransitionRecord { x: number; y: number; from: string; to: string; distance: number; variant: "edge" | "blend" | "accent"; }

function validateTransitionWidth(width: number): void {
  if (!Number.isInteger(width) || width < 1 || width > 8) throw new Error("Biome transition width must be an integer from 1 to 8");
}

function buildBiomeTransitions(rows: string[], width: number, height: number, transitionWidth: number, seed: number): BiomeTransitionRecord[] {
  const cellCount = width * height;
  const distance = new Int16Array(cellCount);
  distance.fill(-1);
  const from = new Array<string>(cellCount).fill("");
  const to = new Array<string>(cellCount).fill("");
  const queue: number[] = [];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const current = rows[y]?.[x] ?? "A";
    const index = y * width + x;
    for (const [dx, dy] of directions) {
      const neighborX = x + dx; const neighborY = y + dy;
      if (neighborX < 0 || neighborY < 0 || neighborX >= width || neighborY >= height) continue;
      const neighbor = rows[neighborY]?.[neighborX] ?? current;
      if (neighbor === current) continue;
      distance[index] = 0; from[index] = current; to[index] = neighbor; queue.push(index); break;
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor]!; const x = index % width; const y = Math.floor(index / width); const nextDistance = (distance[index] ?? -1) + 1;
    if (nextDistance > transitionWidth) continue;
    for (const [dx, dy] of directions) {
      const neighborX = x + dx; const neighborY = y + dy;
      if (neighborX < 0 || neighborY < 0 || neighborX >= width || neighborY >= height) continue;
      const neighborIndex = neighborY * width + neighborX;
      if (distance[neighborIndex] !== -1) continue;
      distance[neighborIndex] = nextDistance; from[neighborIndex] = from[index]!; to[neighborIndex] = to[index]!; queue.push(neighborIndex);
    }
  }
  const maximum = Math.min(cellCount, 200_000);
  const transitions: BiomeTransitionRecord[] = [];
  for (let index = 0; index < cellCount && transitions.length < maximum; index += 1) {
    const cellDistance = distance[index] ?? -1;
    if (cellDistance < 0 || cellDistance > transitionWidth || from[index] === to[index]) continue;
    const x = index % width; const y = Math.floor(index / width); const roll = hashNoise(seed + 31, x, y);
    transitions.push({ x, y, from: rows[y]?.[x] ?? from[index]!, to: to[index]!, distance: cellDistance, variant: roll < 0.34 ? "edge" : roll < 0.67 ? "blend" : "accent" });
  }
  return transitions;
}

function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)); }

function extendRows(rows: string[], width: number, height: number, padding: SceneExtensionInput["padding"], seed: number): string[] {
  const outputWidth = width + padding.left + padding.right;
  const outputHeight = height + padding.top + padding.bottom;
  return Array.from({ length: outputHeight }, (_, targetY) => Array.from({ length: outputWidth }, (_, targetX) => {
    const sourceX = targetX - padding.left;
    const sourceY = targetY - padding.top;
    if (sourceX >= 0 && sourceX < width && sourceY >= 0 && sourceY < height) return rows[sourceY]![sourceX]!;
    const edgeX = clamp(sourceX, 0, width - 1);
    const edgeY = clamp(sourceY, 0, height - 1);
    const jitterX = Math.floor(hashNoise(seed, targetX, targetY) * 3) - 1;
    const jitterY = Math.floor(hashNoise(seed + 17, targetX, targetY) * 3) - 1;
    const sampleX = clamp(edgeX + jitterX, 0, width - 1);
    const sampleY = clamp(edgeY + jitterY, 0, height - 1);
    return rows[sampleY]![sampleX]!;
  }).join(""));
}

function hashNoise(seed: number, x: number, y: number): number {
  let value = Math.imul(x + seed * 31, 374761393) ^ Math.imul(y + seed * 17, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(seed: number, x: number, y: number, gridWidth: number, gridHeight: number): number {
  const gx = Math.floor(x * gridWidth);
  const gy = Math.floor(y * gridHeight);
  const fx = x * gridWidth - gx;
  const fy = y * gridHeight - gy;
  const smoothX = fx * fx * (3 - 2 * fx);
  const smoothY = fy * fy * (3 - 2 * fy);
  const top = hashNoise(seed, gx, gy) * (1 - smoothX) + hashNoise(seed, gx + 1, gy) * smoothX;
  const bottom = hashNoise(seed, gx, gy + 1) * (1 - smoothX) + hashNoise(seed, gx + 1, gy + 1) * smoothX;
  return top * (1 - smoothY) + bottom * smoothY;
}

export class VisualAssetService implements VisualAssetGateway {
  public constructor(private readonly codec: RasterCodec, private readonly manifestWriter: AssetManifestWriter, private readonly materialTextures = new MaterialTextureService(codec), private readonly depthLighting = new DepthLightingService(codec), private readonly manifestReader?: AssetManifestReader) {}

  public async createStyleBible(input: StyleBibleInput): Promise<AssetOperationResult> {
    try {
      if (!input.style.id.trim() || input.style.palette.length < 2) throw new Error("Style bible needs an id and at least two colors");
      if (!Number.isInteger(input.style.baseSize) || input.style.baseSize < 4) throw new Error("Style baseSize must be an integer of at least 4");
      input.style.palette.forEach((color) => { hexToRgba(color); });
      await this.manifestWriter.write(input.filename, { schemaVersion: 1, kind: "style_bible", ...input.style });
      return ok({ operation: "create_style_bible", filename: input.filename, id: input.style.id, colors: input.style.palette.length, seed: input.style.seed });
    } catch (error) { return fail(error); }
  }

  public async inspectReference(filename: string): Promise<AssetOperationResult> {
    try {
      const frames = await this.codec.decode(filename);
      const first = frames[0];
      if (!first) throw new Error("Reference has no frames");
      const histogram = new Map<string, number>();
      let luminanceSum = 0;
      let opaque = 0;
      let edges = 0;
      for (let y = 0; y < first.height; y += 1) {
        for (let x = 0; x < first.width; x += 1) {
          const offset = (y * first.width + x) * 4;
          const alpha = first.pixels[offset + 3] ?? 0;
          if (alpha === 0) continue;
          opaque += 1;
          const key = colorKey(first.pixels, offset);
          histogram.set(key, (histogram.get(key) ?? 0) + 1);
          luminanceSum += luminance(first.pixels[offset] ?? 0, first.pixels[offset + 1] ?? 0, first.pixels[offset + 2] ?? 0);
          if (x > 0 && colorKey(first.pixels, offset) !== colorKey(first.pixels, offset - 4)) edges += 1;
          if (y > 0 && colorKey(first.pixels, offset) !== colorKey(first.pixels, offset - first.width * 4)) edges += 1;
        }
      }
      const values = [...histogram.entries()].sort((left, right) => right[1] - left[1]).slice(0, 16);
      const luminances = values.map(([key]) => Number(key.split(",")[0] ?? 0));
      const report: ReferenceAnalysis = {
        filename, width: first.width, height: first.height, frames: frames.length,
        dominantColors: values.map(([key, count]) => ({ color: `#${key.split(",").slice(0, 3).map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`, count })),
        averageLuminance: opaque ? Number((luminanceSum / opaque).toFixed(4)) : 0,
        contrast: luminances.length > 1 ? Number(((Math.max(...luminances) - Math.min(...luminances)) / 255).toFixed(4)) : 0,
        edgeDensity: opaque ? Number((edges / opaque).toFixed(4)) : 0,
        transparencyRatio: Number((1 - opaque / (first.width * first.height)).toFixed(4)),
      };
      return ok(report);
    } catch (error) { return fail(error); }
  }

  public async runQualityGate(input: QualityGateInput): Promise<AssetOperationResult> {
    try {
      const frames = await this.codec.decode(input.filename);
      const maxColors = input.maxColors ?? 64;
      const maxIsolatedPixels = input.maxIsolatedPixels ?? 4;
      const minContrast = input.minContrast ?? 0.08;
      const maxBandingRuns = input.maxBandingRuns ?? Number.MAX_SAFE_INTEGER;
      const reports = frames.map((frame) => ({ ...inspectRasterFrame(frame), bandingRuns: bandingRuns(frame) }));
      const violations = reports.flatMap((report, index) => [
        ...(report.colors > maxColors ? [`frame ${index + 1}: colors ${report.colors} > ${maxColors}`] : []),
        ...(report.isolatedPixels > maxIsolatedPixels ? [`frame ${index + 1}: isolated pixels ${report.isolatedPixels} > ${maxIsolatedPixels}`] : []),
        ...(report.bandingRuns > maxBandingRuns ? [`frame ${index + 1}: banding runs ${report.bandingRuns} > ${maxBandingRuns}`] : []),
      ]);
      const first = frames[0];
      if (!first) throw new Error("Asset has no frames");
      const reference = await this.inspectReference(input.filename);
      const referenceData = reference.ok ? JSON.parse(reference.message) as ReferenceAnalysis : undefined;
      if ((referenceData?.contrast ?? 0) < minContrast) violations.push(`contrast ${(referenceData?.contrast ?? 0).toFixed(4)} < ${minContrast}`);
      return { ok: violations.length === 0, message: JSON.stringify({ filename: input.filename, valid: violations.length === 0, frames: reports.length, reports, violations }) };
    } catch (error) { return fail(error); }
  }

  public async buildTerrainTileset(input: TerrainTilesetInput): Promise<AssetOperationResult> {
    try {
      if (input.terrains.length < 2) throw new Error("At least two terrains are required");
      if (!Number.isInteger(input.tileSize) || input.tileSize < 4 || input.tileSize > 128) throw new Error("tileSize must be an integer from 4 to 128");
      const columns = 16;
      const rows = input.terrains.length;
      const pixels = new Uint8ClampedArray(input.tileSize * columns * input.tileSize * rows * 4);
      const palette = input.style?.palette ?? DEFAULT_PALETTE;
      const random = new SeededRandom(input.seed ?? 1);
      for (let terrainIndex = 0; terrainIndex < input.terrains.length; terrainIndex += 1) {
        const terrain = input.terrains[terrainIndex]!;
        const base = TERRAIN_COLORS[terrain];
        for (let variant = 0; variant < columns; variant += 1) {
          const x = variant * input.tileSize;
          const y = terrainIndex * input.tileSize;
          fillRect(pixels, input.tileSize * columns, x, y, input.tileSize, input.tileSize, base);
          const accent = hexToRgba(palette[(terrainIndex + variant) % palette.length] ?? palette[0] ?? "#ffffff");
          for (let row = 1; row < input.tileSize - 1; row += 3) {
            const start = Math.floor(random.next() * Math.max(1, input.tileSize - 3));
            fillRect(pixels, input.tileSize * columns, x + start, y + row, Math.min(2 + (variant % 2), input.tileSize - start), 1, accent);
          }
          const edge = hexToRgba(input.style?.outlineColor ?? "#12243A");
          if ((variant & 1) === 0) fillRect(pixels, input.tileSize * columns, x, y, input.tileSize, 1, edge);
          if ((variant & 2) === 0) fillRect(pixels, input.tileSize * columns, x + input.tileSize - 1, y, 1, input.tileSize, edge);
          if ((variant & 4) === 0) fillRect(pixels, input.tileSize * columns, x, y + input.tileSize - 1, input.tileSize, 1, edge);
          if ((variant & 8) === 0) fillRect(pixels, input.tileSize * columns, x, y, 1, input.tileSize, edge);
        }
      }
      await this.codec.encode([frameFromColors(input.tileSize * columns, input.tileSize * rows, pixels)], input.outputFilename, "png");
      await this.manifestWriter.write(input.manifestFilename, {
        schemaVersion: 1, kind: "terrain_tileset", tileSize: input.tileSize, columns, terrains: input.terrains,
        variants: input.terrains.flatMap((terrain, terrainIndex) => Array.from({ length: columns }, (_, variant) => ({ terrain, variant, x: variant * input.tileSize, y: terrainIndex * input.tileSize, adjacencyMask: variant }))),
      });
      return ok({ operation: "build_terrain_tileset", output: input.outputFilename, manifest: input.manifestFilename, terrains: input.terrains.length, variants: input.terrains.length * columns });
    } catch (error) { return fail(error); }
  }

  public async generateWorldMap(input: WorldMapInput): Promise<AssetOperationResult> {
    try {
      validateDimensions(input.width, input.height);
      if (input.biomes.length < 2) throw new Error("At least two biomes are required");
      const generated = this.createWorldMap(input);
      await this.manifestWriter.write(input.mapFilename, generated.map);
      if (input.previewFilename) await this.codec.encode([this.mapPreview(generated.rows, input.biomes, generated.symbols)], input.previewFilename, "png");
      return ok({ operation: "generate_world_map", map: input.mapFilename, preview: input.previewFilename ?? null, width: input.width, height: input.height, landmarks: Array.isArray(generated.map.landmarks) ? generated.map.landmarks.length : 0, seed: input.seed });
    } catch (error) { return fail(error); }
  }

  public async generateBeachScene(input: BeachSceneInput): Promise<AssetOperationResult> {
    try {
      validateDimensions(input.width, input.height);
      const symbols = new Map<TerrainKind, string>([["water", "A"], ["sand", "B"], ["grass", "C"], ["rock", "D"]]);
      const generated = this.createWorldMap({ ...input, biomes: ["water", "sand", "grass", "rock"] });
      await this.manifestWriter.write(input.mapFilename, generated.map);
      if (input.previewFilename) await this.codec.encode([this.mapPreview(generated.rows, ["water", "sand", "grass", "rock"], symbols)], input.previewFilename, "png");
      const rows = generated.rows;
      const frames = Array.from({ length: input.waveFrames ?? 6 }, (_, frameIndex) => this.mapPreview(rows, ["water", "sand", "grass", "rock"], symbols, frameIndex));
      frames.forEach((frame) => { frame.delayMs = input.waveDelayMs ?? 140; });
      await this.codec.encode(frames, input.waveFilename, "gif");
      return ok({ operation: "generate_beach_scene", map: input.mapFilename, preview: input.previewFilename ?? null, waveGif: input.waveFilename, frames: frames.length, seed: input.seed });
    } catch (error) { return fail(error); }
  }

  public async extendScene(input: SceneExtensionInput): Promise<AssetOperationResult> {
    try {
      validatePathPair(input.inputMapFilename, input.outputMapFilename);
      validatePadding(input.padding);
      if (!this.manifestReader) throw new Error("An asset manifest reader is required to extend a scene");
      if (!Number.isInteger(input.seed)) throw new Error("Scene extension seed must be an integer");
      const source = await this.manifestReader.read<{
        width: number;
        height: number;
        biomes?: unknown;
        symbols?: Record<string, string>;
        layers?: Array<{ name?: string; rows?: unknown }>;
        landmarks?: Array<Record<string, unknown>>;
        [key: string]: unknown;
      }>(input.inputMapFilename);
      validateDimensions(source.width, source.height);
      const layers = source.layers ?? [];
      if (layers.length === 0) throw new Error("Scene map must contain at least one layer");
      const normalizedLayers = layers.map((layer) => {
        if (!Array.isArray(layer.rows) || layer.rows.length !== source.height || layer.rows.some((row) => typeof row !== "string" || row.length !== source.width)) throw new Error("Scene layers must contain rows matching the map dimensions");
        return { ...layer, rows: extendRows(layer.rows as string[], source.width, source.height, input.padding, input.seed) };
      });
      const outputWidth = source.width + input.padding.left + input.padding.right;
      const outputHeight = source.height + input.padding.top + input.padding.bottom;
      if (outputWidth > 4096 || outputHeight > 4096) throw new Error("Extended scene dimensions must not exceed 4096");
      const landmarks = Array.isArray(source.landmarks) ? source.landmarks.map((landmark) => ({ ...landmark, ...(typeof landmark.x === "number" ? { x: landmark.x + input.padding.left } : {}), ...(typeof landmark.y === "number" ? { y: landmark.y + input.padding.top } : {}) })) : [];
      const output = { ...source, schemaVersion: 1, kind: source.kind ?? "world_map", width: outputWidth, height: outputHeight, layers: normalizedLayers, landmarks, extension: { sourceMap: input.inputMapFilename, padding: input.padding, seed: input.seed } };
      await this.manifestWriter.write(input.outputMapFilename, output);
      if (input.previewFilename) {
        const rawBiomes = Array.isArray(source.biomes) ? source.biomes.filter((biome): biome is TerrainKind => typeof biome === "string" && biome in TERRAIN_COLORS) : [];
        const biomes: TerrainKind[] = rawBiomes.length >= 1 ? rawBiomes : ["water"];
        const symbols = new Map<TerrainKind, string>(biomes.map((biome, index) => [biome, source.symbols?.[biome] ?? String.fromCharCode(65 + index)]));
        const terrainRows = normalizedLayers.find((layer) => layer.name === "terrain")?.rows ?? normalizedLayers[0]!.rows;
        await this.codec.encode([this.mapPreview(terrainRows, biomes, symbols)], input.previewFilename, "png");
      }
      return ok({ operation: "extend_scene", input: input.inputMapFilename, output: input.outputMapFilename, preview: input.previewFilename ?? null, width: outputWidth, height: outputHeight, padding: input.padding, seed: input.seed, layers: normalizedLayers.length, sourcePreserved: true, deterministic: true });
    } catch (error) { return fail(error); }
  }

  public async generateBiomeTransition(input: BiomeTransitionInput): Promise<AssetOperationResult> {
    try {
      validatePathPair(input.inputMapFilename, input.outputMapFilename);
      validateTransitionWidth(input.transitionWidth);
      if (!Number.isInteger(input.seed)) throw new Error("Biome transition seed must be an integer");
      if (!this.manifestReader) throw new Error("An asset manifest reader is required to generate biome transitions");
      const source = await this.manifestReader.read<{
        width: number;
        height: number;
        biomes?: unknown;
        symbols?: Record<string, string>;
        layers?: Array<{ name?: string; rows?: unknown }>;
        landmarks?: unknown[];
        [key: string]: unknown;
      }>(input.inputMapFilename);
      validateDimensions(source.width, source.height);
      const layers = source.layers ?? [];
      if (layers.length === 0) throw new Error("Scene map must contain at least one layer");
      const terrainLayer = layers.find((layer) => layer.name === "terrain") ?? layers[0];
      if (!terrainLayer || !Array.isArray(terrainLayer.rows) || terrainLayer.rows.length !== source.height || terrainLayer.rows.some((row) => typeof row !== "string" || row.length !== source.width)) throw new Error("Terrain layer rows must match the map dimensions");
      const rows = terrainLayer.rows as string[];
      const transitions = buildBiomeTransitions(rows, source.width, source.height, input.transitionWidth, input.seed);
      const output = { ...source, schemaVersion: 1, biomeTransitions: transitions, transition: { sourceMap: input.inputMapFilename, width: input.transitionWidth, seed: input.seed } };
      await this.manifestWriter.write(input.outputMapFilename, output);
      if (input.previewFilename) {
        const rawBiomes = Array.isArray(source.biomes) ? source.biomes.filter((biome): biome is TerrainKind => typeof biome === "string" && biome in TERRAIN_COLORS) : [];
        const biomes: TerrainKind[] = rawBiomes.length ? rawBiomes : ["water"];
        const symbols = new Map<TerrainKind, string>(biomes.map((biome, index) => [biome, source.symbols?.[biome] ?? String.fromCharCode(65 + index)]));
        await this.codec.encode([this.mapPreview(rows, biomes, symbols, 0, transitions)], input.previewFilename, "png");
      }
      return ok({ operation: "generate_biome_transition", input: input.inputMapFilename, output: input.outputMapFilename, preview: input.previewFilename ?? null, width: source.width, height: source.height, transitionWidth: input.transitionWidth, transitions: transitions.length, seed: input.seed, sourcePreserved: true, deterministic: true });
    } catch (error) { return fail(error); }
  }

  public async generateTimeOfDayPack(input: TimeOfDayInput): Promise<AssetOperationResult> {
    try {
      const source = await this.codec.decode(input.inputFilename);
      const base = source[0];
      if (!base) throw new Error("Input has no frames");
      const count = Math.max(2, Math.min(24, input.steps ?? 8));
      const frames = Array.from({ length: count }, (_, index) => {
        const phase = index / (count - 1);
        const shift = Math.round(Math.sin(phase * Math.PI * 2) * 52 - phase * 34 + index * 4);
        const pixels = new Uint8ClampedArray(base.pixels);
        for (let offset = 0; offset < pixels.length; offset += 4) {
          pixels[offset] = Math.max(0, Math.min(255, (pixels[offset] ?? 0) + shift));
          pixels[offset + 1] = Math.max(0, Math.min(255, (pixels[offset + 1] ?? 0) + shift));
          pixels[offset + 2] = Math.max(0, Math.min(255, (pixels[offset + 2] ?? 0) + Math.round(shift * 0.8)));
        }
        return { width: base.width, height: base.height, pixels, delayMs: input.delayMs ?? 180 };
      });
      await this.codec.encode(frames, input.outputFilename, "gif");
      if (input.manifestFilename) await this.manifestWriter.write(input.manifestFilename, { schemaVersion: 1, kind: "time_of_day_pack", input: input.inputFilename, output: input.outputFilename, frames: count, phases: ["day", "sunset", "night", "sunrise"] });
      return ok({ operation: "generate_time_of_day_pack", input: input.inputFilename, output: input.outputFilename, manifest: input.manifestFilename ?? null, frames: count });
    } catch (error) { return fail(error); }
  }

  public async applyMaterialTexture(input: MaterialTextureInput): Promise<AssetOperationResult> {
    return this.materialTextures.apply(input);
  }

  public async applyDepthLighting(input: DepthLightingInput): Promise<AssetOperationResult> {
    return this.depthLighting.apply(input);
  }

  public async generateEnvironmentPack(input: EnvironmentPackInput): Promise<AssetOperationResult> {
    try {
      validateDimensions(input.width, input.height);
      const prefix = input.outputPrefix.trim();
      if (!prefix) throw new Error("outputPrefix is required");
      const biomes = this.environmentBiomes(input.kind);
      const terrainPng = `${prefix}-tileset.png`;
      const terrainJson = `${prefix}-tileset.json`;
      const mapJson = `${prefix}-map.json`;
      const previewPng = `${prefix}-preview.png`;
      const timeGif = `${prefix}-time-of-day.gif`;
      const timeJson = `${prefix}-time-of-day.json`;
      const terrainResult = await this.buildTerrainTileset({ outputFilename: terrainPng, manifestFilename: terrainJson, tileSize: input.tileSize ?? 16, terrains: biomes, seed: input.seed });
      if (!terrainResult.ok) return terrainResult;
      let sceneResult: AssetOperationResult;
      let waveGif: string | undefined;
      if (input.kind === "beach") {
        waveGif = `${prefix}-waves.gif`;
        sceneResult = await this.generateBeachScene({ mapFilename: mapJson, previewFilename: previewPng, waveFilename: waveGif, width: input.width, height: input.height, seed: input.seed, biomes, detailLevel: input.detailLevel ?? "high", waveFrames: 8, waveDelayMs: 150 });
      } else {
        sceneResult = await this.generateWorldMap({ mapFilename: mapJson, previewFilename: previewPng, width: input.width, height: input.height, seed: input.seed, biomes, detailLevel: input.detailLevel ?? "high", landmarkCount: Math.max(4, Math.floor(input.width * input.height / 400)) });
      }
      if (!sceneResult.ok) return sceneResult;
      const timeResult = await this.generateTimeOfDayPack({ inputFilename: previewPng, outputFilename: timeGif, manifestFilename: timeJson, steps: 12, delayMs: 160 });
      if (!timeResult.ok) return timeResult;
      return ok({ operation: "generate_environment_pack", kind: input.kind, seed: input.seed, artifacts: { terrainPng, terrainJson, mapJson, previewPng, ...(waveGif ? { waveGif } : {}), timeGif, timeJson } });
    } catch (error) { return fail(error); }
  }

  private environmentBiomes(kind: EnvironmentKind): TerrainKind[] {
    if (kind === "beach") return ["water", "sand", "grass", "rock"];
    if (kind === "forest") return ["grass", "mud", "rock", "water"];
    if (kind === "village") return ["grass", "mud", "rock", "sand"];
    return ["rock", "mud", "water", "snow"];
  }

  private createWorldMap(input: WorldMapInput): { rows: string[]; symbols: Map<TerrainKind, string>; map: Record<string, unknown> } {
    const random = new SeededRandom(input.seed);
    const rows: string[] = [];
    const symbols = new Map<TerrainKind, string>(input.biomes.map((biome, index) => [biome, String.fromCharCode(65 + index)]));
    for (let y = 0; y < input.height; y += 1) {
      let row = "";
      for (let x = 0; x < input.width; x += 1) {
        const normalizedX = input.width === 1 ? 0 : x / (input.width - 1);
        const normalizedY = input.height === 1 ? 0 : y / (input.height - 1);
        const broad = smoothNoise(input.seed, normalizedX, normalizedY, 5, 4);
        const detail = smoothNoise(input.seed + 97, normalizedX, normalizedY, 11, 9);
        const value = Math.max(0, Math.min(0.999, broad * 0.72 + detail * 0.18 + normalizedY * 0.1));
        const coastal = input.biomes[0] === "water" && input.biomes.includes("sand");
        const coastalWater = coastal && normalizedX < 0.22;
        const coastalSand = coastal && normalizedX >= 0.22 && normalizedX < 0.38;
        const biomeIndex = coastalWater ? 0 : coastalSand ? Math.min(1, input.biomes.length - 1) : coastal ? Math.min(input.biomes.length - 1, 2 + Math.floor(value * Math.max(1, input.biomes.length - 2))) : Math.min(input.biomes.length - 1, Math.max(0, Math.floor(value * input.biomes.length)));
        row += symbols.get(input.biomes[biomeIndex] ?? input.biomes[0]!) ?? "A";
      }
      rows.push(row);
    }
    const landmarks = Array.from({ length: input.landmarkCount ?? Math.max(1, Math.floor(input.width * input.height / 800)) }, (_, index) => ({ id: `landmark-${index + 1}`, x: Math.floor(random.next() * input.width), y: Math.floor(random.next() * input.height), kind: index % 2 === 0 ? "point_of_interest" : "spawn" }));
    return { rows, symbols, map: { schemaVersion: 1, kind: "world_map", width: input.width, height: input.height, seed: input.seed, biomes: input.biomes, symbols: Object.fromEntries(symbols), layers: [{ name: "terrain", rows }], landmarks, detailLevel: input.detailLevel ?? "medium" } };
  }

  private mapPreview(rows: string[], biomes: TerrainKind[], symbols: Map<TerrainKind, string>, phase = 0, transitions: BiomeTransitionRecord[] = []): RasterFrame {
    const height = rows.length;
    const width = rows[0]?.length ?? 1;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const reverse = new Map([...symbols.entries()].map(([terrain, symbol]) => [symbol, terrain]));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const terrain = reverse.get(rows[y]?.[x] ?? "A") ?? biomes[0] ?? "water";
        const base = TERRAIN_COLORS[terrain];
        const tideShift = terrain === "water" ? (phase % 3) * 8 : 0;
        const wave = terrain === "water" && ((x + y + phase * 2) % 7 === 0)
          ? [Math.min(255, base[0] + 35 + tideShift), Math.min(255, base[1] + 35 + tideShift), Math.min(255, base[2] + 35 + tideShift), 255] as [number, number, number, number]
          : terrain === "water" && tideShift > 0
            ? [Math.min(255, base[0] + tideShift), Math.min(255, base[1] + tideShift), Math.min(255, base[2] + tideShift), 255] as [number, number, number, number]
            : base;
        pixels.set(wave, (y * width + x) * 4);
      }
    }
    for (const transition of transitions) {
      if (transition.x < 0 || transition.y < 0 || transition.x >= width || transition.y >= height) continue;
      const target = TERRAIN_COLORS[reverse.get(transition.to) ?? biomes[0] ?? "water"];
      const offset = (transition.y * width + transition.x) * 4;
      const mix = transition.variant === "edge" ? 0.75 : transition.variant === "blend" ? 0.5 : 0.3;
      pixels[offset] = Math.round((pixels[offset] ?? 0) * (1 - mix) + target[0] * mix);
      pixels[offset + 1] = Math.round((pixels[offset + 1] ?? 0) * (1 - mix) + target[1] * mix);
      pixels[offset + 2] = Math.round((pixels[offset + 2] ?? 0) * (1 - mix) + target[2] * mix);
      pixels[offset + 3] = 255;
    }
    return { width, height, pixels };
  }
}
