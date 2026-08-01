import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AnimationAuditInput, AnimationEasing, AnimationSanitizeInput, AssetRuntimePort, AssetOperationResult, CopyLayersInput, PixelInput, PointInput, ScaleAnchor, TextDrawInput, TilePixelInput, TilePlacementInput } from "../../domain/asset-operations.js";
import { availableTextFonts, measureText as rasterMeasureText, rasterizeText } from "../text/TextRasterizer.js";
import { AsepriteCommandAdapter, execFileAsync, previewServers, SHEET_TYPES, DATA_FORMATS, ANIMATION_EASINGS, SCALE_ANCHORS, UNSAFE_LUA_PATTERNS, BLEND_MODES, PALETTE_PRESETS, rgbToHsl, hslToHex, CONVOLUTION_MATRICES, luaEscape, safePath, validatePath, isPositiveInteger, validateFrameRange, isHexColor, validateName, validateNativeRegion, result, parsePixelFields } from "./AsepriteCommandAdapter.js";
import type { SceneExportPort } from "../../application/ports/AssetCapabilityPorts.js";

export class AsepriteSceneAdapter extends AsepriteCommandAdapter implements SceneExportPort {
public async createTilemapLayer(filename: string, layerName: string, tileWidth: number, tileHeight: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(tileWidth) || !isPositiveInteger(tileHeight)) return { ok: false, message: "Tile dimensions must be positive integers" };
    const script = this.openScript(source, `
      local name_taken = false
      for _, layer in ipairs(spr.layers) do if layer.name == "${luaEscape(name)}" then name_taken = true break end end
      if name_taken then print("ERROR:Layer with that name already exists") return end
      spr.gridBounds = Rectangle(0, 0, ${tileWidth}, ${tileHeight})
      app.command.NewLayer { tilemap = true }
      app.activeLayer.name = "${luaEscape(name)}"
    `);
    return result(await this.runLua(script, source), `Tilemap layer '${name}' created with ${tileWidth}x${tileHeight} tiles in ${source}`);
  }

public async validateScene(filename: string, requiredLayers: string[], startFrame = 1, endFrame?: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!requiredLayers.length) return { ok: false, message: "Required layers list cannot be empty" };
    if (!Number.isInteger(startFrame) || startFrame < 1 || (endFrame !== undefined && (!Number.isInteger(endFrame) || endFrame < startFrame))) {
      return { ok: false, message: "Frame range must start at 1 and end at or after the start" };
    }
    const layerList = `{${requiredLayers.map((layer) => `"${luaEscape(layer)}"`).join(",")}}`;
    const lastFrame = endFrame ?? "#spr.frames";
    const script = this.openScript(filename, `
      local missing = {}
      for _, name in ipairs(${layerList}) do if not find_layer(spr, name) then table.insert(missing, name) end end
      if #missing > 0 then print("ERROR:Missing layers: " .. table.concat(missing, ", ")) return end
      if ${startFrame} < 1 or ${lastFrame} > #spr.frames or ${startFrame} > ${lastFrame} then print("ERROR:Frame range out of bounds") return end
      print("VALID")
    `);
    return result(await this.runLua(script, filename), `Scene validation passed for ${filename}`);
  }

public async exportSpritesheet(input: Parameters<AssetRuntimePort["exportSpritesheet"]>[0]): Promise<AssetOperationResult> {
    const source = validatePath(input.filename);
    if (typeof source !== "string") return source;
    const output = validatePath(input.outputFilename);
    if (typeof output !== "string") return output;
    if (!SHEET_TYPES.has(input.sheetType ?? "horizontal")) return { ok: false, message: `Unsupported spritesheet type: ${input.sheetType}` };
    if (!Number.isInteger(input.scale ?? 1) || (input.scale ?? 1) < 1 || (input.scale ?? 1) > 64) return { ok: false, message: "Scale must be between 1 and 64" };
    if (!Number.isInteger(input.padding ?? 0) || (input.padding ?? 0) < 0) return { ok: false, message: "Padding must be a non-negative integer" };
    if (!DATA_FORMATS.has(input.dataFormat ?? "json-array")) return { ok: false, message: `Unsupported data format: ${input.dataFormat}` };
    const data = input.dataFilename ? validatePath(input.dataFilename) : undefined;
    if (data !== undefined && typeof data !== "string") return data;
    const args = ["--batch"];
    if (input.tagName) {
      const range = await this.resolveTagRange(input.filename, input.tagName);
      if (!range.ok) return { ok: false, message: range.output };
      args.push("--frame-range", range.output);
    }
    args.push(source, "--sheet-type", input.sheetType ?? "horizontal");
    if ((input.scale ?? 1) > 1) args.push("--scale", String(input.scale));
    if ((input.padding ?? 0) > 0) args.push("--shape-padding", String(input.padding));
    if (data) args.push("--data", data, "--format", input.dataFormat ?? "json-array");
    if (input.listTags) args.push("--list-tags");
    args.push("--sheet", output);
    const command = await this.commandRunner(args);
    if (command.ok) {
      try {
        await fs.access(output);
      } catch {
        return { ok: false, message: "Aseprite exited successfully but did not create the spritesheet" };
      }
      if (data) {
        try {
          await fs.access(data);
        } catch {
          return { ok: false, message: "Aseprite exited successfully but did not create the metadata file" };
        }
      }
    }
    return result(command, `Sprite sheet exported to ${output}`);
  }
}
