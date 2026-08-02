import path from "node:path";
import type { RasterCodec } from "../../domain/image-assets.js";
import type { EnhancementApplyInput, EnhancementApplyReport, EnhancementPlan, EnhancementPass } from "../../domain/enhancement.js";
import type { RasterFrame } from "../../domain/pixel-art.js";

function offset(frame: RasterFrame, x: number, y: number): number { return (y * frame.width + x) * 4; }
function clamp(value: number): number { return Math.max(0, Math.min(255, Math.round(value))); }
function hash(seed: number, x: number, y: number, frameIndex: number): number {
  let value = Math.imul(seed + frameIndex * 97 + x * 374761393, 668265263) ^ Math.imul(y + 17, 1274126177);
  value = Math.imul(value ^ (value >>> 13), 2246822519);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function isOpaque(frame: RasterFrame, x: number, y: number): boolean { return (frame.pixels[offset(frame, x, y) + 3] ?? 0) > 0; }

function cleanup(frame: RasterFrame): void {
  const source = new Uint8ClampedArray(frame.pixels);
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    const current = offset(frame, x, y);
    if ((source[current + 3] ?? 0) === 0) continue;
    let neighbors = 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < frame.width && ny < frame.height && (source[offset(frame, nx, ny) + 3] ?? 0) > 0) neighbors += 1;
    }
    if (neighbors === 0) frame.pixels[current + 3] = 0;
  }
}

function addTerrainGrain(frame: RasterFrame, seed: number, frameIndex: number): void {
  for (let y = 1; y < frame.height - 1; y += 1) for (let x = 1; x < frame.width - 1; x += 1) {
    const at = offset(frame, x, y);
    if ((frame.pixels[at + 3] ?? 0) === 0 || hash(seed, x, y, frameIndex) > 0.075) continue;
    const delta = hash(seed + 3, x, y, frameIndex) > 0.5 ? 12 : -12;
    frame.pixels[at] = clamp((frame.pixels[at] ?? 0) + delta);
    frame.pixels[at + 1] = clamp((frame.pixels[at + 1] ?? 0) + delta);
    frame.pixels[at + 2] = clamp((frame.pixels[at + 2] ?? 0) + delta);
  }
}

function addWaterFlow(frame: RasterFrame, seed: number, frameIndex: number): void {
  for (let y = 1; y < frame.height - 1; y += 1) for (let x = 1; x < frame.width - 1; x += 1) {
    const at = offset(frame, x, y);
    const red = frame.pixels[at] ?? 0; const green = frame.pixels[at + 1] ?? 0; const blue = frame.pixels[at + 2] ?? 0;
    if ((frame.pixels[at + 3] ?? 0) === 0 || blue < red || blue < green * 0.85 || hash(seed + frameIndex, x, y, 0) > 0.045) continue;
    const next = offset(frame, x + 1, y);
    frame.pixels[next] = clamp((frame.pixels[next] ?? 0) + 18);
    frame.pixels[next + 1] = clamp((frame.pixels[next + 1] ?? 0) + 22);
    frame.pixels[next + 2] = clamp((frame.pixels[next + 2] ?? 0) + 24);
  }
}

function addDirectionalLight(frame: RasterFrame, intensity: number): void {
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    const at = offset(frame, x, y);
    if ((frame.pixels[at + 3] ?? 0) === 0) continue;
    const normalized = (x / Math.max(1, frame.width - 1) + (1 - y / Math.max(1, frame.height - 1))) / 2 - 0.5;
    const delta = normalized * 42 * intensity;
    frame.pixels[at] = clamp((frame.pixels[at] ?? 0) + delta);
    frame.pixels[at + 1] = clamp((frame.pixels[at + 1] ?? 0) + delta);
    frame.pixels[at + 2] = clamp((frame.pixels[at + 2] ?? 0) + delta);
  }
}

function addTimeOfDay(frame: RasterFrame, frameIndex: number, frameCount: number): void {
  const phase = frameCount <= 1 ? 0 : frameIndex / (frameCount - 1);
  const shift = Math.round(Math.sin(phase * Math.PI * 2) * 24 - phase * 18);
  for (let at = 0; at < frame.pixels.length; at += 4) {
    if ((frame.pixels[at + 3] ?? 0) === 0) continue;
    frame.pixels[at] = clamp((frame.pixels[at] ?? 0) + shift);
    frame.pixels[at + 1] = clamp((frame.pixels[at + 1] ?? 0) + shift);
    frame.pixels[at + 2] = clamp((frame.pixels[at + 2] ?? 0) + Math.round(shift * 0.8));
  }
}

function addParticles(frame: RasterFrame, seed: number, frameIndex: number): void {
  const count = Math.max(1, Math.floor(frame.width * frame.height / 900));
  for (let index = 0; index < count; index += 1) {
    const x = Math.floor(hash(seed + index, 11, 7, frameIndex) * frame.width);
    const y = Math.floor(hash(seed + index, 19, 13, frameIndex) * frame.height);
    const at = offset(frame, Math.min(frame.width - 1, x), Math.min(frame.height - 1, y));
    if ((frame.pixels[at + 3] ?? 0) > 0) continue;
    frame.pixels[at] = 244; frame.pixels[at + 1] = 220; frame.pixels[at + 2] = 144; frame.pixels[at + 3] = 210;
  }
}

function applyPass(frame: RasterFrame, pass: EnhancementPass, seed: number, frameIndex: number, frameCount: number): void {
  if (pass.id === "cleanup") cleanup(frame);
  if (pass.id === "terrain_grain") addTerrainGrain(frame, seed, frameIndex);
  if (pass.id === "water_flow") addWaterFlow(frame, seed, frameIndex);
  if (pass.id === "directional_lighting") addDirectionalLight(frame, Number(pass.parameters.intensity ?? 0.2));
  if (pass.id === "particles") addParticles(frame, seed, frameIndex);
  if (pass.id === "time_of_day") addTimeOfDay(frame, frameIndex, frameCount);
}

export class DeterministicEnhancementService {
  public constructor(private readonly codec: RasterCodec) {}

  public async apply(plan: EnhancementPlan, input: EnhancementApplyInput): Promise<EnhancementApplyReport> {
    const sourcePath = path.resolve(plan.filename);
    const outputPath = path.resolve(input.outputFilename);
    const pathsMatch = process.platform === "win32"
      ? sourcePath.toLowerCase() === outputPath.toLowerCase()
      : sourcePath === outputPath;
    if (pathsMatch) throw new Error("Enhancement output must be different from the source asset");
    const frames = await this.codec.decode(plan.filename);
    const enhanced = frames.map((frame) => ({ ...frame, pixels: new Uint8ClampedArray(frame.pixels) }));
    for (let index = 0; index < enhanced.length; index += 1) {
      const frame = enhanced[index];
      if (!frame) continue;
      for (const pass of plan.passes) applyPass(frame, pass, plan.seed, index, enhanced.length);
    }
    await this.codec.encode(enhanced, input.outputFilename, input.format);
    return { planId: plan.planId, outputFilename: input.outputFilename, format: input.format, frames: enhanced.length, passesApplied: plan.passes.filter((pass) => pass.id !== "quality_gate").map((pass) => pass.id), sourcePreserved: true };
  }
}
