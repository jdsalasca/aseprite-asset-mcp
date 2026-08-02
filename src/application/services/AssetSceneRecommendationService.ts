import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { AssetLibraryItem } from "../../domain/asset-library.js";
import type { AssetLibraryPort } from "../ports/AssetLibraryPort.js";
import type { AssetSceneRecommendation, AssetSceneRecommendationInput, AssetSceneRecommendationResult } from "../../domain/asset-scene-recommendations.js";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 24;
const normalize = (value: string): string => value.trim().toLocaleLowerCase();
const words = (value: string | undefined): string[] => [...new Set((value ?? "").toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).map((part) => part.trim()).filter((part) => part.length > 1))];
const boundedList = (values: string[] | undefined): string[] => [...new Set((values ?? []).map(normalize).filter(Boolean))];
function hash(value: string): number { let result = 2166136261; for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619); return result >>> 0; }
function haystack(item: AssetLibraryItem): string { return [item.id, item.title, item.category, item.description, ...item.tags, ...item.variants].join(" ").toLocaleLowerCase(); }

function rank(item: AssetLibraryItem, input: { promptWords: string[]; category: string; kinds: string[]; tags: string[]; variants: string[]; seed: number }): AssetSceneRecommendation {
  const itemTags = item.tags.map(normalize); const itemVariants = item.variants.map(normalize); const text = haystack(item); let score = 0; const reasons: string[] = [];
  for (const word of input.promptWords) if (text.includes(word)) { score += 6; reasons.push(`prompt:${word}`); }
  if (input.category && normalize(item.category) === input.category) { score += 8; reasons.push(`category:${item.category}`); }
  for (const kind of input.kinds) if (item.kind === kind) { score += 10; reasons.push(`kind:${kind}`); }
  for (const tag of input.tags) if (itemTags.includes(tag)) { score += 12; reasons.push(`tag:${tag}`); }
  for (const variant of input.variants) if (itemVariants.includes(variant)) { score += 9; reasons.push(`variant:${variant}`); }
  if (reasons.length === 0) reasons.push("catalog:stable-fallback");
  return { assetId: item.id, title: item.title, category: item.category, kind: item.kind, score, reasons, tags: item.tags.slice(0, 8), variants: item.variants.slice(0, 8) };
}

export class AssetSceneRecommendationService {
  public constructor(private readonly port: AssetLibraryPort) {}

  public async recommend(input: AssetSceneRecommendationInput): Promise<AssetOperationResult> {
    try {
      if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > MAX_LIMIT)) throw new Error("Recommendation limit must be an integer from 1 to 24");
      const limit = input.limit ?? DEFAULT_LIMIT;
      const seed = Number.isInteger(input.seed) ? input.seed ?? 1 : 1;
      if (!Number.isInteger(input.limit) && input.limit !== undefined) throw new Error("Recommendation limit must be an integer");
      if (!Number.isInteger(input.seed) && input.seed !== undefined) throw new Error("Recommendation seed must be an integer");
      const prompt = (input.prompt ?? "").trim(); const category = normalize(input.category ?? ""); const requiredKinds = [...new Set(input.requiredKinds ?? [])]; const requiredTags = boundedList(input.requiredTags); const requiredVariants = boundedList(input.requiredVariants);
      if (!prompt && !category && requiredKinds.length === 0 && requiredTags.length === 0 && requiredVariants.length === 0) throw new Error("Recommendation requires a prompt, category, kind, tag, or variant");
      if (requiredKinds.some((kind) => !["sprite", "tileset", "scene", "effect", "character", "prop"].includes(kind))) throw new Error("Recommendation contains an unsupported asset kind");
      const catalog = await this.port.load();
      const ranked = catalog.items.map((item) => rank(item, { promptWords: words(prompt), category, kinds: requiredKinds, tags: requiredTags, variants: requiredVariants, seed })).filter((item) => !category || normalize(item.category) === category).sort((left, right) => right.score - left.score || hash(`${seed}:${left.assetId}`) - hash(`${seed}:${right.assetId}`) || left.assetId.localeCompare(right.assetId)).slice(0, limit);
      const payload: AssetSceneRecommendationResult = { operation: "recommend_asset_scene", libraryVersion: catalog.libraryVersion, input: { ...(prompt ? { prompt } : {}), ...(category ? { category } : {}), ...(requiredKinds.length ? { requiredKinds } : {}), ...(requiredTags.length ? { requiredTags } : {}), ...(requiredVariants.length ? { requiredVariants } : {}), limit, seed }, recommendations: ranked, suggestedItemIds: ranked.map((item) => item.assetId), coveredKinds: [...new Set(ranked.map((item) => item.kind))], coveredTags: [...new Set(ranked.flatMap((item) => item.tags))].sort(), coveredVariants: [...new Set(ranked.flatMap((item) => item.variants))].sort(), deterministic: true, sourcePreserved: true };
      return { ok: true, message: JSON.stringify(payload) };
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
  }
}
