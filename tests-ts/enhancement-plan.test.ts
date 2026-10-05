import test from "node:test";
import assert from "node:assert/strict";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AssetOperationResult } from "../src/domain/asset-operations.js";
import type { EnhancementPlan, EnhancementPlanResult } from "../src/domain/enhancement.js";
import type { ReferenceAnalysis } from "../src/domain/visual-assets.js";
import { EnhancementPlanService } from "../src/application/services/EnhancementPlanService.js";
import { EnhancementToolController } from "../src/interfaces/controllers/EnhancementToolController.js";

const analysis: ReferenceAnalysis = { filename: "source.png", width: 16, height: 16, frames: 1, dominantColors: [{ color: "#112233", count: 4 }], averageLuminance: 0.4, contrast: 0.2, edgeDensity: 0.1, transparencyRatio: 0 };
const plan: EnhancementPlan = { planId: "plan-1", algorithmVersion: "enhancement-plan-v1", filename: "source.png", seed: 7, detectedSignals: [], warnings: [], passes: [{ id: "cleanup", reason: "cleanup", parameters: {} }, { id: "quality_gate", reason: "quality", parameters: {} }], destructive: false };
function result(value: unknown, ok = true): AssetOperationResult { return { ok, message: typeof value === "string" ? value : JSON.stringify(value) }; }

/**
 * Lo que devuelve `runQualityGate`: `ok` es "no hay infracciones", asi que un resultado con problemas
 * llega con `ok: false` y el mensaje es JSON igualmente. Medidas de la ronda 41 sobre el PNG ruidoso
 * de 96x96: el ORIGEN tenia 6395 colores y el RESULTADO 6396.
 */
function gateOf(filename: string, colors: number): unknown {
  return { filename, valid: false, frames: 1, reports: [{ width: 96, height: 96, colors, opaquePixels: 6400, transparentPixels: 2816, isolatedPixels: 0, bandingRuns: 176 }], violations: [`frame 1: colors ${colors} > 64`] };
}

test("enhancement plan composes inspect, plan, apply, and quality in one application port", async () => {
  const calls: string[] = [];
  const service = new EnhancementPlanService(
    { inspectReference: async () => { calls.push("inspect"); return result(analysis); }, runQualityGate: async () => { calls.push("quality"); return result({ valid: true, violations: [] }); } },
    { apply: async () => { calls.push("apply"); return { planId: plan.planId, outputFilename: "enhanced.png", format: "png", frames: 1, passesApplied: ["cleanup"], sourcePreserved: true }; } },
  );
  const response = await service.apply({ filename: "source.png", outputFilename: "enhanced.png", format: "png", goals: ["cleanup"], seed: 7 });
  assert.equal(response.ok, true);
  assert.deepEqual(calls, ["inspect", "quality", "apply", "quality"]);
  const payload = JSON.parse(response.message) as EnhancementPlanResult;
  assert.equal(payload.operation, "apply_enhancement_plan");
  assert.equal(payload.deterministic, true);
  assert.equal(payload.sourcePreserved, true);
  assert.deepEqual(payload.quality.violations, []);
});

test("enhancement plan stops before writing when reference inspection fails", async () => {
  let applied = false;
  const service = new EnhancementPlanService(
    { inspectReference: async () => result("reference unavailable", false), runQualityGate: async () => result({ valid: true, violations: [] }) },
    { apply: async () => { applied = true; return { planId: "x", outputFilename: "x.png", format: "png", frames: 1, passesApplied: [], sourcePreserved: true }; } },
  );
  const response = await service.apply({ filename: "source.png", outputFilename: "enhanced.png", format: "png" });
  assert.equal(response.ok, false);
  assert.equal(applied, false);
  assert.equal(response.message, "reference unavailable");
});

test("el payload lleva la medida del ORIGEN, con los mismos umbrales que la del RESULTADO", async () => {
  const gateInputs: { filename: string; maxColors?: number | undefined; maxIsolatedPixels?: number | undefined; minContrast?: number | undefined }[] = [];
  const service = new EnhancementPlanService(
    {
      inspectReference: async () => result(analysis),
      runQualityGate: async (input) => { gateInputs.push(input); return input.filename === "source.png" ? result(gateOf("source.png", 6395), false) : result(gateOf("enhanced.png", 6396), false); },
    },
    { apply: async () => ({ planId: plan.planId, outputFilename: "enhanced.png", format: "png", frames: 1, passesApplied: ["cleanup", "terrain_grain"], sourcePreserved: true }) },
  );

  const response = await service.apply({ filename: "source.png", outputFilename: "enhanced.png", format: "png", maxColors: 64 });
  const payload = JSON.parse(response.message) as EnhancementPlanResult;

  // El origen se mide ANTES de escribir: si no, "antes" seria una foto del despues.
  assert.deepEqual(gateInputs.map((input) => input.filename), ["source.png", "enhanced.png"]);
  for (const input of gateInputs) {
    assert.equal(input.maxColors, 64);
    assert.equal(input.maxIsolatedPixels, 4);
    assert.equal(input.minContrast, 0.08);
  }
  assert.equal(payload.sourceQuality.reports[0]?.colors, 6395);
  assert.deepEqual(payload.sourceQuality.violations, ["frame 1: colors 6395 > 64"]);
  assert.equal(payload.quality.reports[0]?.colors, 6396);
});

test("un gate con infracciones no se convierte en una infraccion que es el JSON entero", async () => {
  const service = new EnhancementPlanService(
    { inspectReference: async () => result(analysis), runQualityGate: async ({ filename }) => result(gateOf(filename, 6396), false) },
    { apply: async () => ({ planId: plan.planId, outputFilename: "enhanced.png", format: "png", frames: 1, passesApplied: ["cleanup"], sourcePreserved: true }) },
  );

  const payload = JSON.parse((await service.apply({ filename: "source.png", outputFilename: "enhanced.png", format: "png", maxColors: 64 })).message) as EnhancementPlanResult;

  // `runQualityGate` responde `ok: false` cuando HAY infracciones, no cuando falla: leer el mensaje
  // solo si `ok` convertia el informe entero en una unica infraccion y perdiamos los numeros.
  assert.equal(payload.quality.valid, false);
  assert.deepEqual(payload.quality.violations, ["frame 1: colors 6396 > 64"]);
  assert.equal(payload.quality.reports[0]?.colors, 6396);
});

test("la tool devuelve el payload del servicio: no hay una segunda copia que se pueda separar", async () => {
  const payload = {
    operation: "apply_enhancement_plan", plan,
    applied: { planId: plan.planId, outputFilename: "enhanced.png", format: "png", frames: 1, passesApplied: ["cleanup"], sourcePreserved: true },
    quality: gateOf("enhanced.png", 6396), sourceQuality: gateOf("source.png", 6395),
    deterministic: true, sourcePreserved: true,
  };
  let applied = 0;
  const handlers = new Map<string, (args: Record<string, unknown>) => Promise<{ content: [{ type: "text"; text: string }] }>>();
  new EnhancementToolController(
    { inspectReference: async () => result(analysis) },
    { apply: async () => { applied += 1; return result(payload); } },
  ).register({ registerTool: (name: string, _config: unknown, handler: never) => { handlers.set(name, handler as never); } } as unknown as McpServer);

  const response = await handlers.get("apply_enhancement_plan")!({ filename: "source.png", output_filename: "enhanced.png", format: "png", max_colors: 64, seed: 1 });

  assert.equal(applied, 1);
  assert.deepEqual(JSON.parse(response.content[0]!.text), payload);
});
