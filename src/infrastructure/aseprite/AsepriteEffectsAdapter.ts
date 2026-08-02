import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AnimationAuditInput, AnimationEasing, AnimationSanitizeInput, AssetRuntimePort, AssetOperationResult, CopyLayersInput, PixelInput, PointInput, ScaleAnchor, TextDrawInput, TilePixelInput, TilePlacementInput } from "../../domain/asset-operations.js";
import { availableTextFonts, measureText as rasterMeasureText, rasterizeText } from "../text/TextRasterizer.js";
import { AsepriteCommandAdapter, execFileAsync, previewServers, SHEET_TYPES, DATA_FORMATS, ANIMATION_EASINGS, SCALE_ANCHORS, UNSAFE_LUA_PATTERNS, BLEND_MODES, PALETTE_PRESETS, rgbToHsl, hslToHex, CONVOLUTION_MATRICES, luaEscape, safePath, validatePath, isPositiveInteger, validateFrameRange, isHexColor, validateName, validateNativeRegion, result, parsePixelFields } from "./AsepriteCommandAdapter.js";
import type { EffectsPort } from "../../application/ports/AssetCapabilityPorts.js";

export class AsepriteEffectsAdapter extends AsepriteCommandAdapter implements EffectsPort {
public async animationWorkflowGuide(useCase = "character"): Promise<AssetOperationResult> {
    const normalized = (useCase || "character").trim().toLowerCase();
    const guides: Record<string, string[]> = {
      character: ["Block key poses on frame 1, then use copy_frame or copy_cel for the base.", "Use propagate_cels for static layers across the range.", "Use tween_cel_positions_eased or offset_cel_positions for motion.", "Keep secondary motion on separate layers.", "Use layer visibility/opacity and *_at drawing tools deterministically.", "Finish with set_tag, export_sprite, and audit_animation."],
      environment: ["Build the base scene once and use copy_sprite for variants.", "Use propagate_cels for static sky, mountains, and ground layers.", "Animate only moving layers such as clouds, birds, or water.", "Use gradients and palette tools to keep a consistent mood.", "Reuse layers across scenes with copy_layers_between_sprites.", "Tag loops, export previews, and run animation_sanitize."],
      general: ["Create a stable base frame before adding motion.", "Move or propagate cels instead of redrawing every frame.", "Target explicit layers and frames to avoid active-state drift.", "Use tags for loops and export previews early.", "Audit coverage and overlaps before delivery."],
    };
    const bullets = guides[normalized] ?? guides.general ?? [];
    return { ok: true, message: ["Animation Workflow Guide", `Use case: ${normalized}`, ...bullets.map((bullet) => `- ${bullet}`)].join("\n") };
  }

public async runLuaScript(script: string, filename = ""): Promise<AssetOperationResult> {
    if (typeof script !== "string" || !script.trim()) return { ok: false, message: "Script cannot be empty" };
    if (script.length > 200_000) return { ok: false, message: "Script exceeds the 200000 character limit" };
    if (UNSAFE_LUA_PATTERNS.test(script)) return { ok: false, message: "Script uses blocked host file/process APIs; use the curated tools instead" };
    let source: string | undefined;
    if (filename) {
      const validated = validatePath(filename);
      if (typeof validated !== "string") return validated;
      try { await fs.access(validated); } catch { return { ok: false, message: `File ${filename} not found` }; }
      source = validated;
    }
    const command = await this.runLua(script, source);
    if (command.ok) return { ok: true, message: command.output.trim() || "Script executed (no output printed)" };
    return { ok: false, message: `Script failed: ${command.output}` };
  }

public async outlineNative(filename: string, layerName = "", frameIndex = 1, color = "#000000", place = "outside", matrix = "circle"): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (place !== "outside" && place !== "inside") return { ok: false, message: "Place must be 'outside' or 'inside'" };
    if (matrix !== "circle" && matrix !== "square") return { ok: false, message: "Matrix must be 'circle' or 'square'" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue] = rgba;
    const script = this.nativeScript(layerName, frameIndex, `app.command.Outline { ui = false, color = Color { r = ${red}, g = ${green}, b = ${blue}, a = 255 }, place = "${place}", matrix = "${matrix}" }`);
    return result(await this.runLua(script, source), `Outlined (${place}, ${matrix}) ${layerName || "active layer"} in ${source}`);
  }

public async adjustHslNative(filename: string, layerName = "", frameIndex = 1, hue = 0, saturation = 0, lightness = 0, x = 0, y = 0, width = 0, height = 0): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Number.isInteger(hue) || hue < -180 || hue > 180) return { ok: false, message: "Hue must be between -180 and 180" };
    if (![saturation, lightness].every((value) => Number.isInteger(value) && value >= -100 && value <= 100)) return { ok: false, message: "Saturation and lightness must be between -100 and 100" };
    const regionError = validateNativeRegion(x, y, width, height);
    if (regionError) return regionError;
    const region = width > 0 ? [x, y, width, height] as [number, number, number, number] : undefined;
    const script = this.nativeScript(layerName, frameIndex, `app.command.HueSaturation { ui = false, hue = ${hue}, saturation = ${saturation}, lightness = ${lightness}, alpha = 0 }`, region);
    return result(await this.runLua(script, source), `Adjusted HSL on ${layerName || "active layer"} in ${source}`);
  }

public async adjustBrightnessContrast(filename: string, layerName = "", frameIndex = 1, brightness = 0, contrast = 0, x = 0, y = 0, width = 0, height = 0): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![brightness, contrast].every((value) => Number.isInteger(value) && value >= -100 && value <= 100)) return { ok: false, message: "Brightness and contrast must be between -100 and 100" };
    const regionError = validateNativeRegion(x, y, width, height);
    if (regionError) return regionError;
    const region = width > 0 ? [x, y, width, height] as [number, number, number, number] : undefined;
    const script = this.nativeScript(layerName, frameIndex, `app.command.BrightnessContrast { ui = false, brightness = ${brightness}, contrast = ${contrast} }`, region);
    return result(await this.runLua(script, source), `Adjusted brightness/contrast on ${layerName || "active layer"} in ${source}`);
  }

public async invertColors(filename: string, layerName = "", frameIndex = 1, x = 0, y = 0, width = 0, height = 0): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const regionError = validateNativeRegion(x, y, width, height);
    if (regionError) return regionError;
    const region = width > 0 ? [x, y, width, height] as [number, number, number, number] : undefined;
    const script = this.nativeScript(layerName, frameIndex, "app.command.InvertColor { ui = false }", region);
    return result(await this.runLua(script, source), `Inverted colours on ${layerName || "active layer"} in ${source}`);
  }

public async outlineCel(filename: string, layerName: string, frameIndex: number, color = "#000000", includeDiagonals = false): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue] = rgba;
    const body = this.layerFrameScript(name, frameIndex, false, `
      local img = cel.image
      local src = img:clone()
      local outline = Color(${red}, ${green}, ${blue}, 255)
      local function opaque(px, py)
        if px < 0 or py < 0 or px >= src.width or py >= src.height then return false end
        return app.pixelColor.rgbaA(src:getPixel(px, py)) > 0
      end
      for py = 0, img.height - 1 do
        for px = 0, img.width - 1 do
          if app.pixelColor.rgbaA(src:getPixel(px, py)) == 0 then
            local touch = opaque(px - 1, py) or opaque(px + 1, py) or opaque(px, py - 1) or opaque(px, py + 1)
            if not touch and ${includeDiagonals ? "true" : "false"} then
              touch = opaque(px - 1, py - 1) or opaque(px + 1, py - 1) or opaque(px - 1, py + 1) or opaque(px + 1, py + 1)
            end
            if touch then img:putPixel(px, py, outline) end
          end
        end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Outline added to '${name}' frame ${frameIndex} in ${source}`);
  }

public async replaceColor(filename: string, layerName: string, frameIndex: number, fromColor: string, toColor: string, tolerance = 0): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255) return { ok: false, message: "Tolerance must be between 0 and 255" };
    const from = this.parseHexColor(fromColor);
    const to = this.parseHexColor(toColor);
    if (!from || !to) return { ok: false, message: "Colors must use hexadecimal values" };
    const [fromRed, fromGreen, fromBlue] = from;
    const [toRed, toGreen, toBlue] = to;
    const body = this.layerFrameScript(name, frameIndex, false, `
      local count = 0
      local img = cel.image
      for py = 0, img.height - 1 do
        for px = 0, img.width - 1 do
          local value = img:getPixel(px, py)
          local alpha = app.pixelColor.rgbaA(value)
          if alpha > 0 then

            local redDistance = math.abs(app.pixelColor.rgbaR(value) - ${fromRed})
            local greenDistance = math.abs(app.pixelColor.rgbaG(value) - ${fromGreen})
            local blueDistance = math.abs(app.pixelColor.rgbaB(value) - ${fromBlue})
            if redDistance <= ${tolerance} and greenDistance <= ${tolerance} and blueDistance <= ${tolerance} then
              img:putPixel(px, py, app.pixelColor.rgba(${toRed}, ${toGreen}, ${toBlue}, alpha))
              count = count + 1
            end
          end
        end
      end
      print("COUNT:" .. count)
    `);
    const command = await this.runLua(this.openScript(source, body), source);
    if (!command.ok) return { ok: false, message: command.output };
    const count = command.output.split(/\r?\n/).find((line) => line.startsWith("COUNT:"))?.slice(6) ?? "?";
    return { ok: true, message: `Replaced ${count} pixels ${fromColor} -> ${toColor} on '${name}' frame ${frameIndex} in ${source}` };
  }

public async adjustHsl(filename: string, layerName: string, frameIndex: number, hueShift = 0, saturationShift = 0, lightnessShift = 0): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![hueShift, saturationShift, lightnessShift].every(Number.isFinite)) return { ok: false, message: "HSL shifts must be finite numbers" };
    if (hueShift < -360 || hueShift > 360) return { ok: false, message: "Hue shift must be between -360 and 360" };
    if (saturationShift < -100 || saturationShift > 100) return { ok: false, message: "Saturation shift must be between -100 and 100" };
    if (lightnessShift < -100 || lightnessShift > 100) return { ok: false, message: "Lightness shift must be between -100 and 100" };
    const body = this.layerFrameScript(name, frameIndex, false, `
      local function rgb_to_hsl(red, green, blue)
        red, green, blue = red / 255, green / 255, blue / 255
        local maxc = math.max(red, green, blue)
        local minc = math.min(red, green, blue)
        local lightness = (maxc + minc) / 2
        if maxc == minc then return 0, 0, lightness end
        local delta = maxc - minc
        local saturation
        if lightness > 0.5 then saturation = delta / (2 - maxc - minc) else saturation = delta / (maxc + minc) end
        local hue
        if maxc == red then
          hue = (green - blue) / delta
          if green < blue then hue = hue + 6 end
        elseif maxc == green then hue = (blue - red) / delta + 2
        else hue = (red - green) / delta + 4 end
        return hue * 60, saturation, lightness
      end
      local function hsl_to_rgb(hue, saturation, lightness)
        hue = hue % 360
        if saturation <= 0 then
          local value = math.floor(lightness * 255 + 0.5)
          return value, value, value
        end
        local chroma = (1 - math.abs(2 * lightness - 1)) * saturation
        local sector = hue / 60
        local secondary = chroma * (1 - math.abs(sector % 2 - 1))
        local red1, green1, blue1 = 0, 0, 0
        if sector < 1 then red1, green1, blue1 = chroma, secondary, 0
        elseif sector < 2 then red1, green1, blue1 = secondary, chroma, 0
        elseif sector < 3 then red1, green1, blue1 = 0, chroma, secondary
        elseif sector < 4 then red1, green1, blue1 = 0, secondary, chroma
        elseif sector < 5 then red1, green1, blue1 = secondary, 0, chroma
        else red1, green1, blue1 = chroma, 0, secondary end
        local match = lightness - chroma / 2
        return math.floor((red1 + match) * 255 + 0.5), math.floor((green1 + match) * 255 + 0.5), math.floor((blue1 + match) * 255 + 0.5)
      end
      local img = cel.image
      for py = 0, img.height - 1 do
        for px = 0, img.width - 1 do
          local value = img:getPixel(px, py)
          local alpha = app.pixelColor.rgbaA(value)
          if alpha > 0 then
            local hue, saturation, lightness = rgb_to_hsl(app.pixelColor.rgbaR(value), app.pixelColor.rgbaG(value), app.pixelColor.rgbaB(value))
            local red, green, blue = hsl_to_rgb(hue + ${hueShift}, math.min(1, math.max(0, saturation + (${saturationShift}) / 100)), math.min(1, math.max(0, lightness + (${lightnessShift}) / 100)))
            img:putPixel(px, py, app.pixelColor.rgba(red, green, blue, alpha))
          end
        end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Adjusted HSL (h${hueShift >= 0 ? "+" : ""}${hueShift}, s${saturationShift >= 0 ? "+" : ""}${saturationShift}, l${lightnessShift >= 0 ? "+" : ""}${lightnessShift}) on '${name}' frame ${frameIndex} in ${source}`);
  }

public async applyConvolution(filename: string, matrix: string, layerName = "", frameIndex = 1, x = 0, y = 0, width = 0, height = 0): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!CONVOLUTION_MATRICES.has(matrix)) return { ok: false, message: `Unknown convolution matrix: ${matrix}` };
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const regionError = validateNativeRegion(x, y, width, height);
    if (regionError) return regionError;
    const region = width > 0 ? [x, y, width, height] as [number, number, number, number] : undefined;
    const script = this.nativeScript(layerName, frameIndex, `app.command.ConvolutionMatrix { ui = false, fromResource = "${luaEscape(matrix)}" }`, region);
    return result(await this.runLua(script, source), `Applied convolution '${matrix}' on ${layerName || "active layer"} in ${source}`);
  }

public async listConvolutionMatrices(): Promise<AssetOperationResult> {
    return { ok: true, message: JSON.stringify([...CONVOLUTION_MATRICES].sort()) };
  }

public async applyDitherGradient(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorStart: string, colorEnd: string, horizontal = false, createIfMissing = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const start = this.parseHexColor(colorStart);
    const end = this.parseHexColor(colorEnd);
    if (!start || !end) return { ok: false, message: "Colors must use hexadecimal values" };
    const [startRed, startGreen, startBlue, startAlpha] = start;
    const [endRed, endGreen, endBlue, endAlpha] = end;
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      local img = cel.image
      local function pset(image, px, py, value)
        if px >= 0 and py >= 0 and px < image.width and py < image.height then image:putPixel(px, py, value) end
      end
      local bayer = {
        { 0, 8, 2, 10 },
        { 12, 4, 14, 6 },
        { 3, 11, 1, 9 },
        { 15, 7, 13, 5 },
      }
      for offsetY = 0, ${height - 1} do
        for offsetX = 0, ${width - 1} do
          local progress = ${horizontal ? `((${width} > 1) and (offsetX / (${width} - 1)) or 0)` : `((${height} > 1) and (offsetY / (${height} - 1)) or 0)`}
          local threshold = (bayer[(${y} + offsetY) % 4 + 1][(${x} + offsetX) % 4 + 1] + 0.5) / 16
          local color = progress >= threshold and Color(${endRed}, ${endGreen}, ${endBlue}, ${endAlpha}) or Color(${startRed}, ${startGreen}, ${startBlue}, ${startAlpha})
          pset(img, ${x} + offsetX, ${y} + offsetY, color)
        end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Dithered gradient applied on '${name}' frame ${frameIndex} in ${source}`);
  }

public async applyDitherPattern(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorA: string, colorB: string, density = 0.5, createIfMissing = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    if (!Number.isFinite(density) || density < 0 || density > 1) return { ok: false, message: "Density must be between 0 and 1" };
    const first = this.parseHexColor(colorA);
    const second = this.parseHexColor(colorB);
    if (!first || !second) return { ok: false, message: "Colors must use hexadecimal values" };
    const [firstRed, firstGreen, firstBlue, firstAlpha] = first;
    const [secondRed, secondGreen, secondBlue, secondAlpha] = second;
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      local img = cel.image
      local function pset(image, px, py, value)
        if px >= 0 and py >= 0 and px < image.width and py < image.height then image:putPixel(px, py, value) end
      end
      local bayer = {
        { 0, 8, 2, 10 },
        { 12, 4, 14, 6 },
        { 3, 11, 1, 9 },
        { 15, 7, 13, 5 },
      }
      for offsetY = 0, ${height - 1} do
        for offsetX = 0, ${width - 1} do
          local threshold = (bayer[(${y} + offsetY) % 4 + 1][(${x} + offsetX) % 4 + 1] + 0.5) / 16
          local color = ${density} > threshold and Color(${secondRed}, ${secondGreen}, ${secondBlue}, ${secondAlpha}) or Color(${firstRed}, ${firstGreen}, ${firstBlue}, ${firstAlpha})
          pset(img, ${x} + offsetX, ${y} + offsetY, color)
        end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Dither pattern applied on '${name}' frame ${frameIndex} in ${source}`);
  }

public async setTag(filename: string, name: string, fromFrame: number, toFrame: number, direction = "forward"): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const rangeError = validateFrameRange(fromFrame, toFrame);
    if (rangeError) return { ok: false, message: rangeError };
    const directions: Record<string, string> = { forward: "AniDir.FORWARD", reverse: "AniDir.REVERSE", pingpong: "AniDir.PING_PONG", pingpong_reverse: "AniDir.PING_PONG_REVERSE" };
    const luaDirection = directions[direction];
    if (!luaDirection) return { ok: false, message: `Unsupported direction: ${direction}` };
    const script = this.openScript(filename, `
      if ${fromFrame} < 1 or ${toFrame} > #spr.frames or ${fromFrame} > ${toFrame} then print("ERROR:Frame range out of bounds") return end
      local tag = nil
      for _, current in ipairs(spr.tags) do if current.name == "${luaEscape(name)}" then tag = current break end end
      if not tag then tag = spr:newTag(${fromFrame}, ${toFrame}) end
      tag.name = "${luaEscape(name)}"
      tag.fromFrame = spr.frames[${fromFrame}]
      tag.toFrame = spr.frames[${toFrame}]
      tag.aniDir = ${luaDirection}
    `);
    return result(await this.runLua(script, filename), `Tag '${name}' set in ${filename}`);
  }
}
