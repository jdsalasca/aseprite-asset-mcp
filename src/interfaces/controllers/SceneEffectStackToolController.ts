import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AssetOperationResult } from "../../domain/asset-operations.js";
import type { SceneEffectStackGateway } from "../../domain/scene-effect-stack.js";

const effects = ["rain", "fog", "water_reflection", "water_caustics", "wind_sway", "sprite_shadow", "sprite_glow", "day_night", "material_texture", "depth_lighting", "particles"] as const;
const materials = ["water", "earth", "grass", "stone", "snow"] as const;
const directions = ["north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west"] as const;

export class SceneEffectStackToolController {
  public constructor(private readonly stack: SceneEffectStackGateway) {}
  public register(server: McpServer): void {
    server.registerTool("generate_scene_effect_stack", { description: "Generate a deterministic compact package of selected scene effects while preserving the source: rain, fog, wind sway, shadow, glow, particles, water motion, day/night, material grain, and directional lighting.", inputSchema: { input_filename: z.string().min(1), output_prefix: z.string().min(1), effects: z.array(z.enum(effects)).min(1).max(11), frames: z.number().int().min(2).max(24).default(8), seed: z.number().int().default(1), delay_ms: z.number().int().positive().default(90), material: z.enum(materials).default("earth"), direction: z.enum(directions).default("south_east"), particle_count: z.number().int().min(1).max(128).optional(), particle_color: z.string().regex(/^#?(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/).optional(), format: z.enum(["png", "gif"]).default("gif") } }, async ({ input_filename, output_prefix, effects, frames, seed, delay_ms, material, direction, particle_count, particle_color, format }) => this.result(await this.stack.generateSceneEffectStack({ inputFilename: input_filename, outputPrefix: output_prefix, effects: [...effects], frames, seed, delayMs: delay_ms, material, direction, ...(particle_count === undefined ? {} : { particleCount: particle_count }), ...(particle_color === undefined ? {} : { particleColor: particle_color }), format })));
  }
  private result(operation: AssetOperationResult): { isError?: boolean; content: [{ type: "text"; text: string }] } { return { isError: !operation.ok, content: [{ type: "text", text: operation.message }] }; }
}
