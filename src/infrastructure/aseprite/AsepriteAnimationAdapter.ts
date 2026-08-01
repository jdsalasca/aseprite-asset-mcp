import { execFile, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AnimationAuditInput, AnimationEasing, AnimationSanitizeInput, AssetRuntimePort, AssetOperationResult, CopyLayersInput, PixelInput, PointInput, ScaleAnchor, TextDrawInput, TilePixelInput, TilePlacementInput } from "../../domain/asset-operations.js";
import { availableTextFonts, measureText as rasterMeasureText, rasterizeText } from "../text/TextRasterizer.js";
import { AsepriteCommandAdapter, execFileAsync, previewServers, SHEET_TYPES, DATA_FORMATS, ANIMATION_EASINGS, SCALE_ANCHORS, UNSAFE_LUA_PATTERNS, BLEND_MODES, PALETTE_PRESETS, rgbToHsl, hslToHex, CONVOLUTION_MATRICES, luaEscape, safePath, validatePath, isPositiveInteger, validateFrameRange, isHexColor, validateName, validateNativeRegion, result, parsePixelFields } from "./AsepriteCommandAdapter.js";
import type { AnimationQualityPort } from "../../application/ports/AssetCapabilityPorts.js";

export class AsepriteAnimationAdapter extends AsepriteCommandAdapter implements AnimationQualityPort {
public async ensureLayersPresent(filename: string, layerNames: string[], startFrame = 1, endFrame?: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!Array.isArray(layerNames) || layerNames.length === 0) return { ok: false, message: "Layer names list cannot be empty" };
    if (!isPositiveInteger(startFrame) || (endFrame !== undefined && (!isPositiveInteger(endFrame) || endFrame < startFrame))) return { ok: false, message: "Frame range must start at 1 and end at or after the start" };
    const layers = `{${layerNames.map((name) => `"${luaEscape(name)}"`).join(",")}}`;
    const end = endFrame ?? "#spr.frames";
    const script = this.openScript(source, `
      if ${startFrame} < 1 or ${end} > #spr.frames then print("ERROR:Frame range out of bounds") return end
      local names = ${layers}
      local targets = {}
      for _, layerName in ipairs(names) do local target = find_layer(spr, layerName) if target and not target.isGroup then table.insert(targets, target) end end
      if #targets == 0 then print("ERROR:No layers found") return end
      for frameIndex = ${startFrame}, ${end} do
        for _, target in ipairs(targets) do
          if not target:cel(spr.frames[frameIndex]) then spr:newCel(target, spr.frames[frameIndex], Image(spr.width, spr.height, spr.colorMode), Point(0, 0)) end
        end
      end
    `);
    return result(await this.runLua(script, source), `Ensured cels for layers ${layerNames.join(", ")} on frames ${startFrame}-${endFrame ?? "end"} in ${source}`);
  }

public async auditAnimation(input: AnimationAuditInput): Promise<AssetOperationResult> {
    const source = validatePath(input.filename);
    if (typeof source !== "string") return source;
    const startFrame = input.startFrame ?? 1;
    const endFrame = input.endFrame;
    const maxOverlaps = input.maxOverlaps ?? 200;
    const maxOutOfRange = input.maxOutOfRange ?? 200;
    if (!isPositiveInteger(startFrame) || (endFrame !== undefined && (!isPositiveInteger(endFrame) || endFrame < startFrame))) return { ok: false, message: "Frame range must start at 1 and end at or after the start" };
    if (!Number.isInteger(maxOverlaps) || maxOverlaps < 0 || !Number.isInteger(maxOutOfRange) || maxOutOfRange < 0) return { ok: false, message: "Max limits must be >= 0" };
    const names = input.layerNames?.length ? `{${input.layerNames.map((name) => `"${luaEscape(name)}"`).join(",")}}` : "nil";
    const pairs = (input.overlapPairs ?? []).map((entry) => entry.includes(",") ? entry.split(",", 2) : entry.split(":", 2)).filter((entry) => entry.length === 2 && entry.every((value) => value.trim())).map((entry) => `{\"${luaEscape(entry[0] ?? "")}\",\"${luaEscape(entry[1] ?? "")}\"}`).join(",");
    const ranges: string[] = [];
    for (const entry of input.layerFrameRanges ?? []) {
      const [layer, spans] = entry.split(":", 2);
      const parsed = (spans ?? "").split(",").map((span) => { const [left, right] = span.split("-", 2); return [Number(left), Number(right)] as [number, number]; }).filter(([left, right]) => isPositiveInteger(left) && right >= left);
      if (layer?.trim() && parsed.length) ranges.push(`["${luaEscape(layer.trim())}"]={${parsed.map(([a, b]) => `{${a},${b}}`).join(",")}}`);
    }
    const end = endFrame ?? "#spr.frames";
    const reportCels = input.reportCels ? "true" : "false";
    const reportBounds = input.reportBounds ? "true" : "false";
    const script = this.readOnlyScript(`
      if ${startFrame} < 1 or ${end} > #spr.frames then print("ERROR:Frame range out of bounds") return end
      local targetNames = ${names}
      local targets = {}
      if targetNames == nil then for _, layer in ipairs(spr.layers) do if not layer.isGroup then table.insert(targets, layer) end end else for _, layerName in ipairs(targetNames) do local layer = find_layer(spr, layerName) if layer and not layer.isGroup then table.insert(targets, layer) end end end
      local pairs = {${pairs}}
      local ranges = {${ranges.join(",")}}
      local totalCels, overlapsTotal, outOfRange = 0, 0, 0
      for frameIndex = ${startFrame}, ${end} do
        for _, layer in ipairs(targets) do
          local cel = layer:cel(spr.frames[frameIndex])
          if cel then
            totalCels = totalCels + 1
            local allowed = ranges[layer.name]
            local inRange = true
            if allowed then inRange = false for _, span in ipairs(allowed) do if frameIndex >= span[1] and frameIndex <= span[2] then inRange = true break end end end
            if not inRange then outOfRange = outOfRange + 1 if outOfRange <= ${maxOutOfRange} then print("OUT:" .. frameIndex .. "," .. layer.name) end end
            if ${reportCels} then print(string.format("CEL:%d,%s,%d,%d,%d,%d", frameIndex, layer.name, cel.position.x, cel.position.y, cel.image.width, cel.image.height)) end
          end
        end
        for _, pair in ipairs(pairs) do
          local a, b = find_layer(spr, pair[1]), find_layer(spr, pair[2])
          local ca, cb = a and a:cel(spr.frames[frameIndex]), b and b:cel(spr.frames[frameIndex])
          if ca and cb then
            local ap, bp = ca.position, cb.position
            local overlap = ap.x < bp.x + cb.image.width and ap.x + ca.image.width > bp.x and ap.y < bp.y + cb.image.height and ap.y + ca.image.height > bp.y
            if overlap then overlapsTotal = overlapsTotal + 1 if overlapsTotal <= ${maxOverlaps} then print(string.format("OVERLAP:%d,%s,%s", frameIndex, pair[1], pair[2])) end end
          end
        end
      end
      print(string.format("SUMMARY:%d,%d,%d,%d,%d", ${startFrame}, ${end}, #targets, totalCels, overlapsTotal))
    `);
    const command = await this.runLua(script, source);
    if (!command.ok) return { ok: false, message: `Failed to audit animation: ${command.output}` };
    const overlaps: Array<Record<string, unknown>> = [];
    const outOfRange: Array<Record<string, unknown>> = [];
    const cels: Array<Record<string, unknown>> = [];
    let summary = { frames: { start: startFrame, end: endFrame ?? 0 }, layersChecked: 0, totalCels: 0, overlapsTotal: 0 };
    for (const line of command.output.split(/\r?\n/)) {
      if (line.startsWith("SUMMARY:")) { const [start = startFrame, end = endFrame ?? startFrame, layersChecked = 0, totalCels = 0, overlapsTotal = 0] = line.slice(8).split(",").map(Number); summary = { frames: { start, end }, layersChecked, totalCels, overlapsTotal }; }
      else if (line.startsWith("OVERLAP:")) { const [frame, a, b] = line.slice(8).split(","); overlaps.push({ frame: Number(frame), a, b }); }
      else if (line.startsWith("OUT:")) { const [frame, layer] = line.slice(4).split(","); outOfRange.push({ frame: Number(frame), layer }); }
      else if (line.startsWith("CEL:")) { const [frame, layer, x, y, w, h] = line.slice(4).split(","); cels.push(input.reportBounds ? { frame: Number(frame), layer, x: Number(x), y: Number(y), w: Number(w), h: Number(h) } : { frame: Number(frame), layer }); }
    }
    return { ok: true, message: JSON.stringify({ summary: { ...summary, outOfRange: outOfRange.length, overlaps: overlaps.length }, overlaps, outOfRange, ...(input.reportCels ? { cels } : {}) }) };
  }

public async animationSanitize(input: AnimationSanitizeInput): Promise<AssetOperationResult> {
    const source = validatePath(input.filename);
    if (typeof source !== "string") return source;
    const startFrame = input.startFrame ?? 1;
    const endFrame = input.endFrame;
    const action = input.outOfRangeAction ?? "set_opacity_zero";
    const opacity = input.outOfRangeOpacity ?? 0;
    if (!isPositiveInteger(startFrame) || (endFrame !== undefined && (!isPositiveInteger(endFrame) || endFrame < startFrame))) return { ok: false, message: "Frame range must start at 1 and end at or after the start" };
    if (!["set_opacity_zero", "delete_cels", "none"].includes(action)) return { ok: false, message: "Unsupported out_of_range_action" };
    if (!Number.isInteger(opacity) || opacity < 0 || opacity > 255) return { ok: false, message: "out_of_range_opacity must be 0-255" };
    const names = input.layerNames?.length ? `{${input.layerNames.map((name) => `"${luaEscape(name)}"`).join(",")}}` : "nil";
    const ensure = input.ensureLayers?.length ? `{${input.ensureLayers.map((name) => `"${luaEscape(name)}"`).join(",")}}` : "nil";
    const ranges: string[] = [];
    for (const entry of input.layerFrameRanges ?? []) { const [layer, spans] = entry.split(":", 2); const parsed = (spans ?? "").split(",").map((span) => { const [left, right] = span.split("-", 2); return [Number(left), Number(right)] as [number, number]; }).filter(([left, right]) => isPositiveInteger(left) && right >= left); if (layer?.trim() && parsed.length) ranges.push(`["${luaEscape(layer.trim())}"]={${parsed.map(([a, b]) => `{${a},${b}}`).join(",")}}`); }
    const end = endFrame ?? "#spr.frames";
    const scriptBody = `
      if ${startFrame} < 1 or ${end} > #spr.frames then print("ERROR:Frame range out of bounds") return end
      local targetNames, ensureNames, ranges = ${names}, ${ensure}, {${ranges.join(",")}}
      local targets = {}
      if targetNames == nil then
        for _, layer in ipairs(spr.layers) do if not layer.isGroup then table.insert(targets, layer) end end

      else
        for _, layerName in ipairs(targetNames) do
          local layer = find_layer(spr, layerName)
          if layer and not layer.isGroup then table.insert(targets, layer) end
        end
      end
      local ensured, outOfRange, opacitySet, deleted = 0, 0, 0, 0
      if ensureNames ~= nil and not ${input.reportOnly ? "true" : "false"} then
        for _, layerName in ipairs(ensureNames) do
          local layer = find_layer(spr, layerName)
          if layer and not layer.isGroup then
            for fi = ${startFrame}, ${end} do
              if not layer:cel(spr.frames[fi]) then
                spr:newCel(layer, spr.frames[fi], Image(spr.width, spr.height, spr.colorMode), Point(0, 0))
                ensured = ensured + 1
              end
            end
          end
        end
      end
      for _, layer in ipairs(targets) do
        local allowed = ranges[layer.name]
        if allowed then
          for fi = ${startFrame}, ${end} do
            local cel = layer:cel(spr.frames[fi])
            if cel then
              local inRange = false
              for _, span in ipairs(allowed) do
                if fi >= span[1] and fi <= span[2] then inRange = true break end
              end
              if not inRange then
                outOfRange = outOfRange + 1
                if not ${input.reportOnly ? "true" : "false"} then
                  if "${action}" == "delete_cels" then
                    spr:deleteCel(cel)
                    deleted = deleted + 1
                  elseif "${action}" == "set_opacity_zero" then
                    cel.opacity = ${opacity}
                    opacitySet = opacitySet + 1
                  end
                end
              end
            end
          end
        end
      end
      print(string.format("SANITIZED:%d,%d,%d,%d", ensured, outOfRange, opacitySet, deleted))
    `;
    const command = await this.runLua(input.reportOnly ? this.readOnlyScript(scriptBody) : this.openScript(source, scriptBody), source);
    if (!command.ok) return { ok: false, message: `Failed to sanitize animation: ${command.output}` };
    const line = command.output.split(/\r?\n/).find((entry) => entry.startsWith("SANITIZED:"));
    if (!line) return { ok: false, message: "No sanitize data returned" };
    const [ensured, outOfRange, opacitySet, deleted] = line.slice(10).split(",").map(Number);
    return { ok: true, message: JSON.stringify({ sanitized: { ensured, outOfRange, opacitySet, deleted }, reportOnly: Boolean(input.reportOnly) }) };
  }

public async startPreviewServer(directory: string, port = 8000): Promise<AssetOperationResult> {
    const target = validatePath(directory);
    if (typeof target !== "string") return target;
    try { if (!(await fs.stat(target)).isDirectory()) return { ok: false, message: `Directory ${directory} not found` }; } catch { return { ok: false, message: `Directory ${directory} not found` }; }
    if (!Number.isInteger(port) || port < 1024 || port > 65535) return { ok: false, message: "Port must be an integer between 1024 and 65535" };
    const existing = previewServers.get(port);
    if (existing && !existing.killed) return { ok: true, message: `Preview server may already be running on port ${port}` };
    const serverCode = `const http=require("node:http"),fs=require("node:fs"),path=require("node:path");const root=path.resolve(process.argv[1]);const port=Number(process.argv[2]);http.createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);const target=path.resolve(root,"."+pathname);if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);return res.end("Forbidden")}let file=target;if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,"index.html");if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end("Not found")}res.writeHead(200);fs.createReadStream(file).pipe(res)}catch(e){res.writeHead(500);res.end("Server error")}}).listen(port,"127.0.0.1")`;
    const child = spawn(process.execPath, ["-e", serverCode, target, String(port)], { cwd: target, windowsHide: true, stdio: "ignore" });
    previewServers.set(port, child);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (child.exitCode !== null) break;
      try {
        const response = await fetch(`http://127.0.0.1:${port}/`);
        await response.body?.cancel();
        return { ok: true, message: `Preview server started: http://localhost:${port}/` };
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    child.kill();
    previewServers.delete(port);
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) { resolve(); return; }
      const timeout = setTimeout(resolve, 2000);
      child.once("exit", () => { clearTimeout(timeout); resolve(); });
    });
    return { ok: false, message: `Preview server failed to start on port ${port}` };
  }

public async stopPreviewServer(port = 8000): Promise<AssetOperationResult> {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) return { ok: false, message: "Port must be an integer between 1024 and 65535" };
    const child = previewServers.get(port);
    if (!child || child.killed) return { ok: false, message: `No preview server found for port ${port}` };
    child.kill();
    previewServers.delete(port);
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      const timeout = setTimeout(resolve, 2000);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    return { ok: true, message: `Preview server stopped on port ${port}` };
  }

public async copyLayersBetweenSprites(input: CopyLayersInput): Promise<AssetOperationResult> {
    const source = validatePath(input.sourceFilename);
    if (typeof source !== "string") return source;
    const target = validatePath(input.targetFilename);
    if (typeof target !== "string") return target;
    if (source === target) return { ok: false, message: "Source and target sprites must be different" };
    try { await fs.access(source); await fs.access(target); } catch { return { ok: false, message: "Source or target sprite not found" }; }
    if (!Array.isArray(input.layerNames) || input.layerNames.length === 0) return { ok: false, message: "Layer names list cannot be empty" };
    const layers = `{${input.layerNames.map((name) => `"${luaEscape(name)}"`).join(",")}}`;
    const script = `
      local src = app.open("${luaEscape(source.replaceAll("\\", "/"))}")
      if not src then print("ERROR:Source sprite not opened") return end
      local dst = app.open("${luaEscape(target.replaceAll("\\", "/"))}")
      if not dst then print("ERROR:Target sprite not opened") return end
      local function find_layer(sprite, name)
        for _, layer in ipairs(sprite.layers) do if layer.name == name then return layer end if layer.isGroup then for _, nested in ipairs(layer.layers) do if nested.name == name then return nested end end end end
        return nil
      end
      local valid, missing = {}, {}
      for _, name in ipairs(${layers}) do if find_layer(src, name) then table.insert(valid, name) else table.insert(missing, name) end end
      if #valid == 0 then print("ERROR:None of the requested layers exist in the source") return end
      app.activeSprite = dst
      app.transaction(function()
        if ${input.createMissingFrames !== false ? "true" : "false"} then while #dst.frames < #src.frames do dst:newFrame() end end
        for _, name in ipairs(valid) do
          local sourceLayer, targetLayer = find_layer(src, name), find_layer(dst, name)
          if not targetLayer then targetLayer = dst:newLayer() targetLayer.name = name end
          if ${input.replace !== false ? "true" : "false"} then for i = 1, #dst.frames do local cel = targetLayer:cel(dst.frames[i]) if cel then dst:deleteCel(cel) end end end
          for i = 1, #src.frames do if i <= #dst.frames then local sourceCel = sourceLayer:cel(src.frames[i]) if sourceCel then local targetCel = targetLayer:cel(dst.frames[i]) if targetCel and ${input.replace !== false ? "true" : "false"} then dst:deleteCel(targetCel) targetCel = nil end if not targetCel then dst:newCel(targetLayer, dst.frames[i], sourceCel.image:clone(), sourceCel.position) end end end end
        end
      end)
      dst:saveAs(dst.filename)
      if #missing > 0 then print("MISSING:" .. table.concat(missing, ",")) end
      print("OK")
    `;
    const command = await this.runLua(script);
    if (!command.ok) return { ok: false, message: `Failed to copy layers: ${command.output}` };
    const missing = command.output.split(/\r?\n/).find((line) => line.startsWith("MISSING:"));
    return { ok: true, message: `Layers copied from ${source} to ${target}${missing ? ` (skipped missing layers: ${missing.slice(8)})` : ""}` };
  }

public async getSpriteInfo(filename: string): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    try { await fs.access(source); } catch { return { ok: false, message: `File ${filename} not found` }; }
    const script = this.readOnlyScript(`
      local mode = "unknown"
      if spr.colorMode == ColorMode.RGB then mode = "rgb" elseif spr.colorMode == ColorMode.INDEXED then mode = "indexed" elseif spr.colorMode == ColorMode.GRAY then mode = "gray" end
      local parts = {"{"}
      table.insert(parts, "\\\"width\\\":" .. spr.width .. ",")
      table.insert(parts, "\\\"height\\\":" .. spr.height .. ",")
      table.insert(parts, "\\\"color_mode\\\":\\\"" .. mode .. "\\\",")
      table.insert(parts, "\\\"frames\\\":" .. #spr.frames .. ",\\\"durations_ms\\\":[")
      for i, frame in ipairs(spr.frames) do table.insert(parts, tostring(math.floor(frame.duration * 1000 + 0.5))) if i < #spr.frames then table.insert(parts, ",") end end
      table.insert(parts, "],\\\"layers\\\":[")
      local first = true
      local function walk(layers, parent)
        for _, layer in ipairs(layers) do
          if not first then table.insert(parts, ",") end
          first = false
          local parentJson = parent and string.format("%q", parent) or "null"
          table.insert(parts, "{\\\"name\\\":" .. string.format("%q", layer.name) .. ",\\\"visible\\\":" .. tostring(layer.isVisible) .. ",\\\"opacity\\\":" .. tostring(layer.opacity or 255) .. ",\\\"is_group\\\":" .. tostring(layer.isGroup) .. ",\\\"parent\\\":" .. parentJson .. "}")
          if layer.isGroup then walk(layer.layers, layer.name) end
        end
      end
      walk(spr.layers, nil)
      table.insert(parts, "],\\\"tags\\\":[")
      local directions = {[0]="forward", "reverse", "pingpong", "pingpong_reverse"}
      for i, tag in ipairs(spr.tags) do
        table.insert(parts, "{\\\"name\\\":" .. string.format("%q", tag.name) .. ",\\\"from\\\":" .. tag.fromFrame.frameNumber .. ",\\\"to\\\":" .. tag.toFrame.frameNumber .. ",\\\"direction\\\":\\\"" .. (directions[tonumber(tag.aniDir)] or tostring(tag.aniDir)) .. "\\\"}")
        if i < #spr.tags then table.insert(parts, ",") end
      end
      table.insert(parts, "]}")
      print(table.concat(parts))
    `);
    const command = await this.runLua(script, source);
    if (!command.ok) return { ok: false, message: `Failed to get sprite info: ${command.output}` };
    const json = command.output.split(/\r?\n/).find((line) => line.trim().startsWith("{"));
    return json ? { ok: true, message: json.trim() } : { ok: false, message: "No sprite info returned" };
  }

public async duplicateFrameRange(filename: string, startFrame: number, endFrame: number, times = 1): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (validateFrameRange(startFrame, endFrame)) return { ok: false, message: "Frame range must start at 1 and end at or after the start" };
    if (!isPositiveInteger(times)) return { ok: false, message: "Times must be >= 1" };
    const script = this.openScript(source, `
      local start_idx, end_idx, repetitions = ${startFrame}, ${endFrame}, ${times}
      if end_idx > #spr.frames then print("ERROR:Frame range out of bounds") return end
      for _ = 1, repetitions do
        for fi = start_idx, end_idx do
          local newFrame = spr:newFrame()
          for _, layer in ipairs(spr.layers) do
            if not layer.isGroup then
              local cel = layer:cel(spr.frames[fi])
              if cel then spr:newCel(layer, newFrame, cel.image:clone(), cel.position) end
            end
          end
        end
      end
    `);
    return result(await this.runLua(script, source), `Frames ${startFrame}-${endFrame} duplicated ${times} time(s) in ${filename}`);
  }

public async propagateCels(filename: string, layerNames: string[], sourceFrame: number, startFrame: number, endFrame: number, replace = true): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    if (!Array.isArray(layerNames) || layerNames.length === 0) return { ok: false, message: "Layer names list cannot be empty" };
    if (!isPositiveInteger(sourceFrame) || validateFrameRange(startFrame, endFrame)) return { ok: false, message: "Frame range must start at 1 and end at or after the start" };
    const names = `{${layerNames.map((name) => `"${luaEscape(name)}"`).join(",")}}`;
    const script = this.openScript(source, `
      if ${sourceFrame} > #spr.frames or ${endFrame} > #spr.frames then print("ERROR:Frame range out of bounds") return end
      local names, targets = ${names}, {}
      for _, name in ipairs(names) do local layer = find_layer(spr, name) if layer and not layer.isGroup then table.insert(targets, layer) end end
      if #targets == 0 then print("ERROR:No layers found") return end
      for frameIndex = ${startFrame}, ${endFrame} do
        if frameIndex ~= ${sourceFrame} then
          for _, layer in ipairs(targets) do
            local srcCel, dstCel = layer:cel(spr.frames[${sourceFrame}]), layer:cel(spr.frames[frameIndex])
            if srcCel then
              if dstCel and ${replace ? "true" : "false"} then spr:deleteCel(dstCel) dstCel = nil end
              if not dstCel then spr:newCel(layer, spr.frames[frameIndex], srcCel.image:clone(), srcCel.position) end
            end
          end
        end
      end
    `);
    return result(await this.runLua(script, source), `Cels propagated from frame ${sourceFrame} to ${startFrame}-${endFrame} in ${filename}`);
  }

public async tweenCelPositionsEased(filename: string, layerName: string, startFrame: number, endFrame: number, startX: number, startY: number, endX: number, endY: number, easing: AnimationEasing = "smoothstep", createMissingCels = false, sourceFrameIndex?: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (validateFrameRange(startFrame, endFrame)) return { ok: false, message: "Frame range must start at 1 and end at or after the start" };
    if (![startX, startY, endX, endY].every(Number.isInteger)) return { ok: false, message: "Position values must be integers" };
    if (!ANIMATION_EASINGS.has(easing)) return { ok: false, message: "Unsupported easing (linear, ease_in, ease_out, ease_in_out, smoothstep)" };
    const sourceIndex = sourceFrameIndex === undefined ? "nil" : String(sourceFrameIndex);
    const script = this.openScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      if ${endFrame} > #spr.frames then print("ERROR:Frame range out of bounds") return end
      local function ease(t) local mode = "${easing}" if mode == "linear" then return t elseif mode == "ease_in" then return t*t elseif mode == "ease_out" then return 1-(1-t)*(1-t) elseif mode == "ease_in_out" then if t < 0.5 then return 2*t*t end local u = -2*t+2 return 1-(u*u)/2 end return t*t*(3-2*t) end
      local span = ${endFrame} - ${startFrame}
      for fi = ${startFrame}, ${endFrame} do
        local t = span > 0 and (fi-${startFrame})/span or 0
        local e = ease(t)
        local cel = target:cel(spr.frames[fi])
        if not cel and ${createMissingCels ? "true" : "false"} then
          local sourceCel = target:cel(spr.frames[${sourceIndex === "nil" ? String(startFrame) : sourceIndex}])
          local image = sourceCel and sourceCel.image:clone() or Image(spr.width, spr.height, spr.colorMode)
          cel = spr:newCel(target, spr.frames[fi], image, sourceCel and sourceCel.position or Point(0, 0))
        end
        if cel then cel.position = Point(math.floor(${startX} + (${endX}-${startX})*e + 0.5), math.floor(${startY} + (${endY}-${startY})*e + 0.5)) end
      end
    `);
    return result(await this.runLua(script, source), `Tweened cel positions (${easing}) on '${name}' frames ${startFrame}-${endFrame} in ${filename}`);
  }

public async oscillateCelPositions(filename: string, layerName: string, startFrame: number, endFrame: number, amplitudeX = 0, amplitudeY = 0, cycles = 1, phaseDeg = 0, createMissingCels = false, sourceFrameIndex?: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (validateFrameRange(startFrame, endFrame)) return { ok: false, message: "Frame range must start at 1 and end at or after the start" };
    if (![amplitudeX, amplitudeY, cycles, phaseDeg].every(Number.isFinite)) return { ok: false, message: "Oscillation values must be finite" };
    const sourceIndex = sourceFrameIndex === undefined ? startFrame : sourceFrameIndex;
    const script = this.openScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      if ${endFrame} > #spr.frames then print("ERROR:Frame range out of bounds") return end
      local span = ${endFrame} - ${startFrame}
      for fi = ${startFrame}, ${endFrame} do
        local t = span > 0 and (fi-${startFrame})/span or 0
        local angle = 2 * math.pi * ${cycles} * t + (${phaseDeg}) * math.pi / 180
        local cel = target:cel(spr.frames[fi])
        if not cel and ${createMissingCels ? "true" : "false"} then
          local sourceCel = target:cel(spr.frames[${sourceIndex}])
          local image = sourceCel and sourceCel.image:clone() or Image(spr.width, spr.height, spr.colorMode)
          cel = spr:newCel(target, spr.frames[fi], image, sourceCel and sourceCel.position or Point(0, 0))
        end
        if cel then cel.position = Point(cel.position.x + math.floor(${amplitudeX}*math.sin(angle)+0.5), cel.position.y + math.floor(${amplitudeY}*math.cos(angle)+0.5)) end
      end
    `);
    return result(await this.runLua(script, source), `Oscillated cel positions on '${name}' frames ${startFrame}-${endFrame} in ${filename}`);
  }

public async tweenCelOpacityEased(filename: string, layerName: string, startFrame: number, endFrame: number, startOpacity: number, endOpacity: number, easing: AnimationEasing = "smoothstep", createMissingCels = false, sourceFrameIndex?: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (validateFrameRange(startFrame, endFrame)) return { ok: false, message: "Frame range must start at 1 and end at or after the start" };
    if (![startOpacity, endOpacity].every((value) => Number.isInteger(value) && value >= 0 && value <= 255)) return { ok: false, message: "Opacity must be between 0 and 255" };
    if (!ANIMATION_EASINGS.has(easing)) return { ok: false, message: "Unsupported easing (linear, ease_in, ease_out, ease_in_out, smoothstep)" };
    const sourceIndex = sourceFrameIndex === undefined ? startFrame : sourceFrameIndex;
    const script = this.openScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      if ${endFrame} > #spr.frames then print("ERROR:Frame range out of bounds") return end
      local function ease(t) local mode = "${easing}" if mode == "linear" then return t elseif mode == "ease_in" then return t*t elseif mode == "ease_out" then return 1-(1-t)*(1-t) elseif mode == "ease_in_out" then if t < 0.5 then return 2*t*t end local u = -2*t+2 return 1-(u*u)/2 end return t*t*(3-2*t) end
      local span = ${endFrame} - ${startFrame}
      for fi = ${startFrame}, ${endFrame} do
        local t = span > 0 and (fi-${startFrame})/span or 0
        local e = ease(t)
        local cel = target:cel(spr.frames[fi])
        if not cel and ${createMissingCels ? "true" : "false"} then
          local sourceCel = target:cel(spr.frames[${sourceIndex}])
          local image = sourceCel and sourceCel.image:clone() or Image(spr.width, spr.height, spr.colorMode)
          cel = spr:newCel(target, spr.frames[fi], image, sourceCel and sourceCel.position or Point(0, 0))
        end
        if cel then cel.opacity = math.max(0, math.min(255, math.floor(${startOpacity} + (${endOpacity}-${startOpacity})*e + 0.5))) end
      end
    `);
    return result(await this.runLua(script, source), `Tweened cel opacity (${easing}) on '${name}' frames ${startFrame}-${endFrame} in ${filename}`);
  }

public async tweenCelScaleEased(filename: string, layerName: string, startFrame: number, endFrame: number, startScale: number, endScale: number, easing: AnimationEasing = "smoothstep", anchor: ScaleAnchor = "center", replace = true, createMissingCels = true, sourceFrameIndex?: number): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    if (validateFrameRange(startFrame, endFrame)) return { ok: false, message: "Frame range must start at 1 and end at or after the start" };
    if (![startScale, endScale].every((value) => Number.isFinite(value) && value > 0)) return { ok: false, message: "Scale must be > 0" };
    if (!ANIMATION_EASINGS.has(easing)) return { ok: false, message: "Unsupported easing (linear, ease_in, ease_out, ease_in_out, smoothstep)" };
    if (!SCALE_ANCHORS.has(anchor)) return { ok: false, message: "Unsupported anchor (center, topleft)" };
    const sourceIndex = sourceFrameIndex ?? startFrame;
    const script = this.openScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target or target.isGroup then print("ERROR:Layer not found") return end
      if ${endFrame} > #spr.frames or ${sourceIndex} > #spr.frames then print("ERROR:Frame range out of bounds") return end
      local sourceCel = target:cel(spr.frames[${sourceIndex}])
      if not sourceCel then print("ERROR:Source cel not found") return end
      local baseImage, baseWidth, baseHeight, basePosition = sourceCel.image:clone(), sourceCel.image.width, sourceCel.image.height, sourceCel.position

      local function ease(t) local mode = "${easing}" if mode == "linear" then return t elseif mode == "ease_in" then return t*t elseif mode == "ease_out" then return 1-(1-t)*(1-t) elseif mode == "ease_in_out" then if t < 0.5 then return 2*t*t end local u = -2*t+2 return 1-(u*u)/2 end return t*t*(3-2*t) end
      local span = ${endFrame} - ${startFrame}
      for fi = ${startFrame}, ${endFrame} do
        local t = span > 0 and (fi-${startFrame})/span or 0
        local scale = ${startScale} + (${endScale}-${startScale}) * ease(t)
        local width, height = math.max(1, math.floor(baseWidth*scale+0.5)), math.max(1, math.floor(baseHeight*scale+0.5))
        local cel = target:cel(spr.frames[fi])
        if cel and ${replace ? "true" : "false"} then spr:deleteCel(cel) cel = nil end
        if not cel and ${createMissingCels ? "true" : "false"} then
          local image = baseImage:clone() image:resize(width, height)
          local x, y = basePosition.x, basePosition.y
          if "${anchor}" == "center" then x = math.floor(basePosition.x + baseWidth/2 - width/2 + 0.5) y = math.floor(basePosition.y + baseHeight/2 - height/2 + 0.5) end
          spr:newCel(target, spr.frames[fi], image, Point(x, y))
        end
      end
    `);
    return result(await this.runLua(script, source), `Tweened cel scale (${easing}) on '${name}' frames ${startFrame}-${endFrame} in ${filename}`);
  }

public async setLayer(filename: string, layerName: string, createIfMissing = false): Promise<AssetOperationResult> {
    const source = validatePath(filename);
    if (typeof source !== "string") return source;
    const name = validateName(layerName, "Layer name");
    if (typeof name !== "string") return name;
    const script = this.layerScript(source, `
      local target = find_layer(spr, "${luaEscape(name)}")
      if not target and ${createIfMissing ? "true" : "false"} then target = spr:newLayer() target.name = "${luaEscape(name)}" end
      if not target then print("ERROR:Layer not found") return end
      app.activeLayer = target
    `);
    return result(await this.runLua(script, source), `Active layer set to '${name}' in ${filename}`);
  }
}
