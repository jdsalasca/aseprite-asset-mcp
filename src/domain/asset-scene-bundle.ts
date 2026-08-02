import type { AssetSceneAnimationCompositionInput, AssetSceneAnimationCompositionResult, AssetSceneCompositionInput, AssetSceneCompositionResult } from "./asset-library.js";

export interface AssetSceneBundleInput { itemIds: string[]; outputPrefix: string; width: number; height: number; padding?: number; frames: number; delayMs?: number; }
export interface AssetSceneBundleResult { operation: "build_scene_bundle"; outputPrefix: string; itemIds: string[]; static: AssetSceneCompositionResult; animation: AssetSceneAnimationCompositionResult; deterministic: true; sourcePreserved: true; }
export interface AssetSceneBundleGateway { build(input: AssetSceneBundleInput): Promise<{ ok: boolean; message: string }>; }
export type AssetSceneBundleStaticInput = AssetSceneCompositionInput;
export type AssetSceneBundleAnimationInput = AssetSceneAnimationCompositionInput;
