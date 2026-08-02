import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { RasterCodec } from "../../domain/image-assets.js";
import type { RasterFrame } from "../../domain/pixel-art.js";
import type { ColorGradeInput, MotionPackInput, NormalMapInput, ParticleBurstInput, PixelOutlineInput, RainOverlayInput, SpriteEffectFormat, SpriteEffectsGateway, SpriteShadowInput } from "../../domain/sprite-effects.js";

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
function outputMessage(operation: string, input: string | null, output: string, frames: number, format: SpriteEffectFormat): AssetOperationResult { return ok({ operation, ...(input ? { input } : {}), output, frames, format, deterministic: true, sourcePreserved: true }); }

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
}
