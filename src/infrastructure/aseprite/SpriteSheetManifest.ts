/**
 * Que se escribio, leido del manifest que escribio Aseprite.
 *
 * No hay decoder de PNG aqui a proposito: `meta.size` y `frames[]` son la fuente de verdad de lo que
 * hay en la hoja, y leer la cabecera del PNG seria reescribir un lector de imagenes para sacar dos
 * numeros. Lo que no se puede leer se queda en `null`, nunca en 0: `0 frames` es una medida y aqui no
 * se ha medido nada.
 */
export interface SpriteSheetMeasure {
  /** Frames que hay en el manifest. */
  frames: number | null;
  /** Tamano de la hoja escrita, ya escalada (`meta.size`). */
  width: number | null;
  height: number | null;
  /** Tamano de cada frame EN LA HOJA (`sourceSize` del primer frame). MEDIDO: Aseprite ya lo escribe escalado. */
  frameWidth: number | null;
  frameHeight: number | null;
}

/** Lo que devuelve `export_spritesheet`: que se escribio y con que medidas. */
export interface SpriteSheetExportResult extends SpriteSheetMeasure {
  operation: "export_spritesheet";
  output: string;
  data?: string;
  sheetType: string;
  scale: number;
  padding: number;
  sourcePreserved: true;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function number(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

export function measureSheetManifest(text: string): SpriteSheetMeasure {
  let manifest: Record<string, unknown>;
  try {
    manifest = record(JSON.parse(text));
  } catch {
    return { frames: null, width: null, height: null, frameWidth: null, frameHeight: null };
  }
  // `json-array` trae `frames` como lista y `json-hash` como objeto con una clave por frame.
  const rawFrames = manifest.frames;
  const frames = Array.isArray(rawFrames)
    ? rawFrames.length
    : typeof rawFrames === "object" && rawFrames !== null
      ? Object.keys(rawFrames).length
      : null;
  const first = Array.isArray(rawFrames) ? record(rawFrames[0]) : record(record(Object.values(rawFrames ?? {})[0]));
  const size = record(record(manifest.meta).size);
  const source = record(first.sourceSize);
  return {
    frames,
    width: number(size.w),
    height: number(size.h),
    frameWidth: number(source.w),
    frameHeight: number(source.h),
  };
}