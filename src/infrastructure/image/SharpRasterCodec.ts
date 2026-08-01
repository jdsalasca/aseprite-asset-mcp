import sharp from "sharp";
import type { ImageOutputFormat, RasterCodec } from "../../domain/image-assets.js";
import type { RasterFrame } from "../../domain/pixel-art.js";

function assertFrames(frames: RasterFrame[]): void {
  if (frames.length === 0) throw new Error("At least one frame is required");
  const first = frames[0];
  if (!first) throw new Error("At least one frame is required");
  for (const frame of frames) {
    if (frame.width !== first.width || frame.height !== first.height) throw new Error("All frames must have the same dimensions");
    if (frame.pixels.length !== frame.width * frame.height * 4) throw new Error("Frame pixel buffer has an invalid length");
  }
}

export class SharpRasterCodec implements RasterCodec {
  public async decode(filename: string): Promise<RasterFrame[]> {
    const source = sharp(filename, { animated: true });
    const metadata = await source.metadata();
    const width = metadata.width;
    const pages = Math.max(1, metadata.pages ?? 1);
    if (!width || !metadata.height) throw new Error("Image has no readable dimensions");
    const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pageHeight = metadata.pageHeight ?? Math.floor(info.height / pages);
    if (!pageHeight || info.height < pageHeight * pages) throw new Error("Animated image has invalid frame dimensions");
    const frames: RasterFrame[] = [];
    for (let index = 0; index < pages; index += 1) {
      const start = index * width * pageHeight * 4;
      const end = start + width * pageHeight * 4;
      const pixels = new Uint8ClampedArray(data.subarray(start, end));
      const delay = metadata.delay?.[index] ?? metadata.delay?.[0];
      frames.push({ width, height: pageHeight, pixels, ...(delay === undefined ? {} : { delayMs: delay }) });
    }
    return frames;
  }

  public async encode(frames: RasterFrame[], filename: string, format: ImageOutputFormat): Promise<void> {
    assertFrames(frames);
    const first = frames[0];
    if (!first) throw new Error("At least one frame is required");
    if (format === "png") {
      await sharp(Buffer.from(first.pixels), { raw: { width: first.width, height: first.height, channels: 4 } }).png().toFile(filename);
      return;
    }
    const pageBuffer = Buffer.concat(frames.map((frame) => Buffer.from(frame.pixels)));
    await sharp(pageBuffer, {
      raw: { width: first.width, height: first.height * frames.length, channels: 4, pageHeight: first.height },
    }).gif({ loop: 0, delay: frames.map((frame) => frame.delayMs ?? 100) }).toFile(filename);
  }
}
