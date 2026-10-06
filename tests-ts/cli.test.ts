import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseCliOptions } from "../src/workflows/cli.js";

/**
 * `--root` y `--output` decian dos cosas distintas sobre "aqui". `root` por defecto era el CWD, pero
 * `outputDirectory` por defecto era la ruta **relativa** `artifacts/aseprite`, que se resuelve al
 * usarla contra el CWD. Medido desde un directorio distinto del proyecto:
 *
 *     cd  <shell vacia>
 *     npx tsx scripts/character-workflow.ts --root <proyecto>
 *
 *     proyecto : (vacio)
 *     shell    : artifacts/aseprite/hero/hero.character.plan.json
 *                artifacts/aseprite/hero/hero.godot.json
 *
 * O sea: el plan y el manifiesto que describen el proyecto se escriben fuera de el, en el directorio
 * desde el que se lanzo el comando. Y el CLI no tenia **ni un test** -los dos scripts que lo usan,
 * `character-workflow.ts` y `scene-workflow.ts`, no tenian ninguno-.
 *
 * Aqui se fija donde acaba `outputDirectory`. El caso 3 es el que protege lo que NO hay que tocar: un
 * `--output` absoluto explicito significa "escribe aqui", y esa es una instruccion, no un fallo.
 */

async function raizTemporal(): Promise<string> {
  // Raiz real, no un literal: en Windows el separador y las mayúsculas hacen fallar comparaciones de
  // cadenas que en Linux pasan, y un test que solo funciona en un sistema no es un test.
  return mkdtemp(path.join(os.tmpdir(), "cli-root-"));
}

test("el output por defecto cae dentro de --root, no en el directorio de trabajo", async () => {
  const root = await raizTemporal();
  try {
    const options = parseCliOptions(["--root", root]);
    assert.equal(options.outputDirectory, path.resolve(root, "artifacts", "aseprite"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("un --output relativo tambien se resuelve contra --root", async () => {
  const root = await raizTemporal();
  try {
    const options = parseCliOptions(["--root", root, "--output", "salida"]);
    assert.equal(options.outputDirectory, path.resolve(root, "salida"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("un --output absoluto explicito se respeta tal cual, incluso fuera de --root", async () => {
  const root = await raizTemporal();
  const explicito = path.resolve(os.tmpdir(), "destino-explicito");
  try {
    const options = parseCliOptions(["--root", root, "--output", explicito]);
    // Si el arreglo tocara los absolutos, este caso lo coge. Convertirlo a relativo, o meterlo dentro
    // de root, seria un fallo nuevo y peor: quitarle al usuario la capacidad de escribir donde quiere.
    assert.equal(options.outputDirectory, explicito);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("sin --root, root y output siguen siendo el directorio de trabajo", async () => {
  const options = parseCliOptions([]);
  // El caso que ya funcionaba y no puede cambiar: sin --root no hay proyecto, y el CWD es la unica
  // referencia posible.
  assert.equal(options.root, process.cwd());
  assert.equal(options.outputDirectory, path.resolve(process.cwd(), "artifacts", "aseprite"));
});