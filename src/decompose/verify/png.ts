/**
 * Just enough PNG to compare screenshots region by region (ADR-113 §2).
 *
 * Browser screenshots are 8-bit, non-interlaced RGB or RGBA, so that is what
 * this decodes; anything else is refused with a message rather than misread.
 * A dependency would buy palettes and 16-bit depth the gate never sees.
 */

import * as zlib from 'zlib';
import { ValidationError } from '@seans-mfe/contracts';

export interface Image {
  width: number;
  height: number;
  /** RGBA, row-major. */
  data: Uint8Array;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
/** Colour type → channels: grey, RGB, grey+alpha, RGBA. */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };

const fail = (why: string): never => {
  throw new ValidationError(`cannot decode screenshot: ${why}`, 'screenshot', 'png');
};

export function decodePng(buf: Buffer): Image {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) fail('not a PNG');
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  for (let at = 8; at + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    const data = buf.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) fail(`only 8-bit samples are supported (got ${data[8]})`);
      channels = CHANNELS[data[9]] ?? fail(`colour type ${data[9]} is not supported`);
      if (data[12] !== 0) fail('interlaced images are not supported');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    at += 12 + len;
  }
  if (!channels) fail('no IHDR chunk');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const base = y * (stride + 1);
    const filter = raw[base];
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i += 1) {
      const x = raw[base + 1 + i];
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) fail(`unknown filter ${filter} on row ${y}`);
      cur[i] = (x + pred) & 0xff;
    }
    for (let px = 0; px < width; px += 1) {
      const o = (y * width + px) * 4;
      const s = px * channels;
      if (channels >= 3) {
        out[o] = cur[s];
        out[o + 1] = cur[s + 1];
        out[o + 2] = cur[s + 2];
        out[o + 3] = channels === 4 ? cur[s + 3] : 255;
      } else {
        out[o] = out[o + 1] = out[o + 2] = cur[s];
        out[o + 3] = channels === 2 ? cur[s + 1] : 255;
      }
    }
    prev = cur;
  }
  return { width, height, data: out };
}

function clip(img: Image, r: Rect): Rect {
  const x = Math.max(0, Math.floor(r.x));
  const y = Math.max(0, Math.floor(r.y));
  const right = Math.min(img.width, Math.floor(r.x + r.width));
  const bottom = Math.min(img.height, Math.floor(r.y + r.height));
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

/**
 * Pixels in `ra` of `a` that differ from the same offset in `rb` of `b` —
 * each region compared by its own content, so one that moved on the page
 * still matches. A difference of at most `tolerance` in every channel (default
 * 4 of 255) is rendering noise, not a change: same-machine renders of the same
 * page are pixel-identical, and a deliberate colour change moves a channel by
 * more. Pixels inside `exclude` (rects on `a`'s page,
 * the nested regions) are skipped, so a change counts once, in the region
 * that drew it. Regions of different sizes differ entirely.
 */
export function diffRegion(
  a: Image,
  ra: Rect,
  b: Image,
  rb: Rect,
  opts: { tolerance?: number; exclude?: Rect[] } = {}
): { pixels: number; differing: number } {
  const tolerance = opts.tolerance ?? 4;
  const exclude = (opts.exclude ?? []).map((r) => clip(a, r));
  const ca = clip(a, ra);
  const cb = clip(b, rb);
  const inside = (x: number, y: number) => exclude.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
  let pixels = 0;
  let differing = 0;
  const sameSize = ca.width === cb.width && ca.height === cb.height;
  for (let y = 0; y < ca.height; y += 1) {
    for (let x = 0; x < ca.width; x += 1) {
      if (inside(ca.x + x, ca.y + y)) continue;
      pixels += 1;
      if (!sameSize) {
        differing += 1;
        continue;
      }
      const i = ((ca.y + y) * a.width + ca.x + x) * 4;
      const j = ((cb.y + y) * b.width + cb.x + x) * 4;
      for (let k = 0; k < 4; k += 1) {
        if (Math.abs(a.data[i + k] - b.data[j + k]) > tolerance) {
          differing += 1;
          break;
        }
      }
    }
  }
  return { pixels, differing };
}
