import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AnimationAuditInput, AnimationEasing, AnimationSanitizeInput, AssetRuntimePort, AssetOperationResult, CopyLayersInput, PixelInput, PointInput, ScaleAnchor, TextDrawInput, TilePixelInput, TilePlacementInput } from "../../domain/asset-operations.js";
import { availableTextFonts, measureText as rasterMeasureText, rasterizeText } from "../text/TextRasterizer.js";
import { AsepriteCommandAdapter, execFileAsync, previewServers, SHEET_TYPES, DATA_FORMATS, ANIMATION_EASINGS, SCALE_ANCHORS, UNSAFE_LUA_PATTERNS, BLEND_MODES, PALETTE_PRESETS, rgbToHsl, hslToHex, CONVOLUTION_MATRICES, luaEscape, safePath, validatePath, isPositiveInteger, validateFrameRange, isHexColor, validateName, validateNativeRegion, result, parsePixelFields } from "./AsepriteCommandAdapter.js";
import type { LayerFramePort } from "../../application/ports/AssetCapabilityPorts.js";

export class AsepriteLayerAdapter extends AsepriteCommandAdapter implements LayerFramePort {
public async createCanvas(width: number, height: number, filename: string): Promise<AssetOperationResult> {
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const target = validatePath(filename);
    if (typeof target !== "string") return target;
    const script = `local spr = Sprite(${width}, ${height})\nspr:saveAs("${luaEscape(target.replaceAll("\\", "/"))}")\nprint("OK")`;
    return result(await this.runLua(script), `Canvas created successfully: ${filename}`);
  }

public async addGroup(filename: string, groupName: string, parentGroup = ""): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const script = this.layerScript(filename, `
      local group = spr:newGroup()
      group.name = "${luaEscape(groupName)}"
      if "${luaEscape(parentGroup)}" ~= "" then
        local parent = find_layer(spr, "${luaEscape(parentGroup)}")
        if not parent or not parent.isGroup then print("ERROR:Parent group not found") return end
        group.parent = parent
      end
    `);
    return result(await this.runLua(script, filename), `Group '${groupName}' created in ${filename}`);
  }

public async addLayer(filename: string, layerName: string, group = ""): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const script = this.layerScript(filename, `
      local parent = nil
      if "${luaEscape(group)}" ~= "" then
        parent = find_layer(spr, "${luaEscape(group)}")
        if not parent or not parent.isGroup then print("ERROR:Group not found") return end
      end
      local layer = spr:newLayer()
      layer.name = "${luaEscape(layerName)}"
      if parent then layer.parent = parent end
    `);
    return result(await this.runLua(script, filename), `Layer '${layerName}' added to ${filename}`);
  }

public async deleteLayer(filename: string, layerName: string): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const script = this.layerScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      if #spr.layers <= 1 then print("ERROR:Cannot delete the only layer") return end
      spr:deleteLayer(target)
    `);
    return result(await this.runLua(script, source), `Layer '${name}' deleted from ${source}`);
  }

public async renameLayer(filename: string, layerName: string, newName: string): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const replacement = validateName(newName, "New layer name");
    if (typeof replacement !== "string") return replacement;
    const script = this.layerScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      target.name = "${luaEscape(replacement)}"
    `);
    return result(await this.runLua(script, source), `Layer '${name}' renamed to '${replacement}' in ${source}`);
  }

public async duplicateLayer(filename: string, layerName: string, newName = "", group = ""): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");

    if (typeof name !== "string") return name;
    const finalName = newName.trim() || `${name} copy`;
    const targetGroup = group.trim();
    const script = this.layerScript(source, `
      local src = find_layer(spr, "${luaEscape(name)}")
      if not src then print("ERROR:Layer not found") return end
      if src.isGroup then print("ERROR:Source group cannot be duplicated") return end
      local parent = nil
      if "${luaEscape(targetGroup)}" ~= "" then
        parent = find_layer(spr, "${luaEscape(targetGroup)}")
        if not parent then print("ERROR:Group not found") return end
        if not parent.isGroup then print("ERROR:Target is not a group") return end
      end
      local copy = spr:newLayer()
      copy.name = "${luaEscape(finalName)}"
      copy.opacity = src.opacity
      copy.blendMode = src.blendMode
      if parent then copy.parent = parent else copy.stackIndex = src.stackIndex + 1 end
      for _, frame in ipairs(spr.frames) do
        local cel = src:cel(frame)
        if cel then
          local copiedCel = spr:newCel(copy, frame, cel.image:clone(), cel.position)
          copiedCel.opacity = cel.opacity
        end
      end
    `);
    const location = targetGroup ? ` inside group '${targetGroup}'` : "";
    return result(await this.runLua(script, source), `Layer '${name}' duplicated as '${finalName}'${location} in ${source}`);
  }

public async reorderLayer(filename: string, layerName: string, position: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(position)) return { ok: false, message: "Position must be a positive integer" };
    const script = this.layerScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      if ${position} > #spr.layers then print("ERROR:Position out of range") return end
      target.stackIndex = ${position}
    `);
    return result(await this.runLua(script, source), `Layer '${name}' moved to position ${position} in ${source}`);
  }

public async setLayerBlendMode(filename: string, layerName: string, mode: string): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const normalizedMode = mode.trim().toLowerCase();
    const blend = BLEND_MODES[normalizedMode];
    if (!blend) return { ok: false, message: `Unsupported blend mode: ${mode}` };
    const script = this.layerScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      target.blendMode = ${blend}
    `);
    return result(await this.runLua(script, source), `Layer '${name}' blend mode set to ${normalizedMode} in ${source}`);
  }

public async mergeLayerDown(filename: string, layerName: string): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const script = this.layerScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      if target.stackIndex <= 1 then print("ERROR:Layer is the bottom layer; nothing to merge into") return end
      app.activeLayer = target
      app.command.MergeDownLayer()
    `);
    return result(await this.runLua(script, source), `Layer '${name}' merged down in ${source}`);
  }

public async flattenSprite(filename: string): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const script = this.openScript(source, "spr:flatten()");
    return result(await this.runLua(script, source), `Sprite flattened in ${source}`);
  }

public async addFrame(filename: string): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const script = this.openScript(filename, "spr:newFrame()");
    return result(await this.runLua(script, filename), `New frame added to ${filename}`);
  }

public async addFrames(filename: string, count: number, durationMs?: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(count)) return { ok: false, message: "Count must be a positive integer" };
    if (durationMs !== undefined && !isPositiveInteger(durationMs)) return { ok: false, message: "Duration must be a positive integer" };
    const duration = durationMs && durationMs > 0 ? `spr.frames[#spr.frames].duration = ${durationMs} / 1000.0` : "";
    const script = this.openScript(filename, `
      for i = 1, ${count} do
        spr:newFrame()
        ${duration}
      end
    `);
    return result(await this.runLua(script, filename), `Added ${count} frames to ${filename}`);
  }

public async setFrame(filename: string, frameIndex: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const script = this.openScript(filename, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      app.activeFrame = spr.frames[${frameIndex}]
    `);
    return result(await this.runLua(script, filename), `Active frame set to ${frameIndex} in ${filename}`);
  }

public async setFrameDuration(filename: string, frameIndex: number, durationMs: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!isPositiveInteger(durationMs)) return { ok: false, message: "Duration must be a positive integer" };
    const script = this.openScript(filename, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      spr.frames[${frameIndex}].duration = ${durationMs} / 1000.0
    `);
    return result(await this.runLua(script, filename), `Frame ${frameIndex} duration set to ${durationMs}ms in ${filename}`);
  }

public async setFrameDurationAll(filename: string, durationMs: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(durationMs)) return { ok: false, message: "Duration must be a positive integer" };
    const script = this.openScript(filename, `
      for i = 1, #spr.frames do
        spr.frames[i].duration = ${durationMs} / 1000.0
      end
    `);
    return result(await this.runLua(script, filename), `All frame durations set to ${durationMs}ms in ${filename}`);
  }

public async setLayerVisibility(filename: string, layerName: string, visible = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const script = this.openScript(filename, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      target.isVisible = ${visible ? "true" : "false"}
    `);
    return result(await this.runLua(script, filename), `Layer '${name}' visibility set to ${visible} in ${filename}`);
  }

public async setLayerOpacity(filename: string, layerName: string, opacity: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!Number.isInteger(opacity) || opacity < 0 || opacity > 255) return { ok: false, message: "Opacity must be between 0 and 255" };
    const script = this.openScript(filename, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      target.opacity = ${opacity}
    `);
    return result(await this.runLua(script, filename), `Layer '${name}' opacity set to ${opacity} in ${filename}`);
  }

}
