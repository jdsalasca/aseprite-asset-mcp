import type { AssetRuntimePort } from "../../domain/asset-operations.js";
import { AsepriteAnimationAdapter } from "./AsepriteAnimationAdapter.js";
import { AsepriteCommandAdapter } from "./AsepriteCommandAdapter.js";
import { AsepriteDrawingAdapter } from "./AsepriteDrawingAdapter.js";
import { AsepriteEffectsAdapter } from "./AsepriteEffectsAdapter.js";
import { AsepriteExportAdapter } from "./AsepriteExportAdapter.js";
import { AsepriteLayerAdapter } from "./AsepriteLayerAdapter.js";
import { AsepritePaletteAdapter } from "./AsepritePaletteAdapter.js";
import { AsepriteSceneAdapter } from "./AsepriteSceneAdapter.js";
import { AsepriteTextAdapter } from "./AsepriteTextAdapter.js";
import type { AsepriteCliGatewayOptions } from "./AsepriteCommandAdapter.js";

function bindAdapterMethods(target: Record<string, unknown>, adapter: object): void {
  for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(adapter))) {
    if (name === "constructor") continue;
    const operation = (adapter as Record<string, unknown>)[name];
    if (typeof operation === "function") target[name] = operation.bind(adapter);
  }
}

/**
 * Concrete composition adapter. Capability implementations own the CLI details;
 * this class only exposes their bound methods through the stable runtime port.
 */
export class AsepriteCliGateway {
  public constructor(options: AsepriteCliGatewayOptions = {}) {
    const target = this as unknown as Record<string, unknown>;
    const adapters = [
      new AsepriteLayerAdapter(options),
      new AsepriteDrawingAdapter(options),
      new AsepriteExportAdapter(options),
      new AsepritePaletteAdapter(options),
      new AsepriteTextAdapter(options),
      new AsepriteAnimationAdapter(options),
      new AsepriteEffectsAdapter(options),
      new AsepriteSceneAdapter(options),
    ];
    for (const adapter of adapters) bindAdapterMethods(target, adapter);
  }
}

export interface AsepriteCliGateway extends AssetRuntimePort {}
