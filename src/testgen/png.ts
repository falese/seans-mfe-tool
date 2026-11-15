/**
 * Visual baselines cut from a capture's screenshots (ADR-129 §4).
 *
 * A capture holds one viewport screenshot per step. A capability's baseline is
 * its rectangle cut out of that screenshot, with the rectangles of other
 * placed capabilities inside it painted a flat mask colour. The generated
 * Playwright spec paints the same rectangles over the live page before it
 * screenshots the same clip, so the two images are comparable pixel for pixel
 * and a change counts once — in the capability that drew it.
 */

import * as zlib from 'zlib';
import { decodePng, type Image } from '../decompose/verify/png';
import type { Rect } from './select';

/** What masked areas are painted, in the baseline and over the live page alike. */
export const MASK_RGBA: [number, number, number, number] = [255, 0, 255, 255];
export const MASK_CSS = '#ff00ff';

/** 8-bit RGBA, no filtering: baselines are small and written once. */
export function encodePng(img: Image): Buffer {
  const stride = img.width * 4;
  const raw = Buffer.alloc((stride + 1) * img.height);
  for (let y = 0; y < img.height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(img.data.buffer, img.data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const crcTable = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer): number => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** `rect` cut out of `img`, with each of `mask` (page coordinates) painted the mask colour. */
export function cropMasked(img: Image, rect: Rect, mask: Rect[]): Image {
  const out = new Uint8Array(rect.width * rect.height * 4);
  for (let y = 0; y < rect.height; y += 1) {
    for (let x = 0; x < rect.width; x += 1) {
      const px = rect.x + x;
      const py = rect.y + y;
      const o = (y * rect.width + x) * 4;
      const masked = mask.some((m) => px >= m.x && px < m.x + m.width && py >= m.y && py < m.y + m.height);
      if (masked || px >= img.width || py >= img.height) {
        out.set(masked ? MASK_RGBA : [0, 0, 0, 0], o);
        continue;
      }
      const i = (py * img.width + px) * 4;
      out.set(img.data.subarray(i, i + 4), o);
    }
  }
  return { width: rect.width, height: rect.height, data: out };
}

/** A capability's baseline PNG from its step's screenshot. */
export function baselinePng(screenshot: Buffer, rect: Rect, mask: Rect[]): Buffer {
  return encodePng(cropMasked(decodePng(screenshot), rect, mask));
}
