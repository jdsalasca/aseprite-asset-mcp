import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AnimationAuditInput, AnimationEasing, AnimationSanitizeInput, AssetRuntimePort, AssetOperationResult, CopyLayersInput, PixelInput, PointInput, ScaleAnchor, TextDrawInput, TilePixelInput, TilePlacementInput } from "../../domain/asset-operations.js";
import { availableTextFonts, measureText as rasterMeasureText, rasterizeText } from "../text/TextRasterizer.js";
import { AsepriteCommandAdapter, execFileAsync, previewServers, SHEET_TYPES, DATA_FORMATS, ANIMATION_EASINGS, SCALE_ANCHORS, UNSAFE_LUA_PATTERNS, BLEND_MODES, PALETTE_PRESETS, rgbToHsl, hslToHex, CONVOLUTION_MATRICES, luaEscape, safePath, validatePath, isPositiveInteger, validateFrameRange, isHexColor, validateName, validateNativeRegion, result, parsePixelFields } from "./AsepriteCommandAdapter.js";
import type { ExportAnimationPort } from "../../application/ports/AssetCapabilityPorts.js";

export class AsepriteExportAdapter extends AsepriteCommandAdapter implements ExportAnimationPort {
public async exportSprite(filename: string, outputFilename: string, format = "png"): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const output = validatePath(outputFilename);
    if (typeof output !== "string") return output;
    const normalizedFormat = format.trim().toLowerCase();
    if (!/^[a-z0-9]+$/.test(normalizedFormat)) return { ok: false, message: "Format must contain only letters and numbers" };
    const target = output.toLowerCase().endsWith(`.${normalizedFormat}`) ? output : `${output}.${normalizedFormat}`;
    const command = await this.commandRunner(["--batch", source, "--save-as", target]);
    if (!command.ok) return result(command, `Sprite exported to ${target}`);
    const produced = await this.findProducedOutput(target);
    if (!produced) return { ok: false, message: "Aseprite exited successfully but did not create the exported sprite" };
    if (produced !== target) await fs.rename(produced, target);
    return { ok: true, message: `Sprite exported successfully to ${target}` };
  }

public async copySprite(filename: string, outputFilename: string, overwrite = false): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const output = validatePath(outputFilename);
    if (typeof output !== "string") return output;
    const target = output.toLowerCase().endsWith(".aseprite") ? output : `${output}.aseprite`;
    if (!overwrite && await this.findProducedOutput(target)) return { ok: false, message: `Output file ${target} already exists` };
    const script = `
      if not app.activeSprite then print("ERROR:No active sprite") return end
      app.activeSprite:saveAs("${luaEscape(target.replaceAll("\\", "/"))}")
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return result(command, `Sprite copied to ${target}`);
    if (!(await this.findProducedOutput(target))) return { ok: false, message: "Aseprite exited successfully but did not create the copied sprite" };
    return { ok: true, message: `Sprite copied to ${target}` };
  }

public async exportFrame(filename: string, frameIndex: number, outputFilename: string, scale = 1): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const output = validatePath(outputFilename);
    if (typeof output !== "string") return output;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };

    if (!Number.isInteger(scale) || scale < 1 || scale > 64) return { ok: false, message: "Scale must be between 1 and 64" };
    const target = output.toLowerCase().endsWith(".png") ? output : `${output}.png`;
    const command = await this.commandRunner(["--batch", source, "--frame-range", `${frameIndex - 1},${frameIndex - 1}`, "--scale", String(scale), "--save-as", target]);
    if (!command.ok) return result(command, `Frame ${frameIndex} exported to ${target}`);
    const produced = await this.findProducedOutput(target);
    if (!produced) return { ok: false, message: `Export reported success but ${target} was not created` };
    if (produced !== target) await fs.rename(produced, target);
    return { ok: true, message: `Frame ${frameIndex} exported to ${target} at ${scale}x` };
  }

public async exportLayers(filename: string, outputDirectory: string, includeHidden = false): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const directory = validatePath(outputDirectory);
    if (typeof directory !== "string") return directory;
    await fs.mkdir(directory, { recursive: true });
    const before = new Set((await fs.readdir(directory)).filter((entry) => entry.toLowerCase().endsWith(".png")));
    const args = ["--batch"];
    if (includeHidden) args.push("--all-layers");
    args.push("--split-layers", source, "--save-as", path.join(directory, "{layer}.png"));
    const command = await this.commandRunner(args);
    if (!command.ok) return result(command, `Layers exported to ${directory}`);
    const produced = (await fs.readdir(directory)).filter((entry) => entry.toLowerCase().endsWith(".png") && !before.has(entry)).sort();
    if (produced.length === 0) return { ok: false, message: "Aseprite exited successfully but did not create layer PNG files" };
    return { ok: true, message: `Layers exported to ${directory}: ${produced.join(", ")}` };
  }

public async exportTag(filename: string, tagName: string, outputFilename: string, scale = 1): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(tagName, "Tag name");
    if (typeof name !== "string") return name;
    const output = validatePath(outputFilename);
    if (typeof output !== "string") return output;
    if (!isPositiveInteger(scale) || scale > 64) return { ok: false, message: "Scale must be between 1 and 64" };
    const tagCheck = await this.resolveTagRange(source, name);
    if (!tagCheck.ok) return { ok: false, message: `Tag not found: ${tagCheck.output}` };
    const target = path.extname(output) ? output : `${output}.png`;
    const args = ["--batch", source, "--tag", name];
    if (scale > 1) args.push("--scale", String(scale));
    args.push("--save-as", target);
    const command = await this.commandRunner(args);
    if (!command.ok) return result(command, `Tag '${name}' exported to ${target}`);
    const produced = await this.findProducedOutput(target);
    if (!produced) return { ok: false, message: "Aseprite exited successfully but did not create the tag export" };
    if (produced !== target) await fs.rename(produced, target);
    return { ok: true, message: `Tag '${name}' exported to ${target}` };
  }

public async importImageAsLayer(filename: string, imagePath: string, layerName: string, frameIndex = 1, x = 0, y = 0): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const image = validatePath(imagePath);
    if (typeof image !== "string") return image;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    try {
      await fs.access(image);
    } catch {
      return { ok: false, message: `Image file not found: ${image}` };
    }
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local imported = Image { fromFile = "${luaEscape(image.replaceAll("\\", "/"))}" }
      if not imported then print("ERROR:Could not load image") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then target = spr:newLayer() target.name = "${luaEscape(name)}" end
      local frame = spr.frames[${frameIndex}]
      local cel = target:cel(frame)
      if not cel then cel = spr:newCel(target, frame, Image(spr.width, spr.height, spr.colorMode), Point(0, 0)) end
      cel.image:drawImage(imported, Point(${x}, ${y}))
    `);
    return result(await this.runLua(script, source), `Image imported into '${name}' frame ${frameIndex} in ${source}`);
  }

public async createCel(filename: string, layerName: string, frameIndex: number, x = 0, y = 0): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local frame = spr.frames[${frameIndex}]
      if not target:cel(frame) then spr:newCel(target, frame, Image(spr.width, spr.height, spr.colorMode), Point(${x}, ${y})) end
    `);
    return result(await this.runLua(script, source), `Cel created on '${name}' frame ${frameIndex} in ${source}`);
  }

public async clearCel(filename: string, layerName: string, frameIndex: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local cel = target:cel(spr.frames[${frameIndex}])
      if cel then spr:deleteCel(cel) end
    `);
    return result(await this.runLua(script, source), `Cel cleared on '${name}' frame ${frameIndex} in ${source}`);
  }

public async copyCel(filename: string, layerName: string, sourceFrame: number, targetFrame: number, replace = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(sourceFrame)) return { ok: false, message: "Source frame must be a positive integer" };
    if (!isPositiveInteger(targetFrame)) return { ok: false, message: "Target frame must be a positive integer" };
    const script = this.openScript(source, `
      if ${sourceFrame} > #spr.frames then print("ERROR:Source frame out of range") return end
      if ${targetFrame} > #spr.frames then print("ERROR:Target frame out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local sourceCel = target:cel(spr.frames[${sourceFrame}])
      if not sourceCel then print("ERROR:Source cel not found") return end
      local targetCel = target:cel(spr.frames[${targetFrame}])
      if targetCel and ${replace ? "true" : "false"} then spr:deleteCel(targetCel) targetCel = nil end
      if not targetCel then spr:newCel(target, spr.frames[${targetFrame}], sourceCel.image:clone(), sourceCel.position) end
    `);
    return result(await this.runLua(script, source), `Cel copied on '${name}' from frame ${sourceFrame} to ${targetFrame} in ${source}`);
  }

public async copyFrame(filename: string, sourceFrame: number, targetFrame?: number, overwrite = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(sourceFrame)) return { ok: false, message: "Source frame must be a positive integer" };
    if (targetFrame !== undefined && !isPositiveInteger(targetFrame)) return { ok: false, message: "Target frame must be a positive integer" };
    const destination = targetFrame === undefined ? "nil" : String(targetFrame);
    const message = targetFrame === undefined ? `Frame ${sourceFrame} copied to new frame in ${source}` : `Frame ${sourceFrame} copied to frame ${targetFrame} in ${source}`;
    const script = this.openScript(source, `
      if ${sourceFrame} > #spr.frames then print("ERROR:Source frame out of range") return end
      local destinationIndex = ${destination}
      if destinationIndex ~= nil and destinationIndex > #spr.frames then print("ERROR:Target frame out of range") return end
      local destinationFrame = destinationIndex == nil and spr:newFrame() or spr.frames[destinationIndex]
      local function visit(layer)
        if layer.isGroup then
          for _, child in ipairs(layer.layers) do visit(child) end
          return
        end
        if ${overwrite ? "true" : "false"} then
          local old = layer:cel(destinationFrame)
          if old then spr:deleteCel(old) end
        end
        local sourceCel = layer:cel(spr.frames[${sourceFrame}])
        if sourceCel and not layer:cel(destinationFrame) then spr:newCel(layer, destinationFrame, sourceCel.image:clone(), sourceCel.position) end
      end
      for _, layer in ipairs(spr.layers) do visit(layer) end
    `);
    return result(await this.runLua(script, source), message);
  }

public async setCelPosition(filename: string, layerName: string, frameIndex: number, x: number, y: number, createIfMissing = false, sourceFrameIndex?: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (sourceFrameIndex !== undefined && !isPositiveInteger(sourceFrameIndex)) return { ok: false, message: "Source frame must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    const sourceIndex = sourceFrameIndex === undefined ? "nil" : String(sourceFrameIndex);
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local frame = spr.frames[${frameIndex}]
      local cel = target:cel(frame)
      if not cel and ${createIfMissing ? "true" : "false"} then
        local sourceIndex = ${sourceIndex}
        if sourceIndex == nil then sourceIndex = ${frameIndex} end
        if sourceIndex < 1 or sourceIndex > #spr.frames then print("ERROR:Source frame out of range") return end
        local sourceCel = target:cel(spr.frames[sourceIndex])
        cel = sourceCel and spr:newCel(target, frame, sourceCel.image:clone(), sourceCel.position) or spr:newCel(target, frame, Image(spr.width, spr.height, spr.colorMode), Point(0, 0))
      end
      if not cel then print("ERROR:Cel not found") return end
      cel.position = Point(${x}, ${y})
    `);
    return result(await this.runLua(script, source), `Cel position set to (${x}, ${y}) on '${name}' frame ${frameIndex} in ${source}`);
  }

public async tweenCelPositions(filename: string, layerName: string, startFrame: number, endFrame: number, startX: number, startY: number, endX: number, endY: number, createMissingCels = false, sourceFrameIndex?: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const rangeError = validateFrameRange(startFrame, endFrame);
    if (rangeError) return { ok: false, message: rangeError };
    if (sourceFrameIndex !== undefined && !isPositiveInteger(sourceFrameIndex)) return { ok: false, message: "Source frame must be a positive integer" };
    if (![startX, startY, endX, endY].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    const sourceIndex = sourceFrameIndex === undefined ? "nil" : String(sourceFrameIndex);
    const script = this.openScript(source, `
      if ${startFrame} < 1 or ${endFrame} > #spr.frames or ${startFrame} > ${endFrame} then print("ERROR:Frame range out of bounds") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local span = ${endFrame} - ${startFrame}
      for index = ${startFrame}, ${endFrame} do
        local t = span > 0 and ((index - ${startFrame}) / span) or 0
        local positionX = math.floor(${startX} + (${endX} - ${startX}) * t + 0.5)
        local positionY = math.floor(${startY} + (${endY} - ${startY}) * t + 0.5)
        local cel = target:cel(spr.frames[index])
        if not cel and ${createMissingCels ? "true" : "false"} then
          local sourceIndex = ${sourceIndex}
          if sourceIndex == nil then sourceIndex = ${startFrame} end
          if sourceIndex < 1 or sourceIndex > #spr.frames then print("ERROR:Source frame out of range") return end
          local sourceCel = target:cel(spr.frames[sourceIndex])
          cel = sourceCel and spr:newCel(target, spr.frames[index], sourceCel.image:clone(), sourceCel.position) or spr:newCel(target, spr.frames[index], Image(spr.width, spr.height, spr.colorMode), Point(0, 0))
        end
        if cel then cel.position = Point(positionX, positionY) end
      end
    `);
    return result(await this.runLua(script, source), `Tweened cel positions on '${name}' frames ${startFrame}-${endFrame} in ${source}`);
  }

public async offsetCelPositions(filename: string, layerName: string, startFrame: number, endFrame: number, dx: number, dy: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const rangeError = validateFrameRange(startFrame, endFrame);
    if (rangeError) return { ok: false, message: rangeError };
    if (![dx, dy].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Offset values must be integers" };
    const script = this.openScript(source, `
      if ${startFrame} < 1 or ${endFrame} > #spr.frames or ${startFrame} > ${endFrame} then print("ERROR:Frame range out of bounds") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      for index = ${startFrame}, ${endFrame} do
        local cel = target:cel(spr.frames[index])
        if cel then cel.position = Point(cel.position.x + ${dx}, cel.position.y + ${dy}) end
      end
    `);
    return result(await this.runLua(script, source), `Offset cel positions by (${dx}, ${dy}) on '${name}' frames ${startFrame}-${endFrame} in ${source}`);
  }

public async propagateFrameToRange(filename: string, sourceFrame: number, startFrame: number, endFrame: number, overwrite = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(sourceFrame)) return { ok: false, message: "Source frame must be a positive integer" };
    const rangeError = validateFrameRange(startFrame, endFrame);
    if (rangeError) return { ok: false, message: rangeError };
    const script = this.openScript(source, `
      if ${sourceFrame} > #spr.frames or ${startFrame} < 1 or ${endFrame} > #spr.frames then print("ERROR:Frame range out of bounds") return end
      local function visit(layer, destinationFrame)

        if layer.isGroup then
          for _, child in ipairs(layer.layers) do visit(child, destinationFrame) end
          return
        end
        if ${overwrite ? "true" : "false"} then
          local old = layer:cel(destinationFrame)
          if old then spr:deleteCel(old) end
        end
        local sourceCel = layer:cel(spr.frames[${sourceFrame}])
        if sourceCel and not layer:cel(destinationFrame) then spr:newCel(layer, destinationFrame, sourceCel.image:clone(), sourceCel.position) end
      end
      for index = ${startFrame}, ${endFrame} do
        if index ~= ${sourceFrame} then
          for _, layer in ipairs(spr.layers) do visit(layer, spr.frames[index]) end
        end
      end
    `);
    return result(await this.runLua(script, source), `Frame ${sourceFrame} propagated to frames ${startFrame}-${endFrame} in ${source}`);
  }

public async deleteFrame(filename: string, frameIndex: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      if #spr.frames <= 1 then print("ERROR:Cannot delete the only frame") return end
      spr:deleteFrame(spr.frames[${frameIndex}])
    `);
    return result(await this.runLua(script, source), `Frame ${frameIndex} deleted from ${source}`);
  }

public async deleteTag(filename: string, name: string): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const tagName = validateName(name, "Tag name");
    if (typeof tagName !== "string") return tagName;
    const script = this.openScript(source, `
      local target = nil
      for _, tag in ipairs(spr.tags) do if tag.name == "${luaEscape(tagName)}" then target = tag break end end
      if not target then print("ERROR:Tag not found") return end
      spr:deleteTag(target)
    `);
    return result(await this.runLua(script, source), `Tag '${tagName}' deleted from ${source}`);
  }

public async setOnionSkin(filename: string, enabled = true, before = 2, after = 2, opacity = 128): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!Number.isInteger(before) || !Number.isInteger(after) || before < 0 || after < 0) return { ok: false, message: "Before and after must be non-negative integers" };
    if (!Number.isInteger(opacity) || opacity < 0 || opacity > 255) return { ok: false, message: "Opacity must be between 0 and 255" };
    return { ok: true, message: `Onion skin settings are UI-only in batch mode; no changes applied (enabled=${enabled}, before=${before}, after=${after}, opacity=${opacity})` };
  }

public async renderOnionSkin(filename: string, frameIndex: number, outputFilename: string, before = 1, after = 1, scale = 4, ghostOpacity = 100): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const output = validatePath(outputFilename);
    if (typeof output !== "string") return output;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Number.isInteger(before) || !Number.isInteger(after) || before < 0 || after < 0) return { ok: false, message: "Before and after must be non-negative integers" };
    if (!Number.isInteger(scale) || scale < 1 || scale > 64) return { ok: false, message: "Scale must be between 1 and 64" };
    if (!Number.isInteger(ghostOpacity) || ghostOpacity < 0 || ghostOpacity > 255) return { ok: false, message: "Ghost opacity must be between 0 and 255" };
    const target = output.toLowerCase().endsWith(".png") ? output : `${output}.png`;
    const script = `
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local clone = Sprite(spr)
      clone:flatten()
      local layer = clone.layers[#clone.layers]
      local function frame_image(index)
        local image = Image(clone.width, clone.height, ColorMode.RGB)
        local cel = layer:cel(clone.frames[index])
        if cel then image:drawImage(cel.image, cel.position) end
        return image
      end
      local composite = Image(clone.width, clone.height, ColorMode.RGB)
      local white = Color(255, 255, 255, 255)
      for py = 0, composite.height - 1 do for px = 0, composite.width - 1 do composite:putPixel(px, py, white) end end
      for offset = ${before}, 1, -1 do
        local index = ${frameIndex} - offset
        if index >= 1 then composite:drawImage(frame_image(index), Point(0, 0), ${ghostOpacity}, BlendMode.NORMAL) end
      end
      for offset = ${after}, 1, -1 do
        local index = ${frameIndex} + offset
        if index <= #clone.frames then composite:drawImage(frame_image(index), Point(0, 0), ${ghostOpacity}, BlendMode.NORMAL) end
      end
      composite:drawImage(frame_image(${frameIndex}), Point(0, 0), 255, BlendMode.NORMAL)
      local large = Image(composite.width * ${scale}, composite.height * ${scale}, ColorMode.RGB)
      for py = 0, composite.height - 1 do
        for px = 0, composite.width - 1 do
          local value = composite:getPixel(px, py)
          for oy = 0, ${scale - 1} do for ox = 0, ${scale - 1} do large:putPixel(px * ${scale} + ox, py * ${scale} + oy, value) end end
        end
      end
      large:saveAs("${luaEscape(target.replaceAll("\\", "/"))}")
      print("OK")
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return result(command, `Onion-skin render saved to ${target}`);
    const produced = await this.findProducedOutput(target);
    if (!produced) return { ok: false, message: `Aseprite exited successfully but did not create ${target}` };
    if (produced !== target) await fs.rename(produced, target);
    return { ok: true, message: `Onion-skin render of frame ${frameIndex} saved to ${target} at ${scale}x` };
  }

public async compareFrames(filename: string, frameA: number, frameB: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!isPositiveInteger(frameA) || !isPositiveInteger(frameB)) return { ok: false, message: "Frame A and frame B must be positive integers" };
    const script = `
      local spr = app.activeSprite
      if not spr then print("ERROR:No active sprite") return end
      if ${frameA} > #spr.frames or ${frameB} > #spr.frames then print("ERROR:Frame index out of range") return end
      local clone = Sprite(spr)
      clone:flatten()
      local layer = clone.layers[#clone.layers]
      local function frame_image(index)
        local image = Image(clone.width, clone.height, ColorMode.RGB)
        local cel = layer:cel(clone.frames[index])
        if cel then image:drawImage(cel.image, cel.position) end
        return image
      end
      local first = frame_image(${frameA})
      local second = frame_image(${frameB})
      local changed = 0
      local minX, minY = math.huge, math.huge
      local maxX, maxY = -1, -1
      for py = 0, first.height - 1 do
        for px = 0, first.width - 1 do
          local left = first:getPixel(px, py)
          local right = second:getPixel(px, py)
          local different = app.pixelColor.rgbaR(left) ~= app.pixelColor.rgbaR(right) or app.pixelColor.rgbaG(left) ~= app.pixelColor.rgbaG(right) or app.pixelColor.rgbaB(left) ~= app.pixelColor.rgbaB(right) or app.pixelColor.rgbaA(left) ~= app.pixelColor.rgbaA(right)
          if different then
            changed = changed + 1
            if px < minX then minX = px end
            if py < minY then minY = py end
            if px > maxX then maxX = px end
            if py > maxY then maxY = py end
          end
        end
      end
      local total = first.width * first.height
      local percent = total > 0 and (changed * 100.0 / total) or 0
      local bounds = changed > 0 and string.format("{\\"minX\\":%d,\\"minY\\":%d,\\"maxX\\":%d,\\"maxY\\":%d}", minX, minY, maxX, maxY) or "null"
      print(string.format("COMPARE:{\\"frameA\\":%d,\\"frameB\\":%d,\\"changedPixels\\":%d,\\"totalPixels\\":%d,\\"percentChanged\\":%.2f,\\"bounds\\":%s}", ${frameA}, ${frameB}, changed, total, percent, bounds))
    `;
    const command = await this.runLua(script, source);
    if (!command.ok) return result(command, "Frame comparison failed");
    const line = command.output.split(/\r?\n/).find((entry) => entry.startsWith("COMPARE:"));
    return line ? { ok: true, message: line.slice("COMPARE:".length) } : { ok: false, message: "Frame comparison returned no metrics" };
  }

public async setCelOpacity(filename: string, layerName: string, frameIndex: number, opacity: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Number.isInteger(opacity) || opacity < 0 || opacity > 255) return { ok: false, message: "Opacity must be between 0 and 255" };
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      local cel = target:cel(spr.frames[${frameIndex}])
      if not cel then print("ERROR:No cel at that layer/frame") return end
      cel.opacity = ${opacity}
    `);
    return result(await this.runLua(script, source), `Cel opacity set to ${opacity} on '${name}' frame ${frameIndex} in ${source}`);
  }
}
