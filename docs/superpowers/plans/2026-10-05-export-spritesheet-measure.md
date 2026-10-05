Estado: completada. MEDIDO con Aseprite: 4 frames, hoja 256x64, frame 64x64 en la hoja. Sin manifest los cinco campos van a null. Suite MCP 205/205, Studio 322/322.

# F20 · `export_spritesheet` dice que escribio

## CORRECCION del plan, medida durante la ronda (leela antes que el resto)

El plan se escribio sobre dos suposiciones que la medicion **`export_spritesheet`** tumbo:

1. **La tool que usa el panel de EXPORTACION no es `export_spritesheet`, es
   `build_animation_sheet`** (`useExport.ts:9-11`). Y esa **ya devolvia la medida**:
   `frames`, `columns`, `rows`, `width`, `height`, `cellWidth`, `cellHeight`, `padding`
   (`AnimationSheetService.ts:82`). O sea que el agujero real estaba **solo en el cliente**, que tiraba
   la respuesta entera y se inventaba su frase.
2. **`export_spritesheet` (la de Aseprite) si devolve una frase sin cifras**, y esa la sigue
   usando cualquiera que no sea el panel. Sigue en el alcance: es el mismo defecto en la tool hermana.

Lo que no cambia: la medida sale de donde el servidor la midio, no se inventa, y sin dato no se pinta.

---

## Contexto, medido con el MCP real (1.1.1 + Aseprite)

Exportando un GIF de 4 frames de 32x32 a `horizontal`, `scale: 2`, pidiendo el manifest:

```
RESPUESTA MCP: { "content": [{ "type": "text",
  "text": "Sprite sheet exported to C:\\...\\artifacts\\run-sheet.png" }], "isError": false }
```

Y lo que hay en disco:

```
artifacts/run-sheet.png   239 b
artifacts/run-sheet.json 1274 b
  frames[0].frame  { "x": 0, "y": 0, "w": 32, "h": 32 }
  frames[0].sourceSize { "w": 32, "h": 32 }
  meta.size { "w": 256, "h": 64 }        <- la hoja que se escribio, ya escalada
```

O sea: el MCP sabe que han salido **4 frames**, en una hoja de **256x64**, con frames de origen de
**32x32**, y devuelve una frase sin cifras. Y el panel va un paso mas alla y **ni esa frase usa**:
`useExport.build()` se inventa su propio `"Spritesheet generado: ${output}"` y tira la respuesta.

El Studio siempre pide el manifest (`manifest_filename`), o sea que los numeros ya estan escritos en
un fichero que el panel ofrece descargar y no lee.

## Objetivo

El export dice que escribio. El MCP devuelve la medida de lo que acaba de escribir (leyendo el manifest
que el propio Aseprite escribio, sin inventar nada) y el panel la ensena, sinvox fabricating.

## Restricciones globales

- **La medida sale del manifest de Aseprite, no de un decoder nuestro.** Leer un PNG para sacar sus
  dimensiones seria reescribir un lector de imagenes; `meta.size` y `frames[]` ya estan ahi y son la
  fuente de verdad de lo que se escribio.
- **`json-hash` tambien**: `frames` es un objeto en ese formato, no un array. Hay que contar las claves.
- **Sin manifest no hay medida**: si no se pidio `data_filename` no hay JSON que leer, y entonces los
  campos van a `null` y el panel **no pinta la linea**. `0 frames` seria una medida y no es lo que se
  sabe (mismo criterio que las rondas 41 y 43).
- **`frameWidth`/`frameHeight` son del ORIGEN**, no de la hoja escalada: `sourceSize` del manifest. El
  panel ya sabe el factor que pidio, y derivar `meta.size / framesPorFila` seria inventar la disposicion.
- **El panel deja de inventar el mensaje**: si el MCP dice que escribio `output`, ese es el nombre que
  se ensena (relativizado al workspace), no el que el panel suponia.
- `deterministic: true` **no** se anade: nadie lo midio en esta ruta.

## Task 1 (MCP): la medida, sacada del manifest

**Files:**
- `src/infrastructure/aseprite/SpriteSheetManifest.ts` (NUEVO): `SpriteSheetMeasure` +
  `measureSheetManifest(text: string): SpriteSheetMeasure`, pura. Coge `frames` (array u objeto),
  `meta.size.{w,h}` y `frames[0].sourceSize.{w,h}`. JSON invalido o campos ausentes -> `null`, nunca 0.
- `src/infrastructure/aseprite/AsepriteSceneAdapter.ts`: `exportSpritesheet` devuelve el payload JSON en
  vez de la frase, con `output`, `data`, `sheetType`, `scale`, `padding` y la medida. Lee el manifest
  solo si se pidio y solo si existe (ya se verifica con `fs.access`).
- `tests-ts/export-spritesheet-measure.test.ts` (NUEVO): el manifest **real** capturado arriba
  (`meta.size 256x64`, 4 frames, `sourceSize 32x32`), el mismo manifest en `json-hash`, y texto que no es
  JSON.

**Interfaces:**
- Produce: `{ operation: "export_spritesheet", output, data, sheetType, scale, padding, frames, width,
  height, frameWidth, frameHeight, sourcePreserved }` con los cinco ultimos a `null` si no hay manifest.

- [x] **Step 1: tests rojos** (los tres casos de arriba)
- [x] **Step 2: implementar** (funcion pura + 6 lineas en el adapter)
- [x] **Step 3: `npm test` y `npm run build`**

## Task 2 (Studio): la linea y el nombre del MCP

**Files:**
- `src/features/export/useExport.ts`: `ExportResult.sheet: SheetMeasure | null` leyendo el payload; y el
  `output` que se ensena pasa a ser el que devuelve el MCP cuando viene (relativizado), con el pedido
  como respaldo.
- `src/features/export/ExportPanel.tsx`: `4 frames · 256×64 px · frame 32×32 · ×2` bajo el mensaje, con
  `tabular-nums`. Sin manifest, sin linea.
- `src/styles/app.css`: una regla, `.export-sheet`, con el mismo criterio tabular que `.polish-measure`.
- `tests/export-flow.test.tsx`

**Interfaces:**
- Consumes: `export_spritesheet.{output, frames, width, height, frameWidth, frameHeight, scale}`.
- Produce: una linea de medida; el mensaje deja de ser inventado.

- [x] **Step 1: tests rojos** (con manifest: la linea; sin manifest: no hay linea)
- [x] **Step 2: implementar**
- [x] **Step 3: suite, typecheck, build**

## Fuera de alcance

- **`export_sprite_atlas` y `export_asset_bundle`**. El atlas tiene su propio manifiesto y el bundle
  tres ficheros; medirlos es otra ronda, no un tambahien en esta.
- **Verificar que el PNG existe y sus bytes.** El adapter ya falla si Aseprite dice que si y el fichero no
  esta (linea 76-82). Repetirlo aqui no anade nada.
- **Un veredicto** ("esta hoja cabe en tu atlas"). El usuario sabe su presupuesto; el panel no.
- **`changedRatio`-style campos derivados**: ni la disposicion por filas ni el tamano escalado por frame.

## Verificacion

- MCP: suite, typecheck, build, y una llamada real con Aseprite que devuelva el payload con las cifras.
- Studio: suite, typecheck, build, y navegador real (escritorio y movil) exportando el GIF de 4 frames.
- Evidencia en los dos repos, commit atomico en cada uno, push, CI verde y limpio.