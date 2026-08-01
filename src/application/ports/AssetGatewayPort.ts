import type { AsepriteGateway } from "../../domain/aseprite.js";

/**
 * Generic application-facing asset port.
 * Concrete runtimes such as Aseprite belong in infrastructure adapters.
 */
export type AssetGatewayPort = AsepriteGateway;
