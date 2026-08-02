import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AnimationAuditInput, AnimationEasing, AnimationSanitizeInput, AssetRuntimePort, AssetOperationResult, CopyLayersInput, PixelInput, PointInput, ScaleAnchor, TextDrawInput, TilePixelInput, TilePlacementInput } from "../../domain/asset-operations.js";
import { availableTextFonts, measureText as rasterMeasureText, rasterizeText } from "../text/TextRasterizer.js";
import { AsepriteCommandAdapter, execFileAsync, previewServers, SHEET_TYPES, DATA_FORMATS, ANIMATION_EASINGS, SCALE_ANCHORS, UNSAFE_LUA_PATTERNS, BLEND_MODES, PALETTE_PRESETS, rgbToHsl, hslToHex, CONVOLUTION_MATRICES, luaEscape, safePath, validatePath, isPositiveInteger, validateFrameRange, isHexColor, validateName, validateNativeRegion, result, parsePixelFields } from "./AsepriteCommandAdapter.js";
import type { PaletteTransformPort } from "../../application/ports/AssetCapabilityPorts.js";

export class AsepritePaletteAdapter extends AsepriteCommandAdapter implements PaletteTransformPort {
public async getColorStats(filename: string, frameIndex = 1, top = 16): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!isPositiveInteger(top)) return { ok: false, message: "Top must be a positive integer" };
    const script = `
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local clone = Sprite(spr)
      clone:flatten()
      local layer = clone.layers[#clone.layers]
      local image = Image(clone.width, clone.height, ColorMode.RGB)
      local cel = layer:cel(clone.frames[${frameIndex}])
      if cel then image:drawImage(cel.image, cel.position) end
      local counts = {}
      local opaque = 0
      for py = 0, image.height - 1 do
        for px = 0, image.width - 1 do
          local value = image:getPixel(px, py)
          if app.pixelColor.rgbaA(value) > 0 then
            opaque = opaque + 1
            local hex = string.format("#%02X%02X%02X", app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value))
            counts[hex] = (counts[hex] or 0) + 1
          end
        end
      end
      local unique = 0
      for hex, count in pairs(counts) do unique = unique + 1 print("COLOR:" .. hex .. "," .. count) end
      print("OPAQUE:" .. opaque)
      print("UNIQUE:" .. unique)
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return result(command, "Color stats failed");
    const colors: Array<{ color: string; count: number }> = [];
    let opaque = 0;
    let unique = 0;
    for (const line of command.output.split(/\r?\n/)) {
      if (line.startsWith("COLOR:")) {
        const [color, count] = line.slice(6).split(",");
        if (color && count) colors.push({ color, count: Number.parseInt(count, 10) });
      } else if (line.startsWith("OPAQUE:")) opaque = Number.parseInt(line.slice(7), 10);
      else if (line.startsWith("UNIQUE:")) unique = Number.parseInt(line.slice(7), 10);
    }
    colors.sort((left, right) => right.count - left.count);
    return { ok: true, message: JSON.stringify({ frame: frameIndex, uniqueColors: unique, opaquePixels: opaque, colors: colors.slice(0, top) }) };
  }

public async getPalette(filename: string): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const script = `
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      local palette = spr.palettes[1]
      if not palette then print("ERROR:No palette") return end
      for index = 0, #palette - 1 do
        local color = palette:getColor(index)
        print(string.format("PALETTE:#%02X%02X%02X", color.red, color.green, color.blue))
      end
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return result(command, "Palette read failed");
    const colors = command.output.split(/\r?\n/).filter((line) => line.startsWith("PALETTE:")).map((line) => line.slice(8));
    return colors.length ? { ok: true, message: JSON.stringify(colors) } : { ok: false, message: "Palette read returned no colors" };
  }

public async extractPalette(filename: string, maxColors = 16, withAlpha = false): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!Number.isInteger(maxColors) || maxColors < 1 || maxColors > 256) return { ok: false, message: "Max colors must be between 1 and 256" };
    const script = this.openScript(source, `
      app.command.ColorQuantization { ui = false, maxColors = ${maxColors}, withAlpha = ${withAlpha ? "true" : "false"} }
      local palette = spr.palettes[1]
      if not palette then print("ERROR:No palette") return end
      for index = 0, #palette - 1 do
        local color = palette:getColor(index)
        print(string.format("PALETTE:#%02X%02X%02X", color.red, color.green, color.blue))

      end
    `);
    const command = await this.runLua(script, source);
    if (!command.ok) return result(command, "Palette extraction failed");
    const colors = command.output.split(/\r?\n/).filter((line) => line.startsWith("PALETTE:")).map((line) => line.slice(8));
    return colors.length ? { ok: true, message: JSON.stringify({ colors, count: colors.length }) } : { ok: false, message: "Palette extraction returned no colors" };
  }

public async remapColorsInCelRange(filename: string, layerName: string, startFrame: number, endFrame: number, mappings: Array<{ from: string; to: string }>, createMissingCels = false, sourceFrameIndex?: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const rangeError = validateFrameRange(startFrame, endFrame);
    if (rangeError) return { ok: false, message: rangeError };
    if (!Array.isArray(mappings) || mappings.length === 0) return { ok: false, message: "Mappings list cannot be empty" };
    if (sourceFrameIndex !== undefined && !isPositiveInteger(sourceFrameIndex)) return { ok: false, message: "Source frame index must be a positive integer" };
    const parsedMappings: number[][] = [];
    for (const mapping of mappings) {
      const from = this.parseHexColor(mapping.from);
      const to = this.parseHexColor(mapping.to);
      if (!from || !to) return { ok: false, message: "Mappings must use hexadecimal values" };
      parsedMappings.push([from[0], from[1], from[2], to[0], to[1], to[2]]);
    }
    const map = parsedMappings.map((mapping) => `{${mapping.join(",")}}`).join(", ");
    const sourceIndex = sourceFrameIndex ?? startFrame;
    const script = this.openScript(source, `
      if ${endFrame} > #spr.frames then print("ERROR:Frame range out of bounds") return end
      if ${sourceIndex} < 1 or ${sourceIndex} > #spr.frames then print("ERROR:Source frame out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local mappings = { ${map} }
      for frameIndex = ${startFrame}, ${endFrame} do
        local cel = target:cel(spr.frames[frameIndex])
        if not cel and ${createMissingCels ? "true" : "false"} then
          local sourceCel = target:cel(spr.frames[${sourceIndex}])
          if sourceCel then cel = spr:newCel(target, spr.frames[frameIndex], sourceCel.image:clone(), sourceCel.position)
          else cel = spr:newCel(target, spr.frames[frameIndex], Image(spr.width, spr.height, spr.colorMode), Point(0, 0)) end
        end
        if cel then
          local img = cel.image
          for py = 0, img.height - 1 do
            for px = 0, img.width - 1 do
              local value = img:getPixel(px, py)
              local alpha = app.pixelColor.rgbaA(value)
              if alpha > 0 then
                local red, green, blue = app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value)
                for _, mapping in ipairs(mappings) do
                  if red == mapping[1] and green == mapping[2] and blue == mapping[3] then
                    img:putPixel(px, py, app.pixelColor.rgba(mapping[4], mapping[5], mapping[6], alpha))
                    break
                  end
                end
              end
            end
          end
        end
      end
    `);
    return result(await this.runLua(script, source), `Remapped colors on '${name}' frames ${startFrame}-${endFrame} in ${source}`);
  }

public async listPalettePresets(): Promise<AssetOperationResult> {
    return { ok: true, message: JSON.stringify(PALETTE_PRESETS) };
  }

public async setPalette(filename: string, colors: string[]): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!colors.length) return { ok: false, message: "Colors list cannot be empty" };
    if (colors.some((color) => !isHexColor(color))) return { ok: false, message: "Colors must use hexadecimal values" };
    const luaColors = colors.map((color) => `Color("${luaEscape(color)}")`).join(", ");
    const script = this.openScript(filename, `
      local palette = Palette(0, ${colors.length})
      local colors = {${luaColors}}
      for i, color in ipairs(colors) do palette:setColor(i - 1, color) end
      spr:setPalette(palette)
    `);
    return result(await this.runLua(script, filename), `Palette applied to ${filename}`);
  }

public async applyPalettePreset(filename: string, preset: string): Promise<AssetOperationResult> {
    const colors = PALETTE_PRESETS[preset.trim().toLowerCase()];
    if (!colors) return { ok: false, message: `Unknown palette preset: ${preset}` };
    const applied = await this.setPalette(filename, colors);
    return applied.ok ? { ok: true, message: `Palette preset '${preset}' (${colors.length} colors) applied to ${filename}` } : applied;
  }

public async generateColorRamp(baseColor: string, steps = 5, hueShiftDegrees = 20, lightnessRange = 0.5): Promise<AssetOperationResult> {
    const rgb = this.parseHexColor(baseColor);
    if (!rgb) return { ok: false, message: "Colors must use hexadecimal values" };
    if (!Number.isInteger(steps) || steps < 2 || steps > 16) return { ok: false, message: "Steps must be between 2 and 16" };
    if (!Number.isFinite(hueShiftDegrees)) return { ok: false, message: "Hue shift must be a finite number" };
    if (!Number.isFinite(lightnessRange) || lightnessRange < 0 || lightnessRange > 1) return { ok: false, message: "Lightness range must be between 0 and 1" };
    const [hue, saturation, lightness] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    const middle = (steps - 1) / 2;
    const ramp = Array.from({ length: steps }, (_, index) => {
      const t = (index - middle) / (steps - 1);
      const shiftedHue = ((hue - t * (hueShiftDegrees / 360)) % 1 + 1) % 1;
      const shiftedLightness = Math.min(1, Math.max(0, lightness + t * lightnessRange));
      const shiftedSaturation = Math.min(1, Math.max(0, saturation - t * 0.15));
      return hslToHex(shiftedHue, shiftedSaturation, shiftedLightness);
    });
    return { ok: true, message: JSON.stringify(ramp) };
  }

  public async quantizeToPalette(filename: string, layerName = "", startFrame = 1, endFrame = 0): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(startFrame) || !Number.isInteger(endFrame) || endFrame < 0 || (endFrame > 0 && endFrame < startFrame)) return { ok: false, message: "Frame range must start at 1 and end at or after the start" };
    const lastFrame = endFrame > 0 ? endFrame : "#spr.frames";
    const escapedLayer = luaEscape(layerName);
    const script = this.openScript(source, `
      local palette = spr.palettes[1]
      if not palette or #palette == 0 then print("ERROR:No palette") return end
      if ${startFrame} < 1 or ${lastFrame} > #spr.frames then print("ERROR:Frame range out of bounds") return end
      local layers = {}
      if "${escapedLayer}" ~= "" then
        local target = find_layer(spr, "${escapedLayer}")
        if not target or target.isGroup then print("ERROR:Layer not found") return end
        table.insert(layers, target)
      else
        for _, layer in ipairs(spr.layers) do if layer.isImage then table.insert(layers, layer) end end
      end
      local colors = {}
      for index = 0, #palette - 1 do local color = palette:getColor(index) table.insert(colors, {color.red, color.green, color.blue}) end
      local cache = {}
      local function nearest(red, green, blue)
        local key = red * 65536 + green * 256 + blue
        if cache[key] then return cache[key] end
        local best, bestDistance = colors[1], math.huge
        for _, color in ipairs(colors) do
          local dr, dg, db = red - color[1], green - color[2], blue - color[3]
          local distance = dr * dr + dg * dg + db * db
          if distance < bestDistance then best, bestDistance = color, distance end
        end
        cache[key] = best
        return best
      end
      local count = 0
      for _, layer in ipairs(layers) do
        for frameIndex = ${startFrame}, ${lastFrame} do
          local cel = layer:cel(spr.frames[frameIndex])
          if cel then
            local img = cel.image
            for py = 0, img.height - 1 do
              for px = 0, img.width - 1 do
                local value = img:getPixel(px, py)
                local alpha = app.pixelColor.rgbaA(value)
                if alpha > 0 then
                  local red, green, blue = app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value)
                  local nearestColor = nearest(red, green, blue)
                  if nearestColor[1] ~= red or nearestColor[2] ~= green or nearestColor[3] ~= blue then
                    img:putPixel(px, py, app.pixelColor.rgba(nearestColor[1], nearestColor[2], nearestColor[3], alpha))
                    count = count + 1
                  end
                end
              end
            end
          end
        end
      end
      print("COUNT:" .. count)
    `);
    const command = await this.runLua(script, source);
    if (!command.ok) return { ok: false, message: command.output };
    const count = command.output.split(/\r?\n/).find((line) => line.startsWith("COUNT:"))?.slice(6) ?? "?";
    return { ok: true, message: `Quantized ${count} pixels to the palette in ${source}` };
  }

public async setColorMode(filename: string, mode: string): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const normalizedMode = mode.trim().toLowerCase();
    if (!["rgb", "grayscale", "indexed"].includes(normalizedMode)) return { ok: false, message: "Mode must be 'rgb', 'grayscale', or 'indexed'" };
    const script = this.openScript(source, `app.command.ChangePixelFormat { format = "${normalizedMode}" }`);
    return result(await this.runLua(script, source), `Color mode set to ${normalizedMode} in ${source}`);
  }

public async getPixelColor(filename: string, x: number, y: number, layerName = "", frameIndex = 1): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const name = layerName.trim();
    const script = `
      local function find_layer(parent, wanted)
        for _, layer in ipairs(parent.layers) do
          if layer.name == wanted then return layer end
          if layer.isGroup then local nested = find_layer(layer, wanted) if nested then return nested end end
        end
        return nil
      end
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      if ${frameIndex} < 1 or ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local cel = nil
      if "${luaEscape(name)}" ~= "" then
        local target = find_layer(spr, "${luaEscape(name)}")
        if not target or target.isGroup then print("ERROR:Layer not found") return end
        cel = target:cel(spr.frames[${frameIndex}])
        if not cel then print("ERROR:No cel at that layer/frame") return end
      else
        app.activeFrame = spr.frames[${frameIndex}]
        cel = app.activeCel
        if not cel then print("ERROR:No active cel") return end
      end
      local img = cel.image
      local cx, cy = ${x} - cel.position.x, ${y} - cel.position.y
      local red, green, blue, alpha = 0, 0, 0, 0
      if cx >= 0 and cy >= 0 and cx < img.width and cy < img.height then
        local value = img:getPixel(cx, cy)
        red, green, blue, alpha = app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value), app.pixelColor.rgbaA(value)
      end
      print(string.format("PIXEL:%d,%d,%d,%d", red, green, blue, alpha))
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return { ok: false, message: `Failed to read pixel: ${command.output}` };
    const line = command.output.split(/\r?\n/).find((entry) => entry.startsWith("PIXEL:"));
    if (!line) return { ok: false, message: "No pixel data returned" };
    const fields = parsePixelFields(line.slice(6), 4);
    if (!fields) return { ok: false, message: "Invalid pixel data returned" };
    const [red, green, blue, alpha] = fields as [number, number, number, number];
    const hex = `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
    return { ok: true, message: `${hex} (r=${red}, g=${green}, b=${blue}, a=${alpha})` };
  }

public async getPixelsRect(filename: string, x: number, y: number, width: number, height: number, layerName = "", frameIndex = 1): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const name = layerName.trim();
    const script = `
      local function find_layer(parent, wanted)
        for _, layer in ipairs(parent.layers) do
          if layer.name == wanted then return layer end
          if layer.isGroup then local nested = find_layer(layer, wanted) if nested then return nested end end
        end
        return nil
      end
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      if ${frameIndex} < 1 or ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local cel = nil
      if "${luaEscape(name)}" ~= "" then
        local target = find_layer(spr, "${luaEscape(name)}")
        if not target or target.isGroup then print("ERROR:Layer not found") return end
        cel = target:cel(spr.frames[${frameIndex}])
        if not cel then print("ERROR:No cel at that layer/frame") return end
      else
        app.activeFrame = spr.frames[${frameIndex}]
        cel = app.activeCel
        if not cel then print("ERROR:No active cel") return end
      end
      local img, offsetX, offsetY = cel.image, cel.position.x, cel.position.y
      for py = ${y}, ${y + height - 1} do
        for px = ${x}, ${x + width - 1} do
          local cx, cy = px - offsetX, py - offsetY
          local red, green, blue, alpha = 0, 0, 0, 0
          if cx >= 0 and cy >= 0 and cx < img.width and cy < img.height then
            local value = img:getPixel(cx, cy)
            red, green, blue, alpha = app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value), app.pixelColor.rgbaA(value)
          end

          print(string.format("PIXEL:%d,%d,%d,%d,%d,%d", px, py, red, green, blue, alpha))
        end
      end
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return { ok: false, message: `Failed to read pixels: ${command.output}` };
    const pixels = command.output.split(/\r?\n/).filter((entry) => entry.startsWith("PIXEL:")).map((entry) => {
      const fields = parsePixelFields(entry.slice(6), 6);
      if (!fields) return undefined;
      const [px, py, red, green, blue, alpha] = fields as [number, number, number, number, number, number];
      return { x: px, y: py, hex: `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`, r: red, g: green, b: blue, a: alpha };
    }).filter((pixel): pixel is { x: number; y: number; hex: string; r: number; g: number; b: number; a: number } => pixel !== undefined);
    return pixels.length ? { ok: true, message: JSON.stringify(pixels) } : { ok: false, message: "No pixel data returned" };
  }

public async getCompositePixel(filename: string, x: number, y: number, frameIndex = 1): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const script = `
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      if ${frameIndex} < 1 or ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local clone = Sprite(spr)
      clone:flatten()
      local cel = clone.layers[1]:cel(clone.frames[${frameIndex}])
      if not cel then print("ERROR:No composite cel") return end
      local img = cel.image
      local red, green, blue, alpha = 0, 0, 0, 0
      if ${x} >= 0 and ${y} >= 0 and ${x} < img.width and ${y} < img.height then
        local value = img:getPixel(${x}, ${y})
        red, green, blue, alpha = app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value), app.pixelColor.rgbaA(value)
      end
      print(string.format("PIXEL:%d,%d,%d,%d", red, green, blue, alpha))
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return { ok: false, message: `Failed to read composite pixel: ${command.output}` };
    const line = command.output.split(/\r?\n/).find((entry) => entry.startsWith("PIXEL:"));
    if (!line) return { ok: false, message: "No pixel data returned" };
    const fields = parsePixelFields(line.slice(6), 4);
    if (!fields) return { ok: false, message: "Invalid pixel data returned" };
    const [red, green, blue, alpha] = fields as [number, number, number, number];
    const hex = `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
    return { ok: true, message: `${hex} (r=${red}, g=${green}, b=${blue}, a=${alpha})` };
  }

public async getCompositeRect(filename: string, x: number, y: number, width: number, height: number, frameIndex = 1): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const script = `
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      if ${frameIndex} < 1 or ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local clone = Sprite(spr)
      clone:flatten()
      local cel = clone.layers[1]:cel(clone.frames[${frameIndex}])
      if not cel then print("ERROR:No composite cel") return end
      local img = cel.image
      for py = ${y}, ${y + height - 1} do
        for px = ${x}, ${x + width - 1} do
          local red, green, blue, alpha = 0, 0, 0, 0
          if px >= 0 and py >= 0 and px < img.width and py < img.height then
            local value = img:getPixel(px, py)
            red, green, blue, alpha = app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value), app.pixelColor.rgbaA(value)
          end
          print(string.format("PIXEL:%d,%d,%d,%d,%d,%d", px, py, red, green, blue, alpha))
        end
      end
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return { ok: false, message: `Failed to read composite pixels: ${command.output}` };
    const pixels = command.output.split(/\r?\n/).filter((entry) => entry.startsWith("PIXEL:")).map((entry) => {
      const fields = parsePixelFields(entry.slice(6), 6);
      if (!fields) return undefined;
      const [px, py, red, green, blue, alpha] = fields as [number, number, number, number, number, number];
      return { x: px, y: py, hex: `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`, r: red, g: green, b: blue, a: alpha };
    }).filter((pixel): pixel is { x: number; y: number; hex: string; r: number; g: number; b: number; a: number } => pixel !== undefined);
    return pixels.length ? { ok: true, message: JSON.stringify(pixels) } : { ok: false, message: "No pixel data returned" };
  }

public async moveRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, destX: number, destY: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y, destX, destY].every(Number.isInteger)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const body = this.layerFrameScript(name, frameIndex, false, `
      local img = cel.image
      local function pset(px, py, value)
        if px >= 0 and py >= 0 and px < img.width and py < img.height then img:putPixel(px, py, value) end
      end
      local buffer = {}
      for row = 0, ${height - 1} do
        buffer[row] = {}
        for column = 0, ${width - 1} do
          local sx, sy = ${x} + column, ${y} + row
          if sx >= 0 and sy >= 0 and sx < img.width and sy < img.height then buffer[row][column] = img:getPixel(sx, sy) else buffer[row][column] = 0 end
          if sx >= 0 and sy >= 0 and sx < img.width and sy < img.height then img:putPixel(sx, sy, 0) end
        end
      end
      for row = 0, ${height - 1} do
        for column = 0, ${width - 1} do
          local value = buffer[row][column]
          if app.pixelColor.rgbaA(value) > 0 then pset(${destX} + column, ${destY} + row, value) end
        end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Moved ${width}x${height} region from (${x},${y}) to (${destX},${destY}) on '${name}' frame ${frameIndex} in ${source}`);
  }

public async copyRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, destX: number, destY: number, targetLayerName = "", targetFrameIndex = 0): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const targetName = validateName(targetLayerName.trim() || name, "Target layer name");
    if (typeof targetName !== "string") return targetName;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (targetFrameIndex < 0 || !Number.isInteger(targetFrameIndex)) return { ok: false, message: "Target frame index must be a positive integer or zero" };
    const resolvedTargetFrame = targetFrameIndex > 0 ? targetFrameIndex : frameIndex;
    if (![x, y, destX, destY].every(Number.isInteger)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Source frame index out of range") return end
      if ${resolvedTargetFrame} > #spr.frames then print("ERROR:Target frame index out of range") return end
      local function normalize_cel(layer, frame, create)
        local current = layer:cel(frame)
        if not current and create then current = spr:newCel(layer, frame, Image(spr.width, spr.height, spr.colorMode), Point(0, 0)) end
        if not current then return nil end
        if current.position.x ~= 0 or current.position.y ~= 0 or current.image.width ~= spr.width or current.image.height ~= spr.height then
          local normalized = Image(spr.width, spr.height, spr.colorMode)
          normalized:drawImage(current.image, current.position)
          current.image, current.position = normalized, Point(0, 0)
        end
        return current
      end
      local sourceLayer = find_layer(spr, "${luaEscape(name)}")
      local targetLayer = find_layer(spr, "${luaEscape(targetName)}")
      if not sourceLayer then print("ERROR:Source layer not found") return end
      if not targetLayer then print("ERROR:Target layer not found") return end
      local sourceCel = normalize_cel(sourceLayer, spr.frames[${frameIndex}], false)
      if not sourceCel then print("ERROR:No cel at source layer/frame") return end
      local targetCel = normalize_cel(targetLayer, spr.frames[${resolvedTargetFrame}], true)
      local sourceImage, targetImage = sourceCel.image, targetCel.image
      local buffer = {}
      for row = 0, ${height - 1} do
        buffer[row] = {}
        for column = 0, ${width - 1} do
          local sx, sy = ${x} + column, ${y} + row
          if sx >= 0 and sy >= 0 and sx < sourceImage.width and sy < sourceImage.height then buffer[row][column] = sourceImage:getPixel(sx, sy) else buffer[row][column] = 0 end
        end
      end
      for row = 0, ${height - 1} do
        for column = 0, ${width - 1} do
          local value = buffer[row][column]
          if app.pixelColor.rgbaA(value) > 0 and ${destX} + column >= 0 and ${destY} + row >= 0 and ${destX} + column < targetImage.width and ${destY} + row < targetImage.height then targetImage:putPixel(${destX} + column, ${destY} + row, value) end
        end
      end
    `);
    return result(await this.runLua(script, source), `Copied ${width}x${height} region from (${x},${y}) to (${destX},${destY}) in ${source}`);
  }

public async eraseRegion(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const body = this.layerFrameScript(name, frameIndex, false, `
      local img = cel.image
      for py = math.max(0, ${y}), math.min(img.height - 1, ${y + height - 1}) do
        for px = math.max(0, ${x}), math.min(img.width - 1, ${x + width - 1}) do img:putPixel(px, py, 0) end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Erased ${width}x${height} region at (${x},${y}) on '${name}' frame ${frameIndex} in ${source}`);
  }

public async eraseColor(filename: string, layerName: string, frameIndex: number, color: string, tolerance = 0): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255) return { ok: false, message: "Tolerance must be between 0 and 255" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue] = rgba;
    const body = this.layerFrameScript(name, frameIndex, false, `
      local count = 0
      local img = cel.image
      for py = 0, img.height - 1 do
        for px = 0, img.width - 1 do
          local value = img:getPixel(px, py)
          if app.pixelColor.rgbaA(value) > 0 and math.abs(app.pixelColor.rgbaR(value) - ${red}) <= ${tolerance} and math.abs(app.pixelColor.rgbaG(value) - ${green}) <= ${tolerance} and math.abs(app.pixelColor.rgbaB(value) - ${blue}) <= ${tolerance} then
            img:putPixel(px, py, 0)
            count = count + 1
          end
        end
      end
      print("COUNT:" .. count)
    `);
    const command = await this.runLua(this.openScript(source, body), source);
    if (!command.ok) return { ok: false, message: command.output };
    const count = command.output.split(/\r?\n/).find((line) => line.startsWith("COUNT:"))?.slice(6) ?? "?";
    return { ok: true, message: `Erased ${count} pixels of ${color} on '${name}' frame ${frameIndex} in ${source}` };
  }

public async flipLayer(filename: string, layerName: string, frameIndex: number, direction: "horizontal" | "vertical" = "horizontal"): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (direction !== "horizontal" && direction !== "vertical") return { ok: false, message: "Direction must be 'horizontal' or 'vertical'" };
    const body = `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local cel = target:cel(spr.frames[${frameIndex}])
      if not cel then print("ERROR:No cel at that layer/frame") return end
      local img = cel.image
      local pixels = {}
      for py = 0, img.height - 1 do
        pixels[py] = {}
        for px = 0, img.width - 1 do pixels[py][px] = img:getPixel(px, py) end
      end
      for py = 0, img.height - 1 do
        for px = 0, img.width - 1 do
          ${direction === "horizontal" ? "img:putPixel(px, py, pixels[py][img.width - 1 - px])" : "img:putPixel(px, py, pixels[img.height - 1 - py][px])"}
        end
      end
    `;
    return result(await this.runLua(this.openScript(source, body), source), `Layer '${name}' flipped ${direction}ly in ${source}`);
  }

public async rotateLayer(filename: string, layerName: string, frameIndex: number, angle: 90 | 180 | 270 = 90): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (angle !== 90 && angle !== 180 && angle !== 270) return { ok: false, message: "Angle must be 90, 180, or 270" };

    const rotateBody = angle === 180 ? `
      local img = cel.image
      local pixels = {}
      for py = 0, img.height - 1 do
        pixels[py] = {}
        for px = 0, img.width - 1 do pixels[py][px] = img:getPixel(px, py) end
      end
      for py = 0, img.height - 1 do
        for px = 0, img.width - 1 do img:putPixel(px, py, pixels[img.height - 1 - py][img.width - 1 - px]) end
      end
    ` : `
      local img = cel.image
      local new_img = Image(img.height, img.width, img.colorMode)
      for py = 0, img.height - 1 do
        for px = 0, img.width - 1 do
          ${angle === 90 ? "new_img:putPixel(img.height - 1 - py, px, img:getPixel(px, py))" : "new_img:putPixel(py, img.width - 1 - px, img:getPixel(px, py))"}
        end
      end
      cel.image = new_img
    `;
    const body = `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local cel = target:cel(spr.frames[${frameIndex}])
      if not cel then print("ERROR:No cel at that layer/frame") return end
      ${rotateBody}
    `;
    return result(await this.runLua(this.openScript(source, body), source), `Layer '${name}' rotated ${angle}° clockwise in ${source}`);
  }

public async resizeCanvas(filename: string, width: number, height: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const script = this.openScript(source, `spr:resize(${width}, ${height})`);
    return result(await this.runLua(script, source), `Canvas resized to ${width}x${height} in ${source}`);
  }

public async cropCanvas(filename: string, x: number, y: number, width: number, height: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Crop coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const script = this.openScript(source, `
      if ${x} >= spr.width or ${y} >= spr.height or ${x + width} <= 0 or ${y + height} <= 0 then print("ERROR:Crop rect is fully outside the canvas") return end
      spr:crop(${x}, ${y}, ${width}, ${height})
    `);
    return result(await this.runLua(script, source), `Canvas cropped to (${x},${y}) ${width}x${height} in ${source}`);
  }
}
