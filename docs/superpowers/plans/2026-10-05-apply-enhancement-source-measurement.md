Estado: completada. Coste medido: gate del origen 20.1 ms en caliente sobre 96x96, apply completo 66.6 ms con los dos gates. Medido de verdad: ORIGEN 6384 colores, RESULTADO 6383.

# F18 · `apply_enhancement_plan` mide tambien el ORIGEN

## Contexto, medido en la ronda 41 (no supuesto)

Aplicando el plan real a un PNG de 96x96 con ruido, MCP 1.1.1:

```
ANTES     assets/hero.png              6395 colores   (inspect_asset_bundle, filename SINGULAR)
DESPUES   artifacts/hero-enhanced.png  6396 colores   (quality.reports[0] del propio apply)
```

Las dos pasadas no hicieron nada: empeoraron en un color. El MCP se porta bien, porque su tercera
pasada es `quality_gate` y el veredicto lo dice con franqueza (`valid: false`, `frame 1: colors 6396 > 64`).
Lo que no existia era la medida del ANTES al lado: "Aplicadas 2 pasadas" era una afirmacion que el
panel no podia comprobar. La ronda 41 arreglo el cliente; esta cierra el circulo en el servidor.

## Lo que hay que arreglar antes de anadir nada: dos copias que discrepan

`apply_enhancement_plan` esta implementado DOS veces y las dos no hacen lo mismo:

| | quien llama al gate | como lee el mensaje | que recibe el cliente |
|---|---|---|---|
| `EnhancementToolController` (`interfaces/controllers/EnhancementToolController.ts:51-53`) | el Studio | `JSON.parse` **siempre**, con fallback | payload completo, `reports` incluido |
| `EnhancementPlanService` (`application/services/EnhancementPlanService.ts:26-29`) | REST y `apply_enhancement_batch` | `JSON.parse` solo si `ok` | el JSON entero metido como UNA infraccion |

La causa del segundo caso: `VisualAssetService.runQualityGate` responde `ok: violations.length === 0`
(`application/services/VisualAssetService.ts:252`). O sea que **el gate contesta `ok: false` cuando
HAY infracciones**, que es justo el caso interesante, y el servicio confunde "no cumple" con "fallo".

Y el tipo lo tapa: `EnhancementPlanResult.quality: { valid: boolean; violations: string[] }`
(`domain/enhancement.ts:59`) no menciona `reports`, `filename` ni `frames`, o sea que el tipo
describe menos de lo que la tool ya envia. Por eso el Studio tuvo que leer `reports` a mano.

## Objetivo

`apply_enhancement_plan` devuelve la medida del ORIGEN junto a la del RESULTADO, construida en un
unico sitio, con los MISMOS umbrales, y el panel enseña las dos lineas.

## Restricciones globales

- El gate del origen y el del resultado usan los mismos parametros (`maxColors` de la tool,
  `maxIsolatedPixels: 4`, `minContrast: 0.08`). Con umbrales distintos la comparacion miente.
- `reports[0]`, sin promediar y sin derivar: un frame es lo que hay, y una media seria inventar.
- Medir el origen NO puede tumbar el apply. Si el gate no devuelve medida, el campo va sin informes
  (`reports: []`) y el panel no dibuja la linea. No se inventa un cero.
- El payload conserva `plan`, `applied` y `quality` (el Studio ya depende de esos tres) y gana
  `sourceQuality`. Sin tool nueva, sin endpoint nuevo, sin dependencia nueva.
- La tool pasa a delegar en el servicio. Una sola copia de "aplicar un plan y medirlo".

## Task 1 (MCP): el origen medido con el mismo gate, y una sola copia

**Files:**
- `src/domain/visual-assets.ts`: `QualityGateReport` (`PixelArtQualityReport` + `bandingRuns`) y
  `QualityGateResult` (`filename`, `valid`, `frames`, `reports`, `violations`), al lado del
  `QualityGateInput` que ya existe.
- `src/domain/enhancement.ts`: `quality: QualityGateResult` y `+ sourceQuality: QualityGateResult`.
- `src/application/services/EnhancementPlanService.ts`: helper privado `gate()` que parsea el mensaje
  sea cual sea `ok`; gate del ORIGEN antes de aplicar; se queda con el gate del RESULTADO.
- `src/interfaces/controllers/EnhancementToolController.ts`: `apply_enhancement_plan` delega en el
  servicio (se borran las 10 lineas duplicadas); el constructor pasa a
  `(visualAssets, enhancementPlan)`.
- `src/interfaces/mcp-server.ts:395`: pasar `this.enhancementPlan` al controller.

**Interfaces:**
- Produce: `EnhancementPlanResult.sourceQuality: QualityGateResult`, medido sobre `input.filename`
  con los umbrales de la tool.
- Orden de llamadas esperado: `inspect` (source) -> `quality` (source) -> `apply` -> `quality` (output).

- [x] **Step 1: tests rojos**
  1. El payload lleva `sourceQuality` medido sobre el ORIGEN, no sobre la salida.
  2. Un gate con infracciones (`ok: false`, mensaje JSON) NO se convierte en una infraccion que es el
     JSON entero: `quality.violations` son las cadenas reales y `quality.reports` viene.
  3. La tool devuelve el payload del servicio, no su propia copia: se registra la tool con un server
     falso y se comprueba que el texto es el del servicio. Este es el guard que impide que las dos
     copias vuelvan a separarse.

- [x] **Step 2: implementar** (lo minimo: el helper, el gate del origen, el tipo, la delegacion)

- [x] **Step 3: `npm test` y `npm run build` en verde**

## Task 2 (Studio): las dos lineas

**Files:**
- `src/features/polish/usePolish.ts`: `PolishResult.sourceMeasurement: QualityReport | null` leido de
  `sourceQuality.reports[0]` con el `readReport` que ya existe.
- `src/features/polish/PolishPanel.tsx`: linea `ORIGEN` (atenuada) encima de la de `AHORA`, con el
  mismo formato de cifras. Sin veredicto: el panel no sabe si subir colores es bueno o malo, asi que
  no lo dice.
- `src/styles/app.css`: `.polish-measure--source` y el tag con `min-width` para que ORIGEN y AHORA
  alineen, como hace `.scene-layer__role`.
- `tests/polish-flow.test.tsx`

**Interfaces:**
- Consumes: `apply_enhancement_plan.sourceQuality.reports[0]`.
- Produce: dos lineas de medida; la de AHORA no cambia de contenido.

- [x] **Step 1: tests rojos** (ORIGEN con 6395 colores; y sin `sourceQuality.reports` no hay linea ORIGEN)
- [x] **Step 2: implementar**
- [x] **Step 3: suite, typecheck, build**

## Fuera de alcance

- **Un veredicto de "mejoro / empeoro"**. Seria juzgar; el panel no sabe la intencion de cada pasada.
- **`apply_enhancement_batch` gana `sourceQuality`**: mapea `quality` a mano a proposito
  (`EnhancementBatchService.ts:51`). Solo se beneficia del arreglo del parseo.
- **Refactorizar `runQualityGate` para reutilizar el analisis**: el origen se decodifica dos veces
  (el gate y su `inspectReference` interno). Se acepta y se anota.
- **Publicar en npm**: `npm whoami` sigue dando E401.
- **`suggest_enhancement_plan`**: no escribe nada, no hay despues que comparar.

## Verificacion

- MCP: unit tests, typecheck, build, y una llamada real al mismo PNG ruidoso: numeros antes/despues
  y coste de la llamada de mas medido.
- Studio: suite completa, typecheck, build, y navegador real (escritorio y movil) con las dos lineas.
- Evidencia en los dos repos, commit atomico en cada uno, push, CI verde y limpio.
