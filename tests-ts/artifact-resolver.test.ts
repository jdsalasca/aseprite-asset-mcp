import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { FileAssetArtifactResolver } from "../src/infrastructure/jobs/FileAssetArtifactResolver.js";

/**
 * Los tres tests de este fichero creaban su directorio con `mkdtemp(path.join(process.cwd(), ...))` y
 * no lo borraban nunca. Medido: **117 directorios `.artifact-*` en la raiz del repo**, 156 ficheros, los
 * mas antiguos del 2026-10-02, mas tres nuevos por cada ejecucion de la suite.
 *
 * Lo que hace la ronda mas incomoda no es que esten sucios: es que **git no los ve**. Los 156 ficheros
 * son 117 `.png` y 39 `.gif`, y `.gitignore` ya descarta ambos por ser archivos de Aseprite, asi que
 * `git status` sale limpio y `git ls-files` da cero. Cuatro dias de acumulacion y nada se quejo. En
 * cuanto un test escriba ahi un `.json`, aparecera como untracked y se podra commitear por accidente.
 *
 * Por eso esta guardia mira **el disco** y no el estado de git: aqui el estado de git no puede ser el
 * vigilante de si mismo.
 */
test("ningun test deja un directorio .artifact- en la raiz del repo", async () => {
  const entradas = await readdir(process.cwd(), { withFileTypes: true });
  const directorios = entradas.filter((entrada) => entrada.isDirectory() && entrada.name.startsWith(".artifact-")).map((entrada) => entrada.name);

  // Los nombres van en el mensaje a proposito: si esto falla dentro de seis meses, quien lo lea necesita
  // saber cuales son para entender que se ha colado.
  assert.deepEqual(directorios, [], `directorios .artifact-* en la raiz del repo: ${directorios.join(", ")}`);
});

/**
 * `os.tmpdir()` y no `process.cwd()`: el temporal del sistema es lo unico que se limpia cuando el proceso
 * muere; la raiz del repo no. Y `t.after` en vez de un `try/finally` en cada test: con `t.after` no se
 * puede olvidar el borrado al anadir un caso nuevo. Un `try/finally` se copia tres veces y el cuarto se
 * olvida, que es exactamente como aparecieron estos 117.
 */
async function temporal(t: TestContext, prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("file artifact resolver records deterministic metadata", async (t) => {
  const directory = await temporal(t, ".artifact-test-");
  const output = path.join(directory, "sprite.GIF");
  await writeFile(output, Buffer.from("pixel-art"));
  const resolver = new FileAssetArtifactResolver(() => "2026-08-02T00:00:00.000Z");

  const [artifact] = await resolver.resolve("job_hash", { jobs: [{ recipe: "gif", inputFilenames: ["source.png"], outputFilename: output }], dryRun: false });

  assert.equal(artifact?.jobId, "job_hash");
  assert.equal(artifact?.format, "gif");
  assert.equal(artifact?.sizeBytes, 9);
  assert.equal(artifact?.sha256, "c34b4a0d0888dc4635e11d52fed9d1848320fb9f7af4a8f8df23a55c5e237f72");
  assert.equal(artifact?.createdAt, "2026-08-02T00:00:00.000Z");
});

test("file artifact resolver fails when a successful job output is missing", async () => {
  const resolver = new FileAssetArtifactResolver();
  await assert.rejects(() => resolver.resolve("job_missing", { jobs: [{ recipe: "gif", inputFilenames: ["source.png"], outputFilename: path.join(process.cwd(), ".missing-output.gif") }], dryRun: false }));
});

test("file artifact resolver gives equal-content outputs distinct ids", async (t) => {
  const directory = await temporal(t, ".artifact-distinct-");
  const first = path.join(directory, "first.png");
  const second = path.join(directory, "second.png");
  await writeFile(first, Buffer.from("same"));
  await writeFile(second, Buffer.from("same"));
  const resolver = new FileAssetArtifactResolver();
  const artifacts = await resolver.resolve("job_same", { jobs: [{ recipe: "atlas", inputFilenames: ["a.png"], outputFilename: first }, { recipe: "atlas", inputFilenames: ["b.png"], outputFilename: second }], dryRun: false });

  assert.equal(artifacts.length, 2);
  assert.notEqual(artifacts[0]?.id, artifacts[1]?.id);
});

test("file artifact resolver enforces configured roots and rejects null bytes", async (t) => {
  const directory = await temporal(t, ".artifact-allowed-");
  const output = path.join(directory, "safe.png");
  await writeFile(output, Buffer.from("safe"));
  const resolver = new FileAssetArtifactResolver(undefined, [directory]);

  await assert.doesNotReject(() => resolver.resolve("job_allowed", { jobs: [{ recipe: "atlas", inputFilenames: ["source.png"], outputFilename: output }], dryRun: false }));
  await assert.rejects(() => resolver.resolve("job_escape", { jobs: [{ recipe: "atlas", inputFilenames: ["source.png"], outputFilename: path.join(directory, "..", "outside.png") }], dryRun: false }), /outside allowed roots/);
  await assert.rejects(() => resolver.resolve("job_null", { jobs: [{ recipe: "atlas", inputFilenames: ["source.png"], outputFilename: `${output}\0bad` }], dryRun: false }), /invalid null byte/);
});
