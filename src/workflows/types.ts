export type ToolArguments = Record<string, unknown>;

export interface ToolCall {
  name: string;
  arguments: ToolArguments;
  purpose: string;
}

export interface AnimationTagSpec {
  name: string;
  fromFrame: number;
  toFrame: number;
  direction?: "forward" | "reverse" | "pingpong" | "pingpong_reverse";
}

export interface ExportArtifact {
  name: string;
  imagePath: string;
  dataPath: string;
  tagName?: string;
}

export interface GodotAnimationManifest {
  name: string;
  fromFrame: number;
  toFrame: number;
  loop: boolean;
}

export interface GodotAssetManifest {
  schemaVersion: 1;
  assetId: string;
  assetType: "character" | "scene";
  texture: string;
  frameWidth: number;
  frameHeight: number;
  animations: GodotAnimationManifest[];
}

export interface WorkflowPlan {
  schemaVersion: 1;
  kind: "character" | "scene";
  assetId: string;
  sourceFile: string;
  calls: ToolCall[];
  exports: ExportArtifact[];
  godotManifest: GodotAssetManifest;
}

export interface CharacterSpec {
  assetId: string;
  width?: number;
  height?: number;
  outputDirectory?: string;
  sourceFile?: string;
  palette?: string[];
  layers?: string[];
  animations?: AnimationTagSpec[];
  scale?: number;
}

export interface SceneSpec {
  assetId: string;
  width?: number;
  height?: number;
  tileWidth?: number;
  tileHeight?: number;
  outputDirectory?: string;
  sourceFile?: string;
  palette?: string[];
  layers?: string[];
  animations?: AnimationTagSpec[];
  scale?: number;
}
