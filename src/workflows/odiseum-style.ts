import type { AnimationTagSpec } from "./types.js";

export const ODISEUM_STYLE_PALETTE = [
  "#17152E",
  "#27335F",
  "#3D5A80",
  "#6CE1D2",
  "#F7F2E5",
  "#F5D76E",
  "#F6C3A2",
  "#D86C74",
] as const;

export const ODISEUM_IDLE_ANIMATION: AnimationTagSpec = {
  name: "idle",
  fromFrame: 1,
  toFrame: 4,
  direction: "pingpong",
};

export interface OdiseumStyleManifest {
  palette: readonly string[];
  animations: readonly AnimationTagSpec[];
  worldProps: {
    frameCount: number;
    frameSize: number;
    exportScale: number;
  };
  portalAnimation: AnimationTagSpec;
  starfallCrystal: {
    frameCount: number;
    frameSize: number;
    exportScale: number;
  };
  reusableLibrary: {
    name: string;
    frameCount: number;
    frameSize: number;
    exportScale: number;
  };
  pixelScale: number;
  nearestFilter: true;
}

export function buildOdiseumStyleManifest(): OdiseumStyleManifest {
  return {
    palette: ODISEUM_STYLE_PALETTE,
    animations: [ODISEUM_IDLE_ANIMATION],
    worldProps: {
      frameCount: 6,
      frameSize: 32,
      exportScale: 3,
    },
    portalAnimation: {
      name: "portal",
      fromFrame: 1,
      toFrame: 4,
      direction: "pingpong",
    },
    starfallCrystal: {
      frameCount: 4,
      frameSize: 32,
      exportScale: 3,
    },
    reusableLibrary: {
      name: "odiseum-cozy-kit",
      frameCount: 8,
      frameSize: 48,
      exportScale: 2,
    },
    pixelScale: 3,
    nearestFilter: true,
  };
}
