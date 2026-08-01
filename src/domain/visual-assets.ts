import type { AsepriteResult } from "./aseprite.js";

export type DetailLevel = "low" | "medium" | "high";
export type TerrainKind = "water" | "sand" | "grass" | "rock" | "snow" | "mud";

export interface StyleBible {
  id: string;
  baseSize: number;
  palette: string[];
  outlineColor: string;
  lightDirection: "north" | "south" | "east" | "west" | "north_east" | "north_west" | "south_east" | "south_west";
  detailLevel: DetailLevel;
  seed: number;
  materials: Record<string, string[]>;
}

export interface StyleBibleInput {
  filename: string;
  style: StyleBible;
}

export interface ReferenceAnalysis {
  filename: string;
  width: number;
  height: number;
  frames: number;
  dominantColors: Array<{ color: string; count: number }>;
  averageLuminance: number;
  contrast: number;
  edgeDensity: number;
  transparencyRatio: number;
}

export interface QualityGateInput {
  filename: string;
  maxColors?: number | undefined;
  maxIsolatedPixels?: number | undefined;
  minContrast?: number | undefined;
  maxBandingRuns?: number | undefined;
}

export interface TerrainTilesetInput {
  outputFilename: string;
  manifestFilename: string;
  tileSize: number;
  terrains: TerrainKind[];
  seed?: number | undefined;
  style?: Partial<Pick<StyleBible, "palette" | "outlineColor">> | undefined;
}

export interface WorldMapInput {
  mapFilename: string;
  previewFilename?: string | undefined;
  width: number;
  height: number;
  seed: number;
  biomes: TerrainKind[];
  detailLevel?: DetailLevel | undefined;
  landmarkCount?: number | undefined;
}

export interface BeachSceneInput extends WorldMapInput {
  waveFilename: string;
  waveFrames?: number | undefined;
  waveDelayMs?: number | undefined;
}

export interface TimeOfDayInput {
  inputFilename: string;
  outputFilename: string;
  manifestFilename?: string | undefined;
  steps?: number | undefined;
  delayMs?: number | undefined;
}

export type EnvironmentKind = "beach" | "forest" | "village" | "cave";

export interface EnvironmentPackInput {
  kind: EnvironmentKind;
  outputPrefix: string;
  width: number;
  height: number;
  seed: number;
  tileSize?: number | undefined;
  detailLevel?: DetailLevel | undefined;
}

export interface VisualAssetGateway {
  createStyleBible(input: StyleBibleInput): Promise<AsepriteResult>;
  inspectReference(filename: string): Promise<AsepriteResult>;
  runQualityGate(input: QualityGateInput): Promise<AsepriteResult>;
  buildTerrainTileset(input: TerrainTilesetInput): Promise<AsepriteResult>;
  generateWorldMap(input: WorldMapInput): Promise<AsepriteResult>;
  generateBeachScene(input: BeachSceneInput): Promise<AsepriteResult>;
  generateTimeOfDayPack(input: TimeOfDayInput): Promise<AsepriteResult>;
  generateEnvironmentPack(input: EnvironmentPackInput): Promise<AsepriteResult>;
}
