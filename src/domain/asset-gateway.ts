import type { AssetRuntimePort } from "./asset-operations.js";

/** Generic asset runtime contract. Concrete engines implement this shape in adapters. */
export type AssetGateway = AssetRuntimePort;
