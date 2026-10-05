import test from "node:test";
import assert from "node:assert/strict";
import { measureSheetManifest } from "../src/infrastructure/aseprite/SpriteSheetManifest.js";

/**
 * Manifest REAL que escribio Aseprite (medido en la ronda 44) al exportar un GIF de 4 frames de 32x32
 * en `horizontal` con `scale: 2`. Ojo al dato que no se supone: `frame` y `sourceSize` salen a **64x64**,
 * o sea que Aseprite ya escribe el frame escalado en la hoja (4 x 64 = 256 = `meta.size.w`).
 */
const MANIFEST = JSON.stringify({
  frames: [
    { filename: "run-sheet.png", frame: { x: 0, y: 0, w: 64, h: 64 }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 }, sourceSize: { w: 64, h: 64 }, duration: 100 },
    { filename: "run-sheet.png", frame: { x: 64, y: 0, w: 64, h: 64 }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 }, sourceSize: { w: 64, h: 64 }, duration: 100 },
    { filename: "run-sheet.png", frame: { x: 128, y: 0, w: 64, h: 64 }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 }, sourceSize: { w: 64, h: 64 }, duration: 100 },
    { filename: "run-sheet.png", frame: { x: 192, y: 0, w: 64, h: 64 }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 }, sourceSize: { w: 64, h: 64 }, duration: 100 },
  ],
  meta: { app: "aseprite", version: "1.3.11", format: "I8", image: "run-sheet.png", size: { w: 256, h: 64 }, scale: "1" },
});

test("la medida sale del manifest: cuantos frames, que hoja y de que tamano es cada frame EN LA HOJA", () => {
  assert.deepEqual(measureSheetManifest(MANIFEST), { frames: 4, width: 256, height: 64, frameWidth: 64, frameHeight: 64 });
});

test("`json-hash` cuenta las claves: en ese formato `frames` es un objeto, no un array", () => {
  const hash = JSON.stringify({
    frames: {
      "run-sheet0": { frame: { x: 0, y: 0, w: 32, h: 32 }, sourceSize: { w: 32, h: 32 } },
      "run-sheet1": { frame: { x: 32, y: 0, w: 32, h: 32 }, sourceSize: { w: 32, h: 32 } },
    },
    meta: { size: { w: 64, h: 32 } },
  });

  assert.deepEqual(measureSheetManifest(hash), { frames: 2, width: 64, height: 32, frameWidth: 32, frameHeight: 32 });
});

// Sin manifest no hay medida: `0 frames` y `0 px` serian medidas que nadie ha hecho.
test("un manifest que no se puede leer no inventa ceros: todo a null", () => {
  const vacio = { frames: null, width: null, height: null, frameWidth: null, frameHeight: null };

  assert.deepEqual(measureSheetManifest("no soy json"), vacio);
  assert.deepEqual(measureSheetManifest(""), vacio);
  assert.deepEqual(measureSheetManifest(JSON.stringify({ meta: {} })), vacio);
});

// "No lo sé" y "son cero" son cosas distintas: aqui el recuento sale del manifest, asi que es un dato,
// mientras que los tamaños que no vienen de el se quedan en null.
test("un manifest parcial dice lo que sabe y calla lo que no", () => {
  assert.deepEqual(measureSheetManifest(JSON.stringify({ frames: [{}] })), {
    frames: 1, width: null, height: null, frameWidth: null, frameHeight: null,
  });
});