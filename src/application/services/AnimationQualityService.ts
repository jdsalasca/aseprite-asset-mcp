import path from "node:path";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AnimationQualityInput, AnimationQualityPort, AnimationQualityView, AnimationTransitionView } from "../../domain/animation-quality.js";
import type { RasterCodec } from "../../domain/image-assets.js";
import type { RasterFrame } from "../../domain/pixel-art.js";

function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }

function colorSet(frame: RasterFrame): Set<string> {
  const colors = new Set<string>();
  for (let offset = 0; offset < frame.pixels.length; offset += 4) if ((frame.pixels[offset + 3] ?? 0) > 0) colors.add(`${frame.pixels[offset]},${frame.pixels[offset + 1]},${frame.pixels[offset + 2]},${frame.pixels[offset + 3]}`);
  return colors;
}

function transition(from: RasterFrame, to: RasterFrame, fromFrame: number, toFrame: number): AnimationTransitionView {
  let changedPixels = 0;
  let minX = from.width;
  let minY = from.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < from.height; y += 1) for (let x = 0; x < from.width; x += 1) {
    const offset = (y * from.width + x) * 4;
    let changed = false;
    for (let channel = 0; channel < 4; channel += 1) if (from.pixels[offset + channel] !== to.pixels[offset + channel]) changed = true;
    if (!changed) continue;
    changedPixels += 1;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { fromFrame, toFrame, changedPixels, changedRatio: Number((changedPixels / (from.width * from.height)).toFixed(4)), changedBounds: maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } };
}

export class AnimationQualityService implements AnimationQualityPort {
  public constructor(private readonly codec: RasterCodec) {}

  public async inspect(input: AnimationQualityInput): Promise<AssetOperationResult> {
    try {
      if (!input.filename.trim()) throw new Error("Animation filename is required");
      if (input.filename.includes("\0")) throw new Error("Animation filename cannot contain null bytes");
      path.resolve(input.filename);
      const frames = await this.codec.decode(input.filename);
      if (frames.length < 2) throw new Error("Animation quality requires at least two frames");
      const first = frames[0]!;
      if (frames.some((frame) => frame.width !== first.width || frame.height !== first.height)) throw new Error("Animation frames must share dimensions");
      const transitions = frames.slice(1).map((frame, index) => transition(frames[index]!, frame, index + 1, index + 2));
      const loopTransition = transition(frames.at(-1)!, first, frames.length, 1);
      const duplicateFrames = transitions.filter((item) => item.changedPixels === 0).map((item) => item.toFrame);
      const frameColors = frames.map(colorSet);
      const firstColors = frameColors[0]!;
      const driftFrames = frameColors.map((colors, index) => [...colors].some((color) => !firstColors.has(color)) || [...firstColors].some((color) => !colors.has(color)) ? index + 1 : -1).filter((index) => index > 0);
      const delaysMs = frames.map((frame) => frame.delayMs ?? 0);
      const timing = { consistent: new Set(delaysMs).size <= 1, positive: delaysMs.every((delay) => delay > 0) };
      const violations = [
        ...(duplicateFrames.length ? [`duplicate frames: ${duplicateFrames.join(", ")}`] : []),
        ...(loopTransition.changedPixels ? [`loop seam changes ${loopTransition.changedPixels} pixels`] : []),
        ...(!timing.consistent ? ["frame timing is inconsistent"] : []),
        ...(!timing.positive ? ["one or more frame delays are not positive"] : []),
        ...(driftFrames.length ? [`palette drift detected in frames: ${driftFrames.join(", ")}`] : []),
      ];
      const recommendations = new Set<string>();
      if (duplicateFrames.length) recommendations.add("Remove duplicate frames or use them intentionally as explicit hold frames.");
      if (loopTransition.changedPixels) recommendations.add("Align the final frame with the first frame or mark the animation as non-looping.");
      if (!timing.consistent || !timing.positive) recommendations.add("Normalize frame delays before exporting to the target engine.");
      if (driftFrames.length) recommendations.add("Harmonize the animation palette so frames do not flash between colors.");
      if (recommendations.size === 0) recommendations.add("Animation passes duplicate-frame, timing, loop, and palette checks.");
      const payload: AnimationQualityView = { operation: "inspect_animation_quality", filename: input.filename, frameCount: frames.length, width: first.width, height: first.height, delaysMs, transitions, duplicateFrames, loop: { changedPixels: loopTransition.changedPixels, closed: loopTransition.changedPixels === 0 }, palette: { colorsPerFrame: frameColors.map((colors) => colors.size), driftFrames, stable: driftFrames.length === 0 }, timing, quality: { valid: violations.length === 0, violations }, recommendations: [...recommendations], deterministic: true, sourcePreserved: true };
      return { ok: violations.length === 0, message: JSON.stringify(payload) };
    } catch (error) { return fail(error); }
  }
}
