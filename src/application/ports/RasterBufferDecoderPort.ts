import type { RasterFrame } from "../../domain/pixel-art.js";

export interface RasterBufferDecoderPort {
  decodeBuffer(data: Uint8Array): Promise<RasterFrame[]>;
}
