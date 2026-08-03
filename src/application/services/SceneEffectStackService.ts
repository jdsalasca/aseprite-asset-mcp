import path from "node:path";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { RasterCodec } from "../../domain/image-assets.js";
import type { SpriteEffectsGateway } from "../../domain/sprite-effects.js";
import type { SceneEffectArtifact, SceneEffectKind, SceneEffectStackGateway, SceneEffectStackInput } from "../../domain/scene-effect-stack.js";
import type { VisualAssetGateway } from "../../domain/visual-assets.js";

function ok(value: unknown): AssetOperationResult { return { ok: true, message: JSON.stringify(value) }; }
function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }

const EFFECTS: readonly SceneEffectKind[] = ["rain", "fog", "snow", "smoke", "fire", "lightning", "waves", "water_spray", "dust", "water_reflection", "water_caustics", "wind_sway", "sprite_shadow", "sprite_glow", "day_night", "material_texture", "depth_lighting", "particles"];

export class SceneEffectStackService implements SceneEffectStackGateway {
  public constructor(private readonly codec: RasterCodec, private readonly effects: SpriteEffectsGateway, private readonly visual: Pick<VisualAssetGateway, "applyMaterialTexture" | "applyDepthLighting">) {}

  public async generateSceneEffectStack(input: SceneEffectStackInput): Promise<AssetOperationResult> {
    try {
      this.validate(input);
      const source = await this.codec.decode(input.inputFilename);
      const firstFrame = source[0];
      if (!firstFrame) throw new Error("Scene effect stack requires at least one source frame");
      const prefix = input.outputPrefix.replace(/\.(?:png|gif|webp|aseprite)$/i, "");
      const artifacts: SceneEffectArtifact[] = [];
      for (const effect of input.effects) {
        const outputFormat = effect === "particles" ? "gif" : (input.format ?? "gif");
        const outputFilename = `${prefix}-${effect}.${outputFormat}`;
        const generated = await this.generateOne(effect, input, firstFrame.width, firstFrame.height, outputFilename, outputFormat);
        if (!generated.ok) throw new Error(generated.message);
        const payload = this.readPayload(generated.message);
        artifacts.push({ effect, outputFilename, operation: String(payload.operation ?? `scene_${effect}`), frames: Number(payload.frames ?? (effect === "particles" ? input.frames : 1)), format: outputFormat, deterministic: true, sourcePreserved: true });
      }
      return ok({ operation: "generate_scene_effect_stack", input: input.inputFilename, outputPrefix: prefix, seed: input.seed, effects: input.effects, artifacts, deterministic: true, sourcePreserved: true });
    } catch (error) { return fail(error); }
  }

  private async generateOne(effect: SceneEffectKind, input: SceneEffectStackInput, width: number, height: number, outputFilename: string, format: "png" | "gif"): Promise<AssetOperationResult> {
    const delayMs = input.delayMs ?? 90;
    if (effect === "rain") return this.effects.generateRainOverlay({ inputFilename: input.inputFilename, outputFilename, seed: input.seed, intensity: 0.7, wind: 0.12, color: "#B7D7FF", frames: input.frames, delayMs, format });
    if (effect === "fog") return this.effects.generateFogOverlay({ inputFilename: input.inputFilename, outputFilename, seed: input.seed, density: 0.65, drift: 0.1, color: "#DDEBFF", frames: input.frames, delayMs, format });
    if (effect === "snow") return this.effects.generateSnowOverlay({ inputFilename: input.inputFilename, outputFilename, seed: input.seed, density: 0.7, wind: -0.12, color: "#F5FBFF", frames: input.frames, delayMs, format });
    if (effect === "smoke") return this.effects.generateSmokeOverlay({ inputFilename: input.inputFilename, outputFilename, seed: input.seed, density: 0.62, drift: 0.08, rise: 0.65, color: "#8A91A8", frames: input.frames, delayMs, format });
    if (effect === "fire") return this.effects.generateFireOverlay({ inputFilename: input.inputFilename, outputFilename, seed: input.seed, intensity: 0.72, flicker: 0.65, color: "#FFD65A", frames: input.frames, delayMs, format });
    if (effect === "lightning") return this.effects.generateLightningOverlay({ inputFilename: input.inputFilename, outputFilename, seed: input.seed, intensity: 0.72, flash: 0.8, color: "#D8F3FF", frames: input.frames, delayMs, format });
    if (effect === "waves") return this.effects.generateWaveOverlay({ inputFilename: input.inputFilename, outputFilename, seed: input.seed, density: 0.72, amplitude: 2, color: "#E6FAFF", frames: input.frames, delayMs, format });
    if (effect === "water_spray") return this.effects.generateWaterSpray({ inputFilename: input.inputFilename, outputFilename, seed: input.seed, density: 0.65, drift: 0.18, color: "#F4FDFF", frames: input.frames, delayMs, format });
    if (effect === "dust") return this.effects.generateDustOverlay({ inputFilename: input.inputFilename, outputFilename, seed: input.seed, density: 0.65, drift: 0.12, rise: 0.5, color: "#C79A68", frames: input.frames, delayMs, format });
    if (effect === "water_reflection") return this.effects.generateWaterReflection({ inputFilename: input.inputFilename, outputFilename, waterline: Math.max(1, Math.floor(height * 0.55)), frames: input.frames, seed: input.seed, amplitude: 1, opacity: 0.6, delayMs, format });
    if (effect === "water_caustics") return this.effects.generateWaterCaustics({ inputFilename: input.inputFilename, outputFilename, frames: input.frames, seed: input.seed, intensity: 0.7, scale: 4, color: "#DFF6FF", delayMs, format });
    if (effect === "wind_sway") return this.effects.generateWindSway({ inputFilename: input.inputFilename, outputFilename, frames: input.frames, seed: input.seed, amplitude: 2, direction: "right", delayMs, format });
    if (effect === "sprite_shadow") return this.effects.generateSpriteShadow({ inputFilename: input.inputFilename, outputFilename, offsetX: 2, offsetY: 2, color: "#111827", opacity: 0.45, format });
    if (effect === "sprite_glow") return this.effects.generateSpriteGlow({ inputFilename: input.inputFilename, outputFilename, color: "#FFD166", radius: 2, opacity: 0.65, format });
    if (effect === "day_night") return this.effects.generateDayNightCycle({ inputFilename: input.inputFilename, outputFilename, frames: input.frames, seed: input.seed, intensity: 0.8, delayMs, format });
    if (effect === "material_texture") return this.visual.applyMaterialTexture({ inputFilename: input.inputFilename, outputFilename, material: input.material ?? "earth", seed: input.seed, intensity: 0.6, format });
    if (effect === "depth_lighting") return this.visual.applyDepthLighting({ inputFilename: input.inputFilename, outputFilename, direction: input.direction ?? "south_east", strength: 0.7, ambient: 0.35, format });
    return this.effects.generateParticleBurst({ outputFilename, width, height, frames: input.frames, particleCount: input.particleCount ?? Math.max(1, Math.min(128, Math.floor(width * height / 32))), seed: input.seed, color: input.particleColor ?? "#DFF6FF", delayMs });
  }

  private readPayload(message: string): Record<string, unknown> {
    try { const payload: unknown = JSON.parse(message); return payload && typeof payload === "object" ? payload as Record<string, unknown> : {}; } catch { return {}; }
  }

  private validate(input: SceneEffectStackInput): void {
    if (!input.inputFilename.trim() || !input.outputPrefix.trim()) throw new Error("Scene effect stack filenames are required");
    if (input.inputFilename.includes("\0") || input.outputPrefix.includes("\0")) throw new Error("Scene effect stack filenames cannot contain null bytes");
    if (/(^|[\\/])\.\.([\\/]|$)/.test(input.outputPrefix)) throw new Error("Scene effect stack output prefix cannot contain traversal segments");
    if (path.resolve(input.inputFilename).toLowerCase() === path.resolve(input.outputPrefix).toLowerCase()) throw new Error("Scene effect stack input and output prefix must be different");
    if (!Array.isArray(input.effects) || input.effects.length < 1 || input.effects.length > EFFECTS.length) throw new Error(`Scene effect stack requires between 1 and ${EFFECTS.length} effects`);
    if (input.effects.some((effect) => !EFFECTS.includes(effect))) throw new Error("Scene effect stack contains an unsupported effect");
    if (new Set(input.effects).size !== input.effects.length) throw new Error("Scene effect stack effects must be unique");
    if (!Number.isInteger(input.frames) || input.frames < 2 || input.frames > 24) throw new Error("Scene effect stack frames must be an integer from 2 to 24");
    if (!Number.isInteger(input.seed)) throw new Error("Scene effect stack seed must be an integer");
    if (input.delayMs !== undefined && (!Number.isInteger(input.delayMs) || input.delayMs <= 0)) throw new Error("Scene effect stack delay must be a positive integer");
    if (input.particleCount !== undefined && (!Number.isInteger(input.particleCount) || input.particleCount < 1 || input.particleCount > 128)) throw new Error("Scene effect stack particle count must be an integer from 1 to 128");
  }
}
