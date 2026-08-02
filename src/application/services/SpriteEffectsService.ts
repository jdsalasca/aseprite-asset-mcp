import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { RasterCodec } from "../../domain/image-assets.js";
import type { RasterFrame } from "../../domain/pixel-art.js";
import type { ColorGradeInput, DayNightCycleInput, MotionPackInput, NormalMapInput, ParticleBurstInput, PixelOutlineInput, RainOverlayInput, SeamlessTextureInput, SpriteEffectFormat, SpriteEffectsGateway, SpriteShadowInput, WaterCausticsInput, WaterReflectionInput } from "../../domain/sprite-effects.js";

function ok(value: unknown): AssetOperationResult { return { ok: true, message: JSON.stringify(value) }; }
function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
function assertDifferent(input: string, output: string): void { if (input.trim().toLowerCase() === output.trim().toLowerCase()) throw new Error("Input and output filenames must be different"); }
function rgba(color: string): [number, number, number, number] { const value = color.replace(/^#/, ""); if (!/^[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/.test(value)) throw new Error(`Invalid color: ${color}`); return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16), value.length === 8 ? Number.parseInt(value.slice(6, 8), 16) : 255]; }
function formatFor(frames: RasterFrame[], format?: SpriteEffectFormat): SpriteEffectFormat { return format ?? (frames.length > 1 ? "gif" : "png"); }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function blend(value: number, factor: number): number { return Math.round(clamp(value * factor, 0, 255)); }
function hash(seed: number, index: number): number { let value = Math.imul(seed + index * 374761393, 668265263); value = Math.imul(value ^ (value >>> 13), 1274126177); return ((value ^ (value >>> 16)) >>> 0) / 4294967295; }
function alphaAt(frame: RasterFrame, x: number, y: number): number { if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return 0; return frame.pixels[(y * frame.width + x) * 4 + 3] ?? 0; }
function setPixel(pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number, color: [number, number, number, number]): void { if (x < 0 || y < 0 || x >= width || y >= height) return; pixels.set(color, (y * width + x) * 4); }
function compositePixel(pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number, color: [number, number, number, number]): void {
  if (x < 0 || y < 0 || x >= width || y >= height || color[3] <= 0) return;
  const offset = (y * width + x) * 4;
  const sourceAlpha = clamp(color[3] / 255, 0, 1);
  const destinationAlpha = clamp((pixels[offset + 3] ?? 0) / 255, 0, 1);
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
  if (outputAlpha <= 0) return;
  for (let channel = 0; channel < 3; channel += 1) pixels[offset + channel] = Math.round(((color[channel] ?? 0) * sourceAlpha + (pixels[offset + channel] ?? 0) * destinationAlpha * (1 - sourceAlpha)) / outputAlpha);
  pixels[offset + 3] = Math.round(outputAlpha * 255);
}
function overlayPixel(pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number, color: [number, number, number, number], mix: number): void {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = (y * width + x) * 4;
  if ((pixels[offset + 3] ?? 0) === 0) return;
  const factor = clamp(mix * (color[3] / 255), 0, 1);
  for (let channel = 0; channel < 3; channel += 1) pixels[offset + channel] = Math.round((pixels[offset + channel] ?? 0) * (1 - factor) + (color[channel] ?? 0) * factor);
}
function outputMessage(operation: string, input: string | null, output: string, frames: number, format: SpriteEffectFormat): AssetOperationResult { return ok({ operation, ...(input ? { input } : {}), output, frames, format, deterministic: true, sourcePreserved: true }); }
function averagePixel(left: Uint8ClampedArray, right: Uint8ClampedArray, leftOffset: number, rightOffset: number): [number, number, number, number] { return [Math.round(((left[leftOffset] ?? 0) + (right[rightOffset] ?? 0)) / 2), Math.round(((left[leftOffset + 1] ?? 0) + (right[rightOffset + 1] ?? 0)) / 2), Math.round(((left[leftOffset + 2] ?? 0) + (right[rightOffset + 2] ?? 0)) / 2), Math.round(((left[leftOffset + 3] ?? 0) + (right[rightOffset + 3] ?? 0)) / 2)]; }
function interpolateChannel(left: number, right: number, progress: number): number { return Math.round(left + (right - left) * progress); }
function interpolateRgb(left: [number, number, number], right: [number, number, number], progress: number): [number, number, number] { return [interpolateChannel(left[0], right[0], progress), interpolateChannel(left[1], right[1], progress), interpolateChannel(left[2], right[2], progress)]; }

export class SpriteEffectsService implements SpriteEffectsGateway {
  public constructor(private readonly codec: RasterCodec) {}

  public async applyPixelOutline(input: PixelOutlineInput): Promise<AssetOperationResult> {
    try {
      assertDifferent(input.inputFilename, input.outputFilename);
      const color = rgba(input.color);
      const thickness = input.thickness ?? 1;
      if (!Number.isInteger(thickness) || thickness < 1 || thickness > 8) throw new Error("Outline thickness must be an integer from 1 to 8");
      const source = await this.codec.decode(input.inputFilename);
      const frames = source.map((frame) => { const pixels = new Uint8ClampedArray(frame.pixels); for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) if (alphaAt(frame, x, y) > 0) for (let dy = -thickness; dy <= thickness; dy += 1) for (let dx = -thickness; dx <= thickness; dx += 1) if (Math.abs(dx) + Math.abs(dy) <= thickness && alphaAt(frame, x + dx, y + dy) === 0) setPixel(pixels, frame.width, frame.height, x + dx, y + dy, [color[0], color[1], color[2], Math.round((alphaAt(frame, x, y) * color[3]) / 255)]); return { ...frame, pixels }; });
      const format = formatFor(frames, input.format); await this.codec.encode(frames, input.outputFilename, format); return outputMessage("apply_pixel_outline", input.inputFilename, input.outputFilename, frames.length, format);
    } catch (error) { return fail(error); }
  }

  public async applyColorGrade(input: ColorGradeInput): Promise<AssetOperationResult> {
    try {
      assertDifferent(input.inputFilename, input.outputFilename); const brightness = input.brightness ?? 0; const contrast = input.contrast ?? 1; const saturation = input.saturation ?? 1;
      if (brightness < -1 || brightness > 1 || contrast < 0 || contrast > 2 || saturation < 0 || saturation > 2) throw new Error("Color grade values are out of range");
      const source = await this.codec.decode(input.inputFilename); const frames = source.map((frame) => { const pixels = new Uint8ClampedArray(frame.pixels); for (let offset = 0; offset < pixels.length; offset += 4) { if ((pixels[offset + 3] ?? 0) === 0) continue; const red = (pixels[offset] ?? 0) / 255; const green = (pixels[offset + 1] ?? 0) / 255; const blue = (pixels[offset + 2] ?? 0) / 255; const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722; const adjust = (value: number) => clamp((value - 0.5) * contrast + 0.5 + brightness, 0, 1); pixels[offset] = blend((luma + (adjust(red) - luma) * saturation) * 255, 1); pixels[offset + 1] = blend((luma + (adjust(green) - luma) * saturation) * 255, 1); pixels[offset + 2] = blend((luma + (adjust(blue) - luma) * saturation) * 255, 1); } return { ...frame, pixels }; }); const format = formatFor(frames, input.format); await this.codec.encode(frames, input.outputFilename, format); return outputMessage("apply_color_grade", input.inputFilename, input.outputFilename, frames.length, format);
    } catch (error) { return fail(error); }
  }

  public async generateSpriteShadow(input: SpriteShadowInput): Promise<AssetOperationResult> {
    try {
      assertDifferent(input.inputFilename, input.outputFilename); const color = rgba(input.color); const opacity = input.opacity ?? 0.45; if (!Number.isInteger(input.offsetX) || !Number.isInteger(input.offsetY) || Math.abs(input.offsetX) > 32 || Math.abs(input.offsetY) > 32) throw new Error("Shadow offsets must be integers from -32 to 32"); if (opacity < 0 || opacity > 1) throw new Error("Shadow opacity must be between 0 and 1");
      const source = await this.codec.decode(input.inputFilename); const frames = source.map((frame) => { const pixels = new Uint8ClampedArray(frame.pixels); for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) { const alpha = alphaAt(frame, x, y); if (alpha === 0) continue; const targetX = x + input.offsetX; const targetY = y + input.offsetY; const targetOffset = (targetY * frame.width + targetX) * 4; if (targetX >= 0 && targetY >= 0 && targetX < frame.width && targetY < frame.height && (pixels[targetOffset + 3] ?? 0) === 0) pixels.set([color[0], color[1], color[2], Math.round(alpha * color[3] * opacity / 255)], targetOffset); } return { ...frame, pixels }; }); const format = formatFor(frames, input.format); await this.codec.encode(frames, input.outputFilename, format); return outputMessage("generate_sprite_shadow", input.inputFilename, input.outputFilename, frames.length, format);
    } catch (error) { return fail(error); }
  }

  public async generateParticleBurst(input: ParticleBurstInput): Promise<AssetOperationResult> {
    try {
      const color = rgba(input.color); if (!Number.isInteger(input.width) || input.width < 8 || input.width > 512 || !Number.isInteger(input.height) || input.height < 8 || input.height > 512) throw new Error("Particle canvas dimensions must be integers from 8 to 512"); if (!Number.isInteger(input.frames) || input.frames < 2 || input.frames > 24 || !Number.isInteger(input.particleCount) || input.particleCount < 1 || input.particleCount > 128) throw new Error("Particle frames/count are outside the supported range");
      const frames: RasterFrame[] = Array.from({ length: input.frames }, (_, frameIndex) => { const pixels = new Uint8ClampedArray(input.width * input.height * 4); const phase = frameIndex / (input.frames - 1); for (let particle = 0; particle < input.particleCount; particle += 1) { const angle = hash(input.seed, particle) * Math.PI * 2; const radius = phase * (Math.min(input.width, input.height) * (0.15 + hash(input.seed + 7, particle) * 0.38)); const x = Math.round(input.width / 2 + Math.cos(angle) * radius); const y = Math.round(input.height / 2 + Math.sin(angle) * radius); const alpha = Math.round(color[3] * (0.18 + (1 - phase) * 0.82) * (0.45 + hash(input.seed + 11, particle) * 0.55)); setPixel(pixels, input.width, input.height, x, y, [color[0], color[1], color[2], alpha]); if (particle % 3 === 0) setPixel(pixels, input.width, input.height, x + 1, y, [color[0], color[1], color[2], Math.round(alpha * 0.6)]); } const cadenceX = 1 + (frameIndex % Math.max(1, input.width - 2)); const cadenceY = 1 + ((frameIndex * 2) % Math.max(1, input.height - 2)); const cadenceAlpha = Math.min(255, 80 + frameIndex * 24); setPixel(pixels, input.width, input.height, cadenceX, cadenceY, [color[0], color[1], color[2], cadenceAlpha]); return { width: input.width, height: input.height, pixels, delayMs: input.delayMs ?? 80 }; }); await this.codec.encode(frames, input.outputFilename, "gif"); return outputMessage("generate_particle_burst", null, input.outputFilename, frames.length, "gif");
    } catch (error) { return fail(error); }
  }

  public async generateNormalMap(input: NormalMapInput): Promise<AssetOperationResult> {
    try {
      assertDifferent(input.inputFilename, input.outputFilename); const strength = input.strength ?? 2; if (!Number.isFinite(strength) || strength < 0 || strength > 8) throw new Error("Normal map strength must be between 0 and 8"); const source = await this.codec.decode(input.inputFilename); const frames = source.map((frame) => { const pixels = new Uint8ClampedArray(frame.pixels); const heightAt = (x: number, y: number) => alphaAt(frame, x, y) / 255; for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) { const offset = (y * frame.width + x) * 4; if ((frame.pixels[offset + 3] ?? 0) === 0) { pixels.set([128, 128, 255, 0], offset); continue; } const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * strength; const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * strength; pixels.set([Math.round(clamp(128 - dx * 127, 0, 255)), Math.round(clamp(128 - dy * 127, 0, 255)), Math.round(clamp(255 - (Math.abs(dx) + Math.abs(dy)) * 35, 0, 255)), frame.pixels[offset + 3] ?? 0], offset); } return { ...frame, pixels }; }); const format = formatFor(frames, input.format); await this.codec.encode(frames, input.outputFilename, format); return outputMessage("generate_normal_map", input.inputFilename, input.outputFilename, frames.length, format);
    } catch (error) { return fail(error); }
  }

  public async generateRainOverlay(input: RainOverlayInput): Promise<AssetOperationResult> {
    try {
      assertDifferent(input.inputFilename, input.outputFilename);
      const color = rgba(input.color);
      const intensity = input.intensity ?? 0.55;
      const wind = input.wind ?? 0;
      if (!Number.isFinite(input.seed) || !Number.isInteger(input.seed)) throw new Error("Rain seed must be an integer");
      if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) throw new Error("Rain intensity must be between 0 and 1");
      if (!Number.isFinite(wind) || wind < -1 || wind > 1) throw new Error("Rain wind must be between -1 and 1");
      const source = await this.codec.decode(input.inputFilename);
      const frames = source.map((frame, frameIndex) => {
        const pixels = new Uint8ClampedArray(frame.pixels);
        const drops = Math.max(1, Math.round(frame.width * frame.height * 0.08 * intensity));
        const length = Math.max(2, Math.round(Math.min(frame.width, frame.height) * (0.16 + intensity * 0.2)));
        for (let drop = 0; drop < drops; drop += 1) {
          const base = hash(input.seed + frameIndex * 97, drop);
          const startX = Math.floor(base * frame.width);
          const startY = Math.floor(hash(input.seed + 193, drop) * frame.height);
          const drift = Math.round(wind * length);
          const alpha = Math.round(color[3] * (0.35 + hash(input.seed + 389, drop) * 0.65));
          for (let segment = 0; segment < length; segment += 1) {
            const x = startX + Math.round((drift * segment) / Math.max(1, length - 1));
            const y = startY + segment;
            setPixel(pixels, frame.width, frame.height, x, y, [color[0], color[1], color[2], alpha]);
          }
        }
        return { ...frame, pixels, delayMs: input.delayMs ?? frame.delayMs ?? 90 };
      });
      const format = formatFor(frames, input.format);
      await this.codec.encode(frames, input.outputFilename, format);
      return outputMessage("generate_rain_overlay", input.inputFilename, input.outputFilename, frames.length, format);
    } catch (error) { return fail(error); }
  }

  public async generateMotionPack(input: MotionPackInput): Promise<AssetOperationResult> {
    try {
      assertDifferent(input.inputFilename, input.outputFilename);
      if (!Number.isInteger(input.frames) || input.frames < 2 || input.frames > 24) throw new Error("Motion frame count must be an integer from 2 to 24");
      if (!Number.isInteger(input.seed)) throw new Error("Motion seed must be an integer");
      const amplitude = input.amplitude ?? 2;
      if (!Number.isFinite(amplitude) || amplitude < 0 || amplitude > 8) throw new Error("Motion amplitude must be between 0 and 8");
      const source = await this.codec.decode(input.inputFilename);
      const phaseOffset = Math.abs(input.seed) % input.frames;
      const frames = Array.from({ length: input.frames }, (_, frameIndex) => {
        const sourceFrame = source[frameIndex % source.length]!;
        const phase = (frameIndex + phaseOffset) / input.frames;
        const wave = Math.sin(phase * Math.PI * 2);
        const bounce = Math.abs(Math.sin(phase * Math.PI));
        const attack = phase < 0.5 ? phase * 2 : 2 - phase * 2;
        const offset = input.motion === "idle"
          ? { x: 0, y: Math.round(wave * amplitude * 0.35) }
          : input.motion === "walk"
            ? { x: Math.round(wave * amplitude * 0.2), y: Math.round(Math.abs(wave) * amplitude) }
            : input.motion === "run"
              ? { x: Math.round(wave * amplitude * 0.45), y: Math.round(Math.abs(wave) * amplitude * 1.35) }
              : input.motion === "jump"
                ? { x: Math.round(wave * amplitude * 0.2), y: -Math.round(bounce * amplitude * 2) }
                : { x: Math.round(attack * amplitude), y: Math.round(Math.abs(wave) * amplitude * 0.25) };
        const pixels = new Uint8ClampedArray(sourceFrame.width * sourceFrame.height * 4);
        for (let y = 0; y < sourceFrame.height; y += 1) for (let x = 0; x < sourceFrame.width; x += 1) {
          const sourceOffset = (y * sourceFrame.width + x) * 4;
          if ((sourceFrame.pixels[sourceOffset + 3] ?? 0) === 0) continue;
          setPixel(pixels, sourceFrame.width, sourceFrame.height, x + offset.x, y + offset.y, [sourceFrame.pixels[sourceOffset] ?? 0, sourceFrame.pixels[sourceOffset + 1] ?? 0, sourceFrame.pixels[sourceOffset + 2] ?? 0, sourceFrame.pixels[sourceOffset + 3] ?? 0]);
        }
        return { width: sourceFrame.width, height: sourceFrame.height, pixels, delayMs: input.delayMs ?? sourceFrame.delayMs ?? 90 };
      });
      const format = formatFor(frames, input.format);
      await this.codec.encode(frames, input.outputFilename, format);
      return outputMessage("generate_motion_pack", input.inputFilename, input.outputFilename, frames.length, format);
    } catch (error) { return fail(error); }
  }

  public async generateSeamlessTexture(input: SeamlessTextureInput): Promise<AssetOperationResult> {
    try {
      assertDifferent(input.inputFilename, input.outputFilename);
      const source = await this.codec.decode(input.inputFilename);
      const requestedWidth = input.seamWidth ?? 1;
      if (!Number.isInteger(requestedWidth) || requestedWidth < 1 || requestedWidth > 32) throw new Error("Seam width must be an integer from 1 to 32");
      const frames = source.map((frame) => {
        if (frame.width < 2 || frame.height < 2 || requestedWidth > Math.floor(Math.min(frame.width, frame.height) / 2)) throw new Error("Seam width must not exceed half of the smallest frame dimension");
        const seamWidth = requestedWidth;
        const pixels = new Uint8ClampedArray(frame.pixels);
        for (let y = 0; y < frame.height; y += 1) for (let band = 0; band < seamWidth; band += 1) {
          const leftOffset = (y * frame.width + band) * 4;
          const rightOffset = (y * frame.width + frame.width - 1 - band) * 4;
          const mixed = averagePixel(frame.pixels, frame.pixels, leftOffset, rightOffset);
          pixels.set(mixed, leftOffset); pixels.set(mixed, rightOffset);
        }
        for (let x = 0; x < frame.width; x += 1) for (let band = 0; band < seamWidth; band += 1) {
          const topOffset = (band * frame.width + x) * 4;
          const bottomOffset = ((frame.height - 1 - band) * frame.width + x) * 4;
          const mixed = averagePixel(pixels, pixels, topOffset, bottomOffset);
          pixels.set(mixed, topOffset); pixels.set(mixed, bottomOffset);
        }
        return { ...frame, pixels };
      });
      const format = formatFor(frames, input.format);
      await this.codec.encode(frames, input.outputFilename, format);
      return outputMessage("generate_seamless_texture", input.inputFilename, input.outputFilename, frames.length, format);
    } catch (error) { return fail(error); }
  }

  public async generateWaterReflection(input: WaterReflectionInput): Promise<AssetOperationResult> {
    try {
      assertDifferent(input.inputFilename, input.outputFilename);
      const source = await this.codec.decode(input.inputFilename);
      const firstFrame = source[0];
      if (!firstFrame) throw new Error("Water reflection requires at least one source frame");
      if (!Number.isInteger(input.waterline) || input.waterline < 1 || input.waterline >= firstFrame.height) throw new Error("Waterline must be an integer inside the frame");
      if (!Number.isInteger(input.frames) || input.frames < 2 || input.frames > 24) throw new Error("Reflection frames must be an integer from 2 to 24");
      const amplitude = input.amplitude ?? 1;
      if (!Number.isFinite(amplitude) || amplitude < 0 || amplitude > 8) throw new Error("Reflection amplitude must be between 0 and 8");
      const opacity = input.opacity ?? 0.6;
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new Error("Reflection opacity must be between 0 and 1");
      if (!Number.isInteger(input.seed)) throw new Error("Reflection seed must be an integer");
      if (input.delayMs !== undefined && (!Number.isInteger(input.delayMs) || input.delayMs <= 0)) throw new Error("Reflection delay must be a positive integer");
      const frames = Array.from({ length: input.frames }, (_, frameIndex) => {
        const sourceFrame = source[frameIndex % source.length] ?? firstFrame;
        const pixels = new Uint8ClampedArray(sourceFrame.pixels);
        const waterHeight = sourceFrame.height - input.waterline;
        const framePulse = (frameIndex + 1) / input.frames;
        let hasReflection = false;
        for (let y = 0; y < input.waterline; y += 1) for (let x = 0; x < sourceFrame.width; x += 1) {
          const sourceOffset = (y * sourceFrame.width + x) * 4;
          const sourceAlpha = sourceFrame.pixels[sourceOffset + 3] ?? 0;
          if (sourceAlpha === 0) continue;
          const reflectedY = input.waterline + (input.waterline - 1 - y);
          const wave = Math.round(Math.sin((x + input.seed * 0.37 + frameIndex * 1.35) * 0.72) * amplitude);
          const ripple = Math.round(Math.sin((y + input.seed + frameIndex) * 0.81) * amplitude * 0.25);
          const targetY = Math.max(input.waterline, reflectedY + ripple);
          if (targetY >= sourceFrame.height) continue;
          const fade = clamp(1 - (targetY - input.waterline) / Math.max(1, waterHeight), 0, 1);
          const reflectedAlpha = Math.max(1, Math.round(sourceAlpha * opacity * fade * framePulse));
          compositePixel(pixels, sourceFrame.width, sourceFrame.height, x + wave, targetY, [sourceFrame.pixels[sourceOffset] ?? 0, sourceFrame.pixels[sourceOffset + 1] ?? 0, sourceFrame.pixels[sourceOffset + 2] ?? 0, reflectedAlpha]);
          hasReflection = true;
        }
        if (hasReflection && opacity > 0) {
          const shimmerX = Math.abs((input.seed * 31 + frameIndex * 3) % sourceFrame.width);
          const shimmerY = input.waterline + Math.abs((input.seed + frameIndex) % waterHeight);
          compositePixel(pixels, sourceFrame.width, sourceFrame.height, shimmerX, shimmerY, [220, 240, 255, 255]);
        }
        return { width: sourceFrame.width, height: sourceFrame.height, pixels, delayMs: input.delayMs ?? sourceFrame.delayMs ?? 90 };
      });
      const format = formatFor(frames, input.format);
      await this.codec.encode(frames, input.outputFilename, format);
      return outputMessage("generate_water_reflection", input.inputFilename, input.outputFilename, frames.length, format);
    } catch (error) { return fail(error); }
  }

  public async generateWaterCaustics(input: WaterCausticsInput): Promise<AssetOperationResult> {
    try {
      assertDifferent(input.inputFilename, input.outputFilename);
      const color = rgba(input.color);
      const source = await this.codec.decode(input.inputFilename);
      const firstFrame = source[0];
      if (!firstFrame) throw new Error("Water caustics requires at least one source frame");
      if (!Number.isInteger(input.frames) || input.frames < 2 || input.frames > 24) throw new Error("Caustics frames must be an integer from 2 to 24");
      const intensity = input.intensity ?? 0.7;
      if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) throw new Error("Caustics intensity must be between 0 and 1");
      const scale = input.scale ?? 4;
      if (!Number.isInteger(scale) || scale < 1 || scale > 32) throw new Error("Caustics scale must be an integer from 1 to 32");
      if (!Number.isInteger(input.seed)) throw new Error("Caustics seed must be an integer");
      if (input.delayMs !== undefined && (!Number.isInteger(input.delayMs) || input.delayMs <= 0)) throw new Error("Caustics delay must be a positive integer");
      const frames = Array.from({ length: input.frames }, (_, frameIndex) => {
        const sourceFrame = source[frameIndex % source.length] ?? firstFrame;
        const pixels = new Uint8ClampedArray(sourceFrame.pixels);
        let firstOpaque: [number, number] | null = null;
        for (let y = 0; y < sourceFrame.height; y += 1) for (let x = 0; x < sourceFrame.width; x += 1) {
          const offset = (y * sourceFrame.width + x) * 4;
          if ((sourceFrame.pixels[offset + 3] ?? 0) === 0) continue;
          firstOpaque ??= [x, y];
          const phaseX = (x + frameIndex * 1.7 + input.seed * 0.41) / scale;
          const phaseY = (y - frameIndex * 1.25 + input.seed * 0.23) / scale;
          const wave = (Math.sin(phaseX * 2.15 + Math.sin(phaseY)) + Math.sin(phaseY * 1.75 + Math.cos(phaseX * 1.3))) / 2;
          const ridge = clamp((Math.abs(wave) - 0.48) * 2.7, 0, 1);
          if (ridge > 0) overlayPixel(pixels, sourceFrame.width, sourceFrame.height, x, y, color, intensity * ridge * 0.82);
        }
        if (firstOpaque && intensity > 0) {
          let markerX = Math.abs((input.seed * 13 + frameIndex * 3) % sourceFrame.width);
          let markerY = Math.abs((input.seed * 7 + frameIndex * 2) % sourceFrame.height);
          if ((pixels[(markerY * sourceFrame.width + markerX) * 4 + 3] ?? 0) === 0) [markerX, markerY] = firstOpaque;
          overlayPixel(pixels, sourceFrame.width, sourceFrame.height, markerX, markerY, color, Math.min(1, 0.35 + intensity * 0.65));
        }
        return { width: sourceFrame.width, height: sourceFrame.height, pixels, delayMs: input.delayMs ?? sourceFrame.delayMs ?? 90 };
      });
      const format = formatFor(frames, input.format);
      await this.codec.encode(frames, input.outputFilename, format);
      return outputMessage("generate_water_caustics", input.inputFilename, input.outputFilename, frames.length, format);
    } catch (error) { return fail(error); }
  }

  public async generateDayNightCycle(input: DayNightCycleInput): Promise<AssetOperationResult> {
    try {
      assertDifferent(input.inputFilename, input.outputFilename);
      const source = await this.codec.decode(input.inputFilename);
      const firstFrame = source[0];
      if (!firstFrame) throw new Error("Day-night cycle requires at least one source frame");
      if (!Number.isInteger(input.frames) || input.frames < 4 || input.frames > 24) throw new Error("Day-night frames must be an integer from 4 to 24");
      const intensity = input.intensity ?? 0.8;
      if (!Number.isFinite(intensity) || intensity < 0.05 || intensity > 1) throw new Error("Day-night intensity must be between 0.05 and 1");
      if (!Number.isInteger(input.seed)) throw new Error("Day-night seed must be an integer");
      if (input.delayMs !== undefined && (!Number.isInteger(input.delayMs) || input.delayMs <= 0)) throw new Error("Day-night delay must be a positive integer");
      const anchors: Array<{ color: [number, number, number]; strength: number }> = [
        { color: [255, 255, 245], strength: 0.05 },
        { color: [255, 155, 82], strength: 0.24 },
        { color: [64, 82, 160], strength: 0.42 },
        { color: [255, 190, 116], strength: 0.22 },
      ];
      const stages = ["day", "sunset", "night", "sunrise"] as const;
      const frames = Array.from({ length: input.frames }, (_, frameIndex) => {
        const sourceFrame = source[frameIndex % source.length] ?? firstFrame;
        const pixels = new Uint8ClampedArray(sourceFrame.pixels);
        const cyclePosition = (frameIndex / input.frames) * anchors.length;
        const leftIndex = Math.floor(cyclePosition) % anchors.length;
        const rightIndex = (leftIndex + 1) % anchors.length;
        const progress = cyclePosition - Math.floor(cyclePosition);
        const tint = interpolateRgb(anchors[leftIndex]!.color, anchors[rightIndex]!.color, progress);
        const tintStrength = anchors[leftIndex]!.strength + (anchors[rightIndex]!.strength - anchors[leftIndex]!.strength) * progress;
        for (let y = 0; y < sourceFrame.height; y += 1) for (let x = 0; x < sourceFrame.width; x += 1) {
          const offset = (y * sourceFrame.width + x) * 4;
          if ((sourceFrame.pixels[offset + 3] ?? 0) === 0) continue;
          const variation = (hash(input.seed + frameIndex * 97, x + y * sourceFrame.width) - 0.5) * 0.06;
          const mix = clamp(intensity * (tintStrength + variation), 0, 0.8);
          for (let channel = 0; channel < 3; channel += 1) pixels[offset + channel] = Math.round((sourceFrame.pixels[offset + channel] ?? 0) * (1 - mix) + tint[channel]! * mix);
        }
        return { ...sourceFrame, pixels, delayMs: input.delayMs ?? sourceFrame.delayMs ?? 90 };
      });
      const format = formatFor(frames, input.format);
      await this.codec.encode(frames, input.outputFilename, format);
      return ok({ operation: "generate_day_night_cycle", input: input.inputFilename, output: input.outputFilename, frames: frames.length, format, stages, deterministic: true, sourcePreserved: true });
    } catch (error) { return fail(error); }
  }
}
