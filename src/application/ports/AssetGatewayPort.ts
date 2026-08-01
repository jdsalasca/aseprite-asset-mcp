import type { AssetGatewayPort as CompositeAssetGatewayPort } from "./AssetCapabilityPorts.js";

/**
 * Generic application-facing asset port.
 * Concrete runtimes such as Aseprite belong in infrastructure adapters.
 */
export type AssetGatewayPort = CompositeAssetGatewayPort;
