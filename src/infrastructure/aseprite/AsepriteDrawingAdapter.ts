import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AnimationAuditInput, AnimationEasing, AnimationSanitizeInput, AssetRuntimePort, AssetOperationResult, CopyLayersInput, PixelInput, PointInput, ScaleAnchor, TextDrawInput, TilePixelInput, TilePlacementInput } from "../../domain/asset-operations.js";
import { availableTextFonts, measureText as rasterMeasureText, rasterizeText } from "../text/TextRasterizer.js";
import { AsepriteCommandAdapter, execFileAsync, previewServers, SHEET_TYPES, DATA_FORMATS, ANIMATION_EASINGS, SCALE_ANCHORS, UNSAFE_LUA_PATTERNS, BLEND_MODES, PALETTE_PRESETS, rgbToHsl, hslToHex, CONVOLUTION_MATRICES, luaEscape, safePath, validatePath, isPositiveInteger, validateFrameRange, isHexColor, validateName, validateNativeRegion, result, parsePixelFields } from "./AsepriteCommandAdapter.js";
import type { DrawingPort } from "../../application/ports/AssetCapabilityPorts.js";

export class AsepriteDrawingAdapter extends AsepriteCommandAdapter implements DrawingPort {
public async drawPixels(filename: string, pixels: PixelInput[]): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!Array.isArray(pixels) || pixels.length === 0) return { ok: false, message: "Pixels list cannot be empty" };
    const commands: string[] = [];
    for (const pixel of pixels) {
      if (!Number.isInteger(pixel.x) || !Number.isInteger(pixel.y)) return { ok: false, message: "Pixel coordinates must be integers" };
      const rgba = this.parseHexColor(pixel.color);
      if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
      const [red, green, blue, alpha] = rgba;
      commands.push(`img:putPixel(${pixel.x} - cox, ${pixel.y} - coy, Color(${red}, ${green}, ${blue}, ${alpha}))`);
    }
    const script = this.openScript(source, `
      local cel = app.activeCel
      if not cel then
        app.activeLayer = spr.layers[1]
        app.activeFrame = spr.frames[1]
        cel = app.activeCel
        if not cel then print("ERROR:No active cel and couldn't create one") return end
      end
      local img = cel.image
      local cox = cel.position.x
      local coy = cel.position.y
      ${commands.join("\n      ")}
    `);
    return result(await this.runLua(script, source), `Pixels drawn successfully in ${source}`);
  }

public async drawLine(filename: string, x1: number, y1: number, x2: number, y2: number, color: string, thickness = 1): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (![x1, y1, x2, y2].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(thickness)) return { ok: false, message: "Thickness must be a positive integer" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const script = this.openScript(source, `
      local cel = app.activeCel
      if not cel then
        app.activeLayer = spr.layers[1]
        app.activeFrame = spr.frames[1]
        cel = app.activeCel
        if not cel then print("ERROR:No active cel and couldn't create one") return end
      end
      local img = cel.image
      local cox = cel.position.x
      local coy = cel.position.y
      local color = Color(${red}, ${green}, ${blue}, ${alpha})
      local function put_thick(image, px, py, paint, size)
        local radius = math.max(0, math.floor(size / 2))
        for offsetY = -radius, radius do
          for offsetX = -radius, radius do
            image:putPixel(px + offsetX, py + offsetY, paint)
          end
        end
      end
      local px0 = ${x1} - cox
      local py0 = ${y1} - coy
      local px1 = ${x2} - cox
      local py1 = ${y2} - coy
      local dx = math.abs(px1 - px0)
      local stepX = px0 < px1 and 1 or -1
      local dy = -math.abs(py1 - py0)
      local stepY = py0 < py1 and 1 or -1
      local errorValue = dx + dy
      while true do
        if ${thickness} > 1 then put_thick(img, px0, py0, color, ${thickness}) else img:putPixel(px0, py0, color) end
        if px0 == px1 and py0 == py1 then break end

        local doubleError = 2 * errorValue
        if doubleError >= dy then errorValue = errorValue + dy; px0 = px0 + stepX end
        if doubleError <= dx then errorValue = errorValue + dx; py0 = py0 + stepY end
      end
    `);
    return result(await this.runLua(script, source), `Line drawn successfully in ${source}`);
  }

public async drawRectangle(filename: string, x: number, y: number, width: number, height: number, color: string, fill = false): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !isPositiveInteger(width) || !isPositiveInteger(height)) {
      return { ok: false, message: "Width and height must be positive integers" };
    }
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const x2 = x + width - 1;
    const y2 = y + height - 1;
    const tool = fill ? "filled_rectangle" : "rectangle";
    const script = this.openScript(filename, `
      local cel = app.activeCel
      if not cel then print("ERROR:No active cel") return end
      app.useTool({
        tool="${tool}",
        color=Color(${red}, ${green}, ${blue}, ${alpha}),
        points={Point(${x}, ${y}), Point(${x2}, ${y2})}
      })
    `);
    return result(await this.runLua(script, filename), `Rectangle drawn in ${filename}`);
  }

public async fillArea(filename: string, x: number, y: number, color: string): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return { ok: false, message: "Coordinates must be integers" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const script = this.openScript(source, `
      local cel = app.activeCel
      if not cel then
        app.activeLayer = spr.layers[1]
        app.activeFrame = spr.frames[1]
        cel = app.activeCel
        if not cel then print("ERROR:No active cel and couldn't create one") return end
      end
      app.useTool({
        tool = "paint_bucket",
        color = Color(${red}, ${green}, ${blue}, ${alpha}),
        points = { Point(${x}, ${y}) }
      })
    `);
    return result(await this.runLua(script, source), `Area filled successfully in ${source}`);
  }

public async drawCircle(filename: string, centerX: number, centerY: number, radius: number, color: string, fill = false): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!Number.isInteger(centerX) || !Number.isInteger(centerY)) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(radius)) return { ok: false, message: "Radius must be a positive integer" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const tool = fill ? "filled_ellipse" : "ellipse";
    const script = this.openScript(source, `
      local cel = app.activeCel
      if not cel then
        app.activeLayer = spr.layers[1]
        app.activeFrame = spr.frames[1]
        cel = app.activeCel
        if not cel then print("ERROR:No active cel and couldn't create one") return end
      end
      app.useTool({
        tool = "${tool}",
        color = Color(${red}, ${green}, ${blue}, ${alpha}),
        points = { Point(${centerX - radius}, ${centerY - radius}), Point(${centerX + radius}, ${centerY + radius}) }
      })
    `);
    return result(await this.runLua(script, source), `Circle drawn successfully in ${source}`);
  }

public async drawPixelsAt(filename: string, layerName: string, frameIndex: number, pixels: PixelInput[], createIfMissing = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Array.isArray(pixels) || pixels.length === 0) return { ok: false, message: "Pixels list cannot be empty" };
    const commands: string[] = [];
    for (const pixel of pixels) {
      if (!Number.isInteger(pixel.x) || !Number.isInteger(pixel.y)) return { ok: false, message: "Pixel coordinates must be integers" };
      const rgba = this.parseHexColor(pixel.color);
      if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
      const [red, green, blue, alpha] = rgba;
      commands.push(`img:putPixel(${pixel.x} - cox, ${pixel.y} - coy, Color(${red}, ${green}, ${blue}, ${alpha}))`);
    }
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      local img = cel.image
      local cox = cel.position.x
      local coy = cel.position.y
      ${commands.join("\n      ")}
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Pixels drawn on '${name}' frame ${frameIndex} in ${source}`);
  }

public async drawLineAt(filename: string, layerName: string, frameIndex: number, x1: number, y1: number, x2: number, y2: number, color: string, thickness = 1, createIfMissing = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x1, y1, x2, y2].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(thickness)) return { ok: false, message: "Thickness must be a positive integer" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      local img = cel.image
      local cox = cel.position.x
      local coy = cel.position.y
      local paint = Color(${red}, ${green}, ${blue}, ${alpha})
      local function put_thick(image, px, py, colorValue, size)
        local radius = math.max(0, math.floor(size / 2))
        for offsetY = -radius, radius do
          for offsetX = -radius, radius do image:putPixel(px + offsetX, py + offsetY, colorValue) end
        end
      end
      local px0 = ${x1} - cox
      local py0 = ${y1} - coy
      local px1 = ${x2} - cox
      local py1 = ${y2} - coy
      local dx = math.abs(px1 - px0)
      local stepX = px0 < px1 and 1 or -1
      local dy = -math.abs(py1 - py0)
      local stepY = py0 < py1 and 1 or -1
      local errorValue = dx + dy
      while true do
        if ${thickness} > 1 then put_thick(img, px0, py0, paint, ${thickness}) else img:putPixel(px0, py0, paint) end
        if px0 == px1 and py0 == py1 then break end
        local doubleError = 2 * errorValue
        if doubleError >= dy then errorValue = errorValue + dy; px0 = px0 + stepX end
        if doubleError <= dx then errorValue = errorValue + dx; py0 = py0 + stepY end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Line drawn on '${name}' frame ${frameIndex} in ${source}`);
  }

public async drawRectangleAt(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, color: string, fill = false, createIfMissing = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const tool = fill ? "filled_rectangle" : "rectangle";
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      app.useTool({
        tool = "${tool}",
        color = Color(${red}, ${green}, ${blue}, ${alpha}),
        points = { Point(${x}, ${y}), Point(${x + width - 1}, ${y + height - 1}) }
      })
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Rectangle drawn on '${name}' frame ${frameIndex} in ${source}`);
  }

public async drawCircleAt(filename: string, layerName: string, frameIndex: number, centerX: number, centerY: number, radius: number, color: string, fill = false, createIfMissing = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![centerX, centerY].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(radius)) return { ok: false, message: "Radius must be a positive integer" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const tool = fill ? "filled_ellipse" : "ellipse";
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      app.useTool({
        tool = "${tool}",
        color = Color(${red}, ${green}, ${blue}, ${alpha}),
        points = { Point(${centerX - radius}, ${centerY - radius}), Point(${centerX + radius}, ${centerY + radius}) }
      })
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Circle drawn on '${name}' frame ${frameIndex} in ${source}`);
  }

public async fillAreaAt(filename: string, layerName: string, frameIndex: number, x: number, y: number, color: string, createIfMissing = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![x, y].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      app.useTool({
        tool = "paint_bucket",
        color = Color(${red}, ${green}, ${blue}, ${alpha}),
        points = { Point(${x}, ${y}) }
      })
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Area filled on '${name}' frame ${frameIndex} in ${source}`);
  }

public async drawPolygon(filename: string, layerName: string, frameIndex: number, points: PointInput[], color = "#000000", fill = false, createIfMissing = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Array.isArray(points) || points.length < 3) return { ok: false, message: "Polygon requires at least 3 points" };
    if (points.some((point) => !Number.isInteger(point.x) || !Number.isInteger(point.y))) return { ok: false, message: "Point coordinates must be integers" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const luaPoints = points.map((point) => `{ x = ${point.x}, y = ${point.y} }`).join(", ");
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      local img = cel.image
      local function pset(image, px, py, value)
        if px >= 0 and py >= 0 and px < image.width and py < image.height then image:putPixel(px, py, value) end
      end
      local function draw_line(image, x0, y0, x1, y1, value)
        local dx = math.abs(x1 - x0)
        local sx = x0 < x1 and 1 or -1
        local dy = -math.abs(y1 - y0)
        local sy = y0 < y1 and 1 or -1
        local errorValue = dx + dy
        while true do
          pset(image, x0, y0, value)
          if x0 == x1 and y0 == y1 then break end
          local doubleError = 2 * errorValue
          if doubleError >= dy then errorValue = errorValue + dy; x0 = x0 + sx end
          if doubleError <= dx then errorValue = errorValue + dx; y0 = y0 + sy end
        end
      end
      local function fill_polygon(image, polygon, value)
        local minY = polygon[1].y
        local maxY = polygon[1].y
        for index = 2, #polygon do
          if polygon[index].y < minY then minY = polygon[index].y end
          if polygon[index].y > maxY then maxY = polygon[index].y end
        end

        for scanY = minY, maxY do
          local nodes = {}
          local previous = #polygon
          for index = 1, #polygon do
            local current = polygon[index]
            local prior = polygon[previous]
            if (current.y < scanY and prior.y >= scanY) or (prior.y < scanY and current.y >= scanY) then
              table.insert(nodes, current.x + (scanY - current.y) * (prior.x - current.x) / (prior.y - current.y))
            end
            previous = index
          end
          table.sort(nodes)
          for index = 1, #nodes, 2 do
            if nodes[index + 1] then
              for scanX = math.floor(nodes[index] + 0.5), math.floor(nodes[index + 1] + 0.5) do pset(image, scanX, scanY, value) end
            end
          end
        end
      end
      local polygon = { ${luaPoints} }
      local paint = Color(${red}, ${green}, ${blue}, ${alpha})
      if ${fill ? "true" : "false"} then fill_polygon(img, polygon, paint) end
      for index = 1, #polygon do
        local nextIndex = index + 1
        if nextIndex > #polygon then nextIndex = 1 end
        draw_line(img, polygon[index].x, polygon[index].y, polygon[nextIndex].x, polygon[nextIndex].y, paint)
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Polygon drawn on '${name}' frame ${frameIndex} in ${source}`);
  }

public async drawPath(filename: string, layerName: string, frameIndex: number, points: PointInput[], color = "#000000", thickness = 1, createIfMissing = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Array.isArray(points) || points.length < 2) return { ok: false, message: "Path requires at least 2 points" };
    if (points.some((point) => !Number.isInteger(point.x) || !Number.isInteger(point.y))) return { ok: false, message: "Point coordinates must be integers" };
    if (!isPositiveInteger(thickness)) return { ok: false, message: "Thickness must be a positive integer" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const luaPoints = points.map((point) => `{ x = ${point.x}, y = ${point.y} }`).join(", ");
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      local img = cel.image
      local function pset(image, px, py, value)
        if px >= 0 and py >= 0 and px < image.width and py < image.height then image:putPixel(px, py, value) end
      end
      local function put_thick(image, px, py, value, size)
        local radius = math.max(0, math.floor(size / 2))
        for offsetY = -radius, radius do
          for offsetX = -radius, radius do pset(image, px + offsetX, py + offsetY, value) end
        end
      end
      local function draw_line(image, x0, y0, x1, y1, value, size)
        local dx = math.abs(x1 - x0)
        local sx = x0 < x1 and 1 or -1
        local dy = -math.abs(y1 - y0)
        local sy = y0 < y1 and 1 or -1
        local errorValue = dx + dy
        while true do
          if size > 1 then put_thick(image, x0, y0, value, size) else pset(image, x0, y0, value) end
          if x0 == x1 and y0 == y1 then break end
          local doubleError = 2 * errorValue
          if doubleError >= dy then errorValue = errorValue + dy; x0 = x0 + sx end
          if doubleError <= dx then errorValue = errorValue + dx; y0 = y0 + sy end
        end
      end
      local points = { ${luaPoints} }
      local paint = Color(${red}, ${green}, ${blue}, ${alpha})
      for index = 1, #points - 1 do draw_line(img, points[index].x, points[index].y, points[index + 1].x, points[index + 1].y, paint, ${thickness}) end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Path drawn on '${name}' frame ${frameIndex} in ${source}`);
  }

public async applyGradientRect(filename: string, layerName: string, frameIndex: number, x: number, y: number, width: number, height: number, colorStart: string, colorEnd: string, horizontal = true, createIfMissing = true): Promise<AssetOperationResult> {
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
      for offsetY = 0, ${height - 1} do
        for offsetX = 0, ${width - 1} do
          local t = ${horizontal ? `((${width} > 1) and (offsetX / (${width} - 1)) or 0)` : `((${height} > 1) and (offsetY / (${height} - 1)) or 0)`}
          local red = math.floor(${startRed} + (${endRed} - ${startRed}) * t + 0.5)
          local green = math.floor(${startGreen} + (${endGreen} - ${startGreen}) * t + 0.5)
          local blue = math.floor(${startBlue} + (${endBlue} - ${startBlue}) * t + 0.5)
          local alpha = math.floor(${startAlpha} + (${endAlpha} - ${startAlpha}) * t + 0.5)
          pset(img, ${x} + offsetX, ${y} + offsetY, Color(red, green, blue, alpha))
        end
      end
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Gradient applied on '${name}' frame ${frameIndex} in ${source}`);
  }

public async drawEllipseAt(filename: string, layerName: string, frameIndex: number, centerX: number, centerY: number, radiusX: number, radiusY: number, color = "#000000", fill = false, createIfMissing = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![centerX, centerY].every((coordinate) => Number.isInteger(coordinate))) return { ok: false, message: "Coordinates must be integers" };
    if (!isPositiveInteger(radiusX) || !isPositiveInteger(radiusY)) return { ok: false, message: "Radius X and radius Y must be positive integers" };
    const rgba = this.parseHexColor(color);
    if (!rgba) return { ok: false, message: "Colors must use hexadecimal values" };
    const [red, green, blue, alpha] = rgba;
    const tool = fill ? "filled_ellipse" : "ellipse";
    const body = this.layerFrameScript(name, frameIndex, createIfMissing, `
      app.useTool({
        tool = "${tool}",
        color = Color(${red}, ${green}, ${blue}, ${alpha}),
        points = { Point(${centerX - radiusX}, ${centerY - radiusY}), Point(${centerX + radiusX}, ${centerY + radiusY}) }
      })
    `);
    return result(await this.runLua(this.openScript(source, body), source), `Ellipse drawn on '${name}' frame ${frameIndex} in ${source}`);
  }
}
