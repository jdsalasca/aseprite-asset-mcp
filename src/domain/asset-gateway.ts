import type { AsepriteGateway } from "./aseprite.js";

/** Generic asset runtime contract. Concrete engines implement this shape in adapters. */
export type AssetGateway = AsepriteGateway;
