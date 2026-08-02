import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetPresetGenerationGateway, AssetPresetGenerationInput, EnvironmentGenerationPort } from "../../domain/asset-preset-generation.js";
import type { AssetLibraryService } from "./AssetLibraryService.js";

function ok(value: unknown): AssetOperationResult { return { ok: true, message: JSON.stringify(value) }; }
function fail(error: unknown): AssetOperationResult { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }

const ENVIRONMENT_BY_PRESET: Record<string, "beach" | "forest" | "village" | "cave"> = {
  "coastal-sunset": "beach",
  "living-forest": "forest",
  "rainy-village": "village",
  "fantasy-quest": "cave",
};

export class AssetPresetGenerationService implements AssetPresetGenerationGateway {
  public constructor(private readonly library: AssetLibraryService, private readonly environment: EnvironmentGenerationPort) {}

  public async generate(input: AssetPresetGenerationInput): Promise<AssetOperationResult> {
    try {
      if (!input.presetId.trim() || !input.outputPrefix.trim()) throw new Error("Preset id and output prefix are required");
      if (input.presetId.includes("\0") || input.outputPrefix.includes("\0")) throw new Error("Preset identifiers cannot contain null bytes");
      if (/(^|[\\/])\.\.([\\/]|$)/.test(input.outputPrefix)) throw new Error("Preset output prefix cannot contain traversal segments");
      if (!Number.isInteger(input.seed)) throw new Error("Preset seed must be an integer");
      const preset = await this.library.preset(input.presetId);
      if (!preset) throw new Error(`Asset preset not found: ${input.presetId}`);
      const environmentKind = ENVIRONMENT_BY_PRESET[preset.id.toLowerCase()];
      if (!environmentKind) throw new Error(`Asset preset has no executable environment mapping: ${preset.id}`);
      const composition = await this.library.composePreset(preset.id);
      if (!composition) throw new Error(`Asset preset composition not found: ${preset.id}`);
      const generated = await this.environment.generateEnvironmentPack({ kind: environmentKind, outputPrefix: input.outputPrefix, width: input.width, height: input.height, seed: input.seed, ...(input.tileSize === undefined ? {} : { tileSize: input.tileSize }), ...(input.detailLevel === undefined ? {} : { detailLevel: input.detailLevel }) });
      if (!generated.ok) return generated;
      let generation: unknown;
      try { generation = JSON.parse(generated.message); } catch { generation = { message: generated.message }; }
      return ok({ operation: "generate_asset_preset", presetId: preset.id, environmentKind, composition, generation, deterministic: true, sourcePreserved: true });
    } catch (error) { return fail(error); }
  }
}
