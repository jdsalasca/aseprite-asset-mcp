import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AnimationAuditInput, AnimationEasing, AnimationSanitizeInput, AssetRuntimePort, AssetOperationResult, CopyLayersInput, PixelInput, PointInput, ScaleAnchor, TextDrawInput, TilePixelInput, TilePlacementInput } from "../../domain/asset-operations.js";
import { availableTextFonts, measureText as rasterMeasureText, rasterizeText } from "../text/TextRasterizer.js";
import { AsepriteCommandAdapter, execFileAsync, previewServers, SHEET_TYPES, DATA_FORMATS, ANIMATION_EASINGS, SCALE_ANCHORS, UNSAFE_LUA_PATTERNS, BLEND_MODES, PALETTE_PRESETS, rgbToHsl, hslToHex, CONVOLUTION_MATRICES, luaEscape, safePath, validatePath, isPositiveInteger, validateFrameRange, isHexColor, validateName, validateNativeRegion, result, parsePixelFields } from "./AsepriteCommandAdapter.js";
import type { CommandResult } from "./AsepriteCommandAdapter.js";
import type { TextTileSlicePort } from "../../application/ports/AssetCapabilityPorts.js";

export class AsepriteTextAdapter extends AsepriteCommandAdapter implements TextTileSlicePort {
public async listTextFonts(): Promise<AssetOperationResult> {
    const fonts = await availableTextFonts();
    if (!fonts.length) return { ok: true, message: "No fonts found. Add a .ttf or .otf file to ~/.aseprite-mcp/fonts/." };
    const user = fonts.filter((font) => font.source === "user");
    const system = fonts.filter((font) => font.source === "system");
    const lines: string[] = [];
    if (user.length) {
      lines.push("User fonts (~/.aseprite-mcp/fonts):");
      lines.push(...user.map((font) => `  ${font.name}  [truetype]`));
    }
    if (system.length) {
      lines.push(`System fonts (${system.length}, all truetype):`);
      lines.push(...system.map((font) => `  ${font.name}`));
    }
    return { ok: true, message: lines.join("\n") };
  }

public async measureText(text: string, font: string, size = 1, letterSpacing = 0, bold = 0, antialias = false): Promise<AssetOperationResult> {
    try {
      const metrics = await rasterMeasureText(text, font, size, letterSpacing, bold, antialias);
      return { ok: true, message: `width=${metrics.width} height=${metrics.height} advance_width=${metrics.advanceWidth} above_baseline=${metrics.aboveBaseline} below_baseline=${metrics.belowBaseline} left_bearing=${metrics.leftBearing}` };
    } catch (error) {
      return { ok: false, message: `ERROR: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

public async drawText(input: TextDrawInput): Promise<AssetOperationResult> {
    const source = validatePath(input.filename);
    if (typeof source !== "string") return source;
    if (typeof input.text !== "string" || !input.text) return { ok: false, message: "Text cannot be empty" };
    if (![input.x, input.y].every(Number.isInteger)) return { ok: false, message: "Text coordinates must be integers" };
    const frameIndex = input.frameIndex ?? 1;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    const anchors = new Set(["topleft", "top", "topright", "left", "center", "right", "bottomleft", "bottom", "bottomright", "baselineleft", "baseline", "baselineright"]);
    const anchor = input.anchor ?? "topleft";
    if (!anchors.has(anchor)) return { ok: false, message: `Invalid anchor '${anchor}'` };
    if (input.layerName !== undefined && typeof input.layerName !== "string") return { ok: false, message: "Layer name must be a string" };
    const name = input.layerName?.trim() ?? "";
    try {
      const metrics = await rasterMeasureText(input.text, input.font, input.size ?? 1, input.letterSpacing ?? 0, input.bold ?? 0, input.antialias ?? false);
      let blitX = input.x;
      if (anchor.endsWith("right")) blitX -= metrics.width;
      else if (["top", "center", "bottom", "baseline"].includes(anchor)) blitX -= Math.floor(metrics.width / 2);
      let blitY = input.y;
      if (anchor.startsWith("baseline")) blitY -= metrics.aboveBaseline;
      else if (anchor.startsWith("bottom")) blitY -= metrics.height;
      else if (["left", "center", "right"].includes(anchor)) blitY -= Math.floor(metrics.height / 2);
      const rendered = await rasterizeText({
        text: input.text,
        font: input.font,
        size: input.size,
        color: input.color,
        letterSpacing: input.letterSpacing,
        bold: input.bold,
        outlineColor: input.outlineColor,
        outlineWidth: input.outlineWidth,
        shadowColor: input.shadowColor,
        shadowDx: input.shadowDx,
        shadowDy: input.shadowDy,
        antialias: input.antialias,
      }, blitX, blitY, this.tempDirectory);
      const png = luaEscape(rendered.filename.replaceAll("\\", "/"));
      const escapedName = luaEscape(name);
      const script = this.openScript(source, `
        if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
        local stamp = Image { fromFile = "${png}" }
        if not stamp then print("ERROR:Could not load rendered text") return end
        local target
        if "${escapedName}" ~= "" then
          target = find_layer(spr, "${escapedName}")
          if not target and ${input.createIfMissing !== false ? "true" : "false"} then target = spr:newLayer() target.name = "${escapedName}" end
        else
          target = app.activeLayer or spr.layers[1]
        end
        if not target or target.isGroup then print("ERROR:Layer not found") return end
        local cel = target:cel(spr.frames[${frameIndex}])
        if not cel and ${input.createIfMissing !== false ? "true" : "false"} then cel = spr:newCel(target, spr.frames[${frameIndex}], Image(spr.width, spr.height, spr.colorMode), Point(0, 0)) end
        if not cel then print("ERROR:Cel not found") return end
        if cel.position.x ~= 0 or cel.position.y ~= 0 or cel.image.width ~= spr.width or cel.image.height ~= spr.height then
          local normalized = Image(spr.width, spr.height, spr.colorMode)
          normalized:drawImage(cel.image, cel.position)
          cel.image, cel.position = normalized, Point(0, 0)
        end
        cel.image:drawImage(stamp, Point(${rendered.blitX}, ${rendered.blitY}), 255, BlendMode.NORMAL)
      `);
      let command: CommandResult;
      try {
        command = await this.runLua(script, source);
      } finally {
        await fs.rm(rendered.filename, { force: true });
      }
      if (!command.ok) return { ok: false, message: `Error drawing text: ${command.output}` };
      return { ok: true, message: `Drew '${input.text}' at (${blitX}, ${blitY}), text box ${metrics.width}x${metrics.height}` };
    } catch (error) {
      return { ok: false, message: `ERROR: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

public async drawOnTile(filename: string, layerName: string, tileIndex: number, pixels: TilePixelInput[]): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!Number.isInteger(tileIndex) || tileIndex < 1) return { ok: false, message: "Tile index must be >= 1 (tile 0 is reserved)" };
    if (!Array.isArray(pixels) || pixels.length === 0) return { ok: false, message: "Pixels list cannot be empty" };
    const puts: string[] = [];
    for (const pixel of pixels) {
      if (!Number.isInteger(pixel.x) || !Number.isInteger(pixel.y)) return { ok: false, message: "Tile pixel coordinates must be integers" };
      const rgba = this.parseHexColor(pixel.color);
      if (!rgba) return { ok: false, message: `Invalid color value: ${pixel.color}` };
      const [red, green, blue, alpha] = rgba;
      puts.push(`put(img, ${pixel.x}, ${pixel.y}, app.pixelColor.rgba(${red}, ${green}, ${blue}, ${alpha}))`);
    }
    const script = this.openScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      if not target.isTilemap then print("ERROR:Layer is not a tilemap layer") return end
      local ts = target.tileset
      if not ts then print("ERROR:Layer has no tileset") return end
      local idx = ${tileIndex}
      if idx > #ts then print("ERROR:Tile index out of range") return end
      if idx == #ts then spr:newTile(ts) end
      local tile = ts:tile(idx)
      local img = tile.image:clone()
      local function put(im, px, py, color)
        if px >= 0 and py >= 0 and px < im.width and py < im.height then im:putPixel(px, py, color) end
      end
      ${puts.join("\n      ")}
      tile.image = img
    `);
    return result(await this.runLua(script, source), `Drew ${pixels.length} pixels on tile ${tileIndex} of '${name}' in ${source}`);
  }

public async setTiles(filename: string, layerName: string, frameIndex: number, tiles: TilePlacementInput[]): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (!Array.isArray(tiles) || tiles.length === 0) return { ok: false, message: "Tiles list cannot be empty" };
    for (const tile of tiles) {
      if (![tile.col, tile.row, tile.tileIndex].every(Number.isInteger)) return { ok: false, message: "Tile positions and indices must be integers" };
      if (tile.col < 0 || tile.row < 0) return { ok: false, message: "Tile positions must be non-negative" };
      if (tile.tileIndex < 0) return { ok: false, message: "Tile indices must be non-negative" };
    }
    const entries = tiles.map((tile) => `{${tile.col},${tile.row},${tile.tileIndex}}`).join(", ");
    const script = this.openScript(source, `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      if not target.isTilemap then print("ERROR:Layer is not a tilemap layer") return end
      local ts = target.tileset
      local grid = spr.gridBounds
      local tw, th = grid.width, grid.height
      if tw <= 0 or th <= 0 then print("ERROR:Invalid tile grid") return end
      local cols = math.ceil(spr.width / tw)
      local rows = math.ceil(spr.height / th)
      local placements = { ${entries} }
      for _, tile in ipairs(placements) do
        if tile[1] >= cols or tile[2] >= rows then print("ERROR:Tile position outside map") return end
        if tile[3] < 0 or tile[3] >= #ts then print("ERROR:Tile index out of range") return end
      end
      local frame = spr.frames[${frameIndex}]
      local cel = target:cel(frame)
      local img
      if cel and cel.image.width == cols and cel.image.height == rows and cel.position.x == 0 and cel.position.y == 0 then
        img = cel.image
      else
        img = Image(cols, rows, ColorMode.TILEMAP)
        if cel then
          local old = cel.image
          local ox, oy = cel.position.x // tw, cel.position.y // th
          for py = 0, old.height - 1 do
            for px = 0, old.width - 1 do
              local nx, ny = px + ox, py + oy
              if nx >= 0 and ny >= 0 and nx < cols and ny < rows then img:putPixel(nx, ny, old:getPixel(px, py)) end
            end
          end
        end
        cel = spr:newCel(target, frame, img, Point(0, 0))

      end
      for _, tile in ipairs(placements) do img:putPixel(tile[1], tile[2], tile[3]) end
      cel.image = img
    `);
    return result(await this.runLua(script, source), `Placed ${tiles.length} tiles on '${name}' frame ${frameIndex} in ${source}`);
  }

public async getTileAt(filename: string, layerName: string, frameIndex: number, col: number, row: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (!isPositiveInteger(frameIndex)) return { ok: false, message: "Frame index must be a positive integer" };
    if (![col, row].every(Number.isInteger)) return { ok: false, message: "Tile coordinates must be integers" };
    if (col < 0 || row < 0) return { ok: false, message: "Tile coordinates must be non-negative" };
    const script = `
      if ${frameIndex} > #spr.frames then print("ERROR:Frame index out of range") return end
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      if not target.isTilemap then print("ERROR:Layer is not a tilemap layer") return end
      local grid = spr.gridBounds
      local cel = target:cel(spr.frames[${frameIndex}])
      local tile = 0
      if cel then
        local cx = ${col} - cel.position.x // grid.width
        local cy = ${row} - cel.position.y // grid.height
        if cx >= 0 and cy >= 0 and cx < cel.image.width and cy < cel.image.height then tile = app.pixelColor.tileI(cel.image:getPixel(cx, cy)) end
      end
      print("TILE:" .. tile)
    `;
    const command = await this.runLua(this.readOnlyScript(script), source);
    if (!command.ok) return { ok: false, message: `Failed to read tile: ${command.output}` };
    const tileLine = command.output.split(/\r?\n/).find((line) => line.startsWith("TILE:"));
    if (!tileLine) return { ok: false, message: "No tile data returned" };
    return { ok: true, message: JSON.stringify({ col, row, tile_index: Number(tileLine.slice(5)) }) };
  }

public async getTilemapInfo(filename: string, layerName: string): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const script = this.readOnlyScript(`
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target then print("ERROR:Layer not found") return end
      if not target.isTilemap then print("ERROR:Layer is not a tilemap layer") return end
      local ts = target.tileset
      local grid = spr.gridBounds
      print(string.format("INFO:%d,%d,%d,%d,%d", grid.width, grid.height, #ts - 1, math.ceil(spr.width / grid.width), math.ceil(spr.height / grid.height)))
    `);
    const command = await this.runLua(script, source);
    if (!command.ok) return { ok: false, message: `Failed to get tilemap info: ${command.output}` };
    const line = command.output.split(/\r?\n/).find((entry) => entry.startsWith("INFO:"));
    if (!line) return { ok: false, message: "No tilemap data returned" };
    const [tileWidth, tileHeight, tileCount, mapCols, mapRows] = line.slice(5).split(",").map(Number);
    return { ok: true, message: JSON.stringify({ tile_width: tileWidth, tile_height: tileHeight, tile_count: tileCount, map_cols: mapCols, map_rows: mapRows }) };
  }

public async createSlice(filename: string, name: string, x: number, y: number, width: number, height: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const sliceName = validateName(name, "Slice name");
    if (typeof sliceName !== "string") return sliceName;
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Slice coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const script = this.openScript(source, `
      local slice = find_slice(spr, "${luaEscape(sliceName)}")
      if slice then print("ERROR:Slice with that name already exists") return end
      local created = spr:newSlice(Rectangle(${x}, ${y}, ${width}, ${height}))
      created.name = "${luaEscape(sliceName)}"
    `);
    return result(await this.runLua(script, source), `Slice '${sliceName}' created at (${x},${y}) ${width}x${height} in ${source}`);
  }

public async setSliceCenter(filename: string, name: string, x: number, y: number, width: number, height: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const sliceName = validateName(name, "Slice name");
    if (typeof sliceName !== "string") return sliceName;
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Slice center coordinates must be integers" };
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) return { ok: false, message: "Width and height must be positive integers" };
    const script = this.openScript(source, `
      local slice = find_slice(spr, "${luaEscape(sliceName)}")
      if not slice then print("ERROR:Slice not found") return end
      slice.center = Rectangle(${x}, ${y}, ${width}, ${height})
    `);
    return result(await this.runLua(script, source), `Slice '${sliceName}' 9-patch center set to (${x},${y}) ${width}x${height} in ${source}`);
  }

public async setSlicePivot(filename: string, name: string, x: number, y: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const sliceName = validateName(name, "Slice name");
    if (typeof sliceName !== "string") return sliceName;
    if (![x, y].every(Number.isInteger)) return { ok: false, message: "Slice pivot coordinates must be integers" };
    const script = this.openScript(source, `
      local slice = find_slice(spr, "${luaEscape(sliceName)}")
      if not slice then print("ERROR:Slice not found") return end
      slice.pivot = Point(${x}, ${y})
    `);
    return result(await this.runLua(script, source), `Slice '${sliceName}' pivot set to (${x},${y}) in ${source}`);
  }

public async listSlices(filename: string): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const script = this.readOnlyScript(`
      for _, slice in ipairs(spr.slices) do
        local b = slice.bounds
        local parts = {}
        parts[#parts + 1] = string.format('"name":%s', string.format("%q", slice.name))
        parts[#parts + 1] = string.format('"x":%d,"y":%d,"width":%d,"height":%d', b.x, b.y, b.width, b.height)
        if slice.center then local c = slice.center parts[#parts + 1] = string.format('"center":{"x":%d,"y":%d,"width":%d,"height":%d}', c.x, c.y, c.width, c.height) end
        if slice.pivot then local p = slice.pivot parts[#parts + 1] = string.format('"pivot":{"x":%d,"y":%d}', p.x, p.y) end
        print("SLICE:{" .. table.concat(parts, ",") .. "}")
      end
      print("DONE")
    `);
    const command = await this.runLua(script, source);
    if (!command.ok) return { ok: false, message: `Failed to list slices: ${command.output}` };
    const slices: unknown[] = [];
    for (const line of command.output.split(/\r?\n/).filter((entry) => entry.startsWith("SLICE:"))) {
      try { slices.push(JSON.parse(line.slice(6))); } catch { return { ok: false, message: "Invalid slice data returned" }; }
    }
    return { ok: true, message: JSON.stringify(slices) };
  }

public async deleteSlice(filename: string, name: string): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const sliceName = validateName(name, "Slice name");
    if (typeof sliceName !== "string") return sliceName;
    const script = this.openScript(source, `
      local slice = find_slice(spr, "${luaEscape(sliceName)}")
      if not slice then print("ERROR:Slice not found") return end
      spr:deleteSlice(slice)
    `);
    return result(await this.runLua(script, source), `Slice '${sliceName}' deleted from ${source}`);
  }
}
