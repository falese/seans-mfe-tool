import * as zlib from 'zlib';
import type { Image } from '../png';

/** A minimal PNG encoder for tests: RGBA or RGB, 8-bit, one filter type per row (cycled). */
export function encodePng(img: Image, opts: { channels?: 3 | 4; filters?: number[] } = {}): Buffer {
  const channels = opts.channels ?? 4;
  const filters = opts.filters ?? [0];
  const stride = img.width * channels;
  const raw = Buffer.alloc((stride + 1) * img.height);
  const row = (y: number) => {
    const out = Buffer.alloc(stride);
    for (let x = 0; x < img.width; x += 1) for (let c = 0; c < channels; c += 1) out[x * channels + c] = img.data[(y * img.width + x) * 4 + c];
    return out;
  };
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < img.height; y += 1) {
    const cur = row(y);
    const f = filters[y % filters.length];
    raw[y * (stride + 1)] = f;
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const pred = [0, a, b, Math.floor((a + b) / 2), paeth][f];
      raw[y * (stride + 1) + 1 + i] = (cur[i] - pred) & 0xff;
    }
    prev = cur;
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  const idat = zlib.deflateSync(raw);
  // Split IDAT in two: decoders must concatenate.
  const half = Math.floor(idat.length / 2);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat.subarray(0, half)),
    chunk('IDAT', idat.subarray(half)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
