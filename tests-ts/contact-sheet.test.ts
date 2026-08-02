import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import { ContactSheetService } from "../src/application/services/ContactSheetService.js";
import { SharpRasterCodec } from "../src/infrastructure/image/SharpRasterCodec.js";
import { JsonAssetManifestWriter } from "../src/infrastructure/image/JsonAssetManifestWriter.js";

test("contact sheet fits heterogeneous sprites in deterministic cells and writes a navigable manifest", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-contact-sheet-test-"));
  const first = path.join(directory, "wide.png");
  const second = path.join(directory, "tall.png");
  const output = path.join(directory, "preview-sheet.png");
  const manifest = path.join(directory, "preview-sheet.json");
  await sharp(Buffer.from([255, 20, 40, 255, 255, 20, 40, 255]), { raw: { width: 2, height: 1, channels: 4 } }).png().toFile(first);
  await sharp(Buffer.from([20, 40, 255, 255, 20, 40, 255, 255]), { raw: { width: 1, height: 2, channels: 4 } }).png().toFile(second);
  const sourceBefore = await fs.readFile(first);
  const service = new ContactSheetService(new SharpRasterCodec(), new JsonAssetManifestWriter());

  const result = await service.build({ inputFilenames: [first, second], outputFilename: output, manifestFilename: manifest, cellWidth: 8, cellHeight: 8, columns: 2, padding: 1 });
  assert.equal(result.ok, true, result.message);
  const payload = JSON.parse(result.message) as { operation: string; width: number; height: number; assets: number; deterministic: boolean; sourcePreserved: boolean };
  assert.deepEqual(payload, { operation: "build_contact_sheet", output, manifest, assets: 2, columns: 2, rows: 1, width: 17, height: 8, cellWidth: 8, cellHeight: 8, padding: 1, deterministic: true, sourcePreserved: true });
  assert.deepEqual(await fs.readFile(first), sourceBefore);
  assert.deepEqual((await sharp(output).metadata()).width, 17);
  assert.match(await fs.readFile(manifest, "utf8"), /"kind": "contact_sheet"/);
  assert.match(await fs.readFile(manifest, "utf8"), /"renderWidth": 2/);
});

test("contact sheet rejects unsafe collisions, empty input, invalid cells, and manifest overwrite", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aseprite-contact-sheet-invalid-"));
  const input = path.join(directory, "source.png");
  await sharp(Buffer.from([255, 0, 0, 255]), { raw: { width: 1, height: 1, channels: 4 } }).png().toFile(input);
  const service = new ContactSheetService(new SharpRasterCodec(), new JsonAssetManifestWriter());
  const base = { inputFilenames: [input], outputFilename: path.join(directory, "sheet.png"), manifestFilename: path.join(directory, "sheet.json"), cellWidth: 16, cellHeight: 16 };
  assert.equal((await service.build({ ...base, inputFilenames: [] })).ok, false);
  assert.equal((await service.build({ ...base, outputFilename: input })).ok, false);
  assert.equal((await service.build({ ...base, manifestFilename: input })).ok, false);
  assert.equal((await service.build({ ...base, cellWidth: 7 })).ok, false);
  assert.equal((await service.build({ ...base, cellHeight: 513 })).ok, false);
  assert.equal((await service.build({ ...base, columns: 17 })).ok, false);
  assert.equal((await service.build({ ...base, padding: 65 })).ok, false);
});
