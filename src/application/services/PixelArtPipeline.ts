import type { PixelArtOptions, PixelArtQualityGateOptions, PixelArtQualityGateReport, PixelArtQualityReport, PixelArtSubjectReport, RasterFrame } from "../../domain/pixel-art.js";

interface ColorPoint { r: number; g: number; b: number; a: number; count: number }
interface ColorBox { points: ColorPoint[] }

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function assertFrame(frame: RasterFrame): void {
  if (!Number.isInteger(frame.width) || frame.width < 1 || !Number.isInteger(frame.height) || frame.height < 1) throw new Error("Frame dimensions must be positive integers");
  if (frame.pixels.length !== frame.width * frame.height * 4) throw new Error("Frame pixel buffer has an invalid length");
}

function pixelOffset(width: number, x: number, y: number): number { return (y * width + x) * 4; }

function clampByte(value: number): number { return Math.max(0, Math.min(255, Math.round(value))); }

function resizeNearest(frame: RasterFrame, width: number, height: number): RasterFrame {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(frame.width - 1, Math.floor(x * frame.width / width));
      const sourceY = Math.min(frame.height - 1, Math.floor(y * frame.height / height));
      const source = pixelOffset(frame.width, sourceX, sourceY);
      const target = pixelOffset(width, x, y);
      pixels[target] = frame.pixels[source] ?? 0;
      pixels[target + 1] = frame.pixels[source + 1] ?? 0;
      pixels[target + 2] = frame.pixels[source + 2] ?? 0;
      pixels[target + 3] = frame.pixels[source + 3] ?? 0;
    }
  }
  return { width, height, pixels, ...(frame.delayMs === undefined ? {} : { delayMs: frame.delayMs }) };
}

function resizeBox(frame: RasterFrame, width: number, height: number): RasterFrame {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * frame.height / height);
    const y1 = Math.max(y0 + 1, Math.ceil((y + 1) * frame.height / height));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * frame.width / width);
      const x1 = Math.max(x0 + 1, Math.ceil((x + 1) * frame.width / width));
      let alphaSum = 0;
      let redSum = 0;
      let greenSum = 0;
      let blueSum = 0;
      let count = 0;
      for (let sourceY = y0; sourceY < Math.min(frame.height, y1); sourceY += 1) {
        for (let sourceX = x0; sourceX < Math.min(frame.width, x1); sourceX += 1) {
          const source = pixelOffset(frame.width, sourceX, sourceY);
          const alpha = frame.pixels[source + 3] ?? 0;
          alphaSum += alpha;
          redSum += (frame.pixels[source] ?? 0) * alpha;
          greenSum += (frame.pixels[source + 1] ?? 0) * alpha;
          blueSum += (frame.pixels[source + 2] ?? 0) * alpha;
          count += 1;
        }
      }
      const target = pixelOffset(width, x, y);
      const alpha = count ? alphaSum / count : 0;
      pixels[target] = alphaSum ? clampByte(redSum / alphaSum) : 0;
      pixels[target + 1] = alphaSum ? clampByte(greenSum / alphaSum) : 0;
      pixels[target + 2] = alphaSum ? clampByte(blueSum / alphaSum) : 0;
      pixels[target + 3] = clampByte(alpha);
    }
  }
  return { width, height, pixels, ...(frame.delayMs === undefined ? {} : { delayMs: frame.delayMs }) };
}

function colorKey(red: number, green: number, blue: number, alpha: number): string { return `${red},${green},${blue},${alpha}`; }

function collectColors(frames: RasterFrame[], alphaThreshold: number): ColorPoint[] {
  const histogram = new Map<string, ColorPoint>();
  for (const frame of frames) {
    for (let offset = 0; offset < frame.pixels.length; offset += 4) {
      const alpha = frame.pixels[offset + 3] ?? 0;
      if (alpha < alphaThreshold) continue;
      const red = frame.pixels[offset] ?? 0;
      const green = frame.pixels[offset + 1] ?? 0;
      const blue = frame.pixels[offset + 2] ?? 0;
      const key = colorKey(red, green, blue, alpha);
      const point = histogram.get(key);
      if (point) point.count += 1;
      else histogram.set(key, { r: red, g: green, b: blue, a: alpha, count: 1 });
    }
  }
  return [...histogram.values()];
}

function range(box: ColorBox, channel: "r" | "g" | "b" | "a"): number {
  const values = box.points.map((point) => point[channel]);
  return Math.max(...values) - Math.min(...values);
}

function buildPalette(frames: RasterFrame[], maxColors: number, alphaThreshold: number): ColorPoint[] {
  const points = collectColors(frames, alphaThreshold);
  if (points.length <= maxColors) return points;
  const boxes: ColorBox[] = [{ points }];
  while (boxes.length < maxColors) {
    const candidateIndex = boxes.findIndex((box) => box.points.length > 1);
    if (candidateIndex < 0) break;
    let bestIndex = candidateIndex;
    let bestScore = -1;
    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index];
      if (!box || box.points.length < 2) continue;
      const score = Math.max(range(box, "r"), range(box, "g"), range(box, "b")) * box.points.reduce((sum, point) => sum + point.count, 0);
      if (score > bestScore) { bestScore = score; bestIndex = index; }
    }
    const box = boxes[bestIndex];
    if (!box || box.points.length < 2) break;
    const channels: Array<"r" | "g" | "b"> = ["r", "g", "b"];
    const channel = channels.sort((left, right) => range(box, right) - range(box, left))[0] ?? "r";
    const sorted = [...box.points].sort((left, right) => left[channel] - right[channel] || left.r - right.r || left.g - right.g || left.b - right.b);
    const total = sorted.reduce((sum, point) => sum + point.count, 0);
    let accumulated = 0;
    let split = 1;
    for (let index = 0; index < sorted.length - 1; index += 1) {
      accumulated += sorted[index]?.count ?? 0;
      if (accumulated >= total / 2) { split = index + 1; break; }
    }
    boxes.splice(bestIndex, 1, { points: sorted.slice(0, split) }, { points: sorted.slice(split) });
  }
  return boxes.map((box) => {
    const total = box.points.reduce((sum, point) => sum + point.count, 0) || 1;
    return {
      r: clampByte(box.points.reduce((sum, point) => sum + point.r * point.count, 0) / total),
      g: clampByte(box.points.reduce((sum, point) => sum + point.g * point.count, 0) / total),
      b: clampByte(box.points.reduce((sum, point) => sum + point.b * point.count, 0) / total),
      a: clampByte(box.points.reduce((sum, point) => sum + point.a * point.count, 0) / total),
      count: total,
    };
  });
}

function nearestColor(red: number, green: number, blue: number, alpha: number, palette: ColorPoint[]): ColorPoint {
  let best = palette[0] ?? { r: 0, g: 0, b: 0, a: 255, count: 1 };
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const color of palette) {
    const distance = (red - color.r) ** 2 + (green - color.g) ** 2 + (blue - color.b) ** 2 + (alpha - color.a) ** 2;
    if (distance < bestDistance) { bestDistance = distance; best = color; }
  }
  return best;
}

export function resizeRasterFrame(frame: RasterFrame, width: number, height: number, mode: "box" | "nearest" = "box"): RasterFrame {
  assertFrame(frame);
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) throw new Error("Target dimensions must be positive integers");
  return mode === "nearest" ? resizeNearest(frame, width, height) : resizeBox(frame, width, height);
}

export function convertRasterFrames(frames: RasterFrame[], options: PixelArtOptions): RasterFrame[] {
  if (frames.length === 0) throw new Error("At least one frame is required");
  if (!Number.isInteger(options.maxColors) || options.maxColors < 2 || options.maxColors > 256) throw new Error("maxColors must be an integer from 2 to 256");
  const alphaThreshold = options.alphaThreshold ?? 1;
  if (!Number.isInteger(alphaThreshold) || alphaThreshold < 0 || alphaThreshold > 255) throw new Error("alphaThreshold must be from 0 to 255");
  const resized = frames.map((frame) => resizeRasterFrame(frame, options.width, options.height, options.resizeMode ?? "box"));
  const palette = buildPalette(resized, options.maxColors, alphaThreshold);
  return resized.map((frame) => {
    const pixels = new Uint8ClampedArray(frame.pixels);
    for (let y = 0; y < frame.height; y += 1) {
      for (let x = 0; x < frame.width; x += 1) {
        const offset = pixelOffset(frame.width, x, y);
        const alpha = pixels[offset + 3] ?? 0;
        if (alpha < alphaThreshold) { pixels[offset] = 0; pixels[offset + 1] = 0; pixels[offset + 2] = 0; pixels[offset + 3] = 0; continue; }
        const threshold = options.dither === "bayer4x4" ? ((BAYER_4X4[y % 4]?.[x % 4] ?? 0) / 16 - 0.5) * 24 : 0;
        const color = nearestColor(clampByte((pixels[offset] ?? 0) + threshold), clampByte((pixels[offset + 1] ?? 0) + threshold), clampByte((pixels[offset + 2] ?? 0) + threshold), alpha, palette);
        pixels[offset] = color.r; pixels[offset + 1] = color.g; pixels[offset + 2] = color.b; pixels[offset + 3] = alpha;
      }
    }
    return { width: frame.width, height: frame.height, pixels, ...(frame.delayMs === undefined ? {} : { delayMs: frame.delayMs }) };
  });
}

function parseHexColor(value: string): [number, number, number] {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(normalized)) throw new Error("Accent color must be a 6 or 8 digit hexadecimal color");
  return [Number.parseInt(normalized.slice(0, 2), 16), Number.parseInt(normalized.slice(2, 4), 16), Number.parseInt(normalized.slice(4, 6), 16)];
}

function hexColor(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((value) => clampByte(value).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Apply one deterministic hue family to every frame, then quantize the shared output palette. */
export function harmonizeRasterFrames(frames: RasterFrame[], accentColor: string, strength: number, maxColors: number): { frames: RasterFrame[]; palette: string[] } {
  if (frames.length === 0) throw new Error("At least one frame is required");
  if (!Number.isFinite(strength) || strength < 0 || strength > 1) throw new Error("Strength must be between 0 and 1");
  const [accentRed, accentGreen, accentBlue] = parseHexColor(accentColor);
  const transformed = frames.map((frame) => {
    assertFrame(frame);
    const pixels = new Uint8ClampedArray(frame.pixels);
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const alpha = pixels[offset + 3] ?? 0;
      if (alpha === 0) { pixels[offset] = 0; pixels[offset + 1] = 0; pixels[offset + 2] = 0; continue; }
      const red = pixels[offset] ?? 0;
      const green = pixels[offset + 1] ?? 0;
      const blue = pixels[offset + 2] ?? 0;
      const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      const accentScale = 0.35 + luminance * 0.65;
      pixels[offset] = clampByte(red * (1 - strength) + accentRed * accentScale * strength);
      pixels[offset + 1] = clampByte(green * (1 - strength) + accentGreen * accentScale * strength);
      pixels[offset + 2] = clampByte(blue * (1 - strength) + accentBlue * accentScale * strength);
    }
    return { width: frame.width, height: frame.height, pixels, ...(frame.delayMs === undefined ? {} : { delayMs: frame.delayMs }) };
  });
  const first = transformed[0]!;
  const quantized = convertRasterFrames(transformed, { width: first.width, height: first.height, maxColors, resizeMode: "nearest", dither: "none", alphaThreshold: 1 });
  const palette = [...new Set(quantized.flatMap((frame) => {
    const colors = new Set<string>();
    for (let offset = 0; offset < frame.pixels.length; offset += 4) if ((frame.pixels[offset + 3] ?? 0) > 0) colors.add(hexColor(frame.pixels[offset] ?? 0, frame.pixels[offset + 1] ?? 0, frame.pixels[offset + 2] ?? 0));
    return [...colors];
  }))].sort();
  return { frames: quantized, palette };
}

export function inspectRasterFrame(frame: RasterFrame, alphaThreshold = 1): PixelArtQualityReport {
  assertFrame(frame);
  const colors = new Set<string>();
  let opaquePixels = 0;
  let isolatedPixels = 0;
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const offset = pixelOffset(frame.width, x, y);
      const alpha = frame.pixels[offset + 3] ?? 0;
      if (alpha < alphaThreshold) continue;
      opaquePixels += 1;
      colors.add(colorKey(frame.pixels[offset] ?? 0, frame.pixels[offset + 1] ?? 0, frame.pixels[offset + 2] ?? 0, alpha));
      let neighbors = 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= frame.width || ny >= frame.height) continue;
        if ((frame.pixels[pixelOffset(frame.width, nx, ny) + 3] ?? 0) >= alphaThreshold) neighbors += 1;
      }
      if (neighbors === 0) isolatedPixels += 1;
    }
  }
  return { width: frame.width, height: frame.height, colors: colors.size, opaquePixels, transparentPixels: frame.width * frame.height - opaquePixels, isolatedPixels };
}

function isOpaque(frame: RasterFrame, x: number, y: number, alphaThreshold: number): boolean {
  return (frame.pixels[pixelOffset(frame.width, x, y) + 3] ?? 0) >= alphaThreshold;
}

function componentSizes(frame: RasterFrame, alphaThreshold: number): number[] {
  const visited = new Uint8Array(frame.width * frame.height);
  const sizes: number[] = [];
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const start = y * frame.width + x;
      if (visited[start] || !isOpaque(frame, x, y, alphaThreshold)) continue;
      visited[start] = 1;
      const queue: Array<[number, number]> = [[x, y]];
      let size = 0;
      for (let index = 0; index < queue.length; index += 1) {
        const [currentX, currentY] = queue[index]!;
        size += 1;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nextX = currentX + dx;
          const nextY = currentY + dy;
          if (nextX < 0 || nextY < 0 || nextX >= frame.width || nextY >= frame.height) continue;
          const next = nextY * frame.width + nextX;
          if (!visited[next] && isOpaque(frame, nextX, nextY, alphaThreshold)) {
            visited[next] = 1;
            queue.push([nextX, nextY]);
          }
        }
      }
      sizes.push(size);
    }
  }
  return sizes;
}

/**
 * Inspect the subject silhouette independently from palette quality. This is
 * deliberately deterministic and catches the old catalog bug where a fauna
 * asset was just a filled rectangle with no transparent border or anatomy.
 */
export function inspectPixelArtSubject(frame: RasterFrame, alphaThreshold = 1): PixelArtSubjectReport {
  assertFrame(frame);
  if (!Number.isInteger(alphaThreshold) || alphaThreshold < 0 || alphaThreshold > 255) throw new Error("alphaThreshold must be from 0 to 255");
  let opaquePixels = 0;
  let edgePixels = 0;
  const rowSpans = new Set<string>();
  for (let y = 0; y < frame.height; y += 1) {
    let first = -1;
    let last = -1;
    for (let x = 0; x < frame.width; x += 1) {
      if (!isOpaque(frame, x, y, alphaThreshold)) continue;
      opaquePixels += 1;
      if (first < 0) first = x;
      last = x;
      const hasTransparentNeighbor = ([[-1, 0], [1, 0], [0, -1], [0, 1]] as Array<readonly [number, number]>).some((neighbor) => {
        const dx = neighbor[0];
        const dy = neighbor[1];
        const nx = x + dx;
        const ny = y + dy;
        return nx < 0 || ny < 0 || nx >= frame.width || ny >= frame.height || !isOpaque(frame, nx, ny, alphaThreshold);
      });
      if (hasTransparentNeighbor) edgePixels += 1;
    }
    if (first >= 0) rowSpans.add(`${first}:${last}`);
  }
  const components = componentSizes(frame, alphaThreshold);
  const largest = Math.max(0, ...components);
  const transparentBorder = ([
    [0, 0], [frame.width - 1, 0], [0, frame.height - 1], [frame.width - 1, frame.height - 1],
  ] as Array<readonly [number, number]>).some((corner) => !isOpaque(frame, corner[0], corner[1], alphaThreshold));
  return {
    width: frame.width,
    height: frame.height,
    opaquePixels,
    coverage: opaquePixels / (frame.width * frame.height),
    edgePixels,
    connectedComponents: components.length,
    largestComponentRatio: opaquePixels === 0 ? 0 : largest / opaquePixels,
    distinctRowSpans: rowSpans.size,
    transparentBorder,
  };
}

export function runPixelArtQualityGate(frame: RasterFrame, options: PixelArtQualityGateOptions = {}, alphaThreshold = 1): PixelArtQualityGateReport {
  const report = inspectPixelArtSubject(frame, alphaThreshold);
  const minOpaquePixels = options.minOpaquePixels ?? 24;
  const minCoverage = options.minCoverage ?? 0.04;
  const maxCoverage = options.maxCoverage ?? 0.86;
  const minEdgePixels = options.minEdgePixels ?? 12;
  const minDistinctRowSpans = options.minDistinctRowSpans ?? 4;
  const maxComponents = options.maxComponents ?? 12;
  const minLargestComponentRatio = options.minLargestComponentRatio ?? 0.72;
  const violations = [
    ...(report.opaquePixels < minOpaquePixels ? [`opaque pixels ${report.opaquePixels} < ${minOpaquePixels}`] : []),
    ...(report.coverage < minCoverage ? [`coverage ${report.coverage.toFixed(3)} < ${minCoverage}`] : []),
    ...(report.coverage > maxCoverage ? [`coverage ${report.coverage.toFixed(3)} > ${maxCoverage}`] : []),
    ...(report.edgePixels < minEdgePixels ? [`edge pixels ${report.edgePixels} < ${minEdgePixels}`] : []),
    ...(report.distinctRowSpans < minDistinctRowSpans ? [`distinct row spans ${report.distinctRowSpans} < ${minDistinctRowSpans}`] : []),
    ...(report.connectedComponents > maxComponents ? [`connected components ${report.connectedComponents} > ${maxComponents}`] : []),
    ...(report.largestComponentRatio < minLargestComponentRatio ? [`largest component ratio ${report.largestComponentRatio.toFixed(3)} < ${minLargestComponentRatio}`] : []),
    ...(options.requireTransparentBorder === false || report.transparentBorder ? [] : ["subject has no transparent border"]),
  ];
  return { ...report, valid: violations.length === 0, violations };
}
